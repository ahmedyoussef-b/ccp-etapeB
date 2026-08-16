"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { csrfFetch } from "@/lib/procedures/csrf-fetch";
import { getClientUser } from "@/lib/procedures/client-auth";
import {
  FileText,
  Clock,
  User,
  Calendar,
  MessageSquare,
  Send,
  Check,
  X,
  ListFilter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";

const APPROVAL_ROLES = ["admin", "chef-de-quart"];

const statusLabels: Record<string, string> = {
  draft: "Brouillon",
  submitted: "Soumis",
  approved: "Approuvé",
  rejected: "Rejeté",
};

const statusBadgeColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-yellow-500/10 text-yellow-700 border border-yellow-500/20",
  approved: "bg-green-500/10 text-green-700 border border-green-500/20",
  rejected: "bg-destructive/10 text-destructive border border-destructive/20",
};

const approvalStatusColors: Record<string, string> = {
  approved: "bg-green-500/10 text-green-700",
  rejected: "bg-destructive/10 text-destructive",
  pending: "bg-yellow-500/10 text-yellow-700",
};

interface Procedure {
  id: number;
  code: string;
  title: string;
  description: string | null;
  status: string;
  category: string;
  priority: string;
  approverId: string | null;
  approverName: string | null;
  reviewDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ApprovalRecord {
  id: number;
  procedureId: number;
  procedure: {
    code: string;
    title: string;
    status: string;
  };
  approverId: string;
  approverName: string;
  approverRole: string;
  status: string;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

type FilterMode = "all" | "pending";

export default function ApprovalsPage() {
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [actionComments, setActionComments] = useState<Record<number, string>>({});
  const [actionStates, setActionStates] = useState<Record<number, "idle" | "approve" | "reject">>({});
  const [submitting, setSubmitting] = useState<Record<number, boolean>>({});

  const currentUser = getClientUser();
  const currentUserRole =
    currentUser?.role ||
    (typeof window !== "undefined"
      ? window.sessionStorage.getItem("dashboardRole") || "rondier"
      : "rondier");
  const currentUserName =
    typeof window !== "undefined"
      ? localStorage.getItem("nexaflow_user_name") || currentUserRole
      : currentUserRole;
  const canApprove = APPROVAL_ROLES.includes(currentUserRole);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [proceduresRes, approvalsRes] = await Promise.all([
        fetch("/api/procedures/guide"),
        fetch("/api/procedures/approvals"),
      ]);

      if (proceduresRes.ok) {
        const data = await proceduresRes.json();
        setProcedures(Array.isArray(data) ? data : []);
      }

      if (approvalsRes.ok) {
        const data = await approvalsRes.json();
        setApprovals(Array.isArray(data) ? data : []);
      }
    } catch {
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getApprovalsForProcedure = (procedureId: number) => {
    return approvals.filter((a) => a.procedureId === procedureId);
  };

  const handleAction = async (procedure: Procedure, action: "submit" | "approve" | "reject") => {
    if (!canApprove && action !== "submit") {
      toast.error("Vous n'avez pas les droits pour cette action");
      return;
    }

    if (action !== "submit" && !actionComments[procedure.id]?.trim()) {
      toast.error("Un commentaire est requis pour cette action");
      return;
    }

    setSubmitting((prev) => ({ ...prev, [procedure.id]: true }));
    try {
      const res = await csrfFetch("/api/procedures/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: procedure.code,
          action,
          approverId: currentUserRole,
          approverName: currentUserName,
          approverRole: currentUserRole,
          comment: actionComments[procedure.id] || "",
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || error.message || "Action échouée");
      }

      const data = await res.json();

      setProcedures((prev) =>
        prev.map((p) => (p.id === procedure.id ? { ...p, ...data } : p))
      );

      const approvalsRes = await fetch("/api/procedures/approvals");
      if (approvalsRes.ok) {
        const data = await approvalsRes.json();
        setApprovals(Array.isArray(data) ? data : []);
      }

      setActionComments((prev) => ({ ...prev, [procedure.id]: "" }));
      setActionStates((prev) => ({ ...prev, [procedure.id]: "idle" }));

      const actionLabel =
        action === "submit" ? "soumise" : action === "approve" ? "approuvée" : "rejetée";
      toast.success(`Procédure ${actionLabel} avec succès`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'action");
    } finally {
      setSubmitting((prev) => ({ ...prev, [procedure.id]: false }));
    }
  };

  const toggleExpand = (procedureId: number) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(procedureId)) {
        next.delete(procedureId);
      } else {
        next.add(procedureId);
      }
      return next;
    });
  };

  const filteredProcedures = procedures.filter((p) => {
    if (filter === "pending") {
      return p.status === "submitted";
    }
    return true;
  });

  const pendingCount = procedures.filter((p) => p.status === "submitted").length;

  return (
    <section className="py-8 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Workflow d&apos;approbation
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gérez les soumissions, approbations et rejets de procédures.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Rafraîchir
          </Button>
        </div>

        <div className="flex items-center gap-2 mb-6">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
            className="gap-1.5"
          >
            <ListFilter className="h-3.5 w-3.5" />
            Toutes ({procedures.length})
          </Button>
          <Button
            variant={filter === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("pending")}
            className="gap-1.5"
          >
            <Clock className="h-3.5 w-3.5" />
            En attente ({pendingCount})
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex-1">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-3 w-full mb-2" />
                <Skeleton className="h-3 w-2/3 mb-4" />
                <div className="flex gap-2 mb-4">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-3 w-full mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </Card>
            ))}
          </div>
        ) : filteredProcedures.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground">Aucune procédure trouvée</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              {filter === "pending"
                ? "Aucune procédure en attente d'approbation pour le moment."
                : "Aucune procédure disponible dans le système."}
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProcedures.map((procedure) => {
              const procedureApprovals = getApprovalsForProcedure(procedure.id);
              const isExpanded = expandedCards.has(procedure.id);
              const isSubmitting = submitting[procedure.id] === true;
              const actionState = actionStates[procedure.id];
              const comment = actionComments[procedure.id] || "";

              const canSubmit = procedure.status === "draft";
              const canApproveProcedure =
                procedure.status === "submitted" && canApprove;
              const isDone =
                procedure.status === "approved" ||
                procedure.status === "rejected";

              return (
                <Card
                  key={procedure.id}
                  className="p-5 transition-all hover:shadow-md flex flex-col"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-foreground truncate">
                        {procedure.title || "Procédure sans titre"}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                        {procedure.code || "—"}
                      </p>
                    </div>
                    <Badge
                      className={`text-xs ${statusBadgeColors[procedure.status] || ""}`}
                    >
                      {statusLabels[procedure.status] || procedure.status}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 mb-4 flex-1">
                    {procedure.description || "Aucune description."}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <Badge variant="outline" className="text-xs">
                      {procedure.category}
                    </Badge>
                    <Badge variant="secondary" className="text-xs capitalize">
                      {procedure.priority}
                    </Badge>
                    {procedure.status === "submitted" && canApprove && (
                      <Badge
                        variant="outline"
                        className="text-xs border-yellow-500/30 text-yellow-700"
                      >
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        En attente
                      </Badge>
                    )}
                  </div>

                  {procedureApprovals.length > 0 && (
                    <div className="mb-3">
                      <Separator className="mb-3" />
                      <button
                        onClick={() => toggleExpand(procedure.id)}
                        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-2"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                        Historique des approbations ({procedureApprovals.length})
                      </button>
                      {isExpanded && (
                        <div className="space-y-2">
                          {procedureApprovals.map((approval) => (
                            <div
                              key={approval.id}
                              className="rounded-lg border border-border bg-muted/30 p-3"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-xs font-medium text-foreground">
                                    {approval.approverName}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] h-4 px-1.5"
                                  >
                                    {approval.approverRole}
                                  </Badge>
                                </div>
                                <Badge
                                  className={`text-[10px] ${
                                    approvalStatusColors[approval.status] || ""
                                  }`}
                                >
                                  {approval.status === "approved"
                                    ? "Approuvé"
                                    : approval.status === "rejected"
                                    ? "Rejeté"
                                    : "En attente"}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(approval.createdAt).toLocaleDateString(
                                  "fr-FR",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </div>
                              {approval.comment && (
                                <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-background/50 rounded p-2 mt-1">
                                  <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                                  <span>{approval.comment}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <Separator className="mb-3" />

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(procedure.createdAt).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {canSubmit && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction(procedure, "submit")}
                          disabled={isSubmitting}
                          className="gap-1.5 text-xs"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Soumettre
                        </Button>
                      )}
                      {canApproveProcedure && (
                        <>
                          <Button
                            size="sm"
                            onClick={() =>
                              setActionStates((prev) => ({
                                ...prev,
                                [procedure.id]: "approve",
                              }))
                            }
                            disabled={isSubmitting}
                            className="gap-1.5 text-xs"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Approuver
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              setActionStates((prev) => ({
                                ...prev,
                                [procedure.id]: "reject",
                              }))
                            }
                            disabled={isSubmitting}
                            className="gap-1.5 text-xs"
                          >
                            <X className="h-3.5 w-3.5" />
                            Rejeter
                          </Button>
                        </>
                      )}
                      {isDone && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          {procedure.status === "approved" ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-green-600" />
                              Approuvé
                            </>
                          ) : (
                            <>
                              <X className="h-3.5 w-3.5 text-destructive" />
                              Rejeté
                            </>
                          )}
                          {procedure.reviewDate && (
                            <span className="text-muted-foreground/70">
                              le{" "}
                              {new Date(procedure.reviewDate).toLocaleDateString(
                                "fr-FR"
                              )}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {(actionState === "approve" || actionState === "reject") && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <Textarea
                        placeholder={
                          actionState === "approve"
                            ? "Commentaire d'approbation (optionnel)..."
                            : "Motif du rejet (requis)..."
                        }
                        value={comment}
                        onChange={(e) =>
                          setActionComments((prev) => ({
                            ...prev,
                            [procedure.id]: e.target.value,
                          }))
                        }
                        className="mb-2 text-xs"
                        rows={2}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            handleAction(procedure, actionState)
                          }
                          disabled={
                            isSubmitting ||
                            (actionState === "reject" && !comment.trim())
                          }
                          className="gap-1.5 text-xs"
                        >
                          {isSubmitting ? (
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          ) : actionState === "approve" ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                          {isSubmitting
                            ? "En cours..."
                            : actionState === "approve"
                            ? "Confirmer l'approbation"
                            : "Confirmer le rejet"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setActionStates((prev) => ({
                              ...prev,
                              [procedure.id]: "idle",
                            }))
                          }
                          disabled={isSubmitting}
                          className="text-xs"
                        >
                          Annuler
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
