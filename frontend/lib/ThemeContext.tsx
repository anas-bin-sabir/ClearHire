"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
  useMemo,
} from "react";
import { getUserSettings, updateUserSettings } from "@/lib/api";
import { getSession } from "@/utils/clearhire-auth";
import type { ResolvedTheme, ThemeMode } from "@/lib/theme";

interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = "clearhire_theme";

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolvedTheme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
});

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(mode: ThemeMode): ResolvedTheme {
  const resolved = mode === "system" ? getSystemTheme() : mode;
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.classList.add("theme-transition");
  window.setTimeout(() => {
    document.documentElement.classList.remove("theme-transition");
  }, 250);
  return resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    const initial: ThemeMode =
      saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
    setThemeState(initial);
    setResolvedTheme(applyTheme(initial));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setResolvedTheme(applyTheme("system"));
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const session = getSession();
    if (!session?.id) return;

    getUserSettings(session.id)
      .then((res) => {
        const remote = res.preferences?.theme;
        if (remote === "light" || remote === "dark") {
          setThemeState(remote);
          setResolvedTheme(applyTheme(remote));
        }
      })
      .catch(() => {});
  }, [hydrated]);

  const persistTheme = useCallback((mode: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, mode);
    const session = getSession();
    if (!session?.id) return;
    const apiTheme = mode === "system" ? resolvedTheme : mode;
    updateUserSettings(session.id, {
      notifications_enabled: true,
      email_alerts: true,
      fraud_sensitivity: 0.6,
      preferred_skills: [],
      theme: apiTheme,
    }).catch(() => {});
  }, [resolvedTheme]);

  const setTheme = useCallback(
    (mode: ThemeMode) => {
      setThemeState(mode);
      const resolved = applyTheme(mode);
      setResolvedTheme(resolved);
      persistTheme(mode);
    },
    [persistTheme],
  );

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
