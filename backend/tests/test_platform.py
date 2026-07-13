from app.db.seed import DatabaseSeeder
from app.db.session import async_session_factory


async def test_dashboard_endpoints_are_mounted(client, make_user, make_freelancer):
    _, admin_headers = await make_user("admin")
    await make_freelancer(skills=["Python", "Docker"])
    for path in ("/stats", "/analytics?days=3", "/activity/feed", "/activity/searches/recent", "/health"):
        response = await client.get(path)
        assert response.status_code == 200, (path, response.text)

    assert (await client.get("/graph")).status_code == 401
    graph = await client.get("/graph", headers=admin_headers)
    assert graph.status_code == 200
    types = {n["type"] for n in graph.json()["nodes"]}
    assert types == {"freelancer", "skill"}


async def test_settings_are_private(client, make_user):
    user, headers = await make_user("client")
    _, other_headers = await make_user("client")
    assert (await client.get(f"/settings/{user.id}", headers=other_headers)).status_code == 403
    assert (await client.get(f"/settings/{user.id}", headers=headers)).status_code == 200


async def test_seed_endpoint_is_admin_only(client, make_user):
    _, client_headers = await make_user("client")
    body = {"freelancer_count": 3, "reset": True}
    assert (await client.post("/seed", json=body)).status_code == 401
    assert (await client.post("/seed", json=body, headers=client_headers)).status_code == 403


async def test_seeder_scores_fraud_with_the_model():
    async with async_session_factory() as session:
        result = await DatabaseSeeder(session).run(freelancer_count=10, reset=True)
        await session.commit()
    assert result.freelancers_created == 10 and result.contracts_created == 3

    async with async_session_factory() as session:
        from sqlalchemy import select
        from app.models.orm import Freelancer

        rows = (await session.execute(select(Freelancer).order_by(Freelancer.id))).scalars().all()
    demo, suspicious, normal = rows[0], rows[1:6], rows[6:]
    assert demo.name == "Ali Raza" and demo.fraud_score < 0.6
    assert all(f.fraud_score >= 0.65 for f in suspicious)
    assert all(f.fraud_score < 0.6 for f in normal)
    assert all(f.embedding is not None for f in rows)
