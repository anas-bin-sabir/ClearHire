export type ClearHireRole = "admin" | "client" | "freelancer";

export interface ClearHireUser {
  id: number;
  name: string;
  email: string;
  password: string;
  role: ClearHireRole;
  avatar: string;
  department: string;
}

export const AUTH_USERS: ClearHireUser[] = [
  {
    id: 1,
    name: "Alex Rivera",
    email: "admin@clearhire.ai",
    password: "admin123",
    role: "admin",
    avatar: "AR",
    department: "Platform Intelligence",
  },
  {
    id: 2,
    name: "Alice Chen",
    email: "client@clearhire.ai",
    password: "client123",
    role: "client",
    avatar: "AC",
    department: "Product Engineering",
  },
  {
    id: 3,
    name: "Bob Martinez",
    email: "freelancer@clearhire.ai",
    password: "freelancer123",
    role: "freelancer",
    avatar: "BM",
    department: "Independent Contractor",
  },
  {
    id: 4,
    name: "Dana Park",
    email: "dana@clearhire.ai",
    password: "dana123",
    role: "client",
    avatar: "DP",
    department: "Design Systems",
  },
  {
    id: 5,
    name: "Eve Nakamura",
    email: "eve@clearhire.ai",
    password: "eve123",
    role: "freelancer",
    avatar: "EN",
    department: "Independent Contractor",
  },
];

export function findUserByEmailPassword(
  email: string,
  password: string,
): ClearHireUser | undefined {
  return AUTH_USERS.find(
    (u) =>
      u.email.toLowerCase() === email.toLowerCase() && u.password === password,
  );
}

export function findUserByRole(role: ClearHireRole): ClearHireUser {
  return AUTH_USERS.find((u) => u.role === role) ?? AUTH_USERS[0];
}
