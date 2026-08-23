"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Pencil, Trash2, RefreshCw, Upload, Loader2, Copy, Search, X, MessageCircle, BookOpen, Layers, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QAPairWithRegistry } from "@/lib/qr/client-store";
import { csrfFetch } from "@/lib/procedures/csrf-fetch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { VoiceGuidedInput } from "@/components/ui/voice-guided-input";

export default function QAPage() {
  const [items, setItems] = useState<QAPairWithRegistry[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [importing, setImporting] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportFilename, setExportFilename] = useState("");
  const [sendMode, setSendMode] = useState<"all" | "selected">("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [registryFilter, setRegistryFilter] = useState<string>("all");
  const [previewData, setPreviewData] = useState<{ id: string; question: string; answer: string }[] | null>(null);
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [rawJsonPreview, setRawJsonPreview] = useState<string>("");
  const lastQuestionRef = useRef("");
  const lastAnswerRef = useRef("");
  const importFileRef = useRef<HTMLInputElement>(null);
  const isResettingImportRef = useRef(false);
  const deletedItemRef = useRef<QAPairWithRegistry | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/qr");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.pairs);
    } catch (err: unknown) {
      console.error("[Q/R] loadItems error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleAdd = useCallback(async () => {
    if (!question.trim() || !answer.trim()) return;
    setIsAdding(true);
    try {
      const res = await csrfFetch("/api/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim(), answer: answer.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json();
      setItems((prev) => [created, ...prev]);
      toast.success("Q/R ajoutée avec succès");
      resetForm();
    } catch (err: unknown) {
      console.error("[Q/R] handleAdd error:", err);
      toast.error("Erreur lors de l'ajout");
    } finally {
      setIsAdding(false);
    }
  }, [question, answer]);

  const handleEdit = (item: QAPairWithRegistry) => {
    setQuestion(item.question);
    setAnswer(item.answer);
    lastQuestionRef.current = item.question;
    lastAnswerRef.current = item.answer;
    setEditingId(item.id);
  };

  const handleUpdate = useCallback(async () => {
    if (editingId === null) {
      toast.error("Aucun élément sélectionné pour l'édition.");
      return;
    }
    if (!question.trim() || !answer.trim()) {
      toast.error("La question et la réponse ne peuvent pas être vides.");
      return;
    }
    setIsUpdating(true);
    try {
      const res = await csrfFetch(`/api/qr/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim(), answer: answer.trim() }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erreur serveur ${res.status}`);
      }
      const updated = await res.json();
      setItems((prev) => prev.map((i) => (i.id === editingId ? updated : i)));
      toast.success("Q/R modifiée avec succès");
      resetForm();
    } catch (err: unknown) {
      console.error("[Q/R] handleUpdate error:", err);
      toast.error(`Erreur: ${err instanceof Error ? err.message : "Échec de la modification"}`);
    } finally {
      setIsUpdating(false);
    }
  }, [editingId, question, answer]);

  const handleDelete = useCallback(async (id: number) => {
    if (!confirm("Supprimer cette Q/R ?")) return;
    try {
      const res = await csrfFetch(`/api/qr/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const deletedItem = items.find((i) => i.id === id) || null;
      deletedItemRef.current = deletedItem;

      setItems((prev) => prev.filter((i) => i.id !== id));

      toast.success("Q/R supprimée", {
        action: {
          label: "Annuler",
          onClick: () => {
            const item = deletedItemRef.current;
            if (item) {
              setItems((prev) => [item, ...prev]);
              toast.success("Q/R restaurée");
              deletedItemRef.current = null;
            }
          },
        },
      });
    } catch (err: unknown) {
      console.error("[Q/R] handleDelete error:", err);
      toast.error("Erreur lors de la suppression");
    }
  }, [items]);

  const handleDuplicate = async (item: QAPairWithRegistry) => {
    try {
      const res = await csrfFetch("/api/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: item.question, answer: item.answer }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json();
      setItems((prev) => [created, ...prev]);
      toast.success("Q/R dupliquée avec succès");
    } catch (err: unknown) {
      console.error("[Q/R] handleDuplicate error:", err);
      toast.error("Erreur lors de la duplication");
    }
  };

  const handleClear = async () => {
    if (!confirm("Tout vider de la base web ?")) return;
    try {
      await Promise.all(
        items.map((i) => csrfFetch(`/api/qr/${i.id}`, { method: "DELETE" }))
      );
      setItems([]);
      setSelectedIds(new Set());
      toast.success("Toutes les Q/R ont été supprimées");
    } catch (err: unknown) {
      console.error("[Q/R] handleClear error:", err);
      toast.error("Erreur");
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = async (index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newItems = [...items];
    const [moved] = newItems.splice(dragIndex, 1);
    newItems.splice(index, 0, moved);

    const reordered = newItems.map((item, idx) => ({
      ...item,
      order: idx,
    }));

    setItems(reordered);
    setDragIndex(null);
    setDragOverIndex(null);

    try {
      await csrfFetch("/api/qr/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairs: reordered.map((p) => ({ id: p.id, order: p.order })) }),
      });
      toast.success("Ordre mis à jour");
    } catch {
      setItems(items);
      toast.error("Erreur lors de la mise à jour de l'ordre");
    }
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const filteredItems = items.filter((item) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query ||
      item.question.toLowerCase().includes(query) ||
      item.answer.toLowerCase().includes(query) ||
      item.registry?.title.toLowerCase().includes(query);
    const matchesRegistry = registryFilter === "all" || item.registry?.title === registryFilter;
    return matchesSearch && matchesRegistry;
  });

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? <mark key={i} className="rounded bg-yellow-200 px-0.5 text-foreground dark:bg-yellow-900/60">{part}</mark>
        : part
    );
  };

  const registries = Array.from(new Set(items.map((i) => i.registry?.title).filter(Boolean))) as string[];

  const handleSendSelectedClick = async () => {
    if (selectedIds.size === 0) {
      toast.error("Aucune Q/R sélectionnée");
      return;
    }
    setSendMode("selected");
    const defaultName = `export_qr_selected_${new Date().toISOString().split('T')[0]}`;
    setExportFilename(defaultName);
    setIsExportDialogOpen(true);
  };

  const handleSendClick = () => {
    if (items.length === 0) {
      toast.error("Aucune Q/R à envoyer");
      return;
    }
    setSendMode("all");
    const defaultName = `export_qr_${new Date().toISOString().split('T')[0]}`;
    setExportFilename(defaultName);
    setIsExportDialogOpen(true);
  };

  const handleSendConfirm = async () => {
    setIsExportDialogOpen(false);

    const finalFilename = exportFilename.trim() || `export_qr_${new Date().toISOString().split('T')[0]}`;
    const itemsToSend = sendMode === "selected" ? items.filter((i) => selectedIds.has(i.id)) : items;

    setSending(true);
    try {
      console.log(`[Q/R Send] calling POST /api/qr/export for ${itemsToSend.length} items`);
      const res = await csrfFetch("/api/qr/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: finalFilename,
          items: itemsToSend.map((i) => ({ question: i.question, answer: i.answer })),
          title: finalFilename,
        }),
      });
      const data = await res.json();
      console.log("[Q/R Send] response:", { ok: res.ok, status: res.status, filename: data.filename });
      if (!res.ok) {
        throw new Error(data.error || "Export failed");
      }
      toast.success(`${itemsToSend.length} Q/R collectée(s) dans ${data.filename}`);
      if (sendMode === "selected") {
        setSelectedIds(new Set());
      }
      loadItems();
    } catch (err: unknown) {
      console.error("[Q/R Send] ERROR:", err);
      toast.error(`Erreur: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSending(false);
    }
  };

  const resetForm = () => {
    setQuestion("");
    setAnswer("");
    setEditingId(null);
  };

  const cancelEdit = useCallback(() => {
    setQuestion(lastQuestionRef.current);
    setAnswer(lastAnswerRef.current);
    setEditingId(null);
  }, []);

  const handleImportJson = async () => {
    const file = importFileRef.current?.files?.[0];
    console.log("[Q/R import] file selected:", file?.name, "size:", file?.size);
    if (!file || isResettingImportRef.current) {
      console.log("[Q/R import] aborted: no file or resetting");
      return;
    }

    setImporting(true);
    try {
      const text = await file.text();
      console.log("[Q/R import] raw text length:", text.length);
      const data = JSON.parse(text);
      console.log("[Q/R import] parsed type:", Array.isArray(data) ? "array" : typeof data, "keys:", Array.isArray(data) ? undefined : Object.keys(data as Record<string, unknown>));

      const { pairs, errors: normalizationErrors } = normalizeJsonToPairs(data);
      const errors = [...normalizationErrors];
      console.log("[Q/R import] normalized pairs:", pairs.length, "errors:", errors);

      if (pairs.length === 0 && errors.length > 0) {
        console.log("[Q/R import] opening raw preview because format not recognized");
        setRawJsonPreview(JSON.stringify(data, null, 2));
        setPreviewData(null);
        setPreviewErrors([]);
        setIsPreviewDialogOpen(true);
        return;
      }

      const validItems = extractValidPairs(pairs, errors);
      console.log("[Q/R import] valid items:", validItems.length);

      if (validItems.length === 0 && pairs.length > 0) {
        console.log("[Q/R import] opening raw preview because no valid items");
        setRawJsonPreview(JSON.stringify(data, null, 2));
        setPreviewData(null);
        setPreviewErrors(errors);
        setIsPreviewDialogOpen(true);
        return;
      }

      if (validItems.length === 0) {
        console.log("[Q/R import] no valid items at all");
        toast.error("Aucune paire Q/R valide trouvée dans le fichier");
        return;
      }

      setPreviewData(validItems.map((item, idx) => ({ ...item, id: `preview-${Date.now()}-${idx}` })));
      setPreviewErrors(errors);
      console.log("[Q/R import] opening preview dialog with valid items");
      setIsPreviewDialogOpen(true);
      console.log("[Q/R import] after setIsPreviewDialogOpen(true)");
    } catch (err: unknown) {
      console.error("[Q/R] import error:", err);
      toast.error(`Erreur: ${err instanceof Error ? err.message : "Import impossible"}`);
    } finally {
      console.log("[Q/R import] finally block running, importing:", false, "isPreviewDialogOpen:", isPreviewDialogOpen);
      setImporting(false);
      isResettingImportRef.current = true;
      if (importFileRef.current) {
        importFileRef.current.value = "";
      }
      setTimeout(() => {
        isResettingImportRef.current = false;
      }, 0);
    }
  };

  const resetImport = () => {
    console.log("[Q/R import] resetImport called");
    console.log(new Error("resetImport stack trace").stack);
    setPreviewData(null);
    setPreviewErrors([]);
    setIsPreviewDialogOpen(false);
    setRawJsonPreview("");
    isResettingImportRef.current = true;
    if (importFileRef.current) {
      importFileRef.current.value = "";
    }
    setTimeout(() => {
      isResettingImportRef.current = false;
    }, 0);
  };

  const confirmImport = async () => {
    console.log("[Q/R import] confirmImport called, previewData length:", previewData?.length ?? 0);
    if (!previewData) return;
    setIsPreviewDialogOpen(false);
    setImporting(true);
    try {
      const validItems = previewData.filter((item) => item.question.trim() && item.answer.trim());
      let count = 0;
      for (const item of validItems) {
        const res = await csrfFetch("/api/qr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: item.question.trim(), answer: item.answer.trim() }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `HTTP ${res.status}`);
        }
        count++;
      }
      toast.success(`${count} paire(s) Q/R importée(s) dans la base web`);
      setPreviewData(null);
      setPreviewErrors([]);
      setRawJsonPreview("");
      await loadItems();
    } catch (err: unknown) {
      console.error("[Q/R] confirmImport error:", err);
      toast.error(`Erreur: ${err instanceof Error ? err.message : "Import impossible"}`);
    } finally {
      setImporting(false);
    }
  };

  const updatePreviewItem = (id: string, field: "question" | "answer", value: string) => {
    setPreviewData((prev) => {
      if (!prev) return null;
      return prev.map((item) => (item.id === id ? { ...item, [field]: value } : item));
    });
  };

  const removePreviewItem = (id: string) => {
    setPreviewData((prev) => {
      if (!prev) return null;
      return prev.filter((item) => item.id !== id);
    });
  };

  const addPreviewItem = () => {
    setPreviewData((prev) => {
      if (!prev) return null;
      return [...prev, { id: `preview-${Date.now()}-${prev.length}`, question: "", answer: "" }];
    });
  };

  const normalizeJsonToPairs = (data: unknown): { pairs: unknown[]; errors: string[] } => {
    const errors: string[] = [];
    let normalized: unknown[] = [];

    if (Array.isArray(data)) {
      normalized = data;
    } else if (Array.isArray((data as Record<string, unknown>)?.items)) {
      normalized = (data as Record<string, unknown>).items as unknown[];
    } else if (Array.isArray((data as Record<string, unknown>)?.pairs)) {
      normalized = (data as Record<string, unknown>).pairs as unknown[];
    } else if (Array.isArray((data as Record<string, unknown>)?.data)) {
      normalized = (data as Record<string, unknown>).data as unknown[];
    } else if (Array.isArray((data as Record<string, unknown>)?.qa)) {
      normalized = (data as Record<string, unknown>).qa as unknown[];
    } else if (Array.isArray((data as Record<string, unknown>)?.results)) {
      normalized = (data as Record<string, unknown>).results as unknown[];
    } else if (Array.isArray((data as Record<string, unknown>)?.records)) {
      normalized = (data as Record<string, unknown>).records as unknown[];
    } else if (
      typeof data === "object" &&
      data !== null &&
      typeof (data as Record<string, unknown>).question === "string" &&
      typeof (data as Record<string, unknown>).answer === "string"
    ) {
      normalized = [data];
    } else if (typeof data === "object" && data !== null) {
      const firstArray = Object.values(data as Record<string, unknown>).find(Array.isArray);
      if (firstArray) {
        normalized = firstArray as unknown[];
      }
    }

    console.log("[Q/R import] normalizeJsonToPairs result:", {
      type: Array.isArray(data) ? "array" : typeof data,
      keys: typeof data === "object" && data !== null ? Object.keys(data as Record<string, unknown>) : [],
      normalizedLength: normalized.length,
      sample: typeof data === "object" && data !== null ? JSON.stringify(data).slice(0, 500) : String(data).slice(0, 500),
    });

    if (normalized.length === 0) {
      errors.push("Format non reconnu. Utilisez un tableau de { question, answer } ou un objet avec items/pairs/data/qa/results/records.");
    }

    return { pairs: normalized, errors };
  };

  const extractValidPairs = (pairs: unknown[], errors: string[]) => {
    const validItems: { question: string; answer: string }[] = [];
    pairs.forEach((item: unknown, index: number) => {
      if (typeof item !== "object" || item === null) {
        errors.push(`Ligne ${index + 1}: format invalide (objet attendu)`);
        return;
      }
      const obj = item as Record<string, unknown>;
      const q = typeof obj.question === "string" ? obj.question.trim() : "";
      const a = typeof obj.answer === "string" ? obj.answer.trim() : "";
      if (!q) errors.push(`Ligne ${index + 1}: question manquante ou vide`);
      if (!a) errors.push(`Ligne ${index + 1}: réponse manquante ou vide`);
      if (q && a) validItems.push({ question: q, answer: a });
    });
    return validItems;
  };

  const reparseRawJson = () => {
    console.log("[Q/R import] reparseRawJson clicked, raw length:", rawJsonPreview.length);
    try {
      const data = JSON.parse(rawJsonPreview);
      console.log("[Q/R import] reparse parsed type:", Array.isArray(data) ? "array" : typeof data);
      const { pairs, errors: normalizationErrors } = normalizeJsonToPairs(data);
      const errors = [...normalizationErrors];

      if (pairs.length === 0 && errors.length > 0) {
        toast.error(errors[0]);
        return;
      }

      const validItems = extractValidPairs(pairs, errors);

      if (validItems.length === 0) {
        toast.error("Aucune paire Q/R valide trouvée");
        return;
      }

      setPreviewData(validItems.map((item, idx) => ({ ...item, id: `preview-${Date.now()}-${idx}` })));
      setPreviewErrors(errors);
      setRawJsonPreview("");
      toast.success(`Prévisualisation : ${validItems.length} Q/R détectée(s)`);
    } catch (err: unknown) {
      console.error("[Q/R] reparse error:", err);
      toast.error(`JSON invalide : ${err instanceof Error ? err.message : "Erreur de parsing"}`);
    }
  };

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (editingId !== null) {
      handleUpdate();
    } else {
      handleAdd();
    }
  }, [editingId, handleUpdate, handleAdd]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.ctrlKey || e.metaKey;
      if (isMeta && e.key === "Enter") {
        e.preventDefault();
        handleSubmit(e as unknown as React.FormEvent);
      }
      if (e.key === "Escape" && editingId !== null) {
        e.preventDefault();
        cancelEdit();
      }
      if (isMeta && e.key === "n") {
        e.preventDefault();
        if (!editingId) {
          const qInput = document.getElementById("Question") as HTMLInputElement | null;
          qInput?.focus();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSubmit, editingId, cancelEdit]);

  useEffect(() => {
    console.log("[Q/R import] preview dialog state changed:", isPreviewDialogOpen, "previewData length:", previewData?.length ?? 0, "rawJsonPreview length:", rawJsonPreview.length);
  }, [isPreviewDialogOpen, previewData, rawJsonPreview]);

  const totalPairs = items.length;
  const selectedCount = selectedIds.size;
  const registryCount = registries.length;
  const filteredCount = filteredItems.length;

  return (
    <section className="q-r-page">
      <div className="q-r-bg-orbs">
        <div className="q-r-orb q-r-orb-1" />
        <div className="q-r-orb q-r-orb-2" />
        <div className="q-r-orb q-r-orb-3" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <header className="q-r-header">
          <div className="q-r-title-row">
            <div className="q-r-icon-badge">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Questions / Réponses
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Collectez et organisez vos paires Q/R pour alimenter la base de connaissances
              </p>
            </div>
          </div>
        </header>

        <div className="q-r-stats">
          <div className="q-r-stat-card">
            <div className="q-r-stat-icon q-r-stat-icon-blue">
              <Layers className="h-5 w-5" />
            </div>
            <div className="q-r-stat-value">{totalPairs}</div>
            <div className="q-r-stat-label">Paires totales</div>
          </div>
          <div className="q-r-stat-card">
            <div className="q-r-stat-icon q-r-stat-icon-purple">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="q-r-stat-value">{registryCount}</div>
            <div className="q-r-stat-label">Registres</div>
          </div>
          <div className="q-r-stat-card">
            <div className="q-r-stat-icon q-r-stat-icon-green">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="q-r-stat-value">{selectedCount}</div>
            <div className="q-r-stat-label">Sélectionnées</div>
          </div>
          <div className="q-r-stat-card">
            <div className="q-r-stat-icon q-r-stat-icon-orange">
              <Search className="h-5 w-5" />
            </div>
            <div className="q-r-stat-value">{filteredCount}</div>
            <div className="q-r-stat-label">Affichées</div>
          </div>
        </div>

        <div className="mt-8">
          <form
            onSubmit={handleSubmit}
            className={cn(
              "q-r-form-card",
              editingId !== null && "q-r-form-card-editing"
            )}
          >
            {editingId !== null && (
              <div className="q-r-editing-badge">
                <Badge variant="default" className="rounded-md px-2 py-0.5 text-xs">
                  Mode modification
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Q/R #{editingId}
                </span>
              </div>
            )}
            <div className="flex flex-col gap-5">
              <VoiceGuidedInput
                value={question}
                onChange={(val) => {
                  setQuestion(val);
                  lastQuestionRef.current = val;
                }}
                label="Question"
                placeholder="Tapez votre question ici..."
                mode="input"
                guidance="Veuillez saisir votre question. Vous pouvez utiliser le micro pour dicter."
                language="fr-FR"
                autoFocus={editingId !== null}
              />
              <VoiceGuidedInput
                value={answer}
                onChange={(val) => {
                  setAnswer(val);
                  lastAnswerRef.current = val;
                }}
                label="Réponse"
                placeholder="Tapez la réponse correspondante..."
                mode="textarea"
                guidance="Veuillez saisir la réponse correspondante. Utilisez le micro si besoin."
                language="fr-FR"
              />
              <div className="flex gap-3 pt-1">
                <Button type="button" className="q-r-btn-primary flex-1" onClick={handleSubmit} disabled={isAdding || isUpdating}>
                  {isAdding || isUpdating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {editingId !== null ? "Modification..." : "Ajout..."}
                    </>
                  ) : (
                    <>
                      <MessageCircle className="h-4 w-4 mr-2" />
                      {editingId !== null ? "Modifier la Q/R" : "Ajouter la Q/R"}
                    </>
                  )}
                </Button>
                {editingId !== null && (
                  <Button
                    type="button"
                    onClick={cancelEdit}
                    variant="outline"
                    className="flex-1"
                    disabled={isAdding || isUpdating}
                  >
                    Annuler
                  </Button>
                )}
              </div>
            </div>
          </form>
        </div>

        <div className="mt-10">
          <div className="q-r-section-header">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-foreground">
                Collecteur de Q/R
              </h2>
              <Badge variant="secondary" className="q-r-count-badge">
                {items.length}
              </Badge>
            </div>
            <div className="q-r-toolbar">
              <input
                ref={importFileRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImportJson}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-lg"
                onClick={() => importFileRef.current?.click()}
                disabled={importing}
              >
                <Upload className="h-4 w-4 mr-1.5" />
                {importing ? "Import..." : "Importer JSON"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-lg"
                onClick={loadItems}
                disabled={loading}
              >
                <RefreshCw className={cn("h-4 w-4 mr-1.5", loading && "animate-spin")} />
                Rafraîchir
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="rounded-lg"
                onClick={handleSendSelectedClick}
                disabled={sending || selectedIds.size === 0}
              >
                <Upload className="h-4 w-4 mr-1.5" />
                Envoyer ({selectedIds.size})
              </Button>
              <Button
                type="button"
                size="sm"
                className="rounded-lg"
                onClick={handleSendClick}
                disabled={sending || items.length === 0}
              >
                <Upload className="h-4 w-4 mr-1.5" />
                {sending ? "Envoi..." : "Tout envoyer"}
              </Button>
            </div>
          </div>

          <div className="mt-5">
            <div className="q-r-list-card">
              <div className="q-r-list-controls">
                <div className="flex flex-1 items-center gap-3">
                  <div className="q-r-search-box">
                    <Search className="h-4 w-4" />
                    <Input
                      type="text"
                      placeholder="Rechercher dans les Q/R..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="q-r-search-input"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="q-r-search-clear"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {registries.length > 0 && (
                    <select
                      value={registryFilter}
                      onChange={(e) => setRegistryFilter(e.target.value)}
                      className="q-r-registry-select"
                    >
                      <option value="all">Tous les registres</option>
                      {registries.map((registry) => (
                        <option key={registry} value={registry}>
                          {registry}
                        </option>
                      ))}
                    </select>
                  )}
                  <label className="q-r-checkbox-label">
                    <input
                      type="checkbox"
                      checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length}
                      onChange={() => {
                        if (selectedIds.size === filteredItems.length) {
                          setSelectedIds(new Set());
                        } else {
                          setSelectedIds(new Set(filteredItems.map((i) => i.id)));
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {selectedIds.size === 0
                        ? "Tout sélectionner"
                        : selectedIds.size === filteredItems.length
                          ? "Tout désélectionner"
                          : `${selectedIds.size} sélectionné(s)`}
                    </span>
                  </label>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-lg text-destructive hover:text-destructive"
                  onClick={handleClear}
                  disabled={items.length === 0}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Vider
                </Button>
              </div>

              {filteredItems.length === 0 ? (
                <div className="q-r-empty">
                  <div className="q-r-empty-icon">
                    <MessageCircle className="h-8 w-8" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {searchQuery ? "Aucun résultat trouvé" : "Aucune Q/R enregistrée"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {searchQuery
                      ? "Essayez de modifier votre recherche ou vos filtres."
                      : "Commencez par ajouter votre première paire question/réponse ci-dessus."}
                  </p>
                </div>
              ) : (
                <div className="q-r-items">
                  {filteredItems.map((item, index) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={() => handleDrop(index)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "q-r-item",
                        dragIndex === index && "q-r-item-dragging",
                        dragOverIndex === index && "q-r-item-dragover",
                        item.id === editingId && "q-r-item-editing"
                      )}
                    >
                      <div className="q-r-item-grip" title="Glisser pour réordonner">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                          <circle cx="9" cy="12" r="1" />
                          <circle cx="9" cy="5" r="1" />
                          <circle cx="9" cy="19" r="1" />
                          <circle cx="15" cy="12" r="1" />
                          <circle cx="15" cy="5" r="1" />
                          <circle cx="15" cy="19" r="1" />
                        </svg>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelection(item.id)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <div className="q-r-item-content">
                        <div className="q-r-item-q">
                          <span className="q-r-item-label">Q</span>
                          <span className="q-r-item-text">{highlightText(item.question, searchQuery)}</span>
                        </div>
                        <div className="q-r-item-a">
                          <span className="q-r-item-label">R</span>
                          <span className="q-r-item-text">{highlightText(item.answer, searchQuery)}</span>
                        </div>
                        {item.registry && (
                          <div className="q-r-item-registry">
                            <BookOpen className="h-3 w-3" />
                            <span>{highlightText(item.registry.title, searchQuery)}</span>
                          </div>
                        )}
                      </div>
                      <div className="q-r-item-actions">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(item)}
                          aria-label="Modifier"
                          disabled={isAdding || isUpdating}
                          className="h-8 w-8 rounded-lg"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDuplicate(item)}
                          aria-label="Dupliquer"
                          disabled={isAdding || isUpdating}
                          title="Dupliquer"
                          className="h-8 w-8 rounded-lg"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(item.id)}
                          aria-label="Supprimer"
                          disabled={isAdding || isUpdating}
                          className="h-8 w-8 rounded-lg text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {sendMode === "selected" ? "Exporter la sélection" : "Nom du fichier JSON"}
            </DialogTitle>
            <DialogDescription>
              {sendMode === "selected"
                ? `Vous allez exporter ${selectedIds.size} Q/R sélectionnée(s). Choisissez un nom pour le fichier.`
                : "Choisissez un nom pour votre fichier JSON. Si vous laissez le champ vide, un nom par défaut sera généré."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-2">
              <label htmlFor="filename" className="text-sm font-medium">Nom du fichier</label>
              <Input
                id="filename"
                value={exportFilename}
                onChange={(e) => setExportFilename(e.target.value)}
                placeholder="ex: mon_export_qr"
                autoFocus
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Annuler</Button>
            </DialogClose>
            <Button onClick={handleSendConfirm} disabled={sending}>
              {sending ? "Envoi..." : "Envoyer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPreviewDialogOpen} onOpenChange={(open) => {
        console.log("[Q/R import] Dialog onOpenChange called with:", open);
        console.trace("[Q/R import] onOpenChange stack trace");
        setIsPreviewDialogOpen(open);
        if (!open) {
          console.log("[Q/R import] Dialog closing via onOpenChange, resetting preview state");
          setPreviewData(null);
          setPreviewErrors([]);
          setRawJsonPreview("");
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Aperçu de l&apos;importation</DialogTitle>
            <DialogDescription>
              {previewData ? `${previewData.length} paire(s) Q/R détectée(s)` : "Aucune donnée"}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {previewErrors.length > 0 && (
              <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3">
                <p className="text-sm font-medium text-destructive">Erreurs de validation</p>
                <ul className="mt-1 list-disc list-inside text-sm text-destructive">
                  {previewErrors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            {previewData && previewData.length > 0 ? (
              <div className="max-h-[400px] overflow-y-auto rounded-md border border-border">
                <div className="divide-y divide-border">
                  {previewData.map((item, i) => (
                    <div key={item.id} className="flex flex-col gap-2 p-3 hover:bg-muted/30">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">#{i + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removePreviewItem(item.id)}
                          className="h-6 w-6"
                          title="Supprimer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Input
                        value={item.question}
                        onChange={(e) => updatePreviewItem(item.id, "question", e.target.value)}
                        placeholder="Question"
                        className="text-sm"
                      />
                      <Input
                        value={item.answer}
                        onChange={(e) => updatePreviewItem(item.id, "answer", e.target.value)}
                        placeholder="Réponse"
                        className="text-sm"
                      />
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPreviewItem}
                    className="w-full"
                  >
                    Ajouter une ligne
                  </Button>
                </div>
              </div>
            ) : rawJsonPreview ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  Le format JSON n&apos;a pas été reconnu automatiquement. Vous pouvez corriger le contenu ci-dessous, puis cliquer sur &quot;Tenter de parser&quot;.
                </p>
                <textarea
                  value={rawJsonPreview}
                  onChange={(e) => setRawJsonPreview(e.target.value)}
                  className="min-h-[300px] w-full rounded-md border border-border bg-transparent p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  spellCheck={false}
                />
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => {
                    console.log("[Q/R import] Tenter de parser button clicked");
                    reparseRawJson();
                  }}
                  className="self-end"
                >
                  Tenter de parser
                </Button>
              </div>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" onClick={() => {
                console.log("[Q/R import] Annuler button clicked");
                resetImport();
              }}>Annuler</Button>
            </DialogClose>
            <Button onClick={() => {
              console.log("[Q/R import] Importer button clicked");
              confirmImport();
            }} disabled={importing || !previewData || previewData.length === 0}>
              {importing ? "Importation..." : `Importer ${previewData?.length ?? 0} Q/R`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
