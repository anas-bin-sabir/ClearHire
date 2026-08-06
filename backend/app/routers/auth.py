import re

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Literal, Optional

from app.core.dependencies import get_db_session
from app.db.repositories.postgres import UserRepository, FreelancerRepository
from app.db.repositories.mongo import FreelancerMetaRepository
from app.db.repositories.neo4j import GraphRepository
from app.core.security import get_password_hash, verify_password
from app.models.orm import User, Freelancer
from app.db.utils.embeddings import random_unit_embedding

router = APIRouter()

NAME_PATTERN = re.compile(r"^[A-Za-z0-9À-ÿ .,'\-]{1,255}$")
PASSWORD_HAS_LETTER = re.compile(r"[A-Za-z]")
PASSWORD_HAS_DIGIT = re.compile(r"\d")


class UserSignupRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr = Field(..., max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
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

    @field_validator("password")
    @classmethod
    def _password_valid(cls, v: str) -> str:
        if not PASSWORD_HAS_LETTER.search(v) or not PASSWORD_HAS_DIGIT.search(v):
            raise ValueError("must contain at least one letter and one digit")
        return v


class UserSignupResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    freelancer_id: Optional[int] = None
    message: str


class UserLoginRequest(BaseModel):
    email: EmailStr = Field(..., max_length=255)
    password: str = Field(..., min_length=1, max_length=128)

    model_config = {"extra": "forbid"}


class UserLoginResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    freelancer_id: Optional[int] = None


@router.post("/signup", response_model=UserSignupResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    body: UserSignupRequest,
    session: AsyncSession = Depends(get_db_session),
) -> UserSignupResponse:
    user_repo = UserRepository(session)
    existing_user = await user_repo.get_by_email(body.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address already registered",
        )

    # Hash the password
    pwd_hash = get_password_hash(body.password)

    # Create the user
    user = await user_repo.create(
        name=body.name,
        email=body.email,
        role=body.role,
        password_hash=pwd_hash,
    )

    freelancer_id = None
    if body.role == "freelancer":
        freelancer_repo = FreelancerRepository(session)
        # Create freelancer in Postgres
        freelancer = await freelancer_repo.create(
            user_id=user.id,
            name=body.name,
            skills=[],
            rating=5.0,
            hourly_rate=0.0,
            experience_years=0,
            account_age_days=0,
            fraud_score=0.0,
            bio="",
            location="",
            availability=True,
            review_count=0,
            portfolio_urls=[],
            embedding=random_unit_embedding(),
        )
        freelancer_id = freelancer.id

        # Create freelancer meta in Mongo
        try:
            meta_repo = FreelancerMetaRepository()
            await meta_repo.upsert(
                freelancer_id=freelancer.id,
                tags=[],
                social_links={"linkedin": f"https://linkedin.com/in/fl-{freelancer.id}"},
                verification={"email": True, "id": True},
            )
        except Exception:
            pass

        # Create freelancer node in Neo4j
        try:
            graph_repo = GraphRepository()
            await graph_repo.merge_freelancer(
                freelancer_id=freelancer.id,
                name=freelancer.name,
                skills=[],
            )
        except Exception:
            pass

    return UserSignupResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        freelancer_id=freelancer_id,
        message="Registration successful",
    )


@router.post("/login", response_model=UserLoginResponse)
async def login(
    body: UserLoginRequest,
    session: AsyncSession = Depends(get_db_session),
) -> UserLoginResponse:
    user_repo = UserRepository(session)
    user = await user_repo.get_by_email(body.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    freelancer_id = None
    if user.role == "freelancer":
        # Get freelancer_id linked to user
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
    )
