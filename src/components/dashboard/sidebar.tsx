// src/components/dashboard/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, HelpCircle, FileText, MessageSquare, BookOpen, Image, Database, Video, BarChart3, Users, ClipboardList, Bot, GitBranch, CheckCircle2, History, Sparkles, AlertTriangle, Monitor } from "lucide-react";
import { NexaFlowLogo } from "@/components/brand/nexaflow-logo";

// ✅ Détection de l'environnement
const isProduction = process.env.NODE_ENV === 'production';

const navItems = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, roles: ["admin"] },
  { href: "/chef-de-quart", label: "Mon espace", icon: LayoutDashboard, roles: ["chef-de-quart"] },
  { href: "/chef-de-bloc", label: "Mon espace", icon: LayoutDashboard, roles: ["chef-de-bloc"] },
  { href: "/rondier", label: "Mon espace", icon: LayoutDashboard, roles: ["rondier"] },
  // ✅ Pipeline visible UNIQUEMENT en développement
  { href: "/pipeline", label: "Pipeline", icon: GitBranch, roles: ["admin"], devOnly: true },
  { href: "/q-r", label: "Q/R", icon: HelpCircle, roles: ["admin"] },
  { href: "/actions-ia", label: "Actions IA", icon: Bot, roles: ["admin"] },
  { href: "/devices", label: "Périphériques", icon: Monitor, roles: ["admin"] },
  { href: "/alarmes-actives", label: "Alarmes actives", icon: AlertTriangle, roles: ["admin"] },
  { href: "/historique-iot", label: "Historique IoT", icon: History, roles: ["admin"] },
  { href: "/creer-procedure", label: "Créer une procédure", icon: FileText, roles: ["admin", "chef-de-quart"] },
  { href: "/guide-procedure", label: "Guide procédure", icon: BookOpen, roles: ["admin", "chef-de-quart", "chef-de-bloc", "rondier"] },
  { href: "/approvals", label: "Approbations", icon: CheckCircle2, roles: ["admin", "chef-de-quart"] },
  { href: "/executions", label: "Historique exécutions", icon: History, roles: ["admin", "chef-de-quart"] },
  { href: "/structure-bdd", label: "Structure BDD", icon: Database, roles: ["admin"] },
  { href: "/bdd", label: "BDD", icon: Database, roles: ["admin"] },
  { href: "/images", label: "Banque d'images", icon: Image, roles: ["admin"] },
  { href: "/video-conference", label: "Visioconférence", icon: Video, roles: ["admin", "chef-de-quart", "chef-de-bloc", "rondier"] },
  { href: "/rapports", label: "Rapports", icon: BarChart3, roles: ["admin", "chef-de-quart"] },
  { href: "/equipes", label: "Équipes", icon: Users, roles: ["admin", "chef-de-quart"] },
  { href: "/etat-des-lieux", label: "État des lieux", icon: ClipboardList, roles: ["admin", "chef-de-quart", "chef-de-bloc", "rondier"] },
  { href: "/chat-ia", label: "Chat IA", icon: MessageSquare, roles: ["admin", "chef-de-quart", "chef-de-bloc", "rondier"] },
  { href: "/ai-hub", label: "Centre IA", icon: Sparkles, roles: ["admin", "chef-de-quart", "chef-de-bloc", "rondier"] },
];

export function DashboardSidebar({ role, onCloseMobile }: { role: "admin" | "superviseur" | "chef-de-quart" | "chef-de-bloc" | "rondier"; onCloseMobile?: () => void }) {
  const pathname = usePathname();

  // ✅ Filtrer : rôle + masquer les éléments devOnly en production
  const items = navItems.filter((item) => {
    // Vérifier le rôle
    if (!item.roles.includes(role)) return false;
    // Masquer les éléments devOnly en production
    if (item.devOnly && isProduction) return false;
    return true;
  });

  const isActive = (href: string) => pathname === href || (href !== "/admin" && href !== "/chef-de-quart" && href !== "/chef-de-bloc" && href !== "/rondier" && pathname.startsWith(href));

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="flex h-16 items-center gap-3 border-b border-border px-5">
        <NexaFlowLogo className="h-9 w-9" />
        <span className="text-lg font-semibold tracking-tight text-sidebar-foreground">NexaFlow</span>
        {isProduction && (
          <span className="ml-auto text-xs font-medium text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
            Prod
          </span>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseMobile}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4 transition-colors", active ? "text-primary" : "text-sidebar-foreground/60")} />
              {item.label}
              {item.devOnly && !isProduction && (
                <span className="ml-auto text-[10px] font-medium text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                  DEV
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <div className="mt-2 text-xs text-muted-foreground/50 px-2 text-center">
          {isProduction ? "🔒 Production" : "🔧 Développement"} · v1.0
        </div>
      </div>
    </aside>
  );
}