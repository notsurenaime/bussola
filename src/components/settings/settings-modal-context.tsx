"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type SettingsTab = "general" | "account" | "billing";

type SettingsModalContextValue = {
  open: boolean;
  tab: SettingsTab;
  openSettings: (tab?: SettingsTab) => void;
  close: () => void;
  setTab: (tab: SettingsTab) => void;
};

const SettingsModalContext = createContext<SettingsModalContextValue | null>(
  null,
);

export function SettingsModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<SettingsTab>("general");

  const openSettings = useCallback((nextTab?: SettingsTab) => {
    if (nextTab) setTab(nextTab);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ open, tab, openSettings, close, setTab }),
    [open, tab, openSettings, close],
  );

  return (
    <SettingsModalContext.Provider value={value}>
      {children}
    </SettingsModalContext.Provider>
  );
}

export function useSettingsModal() {
  const ctx = useContext(SettingsModalContext);
  if (!ctx) {
    throw new Error(
      "useSettingsModal must be used within a SettingsModalProvider",
    );
  }
  return ctx;
}
