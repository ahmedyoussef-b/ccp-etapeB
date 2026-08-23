"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

export default function ChefDeQuartDashboard() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Espace Chef de Quart
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gérez votre quart, les procédures et l&apos;équipe sous votre responsabilité.
          </p>
        </div>
        <Link href="/creer-procedure">
          <Button size="sm">+ Nouvelle procédure</Button>
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Procédures actives</div>
          <div className="mt-2 text-2xl font-bold text-foreground">14</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Exécutions ce mois</div>
          <div className="mt-2 text-2xl font-bold text-foreground">312</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Taux de succès</div>
          <div className="mt-2 text-2xl font-bold text-foreground">97.4%</div>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-base font-semibold text-foreground">Procédures du quart</h2>
          <div className="mt-4 space-y-4">
            {["Ronde matinale", "Contrôle accès", "Point de sécurité"].map((name) => (
              <div key={name} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{name}</p>
                  <p className="text-xs text-muted-foreground">Dernière exécution : il y a 2h</p>
                </div>
                <Badge variant="default">Actif</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-semibold text-foreground">Activité récente</h2>
          <Separator className="my-4" />
          <div className="space-y-4">
            {[
              { title: "Procédure exécutée", detail: "Ronde matinaire", time: "06:00" },
              { title: "Alerte déclenchée", detail: "Accès zone B", time: "05:45" },
              { title: "Membre ajouté", detail: "Rondier Dupont", time: "Hier" },
            ].map((item) => (
              <div key={item.title} className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
                <span className="text-xs text-muted-foreground">{item.time}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
