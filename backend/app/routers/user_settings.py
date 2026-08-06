from fastapi import APIRouter, Depends, Header

from app.core.dependencies import get_user_repo
from app.core.rate_limit import enforce_user_action_rate_limit
from app.db import mongodb as mongo_db
from app.db.repositories.postgres import UserRepository
from app.models.schemas import UserPreferences, UserPreferencesUpdate, UserSettingsResponse

router = APIRouter(dependencies=[Depends(enforce_user_action_rate_limit)])


def _get_settings_collection():
    """Get MongoDB settings collection"""
    return mongo_db.get_database()["user_settings"]


@router.get("/{user_id}", response_model=UserSettingsResponse)
async def get_user_settings(
    user_id: int,
    user_repo: UserRepository = Depends(get_user_repo),
) -> UserSettingsResponse:
    """Get user preferences/settings"""
    user = await user_repo.get_by_id(user_id)
    if not user:
        return UserSettingsResponse(
            user_id=user_id,
            preferences=UserPreferences(),
        )

    # Get settings from MongoDB
    settings_collection = _get_settings_collection()
    settings_doc = await settings_collection.find_one({"user_id": user_id})

    if settings_doc:
        prefs = UserPreferences(**settings_doc.get("preferences", {}))
    else:
        prefs = UserPreferences()

    return UserSettingsResponse(
        user_id=user_id,
        preferences=prefs,
    )


@router.post("/{user_id}", response_model=UserSettingsResponse)
async def update_user_settings(
    user_id: int,
    preferences: UserPreferencesUpdate,
    user_repo: UserRepository = Depends(get_user_repo),
) -> UserSettingsResponse:
    """Update user preferences/settings"""
    user = await user_repo.get_by_id(user_id)
    if not user:
        return UserSettingsResponse(
            user_id=user_id,
            preferences=UserPreferences(),
        )

    # Save settings to MongoDB
    settings_collection = _get_settings_collection()
    await settings_collection.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "user_id": user_id,
                "preferences": preferences.model_dump(),
            }
        },
        upsert=True,
    )

    return UserSettingsResponse(
        user_id=user_id,
        preferences=preferences,
    )
