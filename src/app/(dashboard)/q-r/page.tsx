"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";

interface QAItem {
  question: string;
  answer: string;
}

export default function QAPage() {
  const [items, setItems] = useState<QAItem[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleAdd = () => {
    if (!question.trim() || !answer.trim()) return;
    if (editingIndex !== null) {
      const updated = [...items];
      updated[editingIndex] = { question: question.trim(), answer: answer.trim() };
      setItems(updated);
      setEditingIndex(null);
    } else {
      setItems([...items, { question: question.trim(), answer: answer.trim() }]);
    }
    setQuestion("");
    setAnswer("");
  };

  const handleEdit = (index: number) => {
    setQuestion(items[index].question);
    setAnswer(items[index].answer);
    setEditingIndex(index);
  };

  const handleDelete = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setQuestion("");
      setAnswer("");
    }
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setQuestion("");
    setAnswer("");
  };

  return (
    <section className="py-8 sm:py-10">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Questions / Réponses
          </h1>
        </div>

        <div className="mt-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAdd();
            }}
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
                  {editingIndex !== null ? "Modifier" : "Ajouter"}
                </Button>
                {editingIndex !== null && (
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
          </div>

          <div className="mt-6">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-lg"
                  onClick={() => {
                    setItems([]);
                    setEditingIndex(null);
                    setQuestion("");
                    setAnswer("");
                  }}
                >
                  vider
                </Button>
                <Button size="sm" className="rounded-lg">
                  envoyer
                </Button>
              </div>

              {items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center text-sm text-muted-foreground">
                  Aucune Q/R enregistrée pour le moment.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {items.map((item, i) => (
                    <div
                      key={i}
                      className="group rounded-xl border border-border bg-card/60 p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/20"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 text-sm break-words leading-relaxed">
                          <span className="font-semibold text-foreground">{`{Q:`}</span>
                          <span className="mx-1 text-foreground">{item.question}</span>
                          <span className="text-foreground">{`; R:`}</span>
                          <span className="mx-1 text-muted-foreground">{item.answer}</span>
                          <span className="font-semibold text-foreground">{`}`}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(i)}
                            aria-label="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(i)}
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
