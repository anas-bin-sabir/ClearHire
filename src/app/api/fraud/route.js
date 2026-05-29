import sql from "@/app/api/utils/sql";
import { calculateFraudProbability } from "@/app/api/utils/ai_logic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) return Response.json({ error: "Missing ID" }, { status: 400 });

    const [freelancer] = await sql`SELECT * FROM freelancers WHERE id = ${id}`;
    if (!freelancer)
      return Response.json({ error: "Not found" }, { status: 404 });

    const fraudData = calculateFraudProbability(freelancer);

    // AI reasoning
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
                "You are ClearHire Fraud Intelligence. Analyze the risk factors of this freelancer profile.",
            },
            {
              role: "user",
              content: `Freelancer: ${freelancer.name}. Risk Factors: ${fraudData.risk_factors.join(", ")}. Score: ${fraudData.score}. provide a brief security summary.`,
            },
          ],
        }),
      },
    );

    const aiData = await aiResponse.json();
    const explanation =
      aiData.choices?.[0]?.message?.content || "Risk assessment completed.";

    return Response.json({
      ...fraudData,
      freelancer,
      explanation,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
