from app.core import rate_limit
from app.core.config import settings


async def test_signup_login_and_protected_route(client):
    signup = await client.post(
        "/auth/signup",
        json={"name": "Sara", "email": "Sara@Test.dev", "password": "secret123", "role": "client"},
    )
    assert signup.status_code == 201
    assert signup.json()["access_token"]

    login = await client.post(
        "/auth/login", json={"email": "sara@test.dev", "password": "secret123"}
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    project = {"title": "API", "budget": 5000, "required_skills": ["Python"]}
    assert (await client.post("/projects", json=project)).status_code == 401
    created = await client.post(
        "/projects", json=project, headers={"Authorization": f"Bearer {token}"}
    )
    assert created.status_code == 201


async def test_admin_role_cannot_be_self_assigned(client):
    response = await client.post(
        "/auth/signup",
        json={"name": "Mallory", "email": "m@test.dev", "password": "secret123", "role": "admin"},
    )
    assert response.status_code == 422


async def test_freelancer_signup_creates_embedded_profile(client):
    response = await client.post(
        "/auth/signup",
        json={"name": "Ali", "email": "ali@test.dev", "password": "secret123", "role": "freelancer"},
    )
    assert response.status_code == 201
    freelancer_id = response.json()["freelancer_id"]
    profile = await client.get(f"/freelancers/{freelancer_id}")
    assert profile.status_code == 200


async def test_wrong_password_rejected_then_backoff(client, make_user, monkeypatch):
    await make_user("client", email="c@test.dev", password="right123")
    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    monkeypatch.setattr(rate_limit, "auth_limiter", rate_limit.AuthBackoffLimiter())

    statuses = [
        (await client.post("/auth/login", json={"email": "c@test.dev", "password": "wrong"})).status_code
        for _ in range(settings.rate_limit_auth_free_attempts + 2)
    ]
    assert statuses[0] == 401
    assert 429 in statuses
