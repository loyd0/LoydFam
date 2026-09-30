"use client";

import { useEffect, useState, useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "loyd-theme";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  const resolved = theme === "system" ? getSystemTheme() : theme;
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

function subscribeSystemTheme(onChange: () => void) {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useTheme() {
  const systemTheme = useSyncExternalStore(subscribeSystemTheme, getSystemTheme, () => "light" as const);
  const [theme, setThemeState] = useState<Theme>("system");

  // On mount, read the saved preference and apply it. We start from the
  // server-rendered default and update on the client to avoid a hydration
  // mismatch, so the setState here is intentional.
  useEffect(() => {
    let saved: Theme = "system";
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "dark" || stored === "light") saved = stored;
    } catch { /* Preferences are optional when storage is unavailable. */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(saved);
    applyTheme(saved);
  }, []);

  // Listen for system preference changes when in "system" mode
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") applyTheme("system");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* Keep this session usable. */ }
    applyTheme(next);
  }, []);

  const resolvedTheme: "light" | "dark" =
    theme === "system" ? systemTheme : theme;

  return { theme, setTheme, resolvedTheme };
}
