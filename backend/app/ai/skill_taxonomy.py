"""Canonical skill taxonomy and alias-based canonicalization.

This module is the single source of truth for skill names. Freelancer and project
skills are stored under these canonical names; the ``skills`` table mirrors it
(with embeddings) for semantic grounding of free-text skills.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass(frozen=True)
class SkillDef:
    name: str
    category: str
    aliases: tuple[str, ...] = field(default_factory=tuple)


def _s(name: str, category: str, *aliases: str) -> SkillDef:
    return SkillDef(name=name, category=category, aliases=tuple(aliases))


TAXONOMY: tuple[SkillDef, ...] = (
    # Languages
    _s("Python", "Languages", "py", "python3"),
    _s("JavaScript", "Languages", "js", "ecmascript", "es6", "vanilla js"),
    _s("TypeScript", "Languages", "ts"),
    _s("Java", "Languages", "java ee", "j2ee"),
    _s("Kotlin", "Languages"),
    _s("Swift", "Languages"),
    _s("Go", "Languages", "golang"),
    _s("Rust", "Languages"),
    _s("C", "Languages", "c language", "ansi c"),
    _s("C++", "Languages", "cpp", "cplusplus"),
    _s("C#", "Languages", "csharp", "c sharp"),
    _s("PHP", "Languages"),
    _s("Ruby", "Languages"),
    _s("Scala", "Languages"),
    _s("R", "Languages", "r language", "rstats"),
    _s("Dart", "Languages"),
    _s("Elixir", "Languages"),
    _s("Solidity", "Languages"),
    _s("SQL", "Languages", "structured query language"),
    _s("Bash", "Languages", "shell scripting", "shell", "bash scripting"),
    # Frontend
    _s("React", "Frontend", "reactjs", "react.js", "react js"),
    _s("Next.js", "Frontend", "nextjs", "next"),
    _s("Vue.js", "Frontend", "vue", "vuejs", "vue 3"),
    _s("Nuxt", "Frontend", "nuxtjs", "nuxt.js"),
    _s("Angular", "Frontend", "angularjs", "angular 2+"),
    _s("Svelte", "Frontend", "sveltekit"),
    _s("Redux", "Frontend", "redux toolkit"),
    _s("HTML", "Frontend", "html5"),
    _s("CSS", "Frontend", "css3"),
    _s("Tailwind CSS", "Frontend", "tailwind", "tailwindcss"),
    _s("Sass", "Frontend", "scss"),
    _s("Webpack", "Frontend", "vite", "bundlers"),
    _s("Three.js", "Frontend", "threejs", "webgl"),
    _s("D3.js", "Frontend", "d3", "d3js"),
    # Backend
    _s("Node.js", "Backend", "node", "nodejs", "node js"),
    _s("Express", "Backend", "express.js", "expressjs"),
    _s("NestJS", "Backend", "nest.js", "nest"),
    _s("FastAPI", "Backend", "fast api"),
    _s("Django", "Backend", "django rest framework", "drf"),
    _s("Flask", "Backend"),
    _s("Spring Boot", "Backend", "spring", "springboot"),
    _s("Ruby on Rails", "Backend", "rails", "ror"),
    _s("Laravel", "Backend"),
    _s(".NET", "Backend", "dotnet", "asp.net", "asp.net core", ".net core"),
    _s("GraphQL", "Backend", "apollo graphql"),
    _s("REST APIs", "Backend", "rest", "rest api", "restful", "restful apis", "api development"),
    _s("gRPC", "Backend", "grpc", "protobuf"),
    _s("Microservices", "Backend", "microservice architecture"),
    _s("WebSockets", "Backend", "websocket", "socket.io", "realtime"),
    _s("Celery", "Backend"),
    # Mobile
    _s("React Native", "Mobile", "react-native", "rn"),
    _s("Flutter", "Mobile"),
    _s("iOS Development", "Mobile", "ios", "iOS", "swiftui", "uikit"),
    _s("Android Development", "Mobile", "android", "jetpack compose"),
    # Data stores
    _s("PostgreSQL", "Databases", "postgres", "postgresql", "psql", "pg"),
    _s("MySQL", "Databases", "mariadb"),
    _s("MongoDB", "Databases", "mongo"),
    _s("Redis", "Databases"),
    _s("Elasticsearch", "Databases", "elastic", "opensearch", "elk"),
    _s("SQLite", "Databases"),
    _s("DynamoDB", "Databases", "dynamo"),
    _s("Cassandra", "Databases"),
    _s("Neo4j", "Databases", "graph database", "cypher"),
    _s("Firebase", "Databases", "firestore"),
    _s("Supabase", "Databases"),
    _s("pgvector", "Databases", "vector database", "vector db", "pinecone", "weaviate", "qdrant"),
    _s("Snowflake", "Databases"),
    _s("BigQuery", "Databases", "big query"),
    # Cloud & DevOps
    _s("AWS", "Cloud & DevOps", "amazon web services", "ec2", "s3", "lambda", "aws lambda"),
    _s("Google Cloud", "Cloud & DevOps", "gcp", "google cloud platform"),
    _s("Azure", "Cloud & DevOps", "microsoft azure"),
    _s("Docker", "Cloud & DevOps", "containers", "containerization", "dockerfile"),
    _s("Kubernetes", "Cloud & DevOps", "k8s", "eks", "gke", "aks", "helm"),
    _s("Terraform", "Cloud & DevOps", "iac", "infrastructure as code"),
    _s("CI/CD", "Cloud & DevOps", "cicd", "ci cd", "continuous integration", "continuous deployment"),
    _s("GitHub Actions", "Cloud & DevOps", "gh actions"),
    _s("Jenkins", "Cloud & DevOps"),
    _s("Linux", "Cloud & DevOps", "linux administration", "ubuntu", "sysadmin"),
    _s("Nginx", "Cloud & DevOps"),
    _s("DevOps", "Cloud & DevOps", "devops engineering", "sre", "site reliability engineering"),
    _s("Serverless", "Cloud & DevOps", "serverless framework"),
    _s("Vercel", "Cloud & DevOps", "netlify"),
    _s("Observability", "Cloud & DevOps", "monitoring", "prometheus", "grafana", "datadog"),
    # Data & AI
    _s("Machine Learning", "Data & AI", "ml", "machine-learning"),
    _s("Deep Learning", "Data & AI", "dl", "neural networks"),
    _s("PyTorch", "Data & AI", "torch"),
    _s("TensorFlow", "Data & AI", "tf", "keras"),
    _s("scikit-learn", "Data & AI", "sklearn", "scikit learn"),
    _s("Natural Language Processing", "Data & AI", "nlp", "text mining"),
    _s("Computer Vision", "Data & AI", "cv", "image recognition", "opencv"),
    _s("LLM Integration", "Data & AI", "llm", "llms", "large language models", "genai",
       "generative ai", "openai api", "claude api", "anthropic api", "gpt"),
    _s("Prompt Engineering", "Data & AI", "prompting"),
    _s("RAG", "Data & AI", "retrieval augmented generation", "retrieval-augmented generation", "graphrag"),
    _s("LangChain", "Data & AI", "langgraph", "llamaindex"),
    _s("MLOps", "Data & AI", "ml ops", "mlflow", "kubeflow"),
    _s("Data Science", "Data & AI", "data scientist"),
    _s("Data Analysis", "Data & AI", "data analytics", "analytics"),
    _s("Data Engineering", "Data & AI", "etl", "data pipelines", "elt", "data engineer"),
    _s("Pandas", "Data & AI", "numpy"),
    _s("Apache Spark", "Data & AI", "spark", "pyspark"),
    _s("Airflow", "Data & AI", "apache airflow"),
    _s("Kafka", "Data & AI", "apache kafka", "event streaming"),
    _s("dbt", "Data & AI", "data build tool"),
    _s("Power BI", "Data & AI", "powerbi"),
    _s("Tableau", "Data & AI"),
    _s("Statistics", "Data & AI", "statistical analysis"),
    _s("Recommendation Systems", "Data & AI", "recommender systems", "recsys",
       "recommendation engine"),
    # Design & Product
    _s("UI/UX Design", "Design", "ui/ux", "ux", "ui", "ui design", "ux design", "user experience",
       "product design"),
    _s("Figma", "Design"),
    _s("Adobe XD", "Design", "xd"),
    _s("Graphic Design", "Design", "photoshop", "illustrator"),
    _s("Prototyping", "Design", "wireframing", "wireframes", "prototypes"),
    _s("Product Management", "Product", "product manager", "pm", "product owner"),
    _s("Technical Writing", "Product", "documentation", "tech writing", "technical documentation",
       "technical writer"),
    _s("Project Management", "Product", "agile", "scrum", "jira"),
    # Quality & Security
    _s("Testing", "Quality", "qa", "quality assurance", "unit testing", "test automation"),
    _s("Cypress", "Quality", "playwright", "e2e testing", "end-to-end testing"),
    _s("Selenium", "Quality"),
    _s("Pytest", "Quality"),
    _s("Jest", "Quality", "vitest"),
    _s("Cybersecurity", "Security", "security", "infosec", "application security", "appsec",
       "security engineer", "security engineering"),
    _s("Penetration Testing", "Security", "pentesting", "pen testing", "ethical hacking"),
    _s("OAuth", "Security", "oauth2", "openid connect", "oidc", "sso", "authentication"),
    _s("Cryptography", "Security", "encryption"),
    # Web3, commerce, platforms
    _s("Blockchain", "Web3", "web3", "smart contracts", "ethereum"),
    _s("Shopify", "E-commerce", "shopify development"),
    _s("WordPress", "E-commerce", "wp", "woocommerce"),
    _s("Stripe", "E-commerce", "payments integration", "payment gateway"),
    _s("Salesforce", "Platforms", "sfdc", "apex"),
    _s("SAP", "Platforms"),
    _s("Unity", "Game Development", "unity3d"),
    _s("Unreal Engine", "Game Development", "unreal", "ue5"),
    _s("Embedded Systems", "Hardware", "embedded", "firmware", "arduino", "raspberry pi"),
    _s("IoT", "Hardware", "internet of things"),
    # Domain & compliance knowledge
    _s("HIPAA Compliance", "Compliance", "hipaa"),
    _s("GDPR Compliance", "Compliance", "gdpr"),
    _s("SOC 2", "Compliance", "soc2", "soc 2 compliance"),
    _s("PCI DSS", "Compliance", "pci", "pci compliance"),
    _s("FinTech", "Domain", "financial technology", "banking software"),
    _s("HealthTech", "Domain", "healthcare software", "health tech", "medical software"),
    _s("SEO", "Marketing", "search engine optimization"),
    _s("Digital Marketing", "Marketing", "growth marketing", "performance marketing"),
    _s("Copywriting", "Marketing", "content writing", "copywriter"),
)


def skill_key(text: str) -> str:
    """Normalization used for exact/alias lookup: case, spacing and punctuation-insensitive."""
    lowered = text.strip().lower()
    # Keep characters that distinguish skills (C++ vs C, C# vs C, .NET).
    lowered = lowered.replace("c++", "cplusplus").replace("c#", "csharp").replace(".net", "dotnet")
    return re.sub(r"[\s._\-/]+", "", lowered)


def _build_index() -> dict[str, SkillDef]:
    index: dict[str, SkillDef] = {}
    for skill in TAXONOMY:
        for term in (skill.name, *skill.aliases):
            key = skill_key(term)
            existing = index.get(key)
            if existing is not None and existing.name != skill.name:
                raise ValueError(f"Ambiguous skill alias {term!r}: {existing.name} / {skill.name}")
            index[key] = skill
    return index


_INDEX = _build_index()
CANONICAL_NAMES: tuple[str, ...] = tuple(sorted(s.name for s in TAXONOMY))


def lookup(text: str) -> tuple[SkillDef, str] | None:
    """Return (skill, "exact" | "alias") for a name or alias, else None."""
    if not text or not text.strip():
        return None
    key = skill_key(text)
    skill = _INDEX.get(key)
    if skill is None and len(key) > 4:
        # Singular/plural tolerance: "data scientists" / "smart contract".
        skill = _INDEX.get(key[:-1]) if key.endswith("s") else _INDEX.get(key + "s")
    if skill is None:
        return None
    match = "exact" if skill_key(skill.name) == skill_key(text) else "alias"
    return skill, match


def canonicalize(text: str) -> str:
    """Canonical name for a known skill; unknown skills are returned trimmed, unchanged."""
    found = lookup(text)
    return found[0].name if found else text.strip()


def canonicalize_all(skills: list[str] | None) -> list[str]:
    """Canonicalize and de-duplicate, preserving first-seen order."""
    seen: set[str] = set()
    result: list[str] = []
    for raw in skills or []:
        name = canonicalize(raw)
        key = name.lower()
        if name and key not in seen:
            seen.add(key)
            result.append(name)
    return result


def alias_terms() -> list[tuple[str, SkillDef]]:
    """Every (term, skill) pair, longest first — used for phrase spotting in free text."""
    pairs = [(term, skill) for skill in TAXONOMY for term in (skill.name, *skill.aliases)]
    return sorted(pairs, key=lambda pair: -len(pair[0]))


# Curated skill adjacency: (skill, related skill, weight). Weight is how much of a
# required skill the related one stands in for (1.0 = interchangeable). Pairs are
# symmetric. Synced into ``skill_relationships`` (together with the category-derived
# edges below) and from there into Neo4j RELATED_TO; ranking uses it for partial
# credit and app.graph expands it over multiple hops.
RELATED_SKILLS: tuple[tuple[str, str, float], ...] = (
    # Languages and their ecosystems
    ("JavaScript", "TypeScript", 0.8),
    ("Python", "FastAPI", 0.5),
    ("Python", "Django", 0.5),
    ("Python", "Flask", 0.5),
    ("Python", "Pandas", 0.4),
    ("JavaScript", "React", 0.4),
    ("JavaScript", "Node.js", 0.5),
    ("TypeScript", "Angular", 0.4),
    ("TypeScript", "NestJS", 0.5),
    ("Java", "Kotlin", 0.6),
    ("Java", "Spring Boot", 0.5),
    ("Kotlin", "Android Development", 0.6),
    ("Swift", "iOS Development", 0.7),
    ("Dart", "Flutter", 0.7),
    ("C", "C++", 0.6),
    ("C", "Embedded Systems", 0.5),
    ("C#", ".NET", 0.7),
    ("C#", "Unity", 0.5),
    ("C++", "Unreal Engine", 0.5),
    ("PHP", "Laravel", 0.6),
    ("PHP", "WordPress", 0.4),
    ("Ruby", "Ruby on Rails", 0.7),
    ("Scala", "Apache Spark", 0.4),
    ("Solidity", "Blockchain", 0.7),
    ("SQL", "PostgreSQL", 0.6),
    ("SQL", "MySQL", 0.6),
    # Web frameworks
    ("React", "Next.js", 0.7),
    ("React", "React Native", 0.6),
    ("React", "Redux", 0.4),
    ("React", "Vue.js", 0.5),
    ("React", "Angular", 0.4),
    ("React", "Svelte", 0.5),
    ("Vue.js", "Nuxt", 0.7),
    ("Vue.js", "Angular", 0.4),
    ("CSS", "Tailwind CSS", 0.6),
    ("CSS", "Sass", 0.6),
    ("HTML", "CSS", 0.5),
    ("Node.js", "Express", 0.7),
    ("Node.js", "NestJS", 0.6),
    ("FastAPI", "Flask", 0.6),
    ("FastAPI", "Django", 0.5),
    ("Django", "Flask", 0.6),
    ("REST APIs", "GraphQL", 0.5),
    ("REST APIs", "FastAPI", 0.4),
    ("REST APIs", "gRPC", 0.4),
    ("Microservices", "Kubernetes", 0.4),
    ("Microservices", "gRPC", 0.4),
    ("Celery", "Redis", 0.3),
    ("React Native", "Flutter", 0.5),
    ("iOS Development", "React Native", 0.3),
    ("Android Development", "React Native", 0.3),
    # Data stores
    ("PostgreSQL", "MySQL", 0.7),
    ("PostgreSQL", "SQLite", 0.5),
    ("PostgreSQL", "Supabase", 0.6),
    ("PostgreSQL", "pgvector", 0.5),
    ("MongoDB", "DynamoDB", 0.5),
    ("MongoDB", "Firebase", 0.4),
    ("Elasticsearch", "pgvector", 0.3),
    ("Snowflake", "BigQuery", 0.7),
    ("Cassandra", "DynamoDB", 0.5),
    # Cloud & DevOps
    ("AWS", "Google Cloud", 0.6),
    ("AWS", "Azure", 0.6),
    ("Google Cloud", "Azure", 0.6),
    ("AWS", "Serverless", 0.5),
    ("Docker", "Kubernetes", 0.6),
    ("DevOps", "Docker", 0.6),
    ("DevOps", "Kubernetes", 0.6),
    ("DevOps", "CI/CD", 0.7),
    ("DevOps", "Terraform", 0.5),
    ("DevOps", "Linux", 0.5),
    ("DevOps", "Observability", 0.5),
    ("CI/CD", "GitHub Actions", 0.7),
    ("CI/CD", "Jenkins", 0.7),
    ("Terraform", "AWS", 0.4),
    ("Linux", "Bash", 0.6),
    ("Linux", "Nginx", 0.4),
    ("Vercel", "Next.js", 0.3),
    # Data & AI
    ("Machine Learning", "Deep Learning", 0.7),
    ("Machine Learning", "scikit-learn", 0.7),
    ("Machine Learning", "Data Science", 0.7),
    ("Machine Learning", "Python", 0.3),
    ("Machine Learning", "MLOps", 0.5),
    ("Machine Learning", "Recommendation Systems", 0.5),
    ("Deep Learning", "PyTorch", 0.7),
    ("Deep Learning", "TensorFlow", 0.7),
    ("PyTorch", "TensorFlow", 0.7),
    ("Deep Learning", "Computer Vision", 0.5),
    ("Deep Learning", "Natural Language Processing", 0.5),
    ("Natural Language Processing", "LLM Integration", 0.6),
    ("LLM Integration", "Prompt Engineering", 0.6),
    ("LLM Integration", "RAG", 0.7),
    ("LLM Integration", "LangChain", 0.7),
    ("RAG", "LangChain", 0.6),
    ("RAG", "pgvector", 0.5),
    ("Data Science", "Data Analysis", 0.7),
    ("Data Science", "Statistics", 0.6),
    ("Data Science", "Pandas", 0.6),
    ("Data Analysis", "SQL", 0.5),
    ("Data Analysis", "Power BI", 0.5),
    ("Data Analysis", "Tableau", 0.5),
    ("Power BI", "Tableau", 0.7),
    ("Data Engineering", "Apache Spark", 0.6),
    ("Data Engineering", "Airflow", 0.6),
    ("Data Engineering", "Kafka", 0.5),
    ("Data Engineering", "dbt", 0.6),
    ("Data Engineering", "Snowflake", 0.5),
    ("Data Engineering", "SQL", 0.5),
    ("dbt", "SQL", 0.5),
    # Design & product
    ("UI/UX Design", "Figma", 0.6),
    ("UI/UX Design", "Prototyping", 0.6),
    ("UI/UX Design", "Adobe XD", 0.5),
    ("Figma", "Adobe XD", 0.7),
    ("Graphic Design", "UI/UX Design", 0.4),
    ("Product Management", "Project Management", 0.5),
    # Quality & security
    ("Testing", "Cypress", 0.6),
    ("Testing", "Selenium", 0.6),
    ("Testing", "Pytest", 0.6),
    ("Testing", "Jest", 0.6),
    ("Cypress", "Selenium", 0.6),
    ("Cybersecurity", "Penetration Testing", 0.6),
    ("Cybersecurity", "OAuth", 0.4),
    ("Cybersecurity", "Cryptography", 0.5),
    ("Cybersecurity", "SOC 2", 0.4),
    # Commerce, platforms, domains
    ("Shopify", "WordPress", 0.4),
    ("Stripe", "FinTech", 0.4),
    ("PCI DSS", "FinTech", 0.4),
    ("PCI DSS", "Stripe", 0.4),
    ("HIPAA Compliance", "HealthTech", 0.6),
    ("HIPAA Compliance", "SOC 2", 0.3),
    ("GDPR Compliance", "SOC 2", 0.4),
    ("Embedded Systems", "IoT", 0.7),
    ("Unity", "Unreal Engine", 0.5),
    ("SEO", "Digital Marketing", 0.5),
    ("Copywriting", "Digital Marketing", 0.4),
    ("Copywriting", "Technical Writing", 0.4),
    # --- Phase 4 ontology extension -------------------------------------------
    # Languages and runtimes
    ("TypeScript", "Node.js", 0.4),
    ("TypeScript", "Next.js", 0.4),
    ("JavaScript", "Vue.js", 0.4),
    ("JavaScript", "Angular", 0.3),
    ("JavaScript", "Svelte", 0.3),
    ("JavaScript", "HTML", 0.4),
    ("Python", "scikit-learn", 0.3),
    ("Python", "Celery", 0.4),
    ("Python", "Pytest", 0.4),
    ("Python", "Bash", 0.3),
    ("Python", "Data Engineering", 0.4),
    ("Go", "Microservices", 0.4),
    ("Go", "gRPC", 0.4),
    ("Go", "Rust", 0.4),
    ("Go", "Kubernetes", 0.3),
    ("Rust", "C++", 0.5),
    ("C++", "C#", 0.4),
    ("Java", "C#", 0.5),
    ("Java", "Scala", 0.5),
    ("Kotlin", "Spring Boot", 0.4),
    ("Kotlin", "Swift", 0.4),
    ("Elixir", "Ruby", 0.4),
    ("Elixir", "WebSockets", 0.3),
    ("R", "Statistics", 0.6),
    ("R", "Data Analysis", 0.5),
    ("R", "Data Science", 0.5),
    ("SQL", "SQLite", 0.5),
    ("SQL", "Snowflake", 0.5),
    ("SQL", "BigQuery", 0.5),
    ("PHP", "MySQL", 0.4),
    ("Solidity", "Cryptography", 0.3),
    # Frontend
    ("Next.js", "Nuxt", 0.5),
    ("Next.js", "Node.js", 0.4),
    ("Svelte", "Vue.js", 0.5),
    ("Redux", "React Native", 0.3),
    ("Tailwind CSS", "Sass", 0.5),
    ("HTML", "Tailwind CSS", 0.3),
    ("Webpack", "JavaScript", 0.4),
    ("Webpack", "React", 0.3),
    ("Three.js", "JavaScript", 0.4),
    ("Three.js", "Unity", 0.3),
    ("D3.js", "JavaScript", 0.4),
    ("D3.js", "Data Analysis", 0.3),
    # Backend
    ("Express", "NestJS", 0.6),
    ("Express", "REST APIs", 0.4),
    ("Spring Boot", "Microservices", 0.4),
    ("Spring Boot", "REST APIs", 0.4),
    ("Ruby on Rails", "Laravel", 0.4),
    ("Ruby on Rails", "Django", 0.4),
    (".NET", "Azure", 0.4),
    (".NET", "Spring Boot", 0.3),
    ("GraphQL", "Node.js", 0.3),
    ("WebSockets", "Node.js", 0.4),
    ("Celery", "Django", 0.4),
    ("Microservices", "Docker", 0.5),
    ("Microservices", "Kafka", 0.4),
    ("Django", "PostgreSQL", 0.3),
    ("OAuth", "REST APIs", 0.3),
    # Mobile
    ("iOS Development", "Android Development", 0.4),
    ("Flutter", "iOS Development", 0.3),
    ("Flutter", "Android Development", 0.3),
    ("Flutter", "Firebase", 0.3),
    # Data stores
    ("MySQL", "SQLite", 0.5),
    ("Redis", "PostgreSQL", 0.3),
    ("Elasticsearch", "Observability", 0.3),
    ("Neo4j", "MongoDB", 0.3),
    ("Firebase", "Supabase", 0.6),
    ("Cassandra", "MongoDB", 0.4),
    ("DynamoDB", "AWS", 0.5),
    ("BigQuery", "Google Cloud", 0.5),
    ("Snowflake", "dbt", 0.5),
    ("BigQuery", "dbt", 0.5),
    # Cloud & DevOps
    ("Terraform", "Google Cloud", 0.4),
    ("Terraform", "Azure", 0.4),
    ("Kubernetes", "Terraform", 0.4),
    ("Kubernetes", "Observability", 0.4),
    ("GitHub Actions", "Jenkins", 0.6),
    ("Docker", "Linux", 0.4),
    ("Docker", "CI/CD", 0.4),
    ("Serverless", "Google Cloud", 0.4),
    ("Serverless", "Vercel", 0.4),
    ("Nginx", "Docker", 0.3),
    ("Bash", "DevOps", 0.4),
    # Data & AI
    ("Machine Learning", "Statistics", 0.5),
    ("Machine Learning", "PyTorch", 0.5),
    ("Machine Learning", "TensorFlow", 0.5),
    ("Machine Learning", "Natural Language Processing", 0.5),
    ("Machine Learning", "Computer Vision", 0.4),
    ("Machine Learning", "LLM Integration", 0.4),
    ("scikit-learn", "Pandas", 0.5),
    ("Data Analysis", "Pandas", 0.6),
    ("Data Analysis", "Statistics", 0.6),
    ("Data Science", "Data Engineering", 0.4),
    ("Data Science", "Recommendation Systems", 0.5),
    ("Data Engineering", "BigQuery", 0.5),
    ("Apache Spark", "Kafka", 0.4),
    ("Apache Spark", "Pandas", 0.4),
    ("Airflow", "dbt", 0.5),
    ("MLOps", "Docker", 0.4),
    ("MLOps", "Kubernetes", 0.4),
    ("MLOps", "Airflow", 0.4),
    ("Natural Language Processing", "RAG", 0.4),
    ("Computer Vision", "PyTorch", 0.5),
    ("Prompt Engineering", "RAG", 0.5),
    ("Prompt Engineering", "LangChain", 0.5),
    ("Recommendation Systems", "pgvector", 0.3),
    # Design & product
    ("Figma", "Prototyping", 0.6),
    ("Figma", "Graphic Design", 0.4),
    ("Adobe XD", "Prototyping", 0.5),
    ("Product Management", "UI/UX Design", 0.3),
    ("Technical Writing", "Product Management", 0.3),
    # Quality & security
    ("Jest", "JavaScript", 0.4),
    ("Jest", "Cypress", 0.4),
    ("Testing", "CI/CD", 0.3),
    ("Penetration Testing", "Linux", 0.3),
    ("Cybersecurity", "PCI DSS", 0.4),
    ("Cybersecurity", "Linux", 0.3),
    ("Blockchain", "Cryptography", 0.4),
    # Compliance, commerce, platforms, hardware
    ("HIPAA Compliance", "GDPR Compliance", 0.4),
    ("PCI DSS", "SOC 2", 0.5),
    ("FinTech", "Blockchain", 0.3),
    ("Stripe", "Shopify", 0.4),
    ("WordPress", "SEO", 0.3),
    ("Shopify", "Digital Marketing", 0.3),
    ("SEO", "Copywriting", 0.4),
    ("Salesforce", "SAP", 0.4),
    ("Embedded Systems", "C++", 0.5),
    ("Embedded Systems", "Rust", 0.3),
    ("IoT", "Linux", 0.3),
)


def related_skill_map(
    pairs: list[tuple[str, str, float]] | tuple[tuple[str, str, float], ...] = RELATED_SKILLS,
) -> dict[str, dict[str, float]]:
    """Symmetric {skill_lower: {related_lower: weight}} adjacency (max weight wins)."""
    adjacency: dict[str, dict[str, float]] = {}
    for a, b, weight in pairs:
        for x, y in ((a, b), (b, a)):
            neighbours = adjacency.setdefault(x.lower(), {})
            neighbours[y.lower()] = max(weight, neighbours.get(y.lower(), 0.0))
    return adjacency


# Category-derived edges (Phase 4 ontology). Within one taxonomy category, each
# skill is linked to its ``CATEGORY_EDGE_TOP_K`` most similar peers (cosine of the
# stored skill embeddings) when the similarity clears ``CATEGORY_EDGE_MIN_SIMILARITY``.
# Weights are scaled linearly into ``CATEGORY_EDGE_WEIGHT_BAND`` so they always sit
# at or below curated weights, and curated pairs are never overridden. Thresholds
# were picked from the MiniLM similarity distribution (in-category median ~0.36,
# curated in-category pairs median ~0.43): top-2 above 0.5 adds about 40 edges.
CATEGORY_EDGE_TOP_K = 2
CATEGORY_EDGE_MIN_SIMILARITY = 0.5
CATEGORY_EDGE_MAX_SIMILARITY = 0.8
CATEGORY_EDGE_WEIGHT_BAND = (0.3, 0.5)


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm = (sum(x * x for x in a) ** 0.5) * (sum(y * y for y in b) ** 0.5)
    return dot / norm if norm else 0.0


def category_edge_weight(similarity: float) -> float:
    """Map a similarity in [min, max] linearly onto CATEGORY_EDGE_WEIGHT_BAND."""
    low, high = CATEGORY_EDGE_WEIGHT_BAND
    span = CATEGORY_EDGE_MAX_SIMILARITY - CATEGORY_EDGE_MIN_SIMILARITY
    t = (similarity - CATEGORY_EDGE_MIN_SIMILARITY) / span
    return round(low + (high - low) * max(0.0, min(1.0, t)), 3)


def category_edges(
    skills: dict[str, tuple[str, list[float]]],
    *,
    top_k: int = CATEGORY_EDGE_TOP_K,
    min_similarity: float = CATEGORY_EDGE_MIN_SIMILARITY,
    exclude: tuple[tuple[str, str, float], ...] | list[tuple[str, str, float]] = RELATED_SKILLS,
) -> list[tuple[str, str, float]]:
    """Similarity-weighted edges between skills of the same category.

    ``skills`` maps canonical name -> (category, embedding). Pairs already in
    ``exclude`` (the curated list, either orientation) are skipped so curated
    weights always win. Deterministic: ties break on name, and each pair is
    returned once as (lower name, higher name, weight), sorted.
    """
    curated = {frozenset((a.lower(), b.lower())) for a, b, _ in exclude}
    by_category: dict[str, list[str]] = {}
    for name, (category, _) in skills.items():
        by_category.setdefault(category, []).append(name)

    chosen: dict[tuple[str, str], float] = {}
    for names in by_category.values():
        names.sort()
        for name in names:
            vector = skills[name][1]
            ranked = sorted(
                ((_cosine(vector, skills[other][1]), other) for other in names if other != name),
                key=lambda item: (-item[0], item[1]),
            )
            for similarity, other in ranked[:top_k]:
                if similarity < min_similarity:
                    break
                if frozenset((name.lower(), other.lower())) in curated:
                    continue
                pair = (min(name, other), max(name, other))
                chosen[pair] = max(similarity, chosen.get(pair, -1.0))
    return [(a, b, category_edge_weight(sim)) for (a, b), sim in sorted(chosen.items())]


def _check_related() -> None:
    for a, b, weight in RELATED_SKILLS:
        for name in (a, b):
            if name not in CANONICAL_NAMES:
                raise ValueError(f"RELATED_SKILLS uses unknown skill {name!r}")
        if not 0.0 < weight <= 1.0:
            raise ValueError(f"RELATED_SKILLS weight out of range: {a}/{b}")


_check_related()
