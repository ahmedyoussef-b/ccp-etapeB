"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  ClipboardList,
  Video,
  BookOpen,
  Map,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

const quickActions = [
  {
    href: "/chat-ia",
    label: "Chat IA",
    description: "Assistant intelligent pour vos questions",
    icon: MessageSquare,
    color: "bg-primary/10 text-primary",
  },
  {
    href: "/etat-des-lieux",
    label: "État des lieux",
    description: "Points de contrôle et conformité",
    icon: ClipboardList,
    color: "bg-emerald-500/10 text-emerald-600",
  },
  {
    href: "/video-conference",
    label: "Visioconférence",
    description: "Appels et partage d'écran",
    icon: Video,
    color: "bg-blue-500/10 text-blue-600",
  },
  {
    href: "/guide-procedure",
    label: "Guide procédure",
    description: "Bonnes pratiques et étapes",
    icon: BookOpen,
    color: "bg-purple-500/10 text-purple-600",
  },
];

const todaysRounds = [
  { id: 1, name: "Ronde entrée principale", time: "06:00", status: "completed" },
  { id: 2, name: "Ronde zone B", time: "10:00", status: "completed" },
  { id: 3, name: "Ronde parking", time: "14:00", status: "pending" },
  { id: 4, name: "Ronde toiture", time: "18:00", status: "pending" },
];

const incidents = [
  { id: 1, title: "Porte défectueuse", detail: "Bloc A - accès 2", time: "13:15", severity: "medium" },
  { id: 2, title: "Éclairage absent", detail: "Parking niveau -1", time: "Hier", severity: "low" },
];

export default function RondierDashboard() {
  const completedRounds = todaysRounds.filter((r) => r.status === "completed").length;

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Espace Rondier
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Accédez rapidement à vos outils de rondier et suivez vos missions du jour.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.href} href={action.href}>
              <Card className="h-full cursor-pointer transition-all hover:shadow-md hover:border-primary/40">
                <div className="p-5">
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${action.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-foreground">{action.label}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Rondes du jour</h2>
            <Badge variant="secondary">
              {completedRounds}/{todaysRounds.length} terminées
            </Badge>
          </div>
          <div className="mt-4 space-y-3">
            {todaysRounds.map((ronde) => (
              <div key={ronde.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    ronde.status === "completed" ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
                  }`}>
                    {ronde.status === "completed" ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Map className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{ronde.name}</p>
                    <p className="text-xs text-muted-foreground">Planifiée à {ronde.time}</p>
                  </div>
                </div>
                <Badge variant={ronde.status === "completed" ? "default" : "outline"}>
                  {ronde.status === "completed" ? "Terminée" : "À faire"}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Incidents à signaler</h2>
            <Badge variant="destructive">{incidents.length} actif(s)</Badge>
          </div>
          <div className="mt-4 space-y-3">
            {incidents.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    item.severity === "medium" ? "bg-amber-500/10 text-amber-600" : "bg-muted text-muted-foreground"
                  }`}>
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                    <p className="text-xs text-muted-foreground mt-1">Signalé à {item.time}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => alert(`Signalement de: ${item.title}`)}>
                  Signaler
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
