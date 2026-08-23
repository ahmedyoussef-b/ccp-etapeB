"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

export default function ChefDeBlocDashboard() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Espace Chef de Bloc
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Supervisez les blocs, coordonnez les équipes et suivez les procédures globales.
          </p>
        </div>
        <Link href="/creer-procedure">
          <Button size="sm">+ Nouvelle procédure</Button>
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Blocs supervisés</div>
          <div className="mt-2 text-2xl font-bold text-foreground">3</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Chefs de quart</div>
          <div className="mt-2 text-2xl font-bold text-foreground">6</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Taux de conformité</div>
          <div className="mt-2 text-2xl font-bold text-foreground">94.1%</div>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-base font-semibold text-foreground">Vue par bloc</h2>
          <div className="mt-4 space-y-4">
            {["Bloc A - Entrée", "Bloc B - Production", "Bloc C - Stockage"].map((bloc) => (
              <div key={bloc} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{bloc}</p>
                  <p className="text-xs text-muted-foreground">1 chef de quart · 4 procédures</p>
                </div>
                <Badge variant="secondary">Opérationnel</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-semibold text-foreground">Alertes et incidents</h2>
          <Separator className="my-4" />
          <div className="space-y-4">
            {[
              { title: "Incident résolu", detail: "Bloc B - accès refusé", time: "14:20" },
              { title: "Alerte maintenance", detail: "Bloc C - planning", time: "11:05" },
              { title: "Rapport généré", detail: "Point quotidien", time: "09:00" },
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
