"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Database,
  ChevronRight,
  ChevronDown,
  FolderTree,
  FileText,
  FileJson,
  RefreshCw,
  RotateCcw,
  ArrowRightLeft,
  Trash2,
  Plus,
  Pencil,
  type LucideIcon,
} from "lucide-react";

import { useSyncData } from "@/lib/sync/useSyncData";
import { toast } from "sonner";

type LocalNode = {
  id: string;
  name: string;
  type: "folder" | "file" | "meta";
  children: LocalNode[];
  path: string;
};

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

const iconMap: Record<string, LucideIcon> = {
  root: FolderTree,
  category: FolderTree,
  group: FolderTree,
  item: FileText,
  folder: FolderTree,
  file: FileJson,
  meta: FileText,
};

function TreeNodeItem({
  node,
  depth = 0,
  onDelete,
  onAdd,
  onRename,
  onEdit,
}: {
  node: WebTreeNode | LocalNode;
  depth?: number;
  onDelete?: (node: WebTreeNode | LocalNode) => void;
  onAdd?: (node: WebTreeNode | LocalNode) => void;
  onRename?: (node: WebTreeNode | LocalNode) => void;
  onEdit?: (node: LocalNode) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const [showActions, setShowActions] = useState(false);
  const isLocal = "path" in node;
  const nodeType = isLocal ? node.type : node.type;
  const Icon = iconMap[nodeType] ?? FileText;

  const getBadgeVariant = () => {
    if (isLocal) {
      if (nodeType === "meta") return "outline";
      if (nodeType === "folder") return "default";
      return "secondary";
    }
    return "secondary";
  };

  const getBadgeText = () => {
    if (isLocal) {
      if (nodeType === "meta") return "meta";
      if (nodeType === "folder") return "dossier";
      return "fichier";
    }
    return node.type;
  };

  const isJsonFile = isLocal && nodeType === "file" && node.name.endsWith(".json");

  return (
    <div
      className="group relative"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div
        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => setExpanded((prev) => !prev)}
      >
        {node.children.length > 0 ? (
          expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )
        ) : (
          <span className="w-4" />
        )}
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground flex-1">{node.name}</span>
        <Badge variant={getBadgeVariant()} className="text-xs">
          {getBadgeText()}
        </Badge>

        {showActions && (
          <div className="flex items-center gap-1 ml-2">
            {(nodeType === "directory" || nodeType === "folder" || nodeType === "root") && onAdd && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd(node);
                }}
                title="Ajouter"
              >
                <Plus className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onRename?.(node);
              }}
              title="Renommer"
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-red-500"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(node);
              }}
              title="Supprimer"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
            {isJsonFile && onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(node as LocalNode);
                }}
                title="Éditer"
              >
                <FileJson className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      {expanded && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              onDelete={onDelete}
              onAdd={onAdd}
              onRename={onRename}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function StructureBDDPage() {
  const [webTree, setWebTree] = useState<WebTreeNode[]>([]);
  const [localTree, setLocalTree] = useState<LocalNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [webError, setWebError] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [resettingWeb, setResettingWeb] = useState(false);
  const [resettingLocal, setResettingLocal] = useState(false);
  const [clearingData, setClearingData] = useState(false);
  const [syncingAndResetting, setSyncingAndResetting] = useState(false);
  const [addingNode, setAddingNode] = useState<{ tree: "web" | "local"; parentId: number | string } | null>(null);
  const [newNodeName, setNewNodeName] = useState("");
  const [newNodeType, setNewNodeType] = useState<"file" | "directory">("directory");
  const [renamingNode, setRenamingNode] = useState<{ tree: "web" | "local"; id: number | string; currentName: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [editingFile, setEditingFile] = useState<{ tree: "web" | "local"; path: string; content: string } | null>(null);
  const [editContent, setEditContent] = useState("");
  const { sync, isSyncing } = useSyncData();

  const loadTrees = async () => {
    setLoading(true);
    setWebError(null);
    setLocalError(null);

    const webPromise = fetch("/api/tree")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch web tree");
        return res.json();
      })
      .then((data) => {
        setWebTree((data as { roots: WebTreeNode[] }).roots);
      })
      .catch((err) => {
        setWebError(err instanceof Error ? err.message : "Unknown error");
        setWebTree([]);
      });

    const localPromise = fetch("/api/local-tree")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch local tree");
        return res.json();
      })
      .then((data) => {
        setLocalTree((data as { tree: LocalNode[] }).tree);
      })
      .catch((err) => {
        setLocalError(err instanceof Error ? err.message : "Unknown error");
        setLocalTree([]);
      });

    await Promise.all([webPromise, localPromise]);
    setLoading(false);
  };

  useEffect(() => {
    loadTrees();
  }, []);

  const handleSync = async () => {
    await sync();
    await loadTrees();
  };

  const handleResetWeb = async () => {
    const confirmed = window.confirm(
      "Remise à zéro de la BDD Web : toutes les données web seront réinitialisées à l'état initial. Continuer ?"
    );
    if (!confirmed) return;

    setResettingWeb(true);
    try {
      const res = await fetch("/api/tree/reset", { method: "POST" });
      if (!res.ok) throw new Error("Failed to reset web tree");
      await loadTrees();
      toast.success("BDD Web remise à zéro avec succès");
    } catch (err) {
      setWebError(err instanceof Error ? err.message : "Reset failed");
      toast.error("Erreur lors de la remise à zéro de la BDD Web");
    } finally {
      setResettingWeb(false);
    }
  };

  const handleResetLocal = async () => {
    const confirmed = window.confirm(
      "Remise à zéro de la BDD Locale : l'arborescence locale sera réinitialisée à l'état initial. Continuer ?"
    );
    if (!confirmed) return;

    setResettingLocal(true);
    try {
      const res = await fetch("/api/local-tree/reset", { method: "POST" });
      if (!res.ok) throw new Error("Failed to reset local tree");
      await loadTrees();
      toast.success("BDD Locale remise à zéro avec succès");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Reset failed");
      toast.error("Erreur lors de la remise à zéro de la BDD Locale");
    } finally {
      setResettingLocal(false);
    }
  };

  const handleClearData = async () => {
    const confirmed = window.confirm(
      "Supprimer le contenu de .data ? Cette action est irréversible."
    );
    if (!confirmed) return;

    setClearingData(true);
    try {
      const res = await fetch("/api/local-tree/clear", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear .data");
      await loadTrees();
      toast.success("Contenu de .data supprimé");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Clear failed");
      toast.error("Erreur lors de la suppression de .data");
    } finally {
      setClearingData(false);
    }
  };

  const handleSyncAndReset = async () => {
    const confirmed = window.confirm(
      "Synchroniser la BDD Web vers la BDD Locale puis remettre à zéro la BDD Web ?"
    );
    if (!confirmed) return;

    setSyncingAndResetting(true);
    try {
      const syncRes = await fetch("/api/tree/sync-to-local", { method: "POST" });
      if (!syncRes.ok) throw new Error("Failed to sync web tree to local");

      const resetRes = await fetch("/api/tree/reset", { method: "POST" });
      if (!resetRes.ok) throw new Error("Failed to reset web tree");

      await loadTrees();
      toast.success("Synchronisation terminée et BDD Web remise à zéro");
    } catch (err) {
      setWebError(err instanceof Error ? err.message : "Sync and reset failed");
      toast.error("Erreur lors de la synchronisation");
    } finally {
      setSyncingAndResetting(false);
    }
  };

  const handleDeleteWeb = async (node: WebTreeNode | LocalNode) => {
    const confirmed = window.confirm(`Supprimer "${node.name}" ?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/tree/nodes/${node.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete node");
      await loadTrees();
      toast.success("Nœud supprimé");
    } catch (err) {
      setWebError(err instanceof Error ? err.message : "Delete failed");
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleDeleteLocal = async (node: WebTreeNode | LocalNode) => {
    if (!("id" in node)) return;
    const confirmed = window.confirm(`Supprimer "${node.name}" ?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/local-tree/nodes/${encodeURIComponent(node.id as string)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete node");
      await loadTrees();
      toast.success("Nœud supprimé");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Delete failed");
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleAddWeb = async (node: WebTreeNode | LocalNode) => {
    if (!("id" in node) || typeof node.id === "string") return;
    setAddingNode({ tree: "web", parentId: node.id });
    setNewNodeName("");
    setNewNodeType("directory");
  };

  const handleAddLocal = async (node: WebTreeNode | LocalNode) => {
    if (!("id" in node)) return;
    setAddingNode({ tree: "local", parentId: node.id as string });
    setNewNodeName("");
    setNewNodeType("directory");
  };

  const confirmAdd = async () => {
    if (!addingNode || !newNodeName.trim()) return;

    try {
      if (addingNode.tree === "web") {
        const res = await fetch(`/api/tree/nodes/${addingNode.parentId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newNodeName, type: newNodeType }),
        });
        if (!res.ok) throw new Error("Failed to add node");
      } else {
        const res = await fetch(`/api/local-tree/nodes/${encodeURIComponent(addingNode.parentId as string)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newNodeName, type: newNodeType }),
        });
        if (!res.ok) throw new Error("Failed to add node");
      }

      setAddingNode(null);
      setNewNodeName("");
      await loadTrees();
      toast.success("Nœud ajouté");
    } catch (err) {
      if (addingNode.tree === "web") {
        setWebError(err instanceof Error ? err.message : "Add failed");
      } else {
        setLocalError(err instanceof Error ? err.message : "Add failed");
      }
      toast.error("Erreur lors de l'ajout");
    }
  };

  const handleRenameWeb = async (node: WebTreeNode | LocalNode) => {
    setRenamingNode({ tree: "web", id: node.id, currentName: node.name });
    setRenameValue(node.name);
  };

  const handleRenameLocal = async (node: WebTreeNode | LocalNode) => {
    if (!("id" in node)) return;
    setRenamingNode({ tree: "local", id: node.id as string, currentName: node.name });
    setRenameValue(node.name);
  };

  const confirmRename = async () => {
    if (!renamingNode || !renameValue.trim()) return;

    try {
      if (renamingNode.tree === "web") {
        const res = await fetch(`/api/tree/nodes/${renamingNode.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: renameValue }),
        });
        if (!res.ok) throw new Error("Failed to rename node");
      } else {
        const res = await fetch(`/api/local-tree/nodes/${encodeURIComponent(renamingNode.id as string)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newName: renameValue }),
        });
        if (!res.ok) throw new Error("Failed to rename node");
      }

      setRenamingNode(null);
      setRenameValue("");
      await loadTrees();
      toast.success("Nœud renommé");
    } catch (err) {
      if (renamingNode.tree === "web") {
        setWebError(err instanceof Error ? err.message : "Rename failed");
      } else {
        setLocalError(err instanceof Error ? err.message : "Rename failed");
      }
      toast.error("Erreur lors du renommage");
    }
  };

  const handleEditJson = (node: LocalNode) => {
    if (!node.id) return;
    setEditingFile({ tree: "local", path: node.id as string, content: "" });
    setEditContent("");
  };

  const confirmEditJson = async () => {
    if (!editingFile) return;

    try {
      const res = await fetch(`/api/local-tree/edit/${encodeURIComponent(editingFile.path)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      if (!res.ok) throw new Error("Failed to edit file");

      setEditingFile(null);
      setEditContent("");
      await loadTrees();
      toast.success("Fichier JSON modifié");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Edit failed");
      toast.error("Erreur lors de la modification du fichier");
    }
  };

  const filterWebTree = (nodes: WebTreeNode[]): WebTreeNode[] => {
    if (!search.trim()) return nodes;
    const term = search.toLowerCase();
    const matches = (node: WebTreeNode): boolean => {
      const nameMatch = node.name.toLowerCase().includes(term);
      const typeMatch = node.type.toLowerCase().includes(term);
      const childMatch = node.children.some(matches);
      return nameMatch || typeMatch || childMatch;
    };
    const prune = (nodes: WebTreeNode[]): WebTreeNode[] => {
      return nodes
        .filter(matches)
        .map((node) => ({
          ...node,
          children: prune(node.children),
        }));
    };
    return prune(nodes);
  };

  const filterLocalTree = (nodes: LocalNode[]): LocalNode[] => {
    if (!search.trim()) return nodes;
    const term = search.toLowerCase();
    const matches = (node: LocalNode): boolean => {
      const nameMatch = node.name.toLowerCase().includes(term);
      const typeMatch = node.type.toLowerCase().includes(term);
      const childMatch = node.children.some(matches);
      return nameMatch || typeMatch || childMatch;
    };
    const prune = (nodes: LocalNode[]): LocalNode[] => {
      return nodes
        .filter(matches)
        .map((node) => ({
          ...node,
          children: prune(node.children),
        }));
    };
    return prune(nodes);
  };

  const visibleWebTree = filterWebTree(webTree);
  const visibleLocalTree = filterLocalTree(localTree);
  const totalNodes = (nodes: (WebTreeNode | LocalNode)[]): number =>
    nodes.reduce((acc, node) => acc + 1 + totalNodes(node.children), 0);

  if (loading) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-muted-foreground">Chargement de la structure...</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Structure BDD</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Comparaison de la base de données web et locale · {totalNodes(visibleWebTree) + totalNodes(visibleLocalTree)} nœuds
            {webError && <span className="text-red-500"> · Erreur web: {webError}</span>}
            {localError && <span className="text-red-500"> · Erreur locale: {localError}</span>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Rechercher dans l'arborescence..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-80"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleSync}
            disabled={isSyncing}
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="default"
            size="icon"
            onClick={handleSyncAndReset}
            disabled={syncingAndResetting}
            title="Synchroniser la BDD Web vers la BDD Locale et remettre à zéro la BDD Web"
          >
            <ArrowRightLeft className={`h-4 w-4 ${syncingAndResetting ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="border-b border-border px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">BDD Web</h3>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {totalNodes(visibleWebTree)} nœuds
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleResetWeb}
                disabled={resettingWeb}
                title="Remettre à zéro"
              >
                <RotateCcw className={`h-4 w-4 ${resettingWeb ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
          <div className="p-2 max-h-[600px] overflow-y-auto">
            {webError ? (
              <p className="text-sm text-red-500 text-center py-8">
                Erreur : {webError}
              </p>
            ) : visibleWebTree.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucun nœud trouvé.
              </p>
            ) : (
              visibleWebTree.map((node) => (
                <TreeNodeItem
                  key={node.id}
                  node={node}
                  onDelete={handleDeleteWeb}
                  onAdd={handleAddWeb}
                  onRename={handleRenameWeb}
                />
              ))
            )}
          </div>
        </Card>

        <Card>
          <div className="border-b border-border px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">BDD Locale</h3>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="text-xs">
                {totalNodes(visibleLocalTree)} nœuds
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleResetLocal}
                disabled={resettingLocal}
                title="Remettre à zéro"
              >
                <RotateCcw className={`h-4 w-4 ${resettingLocal ? "animate-spin" : ""}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearData}
                disabled={clearingData}
                title="Supprimer (.data)"
                className="text-red-500 hover:text-red-600"
              >
                <Trash2 className={`h-4 w-4 ${clearingData ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
          <div className="p-2 max-h-[600px] overflow-y-auto">
            {localError ? (
              <p className="text-sm text-red-500 text-center py-8">
                Erreur : {localError}
              </p>
            ) : visibleLocalTree.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucune donnée locale.
              </p>
            ) : (
              visibleLocalTree.map((node) => (
                <TreeNodeItem
                  key={node.id}
                  node={node}
                  onDelete={handleDeleteLocal}
                  onAdd={handleAddLocal}
                  onRename={handleRenameLocal}
                  onEdit={handleEditJson}
                />
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Add Node Modal */}
      <Dialog open={!!addingNode} onOpenChange={(open) => !open && setAddingNode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un nœud</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nom</label>
              <Input
                value={newNodeName}
                onChange={(e) => setNewNodeName(e.target.value)}
                placeholder="Nom du nœud"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Type</label>
              <Select value={newNodeType} onValueChange={(value) => setNewNodeType(value as "file" | "directory")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="directory">Dossier</SelectItem>
                  <SelectItem value="file">Fichier</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddingNode(null)}>
              Annuler
            </Button>
            <Button onClick={confirmAdd}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Modal */}
      <Dialog open={!!renamingNode} onOpenChange={(open) => !open && setRenamingNode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer</DialogTitle>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium">Nouveau nom</label>
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Nouveau nom"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingNode(null)}>
              Annuler
            </Button>
            <Button onClick={confirmRename}>Renommer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit JSON Modal */}
      <Dialog open={!!editingFile} onOpenChange={(open) => !open && setEditingFile(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Éditer le fichier JSON</DialogTitle>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium">Contenu</label>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder='{ "key": "value" }'
              className="w-full h-96 p-2 font-mono text-sm border rounded-md"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFile(null)}>
              Annuler
            </Button>
            <Button onClick={confirmEditJson}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
