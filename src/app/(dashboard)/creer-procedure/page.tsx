"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateProcedureForm } from "@/components/creer-procedure-form";

export default function CreerProcedurePage() {
  return (
    <section className="py-6 sm:py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Badge variant="secondary" className="mb-3">
            Assistant Procédure
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Créer une procédure
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Configurez les métadonnées, les étapes et les règles de sécurité de votre procédure opérationnelle.
          </p>
        </div>

        <Card className="overflow-hidden border shadow-sm">
          <CreateProcedureForm />
        </Card>
      </div>
    </section>
  );
}