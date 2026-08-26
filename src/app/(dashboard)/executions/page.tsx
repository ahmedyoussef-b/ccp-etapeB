"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Play,
  Clock,
  FileText,
  Download,
  Search,
  X,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  User,
  ShieldAlert,
  Timer,
  Camera,
  ChevronRight,
  CalendarDays,
} from "lucide-react";

type GuidePhase = "briefing" | "prerequisites" | "executing" | "completed" | "aborted";

interface ExecutionStep {
  id: number;
  executionId: number;
  stepId: string;
  stepOrder: number;
  title: string;
  type: string;
  isMandatory: boolean;
  isCompleted: boolean;
  timerEnabled: boolean;
  timerSeconds: number;
  startedAt: string | null;
  finishedAt: string | null;
  anomaly: string | null;
}

interface ExecutionMedia {
  id: number;
  executionId: number;
  stepId: string;
  type: string;
  url: string | null;
  filename: string | null;
  mimeType: string | null;
  size: number | null;
  timestamp: string;
  capturedAt: string;
}

interface ProcedureExecution {
  id: number;
  procedureId: number;
  procedure: {
    id: number;
    code: string;
    title: string;
  } | null;
  userId: string | null;
  userName: string | null;
  userRole: string | null;
  phase: GuidePhase;
  currentStepIndex: number;
  completedSteps: string[];
  startedAt: string;
  finishedAt: string | null;
  anomalies: string[];
  globalElapsed: number;
  steps: ExecutionStep[];
  media: ExecutionMedia[];
}

const phaseConfig: Record<GuidePhase, { label: string; icon: typeof Play; className: string }> = {
  briefing: { label: "Briefing", icon: FileText, className: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
  prerequisites: { label: "Prérequis", icon: ShieldAlert, className: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  executing: { label: "En cours", icon: Clock, className: "bg-purple-500/10 text-purple-700 border-purple-500/20" },
  completed: { label: "Terminé", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  aborted: { label: "Abandonné", icon: XCircle, className: "bg-destructive/10 text-destructive border-destructive/20" },
};

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return "—";
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatStepDuration(started: string | null, finished: string | null): string {
  if (!started) return "—";
  const s = new Date(started);
  const f = finished ? new Date(finished) : new Date();
  const diff = f.getTime() - s.getTime();
  return formatDuration(diff);
}

function formatMediaSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}

export default function ExecutionsPage() {
  const [executions, setExecutions] = useState<ProcedureExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExecution, setSelectedExecution] = useState<ProcedureExecution | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchExecutions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/procedures/executions");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = (await res.json()) as ProcedureExecution[];
      setExecutions(data);
    } catch {
      toast.error("Échec du chargement des exécutions");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExecutions();
  }, [fetchExecutions]);

  const filteredExecutions = useMemo(() => {
    return executions.filter((exec) => {
      if (phaseFilter !== "all" && exec.phase !== phaseFilter) return false;

      if (dateFrom) {
        const from = new Date(dateFrom);
        const started = new Date(exec.startedAt);
        if (started < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        const started = new Date(exec.startedAt);
        if (started > to) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const code = exec.procedure?.code?.toLowerCase() || "";
        const title = exec.procedure?.title?.toLowerCase() || "";
        const user = (exec.userName || exec.userId || "").toLowerCase();
        if (!code.includes(q) && !title.includes(q) && !user.includes(q)) return false;
      }

      return true;
    });
  }, [executions, searchQuery, phaseFilter, dateFrom, dateTo]);

  const openDetail = useCallback(async (exec: ProcedureExecution) => {
    setIsDetailLoading(true);
    try {
      const res = await fetch(`/api/procedures/executions/${exec.id}`);
      if (!res.ok) throw new Error("Failed to fetch detail");
      const data = (await res.json()) as ProcedureExecution;
      setSelectedExecution(data);
    } catch {
      toast.error("Échec du chargement du détail");
      setSelectedExecution(exec);
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  const handleExport = useCallback(
    (exec: ProcedureExecution) => {
      const payload = {
        execution: {
          id: exec.id,
          procedure: exec.procedure,
          user: { id: exec.userId, name: exec.userName, role: exec.userRole },
          phase: exec.phase,
          startedAt: exec.startedAt,
          finishedAt: exec.finishedAt,
          durationMs: exec.globalElapsed,
          anomalies: exec.anomalies,
          completedSteps: exec.completedSteps,
        },
        steps: exec.steps.map((s) => ({
          id: s.id,
          stepId: s.stepId,
          order: s.stepOrder,
          title: s.title,
          type: s.type,
          isMandatory: s.isMandatory,
          isCompleted: s.isCompleted,
          startedAt: s.startedAt,
          finishedAt: s.finishedAt,
          durationMs: s.startedAt && s.finishedAt ? new Date(s.finishedAt).getTime() - new Date(s.startedAt).getTime() : null,
          anomaly: s.anomaly,
        })),
        media: exec.media.map((m) => ({
          id: m.id,
          stepId: m.stepId,
          type: m.type,
          filename: m.filename,
          mimeType: m.mimeType,
          size: m.size,
          url: m.url,
          capturedAt: m.capturedAt,
        })),
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `execution-${exec.id}-${new Date(exec.startedAt).toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Export JSON téléchargé");
    },
    []
  );

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setPhaseFilter("all");
    setDateFrom("");
    setDateTo("");
  }, []);

  const hasActiveFilters = searchQuery.trim() !== "" || phaseFilter !== "all" || dateFrom !== "" || dateTo !== "";

  const stats = useMemo(() => {
    const total = executions.length;
    const completed = executions.filter((e) => e.phase === "completed").length;
    const aborted = executions.filter((e) => e.phase === "aborted").length;
    const totalAnomalies = executions.reduce((acc, e) => acc + e.anomalies.length, 0);
    return { total, completed, aborted, totalAnomalies };
  }, [executions]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Historique des exécutions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Consultez et analysez l&apos;historique complet des exécutions de procédures.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Play className="h-3.5 w-3.5" />
            {stats.total} exécution{stats.total !== 1 ? "s" : ""}
          </Badge>
          <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {stats.completed} terminée{stats.completed !== 1 ? "s" : ""}
          </Badge>
          {stats.totalAnomalies > 0 && (
            <Badge variant="outline" className="gap-1 border-destructive/30 text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              {stats.totalAnomalies} anomalie{stats.totalAnomalies !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4" />
            Filtres
          </CardTitle>
          <CardDescription>Recherchez par code, utilisateur, phase ou date.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="sm:col-span-2 lg:col-span-1">
              <Label htmlFor="search" className="sr-only">
                Recherche
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Code, titre, utilisateur..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-8 text-sm"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="phase" className="sr-only">
                Phase
              </Label>
              <select
                id="phase"
                value={phaseFilter}
                onChange={(e) => setPhaseFilter(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-3 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
              >
                <option value="all">Toutes les phases</option>
                <option value="briefing">Briefing</option>
                <option value="prerequisites">Prérequis</option>
                <option value="executing">En cours</option>
                <option value="completed">Terminé</option>
                <option value="aborted">Abandonné</option>
              </select>
            </div>
            <div>
              <Label htmlFor="date-from" className="sr-only">
                Du
              </Label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="pl-9 h-8 text-sm"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="date-to" className="sr-only">
                Au
              </Label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="pl-9 h-8 text-sm"
                />
              </div>
            </div>
            {hasActiveFilters && (
              <div className="flex items-end">
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 gap-1.5 text-muted-foreground">
                  <X className="h-3.5 w-3.5" />
                  Réinitialiser
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Chargement des exécutions...</p>
          </div>
        ) : filteredExecutions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">
              {executions.length === 0 ? "Aucune exécution enregistrée" : "Aucun résultat pour ces filtres"}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {executions.length === 0
                ? "Les exécutions apparaîtront ici une fois qu&apos;une procédure aura été guidée."
                : "Essayez de modifier vos critères de recherche."}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">
                Réinitialiser les filtres
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    Procédure
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    Utilisateur
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    Phase
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    Début
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    Durée
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    Anomalies
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredExecutions.map((exec) => {
                  const phaseInfo = phaseConfig[exec.phase] || phaseConfig.briefing;
                  const PhaseIcon = phaseInfo.icon;
                  const hasAnomalies = exec.anomalies.length > 0;

                  return (
                    <tr
                      key={exec.id}
                      className="hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => openDetail(exec)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{exec.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-foreground truncate max-w-[200px]">
                            {exec.procedure?.title || `Procédure #${exec.procedureId}`}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {exec.procedure?.code || `—`}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-foreground flex items-center gap-1.5">
                            <User className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="truncate max-w-[140px]">
                              {exec.userName || exec.userId || "—"}
                            </span>
                          </span>
                          {exec.userRole && (
                            <span className="text-xs text-muted-foreground capitalize">{exec.userRole}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-xs gap-1 ${phaseInfo.className}`}>
                          <PhaseIcon className="h-3 w-3" />
                          {phaseInfo.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(exec.startedAt)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {exec.finishedAt ? formatDuration(exec.globalElapsed) : "En cours"}
                      </td>
                      <td className="px-4 py-3">
                        {hasAnomalies ? (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {exec.anomalies.length}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                       <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                         <div className="flex items-center gap-1">
                           <Button
                             variant="ghost"
                             size="icon"
                             className="h-9 w-9"
                             onClick={() => openDetail(exec)}
                             title="Voir le détail"
                           >
                             <ChevronRight className="h-4 w-4" />
                           </Button>
                           <Button
                             variant="ghost"
                             size="icon"
                             className="h-9 w-9"
                             onClick={() => handleExport(exec)}
                             title="Exporter JSON"
                           >
                             <Download className="h-4 w-4" />
                           </Button>
                         </div>
                       </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!selectedExecution} onOpenChange={(open) => { if (!open) setSelectedExecution(null); }}>
        <DialogContent className="max-w-3xl!">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              Détail de l&apos;exécution #{selectedExecution?.id}
              {selectedExecution && (
                <Badge
                  variant="outline"
                  className={`text-xs gap-1 ${phaseConfig[selectedExecution.phase]?.className || ""}`}
                >
                  {(() => {
                    const PhaseIcon = phaseConfig[selectedExecution.phase]?.icon || FileText;
                    return <PhaseIcon className="h-3 w-3" />;
                  })()}
                  {phaseConfig[selectedExecution.phase]?.label || selectedExecution.phase}
                </Badge>
              )}
            </DialogTitle>
            {selectedExecution && (
              <DialogDescription>
                {selectedExecution.procedure?.code && <span className="font-mono">{selectedExecution.procedure.code}</span>}
                {selectedExecution.procedure?.code && selectedExecution.procedure?.title && <span> — </span>}
                {selectedExecution.procedure?.title && <span>{selectedExecution.procedure.title}</span>}
                {selectedExecution.userName && (
                  <span className="ml-2">
                    par <span className="font-medium">{selectedExecution.userName}</span>
                    {selectedExecution.userRole && <span className="text-muted-foreground"> ({selectedExecution.userRole})</span>}
                  </span>
                )}
              </DialogDescription>
            )}
          </DialogHeader>
          <DialogBody>
            {isDetailLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : selectedExecution ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Début</p>
                    <p className="text-sm font-medium text-foreground">{formatDateTime(selectedExecution.startedAt)}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Fin</p>
                    <p className="text-sm font-medium text-foreground">{formatDateTime(selectedExecution.finishedAt)}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Durée totale</p>
                    <p className="text-sm font-medium text-foreground flex items-center gap-1">
                      <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                      {selectedExecution.finishedAt ? formatDuration(selectedExecution.globalElapsed) : "En cours"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Étapes complétées</p>
                    <p className="text-sm font-medium text-foreground">
                      {selectedExecution.steps.filter((s) => s.isCompleted).length}/{selectedExecution.steps.length}
                    </p>
                  </div>
                </div>

                {selectedExecution.anomalies.length > 0 && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                    <h4 className="text-sm font-semibold text-destructive flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4" />
                      Anomalies ({selectedExecution.anomalies.length})
                    </h4>
                    <ul className="space-y-1">
                      {selectedExecution.anomalies.map((anomaly, idx) => (
                        <li key={idx} className="text-sm text-destructive/80 flex items-start gap-2">
                          <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          {anomaly}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Separator />

                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Déroulement étape par étape
                  </h4>
                  {selectedExecution.steps.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Aucune étape enregistrée.</p>
                  ) : (
                    <ScrollArea className="max-h-[300px]">
                      <div className="space-y-2 pr-2">
                        {selectedExecution.steps
                          .slice()
                          .sort((a, b) => a.stepOrder - b.stepOrder)
                          .map((step) => (
                            <div
                              key={step.id}
                              className={`rounded-lg border p-3 transition-colors ${
                                step.anomaly
                                  ? "border-destructive/30 bg-destructive/5"
                                  : step.isCompleted
                                  ? "border-emerald-500/20 bg-emerald-500/5"
                                  : "border-border bg-muted/20"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-mono text-muted-foreground">
                                      #{step.stepOrder}
                                    </span>
                                    <span className="text-sm font-medium text-foreground truncate">
                                      {step.title}
                                    </span>
                                    {step.isMandatory && (
                                      <Badge variant="secondary" className="text-[10px] px-1.5 h-4">
                                        Obligatoire
                                      </Badge>
                                    )}
                                    {step.anomaly && (
                                      <Badge variant="destructive" className="text-[10px] px-1.5 h-4 gap-0.5">
                                        <AlertTriangle className="h-2.5 w-2.5" />
                                        Anomalie
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <CalendarDays className="h-3 w-3" />
                                      {formatDateTime(step.startedAt)}
                                    </span>
                                    {step.isCompleted && step.finishedAt && (
                                      <span className="flex items-center gap-1">
                                        <Timer className="h-3 w-3" />
                                        {formatStepDuration(step.startedAt, step.finishedAt)}
                                      </span>
                                    )}
                                    {step.timerEnabled && (
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        Minuteur: {step.timerSeconds}s
                                      </span>
                                    )}
                                    <span className="capitalize">{step.type}</span>
                                  </div>
                                  {step.anomaly && (
                                    <p className="text-xs text-destructive mt-1.5">{step.anomaly}</p>
                                  )}
                                </div>
                                <div className="shrink-0">
                                  {step.isCompleted ? (
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                  ) : (
                                    <XCircle className="h-5 w-5 text-muted-foreground" />
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>

                {selectedExecution.media.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Camera className="h-4 w-4 text-muted-foreground" />
                        Captures média ({selectedExecution.media.length})
                      </h4>
                      <ScrollArea className="max-h-[200px]">
                        <div className="space-y-2 pr-2">
                          {selectedExecution.media
                            .slice()
                            .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())
                            .map((media) => (
                              <div
                                key={media.id}
                                className="flex items-center justify-between rounded-lg border border-border p-3"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Camera className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="text-sm text-foreground truncate">
                                      {media.filename || media.type}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                                    <span>{media.type}</span>
                                    {media.mimeType && <span>{media.mimeType}</span>}
                                    {formatMediaSize(media.size)}
                                    <span>{formatDateTime(media.capturedAt)}</span>
                                    <span className="font-mono">étape: {media.stepId}</span>
                                  </div>
                                </div>
                                {media.url && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="shrink-0 h-7 gap-1.5"
                                    onClick={() => window.open(media.url!, "_blank")}
                                  >
                                    Ouvrir
                                  </Button>
                                )}
                              </div>
                            ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedExecution(null)}>
              Fermer
            </Button>
            {selectedExecution && (
              <Button onClick={() => handleExport(selectedExecution)} className="gap-1.5">
                <Download className="h-4 w-4" />
                Exporter JSON
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
