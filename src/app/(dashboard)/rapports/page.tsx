"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Mic,
  MicOff,
  Save,
  Trash2,
  Plus,
  Clock,
  MapPin,
  Server,
  User,
  Calendar,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Download,
  Mail,
  Send,
} from "lucide-react";
import { useSpeech } from "@/lib/speech/use-speech";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { teams } from "@/data/teams";
import type { Member } from "@/data/teams";

interface ReportPoint {
  executorName: string;
  zone: string;
  service: string;
  hoursWorked: number;
  text: string;
}

interface ReportEntry {
  id: string;
  points: ReportPoint[];
  date: string;
  createdAt: string;
}

const zones = [
  "Zone A - Production",
  "Zone B - Maintenance",
  "Zone C - Stockage",
  "Zone D - Administration",
  "Zone E - Extérieur",
  "Zone F - Salle de contrôle",
];

const services = [
  "Service Technique",
  "Service Maintenance",
  "Service Production",
  "Service Qualité",
  "Service Sécurité",
  "Service Logistique",
  "Service Électrique",
  "Service Mécanique",
  "Service Instrumentation",
  "Service Automatisme",
];

const STORAGE_KEY = "nexaflow_rapports";
const MAX_REPORTS = 100;

function loadReports(): ReportEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ReportEntry[];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString();
    const filtered = parsed.filter((r) => r.createdAt >= cutoff);
    if (filtered.length !== parsed.length) {
      saveReports(filtered);
    }
    return filtered;
  } catch {
    return [];
  }
}

function saveReports(reports: ReportEntry[]) {
  if (typeof window === "undefined") return;
  const trimmed = reports.slice(0, MAX_REPORTS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getAllMembers(): { member: Member; teamName: string }[] {
  const members: { member: Member; teamName: string }[] = [];
  teams.forEach((team) => {
    team.members_list.forEach((member) => {
      members.push({ member, teamName: team.name });
    });
  });
  return members;
}

export default function RapportsPage() {
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [points, setPoints] = useState<ReportPoint[]>([
    { executorName: "", zone: "", service: "", hoursWorked: 0, text: "" },
  ]);
  const [speechText, setSpeechText] = useState("");
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<Set<number>>(new Set());
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { isListening, transcript, error, stopListening, toggleListening } = useSpeech({
    language: "fr-FR",
    continuous: true,
  });

  useEffect(() => {
    setReports(loadReports());
  }, []);

  useEffect(() => {
    if (transcript) {
      setSpeechText(transcript);
    }
  }, [transcript]);

  useEffect(() => {
    if (error) {
      setSpeechError(error);
    }
  }, [error]);

  const addPoint = useCallback(() => {
    setPoints((prev) => [...prev, { executorName: "", zone: "", service: "", hoursWorked: 0, text: "" }]);
  }, []);

  const removePoint = useCallback((index: number) => {
    setPoints((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updatePoint = useCallback((index: number, field: keyof ReportPoint, value: string | number) => {
    setPoints((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const handleAppendSpeech = useCallback(() => {
    if (!speechText.trim()) return;
    setPoints((prev) => {
      const next = [...prev];
      const lastIdx = next.length - 1;
      if (lastIdx >= 0) {
        next[lastIdx] = {
          ...next[lastIdx],
          text: next[lastIdx].text ? `${next[lastIdx].text} ${speechText.trim()}` : speechText.trim(),
        };
      } else {
        next.push({ executorName: "", zone: "", service: "", hoursWorked: 0, text: speechText.trim() });
      }
      return next;
    });
    setSpeechText("");
    if (isListening) stopListening();
  }, [speechText, isListening, stopListening]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const validPoints = points.filter((p) => p.text.trim());
      if (validPoints.length === 0) {
        setToast({ message: "Au moins un point de travail est requis.", type: "error" });
        return;
      }
      for (const p of validPoints) {
        if (!p.executorName.trim()) {
          setToast({ message: "Le nom de l'exécuteur est requis pour chaque point.", type: "error" });
          return;
        }
        if (!p.zone) {
          setToast({ message: "La zone est requise pour chaque point.", type: "error" });
          return;
        }
        if (!p.service) {
          setToast({ message: "Le service est requis pour chaque point.", type: "error" });
          return;
        }
        if (p.hoursWorked <= 0) {
          setToast({ message: "L'heurotage doit être supérieur à 0 pour chaque point.", type: "error" });
          return;
        }
      }

      setIsSubmitting(true);
      const newReport: ReportEntry = {
        id: generateId(),
        points: validPoints,
        date: new Date().toISOString().split("T")[0],
        createdAt: new Date().toISOString(),
      };

      const updated = [newReport, ...reports];
      setReports(updated);
      saveReports(updated);

      setPoints([{ executorName: "", zone: "", service: "", hoursWorked: 0, text: "" }]);
      setSpeechText("");
      setShowForm(false);
      setIsSubmitting(false);
      setToast({ message: "Rapport sauvegardé avec succès.", type: "success" });

      setTimeout(() => setToast(null), 3000);
    },
    [points, reports]
  );

  const handleDelete = useCallback(
    (id: string) => {
      const updated = reports.filter((r) => r.id !== id);
      setReports(updated);
      saveReports(updated);
      setToast({ message: "Rapport supprimé.", type: "success" });
      setTimeout(() => setToast(null), 3000);
    },
    [reports]
  );

  const handleExport = useCallback((report: ReportEntry) => {
    const lines: string[] = [];
    lines.push(`Rapport Journalier - ${formatDate(report.createdAt)}`);
    lines.push("");
    report.points.forEach((point, idx) => {
      lines.push(`Point ${idx + 1}:`);
      lines.push(`  Exécuteur: ${point.executorName}`);
      lines.push(`  Zone: ${point.zone}`);
      lines.push(`  Service: ${point.service}`);
      lines.push(`  Heures travaillées: ${point.hoursWorked}h`);
      lines.push(`  Travail: ${point.text}`);
      lines.push("");
    });
    const text = lines.join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-${report.date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const toggleRecipient = useCallback((memberId: number) => {
    setSelectedRecipients((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  }, []);

  const selectAllRecipients = useCallback(() => {
    const all = getAllMembers();
    setSelectedRecipients((prev) => {
      if (prev.size === all.length) {
        return new Set<number>();
      }
      return new Set(all.map((m) => m.member.id));
    });
  }, []);

  const handleSendToAll = useCallback(async () => {
    if (selectedRecipients.size === 0) {
      setToast({ message: "Sélectionnez au moins un utilisateur.", type: "error" });
      return;
    }
    setIsSending(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsSending(false);
    setSendDialogOpen(false);
    setSelectedRecipients(new Set());
    setToast({ message: `Rapport envoyé à ${selectedRecipients.size} utilisateur(s).`, type: "success" });
    setTimeout(() => setToast(null), 3000);
  }, [selectedRecipients]);

  return (
    <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {toast && (
        <div
          className={cn(
            "mb-4 flex items-center gap-2 rounded-lg border p-3 text-sm shadow-sm",
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200"
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-auto shrink-0" aria-label="Fermer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Rapports</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Rédigez et enregistrez vos rapports journaliers par point avec heurotage, zone, service et exécuteur.
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"}>
          <Plus className="h-4 w-4 mr-2" />
          {showForm ? "Fermer" : "Nouveau rapport"}
        </Button>
      </div>

      {showForm && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Nouveau rapport journalier</CardTitle>
            <CardDescription>Chaque point contient son propre exécuteur, zone, service et heurotage.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {points.map((point, index) => (
                <div key={index} className="rounded-lg border border-border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Point {index + 1}</h3>
                    {points.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removePoint(index)}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`executor-${index}`}>Exécuteur</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id={`executor-${index}`}
                          placeholder="Nom de l&apos;exécuteur"
                          value={point.executorName}
                          onChange={(e) => updatePoint(index, "executorName", e.target.value)}
                          className="pl-9"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`zone-${index}`}>Zone</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Select
                          value={point.zone}
                          onValueChange={(v: unknown) => updatePoint(index, "zone", v as string)}
                          required
                        >
                          <SelectTrigger className="pl-9">
                            <SelectValue placeholder="Sélectionner une zone" />
                          </SelectTrigger>
                          <SelectContent>
                            {zones.map((z) => (
                              <SelectItem key={z} value={z}>
                                {z}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`service-${index}`}>Service exécutant</Label>
                      <div className="relative">
                        <Server className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Select
                          value={point.service}
                          onValueChange={(v: unknown) => updatePoint(index, "service", v as string)}
                          required
                        >
                          <SelectTrigger className="pl-9">
                            <SelectValue placeholder="Sélectionner un service" />
                          </SelectTrigger>
                          <SelectContent>
                            {services.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`hours-${index}`}>Heurotage (h)</Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id={`hours-${index}`}
                          type="number"
                          min={0}
                          step={0.5}
                          placeholder="0"
                          value={point.hoursWorked || ""}
                          onChange={(e) => updatePoint(index, "hoursWorked", parseFloat(e.target.value) || 0)}
                          className="pl-9"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`text-${index}`}>Point de travail</Label>
                    <div className="flex items-start gap-2">
                      <Textarea
                        ref={textareaRef}
                        placeholder="Dictée ou saisie du point de travail..."
                        value={point.text}
                        onChange={(e) => updatePoint(index, "text", e.target.value)}
                        className="min-h-[80px] resize-y flex-1"
                        rows={3}
                      />
                      <div className="flex flex-col gap-2 pt-1">
                        <Button
                          type="button"
                          variant={isListening ? "destructive" : "default"}
                          size="icon"
                          onClick={toggleListening}
                          title={isListening ? "Arrêter l&apos;écoute" : "Commencer la dictée"}
                          className="h-9 w-9"
                        >
                          {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={handleAppendSpeech}
                          disabled={!speechText.trim()}
                          title="Ajouter le texte au point"
                          className="h-9 w-9"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {speechError && <p className="text-xs text-destructive">{speechError}</p>}
                  </div>
                </div>
              ))}

              <div className="flex items-center gap-3 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={addPoint}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Ajouter un point
                </Button>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" disabled={isSubmitting}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSubmitting ? "Sauvegarde..." : "Sauvegarder le rapport"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setPoints([{ executorName: "", zone: "", service: "", hoursWorked: 0, text: "" }]);
                    setSpeechText("");
                    setSpeechError(null);
                    if (isListening) stopListening();
                  }}
                >
                  Annuler
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Rapports du mois</h2>
          <Badge variant="secondary" className="ml-auto">
            {reports.length}
          </Badge>
        </div>

        {reports.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-sm font-medium text-foreground">Aucun rapport ce mois-ci</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Créez votre premier rapport journalier en cliquant sur &quot;Nouveau rapport&quot;.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <Card key={report.id} className="transition-all hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-foreground truncate">
                          {report.points[0]?.executorName || "Sans exécuteur"}
                        </h3>
                        <Badge variant="secondary" className="text-xs">
                          {formatDate(report.createdAt)}
                        </Badge>
                      </div>
                      <div className="mt-2 space-y-2">
                        {report.points.map((point, idx) => (
                          <div key={idx} className="rounded-md border border-border/50 bg-muted/20 p-3">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-2">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {point.executorName}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {point.zone}
                              </span>
                              <span className="flex items-center gap-1">
                                <Server className="h-3 w-3" />
                                {point.service}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {point.hoursWorked}h
                              </span>
                            </div>
                            <p className="text-sm text-foreground">{point.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 sm:shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleExport(report)}
                        title="Exporter"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => {
                          setSelectedRecipients(new Set());
                          setSendDialogOpen(true);
                        }}
                        title="Envoyer à tous les utilisateurs"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(report.id)}
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Envoyer le rapport à tous les utilisateurs</DialogTitle>
            <DialogDescription>
              Sélectionnez les utilisateurs auxquels vous souhaitez envoyer ce rapport.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">
                {selectedRecipients.size} utilisateur(s) sélectionné(s)
              </span>
              <Button variant="outline" size="sm" onClick={selectAllRecipients}>
                {selectedRecipients.size === getAllMembers().length ? "Tout désélectionner" : "Tout sélectionner"}
              </Button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto space-y-2">
              {getAllMembers().map(({ member, teamName }) => (
                <label
                  key={member.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedRecipients.has(member.id)}
                    onChange={() => toggleRecipient(member.id)}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                  />
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {member.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {teamName}
                  </Badge>
                </label>
              ))}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSendToAll} disabled={isSending || selectedRecipients.size === 0}>
              {isSending ? (
                <>Envoi en cours...</>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Envoyer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}