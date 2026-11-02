import logging
import re
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.embeddings import embed_text, freelancer_embedding_text
from app.core import supabase_auth as sb
from app.core.config import settings
from app.core.dependencies import get_db_session
from app.core.rate_limit import (
    enforce_auth_rate_limit,
    enforce_user_action_rate_limit,
    record_auth_failure,
    record_auth_success,
)
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.repositories.postgres import FreelancerRepository, UserRepository
from app.models.orm import Freelancer, User

router = APIRouter()
logger = logging.getLogger(__name__)

ROLES = ("client", "freelancer", "admin")

NAME_PATTERN = re.compile(r"^[A-Za-z0-9À-ÿ .,'\-]{1,255}$")
PASSWORD_HAS_LETTER = re.compile(r"[A-Za-z]")
PASSWORD_HAS_DIGIT = re.compile(r"\d")


class UserSignupRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr = Field(..., max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    # Admin accounts are provisioned by the seeder/operators, never self-registered.
    role: Literal["client", "freelancer"] = "client"

    model_config = {"extra": "forbid"}

    @field_validator("name")
    @classmethod
    def _name_valid(cls, v: str) -> str:
        v = v.strip()
        if not NAME_PATTERN.match(v):
            raise ValueError(
                "must be 1-255 characters using letters, numbers, spaces, and . , ' - only"
            )
        return v

    @field_validator("email")
    @classmethod
    def _email_norm(cls, v: str) -> str:
        return str(v).strip().lower()

    @field_validator("password")
    @classmethod
    def _password_valid(cls, v: str) -> str:
        if not PASSWORD_HAS_LETTER.search(v) or not PASSWORD_HAS_DIGIT.search(v):
            raise ValueError("must contain at least one letter and one digit")
        return v


class AuthUserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    freelancer_id: Optional[int] = None
    access_token: str
    token_type: str = "bearer"
    # Set with Supabase Auth: access tokens are short-lived (expires_in seconds) and
    # renewed through POST /auth/refresh.
    refresh_token: Optional[str] = None
    expires_in: Optional[int] = None
    message: Optional[str] = None


class UserSignupResponse(AuthUserResponse):
    pass


class UserLoginRequest(BaseModel):
    email: EmailStr = Field(..., max_length=255)
    password: str = Field(..., min_length=1, max_length=128)

    model_config = {"extra": "forbid"}

    @field_validator("email")
    @classmethod
    def _email_norm(cls, v: str) -> str:
        return str(v).strip().lower()


class UserLoginResponse(AuthUserResponse):
    pass


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1, max_length=2048)

    model_config = {"extra": "forbid"}


class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    token_type: str = "bearer"


INVALID_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid email or password",
)


def _auth_unavailable() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Sign-in is temporarily unavailable. Try again shortly.",
    )


async def _freelancer_id_for(session: AsyncSession, user: User) -> int | None:
    if user.role != "freelancer":
        return None
    result = await session.execute(select(Freelancer.id).where(Freelancer.user_id == user.id))
    return result.scalars().first()


async def _create_freelancer_profile(session: AsyncSession, user_id: int, name: str) -> int:
    freelancer = await FreelancerRepository(session).create(
        user_id=user_id,
        name=name,
        skills=[],
        rating=0.0,
        hourly_rate=0.0,
        experience_years=0,
        account_age_days=0,
        fraud_score=0.0,
        bio="",
        location="",
        availability=True,
        review_count=0,
        portfolio_urls=[],
        embedding=embed_text(freelancer_embedding_text(name=name)),
    )
    return freelancer.id


# ── Local mode: the app's own password hashes and HS256 tokens ────────────────


async def _signup_local(body: UserSignupRequest, session: AsyncSession) -> tuple[User, str, None]:
    user = await UserRepository(session).create(
        name=body.name,
        email=body.email,
        role=body.role,
        password_hash=get_password_hash(body.password),
    )
    return user, create_access_token(user_id=user.id, role=user.role), None


async def _login_local(body: UserLoginRequest, session: AsyncSession) -> tuple[User, str, None]:
    user = await UserRepository(session).get_by_email(body.email)
    if not user or not verify_password(body.password, user.password_hash):
        raise INVALID_CREDENTIALS
    return user, create_access_token(user_id=user.id, role=user.role), None


# ── Supabase mode: Supabase Auth owns passwords and issues tokens ─────────────


async def _signup_supabase(
    body: UserSignupRequest, session: AsyncSession
) -> tuple[User, str, sb.AuthSession]:
    try:
        auth_id = await sb.admin_create_user(
            email=body.email, password=body.password, name=body.name, role=body.role
        )
    except sb.SupabaseAuthError as exc:
        if exc.code == "email_exists" or "already" in exc.message.lower():
            raise HTTPException(status.HTTP_409_CONFLICT, "Email address already registered")
        if exc.code == "weak_password":
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, exc.message)
        logger.warning("supabase signup rejected: %s %s", exc.status, exc.code)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, exc.message)
    except sb.SupabaseUnavailable as exc:
        raise _auth_unavailable() from exc

    try:
        auth = await sb.sign_in_with_password(body.email, body.password)
        user = await UserRepository(session).create(
            name=body.name, email=body.email, role=body.role, auth_user_id=auth_id
        )
    except Exception as exc:
        # Don't leave a Supabase account without its app user.
        try:
            await sb.admin_delete_user(auth_id)
        except Exception:  # noqa: BLE001 - best effort; login re-links orphans by email
            logger.warning("couldn't remove orphaned Supabase user after failed signup")
        if isinstance(exc, (sb.SupabaseAuthError, sb.SupabaseUnavailable)):
            raise _auth_unavailable() from exc
        raise
    return user, auth.access_token, auth


async def _migrate_local_password(
    body: UserLoginRequest, session: AsyncSession
) -> sb.AuthSession | None:
    """Move an account that still has a local hash (created before Supabase Auth, or
    by the seeder) into Supabase on its first successful login."""
    user = await UserRepository(session).get_by_email(body.email)
    if user is None or user.auth_user_id is not None:
        return None
    if not verify_password(body.password, user.password_hash):
        return None
    try:
        auth_id = await sb.admin_create_user(
            email=user.email, password=body.password, name=user.name, role=user.role
        )
    except sb.SupabaseAuthError as exc:
        logger.warning("couldn't migrate user %s to Supabase Auth: %s", user.id, exc.code)
        return None
    await UserRepository(session).link_auth_id(user.id, auth_id)
    return await sb.sign_in_with_password(body.email, body.password)


async def _app_user_for(auth: sb.AuthSession, email: str, session: AsyncSession) -> User:
    """The app user behind a Supabase session: by link, else by email (then linked),
    else created from the account's metadata (e.g. a user added in the dashboard)."""
    repo = UserRepository(session)
    user = await repo.get_by_auth_id(auth.auth_user_id)
    if user is not None:
        return user
    user = await repo.get_by_email(auth.email or email)
    if user is not None:
        if user.auth_user_id is not None:
            # The email belongs to a different Supabase account than the one linked.
            raise INVALID_CREDENTIALS
        await repo.link_auth_id(user.id, auth.auth_user_id)
        await session.refresh(user)
        return user
    role = auth.app_metadata.get("role")
    role = role if role in ROLES else "client"
    name = str(auth.user_metadata.get("name") or (auth.email or email).split("@")[0])[:255]
    user = await repo.create(
        name=name, email=auth.email or email, role=role, auth_user_id=auth.auth_user_id
    )
    if role == "freelancer":
        await _create_freelancer_profile(session, user.id, name)
    return user


async def _login_supabase(
    body: UserLoginRequest, session: AsyncSession
) -> tuple[User, str, sb.AuthSession]:
    try:
        try:
            auth = await sb.sign_in_with_password(body.email, body.password)
        except sb.SupabaseAuthError as exc:
            if exc.code == "email_not_confirmed":
                raise HTTPException(
                    status.HTTP_401_UNAUTHORIZED, "Confirm your email address before signing in"
                )
            if exc.status == 429:
                raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many attempts")
            migrated = await _migrate_local_password(body, session)
            if migrated is None:
                raise INVALID_CREDENTIALS
            auth = migrated
    except sb.SupabaseUnavailable as exc:
        raise _auth_unavailable() from exc
    user = await _app_user_for(auth, body.email, session)
    return user, auth.access_token, auth


@router.post("/signup", response_model=UserSignupResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    request: Request,
    body: UserSignupRequest,
    session: AsyncSession = Depends(get_db_session),
) -> UserSignupResponse:
    enforce_auth_rate_limit(request, body.email)

    if await UserRepository(session).get_by_email(body.email):
        record_auth_failure(request, body.email)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email address already registered",
        )

    try:
        if settings.uses_supabase_auth:
            user, access_token, auth = await _signup_supabase(body, session)
        else:
            user, access_token, auth = await _signup_local(body, session)
    except HTTPException as exc:
        if exc.status_code < 500:
            record_auth_failure(request, body.email)
        raise

    freelancer_id = None
    if body.role == "freelancer":
        freelancer_id = await _create_freelancer_profile(session, user.id, body.name)

    record_auth_success(request, body.email)
    return UserSignupResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        freelancer_id=freelancer_id,
        access_token=access_token,
        refresh_token=auth.refresh_token if auth else None,
        expires_in=auth.expires_in if auth else None,
        message="Registration successful",
    )


@router.post("/login", response_model=UserLoginResponse)
async def login(
    request: Request,
    body: UserLoginRequest,
    session: AsyncSession = Depends(get_db_session),
) -> UserLoginResponse:
    enforce_auth_rate_limit(request, body.email)

    try:
        if settings.uses_supabase_auth:
            user, access_token, auth = await _login_supabase(body, session)
        else:
            user, access_token, auth = await _login_local(body, session)
    except HTTPException as exc:
        if exc.status_code in (401, 429):
            record_auth_failure(request, body.email)
        raise

    record_auth_success(request, body.email)
    return UserLoginResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        freelancer_id=await _freelancer_id_for(session, user),
        access_token=access_token,
        refresh_token=auth.refresh_token if auth else None,
        expires_in=auth.expires_in if auth else None,
    )


@router.post(
    "/refresh",
    response_model=RefreshResponse,
    dependencies=[Depends(enforce_user_action_rate_limit)],
)
async def refresh(
    body: RefreshRequest,
    session: AsyncSession = Depends(get_db_session),
) -> RefreshResponse:
    """Exchange a Supabase refresh token for a new access token (Supabase mode only;
    local tokens last ACCESS_TOKEN_EXPIRE_MINUTES and aren't refreshed)."""
    if not settings.uses_supabase_auth:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Token refresh isn't enabled")
    try:
        auth = await sb.refresh_session(body.refresh_token)
    except sb.SupabaseAuthError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired") from exc
    except sb.SupabaseUnavailable as exc:
        raise _auth_unavailable() from exc
    if await UserRepository(session).get_by_auth_id(auth.auth_user_id) is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired")
    return RefreshResponse(
        access_token=auth.access_token,
        refresh_token=auth.refresh_token,
        expires_in=auth.expires_in,
    )
