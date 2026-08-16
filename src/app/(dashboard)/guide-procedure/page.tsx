"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  getProcedures,
  importProcedure,
  syncToServer,
} from "@/lib/procedures/services/procedure-manager.service";
import { csrfFetch } from "@/lib/procedures/csrf-fetch";
import { TProcedure } from "@/lib/procedures/services/validator.service";
import {
  FileText,
  Upload,
  Play,
  Clock,
  ListChecks,
  Tag,
  ShieldAlert,
  Trash2,
  Plus,
} from "lucide-react";

const priorityColors: Record<string, string> = {
  basse: "bg-green-500/10 text-green-700 border-green-500/20",
  moyenne: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  haute: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  critique: "bg-destructive/10 text-destructive border-destructive/20",
};

const categoryLabels: Record<string, string> = {
  production: "Production",
  maintenance: "Maintenance",
  securite: "Sécurité",
  qualite: "Qualité",
  logistique: "Logistique",
  environnement: "Environnement",
};

export default function GuideProcedurePage() {
  const router = useRouter();
  const [procedures, setProcedures] = useState<TProcedure[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProcedures(getProcedures());
  }, []);

  const handleImport = useCallback(async () => {
    const input = fileInputRef.current;
    if (!input || !input.files?.length) return;
    const file = input.files[0];
    setIsImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      importProcedure(parsed);
      setProcedures(getProcedures());
      toast.success("Procédure importée avec succès");

      syncToServer(parsed)
        .then((result) => {
          if (result.success) {
            if (result.offline) {
              toast.info("Procédure sauvegardée localement (serveur indisponible)");
            } else {
              toast.success("Procédure synchronisée sur le serveur");
            }
          } else {
            toast.error("Échec de la synchronisation serveur (données locales conservées)");
          }
        })
        .catch(() => {
          toast.error("Échec de la synchronisation serveur (données locales conservées)");
        });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "JSON invalide");
    } finally {
      setIsImporting(false);
      if (input) input.value = "";
    }
  }, []);

  const handleStartGuide = useCallback((procedure: TProcedure) => {
    router.push(`/procedures/guide/${encodeURIComponent(procedure.metadata.code)}`);
  }, [router]);

  const handleDeleteProcedure = useCallback(
    async (code: string) => {
      try {
        const res = await csrfFetch(`/api/procedures/guide/${encodeURIComponent(code)}`, {
          method: "DELETE",
        });
        if (res.ok) {
          const stored = getProcedures().filter((p) => p.metadata.code !== code);
          localStorage.setItem("nexaflow_procedures", JSON.stringify(stored));
          setProcedures(stored);
          toast.success("Procédure supprimée");
        } else if (res.status === 404) {
          const stored = getProcedures().filter((p) => p.metadata.code !== code);
          localStorage.setItem("nexaflow_procedures", JSON.stringify(stored));
          setProcedures(stored);
          toast.success("Procédure supprimée du guide local");
        } else {
          toast.error("Impossible de supprimer la procédure");
        }
      } catch {
        const stored = getProcedures().filter((p) => p.metadata.code !== code);
        localStorage.setItem("nexaflow_procedures", JSON.stringify(stored));
        setProcedures(stored);
        toast.success("Procédure supprimée du guide local");
      }
    },
    []
  );

  return (
    <section className="py-8 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Guides de procédures
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Importez vos procédures JSON et lancez l&apos;accompagnement vocal étape par étape.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleImport}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="gap-1.5"
            >
              {isImporting ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {isImporting ? "Import..." : "Importer JSON"}
            </Button>
            <Button size="sm" onClick={() => (window.location.href = "/creer-procedure")} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Créer une procédure
            </Button>
          </div>
        </div>

        {procedures.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground">Aucune procédure disponible</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Importez un fichier JSON exporté depuis le constructeur de procédures pour commencer l&apos;accompagnement guidé.
            </p>
            <Button
              variant="outline"
              className="mt-4 gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
            >
              <Upload className="h-4 w-4" />
              Importer une procédure
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {procedures.map((procedure) => {
              const stepCount = procedure.steps.length;
              const estimatedTime = procedure.metadata.estimatedTimeMinutes || 0;
              const category = categoryLabels[procedure.metadata.category] || procedure.metadata.category;
              const priority = priorityColors[procedure.metadata.priority] || "";

              return (
                <Card key={procedure.metadata.code} className="p-5 transition-all hover:shadow-md flex flex-col">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-foreground truncate">
                        {procedure.metadata.title || "Procédure sans titre"}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                        {procedure.metadata.code || "—"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteProcedure(procedure.metadata.code)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 mb-4 flex-1">
                    {procedure.metadata.description || "Aucune description."}
                  </p>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            {category && (
              <Badge variant="outline" className="text-xs gap-1">
                <Tag className="h-3 w-3" />
                {category}
              </Badge>
            )}
            {procedure.metadata.priority && (
              <Badge variant="secondary" className={`text-xs ${priority}`}>
                {procedure.metadata.priority}
              </Badge>
            )}
            {(procedure as TProcedure & { approvalStatus?: string }).approvalStatus && (
              <Badge
                variant={
                  (procedure as TProcedure & { approvalStatus?: string }).approvalStatus === "approved"
                    ? "default"
                    : (procedure as TProcedure & { approvalStatus?: string }).approvalStatus === "rejected"
                    ? "destructive"
                    : "secondary"
                }
                className="text-xs"
              >
                {(procedure as TProcedure & { approvalStatus?: string }).approvalStatus}
              </Badge>
            )}
          </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ListChecks className="h-3.5 w-3.5" />
                        {stepCount} étape{stepCount !== 1 ? "s" : ""}
                      </span>
                      {estimatedTime > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {estimatedTime} min
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleStartGuide(procedure)}
                      className="gap-1.5"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Démarrer le guide
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <Separator className="my-12" />

        <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Comment ça marche ?
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Importez le JSON de votre procédure et l&apos;IA vous guide pas à pas avec accompagnement vocal.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => (window.location.href = "/guide-procedure")}
                className="gap-1.5"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                Guide méthode
              </Button>
              <Button
                size="sm"
                onClick={() => (window.location.href = "/creer-procedure")}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Créer une procédure
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
