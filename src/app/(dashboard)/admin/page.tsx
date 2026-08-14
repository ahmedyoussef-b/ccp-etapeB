"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Users, FileText, Activity, AlertTriangle } from "lucide-react";

export default function AdminDashboard() {
  const stats = [
    { title: "Utilisateurs", value: "1 248", change: "+12%", trend: "up", icon: Users },
    { title: "Procédures", value: "86", change: "+4%", trend: "up", icon: FileText },
    { title: "Workflows actifs", value: "324", change: "-2%", trend: "down", icon: Activity },
    { title: "Erreurs 24h", value: "7", change: "-18%", trend: "up", icon: AlertTriangle },
  ];

  const users = [
    { name: "Alice Martin", email: "alice@exemple.com", role: "Admin", status: "Actif" },
    { name: "Bob Dupont", email: "bob@exemple.com", role: "User", status: "Actif" },
    { name: "Claire Leroy", email: "claire@exemple.com", role: "User", status: "En attente" },
    { name: "David Moreau", email: "david@exemple.com", role: "User", status: "Actif" },
    { name: "Emma Petit", email: "emma@exemple.com", role: "User", status: "Inactif" },
  ];

  const logs = [
    { time: "14:32", action: "Nouveau workflow créé", user: "Alice Martin" },
    { time: "14:15", action: "Mise à jour des tarifs", user: "System" },
    { time: "13:58", action: "Suppression d'une procédure", user: "Bob Dupont" },
    { time: "13:40", action: "Connexion depuis Paris", user: "Claire Leroy" },
    { time: "12:22", action: "Déploiement terminé", user: "System" },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Administration
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Vue d&apos;ensemble de la plateforme NexaFlow.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => alert("Export en cours...")} className="rounded-xl">
            Exporter
          </Button>
          <Button size="sm" onClick={() => alert("Données rafraîchies")} className="rounded-xl shadow-sm">
            Rafraîchir
          </Button>
        </div>
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="relative overflow-hidden rounded-2xl border-border/60 p-6 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center justify-between">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <span className={cn("text-xs font-semibold", stat.trend === "up" ? "text-emerald-600" : "text-rose-600")}>
                  {stat.change}
                </span>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.title}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <div className="p-6 pb-4">
            <h2 className="text-lg font-semibold text-foreground">Utilisateurs récents</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="pb-3 pl-6 font-semibold text-muted-foreground">Nom</th>
                  <th className="pb-3 font-semibold text-muted-foreground">Email</th>
                  <th className="pb-3 font-semibold text-muted-foreground">Rôle</th>
                  <th className="pb-3 pr-6 font-semibold text-muted-foreground">Statut</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.email} className="border-b border-border/50 last:border-0 transition-colors hover:bg-muted/20">
                    <td className="py-3.5 pl-6 font-medium text-foreground">{user.name}</td>
                    <td className="py-3.5 text-muted-foreground">{user.email}</td>
                    <td className="py-3.5 text-muted-foreground">{user.role}</td>
                    <td className="py-3.5 pr-6">
                      <Badge
                        variant={
                          user.status === "Actif"
                            ? "default"
                            : user.status === "En attente"
                            ? "secondary"
                            : "outline"
                        }
                        className="rounded-lg"
                      >
                        {user.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="rounded-2xl border-border/60 shadow-sm">
          <div className="p-6 pb-4">
            <h2 className="text-lg font-semibold text-foreground">Activité système</h2>
          </div>
          <div className="p-6 pt-2 space-y-5">
            {logs.map((item) => (
              <div
                key={`${item.time}-${item.action}`}
                className="flex items-start justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{item.action}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.user}</p>
                </div>
                <span className="text-xs font-medium text-muted-foreground tabular-nums">{item.time}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
