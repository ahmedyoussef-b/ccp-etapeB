"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ChevronRight, ChevronDown, FolderTree, Loader2, Image as ImageIcon, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type WebTreeNode = {
  id: number | string;
  name: string;
  type: string;
  metadata: string | null;
  parentId: number | string | null;
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
  pathPrefix = "",
  onSelect,
  selectedPath,
}: {
  node: WebTreeNode;
  depth?: number;
  pathPrefix?: string;
  onSelect: (node: WebTreeNode, path: string) => void;
  selectedPath?: string;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isFolder = node.type === "directory" || node.type === "folder" || node.type === "root";
  const hasChildren = node.children.length > 0;
  const nodePath = pathPrefix ? `${pathPrefix}/${node.name}` : node.name;
  const isImage = node.type === "image";

  return (
    <div>
      <div
        className="flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(node, nodePath)}
      >
        {hasChildren ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((prev) => !prev);
            }}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
          </span>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}
        {isImage ? (
          <ImageIcon className={`h-4 w-4 flex-shrink-0 text-blue-500`} />
        ) : (
          <FolderTree className={`h-4 w-4 flex-shrink-0 ${isFolder ? "text-primary" : "text-muted-foreground"}`} />
        )}
        <span className="text-sm font-medium text-foreground truncate">{node.name}</span>
        {isImage && (
          <span className="text-xs text-blue-500 ml-1">image</span>
        )}
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
              pathPrefix={nodePath}
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
  const [loadFailed, setLoadFailed] = useState(false);
  const [manualCategory, setManualCategory] = useState("");

  const categoryExists = useMemo(() => {
    if (!value || !tree.length) return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    const existsInTree = (nodes: WebTreeNode[]): boolean =>
      nodes.some(
        (node) =>
          node.name === trimmed ||
          node.children.some((child) => child.name === trimmed)
      );
    return existsInTree(tree);
  }, [value, tree]);

  const loadTree = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
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
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadTree();
    }
  }, [open, loadTree]);

  const handleSelect = (_node: WebTreeNode, path: string) => {
    onChange(path);
    setOpen(false);
  };

  const handleManualSubmit = () => {
    const trimmed = manualCategory.trim();
    if (!trimmed) return;
    onChange(trimmed);
    setManualCategory("");
    setOpen(false);
  };

  const filterTree = (nodes: WebTreeNode[]): WebTreeNode[] => {
    const filtered = nodes
      .filter((node) => node.type !== "file" && node.type !== "item" && node.type !== "image")
      .map((node) => ({
        ...node,
        children: filterTree(node.children),
      }));
    if (!search.trim()) return filtered;
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
    return prune(filtered);
  };

  const visibleTree = filterTree(tree);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={`w-full justify-between bg-background/60 ${value && !categoryExists ? "border-amber-500 text-amber-600" : ""}`}
        onClick={() => setOpen(true)}
      >
        <span className={`truncate ${!value ? "text-muted-foreground" : ""}`}>
          {value || placeholder}
        </span>
        <div className="ml-2 flex items-center gap-1 flex-shrink-0">
          {value && !categoryExists && <AlertTriangle className="h-4 w-4 text-amber-500" />}
          <FolderTree className="h-4 w-4" />
        </div>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Choisir une catégorie</DialogTitle>
            <DialogDescription>
              Sélectionnez un nœud dans l&apos;arborescence Structure BDD, ou saisissez une catégorie manuellement si l&apos;arborescence est indisponible.
            </DialogDescription>
          </DialogHeader>

          {value && !categoryExists && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                La catégorie &laquo; {value} &raquo; n&apos;existe pas encore dans la BDD. Elle sera enregistr&eacute;e, mais n&apos;apparaîtra dans l&apos;arborescence que si un nœud correspondant est ajout&eacute;.
              </span>
            </div>
          )}

          <div className="space-y-3">
            <Input
              placeholder="Rechercher dans l'arborescence..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-background/60"
              disabled={loadFailed}
            />

            {loadFailed ? (
              <div className="space-y-2">
                <p className="text-xs text-red-500">L&apos;arborescence n&apos;a pas pu être chargée. Vous pouvez saisir une catégorie manuellement.</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nouvelle catégorie"
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    className="bg-background/60"
                  />
                  <Button
                    type="button"
                    onClick={handleManualSubmit}
                    disabled={!manualCategory.trim()}
                  >
                    OK
                  </Button>
                </div>
              </div>
            ) : (
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
                      pathPrefix=""
                      onSelect={handleSelect}
                      selectedPath={value}
                    />
                  ))
                )}
              </div>
            )}

            {!loadFailed && !categoryExists && manualCategory.trim() && (
              <p className="text-xs text-amber-600">
                Cette catégorie n&apos;existe pas dans l&apos;arborescence. Elle sera enregistr&eacute;e, mais n&apos;apparaîtra pas dans la BDD tant qu&apos;un nœud correspondant n&apos;aura pas &eacute;t&eacute; ajout&eacute;.
              </p>
            )}
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
