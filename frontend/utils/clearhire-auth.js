/**
 * Client session bridge — mirrors NextAuth JWT session for components
 * that expect the legacy getSession() / isAdmin() API.
 */

let cachedSession = null;

export function setCachedSession(session) {
  cachedSession = session;
}

export function getSession() {
  if (typeof window === "undefined") return null;
  return cachedSession;
}

export function clearSession() {
  cachedSession = null;
}

export function hasRole(session, ...roles) {
  return !!(session && roles.includes(session.role));
}

export function isAdmin(session) {
  return hasRole(session, "admin");
}

export function isClient(session) {
  return hasRole(session, "client", "admin");
}
