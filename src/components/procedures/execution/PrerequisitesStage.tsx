"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { TProcedure } from "@/lib/procedures/services/validator.service";
import { proceduresFR } from "@/lib/i18n/procedures";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { ProcedurePrerequisite } from "@/lib/procedures/types";

interface PrerequisitesStageProps {
  procedure: TProcedure;
  onValidate: () => void;
}

function buildPrerequisites(procedure: TProcedure): ProcedurePrerequisite[] {
  const prerequisites: ProcedurePrerequisite[] = [];
  const { metadata, steps } = procedure;
  const firstStep = steps.sort((a, b) => a.order - b.order)[0];

  prerequisites.push({
    id: "pre_roles",
    label: "Habillations requises vérifiées",
    description: `Rôles nécessaires : ${metadata.requiredRoles.join(", ")}`,
    checked: false,
  });

  if (metadata.globalSafetyInstructions.length > 0) {
    prerequisites.push({
      id: "pre_safety",
      label: "Consignes de sécurité lues et comprises",
      description: `${metadata.globalSafetyInstructions.length} consigne(s) à valider.`,
      checked: false,
    });
  }

  if (firstStep) {
    if (firstStep.mediaRequirements.length > 0) {
      prerequisites.push({
        id: "pre_media",
        label: "Équipements de capture disponibles",
        description: `Médias requis : ${firstStep.mediaRequirements.map((m) => m.type).join(", ")}`,
        checked: false,
      });
    }

    if (firstStep.alarms.length > 0) {
      prerequisites.push({
        id: "pre_alarms",
        label: "Points d'alerte identifiés",
        description: `${firstStep.alarms.length} alerte(s) configurée(s) sur la première étape.`,
        checked: false,
      });
    }
  }

  if (metadata.estimatedTimeMinutes > 0) {
    prerequisites.push({
      id: "pre_time",
      label: "Temps disponible suffisant",
      description: `Durée estimée : ${metadata.estimatedTimeMinutes} minutes.`,
      checked: false,
    });
  }

  prerequisites.push({
    id: "pre_environment",
    label: "Environnement de travail sécurisé",
    description: "Vérifier l'éclairage, l'aération et l'accessibilité de la zone.",
    checked: false,
  });

  return prerequisites;
}

export function PrerequisitesStage({ procedure, onValidate }: PrerequisitesStageProps) {
  const [prerequisites, setPrerequisites] = useState<ProcedurePrerequisite[]>(() =>
    buildPrerequisites(procedure)
  );

  const allChecked = prerequisites.every((p) => p.checked);

  const toggle = (id: string) => {
    setPrerequisites((prev) =>
      prev.map((p) => (p.id === id ? { ...p, checked: !p.checked } : p))
    );
  };

  const validatedCount = prerequisites.filter((p) => p.checked).length;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border bg-card/50">
        <h2 className="text-base font-semibold text-foreground">
          {proceduresFR.guide.prerequisites.title}
        </h2>
      </div>

      <ScrollArea className="flex-1 p-4 sm:p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <Card className="p-5 sm:p-6 space-y-5">
            <p className="text-sm text-muted-foreground">
              {proceduresFR.guide.prerequisites.description}
            </p>

            <Separator />

            <div className="space-y-3">
              {prerequisites.map((prerequisite) => (
                <div
                  key={prerequisite.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors"
                >
                  <Checkbox
                    id={prerequisite.id}
                    checked={prerequisite.checked}
                    onCheckedChange={() => toggle(prerequisite.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <Label
                      htmlFor={prerequisite.id}
                      className="text-sm font-medium text-foreground cursor-pointer"
                    >
                      {prerequisite.label}
                    </Label>
                    {prerequisite.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {prerequisite.description}
                      </p>
                    )}
                  </div>
                  {prerequisite.checked && (
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  )}
                </div>
              ))}
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {validatedCount} / {prerequisites.length} validé(s)
              </span>
              <Button onClick={onValidate} disabled={!allChecked} className="gap-1.5">
                {allChecked ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                {proceduresFR.guide.prerequisites.validateButton}
              </Button>
            </div>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
