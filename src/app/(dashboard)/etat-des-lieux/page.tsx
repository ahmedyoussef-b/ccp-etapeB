"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ClipboardList,
  MapPin,
  Camera,
  X,
  Play,
  Square,
  CheckCircle2,
  Send,
  Loader2,
  Image as ImageIcon,
  Film,
  Plus,
} from "lucide-react";
import { etatDesLieuxService } from "@/lib/etat-des-lieux/mock-service";
import type { MediaAttachment, EtatDesLieuxReport } from "@/lib/etat-des-lieux/server-store";
import { SpeechControls } from "@/components/ui/speech-controls";
import type { ChangeEvent } from "react";

type FormData = {
  title: string;
  location: string;
  description: string;
  attachments: MediaAttachment[];
};

const emptyForm: FormData = {
  title: "",
  location: "",
  description: "",
  attachments: [],
};

type CaptureMode = "idle" | "camera" | "recording";

export default function EtatDesLieuxPage() {
  const [reports, setReports] = useState<EtatDesLieuxReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [captureMode, setCaptureMode] = useState<CaptureMode>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<"image" | "video" | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      await etatDesLieuxService.init();
      const allReports = await etatDesLieuxService.getAll();
      setReports(allReports);
    } catch {
      toast.error("Erreur lors du chargement des rapports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const getAuthorInfo = () => {
    if (typeof window === "undefined") return { name: "Utilisateur", role: "rondier" };
    const role = window.sessionStorage.getItem("dashboardRole") || "rondier";
    const roleLabels: Record<string, string> = {
      admin: "Administrateur",
      "chef-de-quart": "Chef de quart",
      "chef-de-bloc": "Chef de bloc",
      rondier: "Rondier",
    };
    return { name: roleLabels[role] || "Utilisateur", role };
  };

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast.error("Format non supporté. Utilisez une image ou une vidéo.");
      return;
    }
    const kind: MediaAttachment["kind"] = file.type.startsWith("image/") ? "image" : "video";
    const dataUrl = await readFileAsDataUrl(file);
    const buffer = await readFileAsArrayBuffer(file);

    const attachment: MediaAttachment = {
      kind,
      dataUrl,
      mimeType: file.type,
      size: buffer.byteLength,
    };

    setFormData((prev) => ({
      ...prev,
      attachments: [...prev.attachments, attachment],
    }));

    setPreviewUrl(dataUrl);
    setPreviewKind(kind);
    toast.success(`${kind === "image" ? "Photo" : "Vidéo"} ajoutée`);
  };

  const handleFileInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleFileSelect(file);
    e.target.value = "";
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCaptureMode("camera");
    } catch {
      toast.error("Impossible d'accéder à la caméra");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCaptureMode("idle");
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

    const attachment: MediaAttachment = {
      kind: "image",
      dataUrl,
      mimeType: "image/jpeg",
      size: dataUrl.length,
    };

    setFormData((prev) => ({
      ...prev,
      attachments: [...prev.attachments, attachment],
    }));
    setPreviewUrl(dataUrl);
    setPreviewKind("image");
    stopCamera();
    toast.success("Photo capturée");
  };

  const startVideoRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const attachment: MediaAttachment = {
          kind: "video",
          dataUrl,
          mimeType: "video/webm",
          size: blob.size,
        };
        setFormData((prev) => ({
          ...prev,
          attachments: [...prev.attachments, attachment],
        }));
        setPreviewUrl(dataUrl);
        setPreviewKind("video");
      };
      reader.readAsDataURL(blob);
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    setCaptureMode("recording");
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setCaptureMode("camera");
  };

  const removeAttachment = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
    if (formData.attachments.length === 1) {
      setPreviewUrl(null);
      setPreviewKind(null);
    }
    toast.success("Média supprimé");
  };

  const handleSend = async () => {
    if (!formData.title.trim()) {
      toast.error("Le titre est requis");
      return;
    }
    if (!formData.location.trim()) {
      toast.error("Le lieu est requis");
      return;
    }
    if (formData.attachments.length === 0) {
      toast.error("Veuillez ajouter au moins une photo ou une vidéo");
      return;
    }
    if (!formData.description.trim()) {
      toast.error("Veuillez ajouter une description");
      return;
    }

    const author = getAuthorInfo();
    setSending(true);
    try {
      await etatDesLieuxService.create({
        title: formData.title.trim(),
        description: formData.description.trim(),
        location: formData.location.trim(),
        attachments: formData.attachments,
        status: "sent",
        authorName: author.name,
        authorRole: author.role,
      });
      toast.success("Rapport envoyé aux utilisateurs avec succès");
      setFormData(emptyForm);
      setPreviewUrl(null);
      setPreviewKind(null);
      await loadReports();
    } catch {
      toast.error("Erreur lors de l'envoi du rapport");
    } finally {
      setSending(false);
    }
  };

  const sentReports = reports.filter((r) => r.status === "sent");

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 mb-8">
        <ClipboardList className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight text-foreground">État des lieux</h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Plus className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Nouveau rapport</h2>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Titre *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Ex: Inspection secteur turbine"
                className="bg-background/60"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Lieu de travail *</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, location: e.target.value }))
                  }
                  placeholder="Ex: Salle des turbines, Bloc A"
                  className="pl-9 bg-background/60"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Médias (photo et/ou vidéo) *</Label>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5 flex-1"
                >
                  <ImageIcon className="h-4 w-4" />
                  Importer
                </Button>
                <Button
                  type="button"
                  variant={captureMode !== "idle" ? "default" : "outline"}
                  size="sm"
                  onClick={startCamera}
                  disabled={captureMode !== "idle"}
                  className="gap-1.5 flex-1"
                >
                  <Camera className="h-4 w-4" />
                  Capturer
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
              </div>

              {captureMode !== "idle" && (
                <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                  <div className="relative overflow-hidden rounded-xl bg-black">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="h-56 w-full object-cover"
                    />
                    {captureMode === "recording" && (
                      <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-xs text-white">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                        REC
                      </div>
                    )}
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {captureMode === "camera" && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={capturePhoto}
                          className="gap-1.5"
                        >
                          <Camera className="h-4 w-4" />
                          Photo
                        </Button>
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={startVideoRecording}
                          className="gap-1.5"
                        >
                          <Play className="h-4 w-4" />
                          Vidéo
                        </Button>
                      </>
                    )}
                    {captureMode === "recording" && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={stopVideoRecording}
                        className="gap-1.5"
                      >
                        <Square className="h-4 w-4" />
                        Arrêter
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={stopCamera}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Fermer
                    </Button>
                  </div>
                </div>
              )}

              {previewUrl && (
                <div className="space-y-2">
                  <Label>Aperçu</Label>
                  <div className="relative overflow-hidden rounded-xl border border-border/60 bg-muted/20">
                    {previewKind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewUrl}
                        alt="Aperçu"
                        className="h-44 w-full object-contain"
                      />
                    ) : (
                      <video
                        src={previewUrl}
                        controls
                        className="h-44 w-full object-contain"
                      />
                    )}
                  </div>
                </div>
              )}

              {formData.attachments.length > 0 && (
                <div className="space-y-2">
                  <Label>Médias ajoutés ({formData.attachments.length})</Label>
                  <div className="flex flex-wrap gap-2">
                    {formData.attachments.map((att, index) => (
                      <div
                        key={index}
                        className="relative h-16 w-16 overflow-hidden rounded-lg border border-border/60 bg-muted/20"
                      >
                        {att.kind === "image" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={att.dataUrl}
                            alt={`Média ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-black/20">
                            <Film className="h-6 w-6 text-white" />
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/80"
                          onClick={() => removeAttachment(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <SpeechControls
                value={formData.description}
                onChange={(value) =>
                  setFormData((prev) => ({ ...prev, description: value }))
                }
                placeholder="Décrivez l'état des lieux... Vous pouvez utiliser le microphone pour dicter."
                language="fr-FR"
                continuous={false}
                showActions={true}
                showTextInput={true}
                sendOnSpeechEnd={false}
                className="bg-background/60"
              />
            </div>

            <Button
              onClick={handleSend}
              disabled={sending}
              className="w-full gap-2"
              size="lg"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Envoyer aux utilisateurs
                </>
              )}
            </Button>
          </div>
        </Card>

        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Rapports envoyés</h2>
            {sentReports.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {sentReports.length}
              </Badge>
            )}
          </div>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="p-5">
                  <div className="space-y-3">
                    <div className="h-5 w-3/4 rounded bg-muted" />
                    <div className="h-4 w-1/2 rounded bg-muted" />
                    <div className="h-20 w-full rounded bg-muted" />
                  </div>
                </Card>
              ))}
            </div>
          ) : sentReports.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
                <ClipboardList className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="mt-4 text-sm font-medium text-foreground">
                Aucun rapport envoyé
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Remplissez le formulaire pour envoyer votre premier état des lieux.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {sentReports.map((report) => (
                <Card key={report.id} className="overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-foreground truncate">
                            {report.title}
                          </h3>
                          <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-700">
                            Envoyé
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {report.location}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                          {report.description}
                        </p>
                        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Par {report.authorName}</span>
                          <span>·</span>
                          <span>{new Date(report.createdAt).toLocaleString("fr-FR")}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            {report.attachments.filter((a) => a.kind === "image").length} photos
                          </span>
                          <span className="flex items-center gap-1">
                            {report.attachments.filter((a) => a.kind === "video").length} vidéos
                          </span>
                        </div>
                      </div>
                    </div>
                    {report.attachments.length > 0 && (
                      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                        {report.attachments.map((att, idx) => (
                          <div
                            key={idx}
                            className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted/20"
                          >
                            {att.kind === "image" ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={att.dataUrl}
                                alt={`Média ${idx + 1}`}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-black/20">
                                <Film className="h-6 w-6 text-white" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
