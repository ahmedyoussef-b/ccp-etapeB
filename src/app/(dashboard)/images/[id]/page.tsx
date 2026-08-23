"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Download,
  Trash2,
  Save,
  Loader2,
  Image as ImageIcon,
  Film,
  Clock,
  MapPin,
  Tag,
  Database,
  FileJson,
  X,
  CheckCircle2,
} from "lucide-react";
import { MediaItem, MediaKind, imageService } from "@/lib/images/mock-service";
import { CategoryTreePicker } from "@/components/images/category-tree-picker";
import { clientEngine } from "@/lib/client-engine";
import { getDocument } from "@/lib/client-engine/vector-store";
import { type VectorChunk, getChunksByDocumentId } from "@/lib/client-engine/vector-store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

const emptyForm = {
  title: "",
  category: "",
  description: "",
  tags: "",
  kind: "image" as MediaKind,
  mimeType: "",
  size: 0,
};

export default function ImageDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [item, setItem] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [geoLocation, setGeoLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [vectorized, setVectorized] = useState(false);
  const [activeTab, setActiveTab] = useState<"metadata" | "vector">("metadata");
  const [vectorChunks, setVectorChunks] = useState<VectorChunk[]>([]);
  const [loadingVector, setLoadingVector] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    imageService
      .getById(id)
      .then((data) => {
        if (!data || cancelled) return;
        setItem(data);
        setFormData({
          title: data.title,
          category: data.category,
          description: data.description,
          tags: data.tags.join(", "),
          kind: data.kind,
          mimeType: data.mimeType,
          size: data.size,
        });
        setGeoLocation(data.geolocation ?? null);
      })
      .catch(() => {
        if (!cancelled) toast.error("Impossible de charger ce média");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    clientEngine
      .init()
      .then(() => clientEngine.getVectorizedImageIds())
      .then((ids) => {
        if (!cancelled) setVectorized(ids.has(id));
      })
      .catch(() => {
        if (!cancelled) setVectorized(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const loadVectorChunks = useCallback(async () => {
    if (!id) return;
    setLoadingVector(true);
    try {
      await clientEngine.init();
      const doc = await getDocument('image-metadata');
      if (!doc) {
        setVectorChunks([]);
        return;
      }
      const chunks = await getChunksByDocumentId(doc.id);
      const imageChunks = chunks.filter((c) => (c.metadata as { imageId?: string } | undefined)?.imageId === id);
      setVectorChunks(imageChunks);
    } catch {
      setVectorChunks([]);
    } finally {
      setLoadingVector(false);
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === "vector") {
      loadVectorChunks();
    }
  }, [activeTab, loadVectorChunks]);

  const handleSave = async () => {
    if (!id || !item) return;
    if (!formData.title.trim()) {
      toast.error("Le titre est requis");
      return;
    }
    if (!formData.category) {
      toast.error("La catégorie est requise");
      return;
    }

    const tags = formData.tags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    setSaving(true);
    try {
      const updated = await imageService.update(id, {
        title: formData.title.trim(),
        category: formData.category,
        description: formData.description.trim(),
        tags,
        kind: formData.kind,
        mimeType: formData.mimeType,
        size: formData.size,
        geolocation: geoLocation || undefined,
        syncStatus: "pending",
      });
      if (updated) {
        setItem(updated);
        toast.success("Média mis à jour avec succès");
      }
    } catch {
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    const confirmed = window.confirm("Supprimer ce média ? Cette action est irréversible.");
    if (!confirmed) return;

    setDeleting(true);
    try {
      const success = await imageService.delete(id);
      if (success) {
        toast.success("Média supprimé");
        router.push("/images");
      } else {
        toast.error("Erreur lors de la suppression");
      }
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = () => {
    if (!item?.dataUrl) {
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

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" disabled>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <p className="text-sm text-muted-foreground">Chargement du média...</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="h-[60vh] animate-pulse bg-muted/20" />
          <Card className="h-[60vh] animate-pulse bg-muted/20" />
        </div>
      </section>
    );
  }

  if (!item) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.push("/images")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">Média introuvable</h1>
        </div>
        <p className="text-sm text-muted-foreground">Ce média n&apos;existe pas ou a été supprimé.</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push("/images")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {item.title || "Détail du média"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {item.kind === "image" ? "Image" : "Vidéo"} · {formatSize(item.size)} · {item.mimeType}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
            <Download className="h-4 w-4" />
            Télécharger
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting} className="gap-1.5">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Supprimer
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="overflow-hidden">
          <div className="border-b border-border px-4 py-3 flex items-center gap-2">
            {item.kind === "image" ? (
              <ImageIcon className="h-4 w-4 text-primary" />
            ) : (
              <Film className="h-4 w-4 text-violet-500" />
            )}
            <span className="text-sm font-semibold">Visualisation</span>
            {vectorized && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Database className="h-3 w-3" />
                Vectorisé
              </Badge>
            )}
            {item.syncStatus === "pending" && (
              <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-300">
                <Clock className="h-3 w-3" />
                En attente
              </Badge>
            )}
            {item.syncStatus === "synced" && (
              <Badge variant="secondary" className="text-xs gap-1 text-emerald-600 border-emerald-300">
                <CheckCircle2 className="h-3 w-3" />
                Synchronisé
              </Badge>
            )}
          </div>
          <div className="p-4 flex items-center justify-center bg-black/5 min-h-[50vh]">
            {item.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.dataUrl}
                alt={item.title}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
              />
            ) : (
              <video
                src={item.dataUrl}
                controls
                autoPlay
                className="max-w-full max-h-[70vh] rounded-lg shadow-lg"
              />
            )}
          </div>
        </Card>

        <Card>
          <div className="border-b border-border px-4 py-3 flex items-center gap-2">
            <FileJson className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Métadonnées</span>
          </div>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "metadata" | "vector")} className="flex flex-col">
            <div className="px-4 pt-3">
              <TabsList variant="line">
                <TabsTrigger value="metadata" className="gap-1.5">
                  <FileJson className="h-3.5 w-3.5" />
                  Métadonnées
                </TabsTrigger>
                <TabsTrigger value="vector" className="gap-1.5">
                  <Database className="h-3.5 w-3.5" />
                  Vectorisation
                  {vectorized && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="metadata" className="flex-1 p-4 space-y-5 data-[slot= tabs-content]:flex-1">
            <div className="space-y-2">
              <Label htmlFor="title">Titre *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Nom du média"
                className="bg-background/60"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Catégorie *</Label>
              <CategoryTreePicker
                value={formData.category}
                onChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
                placeholder="Sélectionner une catégorie"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Décrire le média..."
                rows={4}
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
                onChange={(e) => setFormData((prev) => ({ ...prev, tags: e.target.value }))}
                placeholder="ex: équipement, bloc B, inspection"
                className="bg-background/60"
              />
              <p className="text-[10px] text-muted-foreground">Séparez les tags par des virgules</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kind">Type de média</Label>
                <Input
                  id="kind"
                  value={formData.kind === "image" ? "Image" : "Vidéo"}
                  readOnly
                  className="bg-muted/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mimeType">Format MIME</Label>
                <Input
                  id="mimeType"
                  value={formData.mimeType || "—"}
                  readOnly
                  className="bg-muted/30"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Taille</Label>
              <div className="flex items-center gap-2 rounded-lg bg-muted/20 px-3 py-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{formatSize(formData.size || 0)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Géolocalisation</Label>
              <div className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {geoLocation
                      ? `${geoLocation.lat.toFixed(4)}, ${geoLocation.lng.toFixed(4)}`
                      : "Aucune position enregistrée"}
                  </span>
                </div>
                {geoLocation && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setGeoLocation(null)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
              <div>
                <span className="block text-[10px] uppercase tracking-wider mb-1">Créé le</span>
                <span className="text-foreground">{new Date(item.createdAt).toLocaleString("fr-FR")}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-wider mb-1">Modifié le</span>
                <span className="text-foreground">{new Date(item.updatedAt).toLocaleString("fr-FR")}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => router.push("/images")}>
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Enregistrer
                  </>
                )}
              </Button>
            </div>
            </TabsContent>
            <TabsContent value="vector" className="flex-1 p-4 data-[slot=tabs-content]:flex-1">
              {loadingVector ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : vectorChunks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Database className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm font-medium text-foreground">Aucun vecteur</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {vectorized
                      ? "Ce média est vectorisé mais aucun chunk n'a été trouvé."
                      : "Ce média n'est pas encore vectorisé. Lancez une synchronisation depuis la Banque d'images."}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {vectorChunks.length} chunk{vectorChunks.length > 1 ? "s" : ""} vectorisé{vectorChunks.length > 1 ? "s" : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Dimension: {vectorChunks[0]?.embedding?.length ?? 0}
                    </span>
                  </div>
                  {vectorChunks.map((chunk, idx) => (
                    <div key={chunk.id ?? idx} className="rounded-lg border border-border/60 bg-muted/10 overflow-hidden">
                      <div className="border-b border-border/60 px-3 py-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground">Chunk #{chunk.chunkIndex + 1}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {(chunk.metadata as { type?: string } | undefined)?.type ?? "image_metadata"}
                        </Badge>
                      </div>
                      <div className="p-3 space-y-3">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Texte indexé</span>
                          <p className="mt-1 text-xs text-foreground whitespace-pre-wrap break-words">{chunk.content}</p>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Vecteur (premières valeurs)</span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {(chunk.embedding ?? []).slice(0, 16).map((val: number, i: number) => (
                              <span key={i} className="text-[10px] font-mono bg-background/60 px-1 py-0.5 rounded border border-border/40">
                                {val.toFixed(3)}
                              </span>
                            ))}
                            {(chunk.embedding?.length ?? 0) > 16 && (
                              <span className="text-[10px] text-muted-foreground">+{(chunk.embedding!.length - 16)}...</span>
                            )}
                          </div>
                        </div>
                        {chunk.metadata && (
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Métadonnées</span>
                            <pre className="mt-1 text-[10px] font-mono text-foreground whitespace-pre-wrap break-words bg-background/40 p-2 rounded border border-border/40">
                              {JSON.stringify(chunk.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </section>
  );
}
