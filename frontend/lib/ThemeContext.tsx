"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { getUserSettings, updateUserSettings } from "@/lib/api";
import { getSession } from "@/utils/clearhire-auth";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
  setTheme: () => {},
});

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("clearhire_theme", theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("clearhire_theme") as Theme | null;
    const initial: Theme = saved === "light" ? "light" : "dark";
    setThemeState(initial);
    applyTheme(initial);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const session = getSession();
    if (!session?.id) return;

    getUserSettings(session.id)
      .then((res) => {
        const remote = res.preferences?.theme;
        if (remote === "light" || remote === "dark") {
          setThemeState(remote);
          applyTheme(remote);
        }
      })
      .catch(() => {});
  }, [hydrated]);

  const persistTheme = useCallback((next: Theme) => {
    const session = getSession();
    if (!session?.id) return;
    updateUserSettings(session.id, {
      notifications_enabled: true,
      email_alerts: true,
      fraud_sensitivity: 0.6,
      preferred_skills: [],
      theme: next,
    }).catch(() => {});
  }, []);

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      applyTheme(next);
      persistTheme(next);
    },
    [persistTheme],
  );

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      applyTheme(next);
      persistTheme(next);
      return next;
    });
  }, [persistTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
