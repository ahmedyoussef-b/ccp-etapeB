"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Upload,
  Search,
  Image as ImageIcon,
  Trash2,
  Download,
  Plus,
  Camera,
  X,
  Edit3,
  FileUp,
  Play,
  Square,
  Loader2,
  Sparkles,
  Film,
  Tag,
  FolderOpen,
  CheckCircle2,
  Clock,
  ChevronUp,
  ChevronDown,
  CheckSquare,
  ListFilter,
  XCircle,
  MapPin,
  Maximize2,
} from "lucide-react";
import { MediaItem, MediaKind, imageService } from "@/lib/images/mock-service";
import { getGeolocation } from "@/lib/media/capture";
import type { ChangeEvent } from "react";

const THUMBNAIL_MAX_SIZE = 200;

function generateThumbnail(dataUrl: string, maxSize = THUMBNAIL_MAX_SIZE): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context unavailable"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => reject(new Error("Failed to load image for thumbnail"));
    img.src = dataUrl;
  });
}

function generateVideoThumbnail(dataUrl: string, maxSize = THUMBNAIL_MAX_SIZE): Promise<string> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration * 0.1);
    };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(maxSize / video.videoWidth, maxSize / video.videoHeight, 1);
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve("");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    video.onerror = () => resolve("");
    video.src = dataUrl;
  });
}

async function generateThumbnailForKind(dataUrl: string, kind: MediaKind): Promise<string> {
  if (kind === "image") {
    return generateThumbnail(dataUrl);
  }
  return generateVideoThumbnail(dataUrl);
}

type FormData = {
  title: string;
  category: string;
  description: string;
  tags: string;
  kind: MediaKind;
  dataUrl: string;
  thumbnailDataUrl?: string;
  mimeType: string;
  size: number;
};

const emptyForm: FormData = {
  title: "",
  category: "",
  description: "",
  tags: "",
  kind: "image",
  dataUrl: "",
  mimeType: "",
  size: 0,
};

const CATEGORY_COLORS: Record<string, string> = {
  Équipement: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  Inspection: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  Sécurité: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  Maintenance: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  Documentation: "bg-sky-500/10 text-sky-600 border-sky-500/20",
};

export default function ImagesPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [categories, setCategories] = useState<string[]>(["Tous"]);
  const [filterCategory, setFilterCategory] = useState("Tous");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<MediaKind | null>(null);
  const [sourceMode, setSourceMode] = useState<"upload" | "camera">("upload");
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"createdAt" | "title" | "size" | "category">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lightboxItem, setLightboxItem] = useState<MediaItem | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(24);
  const [hasMore, setHasMore] = useState(true);
  const [geoLocation, setGeoLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isCapturingGeo, setIsCapturingGeo] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ items, total }, cats] = await Promise.all([
        imageService.getAll({
          limit,
          offset: 0,
          sortBy,
          sortOrder,
          q: search,
          category: filterCategory,
        }),
        imageService.getCategories(),
      ]);
      setItems(items);
      setTotalCount(total);
      setHasMore(items.length === limit && total > limit);
      setCategories(cats);
    } catch {
      toast.error("Erreur lors du chargement des médias");
    } finally {
      setLoading(false);
    }
  }, [limit, sortBy, sortOrder, search, filterCategory]);

  const loadMore = useCallback(async () => {
    const nextOffset = offset + limit;
    try {
      const { items, total } = await imageService.getAll({
        limit,
        offset: nextOffset,
        sortBy,
        sortOrder,
        q: search,
        category: filterCategory,
      });
      setItems((prev) => [...prev, ...items]);
      setOffset(nextOffset);
      setHasMore(nextOffset + items.length < total);
    } catch {
      toast.error("Erreur lors du chargement");
    }
  }, [limit, offset, sortBy, sortOrder, search, filterCategory]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const success = await imageService.bulkDelete(Array.from(selectedIds));
      if (success) {
        toast.success(`${selectedIds.size} média(s) supprimé(s)`);
        setSelectedIds(new Set());
        await loadData();
      } else {
        toast.error("Erreur lors de la suppression");
      }
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBulkDownload = () => {
    selectedIds.forEach((id) => {
      const item = items.find((i) => i.id === id);
      if (item?.dataUrl) {
        const link = document.createElement("a");
        link.href = item.dataUrl;
        link.download = item.title;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
    toast.success(`${selectedIds.size} téléchargement(s) lancé(s)`);
  };

  const handleBulkTag = async () => {
    if (selectedIds.size === 0 || !tagInput.trim()) return;
    const tags = tagInput.split(",").map((t) => t.trim()).filter((t) => t.length > 0);
    try {
      const success = await imageService.bulkTag(Array.from(selectedIds), tags);
      if (success) {
        toast.success(`Tags ajoutés à ${selectedIds.size} média(s)`);
        setShowTagDialog(false);
        setTagInput("");
        setSelectedIds(new Set());
        await loadData();
      }
    } catch {
      toast.error("Erreur lors de l'ajout des tags");
    }
  };

  const openLightbox = (item: MediaItem) => {
    setLightboxItem(item);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    setLightboxItem(null);
  };

  const handleGeoCapture = async () => {
    try {
      setIsCapturingGeo(true);
      const geo = await getGeolocation();
      setGeoLocation({ lat: geo.lat, lng: geo.lng });
      toast.success("Géolocalisation capturée");
    } catch {
      toast.error("Impossible d'obtenir la géolocalisation");
    } finally {
      setIsCapturingGeo(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const resetForm = () => {
    setFormData(emptyForm);
    setPreviewUrl(null);
    setPreviewKind(null);
    setEditingItem(null);
    setSourceMode("upload");
    setIsRecording(false);
    setDragActive(false);
    setGeoLocation(null);
    setIsCapturingGeo(false);
  };

  const openEditDialog = async (item: MediaItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      category: item.category,
      description: item.description,
      tags: item.tags.join(", "),
      kind: item.kind,
      dataUrl: item.dataUrl,
      thumbnailDataUrl: item.thumbnailDataUrl,
      mimeType: item.mimeType,
      size: item.size,
    });
    setPreviewUrl(item.dataUrl || null);
    setPreviewKind(item.kind);
    setSourceMode("upload");
    setGeoLocation(item.geolocation || null);
    setDialogOpen(true);
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
    const kind: MediaKind = file.type.startsWith("image/") ? "image" : "video";
    const dataUrl = await readFileAsDataUrl(file);
    const buffer = await readFileAsArrayBuffer(file);
    let thumbnailDataUrl = "";
    try {
      thumbnailDataUrl = await generateThumbnailForKind(dataUrl, kind);
    } catch {
      thumbnailDataUrl = "";
    }

    setFormData((prev) => ({
      ...prev,
      kind,
      dataUrl,
      thumbnailDataUrl,
      mimeType: file.type,
      size: buffer.byteLength,
      title: prev.title || file.name.replace(/\.[^/.]+$/, ""),
    }));
    setPreviewUrl(dataUrl);
    setPreviewKind(kind);
    setSourceMode("upload");
  };

  const handleFileInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleFileSelect(file);
    e.target.value = "";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) await handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCapturing(true);
      setSourceMode("camera");
    } catch {
      toast.error("Impossible d'accéder à la caméra");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    let thumbnailDataUrl = "";
    try {
      thumbnailDataUrl = await generateThumbnail(dataUrl);
    } catch {
      thumbnailDataUrl = "";
    }
    setFormData((prev) => ({
      ...prev,
      kind: "image",
      dataUrl,
      thumbnailDataUrl,
      mimeType: "image/jpeg",
      size: dataUrl.length,
      title: prev.title || `Photo ${new Date().toLocaleString("fr-FR")}`,
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
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        let thumbnailDataUrl = "";
        try {
          thumbnailDataUrl = await generateVideoThumbnail(dataUrl);
        } catch {
          thumbnailDataUrl = "";
        }
        setFormData((prev) => ({
          ...prev,
          kind: "video",
          dataUrl,
          thumbnailDataUrl,
          mimeType: "video/webm",
          size: blob.size,
          title: prev.title || `Vidéo ${new Date().toLocaleString("fr-FR")}`,
        }));
        setPreviewUrl(dataUrl);
        setPreviewKind("video");
      };
      reader.readAsDataURL(blob);
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error("Le titre est requis");
      return;
    }
    if (!formData.category) {
      toast.error("La catégorie est requise");
      return;
    }
    if (!formData.dataUrl) {
      toast.error("Veuillez fournir un média (upload ou capture)");
      return;
    }

    const tags = formData.tags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    setSaving(true);
    try {
      if (editingItem) {
        await imageService.update(editingItem.id, {
          title: formData.title.trim(),
          category: formData.category,
          description: formData.description.trim(),
          tags,
          kind: formData.kind,
          dataUrl: formData.dataUrl,
          thumbnailDataUrl: formData.thumbnailDataUrl,
          mimeType: formData.mimeType,
          size: formData.size,
          geolocation: geoLocation || undefined,
        });
        toast.success("Média mis à jour avec succès");
      } else {
        await imageService.create({
          title: formData.title.trim(),
          category: formData.category,
          description: formData.description.trim(),
          tags,
          kind: formData.kind,
          dataUrl: formData.dataUrl,
          thumbnailDataUrl: formData.thumbnailDataUrl,
          mimeType: formData.mimeType,
          size: formData.size,
          geolocation: geoLocation || undefined,
        });
        toast.success("Média ajouté avec succès");
      }
      setDialogOpen(false);
      resetForm();
      await loadData();
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const success = await imageService.delete(id);
    setDeletingId(null);
    if (success) {
      toast.success("Média supprimé");
      await loadData();
    } else {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleDownload = (item: MediaItem) => {
    if (!item.dataUrl) {
      toast.error("Aucune donnée disponible pour le téléchargement");
      return;
    }
    const link = document.createElement("a");
    link.href = item.dataUrl;
    link.download = item.title;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Téléchargement lancé");
  };

  const totalSize = items.reduce((acc, item) => acc + item.size, 0);
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const imageCount = items.filter((i) => i.kind === "image").length;
  const videoCount = items.filter((i) => i.kind === "video").length;

  const SortIcon = ({ field }: { field: typeof sortBy }) => {
    if (sortBy !== field) return null;
    return sortOrder === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Banque d&apos;images
              </h1>
              <p className="text-sm text-muted-foreground">
                Gérez vos médias : photos et vidéos
              </p>
            </div>
            <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un média
            </Button>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 rounded-xl bg-primary/10 px-4 py-3 border border-primary/20">
            <CheckSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              {selectedIds.size} média(s) sélectionné(s)
            </span>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={handleBulkDownload} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Télécharger
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowTagDialog(true)} className="gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              Tags
            </Button>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={bulkDeleting} className="gap-1.5">
              {bulkDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Supprimer
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-4 py-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              {imageCount} images
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-4 py-2">
            <Film className="h-4 w-4 text-violet-500" />
            <span className="text-sm font-medium text-foreground">
              {videoCount} vidéos
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-4 py-2">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {formatSize(totalSize)}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-4 py-2">
            <span className="text-sm text-muted-foreground">
              {totalCount} total
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={`${sortBy}-${sortOrder}`}
              onValueChange={(value) => {
                const [field, order] = (value as string).split("-") as [typeof sortBy, typeof sortOrder];
                setSortBy(field);
                setSortOrder(order);
                setOffset(0);
              }}
            >
              <SelectTrigger className="h-8 w-auto text-xs gap-1.5">
                <ListFilter className="h-3.5 w-3.5" />
                <SelectValue placeholder="Trier par" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt-desc">
                  <span className="flex items-center gap-2">Date <SortIcon field="createdAt" /></span>
                </SelectItem>
                <SelectItem value="createdAt-asc">
                  <span className="flex items-center gap-2">Date <SortIcon field="createdAt" /></span>
                </SelectItem>
                <SelectItem value="title-asc">
                  <span className="flex items-center gap-2">Nom <SortIcon field="title" /></span>
                </SelectItem>
                <SelectItem value="size-desc">
                  <span className="flex items-center gap-2">Taille <SortIcon field="size" /></span>
                </SelectItem>
                <SelectItem value="category-asc">
                  <span className="flex items-center gap-2">Catégorie <SortIcon field="category" /></span>
                </SelectItem>
              </SelectContent>
            </Select>
            {categories.filter((c) => c !== "Tous").map((cat) => (
              <Button
                key={cat}
                variant={filterCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => { setFilterCategory(cat); setOffset(0); }}
                className={
                  filterCategory === cat
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border-border/60 bg-transparent hover:bg-muted"
                }
              >
                {cat}
              </Button>
            ))}
            {filterCategory !== "Tous" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setFilterCategory("Tous"); setOffset(0); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Effacer
              </Button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher par titre, description ou tag..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
              className="pl-9 w-full sm:w-72 bg-background/60 backdrop-blur"
            />
          </div>
        </div>

        {loading ? (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="overflow-hidden rounded-xl">
                <Skeleton className="aspect-square" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </Card>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-16 flex flex-col items-center justify-center text-center py-16">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50">
              <FolderOpen className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">
              Aucun média trouvé
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {search || filterCategory !== "Tous"
                ? "Essayez de modifier vos filtres ou votre recherche."
                : "Ajoutez votre premier média en cliquant sur le bouton ci-dessous."}
            </p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {items.map((item) => {
              const isSelected = selectedIds.has(item.id);
              const displaySrc = item.thumbnailDataUrl || item.dataUrl;
              return (
                <Card
                  key={item.id}
                  className={`group relative overflow-hidden rounded-xl border backdrop-blur transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 ${
                    isSelected ? "border-primary ring-2 ring-primary/30" : "border-border/60 bg-card/80"
                  }`}
                >
                  <div className="absolute top-2 left-2 z-10">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                      className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all ${
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "bg-white/80 border-white/50 text-transparent hover:border-primary"
                      }`}
                    >
                      {isSelected && <CheckSquare className="h-3 w-3" />}
                    </button>
                  </div>
                  <div
                    className="aspect-square bg-gradient-to-br from-muted/30 to-muted/10 flex items-center justify-center cursor-pointer overflow-hidden"
                    onClick={() => openLightbox(item)}
                  >
                    {displaySrc ? (
                      item.kind === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={displaySrc}
                          alt={item.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="relative h-full w-full">
                          <video
                            src={displaySrc}
                            className="h-full w-full object-cover"
                            muted
                            preload="metadata"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                            <div className="rounded-full bg-white/90 p-2.5 shadow-lg">
                              <Play className="h-5 w-5 text-foreground" />
                            </div>
                          </div>
                        </div>
                      )
                    ) : item.kind === "video" ? (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground/40">
                        <Film className="h-8 w-8" />
                        <span className="text-[10px] uppercase tracking-wider">
                          Vidéo
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground/40">
                        <ImageIcon className="h-8 w-8" />
                        <span className="text-[10px] uppercase tracking-wider">
                          Image
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-3">
                    <p className="truncate text-sm font-medium text-foreground">
                      {item.title}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className={`text-[10px] border ${
                          CATEGORY_COLORS[item.category] ||
                          "bg-muted text-muted-foreground border-muted"
                        }`}
                      >
                        {item.category}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {formatSize(item.size)}
                      </span>
                    </div>
                  </div>

                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full bg-white/15 text-white hover:bg-white/25 backdrop-blur"
                      onClick={() => openLightbox(item)}
                      title="Aperçu"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full bg-white/15 text-white hover:bg-white/25 backdrop-blur"
                      onClick={() => handleDownload(item)}
                      title="Télécharger"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full bg-white/15 text-white hover:bg-white/25 backdrop-blur"
                      onClick={() => openEditDialog(item)}
                      title="Modifier"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full bg-red-500/20 text-white hover:bg-red-500/30 backdrop-blur"
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      title="Supprimer"
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {hasMore && !loading && (
          <div className="mt-8 flex justify-center">
            <Button variant="outline" onClick={loadMore} className="gap-2">
              <Plus className="h-4 w-4" />
              Charger plus ({totalCount - items.length} restants)
            </Button>
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {editingItem ? (
                  <Edit3 className="h-4 w-4 text-primary" />
                ) : (
                  <Plus className="h-4 w-4 text-primary" />
                )}
                {editingItem ? "Modifier le média" : "Ajouter un média"}
              </DialogTitle>
              <DialogDescription>
                {editingItem
                  ? "Modifiez les métadonnées ou remplacez le média."
                  : "Importez ou capturez un média, puis renseignez les métadonnées."}
              </DialogDescription>
            </DialogHeader>

            <DialogBody>
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label>Source du média</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={sourceMode === "upload" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        stopCamera();
                        setSourceMode("upload");
                      }}
                      className="gap-1.5 flex-1"
                    >
                      <FileUp className="h-4 w-4" />
                      Importer
                    </Button>
                    <Button
                      type="button"
                      variant={sourceMode === "camera" ? "default" : "outline"}
                      size="sm"
                      onClick={startCamera}
                      className="gap-1.5 flex-1"
                    >
                      <Camera className="h-4 w-4" />
                      Capturer
                    </Button>
                  </div>
                </div>

                {sourceMode === "upload" && (
                  <div
                    className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-8 px-4 text-center transition-all duration-200 cursor-pointer ${
                      dragActive
                        ? "border-primary bg-primary/5 scale-[1.02]"
                        : "border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-primary/5"
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-colors duration-200 ${
                        dragActive
                          ? "bg-primary/20 text-primary"
                          : "bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      <Upload className="h-6 w-6" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-foreground">
                      {dragActive
                        ? "Déposez le fichier ici"
                        : "Glissez-déposez un fichier"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      ou parcourez vos fichiers — Images et vidéos acceptées
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={handleFileInputChange}
                    />
                  </div>
                )}

                {sourceMode === "camera" && (
                  <div className="space-y-3">
                    <div className="relative overflow-hidden rounded-xl bg-black">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="h-56 w-full object-cover"
                      />
                      {isRecording && (
                        <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-xs text-white">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                          REC
                        </div>
                      )}
                    </div>
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      {!isRecording ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={capturePhoto}
                          disabled={!isCapturing}
                          className="gap-1.5"
                        >
                          <Camera className="h-4 w-4" />
                          Photo
                        </Button>
                      ) : (
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
                      {!isRecording && isCapturing && (
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="title">Titre *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, title: e.target.value }))
                      }
                      placeholder="Nom du média"
                      className="bg-background/60"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Catégorie *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, category: value as string }))
                      }
                    >
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories
                          .filter((c) => c !== "Tous")
                          .map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Décrire le média..."
                    rows={3}
                    className="bg-background/60"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tags">
                    <Tag className="h-3 w-3 inline mr-1" />
                    Tags
                  </Label>
                  <Input
                    id="tags"
                    value={formData.tags}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, tags: e.target.value }))
                    }
                    placeholder="ex: équipement, bloc B, inspection"
                    className="bg-background/60"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Séparez les tags par des virgules
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="kind">Type de média</Label>
                    <Select
                      value={formData.kind}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          kind: value as MediaKind,
                        }))
                      }
                    >
                      <SelectTrigger id="kind">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="image">
                          <span className="flex items-center gap-2">
                            <ImageIcon className="h-4 w-4" /> Image
                          </span>
                        </SelectItem>
                        <SelectItem value="video">
                          <span className="flex items-center gap-2">
                            <Film className="h-4 w-4" /> Vidéo
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Format MIME</Label>
                    <Input
                      value={formData.mimeType || "—"}
                      readOnly
                      className="bg-muted/30"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-muted/20 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Taille</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {formatSize(formData.size || 0)}
                  </span>
                </div>

                <div className="rounded-xl bg-muted/20 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Géolocalisation</span>
                    </div>
                    {geoLocation ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-emerald-600 font-medium">
                          {geoLocation.lat.toFixed(4)}, {geoLocation.lng.toFixed(4)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setGeoLocation(null)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleGeoCapture}
                        disabled={isCapturingGeo}
                        className="gap-1.5 h-7 text-xs"
                      >
                        {isCapturingGeo ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <MapPin className="h-3 w-3" />
                        )}
                        Capturer
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </DialogBody>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  resetForm();
                }}
                disabled={saving}
              >
                Annuler
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : editingItem ? (
                  "Enregistrer"
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Ajouter
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="sm:max-w-[90vw] max-h-[90vh] p-0 overflow-hidden bg-black/95 border-none">
          {lightboxItem && (
            <div className="flex flex-col items-center justify-center">
              <div className="flex items-center justify-between w-full px-4 py-3 bg-black/50">
                <div className="flex items-center gap-3">
                  <h3 className="text-white font-medium truncate max-w-md">
                    {lightboxItem.title}
                  </h3>
                  <Badge variant="outline" className="text-white/70 border-white/20 text-xs">
                    {lightboxItem.category}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-white/10"
                    onClick={() => handleDownload(lightboxItem)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-white/10"
                    onClick={() => { setLightboxOpen(false); openEditDialog(lightboxItem); }}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-white/10"
                    onClick={closeLightbox}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-center p-4 min-h-[50vh]">
                {lightboxItem.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={lightboxItem.dataUrl}
                    alt={lightboxItem.title}
                    className="max-w-full max-h-[70vh] object-contain"
                  />
                ) : (
                  <video
                    src={lightboxItem.dataUrl}
                    controls
                    autoPlay
                    className="max-w-full max-h-[70vh]"
                  />
                )}
              </div>
              <div className="w-full px-4 py-3 bg-black/50 flex items-center justify-between">
                <div className="flex items-center gap-4 text-white/60 text-xs">
                  <span>{formatSize(lightboxItem.size)}</span>
                  <span>{lightboxItem.mimeType}</span>
                  {lightboxItem.geolocation && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {lightboxItem.geolocation.lat.toFixed(4)}, {lightboxItem.geolocation.lng.toFixed(4)}
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  {lightboxItem.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-white/50 border-white/20 text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Ajouter des tags</DialogTitle>
            <DialogDescription>
              Ajoutez des tags à {selectedIds.size} média(s) sélectionné(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-tags">Tags (séparés par des virgules)</Label>
              <Input
                id="bulk-tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="ex: équipement, bloc B, inspection"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleBulkTag(); } }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowTagDialog(false); setTagInput(""); }}>
              Annuler
            </Button>
            <Button onClick={handleBulkTag} disabled={!tagInput.trim()}>
              Ajouter les tags
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}