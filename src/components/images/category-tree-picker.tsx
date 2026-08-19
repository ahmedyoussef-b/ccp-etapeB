"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ChevronRight, ChevronDown, FolderTree, Loader2 } from "lucide-react";
import { toast } from "sonner";

type WebTreeNode = {
  id: number;
  name: string;
  type: string;
  metadata: string | null;
  parentId: number | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  children: WebTreeNode[];
};

type CategoryTreePickerProps = {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

function TreeNodeItem({
  node,
  depth = 0,
  onSelect,
  selectedPath,
}: {
  node: WebTreeNode;
  depth?: number;
  onSelect: (node: WebTreeNode, path: string) => void;
  selectedPath?: string;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isFolder = node.type === "directory" || node.type === "folder" || node.type === "root";
  const hasChildren = node.children.length > 0;
  const nodePath = `${node.name}`;

  return (
    <div>
      <div
        className="flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          if (hasChildren) {
            setExpanded((prev) => !prev);
          }
          onSelect(node, nodePath);
        }}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}
        <FolderTree className={`h-4 w-4 flex-shrink-0 ${isFolder ? "text-primary" : "text-muted-foreground"}`} />
        <span className="text-sm font-medium text-foreground truncate">{node.name}</span>
        {selectedPath === nodePath && (
          <span className="ml-auto text-xs text-primary font-medium">Sélectionné</span>
        )}
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoryTreePicker({ value, onChange, placeholder = "Sélectionner une catégorie" }: CategoryTreePickerProps) {
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState<WebTreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tree");
      if (!res.ok) throw new Error("Failed to fetch tree");
      const data = await res.json();
      const roots = (data as { roots: WebTreeNode[] }).roots;
      setTree(roots);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[CategoryTreePicker] load error", msg);
      toast.error("Impossible de charger l'arborescence");
      setTree([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadTree();
    }
  }, [open, loadTree]);

  const handleSelect = (node: WebTreeNode, path: string) => {
    onChange(path);
    setOpen(false);
  };

  const filterTree = (nodes: WebTreeNode[]): WebTreeNode[] => {
    if (!search.trim()) return nodes;
    const term = search.toLowerCase();
    const matches = (node: WebTreeNode): boolean => {
      const nameMatch = node.name.toLowerCase().includes(term);
      const typeMatch = node.type.toLowerCase().includes(term);
      const childMatch = node.children.some(matches);
      return nameMatch || typeMatch || childMatch;
    };
    const prune = (nodes: WebTreeNode[]): WebTreeNode[] =>
      nodes
        .filter(matches)
        .map((node) => ({
          ...node,
          children: prune(node.children),
        }));
    return prune(nodes);
  };

  const visibleTree = filterTree(tree);

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
              Sélectionnez un nœud dans l&apos;arborescence Structure BDD
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              placeholder="Rechercher dans l'arborescence..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-background/60"
            />

            <div className="border rounded-lg max-h-[400px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : visibleTree.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucun nœud trouvé
                </p>
              ) : (
                visibleTree.map((node) => (
                  <TreeNodeItem
                    key={node.id}
                    node={node}
                    depth={0}
                    onSelect={handleSelect}
                    selectedPath={value}
                  />
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
