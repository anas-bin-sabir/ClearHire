from typing import Any

from app.models.orm import Freelancer, Project


def freelancer_to_dict(fl: Freelancer | dict[str, Any]) -> dict[str, Any]:
    if isinstance(fl, dict):
        return fl
    return {
        "id": fl.id,
        "user_id": fl.user_id,
        "name": fl.name,
        "skills": list(fl.skills or []),
        "rating": fl.rating,
        "hourly_rate": fl.hourly_rate,
        "experience_years": fl.experience_years,
        "account_age_days": fl.account_age_days,
        "fraud_score": fl.fraud_score,
        "bio": fl.bio,
        "location": fl.location,
        "availability": fl.availability,
        "review_count": fl.review_count,
        "portfolio_urls": list(fl.portfolio_urls or []),
        "referred_by_id": fl.referred_by_id,
    }


def project_to_dict(project: Project) -> dict[str, Any]:
    return {
        "id": project.id,
        "client_id": project.client_id,
        "title": project.title,
        "description": project.description,
        "required_skills": list(project.required_skills or []),
        "budget": project.budget,
        "deadline_days": project.deadline_days,
        "team_size": project.team_size,
    }
