import re
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.embeddings import embed_text, freelancer_embedding_text
from app.core.dependencies import get_db_session
from app.core.rate_limit import (
    enforce_auth_rate_limit,
    record_auth_failure,
    record_auth_success,
)
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.repositories.postgres import FreelancerRepository, UserRepository
from app.models.orm import Freelancer

router = APIRouter()

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


def _token_for(user) -> str:
    return create_access_token(user_id=user.id, role=user.role)


@router.post("/signup", response_model=UserSignupResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    request: Request,
    body: UserSignupRequest,
    session: AsyncSession = Depends(get_db_session),
) -> UserSignupResponse:
    enforce_auth_rate_limit(request, body.email)

    user_repo = UserRepository(session)
    existing_user = await user_repo.get_by_email(body.email)
    if existing_user:
        record_auth_failure(request, body.email)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email address already registered",
        )

    user = await user_repo.create(
        name=body.name,
        email=body.email,
        role=body.role,
        password_hash=get_password_hash(body.password),
    )

    freelancer_id = None
    if body.role == "freelancer":
        freelancer_repo = FreelancerRepository(session)
        freelancer = await freelancer_repo.create(
            user_id=user.id,
            name=body.name,
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
            embedding=embed_text(freelancer_embedding_text(name=body.name)),
        )
        freelancer_id = freelancer.id

    record_auth_success(request, body.email)
    return UserSignupResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        freelancer_id=freelancer_id,
        access_token=_token_for(user),
        message="Registration successful",
    )


@router.post("/login", response_model=UserLoginResponse)
async def login(
    request: Request,
    body: UserLoginRequest,
    session: AsyncSession = Depends(get_db_session),
) -> UserLoginResponse:
    enforce_auth_rate_limit(request, body.email)

    user_repo = UserRepository(session)
    user = await user_repo.get_by_email(body.email)
    if not user or not verify_password(body.password, user.password_hash):
        record_auth_failure(request, body.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    record_auth_success(request, body.email)

    freelancer_id = None
    if user.role == "freelancer":
        result = await session.execute(
            select(Freelancer.id).where(Freelancer.user_id == user.id)
        )
        freelancer_id = result.scalar_one_or_none()

    return UserLoginResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        freelancer_id=freelancer_id,
        access_token=_token_for(user),
    )
