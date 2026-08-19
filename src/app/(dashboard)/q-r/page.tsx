// src/app/(dashboard)/q-r/page.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Pencil, Trash2, RefreshCw, Upload } from "lucide-react";
import type { QAPairWithRegistry } from "@/lib/qr/client-store";
import { csrfFetch } from "@/lib/procedures/csrf-fetch"; // ✅ Ajout de l'import
import { clientEngine } from "@/lib/client-engine";
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

export default function QAPage() {
  const [items, setItems] = useState<QAPairWithRegistry[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [importing, setImporting] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportFilename, setExportFilename] = useState("");
  const lastQuestionRef = useRef("");
  const lastAnswerRef = useRef("");
  const importFileRef = useRef<HTMLInputElement>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      // ✅ GET - pas besoin de CSRF, on garde fetch standard
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

  const handleAdd = async () => {
    if (!question.trim() || !answer.trim()) return;
    try {
      // ✅ REMPLACÉ : fetch → csrfFetch
      const res = await csrfFetch("/api/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim(), answer: answer.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json();
      setItems([created, ...items]);
      toast.success("Q/R ajoutée avec succès");
      resetForm();
    } catch (err: unknown) {
      console.error("[Q/R] handleAdd error:", err);
      toast.error("Erreur lors de l'ajout");
    }
  };

  const handleEdit = (item: QAPairWithRegistry) => {
    setQuestion(item.question);
    setAnswer(item.answer);
    lastQuestionRef.current = item.question;
    lastAnswerRef.current = item.answer;
    setEditingId(item.id);
  };

  const handleUpdate = async () => {
    if (editingId === null) {
      toast.error("Aucun élément sélectionné pour l'édition.");
      return;
    }
    if (!question.trim() || !answer.trim()) {
      toast.error("La question et la réponse ne peuvent pas être vides.");
      return;
    }
    try {
      // ✅ REMPLACÉ : fetch → csrfFetch
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
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette Q/R ?")) return;
    try {
      // ✅ REMPLACÉ : fetch → csrfFetch
      const res = await csrfFetch(`/api/qr/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems(items.filter((i) => i.id !== id));
      toast.success("Q/R supprimée");
    } catch (err: unknown) {
      console.error("[Q/R] handleDelete error:", err);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleClear = async () => {
    if (!confirm("Tout vider de la base web ?")) return;
    try {
      // ✅ REMPLACÉ : fetch → csrfFetch pour chaque suppression
      await Promise.all(
        items.map((i) => csrfFetch(`/api/qr/${i.id}`, { method: "DELETE" }))
      );
      setItems([]);
      toast.success("Toutes les Q/R ont été supprimées");
    } catch (err: unknown) {
      console.error("[Q/R] handleClear error:", err);
      toast.error("Erreur");
    }
  };

  const handleSendClick = () => {
    if (items.length === 0) {
      toast.error("Aucune Q/R à envoyer");
      return;
    }
    const defaultName = `export_qr_${new Date().toISOString().split('T')[0]}`;
    setExportFilename(defaultName);
    setIsExportDialogOpen(true);
  };

  const handleSendConfirm = async () => {
    setIsExportDialogOpen(false);
    
    const finalFilename = exportFilename.trim() || `export_qr_${new Date().toISOString().split('T')[0]}`;

    setSending(true);
    try {
      console.log("[Q/R Send] calling POST /api/qr/export for all items");
      // ✅ REMPLACÉ : fetch → csrfFetch
      const res = await csrfFetch("/api/qr/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          filename: finalFilename,
          items: items.map(i => ({ question: i.question, answer: i.answer })),
          title: finalFilename
        }),
      });
      const data = await res.json();
      console.log("[Q/R Send] response:", { ok: res.ok, status: res.status, filename: data.filename });
      if (!res.ok) {
        throw new Error(data.error || "Export failed");
      }
      toast.success(`Q/R collectées dans ${data.filename}`);
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

  const cancelEdit = () => {
    resetForm();
  };

  const handleImportJson = async () => {
    const file = importFileRef.current?.files?.[0];
    if (!file) {
      toast.error("Veuillez sélectionner un fichier JSON");
      return;
    }

    setImporting(true);
    try {
      await clientEngine.init();
      const text = await file.text();
      const data = JSON.parse(text);

      if (!Array.isArray(data)) {
        throw new Error("Format attendu : tableau de { question, answer }");
      }

      let count = 0;
      for (const item of data) {
        const q = typeof item.question === "string" ? item.question.trim() : "";
        const a = typeof item.answer === "string" ? item.answer.trim() : "";
        if (q && a) {
          await clientEngine.createQAPair({ question: q, answer: a });
          count++;
        }
      }

      toast.success(`${count} paire(s) Q/R importée(s) dans la base locale`);
    } catch (err: unknown) {
      console.error("[Q/R] import error:", err);
      toast.error(`Erreur: ${err instanceof Error ? err.message : "Import impossible"}`);
    } finally {
      setImporting(false);
      if (importFileRef.current) {
        importFileRef.current.value = "";
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId !== null) {
      handleUpdate();
    } else {
      handleAdd();
    }
  };

  return (
    <section className="py-8 sm:py-10">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Questions / Réponses
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Collecte et gestion de paires Q/R connectées à la base de données web
          </p>
        </div>

        <div className="mt-8">
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="question"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Question
                </label>
                <Input
                  id="question"
                  value={question}
                  onChange={(e) => {
                    setQuestion(e.target.value);
                    lastQuestionRef.current = e.target.value;
                  }}
                  placeholder="Tapez votre question ici..."
                  autoComplete="off"
                />
              </div>
              <div>
                <label
                  htmlFor="answer"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Réponse
                </label>
                <Input
                  id="answer"
                  value={answer}
                  onChange={(e) => {
                    setAnswer(e.target.value);
                    lastAnswerRef.current = e.target.value;
                  }}
                  placeholder="Tapez la réponse correspondante..."
                  autoComplete="off"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <Button type="button" className="flex-1" onClick={handleSubmit}>
                  {editingId !== null ? "Modifier" : "Ajouter"}
                </Button>
                {editingId !== null && (
                  <Button
                    type="button"
                    onClick={cancelEdit}
                    variant="outline"
                    className="flex-1"
                  >
                    Annuler
                  </Button>
                )}
              </div>
            </div>
          </form>
        </div>

        <div className="mt-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-foreground">
                Collecteur de Q/R
              </h2>
              <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-xs">
                {items.length}
              </Badge>
            </div>
            <div className="flex gap-2">
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
                <Upload className="h-4 w-4 mr-1" />
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
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                Rafraîchir
              </Button>
              <Button
                type="button"
                size="sm"
                className="rounded-lg"
                onClick={handleSendClick}
                disabled={sending}
              >
                <Upload className="h-4 w-4 mr-1" />
                {sending ? "Envoi..." : "Envoyer"}
              </Button>
            </div>
          </div>

          <div className="mt-6">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-lg"
                  onClick={handleClear}
                  disabled={items.length === 0}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  vider
                </Button>
              </div>

              {items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center text-sm text-muted-foreground">
                  Aucune Q/R enregistrée pour le moment.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="group rounded-xl border border-border bg-card/60 p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/20"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 text-sm break-words leading-relaxed">
                          <span className="font-semibold text-foreground">{`{Q:`}</span>
                          <span className="mx-1 text-foreground">{item.question}</span>
                          <span className="text-foreground">{`; R:`}</span>
                          <span className="mx-1 text-muted-foreground">{item.answer}</span>
                          <span className="font-semibold text-foreground">{`}`}</span>
                          {item.registry && (
                            <span className="ml-2 inline-block text-xs text-muted-foreground/60">
                              — {item.registry.title}
                            </span>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(item)}
                            aria-label="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item.id)}
                            aria-label="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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
            <DialogTitle>Nom du fichier JSON</DialogTitle>
            <DialogDescription>
              Choisissez un nom pour votre fichier JSON. Si vous laissez ce champ vide, un nom par défaut sera généré.
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
    </section>
  );
}