"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { SidebarContext, type SidebarContextValue } from "./SidebarContext";

const COLLAPSED_KEY = "sidebar-collapsed";
const MOBILE_BREAKPOINT = 768;

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const stored = window.localStorage.getItem(COLLAPSED_KEY);
      return stored === "true";
    } catch {
      return false;
    }
  });

  const [isOpen, setIsOpenState] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSED_KEY, String(collapsed));
    } catch {}
  }, [collapsed]);

  const setCollapsed = useCallback((v: boolean) => {
    setCollapsedState(v);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsedState((prev) => !prev);
  }, []);

  const setIsOpen = useCallback((v: boolean) => {
    setIsOpenState(v);
  }, []);

  const toggleOpen = useCallback(() => {
    setIsOpenState((prev) => !prev);
  }, []);

  const value = useMemo<SidebarContextValue>(
    () => ({
      collapsed,
      setCollapsed,
      toggleCollapsed,
      isOpen,
      setIsOpen,
      toggleOpen,
      isMobile,
    }),
    [collapsed, setCollapsed, toggleCollapsed, isOpen, setIsOpen, toggleOpen, isMobile]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}
