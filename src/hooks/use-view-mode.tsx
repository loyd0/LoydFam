"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

export type ViewMode = "loyd" | "full";

interface ViewModeContextValue {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isLoydOnly: boolean;
}

const ViewModeContext = createContext<ViewModeContextValue>({
  viewMode: "loyd",
  setViewMode: () => {},
  isLoydOnly: true,
});

const STORAGE_KEY = "loyd-view-mode";

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>("loyd");

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ViewMode | null;
      if (stored === "full" || stored === "loyd") {
        setViewModeState(stored);
      }
    } catch {
      // localStorage unavailable (e.g. SSR, private browsing)
    }
  }, []);

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }, []);

  return (
    <ViewModeContext.Provider
      value={{ viewMode, setViewMode, isLoydOnly: viewMode === "loyd" }}
    >
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  return useContext(ViewModeContext);
}
