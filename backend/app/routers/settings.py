from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_current_user, get_user_repo, get_user_settings_repo
from app.core.rate_limit import enforce_user_action_rate_limit
from app.db.repositories.postgres import UserRepository
from app.models.orm import User
from app.models.schemas import UserPreferences, UserPreferencesUpdate, UserSettingsResponse

router = APIRouter(dependencies=[Depends(enforce_user_action_rate_limit)])


def _can_manage(actor: User, user_id: int) -> bool:
    return actor.id == user_id or actor.role == "admin"


@router.get("/{user_id}", response_model=UserSettingsResponse)
async def get_user_settings(
    user_id: int,
    actor: User = Depends(get_current_user),
    user_repo: UserRepository = Depends(get_user_repo),
    settings_repo=Depends(get_user_settings_repo),
) -> UserSettingsResponse:
    if not _can_manage(actor, user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    user = await user_repo.get_by_id(user_id)
    if not user:
        return UserSettingsResponse(user_id=user_id, preferences=UserPreferences())
    stored = await settings_repo.get(user_id)
    prefs = UserPreferences(**(stored or {}))
    return UserSettingsResponse(user_id=user_id, preferences=prefs)


@router.post("/{user_id}", response_model=UserSettingsResponse)
async def update_user_settings(
    user_id: int,
    preferences: UserPreferencesUpdate,
    actor: User = Depends(get_current_user),
    user_repo: UserRepository = Depends(get_user_repo),
    settings_repo=Depends(get_user_settings_repo),
) -> UserSettingsResponse:
    if not _can_manage(actor, user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    user = await user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await settings_repo.save(user_id, preferences.model_dump())
    return UserSettingsResponse(user_id=user_id, preferences=preferences)
