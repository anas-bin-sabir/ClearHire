import sql from "@/app/api/utils/sql";

export async function GET() {
  try {
    const freelancers =
      await sql`SELECT id, name, skills FROM freelancers LIMIT 30`;
    const relationships =
      await sql`SELECT skill_a, skill_b FROM skill_relationships`;

    // Format for a force-directed graph
    const nodes = [];
    const links = [];
    const skillNodes = new Set();

    freelancers.forEach((f) => {
      nodes.push({ id: `f-${f.id}`, name: f.name, type: "freelancer" });
      f.skills.forEach((s) => {
        skillNodes.add(s);
        links.push({
          source: `f-${f.id}`,
          target: `s-${s}`,
          type: "HAS_SKILL",
        });
      });
    });

    skillNodes.forEach((s) => {
      nodes.push({ id: `s-${s}`, name: s, type: "skill" });
    });

    relationships.forEach((r) => {
      if (skillNodes.has(r.skill_a) && skillNodes.has(r.skill_b)) {
        links.push({
          source: `s-${r.skill_a}`,
          target: `s-${r.skill_b}`,
          type: "RELATED_TO",
        });
      }
    });

    return Response.json({ nodes, links });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
