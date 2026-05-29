import sql from "@/app/api/utils/sql";
import { solveTeamCSP } from "@/app/api/utils/ai_logic";

export async function POST(request) {
  try {
    const { budget, required_skills, team_size } = await request.json();

    // 1. Fetch available freelancers
    const freelancers =
      await sql`SELECT * FROM freelancers WHERE availability = true AND fraud_score < 0.6`;

    // 2. Solve CSP
    const team = solveTeamCSP(freelancers, {
      budget,
      required_skills,
      team_size,
    });

    if (!team) {
      return Response.json({
        success: false,
        message:
          "No valid team configuration found within the specified constraints.",
        explanation:
          "The budget and skill requirements are too restrictive for the current talent pool. Consider increasing the budget or reducing the team size.",
      });
    }

    // 3. AI Explanation
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
                "You are ClearHire AI. Explain why this specific team was selected for the project based on budget and skills.",
            },
            {
              role: "user",
              content: `Team: ${team.map((f) => f.name).join(", ")}. Budget: ${budget}. Skills: ${required_skills.join(", ")}. Explain the synergies.`,
            },
          ],
        }),
      },
    );

    const aiData = await aiResponse.json();
    const explanation =
      aiData.choices?.[0]?.message?.content ||
      "Team optimized for maximum skill coverage within budget parameters.";

    return Response.json({
      success: true,
      team,
      total_cost: team.reduce((s, f) => s + f.hourly_rate, 0) * 40, // Assuming 40h
      explanation,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
