// ─── ClearHire Mock Data ──────────────────────────────────────────────────────

export const FREELANCERS = [
  {
    id: 1,
    name: "Aria Voss",
    avatar: "AV",
    location: "Berlin, DE",
    bio: "Senior ML engineer with 8 years deploying production-grade models at scale. Specialist in transformer architectures, real-time inference pipelines, and MLOps. Contributed to open-source PyTorch extensions with 2k+ GitHub stars.",
    skills: ["Python", "ML", "Data Science", "Docker", "PostgreSQL"],
    rating: 4.9,
    hourly_rate: 95,
    experience_years: 8,
    availability: true,
    account_age_days: 1240,
    review_count: 47,
    fraud_score: 0.04,
    match_score: 97,
    reviews: [
      {
        author: "TechCorp Inc.",
        text: "Aria delivered an exceptional ML pipeline. Exceeded all KPIs.",
        rating: 5,
      },
      {
        author: "DataFlow AI",
        text: "Deep expertise and great communication throughout the project.",
        rating: 5,
      },
      {
        author: "NovaSystems",
        text: "Highly recommended for any data science work.",
        rating: 4,
      },
    ],
  },
  {
    id: 2,
    name: "Marcus Lin",
    avatar: "ML",
    location: "San Francisco, US",
    bio: "Full-stack React specialist with a focus on design systems and component architecture. Built the front-end for two Series B startups. Expert in Tailwind, Framer Motion, and accessibility.",
    skills: ["React", "JavaScript", "UI/UX", "Figma", "Node.js"],
    rating: 4.8,
    hourly_rate: 85,
    experience_years: 6,
    availability: true,
    account_age_days: 980,
    review_count: 63,
    fraud_score: 0.06,
    match_score: 94,
    reviews: [
      {
        author: "DesignLab",
        text: "Marcus is a rockstar UI developer. Ship quality is unmatched.",
        rating: 5,
      },
      {
        author: "Startly",
        text: "Great attention to detail and incredibly fast iteration cycles.",
        rating: 5,
      },
    ],
  },
  {
    id: 3,
    name: "Nour El-Rashid",
    avatar: "NR",
    location: "Dubai, UAE",
    bio: "DevOps architect specializing in Kubernetes, GitOps, and cloud-native infrastructure on AWS and GCP. Reduced deployment times by 80% for multiple enterprise clients. Certified AWS Solutions Architect.",
    skills: ["DevOps", "Docker", "PostgreSQL", "Python", "Node.js"],
    rating: 4.7,
    hourly_rate: 110,
    experience_years: 9,
    availability: true,
    account_age_days: 1560,
    review_count: 38,
    fraud_score: 0.03,
    match_score: 91,
    reviews: [
      {
        author: "CloudBase",
        text: "Nour transformed our infra. Zero downtime migrations, stellar work.",
        rating: 5,
      },
      {
        author: "Enterprise XYZ",
        text: "Thorough, reliable, and incredibly knowledgeable.",
        rating: 4,
      },
    ],
  },
  {
    id: 4,
    name: "Sofia Brennan",
    avatar: "SB",
    location: "Dublin, IE",
    bio: "Product designer and Figma expert who bridges design and engineering. Created design systems for fintech and healthtech clients. Passionate about accessibility and dark mode interfaces.",
    skills: ["UI/UX", "Figma", "React", "JavaScript"],
    rating: 4.9,
    hourly_rate: 75,
    experience_years: 5,
    availability: true,
    account_age_days: 720,
    review_count: 29,
    fraud_score: 0.05,
    match_score: 88,
    reviews: [
      {
        author: "HealthSync",
        text: "Sofia's design work transformed our product. Exceptional quality.",
        rating: 5,
      },
    ],
  },
  {
    id: 5,
    name: "Tariq Osei",
    avatar: "TO",
    location: "Lagos, NG",
    bio: "FastAPI and Node.js backend developer with deep expertise in event-driven architectures and real-time APIs. Designed and shipped 15+ production APIs serving 1M+ daily requests.",
    skills: ["FastAPI", "Node.js", "Python", "PostgreSQL", "Docker"],
    rating: 4.6,
    hourly_rate: 65,
    experience_years: 7,
    availability: true,
    account_age_days: 1100,
    review_count: 52,
    fraud_score: 0.07,
    match_score: 85,
    reviews: [
      {
        author: "PayStream",
        text: "Tariq built our entire API layer. Solid, fast, and well-documented.",
        rating: 5,
      },
      {
        author: "Logistics.io",
        text: "Extremely reliable. Will definitely hire again.",
        rating: 4,
      },
    ],
  },
  {
    id: 6,
    name: "Yuki Tanaka",
    avatar: "YT",
    location: "Tokyo, JP",
    bio: "Data scientist specializing in NLP and recommendation systems. Published researcher with 3 papers on transformer-based retrieval models. Expert in Python, Hugging Face, and vector databases.",
    skills: ["Data Science", "ML", "Python", "PostgreSQL"],
    rating: 4.8,
    hourly_rate: 90,
    experience_years: 6,
    availability: false,
    account_age_days: 860,
    review_count: 22,
    fraud_score: 0.04,
    match_score: 82,
    reviews: [
      {
        author: "Recsys Labs",
        text: "Brilliant researcher and practical engineer. Top tier.",
        rating: 5,
      },
    ],
  },
  {
    id: 7,
    name: "Elena Vasquez",
    avatar: "EV",
    location: "Barcelona, ES",
    bio: "JavaScript polyglot comfortable across the stack — React frontends, Node.js APIs, and serverless functions. Strong emphasis on performance optimization and Core Web Vitals.",
    skills: ["JavaScript", "React", "Node.js", "UI/UX"],
    rating: 4.5,
    hourly_rate: 70,
    experience_years: 5,
    availability: true,
    account_age_days: 640,
    review_count: 41,
    fraud_score: 0.09,
    match_score: 79,
    reviews: [
      {
        author: "SaaSly",
        text: "Elena optimized our app to a perfect Lighthouse score. Incredible work.",
        rating: 5,
      },
    ],
  },
  {
    id: 8,
    name: "James Okafor",
    avatar: "JO",
    location: "London, UK",
    bio: "Freelance DevOps and cloud engineer. Passionate about infrastructure as code using Terraform and Pulumi. Led platform engineering at a 300-person fintech startup for 4 years.",
    skills: ["DevOps", "Docker", "Python", "PostgreSQL"],
    rating: 4.7,
    hourly_rate: 100,
    experience_years: 8,
    availability: true,
    account_age_days: 1320,
    review_count: 34,
    fraud_score: 0.05,
    match_score: 76,
    reviews: [
      {
        author: "FintechBase",
        text: "James is a world-class platform engineer. Highly recommended.",
        rating: 5,
      },
    ],
  },
  {
    id: 9,
    name: "Priya Mehra",
    avatar: "PM",
    location: "Bangalore, IN",
    bio: "Full-stack engineer with specialization in React + FastAPI microservices. Ex-Amazon engineer. Fast executor with strong systems thinking. Available for long-term contracts.",
    skills: ["React", "FastAPI", "Python", "Node.js", "PostgreSQL"],
    rating: 4.8,
    hourly_rate: 55,
    experience_years: 7,
    availability: true,
    account_age_days: 950,
    review_count: 58,
    fraud_score: 0.06,
    match_score: 93,
    reviews: [
      {
        author: "MeshAI",
        text: "Priya is an incredible engineer. Fast, reliable, and great communicator.",
        rating: 5,
      },
    ],
  },
  {
    id: 10,
    name: "Kai Müller",
    avatar: "KM",
    location: "Munich, DE",
    bio: "Machine learning engineer focused on computer vision and real-time inference optimization. Has deployed YOLO-based systems in manufacturing and retail. Expert in ONNX and TensorRT.",
    skills: ["ML", "Python", "Docker", "Data Science"],
    rating: 4.6,
    hourly_rate: 105,
    experience_years: 6,
    availability: true,
    account_age_days: 780,
    review_count: 19,
    fraud_score: 0.08,
    match_score: 78,
    reviews: [
      {
        author: "VisionTech",
        text: "Kai's CV pipeline reduced our defect rate by 40%. Outstanding.",
        rating: 5,
      },
    ],
  },
  {
    id: 11,
    name: "Lena Park",
    avatar: "LP",
    location: "Seoul, KR",
    bio: "Frontend architect specializing in Next.js, performance engineering, and design systems. Has shipped consumer apps used by 5M+ users. Strong TypeScript and testing background.",
    skills: ["React", "JavaScript", "UI/UX", "Figma"],
    rating: 4.9,
    hourly_rate: 80,
    experience_years: 7,
    availability: true,
    account_age_days: 1050,
    review_count: 44,
    fraud_score: 0.04,
    match_score: 90,
    reviews: [
      {
        author: "ConsumerApp Co.",
        text: "Lena's architecture decisions aged perfectly. A rare talent.",
        rating: 5,
      },
    ],
  },
  {
    id: 12,
    name: "Ravi Chandran",
    avatar: "RC",
    location: "Singapore, SG",
    bio: "Backend systems engineer specializing in high-throughput distributed systems. Built trading infrastructure handling 200k TPS. Expert in Go, Python, and PostgreSQL optimization.",
    skills: ["Python", "PostgreSQL", "Node.js", "Docker", "DevOps"],
    rating: 4.7,
    hourly_rate: 115,
    experience_years: 10,
    availability: false,
    account_age_days: 1820,
    review_count: 31,
    fraud_score: 0.03,
    match_score: 83,
    reviews: [
      {
        author: "TradeSys",
        text: "Ravi engineered the backbone of our trading platform. Exceptional.",
        rating: 5,
      },
    ],
  },
  // ── Suspicious profiles (for fraud demo) ────────────────────────────────────
  {
    id: 13,
    name: "Alex Storm",
    avatar: "AS",
    location: "Remote",
    bio: "Full-stack developer with expertise in React, Python, ML, DevOps, Docker, and more. Available for any project type. Very fast delivery guaranteed.",
    skills: [
      "React",
      "Python",
      "ML",
      "DevOps",
      "Docker",
      "JavaScript",
      "FastAPI",
    ],
    rating: 5.0,
    hourly_rate: 185,
    experience_years: 1,
    availability: true,
    account_age_days: 12,
    review_count: 87,
    fraud_score: 0.91,
    match_score: 55,
    reviews: [
      {
        author: "Unknown Corp",
        text: "Amazing work! Best freelancer ever!",
        rating: 5,
      },
      { author: "Shell Inc.", text: "Perfect every time. 10/10.", rating: 5 },
    ],
  },
  {
    id: 14,
    name: "Dev Expert99",
    avatar: "DE",
    location: "Remote",
    bio: "Expert in all technologies. React, Python, ML, Data Science, Node.js, Docker, PostgreSQL, Figma, UI/UX. Over 10 years of experience in every domain.",
    skills: ["React", "Python", "ML", "Node.js", "PostgreSQL", "Figma"],
    rating: 4.9,
    hourly_rate: 200,
    experience_years: 2,
    availability: true,
    account_age_days: 8,
    review_count: 112,
    fraud_score: 0.88,
    match_score: 48,
    reviews: [{ author: "Anonymous", text: "Great work!", rating: 5 }],
  },
  {
    id: 15,
    name: "FastCoder X",
    avatar: "FX",
    location: "Unverified",
    bio: "Rapid delivery specialist. I can build anything in 24 hours. All technologies, all budgets.",
    skills: ["JavaScript", "React", "Python", "DevOps"],
    rating: 4.8,
    hourly_rate: 160,
    experience_years: 1,
    availability: true,
    account_age_days: 21,
    review_count: 63,
    fraud_score: 0.79,
    match_score: 42,
    reviews: [{ author: "Ghost Account", text: "Super fast!", rating: 5 }],
  },
  {
    id: 16,
    name: "Chloe Bernard",
    avatar: "CB",
    location: "Paris, FR",
    bio: "UX researcher and product designer. Conducted 200+ user interviews, built design systems for enterprise SaaS. Believer in accessible, data-driven design.",
    skills: ["UI/UX", "Figma", "JavaScript"],
    rating: 4.6,
    hourly_rate: 72,
    experience_years: 5,
    availability: true,
    account_age_days: 880,
    review_count: 26,
    fraud_score: 0.06,
    match_score: 74,
    reviews: [
      {
        author: "EnterpriseHQ",
        text: "Chloe ran a transformative UX research sprint for our team.",
        rating: 5,
      },
    ],
  },
  {
    id: 17,
    name: "Daniel Torres",
    avatar: "DT",
    location: "Mexico City, MX",
    bio: "Node.js and PostgreSQL backend developer. 6 years building SaaS APIs. Expert at schema design, query optimization, and real-time WebSocket systems.",
    skills: ["Node.js", "PostgreSQL", "JavaScript", "Docker"],
    rating: 4.5,
    hourly_rate: 58,
    experience_years: 6,
    availability: true,
    account_age_days: 760,
    review_count: 37,
    fraud_score: 0.08,
    match_score: 72,
    reviews: [
      {
        author: "SaaSBuilder",
        text: "Daniel's API architecture is clean and scalable. Great hire.",
        rating: 4,
      },
    ],
  },
  {
    id: 18,
    name: "Amara Diallo",
    avatar: "AD",
    location: "Dakar, SN",
    bio: "Data engineer and analyst. Specialist in building ETL pipelines, data warehouses, and BI dashboards. Expert in dbt, Airflow, and Metabase.",
    skills: ["Data Science", "Python", "PostgreSQL", "Docker"],
    rating: 4.7,
    hourly_rate: 60,
    experience_years: 5,
    availability: false,
    account_age_days: 670,
    review_count: 21,
    fraud_score: 0.07,
    match_score: 69,
    reviews: [
      {
        author: "DataCo",
        text: "Amara built our entire analytics stack. Clear communication throughout.",
        rating: 5,
      },
    ],
  },
  {
    id: 19,
    name: "Oliver Kim",
    avatar: "OK",
    location: "Toronto, CA",
    bio: "React Native and React developer. 5 years building cross-platform apps for startups. Shipped 8 apps to production on both App Store and Play Store.",
    skills: ["React", "JavaScript", "UI/UX", "Node.js"],
    rating: 4.6,
    hourly_rate: 78,
    experience_years: 5,
    availability: true,
    account_age_days: 820,
    review_count: 33,
    fraud_score: 0.06,
    match_score: 71,
    reviews: [
      {
        author: "MobileFirst",
        text: "Oliver shipped our app on time and under budget. Excellent.",
        rating: 5,
      },
    ],
  },
  {
    id: 20,
    name: "Hana Schmidt",
    avatar: "HS",
    location: "Vienna, AT",
    bio: "ML researcher turned practical ML engineer. PhD in statistical learning. Builds production-ready model pipelines with strong emphasis on interpretability and fairness.",
    skills: ["ML", "Data Science", "Python", "PostgreSQL"],
    rating: 4.8,
    hourly_rate: 98,
    experience_years: 7,
    availability: true,
    account_age_days: 1010,
    review_count: 17,
    fraud_score: 0.05,
    match_score: 86,
    reviews: [
      {
        author: "InsureTech",
        text: "Hana's model improved our risk assessment by 35%. Invaluable.",
        rating: 5,
      },
    ],
  },
];

export const PROJECTS = [
  {
    id: 1,
    title: "AI Platform v2.0",
    description:
      "Next-gen ML inference platform with real-time feature store and model versioning.",
    required_skills: ["Python", "ML", "Docker", "PostgreSQL"],
    budget: 18000,
    deadline_days: 60,
    team_size: 4,
    status: "open",
  },
  {
    id: 2,
    title: "Neo-Banking Dashboard",
    description:
      "Rebuild the client-facing dashboard in React with full accessibility compliance.",
    required_skills: ["React", "JavaScript", "UI/UX", "Figma"],
    budget: 8500,
    deadline_days: 30,
    team_size: 2,
    status: "in_progress",
  },
  {
    id: 3,
    title: "DevOps Migration",
    description:
      "Migrate legacy infrastructure to Kubernetes and GitOps workflow on AWS.",
    required_skills: ["DevOps", "Docker", "PostgreSQL"],
    budget: 12000,
    deadline_days: 45,
    team_size: 3,
    status: "open",
  },
  {
    id: 4,
    title: "Data Pipeline ETL",
    description:
      "Build scalable ETL pipeline for analytics data warehouse using Airflow and dbt.",
    required_skills: ["Python", "Data Science", "PostgreSQL"],
    budget: 9000,
    deadline_days: 25,
    team_size: 2,
    status: "open",
  },
  {
    id: 5,
    title: "Consumer Mobile API",
    description:
      "FastAPI backend for the new consumer mobile application with real-time features.",
    required_skills: ["FastAPI", "Node.js", "PostgreSQL"],
    budget: 7500,
    deadline_days: 35,
    team_size: 2,
    status: "open",
  },
];

// ─── Helper: filter + rank freelancers ────────────────────────────────────────
export function filterFreelancers(freelancers, filters = {}) {
  const {
    query = "",
    skills = [],
    minRate = 0,
    maxRate = 300,
    minRating = 0,
    availableOnly = false,
    maxFraud = 1,
  } = filters;

  return freelancers
    .filter((f) => {
      const q = query.toLowerCase();
      const matchesQuery =
        !q ||
        f.name.toLowerCase().includes(q) ||
        f.bio.toLowerCase().includes(q) ||
        f.location.toLowerCase().includes(q) ||
        f.skills.some((s) => s.toLowerCase().includes(q));

      const matchesSkills =
        skills.length === 0 || skills.some((s) => f.skills.includes(s));

      const matchesRate = f.hourly_rate >= minRate && f.hourly_rate <= maxRate;
      const matchesRating = f.rating >= minRating;
      const matchesAvailability = !availableOnly || f.availability;
      const matchesFraud = f.fraud_score <= maxFraud;

      return (
        matchesQuery &&
        matchesSkills &&
        matchesRate &&
        matchesRating &&
        matchesAvailability &&
        matchesFraud
      );
    })
    .sort((a, b) => b.match_score - a.match_score);
}

// ─── CSP Team Solver (mock simulation) ────────────────────────────────────────
export function solveTeamMock(
  freelancers,
  { budget, required_skills, team_size },
) {
  const hourlyBudget = budget / 40; // Assume 40h week
  const available = freelancers.filter(
    (f) => f.availability && f.fraud_score < 0.6,
  );

  // Greedy: prioritise skill coverage, then match score
  const team = [];
  const coveredSkills = new Set();
  const usedIds = new Set();

  // First pass: pick best candidate per required skill
  for (const skill of required_skills) {
    if (team.length >= team_size) break;
    const candidate = available
      .filter((f) => !usedIds.has(f.id) && f.skills.includes(skill))
      .sort((a, b) => b.match_score - a.match_score)[0];
    if (candidate) {
      team.push(candidate);
      usedIds.add(candidate.id);
      candidate.skills.forEach((s) => coveredSkills.add(s));
    }
  }

  // Second pass: fill remaining slots by match score
  if (team.length < team_size) {
    const remaining = available
      .filter((f) => !usedIds.has(f.id))
      .sort((a, b) => b.match_score - a.match_score);
    for (const f of remaining) {
      if (team.length >= team_size) break;
      team.push(f);
      usedIds.add(f.id);
    }
  }

  const totalHourly = team.reduce((s, f) => s + f.hourly_rate, 0);
  const totalCost = totalHourly * 40;

  if (totalCost > budget && team.length > 0) {
    // Try cheaper substitutes
    team.sort((a, b) => b.hourly_rate - a.hourly_rate);
    const expensive = team.shift();
    const cheaper = available
      .filter(
        (f) =>
          !usedIds.has(f.id) &&
          f.hourly_rate < expensive.hourly_rate &&
          f.skills.some((s) => expensive.skills.includes(s)),
      )
      .sort((a, b) => a.hourly_rate - b.hourly_rate)[0];
    if (cheaper) team.push(cheaper);
    else team.push(expensive);
  }

  const skillsCovered = [...new Set(team.flatMap((f) => f.skills))].filter(
    (s) => required_skills.includes(s),
  );
  const uncovered = required_skills.filter((s) => !skillsCovered.includes(s));

  return {
    team,
    total_cost: team.reduce((s, f) => s + f.hourly_rate, 0) * 40,
    skills_covered: skillsCovered,
    uncovered_skills: uncovered,
    success: team.length > 0,
  };
}

// ─── Activity feed mock data ───────────────────────────────────────────────────
export const ACTIVITY_FEED = [
  {
    id: 1,
    type: "search",
    text: 'New A* search for "Python ML Engineer" returned 12 matches',
    time: "2m ago",
    color: "cyan",
  },
  {
    id: 2,
    type: "fraud",
    text: "Bayesian flag: Account #DE-14 scored 0.88 fraud probability",
    time: "7m ago",
    color: "red",
  },
  {
    id: 3,
    type: "team",
    text: 'CSP solver built team for "AI Platform v2.0" — 4 members, $14,400',
    time: "14m ago",
    color: "violet",
  },
  {
    id: 4,
    type: "search",
    text: 'Query "React UI/UX designer" matched Freelancer #4, #2, #11',
    time: "21m ago",
    color: "cyan",
  },
  {
    id: 5,
    type: "contract",
    text: "Contract initiated: Aria Voss ↔ DataFlow AI (Project #1)",
    time: "35m ago",
    color: "emerald",
  },
  {
    id: 6,
    type: "fraud",
    text: "Network anomaly: 3 accounts share identical portfolio hashes",
    time: "1h ago",
    color: "red",
  },
  {
    id: 7,
    type: "team",
    text: "Budget conflict resolved: swapped Freelancer #12 → #5 (−$55/hr)",
    time: "1h ago",
    color: "violet",
  },
  {
    id: 8,
    type: "search",
    text: 'Embedding similarity search: top cosine score 0.97 for "DevOps"',
    time: "2h ago",
    color: "cyan",
  },
  {
    id: 9,
    type: "contract",
    text: "Contract completed: Marcus Lin — Neo-Banking Dashboard",
    time: "3h ago",
    color: "emerald",
  },
  {
    id: 10,
    type: "fraud",
    text: "Account #AS-13 flagged: 12-day-old account, 87 reviews detected",
    time: "4h ago",
    color: "red",
  },
];

export const ALL_SKILLS = [
  "Python",
  "JavaScript",
  "React",
  "FastAPI",
  "ML",
  "Data Science",
  "DevOps",
  "Docker",
  "PostgreSQL",
  "UI/UX",
  "Figma",
  "Node.js",
];
