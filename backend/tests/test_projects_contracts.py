async def test_only_owner_can_update_project(client, make_user, make_project):
    owner, owner_headers = await make_user("client")
    _, other_headers = await make_user("client")
    project = await make_project(owner.id)

    patch = {"budget": 20000}
    assert (await client.patch(f"/projects/{project.id}", json=patch)).status_code == 401
    assert (
        await client.patch(f"/projects/{project.id}", json=patch, headers=other_headers)
    ).status_code == 403
    ok = await client.patch(f"/projects/{project.id}", json=patch, headers=owner_headers)
    assert ok.status_code == 200 and ok.json()["budget"] == 20000


async def test_hiring_requires_project_ownership(client, make_user, make_project, make_freelancer):
    owner, owner_headers = await make_user("client")
    _, other_headers = await make_user("client")
    project = await make_project(owner.id)
    f1 = await make_freelancer(name="A")
    f2 = await make_freelancer(name="B")
    body = {"project_id": project.id, "freelancer_ids": [f1.id, f2.id]}

    assert (await client.post("/contracts/batch", json=body, headers=other_headers)).status_code == 403
    hired = await client.post("/contracts/batch", json=body, headers=owner_headers)
    assert hired.status_code == 201 and hired.json()["total"] == 2

    record = (await client.get(f"/projects/{project.id}")).json()
    assert record["status"] == "in_progress"
    assert sorted(record["team_members"]) == [f1.id, f2.id]


async def test_contract_status_editable_by_parties_only(client, make_user, make_project, make_freelancer):
    owner, owner_headers = await make_user("client")
    worker, worker_headers = await make_user("freelancer")
    _, stranger_headers = await make_user("client")
    project = await make_project(owner.id)
    freelancer = await make_freelancer(user_id=worker.id)
    contract = (
        await client.post(
            "/contracts",
            json={"project_id": project.id, "freelancer_id": freelancer.id},
            headers=owner_headers,
        )
    ).json()

    url = f"/contracts/{contract['id']}"
    assert (await client.patch(url, json={"status": "completed"}, headers=stranger_headers)).status_code == 403
    assert (await client.patch(url, json={"status": "completed"}, headers=worker_headers)).status_code == 200
