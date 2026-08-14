"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, HelpCircle, FileText, MessageSquare, BookOpen, Image, Database, Video, BarChart3, Users, ClipboardList, Bot, Sun, Moon, GitBranch } from "lucide-react";
import { NexaFlowLogo } from "@/components/brand/nexaflow-logo";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, roles: ["admin"] },
  { href: "/chef-de-quart", label: "Mon espace", icon: LayoutDashboard, roles: ["chef-de-quart"] },
  { href: "/chef-de-bloc", label: "Mon espace", icon: LayoutDashboard, roles: ["chef-de-bloc"] },
  { href: "/rondier", label: "Mon espace", icon: LayoutDashboard, roles: ["rondier"] },
  { href: "/pipeline", label: "Pipeline", icon: GitBranch, roles: ["admin"] },
  { href: "/q-r", label: "Q/R", icon: HelpCircle, roles: ["admin"] },
  { href: "/actions-ia", label: "Actions IA", icon: Bot, roles: ["admin"] },
  { href: "/creer-procedure", label: "Créer une procédure", icon: FileText, roles: ["admin", "chef-de-quart"] },
  { href: "/guide-procedure", label: "Guide procédure", icon: BookOpen, roles: ["admin", "chef-de-quart", "chef-de-bloc", "rondier"] },
  { href: "/structure-bdd", label: "Structure BDD", icon: Database, roles: ["admin"] },
  { href: "/images", label: "Banque d'images", icon: Image, roles: ["admin"] },
  { href: "/video-conference", label: "Visioconférence", icon: Video, roles: ["admin", "chef-de-quart", "chef-de-bloc", "rondier"] },
  { href: "/rapports", label: "Rapports", icon: BarChart3, roles: ["admin", "chef-de-quart"] },
  { href: "/equipes", label: "Équipes", icon: Users, roles: ["admin", "chef-de-quart"] },
  { href: "/etat-des-lieux", label: "État des lieux", icon: ClipboardList, roles: ["admin", "chef-de-quart", "chef-de-bloc", "rondier"] },
  { href: "/chat-ia", label: "Chat IA", icon: MessageSquare, roles: ["admin", "chef-de-quart", "chef-de-bloc", "rondier"] },
];

export function DashboardSidebar({ role }: { role: "admin" | "chef-de-quart" | "chef-de-bloc" | "rondier" }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const items = navItems.filter((item) => item.roles.includes(role));

  const isActive = (href: string) => pathname === href || (href !== "/admin" && href !== "/chef-de-quart" && href !== "/chef-de-bloc" && href !== "/rondier" && pathname.startsWith(href));

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-sidebar">
      <div className="flex h-16 items-center gap-3 border-b border-border px-5">
        <NexaFlowLogo className="h-9 w-9" />
        <span className="text-lg font-semibold tracking-tight text-sidebar-foreground">NexaFlow</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4 transition-colors", active ? "text-primary" : "text-sidebar-foreground/60")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 rounded-xl"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? "Mode clair" : "Mode sombre"}
        </Button>
      </div>
    </aside>
  );
}
