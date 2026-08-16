"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Pencil, Trash2, RefreshCw, Upload } from "lucide-react";
import { qrService } from "@/lib/qr/mock-service";
import type { QAPairWithRegistry } from "@/lib/qr/server-store";

export default function QAPage() {
  const [items, setItems] = useState<QAPairWithRegistry[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await qrService.getAll();
      setItems(data);
    } catch {
      toast.error("Erreur lors du chargement des Q/R");
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
      const created = await qrService.create({
        question: question.trim(),
        answer: answer.trim(),
      });
      setItems([created, ...items]);
      toast.success("Q/R ajoutée avec succès");
      resetForm();
    } catch {
      toast.error("Erreur lors de l'ajout");
    }
  };

  const handleEdit = (item: QAPairWithRegistry) => {
    setQuestion(item.question);
    setAnswer(item.answer);
    setEditingId(item.id);
  };

  const handleUpdate = async () => {
    if (editingId === null) return;
    if (!question.trim() || !answer.trim()) return;
    try {
      const updated = await qrService.update(editingId, {
        question: question.trim(),
        answer: answer.trim(),
      });
      setItems(items.map((i) => (i.id === editingId ? updated : i)));
      toast.success("Q/R modifiée");
      resetForm();
    } catch {
      toast.error("Erreur lors de la modification");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette Q/R ?")) return;
    try {
      await qrService.delete(id);
      setItems(items.filter((i) => i.id !== id));
      toast.success("Q/R supprimée");
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleClear = async () => {
    if (!confirm("Tout vider de la base web ?")) return;
    try {
      await Promise.all(items.map((i) => qrService.delete(i.id)));
      setItems([]);
      toast.success("Toutes les Q/R ont été supprimées");
    } catch {
      toast.error("Erreur");
    }
  };

  const handleSend = async () => {
    if (!question.trim() || !answer.trim()) {
      toast.error("Remplissez la question et la réponse");
      return;
    }
    setSending(true);
    try {
      console.log("[Q/R] handleSend: creating pair in BDD...");
      const created = await qrService.create({
        question: question.trim(),
        answer: answer.trim(),
      });
      console.log("[Q/R] handleSend: pair created, id =", created.id);
      setItems([created, ...items]);

      console.log("[Q/R] handleSend: exporting JSON to items/...");
      const data = await qrService.send({
        question: question.trim(),
        answer: answer.trim(),
      });
      console.log("[Q/R] handleSend: exported as", data.filename);
      toast.success(`Q/R collectée dans ${data.filename}`);
      resetForm();
    } catch (err) {
      console.error("[Q/R] handleSend error:", err);
      toast.error(`Erreur d'export: ${err instanceof Error ? err.message : String(err)}`);
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
                  onChange={(e) => setQuestion(e.target.value)}
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
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Tapez la réponse correspondante..."
                  autoComplete="off"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <Button type="submit" className="flex-1">
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
                onClick={handleSend}
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
    </section>
  );
}
