"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TProcedure } from "@/lib/procedures/services/validator.service";
import { ProcedureGuide } from "@/components/procedures/execution/ProcedureGuide";
import { AlertTriangle, FileText } from "lucide-react";

interface ProcedureGuidePageClientProps {
  id: string;
}

export function ProcedureGuidePageClient({ id }: ProcedureGuidePageClientProps) {
  const [procedure, setProcedure] = useState<TProcedure | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProcedure = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/procedures/guide/${encodeURIComponent(id)}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Procédure introuvable.");
        }
        if (res.status === 403) {
          throw new Error("Accès refusé. Vous n'avez pas les permissions pour consulter cette procédure.");
        }
        throw new Error(`Erreur lors du chargement de la procédure (code: ${res.status}).`);
      }
      const data = (await res.json()) as TProcedure;
      setProcedure(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProcedure();
  }, [loadProcedure]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-2xl space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !procedure) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg font-medium text-foreground">{error || "Procédure introuvable"}</p>
        <p className="text-sm text-muted-foreground mt-1">
          Vérifiez l&apos;identifiant de la procédure ou importez un nouveau fichier JSON.
        </p>
        <Button
          variant="outline"
          className="mt-4 gap-2"
          onClick={() => (window.location.href = "/guide-procedure")}
        >
          <FileText className="h-4 w-4" />
          Retour aux guides
        </Button>
      </div>
    );
  }

  return <ProcedureGuide procedure={procedure} onClose={() => (window.location.href = "/guide-procedure")} />;
}
