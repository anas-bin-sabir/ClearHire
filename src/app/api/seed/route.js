import sql from "@/app/api/utils/sql";

export async function POST(request) {
  try {
    // 1. Create Admin User
    const [admin] = await sql`
      INSERT INTO users (name, email, role) 
      VALUES ('Admin System', 'admin@clearhire.ai', 'admin')
      ON CONFLICT (email) DO UPDATE SET role = 'admin'
      RETURNING id
    `;

    // 2. Generate 50 Freelancers
    const skillsList = [
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
    const locations = [
      "San Francisco",
      "Berlin",
      "London",
      "Remote",
      "Tokyo",
      "Singapore",
    ];

    const freelancersData = Array.from({ length: 50 }).map((_, i) => {
      const skills = Array.from(
        { length: 3 + Math.floor(Math.random() * 4) },
        () => skillsList[Math.floor(Math.random() * skillsList.length)],
      );
      const uniqueSkills = [...new Set(skills)];
      const isSuspicious = i < 5;

      return {
        name: `Freelancer ${i + 1}`,
        email: `freelancer${i + 1}@example.com`,
        skills: uniqueSkills,
        rating: 3 + Math.random() * 2,
        hourly_rate: isSuspicious ? 180 : 30 + Math.floor(Math.random() * 120),
        experience_years: isSuspicious ? 1 : 2 + Math.floor(Math.random() * 15),
        account_age_days: isSuspicious
          ? 15
          : 60 + Math.floor(Math.random() * 1000),
        bio: `Professional expert in ${uniqueSkills.join(", ")}.`,
        location: locations[Math.floor(Math.random() * locations.length)],
        fraud_score: isSuspicious ? 0.85 : Math.random() * 0.2,
      };
    });

    for (const f of freelancersData) {
      const [user] = await sql`
        INSERT INTO users (name, email, role)
        VALUES (${f.name}, ${f.email}, 'freelancer')
        ON CONFLICT (email) DO UPDATE SET role = 'freelancer'
        RETURNING id
      `;

      await sql`
        INSERT INTO freelancers (user_id, name, skills, rating, hourly_rate, experience_years, account_age_days, fraud_score, bio, location)
        VALUES (${user.id}, ${f.name}, ${JSON.stringify(f.skills)}, ${f.rating}, ${f.hourly_rate}, ${f.experience_years}, ${f.account_age_days}, ${f.fraud_score}, ${f.bio}, ${f.location})
        ON CONFLICT DO NOTHING
      `;
    }

    // 3. Create a Project
    await sql`
      INSERT INTO projects (client_id, title, description, required_skills, budget, deadline_days, team_size)
      VALUES (${admin.id}, 'AI Platform Development', 'Looking for a robust team to build a next-gen AI hiring tool.', '["Python", "React", "ML"]', 15000, 45, 3)
      ON CONFLICT DO NOTHING
    `;

    // 4. Create Skill Relationships
    const relationships = [
      ["Python", "FastAPI"],
      ["React", "JavaScript"],
      ["ML", "Python"],
      ["DevOps", "Docker"],
      ["PostgreSQL", "Node.js"],
    ];
    for (const [a, b] of relationships) {
      await sql`INSERT INTO skill_relationships (skill_a, skill_b) VALUES (${a}, ${b}) ON CONFLICT DO NOTHING`;
    }

    return Response.json({
      success: true,
      message: "Database seeded successfully",
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
