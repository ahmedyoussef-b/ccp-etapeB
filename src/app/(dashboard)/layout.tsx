"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useEffect, useState } from "react";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopNav } from "@/components/dashboard/top-nav";
import { ThemeProvider } from "@/components/theme-provider";

type Role = "admin" | "chef-de-quart" | "chef-de-bloc" | "rondier";

function getStoredRole(): Role {
  if (typeof window === "undefined") return "rondier";
  const stored = window.sessionStorage.getItem("dashboardRole");
  if (stored === "admin" || stored === "chef-de-quart" || stored === "chef-de-bloc" || stored === "rondier") return stored;
  return "rondier";
}

function deriveRoleFromPath(pathname: string): Role {
  if (pathname.startsWith("/admin") || pathname.startsWith("/pipeline")) return "admin";
  if (pathname.startsWith("/chef-de-quart")) return "chef-de-quart";
  if (pathname.startsWith("/chef-de-bloc")) return "chef-de-bloc";
  if (pathname.startsWith("/rondier")) return "rondier";
  return "rondier";
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const pathRole = deriveRoleFromPath(pathname);
  const stored = getStoredRole();
  const [role, setRole] = useState<Role>(pathRole);
  const [hydrated, setHydrated] = useState(false);

  useLayoutEffect(() => {
    const hasRolePrefix = pathname.startsWith("/admin") || pathname.startsWith("/pipeline") || pathname.startsWith("/chef-de-quart") || pathname.startsWith("/chef-de-bloc") || pathname.startsWith("/rondier");
    const next = hasRolePrefix
      ? deriveRoleFromPath(pathname)
      : stored;
    setRole(next);
    setHydrated(true);
  }, [pathname, stored]);

  useEffect(() => {
    if (!hydrated) return;
    const hasRolePrefix = pathname.startsWith("/admin") || pathname.startsWith("/pipeline") || pathname.startsWith("/chef-de-quart") || pathname.startsWith("/chef-de-bloc") || pathname.startsWith("/rondier");
    if (hasRolePrefix) {
      try {
        window.sessionStorage.setItem("dashboardRole", deriveRoleFromPath(pathname));
      } catch {}
    }
  }, [pathname, hydrated]);

  return (
    <ThemeProvider>
      <div className="flex h-screen overflow-hidden">
        <DashboardSidebar role={role} />
        <main className="flex flex-1 flex-col overflow-hidden">
          <DashboardTopNav />
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </main>
      </div>
    </ThemeProvider>
  );
}
