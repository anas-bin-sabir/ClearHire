import sql from "@/app/api/utils/sql";
import { rankFreelancers } from "@/app/api/utils/ai_logic";

export async function POST(request) {
  try {
    const { query, skills, minRate, maxRate } = await request.json();

    // 1. Fetch Candidates (Basic filter + Vector Search placeholder)
    // In a real app, we'd use pgvector here:
    // SELECT *, 1 - (embedding <=> ${embedding}) as similarity FROM freelancers ...

    let dbQuery = sql`
      SELECT * FROM freelancers 
      WHERE availability = true
      AND fraud_score < 0.7
    `;

    // Basic skill matching if provided
    let freelancers = await dbQuery;

    if (skills && skills.length > 0) {
      freelancers = freelancers.filter((f) =>
        skills.some((s) => f.skills.includes(s)),
      );
    }

    // 2. Rank using A* logic
    const project = {
      required_skills: skills || [],
      budget: 10000, // Default for ranking
      team_size: 1,
    };

    const ranked = await rankFreelancers(freelancers, project, null);

    // 3. Generate Explanation using AI
    const aiResponse = await fetch(
      `${process.env.NEXT_PUBLIC_CREATE_APP_URL}/integrations/google-gemini-2-5-flash/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content:
                "You are ClearHire AI. Explain why these freelancers were matched for the given criteria.",
            },
            {
              role: "user",
              content: `Criteria: ${query}. Top Matches: ${ranked
                .slice(0, 3)
                .map((f) => f.name)
                .join(", ")}. Explain the reasoning behind this selection.`,
            },
          ],
        }),
      },
    );

    const aiData = await aiResponse.json();
    const explanation =
      aiData.choices?.[0]?.message?.content ||
      "AI reasoning completed based on skill relevance and fraud risk analysis.";

    return Response.json({
      freelancers: ranked.slice(0, 20),
      explanation,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
