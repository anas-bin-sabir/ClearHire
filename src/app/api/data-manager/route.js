import sql from "@/app/api/utils/sql";

const ALLOWED_TABLES = [
  "freelancers",
  "users",
  "projects",
  "contracts",
  "skill_relationships",
];

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get("table");

    if (!ALLOWED_TABLES.includes(table)) {
      return Response.json({ error: "Invalid table name" }, { status: 400 });
    }

    const rows = await sql(`SELECT * FROM ${table} ORDER BY id DESC LIMIT 50`);
    const countResult = await sql(`SELECT COUNT(*) as total FROM ${table}`);

    return Response.json({
      rows,
      count: parseInt(countResult[0]?.total ?? 0),
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error.message, rows: [], count: 0 },
      { status: 500 },
    );
  }
}
