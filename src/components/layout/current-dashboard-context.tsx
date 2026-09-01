"use client";

import { createContext, useContext, useMemo, useState } from "react";

export type CurrentDashboard = { id: string; name: string };

type CurrentDashboardContextValue = {
  current: CurrentDashboard | null;
  setCurrent: (dashboard: CurrentDashboard | null) => void;
};

const CurrentDashboardContext =
  createContext<CurrentDashboardContextValue | null>(null);

/**
 * Lets the dashboard canvas tell the sidebar which dashboard is open, without
 * a round trip: the layout above the canvas has no way to know a dynamic
 * route's data, so the canvas reports it directly instead.
 */
export function CurrentDashboardProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [current, setCurrent] = useState<CurrentDashboard | null>(null);
  const value = useMemo(() => ({ current, setCurrent }), [current]);

  return (
    <CurrentDashboardContext.Provider value={value}>
      {children}
    </CurrentDashboardContext.Provider>
  );
}

export function useCurrentDashboard() {
  const ctx = useContext(CurrentDashboardContext);
  if (!ctx) {
    throw new Error(
      "useCurrentDashboard must be used within a CurrentDashboardProvider",
    );
  }
  return ctx;
}
