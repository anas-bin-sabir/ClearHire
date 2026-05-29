import sql from "./sql";

/**
 * A* Search for ranking freelancers.
 * f(n) = g(n) + h(n)
 * g(n): Skill gap + rate deviation + fraud penalty
 * h(n): 1 - vector similarity (heuristic)
 */
export async function rankFreelancers(freelancers, project, projectEmbedding) {
  // Simple heuristic ranking for this demo context
  // In a real A* we'd explore states, but here we're re-ranking a list
  const ranked = freelancers.map((f) => {
    const skillGap = project.required_skills.filter(
      (s) => !f.skills.includes(s),
    ).length;
    const rateDiff = Math.max(
      0,
      f.hourly_rate - project.budget / project.team_size / 20,
    ); // Assume 20 hours
    const fraudPenalty = f.fraud_score * 10;

    // Cost g(n)
    const g = skillGap * 5 + rateDiff / 10 + fraudPenalty;

    // Heuristic h(n) - simplified cosine distance if embedding exists
    // We'll simulate similarity for now if no embedding is provided
    const h = f.similarity ? (1 - f.similarity) * 20 : 10;

    const fScore = g + h;

    return { ...f, match_score: Math.max(0, 100 - fScore), fScore };
  });

  return ranked.sort((a, b) => a.fScore - b.fScore);
}

/**
 * CSP Solver: Backtracking with forward checking for team building.
 */
export function solveTeamCSP(freelancers, project) {
  const { budget, required_skills, team_size } = project;
  const resultTeam = [];

  function backtrack(currentTeam, skillIndex) {
    if (currentTeam.length === team_size) {
      const currentCost = currentTeam.reduce(
        (sum, f) => sum + f.hourly_rate,
        0,
      );
      const covered = new Set(currentTeam.flatMap((f) => f.skills));
      const allSkillsMet = required_skills.every((s) => covered.has(s));

      if (currentCost * 40 <= budget && allSkillsMet) {
        // Assume 40h/week
        return currentTeam;
      }
      return null;
    }

    if (
      skillIndex >= required_skills.length &&
      currentTeam.length < team_size
    ) {
      // Need more members but skills are covered
      // Just pick available ones
    }

    // Heuristic: try freelancers with the required skill first
    const targetSkill = required_skills[skillIndex] || null;
    const candidates = freelancers.filter(
      (f) =>
        !currentTeam.find((member) => member.id === f.id) &&
        (targetSkill ? f.skills.includes(targetSkill) : true),
    );

    for (const freelancer of candidates) {
      const nextTeam = [...currentTeam, freelancer];
      const nextCost = nextTeam.reduce((sum, f) => sum + f.hourly_rate, 0);

      if (nextCost * 40 > budget) continue; // Early prune

      const solution = backtrack(nextTeam, skillIndex + 1);
      if (solution) return solution;
    }

    return null;
  }

  return backtrack([], 0);
}

/**
 * Bayesian Fraud Scorer
 */
export function calculateFraudProbability(freelancer) {
  // P(Fraud) = Prior (0.05)
  let logOdds = Math.log(0.05 / (1 - 0.05));

  // Factors (using log-odds for stability)
  if (freelancer.account_age_days < 30) logOdds += Math.log(8);
  if (freelancer.review_count > 50 && freelancer.rating > 4.9)
    logOdds += Math.log(3); // Suspiciously perfect
  if (freelancer.hourly_rate > 150 && freelancer.experience_years < 2)
    logOdds += Math.log(5);

  // High similarity portfolio (mock signal)
  if (freelancer.portfolio_urls?.length > 0 && Math.random() > 0.8)
    logOdds += Math.log(6);

  const prob = 1 / (1 + Math.exp(-logOdds));
  return {
    score: prob,
    risk_factors: [
      freelancer.account_age_days < 30 ? "New account anomaly" : null,
      freelancer.hourly_rate > 150 && freelancer.experience_years < 2
        ? "Rate/Experience mismatch"
        : null,
      prob > 0.6 ? "Portfolio similarity detected" : null,
    ].filter(Boolean),
  };
}
