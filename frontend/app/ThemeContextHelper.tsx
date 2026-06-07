"use client";

import React from "react";
import { useTheme as useAppTheme } from "@/components/ThemeProvider";

export function useTheme() {
  const context = useAppTheme();
  const dark = context.theme === "dark";
  const setDark = (val: boolean) => {
    const target = val ? "dark" : "light";
    if (context.theme !== target) {
      context.toggleTheme();
    }
  };
  return { dark, setDark };
}

export function ThemeContextProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
