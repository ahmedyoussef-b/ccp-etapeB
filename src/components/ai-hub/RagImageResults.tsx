"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImageIcon, ExternalLink } from "lucide-react";

type ImageItem = {
  id: string;
  title: string;
  category: string;
  mimeType: string;
  dataUrl?: string;
};

type RagImageResultsProps = {
  images: ImageItem[] | undefined;
};

export function RagImageResults({ images }: RagImageResultsProps) {
  if (!images || images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-8">
        <ImageIcon className="h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-xs text-muted-foreground">
          Aucune image retournée par le RAG pour le moment.
        </p>
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          Posez une question liée aux images/médias pour voir des résultats ici.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-foreground">
        {images.length} image{images.length !== 1 ? "s" : ""} trouvée{images.length !== 1 ? "s" : ""} par le RAG
      </p>
      <div className="grid grid-cols-2 gap-2">
        {images.map((img) => (
          <Card key={img.id} className="overflow-hidden rounded-lg border-border/60">
            <div className="aspect-square bg-muted/20 flex items-center justify-center">
              {img.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.dataUrl} alt={img.title} className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
              )}
            </div>
            <div className="p-2 space-y-1">
              <p className="text-xs font-medium text-foreground truncate" title={img.title}>
                {img.title}
              </p>
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-[10px] h-5">
                  {img.category}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  title="Ouvrir l'image"
                  onClick={() => {
                    if (img.dataUrl) {
                      window.open(img.dataUrl, "_blank");
                    }
                  }}
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
