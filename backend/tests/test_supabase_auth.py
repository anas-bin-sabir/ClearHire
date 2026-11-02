"""Supabase Auth mode with the GoTrue calls stubbed (no network).

Tokens are HS256-signed with a test JWT secret, the same path legacy Supabase
projects use; the ES256/JWKS path shares the claim checks.
"""

import time
import uuid

import pytest
from jose import jwt

from app.core import supabase_auth as sb
from app.core.config import settings
from app.core.security import get_password_hash
from app.db.repositories.postgres import UserRepository
from app.db.session import async_session_factory

SUPABASE_URL = "https://example-ref.supabase.co"
JWT_SECRET = "test-supabase-jwt-secret-with-enough-length"


def _token(sub: str, *, iss: str | None = None, aud: str = "authenticated", ttl: int = 3600) -> str:
    return jwt.encode(
        {
            "sub": sub,
            "aud": aud,
            "iss": iss or f"{SUPABASE_URL}/auth/v1",
            "role": "authenticated",
            "exp": int(time.time()) + ttl,
        },
        JWT_SECRET,
        algorithm="HS256",
    )


class FakeSupabase:
    """In-memory stand-in for the GoTrue endpoints the app calls."""

    def __init__(self) -> None:
        self.users: dict[str, dict] = {}  # email -> {id, password, app_metadata, user_metadata}
        self.deleted: list[str] = []

    def _session(self, user: dict) -> sb.AuthSession:
        return sb.AuthSession(
            auth_user_id=user["id"],
            email=user["email"],
            access_token=_token(user["id"]),
            refresh_token=f"refresh-{user['id']}",
            expires_in=3600,
            app_metadata=user["app_metadata"],
            user_metadata=user["user_metadata"],
        )

    def add(self, email: str, password: str, *, role: str | None = None, name: str | None = None) -> dict:
        user = {
            "id": str(uuid.uuid4()),
            "email": email,
            "password": password,
            "app_metadata": {"role": role} if role else {},
            "user_metadata": {"name": name} if name else {},
        }
        self.users[email] = user
        return user

    async def admin_create_user(self, *, email, password, name, role):
        if email in self.users:
            raise sb.SupabaseAuthError(422, "email_exists", "A user with this email address has already been registered")
        return self.add(email, password, role=role, name=name)["id"]

    async def admin_delete_user(self, auth_user_id):
        self.deleted.append(auth_user_id)
        self.users = {e: u for e, u in self.users.items() if u["id"] != auth_user_id}

    async def sign_in_with_password(self, email, password):
        user = self.users.get(email)
        if user is None or user["password"] != password:
            raise sb.SupabaseAuthError(400, "invalid_credentials", "Invalid login credentials")
        return self._session(user)

    async def refresh_session(self, refresh_token):
        for user in self.users.values():
            if refresh_token == f"refresh-{user['id']}":
                return self._session(user)
        raise sb.SupabaseAuthError(400, "refresh_token_not_found", "Invalid Refresh Token")


@pytest.fixture
def fake_supabase(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(settings, "auth_provider", "supabase")
    monkeypatch.setattr(settings, "supabase_url", SUPABASE_URL)
    monkeypatch.setattr(settings, "supabase_jwt_secret", JWT_SECRET)
    for name in ("admin_create_user", "admin_delete_user", "sign_in_with_password", "refresh_session"):
        monkeypatch.setattr(sb, name, getattr(fake, name))
    return fake


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def test_signup_creates_supabase_user_and_token_works(client, fake_supabase):
    response = await client.post(
        "/auth/signup",
        json={"name": "Sara", "email": "sara@test.dev", "password": "secret123", "role": "client"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["refresh_token"] and body["expires_in"] == 3600
    assert fake_supabase.users["sara@test.dev"]["app_metadata"] == {"role": "client"}

    async with async_session_factory() as session:
        user = await UserRepository(session).get_by_email("sara@test.dev")
    assert str(user.auth_user_id) == fake_supabase.users["sara@test.dev"]["id"]
    assert user.password_hash is None  # Supabase owns the password

    project = {"title": "API", "budget": 5000, "required_skills": ["Python"]}
    created = await client.post("/projects", json=project, headers=_auth(body["access_token"]))
    assert created.status_code == 201


async def test_freelancer_signup_gets_profile(client, fake_supabase):
    response = await client.post(
        "/auth/signup",
        json={"name": "Ali", "email": "ali@test.dev", "password": "secret123", "role": "freelancer"},
    )
    assert response.status_code == 201
    assert response.json()["freelancer_id"]


async def test_signup_existing_supabase_email_conflicts(client, fake_supabase):
    fake_supabase.add("taken@test.dev", "whatever1")
    response = await client.post(
        "/auth/signup",
        json={"name": "Sam", "email": "taken@test.dev", "password": "secret123", "role": "client"},
    )
    assert response.status_code == 409


async def test_login_and_wrong_password(client, fake_supabase):
    await client.post(
        "/auth/signup",
        json={"name": "Sara", "email": "sara@test.dev", "password": "secret123", "role": "client"},
    )
    ok = await client.post("/auth/login", json={"email": "sara@test.dev", "password": "secret123"})
    assert ok.status_code == 200
    assert ok.json()["role"] == "client"
    bad = await client.post("/auth/login", json={"email": "sara@test.dev", "password": "nope1234"})
    assert bad.status_code == 401


async def test_local_account_migrates_on_first_login(client, fake_supabase):
    async with async_session_factory() as session:
        await UserRepository(session).create(
            name="Admin", email="admin@demo.com", role="admin",
            password_hash=get_password_hash("demo1234"),
        )
        await session.commit()

    response = await client.post("/auth/login", json={"email": "admin@demo.com", "password": "demo1234"})
    assert response.status_code == 200
    assert response.json()["role"] == "admin"
    assert "admin@demo.com" in fake_supabase.users

    async with async_session_factory() as session:
        user = await UserRepository(session).get_by_email("admin@demo.com")
    assert user.auth_user_id is not None and user.password_hash is None

    # A wrong password never migrates.
    async with async_session_factory() as session:
        await UserRepository(session).create(
            name="C", email="c@demo.com", role="client", password_hash=get_password_hash("right123")
        )
        await session.commit()
    wrong = await client.post("/auth/login", json={"email": "c@demo.com", "password": "wrong123"})
    assert wrong.status_code == 401
    assert "c@demo.com" not in fake_supabase.users


async def test_dashboard_created_user_gets_app_user(client, fake_supabase):
    fake_supabase.add("new@test.dev", "secret123", role="freelancer", name="Nadia")
    response = await client.post("/auth/login", json={"email": "new@test.dev", "password": "secret123"})
    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "freelancer" and body["name"] == "Nadia" and body["freelancer_id"]


async def test_app_metadata_role_is_validated(client, fake_supabase):
    fake_supabase.add("odd@test.dev", "secret123", role="superuser")
    response = await client.post("/auth/login", json={"email": "odd@test.dev", "password": "secret123"})
    assert response.json()["role"] == "client"


async def test_refresh(client, fake_supabase):
    signup = await client.post(
        "/auth/signup",
        json={"name": "Sara", "email": "sara@test.dev", "password": "secret123", "role": "client"},
    )
    refreshed = await client.post("/auth/refresh", json={"refresh_token": signup.json()["refresh_token"]})
    assert refreshed.status_code == 200
    assert refreshed.json()["access_token"]
    bad = await client.post("/auth/refresh", json={"refresh_token": "nope"})
    assert bad.status_code == 401


async def test_refresh_disabled_in_local_mode(client):
    response = await client.post("/auth/refresh", json={"refresh_token": "x"})
    assert response.status_code == 404


@pytest.mark.parametrize(
    "token_kwargs",
    [
        {"iss": "https://other.supabase.co/auth/v1"},
        {"aud": "anon"},
        {"ttl": -60},
    ],
)
async def test_bad_tokens_rejected(client, fake_supabase, token_kwargs):
    signup = await client.post(
        "/auth/signup",
        json={"name": "Sara", "email": "sara@test.dev", "password": "secret123", "role": "client"},
    )
    sub = fake_supabase.users["sara@test.dev"]["id"]
    assert signup.status_code == 201
    project = {"title": "API", "budget": 5000, "required_skills": ["Python"]}
    response = await client.post("/projects", json=project, headers=_auth(_token(sub, **token_kwargs)))
    assert response.status_code == 401


async def test_local_tokens_rejected_in_supabase_mode(client, make_user, fake_supabase):
    _, headers = await make_user("client")
    project = {"title": "API", "budget": 5000, "required_skills": ["Python"]}
    assert (await client.post("/projects", json=project, headers=headers)).status_code == 401


async def test_unknown_subject_rejected(client, fake_supabase):
    project = {"title": "API", "budget": 5000, "required_skills": ["Python"]}
    response = await client.post("/projects", json=project, headers=_auth(_token(str(uuid.uuid4()))))
    assert response.status_code == 401
