"use client";

import { useCallback } from "react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { GripVertical, Shield, Camera } from "lucide-react";
import { proceduresFR } from "@/lib/i18n/procedures";
import { TStep } from "@/lib/procedures/services/validator.service";

interface ProcedureTimelineProps {
  steps: TStep[];
  onStepClick: (stepId: string) => void;
  activeStepId?: string;
}

const stepTypeLabels: Record<string, string> = {
  consigne_simple: "Consigne",
  saisie_donnees: "Saisie",
  inspection_visuelle: "Inspection",
  validation_securite: "Sécurité",
  mesure_numerique: "Mesure",
};

export function ProcedureTimeline({
  steps,
  onStepClick,
  activeStepId,
}: ProcedureTimelineProps) {
  console.log("[CREER-PROCEDURE] ProcedureTimeline rendu. Étapes:", steps.length, "| Active:", activeStepId);
  const handleStepClick = useCallback(
    (stepId: string) => {
      console.log("[CREER-PROCEDURE] Timeline clic étape:", stepId);
      onStepClick(stepId);
    },
    [onStepClick]
  );

  if (steps.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">{proceduresFR.timeline.noSteps}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full pr-2">
      <div className="space-y-1">
        {steps.map((step, index) => {
          const isActive = step.id === activeStepId;
          const hasMedia = step.mediaRequirements.length > 0;
          const hasAlarms = step.alarms.length > 0;
          const isMandatory = step.isMandatory;

          return (
            <Card
              key={step.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-sm ${
                isActive
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card hover:bg-muted/50"
              }`}
              onClick={() => handleStepClick(step.id)}
            >
              <CardContent className="flex items-center gap-3 p-3">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div
                    className={`flex items-center justify-center w-7 h-7 rounded-full border-2 text-xs font-bold transition-colors ${
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30 bg-background text-muted-foreground"
                    }`}
                  >
                    {index + 1}
                  </div>
                  {index < steps.length - 1 && (
                    <div className="w-0.5 h-4 bg-border mt-1" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${
                      isActive ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {step.title || `Étape ${index + 1}`}
                  </p>
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    {isMandatory && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        Obligatoire
                      </Badge>
                    )}
                    {hasMedia && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                        <Camera className="h-2.5 w-2.5" />
                        Média
                      </Badge>
                    )}
                    {hasAlarms && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                        <Shield className="h-2.5 w-2.5" />
                        Alerte
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {stepTypeLabels[step.type] || step.type}
                    </span>
                  </div>
                </div>

                <GripVertical className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
}