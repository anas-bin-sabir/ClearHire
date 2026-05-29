// ─── ClearHire Auth System ────────────────────────────────────────────────────
// localStorage-backed session with role-based access control

const STORAGE_KEY = "clearhire_auth";

export const USERS = [
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

// ─── Session Helpers ───────────────────────────────────────────────────────────

export function getSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(user) {
  const session = { ...user, loginAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

// ─── Auth Actions ──────────────────────────────────────────────────────────────

export function login(email, password) {
  const user = USERS.find(
    (u) =>
      u.email.toLowerCase() === email.toLowerCase() && u.password === password,
  );
  if (!user) return { success: false, error: "Invalid email or password" };
  const { password: _p, ...safeUser } = user;
  return { success: true, user: setSession(safeUser) };
}

export function register(name, email, password, role = "client") {
  if (USERS.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return {
      success: false,
      error: "An account with this email already exists",
    };
  }
  const newUser = {
    id: USERS.length + 1,
    name,
    email,
    password,
    role,
    avatar: name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2),
    department: role === "client" ? "Hiring Team" : "Independent Contractor",
  };
  USERS.push(newUser);
  const { password: _p, ...safeUser } = newUser;
  return { success: true, user: setSession(safeUser) };
}

export function demoLogin(role = "admin") {
  const user = USERS.find((u) => u.role === role) || USERS[0];
  const { password: _p, ...safeUser } = user;
  return { success: true, user: setSession(safeUser) };
}

export function logout() {
  clearSession();
  window.location.href = "/login";
}

// ─── Role Checks ───────────────────────────────────────────────────────────────

export function hasRole(session, ...roles) {
  return !!(session && roles.includes(session.role));
}

export function isAdmin(session) {
  return hasRole(session, "admin");
}

export function isClient(session) {
  return hasRole(session, "client", "admin");
}
