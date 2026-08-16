"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TProcedure } from "@/lib/procedures/services/validator.service";
import { ProcedureExecutionContext } from "@/lib/procedures/types";
import { proceduresFR } from "@/lib/i18n/procedures";
import { CheckCircle2, Clock, FileText, AlertTriangle, XCircle } from "lucide-react";

interface CompletedStageProps {
  procedure: TProcedure;
  context: ProcedureExecutionContext;
  executionId?: string | null;
  onClose: () => void;
}

interface ExecutionSummary {
  id: number;
  phase: string;
  startedAt: string;
  finishedAt?: string;
  anomalies: string[];
  globalElapsed: number;
  steps: Array<{
    id: number;
    stepId: string;
    title: string;
    type: string;
    isCompleted: boolean;
    anomaly?: string;
  }>;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins} min ${secs} s`;
}

export function CompletedStage({ procedure, context, executionId, onClose }: CompletedStageProps) {
  const [summary, setSummary] = useState<ExecutionSummary | null>(null);

  useEffect(() => {
    if (!executionId) return;
    const numericId = parseInt(executionId);
    if (Number.isNaN(numericId)) return;

    fetch(`/api/procedures/executions/${numericId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.id) setSummary(data);
      })
      .catch(() => {});
  }, [executionId]);

  const totalDuration = summary?.globalElapsed
    ? summary.globalElapsed
    : context.finishedAt
      ? Math.round((context.finishedAt - context.startedAt) / 1000)
      : Math.round((Date.now() - context.startedAt) / 1000);

  const anomalies = summary?.anomalies?.length ? summary.anomalies : context.anomalies;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border bg-card/50">
        <h2 className="text-base font-semibold text-foreground">
          {proceduresFR.guide.completed.title}
        </h2>
      </div>

      <ScrollArea className="flex-1 p-4 sm:p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <Card className="p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {procedure.metadata.title || "Procédure sans titre"}
                </h3>
                <p className="text-xs text-muted-foreground font-mono">
                  {procedure.metadata.code}
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {proceduresFR.guide.completed.duration}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatDuration(totalDuration)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {proceduresFR.guide.completed.completedSteps}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {context.completedSteps.size} / {procedure.steps.length}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Code</p>
                  <p className="text-sm font-semibold text-foreground font-mono">
                    {procedure.metadata.code}
                  </p>
                </div>
              </div>
            </div>

            {executionId && (
              <div className="text-xs text-muted-foreground font-mono">
                Execution ID: {executionId}
              </div>
            )}

            {anomalies.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    {proceduresFR.guide.completed.anomalies}
                  </p>
                  <ul className="space-y-1.5">
                    {anomalies.map((anomaly, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-foreground"
                      >
                        <XCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                        {anomaly}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button onClick={onClose} className="gap-1.5">
                {proceduresFR.guide.completed.closeButton}
              </Button>
            </div>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
