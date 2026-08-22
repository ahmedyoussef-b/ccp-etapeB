"use client";

import { createContext, useContext } from "react";

export type SidebarContextValue = {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  toggleCollapsed: () => void;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  toggleOpen: () => void;
  isMobile: boolean;
};

export const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return ctx;
}
