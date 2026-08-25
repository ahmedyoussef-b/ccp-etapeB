"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useEffect, useState } from "react";
import { useSession } from "@/hooks/useSession";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopNav } from "@/components/dashboard/top-nav";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

type Role = "admin" | "superviseur" | "chef-de-quart" | "chef-de-bloc" | "rondier";

function getStoredRole(): Role {
  if (typeof window === "undefined") return "rondier";
  const stored = window.sessionStorage.getItem("dashboardRole");
  if (stored === "admin" || stored === "superviseur" || stored === "chef-de-quart" || stored === "chef-de-bloc" || stored === "rondier") return stored;
  return "rondier";
}

function deriveRoleFromPath(pathname: string): Role {
  if (pathname.startsWith("/admin") || pathname.startsWith("/pipeline")) return "admin";
  if (pathname.startsWith("/superviseur")) return "superviseur";
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const { session, status } = useSession();

  useLayoutEffect(() => {
    const hasRolePrefix = pathname.startsWith("/admin") || pathname.startsWith("/pipeline") || pathname.startsWith("/superviseur") || pathname.startsWith("/chef-de-quart") || pathname.startsWith("/chef-de-bloc") || pathname.startsWith("/rondier");
    const next = hasRolePrefix
      ? deriveRoleFromPath(pathname)
      : stored;
    setRole(next);
    setHydrated(true);
  }, [pathname, stored]);

  useEffect(() => {
    if (!hydrated) return;
    const hasRolePrefix = pathname.startsWith("/admin") || pathname.startsWith("/pipeline") || pathname.startsWith("/superviseur") || pathname.startsWith("/chef-de-quart") || pathname.startsWith("/chef-de-bloc") || pathname.startsWith("/rondier");
    if (hasRolePrefix) {
      try {
        window.sessionStorage.setItem("dashboardRole", deriveRoleFromPath(pathname));
      } catch {}
    }
  }, [pathname, hydrated]);

  // Source de vérité : la session NextAuth prime sur le sessionStorage legacy.
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role) {
      const sessionRole = session.user.role as Role;
      setRole(sessionRole);
      try {
        window.sessionStorage.setItem("dashboardRole", sessionRole);
      } catch {}
    }
  }, [session, status]);

  return (
    <ThemeProvider>
      <div className="flex h-screen overflow-hidden">
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 md:relative md:translate-x-0",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <DashboardSidebar role={role} onCloseMobile={() => setMobileOpen(false)} />
        </div>
        <main className="flex flex-1 flex-col overflow-hidden">
          <DashboardTopNav onToggleMobile={() => setMobileOpen((v) => !v)} />
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </main>
      </div>
    </ThemeProvider>
  );
}
