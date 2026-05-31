# ClearHire — Full Project Setup Guide

> Next.js frontend · FastAPI backend · PostgreSQL + pgvector · Neo4j · LLM API

---

## Prerequisites — install these first

| Tool           | Version | Why                              |
| -------------- | ------- | -------------------------------- |
| Python         | 3.10+   | FastAPI backend                  |
| Node.js        | 18+     | Next.js frontend                 |
| Docker Desktop | latest  | Runs PostgreSQL, pgvector, Neo4j |
| Git            | any     | Version control                  |

Download links:

- Python: https://www.python.org/downloads/
- Node.js: https://nodejs.org/
- Docker Desktop: https://www.docker.com/products/docker-desktop/

---

## Multi-database Approach Benefits

- Performance - Each DB optimized for its use case
- Reliability - Separate failure domains
- Scalability - Independent scaling per database
- Intelligence - Graph for recommendations, vectors for ML

---

## Data Flow Example

1. User searches for "Python + React developers"
2. Query goes to PostgreSQL (vector search + embedding)
3. Neo4j finds related skills (Python → JavaScript → React)
4. MongoDB logs the search query for analytics
5. Results returned with AI explanations (also saved to MongoDB)
6. Activity logged to MongoDB for audit trail

---

## Step 1 — Project folder structure

Create this layout on your machine:

```
clearhire/
├── backend/              ← FastAPI (Python)
│   ├── app/
│   │   ├── main.py
│   │   ├── routers/
│   │   │   ├── matching.py
│   │   │   ├── fraud.py
│   │   │   ├── csp.py
│   │   │   └── graph.py
│   │   ├── ai/
│   │   │   ├── astar.py
│   │   │   ├── bayesian.py
│   │   │   ├── csp_solver.py
│   │   │   └── knowledge_graph.py
│   │   ├── db/
│   │   │   ├── postgres.py
│   │   │   ├── neo4j_client.py
│   │   │   └── vector_store.py
│   │   └── models/
│   │       └── schemas.py
│   ├── requirements.txt
│   └── .env
│
├── frontend/             ← Next.js (React)
│   ├── pages/
│   ├── components/
│   └── package.json
│
├── docker-compose.yml    ← Spins up all databases
└── README.md
```

Run this in terminal to create it:

```bash
mkdir -p clearhire/backend/app/{routers,ai,db,models}
mkdir -p clearhire/frontend
cd clearhire
git init
```

---

## Step 2 — Docker Compose (all databases in one command)

Create `clearhire/docker-compose.yml`:

```yaml
version: "3.8"

services:
  postgres:
    image: pgvector/pgvector:pg16 # PostgreSQL 16 + pgvector extension
    container_name: clearhire_postgres
    environment:
      POSTGRES_USER: clearhire
      POSTGRES_PASSWORD: clearhire123
      POSTGRES_DB: clearhire_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  neo4j:
    image: neo4j:5
    container_name: clearhire_neo4j
    environment:
      NEO4J_AUTH: neo4j/clearhire123
      NEO4J_PLUGINS: '["apoc"]' # APOC needed for graph algorithms
    ports:
      - "7474:7474" # Neo4j Browser UI
      - "7687:7687" # Bolt protocol (used by Python driver)
    volumes:
      - neo4j_data:/data

volumes:
  postgres_data:
  neo4j_data:
```

Start all databases:

```bash
cd clearhire
docker compose up -d
```

Verify they're running:

```bash
docker compose ps
# Both should show "running"
```

---

## Step 3 — Backend setup (FastAPI)

### 3.1 Create virtual environment

```bash
cd clearhire/backend
python -m venv venv

# Activate — Windows:
venv\Scripts\activate

# Activate — Mac/Linux:
source venv/bin/activate
```

### 3.2 Create `requirements.txt`

```txt
fastapi==0.111.0
uvicorn==0.30.1
python-dotenv==1.0.1

# Database
psycopg2-binary==2.9.9
sqlalchemy==2.0.30
pgvector==0.2.5

# Neo4j
neo4j==5.20.0

# AI / ML
numpy==1.26.4
scikit-learn==1.5.0
sentence-transformers==3.0.1   # For generating embeddings

# LLM API
anthropic==0.28.0              # For the explanation engine (FR5)

# CSP
python-constraint==1.4.2
```

Install:

```bash
pip install -r requirements.txt
```

### 3.3 Create `.env` file

```env
# PostgreSQL
DATABASE_URL=postgresql://clearhire:clearhire123@localhost:5432/clearhire_db

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=clearhire123

# LLM (Anthropic Claude for explanation engine)
ANTHROPIC_API_KEY=your_api_key_here

# App
SECRET_KEY=your_random_secret_key_here
```

> Get your Anthropic API key at: https://console.anthropic.com

### 3.4 Database initialization

Create `backend/app/db/postgres.py`:

```python
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv()
engine = create_engine(os.getenv("DATABASE_URL"))

def init_db():
    with engine.connect() as conn:
        # Enable pgvector
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))

        conn.execute(text("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255),
            email VARCHAR(255) UNIQUE,
            role VARCHAR(50)          -- 'client', 'freelancer', 'admin'
        )"""))

        conn.execute(text("""
        CREATE TABLE IF NOT EXISTS freelancers (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            skills TEXT[],
            rating FLOAT DEFAULT 0,
            experience_years INT DEFAULT 0,
            hourly_rate FLOAT,
            embedding vector(384),    -- pgvector column
            fraud_score FLOAT DEFAULT 0.5,
            account_age_days INT DEFAULT 0
        )"""))

        conn.execute(text("""
        CREATE TABLE IF NOT EXISTS projects (
            id SERIAL PRIMARY KEY,
            client_id INTEGER REFERENCES users(id),
            description TEXT,
            required_skills TEXT[],
            budget FLOAT,
            deadline_days INT,
            team_size INT,
            embedding vector(384)
        )"""))

        conn.execute(text("""
        CREATE TABLE IF NOT EXISTS contracts (
            id SERIAL PRIMARY KEY,
            freelancer_id INTEGER REFERENCES freelancers(id),
            project_id INTEGER REFERENCES projects(id),
            status VARCHAR(50) DEFAULT 'pending'
        )"""))

        conn.commit()
    print("PostgreSQL tables created.")

if __name__ == "__main__":
    init_db()
```

Run it:

```bash
cd backend
python -m app.db.postgres
```

### 3.5 Neo4j initialization

Create `backend/app/db/neo4j_client.py`:

```python
from neo4j import GraphDatabase
from dotenv import load_dotenv
import os

load_dotenv()

driver = GraphDatabase.driver(
    os.getenv("NEO4J_URI"),
    auth=(os.getenv("NEO4J_USER"), os.getenv("NEO4J_PASSWORD"))
)

def init_graph():
    with driver.session() as session:
        # Create skill ontology nodes
        skills = [
            ("React", "Frontend"), ("Next.js", "Frontend"), ("Vue", "Frontend"),
            ("Node.js", "Backend"), ("FastAPI", "Backend"), ("Django", "Backend"),
            ("PostgreSQL", "Database"), ("MongoDB", "Database"), ("Neo4j", "Database"),
            ("Python", "General"), ("JavaScript", "General"), ("TypeScript", "General"),
            ("PyTorch", "ML"), ("TensorFlow", "ML"), ("scikit-learn", "ML"),
            ("Docker", "DevOps"), ("Kubernetes", "DevOps"), ("AWS", "DevOps"),
        ]

        for skill_name, category in skills:
            session.run(
                "MERGE (s:Skill {name: $name, category: $category})",
                name=skill_name, category=category
            )

        # Skill relationships (RELATED_TO)
        relations = [
            ("React", "JavaScript"), ("Next.js", "React"),
            ("Vue", "JavaScript"), ("TypeScript", "JavaScript"),
            ("FastAPI", "Python"), ("Django", "Python"),
            ("PyTorch", "Python"), ("TensorFlow", "Python"),
            ("Node.js", "JavaScript"),
        ]

        for a, b in relations:
            session.run("""
                MATCH (a:Skill {name:$a}), (b:Skill {name:$b})
                MERGE (a)-[:RELATED_TO]->(b)
            """, a=a, b=b)

    print("Neo4j skill graph initialized.")

if __name__ == "__main__":
    init_graph()
```

Run it:

```bash
python -m app.db.neo4j_client
```

Verify in Neo4j Browser at http://localhost:7474 — login with `neo4j / clearhire123`, run:

```cypher
MATCH (s:Skill) RETURN s LIMIT 25
```

### 3.6 Main FastAPI app

Create `backend/app/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import matching, fraud, csp, graph

app = FastAPI(title="ClearHire API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(matching.router, prefix="/api/matching", tags=["Matching"])
app.include_router(fraud.router,    prefix="/api/fraud",    tags=["Fraud"])
app.include_router(csp.router,      prefix="/api/csp",      tags=["CSP"])
app.include_router(graph.router,    prefix="/api/graph",    tags=["Graph"])

@app.get("/")
def root():
    return {"status": "ClearHire API running"}
```

Start the backend:

```bash
cd clearhire/backend
uvicorn app.main:app --reload --port 8000
```

Visit http://localhost:8000/docs — you'll see the auto-generated Swagger UI.

---

## Step 4 — Core AI modules (starter code)

### A\* Matching Engine — `backend/app/ai/astar.py`

```python
import heapq
from typing import List, Dict

def astar_rank_freelancers(candidates: List[Dict], job_embedding, weights=None) -> List[Dict]:
    """
    Ranks freelancers using A* where:
      g(n) = actual cost (skill gap + fraud penalty + rate deviation)
      h(n) = heuristic (embedding cosine similarity)
      f(n) = g(n) + h(n)  — lower is better
    """
    if weights is None:
        weights = {"skill": 0.4, "fraud": 0.3, "rate": 0.2, "embedding": 0.1}

    heap = []

    for fl in candidates:
        skill_gap   = fl.get("skill_gap_score", 0.5)
        fraud_pen   = 1 - fl.get("fraud_score", 0.5)
        rate_dev    = fl.get("rate_deviation", 0.3)
        emb_sim     = 1 - fl.get("embedding_similarity", 0.5)  # lower = closer

        g = (weights["skill"] * skill_gap +
             weights["fraud"] * fraud_pen +
             weights["rate"]  * rate_dev)

        h = weights["embedding"] * emb_sim

        f = g + h
        heapq.heappush(heap, (f, fl["id"], fl))

    ranked = []
    while heap:
        f_score, _, fl = heapq.heappop(heap)
        fl["rank_score"] = round(1 - f_score, 3)   # convert to 0-1 where higher=better
        ranked.append(fl)

    return ranked
```

### Bayesian Fraud Model — `backend/app/ai/bayesian.py`

```python
from typing import Dict

# Prior probability of fraud (baseline from platform data)
PRIOR_FRAUD = 0.15

# Likelihood tables P(evidence | fraud) and P(evidence | legit)
LIKELIHOODS = {
    "new_account":         {"fraud": 0.75, "legit": 0.20},
    "copied_portfolio":    {"fraud": 0.85, "legit": 0.05},
    "review_anomaly":      {"fraud": 0.70, "legit": 0.10},
    "no_verified_id":      {"fraud": 0.60, "legit": 0.30},
    "low_response_rate":   {"fraud": 0.50, "legit": 0.20},
}

def compute_fraud_score(evidence: Dict[str, bool]) -> Dict:
    """
    Naive Bayes:
      P(Fraud | E1,E2,...) ∝ P(Fraud) * ∏ P(Ei | Fraud)
    Returns probability score and confidence.
    """
    p_fraud = PRIOR_FRAUD
    p_legit = 1 - PRIOR_FRAUD

    active_signals = []

    for signal, present in evidence.items():
        if present and signal in LIKELIHOODS:
            p_fraud *= LIKELIHOODS[signal]["fraud"]
            p_legit *= LIKELIHOODS[signal]["legit"]
            active_signals.append(signal)

    # Normalize
    total = p_fraud + p_legit
    if total == 0:
        return {"score": 0.5, "confidence": "low", "signals": []}

    score = p_fraud / total
    confidence = "high" if score > 0.7 or score < 0.3 else "medium"

    return {
        "score": round(score, 3),
        "confidence": confidence,
        "signals": active_signals,
        "is_flagged": score > 0.65
    }
```

### CSP Solver — `backend/app/ai/csp_solver.py`

```python
from typing import List, Dict, Optional

def solve_team_csp(
    tasks: List[Dict],
    freelancers: List[Dict],
    budget: float,
    min_fraud_score: float = 0.80
) -> Optional[Dict]:
    """
    Backtracking CSP solver.
    Variables: tasks
    Domains: freelancers per task
    Constraints: skill match, budget, no double-booking, fraud threshold
    """
    assignment = {}
    stats = {"backtracks": 0, "nodes_explored": 0}

    def is_consistent(task, freelancer, assignment, current_cost):
        # Constraint 1: skill match
        if task["required_skill"] not in freelancer["skills"]:
            return False, "skill_mismatch"
        # Constraint 2: not already assigned
        if freelancer["id"] in assignment.values():
            return False, "double_booking"
        # Constraint 3: fraud threshold
        if freelancer.get("fraud_score", 0) < min_fraud_score:
            return False, "fraud_score_too_low"
        # Constraint 4: budget
        cost = task["days"] * freelancer["daily_rate"]
        if current_cost + cost > budget:
            return False, "over_budget"
        return True, "ok"

    def backtrack(task_idx, current_cost):
        if task_idx == len(tasks):
            return True   # All tasks assigned — solution found!

        task = tasks[task_idx]
        candidates = [f for f in freelancers if task["required_skill"] in f["skills"]]

        # MRV heuristic: sort by fewest valid options first (already filtered above)
        for fl in candidates:
            stats["nodes_explored"] += 1
            ok, reason = is_consistent(task, fl, assignment, current_cost)
            if ok:
                assignment[task["id"]] = fl["id"]
                cost = task["days"] * fl["daily_rate"]
                if backtrack(task_idx + 1, current_cost + cost):
                    return True
                # Backtrack
                del assignment[task["id"]]
                stats["backtracks"] += 1

        return False   # No valid assignment found for this task

    solved = backtrack(0, 0.0)

    if not solved:
        return {"solved": False, "message": "No valid team found within constraints"}

    # Build result
    total_cost = sum(
        tasks[i]["days"] * next(f for f in freelancers if f["id"] == assignment[tasks[i]["id"]])["daily_rate"]
        for i in range(len(tasks))
    )

    return {
        "solved": True,
        "assignment": assignment,
        "total_cost": round(total_cost, 2),
        "backtracks": stats["backtracks"],
        "nodes_explored": stats["nodes_explored"]
    }
```

---

## Step 5 — Frontend setup (Next.js)

```bash
cd clearhire
npx create-next-app@latest frontend \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir

cd frontend
npm install axios @tanstack/react-query
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the frontend:

```bash
cd clearhire/frontend
npm run dev
```

Visit http://localhost:3000

---

## Step 6 — Running everything together

Open 3 terminals:

**Terminal 1 — Databases:**

```bash
cd clearhire
docker compose up
```

**Terminal 2 — Backend:**

```bash
cd clearhire/backend
source venv/bin/activate   # or venv\Scripts\activate on Windows
uvicorn app.main:app --reload --port 8000
```

**Terminal 3 — Frontend:**

```bash
cd clearhire/frontend
npm run dev
```

### Verify all services

| Service          | URL                        | Expected              |
| ---------------- | -------------------------- | --------------------- |
| Next.js frontend | http://localhost:3000      | Landing page          |
| FastAPI backend  | http://localhost:8000/docs | Swagger UI            |
| Neo4j Browser    | http://localhost:7474      | Graph UI              |
| PostgreSQL       | localhost:5432             | (use DBeaver or psql) |

---

## Step 7 — Recommended VS Code extensions

Install these for the best development experience:

- **Python** (Microsoft)
- **Pylance**
- **ESLint**
- **Tailwind CSS IntelliSense**
- **Thunder Client** — test API endpoints without Postman
- **Docker**
- **Neo4j for VS Code** — run Cypher queries directly

---

## Step 8 — Initialize with seed data

Run this once after setup to populate the databases with test freelancers:

```bash
cd clearhire/backend
python -m app.db.postgres       # create PostgreSQL tables
python -m app.db.neo4j_client   # create Neo4j skill graph
```

Then use the Swagger UI at http://localhost:8000/docs to POST test freelancers and projects.

---

## Common errors and fixes

| Error                          | Fix                                                                |
| ------------------------------ | ------------------------------------------------------------------ |
| `docker: command not found`    | Install Docker Desktop and restart terminal                        |
| `connection refused 5432`      | Run `docker compose up -d` first                                   |
| `ModuleNotFoundError`          | Make sure venv is activated before running Python                  |
| `CORS error in browser`        | Check `allow_origins` in `main.py` matches your frontend URL       |
| `neo4j auth error`             | Password in `.env` must match `NEO4J_AUTH` in `docker-compose.yml` |
| `pgvector extension not found` | Use the `pgvector/pgvector:pg16` image, not plain `postgres`       |

---

## Development order recommendation

Build in this order — each step is testable independently:

1. **Docker + databases** → verify connections
2. **PostgreSQL schema** → run `init_db()`, check tables in DBeaver
3. **Neo4j graph** → run `init_graph()`, view in browser
4. **FastAPI skeleton** → `/docs` loads, health check returns 200
5. **Fraud module** → POST a profile, get back a score
6. **CSP solver** → POST tasks + budget, get back a team
7. **A\* matching** → POST job description, get ranked freelancers
8. **Embeddings** → integrate `sentence-transformers`, store in pgvector
9. **Explanation engine** → wire Anthropic API to generate reasoning text
10. **Next.js frontend** → build UI that calls each endpoint

---

_Generated from ClearHire SRS v1.0_
