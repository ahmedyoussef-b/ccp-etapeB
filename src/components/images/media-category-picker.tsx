"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Check, FolderTree, Loader2 } from "lucide-react";
import { toast } from "sonner";

type MediaCategory = {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  order: number;
  children: MediaCategory[];
};

type MediaCategoryPickerProps = {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function MediaCategoryPicker({ value, onChange, placeholder = "Sélectionner une catégorie" }: MediaCategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<MediaCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/media-categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[MediaCategoryPicker] load error", msg);
      toast.error("Impossible de charger les catégories");
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadCategories();
    }
  }, [open, loadCategories]);

  const handleSelect = (name: string) => {
    onChange(name);
    setOpen(false);
  };

  const flattenCategories = (cats: MediaCategory[]): MediaCategory[] => {
    const result: MediaCategory[] = [];
    const flatten = (items: MediaCategory[]) => {
      for (const item of items) {
        result.push(item);
        if (item.children && item.children.length > 0) {
          flatten(item.children);
        }
      }
    };
    flatten(cats);
    return result;
  };

  const flatCategories = flattenCategories(categories);
  const filteredCategories = search.trim()
    ? flatCategories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : flatCategories;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between bg-background/60"
        onClick={() => setOpen(true)}
      >
        <span className={`truncate ${!value ? "text-muted-foreground" : ""}`}>
          {value || placeholder}
        </span>
        <FolderTree className="h-4 w-4 ml-2 flex-shrink-0" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Choisir une catégorie</DialogTitle>
            <DialogDescription>
              Sélectionnez une catégorie pour organiser votre média
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              placeholder="Rechercher une catégorie..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-background/60"
            />

            <div className="border rounded-lg max-h-[400px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucune catégorie trouvée
                </p>
              ) : (
                filteredCategories.map((category) => (
                  <div
                    key={category.id}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                      value === category.name ? "bg-primary/10" : ""
                    }`}
                    onClick={() => handleSelect(category.name)}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <FolderTree className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {category.name}
                      </p>
                      {category.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {category.description}
                        </p>
                      )}
                    </div>
                    {value === category.name && (
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            {value && (
              <Button
                variant="ghost"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                Effacer
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
