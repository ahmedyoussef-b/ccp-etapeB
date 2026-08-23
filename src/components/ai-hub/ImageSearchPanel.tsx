"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, Image as ImageIcon, Search, Trash2, Loader2, X, Sparkles } from "lucide-react";
import { initVision, getImageEmbedding } from "@/lib/vision/client-vision";
import { addImage, getAllImages, searchImages, deleteImage, type ImageRecord } from "@/lib/vision/image-store";

export function ImageSearchPanel() {
  const [modelLoading, setModelLoading] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [queryPreview, setQueryPreview] = useState<string | null>(null);
  const [results, setResults] = useState<Array<{ record: ImageRecord; score: number }>>([]);
  const [storedImages, setStoredImages] = useState<ImageRecord[]>([]);
  const [progress, setProgress] = useState(0);

  const loadStoredImages = useCallback(async () => {
    try {
      const images = await getAllImages();
      setStoredImages(images);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadStoredImages();
  }, [loadStoredImages]);

  const ensureModel = useCallback(async (): Promise<void> => {
    if (modelLoaded) return;
    setModelLoading(true);
    try {
      await initVision();
      setModelLoaded(true);
    } catch (error) {
      toast.error("Impossible de charger le modèle de vision");
      throw error;
    } finally {
      setModelLoading(false);
    }
  }, [modelLoaded]);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Format non supporté. Utilisez une image.");
      return;
    }

    setUploading(true);
    setProgress(0);
    setQueryPreview(null);
    setResults([]);

    try {
      await ensureModel();

      setProgress(10);
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setQueryPreview(dataUrl);
      setProgress(30);

      const embedding = await getImageEmbedding(dataUrl);
      setProgress(60);

      const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      await addImage({
        id,
        dataUrl,
        embedding,
        label: file.name,
      });

      setProgress(80);
      await loadStoredImages();
      setProgress(100);

      toast.success("Image indexée avec succès");
    } catch (error) {
      console.error("Image indexing error:", error);
      toast.error("Erreur lors de l'indexation de l'image");
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  }, [ensureModel, loadStoredImages]);

  const handleSearch = useCallback(async () => {
    if (!queryPreview) {
      toast.error("Veuillez d'abord indexer une image");
      return;
    }

    setSearching(true);
    setResults([]);

    try {
      await ensureModel();
      const embedding = await getImageEmbedding(queryPreview);
      const hits = await searchImages(embedding, 5, 0.05);
      setResults(hits);
      if (hits.length === 0) {
        toast.info("Aucune image similaire trouvée");
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Erreur lors de la recherche");
    } finally {
      setSearching(false);
    }
  }, [queryPreview, ensureModel]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteImage(id);
    await loadStoredImages();
    setResults((prev) => prev.filter((r) => r.record.id !== id));
    toast.success("Image supprimée");
  }, [loadStoredImages]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <ImageIcon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Recherche d&apos;images par similarité</h3>
          <p className="text-xs text-muted-foreground">
            CLIP Vision • {storedImages.length} image(s) indexée(s)
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!modelLoaded && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await ensureModel();
                  toast.success("Modèle de vision chargé");
                } catch {
                  // handled in ensureModel
                }
              }}
              disabled={modelLoading}
              className="gap-1.5"
            >
              {modelLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {modelLoading ? "Chargement..." : "Charger le modèle"}
            </Button>
          )}
        </div>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/60 bg-muted/20 p-6 text-center transition-all hover:border-primary/40 hover:bg-primary/5"
      >
        <Upload className="h-8 w-8 text-muted-foreground/60 mb-2" />
        <p className="text-sm font-medium text-foreground">
          Glissez-déposez une image ici
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          ou cliquez pour parcourir
        </p>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          id="image-upload-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
            e.target.value = "";
          }}
        />
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={() => document.getElementById("image-upload-input")?.click()}
          disabled={uploading || modelLoading}
        >
          Parcourir
        </Button>
      </div>

      {uploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Indexation en cours...</span>
            <span className="font-medium text-foreground">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {queryPreview && (
        <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/60 p-3">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={queryPreview} alt="Query" className="h-full w-full object-cover" />
            <button
              onClick={() => { setQueryPreview(null); setResults([]); }}
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-foreground">Image de requête</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Vecteur extrait avec CLIP ViT-B/32</p>
            <Button
              variant="default"
              size="sm"
              className="mt-2 gap-1.5"
              onClick={handleSearch}
              disabled={searching || !modelLoaded}
            >
              {searching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
              Rechercher similaires
            </Button>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Résultats similaires</p>
          <div className="grid grid-cols-3 gap-2">
            {results.map((hit) => (
              <Card key={hit.record.id} className="group relative overflow-hidden rounded-xl border-border/60">
                <div className="aspect-square bg-muted/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={hit.record.dataUrl}
                    alt={hit.record.label}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="p-2">
                  <p className="truncate text-xs font-medium text-foreground">{hit.record.label}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      {(hit.score * 100).toFixed(1)}% similarité
                    </span>
                    <button
                      onClick={() => handleDelete(hit.record.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {storedImages.length > 0 && results.length === 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Banque locale ({storedImages.length})</p>
          <div className="grid grid-cols-4 gap-2">
            {storedImages.slice(0, 8).map((img) => (
              <div key={img.id} className="relative aspect-square overflow-hidden rounded-lg border border-border/40 bg-muted/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.dataUrl} alt={img.label} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
