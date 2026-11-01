"""The Neo4j graph model. Single source of truth for labels, keys and edges.

Nodes (key property in brackets):
    (:Freelancer {id, name, rating, fraud_score, availability, hourly_rate})
    (:Skill      {key, name, category})            # key = lower(canonical name); MERGE on key
    (:Project    {id, title, status?})
    (:Client     {id, name})                        # a User with role client

Edges:
    (Freelancer)-[:HAS_SKILL {level}]->(Skill)      # level: experience_years for now
    (Project)-[:REQUIRES {importance}]->(Skill)     # importance: "must" | "nice"
    (Skill)-[:RELATED_TO {weight}]->(Skill)         # stored once per pair; query undirected
    (Freelancer)-[:WORKED_ON {status, rating}]->(Project)   # from contracts
    (Client)-[:POSTED]->(Project)
    (Freelancer)-[:REFERRED_BY]->(Freelancer)
    (Client)-[:REVIEWED {rating}]->(Freelancer)     # reserved; no review table yet
    (Freelancer)-[:COLLABORATED_WITH {count, avg_rating}]-(Freelancer)
        # derived: pairs sharing a WORKED_ON project with status "completed";
        # stored once per pair (lower id -> higher id), query undirected.

All writes use MERGE on the key property, so every sync is idempotent.
Skills are always matched on ``key`` (lower-cased canonical name), never ``name``.
"""

FREELANCER = "Freelancer"
SKILL = "Skill"
PROJECT = "Project"
CLIENT = "Client"

HAS_SKILL = "HAS_SKILL"
REQUIRES = "REQUIRES"
RELATED_TO = "RELATED_TO"
WORKED_ON = "WORKED_ON"
POSTED = "POSTED"
REFERRED_BY = "REFERRED_BY"
REVIEWED = "REVIEWED"
COLLABORATED_WITH = "COLLABORATED_WITH"

COMPLETED = "completed"

# Run once at startup / before a rebuild. IF NOT EXISTS keeps them idempotent.
CONSTRAINTS: tuple[str, ...] = (
    "CREATE CONSTRAINT freelancer_id IF NOT EXISTS FOR (n:Freelancer) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT project_id IF NOT EXISTS FOR (n:Project) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT client_id IF NOT EXISTS FOR (n:Client) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT skill_key IF NOT EXISTS FOR (n:Skill) REQUIRE n.key IS UNIQUE",
)
