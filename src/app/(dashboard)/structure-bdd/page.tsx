"use client";

import { useCallback, useEffect, useState } from "react";
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
  Eye,
  RefreshCw,
  RotateCcw,
  ArrowRightLeft,
  Trash2,
  Plus,
  Pencil,
  Download,
  type LucideIcon,
} from "lucide-react";

import { getLocalTree, deleteLocalTreeNode, addFolder, updateFolder, addFile } from "@/lib/db/tree";
import { clientEngine, initSqlite, run, simpleTokenEmbedding } from "@/lib/client-engine";
import type { VectorTreeNode } from "@/lib/client-engine";
import { toast } from "sonner";

type LocalNode = {
  id: string;
  name: string;
  type: "folder" | "file";
  children: LocalNode[];
  path: string;
  order: number;
  content?: string | null;
  docId?: string | null;
};

function buildVectorTree(nodes: VectorTreeNode[]): LocalNode[] {
  const nodeMap = new Map<string, LocalNode>();
  const roots: LocalNode[] = [];

  for (const n of nodes) {
    nodeMap.set(n.id, {
      id: n.id,
      name: n.name,
      type: n.type,
      children: [],
      path: n.relativePath,
      order: n.order ?? 0,
      content: n.content,
      docId: n.docId,
    });
  }

  for (const n of nodes) {
    const node = nodeMap.get(n.id)!;
    if (n.parentId && nodeMap.has(n.parentId)) {
      nodeMap.get(n.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortByOrder = (nodes: LocalNode[]): LocalNode[] =>
    nodes.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const sortRecursively = (nodes: LocalNode[]): LocalNode[] =>
    sortByOrder(nodes).map((node) => ({
      ...node,
      children: sortRecursively(node.children),
    }));

  return sortRecursively(roots);
}

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
  directory: FolderTree,
  folder: FolderTree,
  file: FileJson,
};

function TreeNodeItem({
  node,
  depth = 0,
  path = "",
  onDelete,
  onAdd,
  onRename,
  onEdit,
  onPreview,
  onVectorize,
  vectorizing = false,
}: {
  node: WebTreeNode | LocalNode;
  depth?: number;
  path?: string;
  onDelete?: (node: WebTreeNode | LocalNode) => void;
  onAdd?: (node: WebTreeNode | LocalNode) => void;
  onRename?: (node: WebTreeNode | LocalNode) => void;
  onEdit?: (node: LocalNode) => void;
  onPreview?: (node: WebTreeNode | LocalNode) => void;
  onVectorize?: (node: LocalNode, path: string) => void;
  vectorizing?: boolean;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const [showActions, setShowActions] = useState(false);
  const isLocal = "path" in node;
  const nodeType = isLocal ? node.type : node.type;
  const Icon = iconMap[nodeType] ?? FileText;
  const nodePath = path ? `${path}/${node.name}` : node.name;

  const getBadgeVariant = () => {
    if (isLocal) {
      if (nodeType === "folder") return "default";
      return "secondary";
    }
    return "secondary";
  };

  const getBadgeText = () => {
    if (isLocal) {
      if (nodeType === "folder") return "dossier";
      return "fichier";
    }
    return node.type;
  };

  const isFileNode = nodeType === "file" || nodeType === "item";
  const hasLocalContent = isLocal && nodeType === "file" && node.content !== undefined && node.content !== null;

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
            {hasLocalContent && onEdit && (
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
             {isFileNode && onVectorize && (
               <Button
                 variant="ghost"
                 size="icon"
                 className="h-6 w-6 text-blue-500"
                 disabled={vectorizing}
                 onClick={(e) => {
                   e.stopPropagation();
                   onVectorize?.(node as LocalNode, nodePath);
                 }}
                 title="Vectoriser"
               >
                 <Database className="h-3 w-3" />
               </Button>
             )}
             {isFileNode && onPreview && (
               <Button
                 variant="ghost"
                 size="icon"
                 className="h-6 w-6"
                 onClick={(e) => {
                   e.stopPropagation();
                   onPreview(node);
                 }}
                 title="Aperçu"
               >
                 <Eye className="h-3 w-3" />
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
                path={nodePath}
                onDelete={onDelete}
                onAdd={onAdd}
                onRename={onRename}
                onEdit={onEdit}
                onPreview={onPreview}
                onVectorize={onVectorize}
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
  const [vectorDocs, setVectorDocs] = useState<{ id: string; name: string; chunks: { content: string }[] }[]>([]);
  const [vectorTree, setVectorTree] = useState<LocalNode[]>([]);
  const [vectorizing, setVectorizing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [webError, setWebError] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [vectorError, setVectorError] = useState<string | null>(null);
  const [search] = useState("");
  const [resettingWeb, setResettingWeb] = useState(false);
  const [resettingLocal, setResettingLocal] = useState(false);
  const [clearingData, setClearingData] = useState(false);
  const [addingNode, setAddingNode] = useState<{ tree: "web" | "local"; parentId: number | string } | null>(null);
  const [newNodeName, setNewNodeName] = useState("");
  const [newNodeType, setNewNodeType] = useState<"file" | "directory">("directory");
  const [renamingNode, setRenamingNode] = useState<{ tree: "web" | "local"; id: number | string; currentName: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [editingFile, setEditingFile] = useState<{ tree: "web" | "local"; path: string; content: string } | null>(null);
  const [editContent, setEditContent] = useState("");
  const [previewingFile, setPreviewingFile] = useState<{ path?: string; name: string; tree: "web" | "local" } | null>(null);
  const [previewData, setPreviewData] = useState<{ content?: string; dataUrl?: string; mimeType: string; name: string; size: number; isText: boolean } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [activeView, setActiveView] = useState<"web" | "local" | "vector">("web");

  const loadTrees = useCallback(async () => {
    console.log("[StructureBDD] loadTrees start");
    setLoading(true);
    setWebError(null);
    setLocalError(null);
    setVectorError(null);

    const webPromise = fetch("/api/tree")
      .then((res) => {
        console.log("[StructureBDD] /api/tree status", res.status);
        if (!res.ok) throw new Error("Failed to fetch web tree");
        return res.json();
      })
      .then((data) => {
        const roots = (data as { roots: WebTreeNode[] }).roots;
        console.log("[StructureBDD] web tree loaded", { count: roots.length });
        setWebTree(roots);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("[StructureBDD] web tree error", msg);
        setWebError(msg);
        setWebTree([]);
      });

    const enginePromise = clientEngine.init();

    const localPromise = enginePromise
      .then(() => getLocalTree())
      .then((tree) => {
        console.log("[StructureBDD] local tree loaded", { count: tree.length });
        setLocalTree(tree);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("[StructureBDD] local tree error", msg);
        setLocalError(msg);
        setLocalTree([]);
      });

    const vectorPromise = enginePromise
      .then(() => clientEngine.getAllVectorDocuments())
      .then((docs) => {
        console.log("[StructureBDD] vector docs loaded", { count: docs.length });
        setVectorDocs(docs.map((d) => ({ id: d.id, name: d.name, chunks: d.chunks })));
      })
      .then(() => clientEngine.getAllVectorTreeNodes())
      .then((nodes) => {
        console.log("[StructureBDD] vector tree loaded", { count: nodes.length });
        setVectorTree(buildVectorTree(nodes));
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("[StructureBDD] vector error", msg);
        setVectorError(msg);
        setVectorDocs([]);
        setVectorTree([]);
      });

    await Promise.all([webPromise, localPromise, vectorPromise]);
    setLoading(false);
  }, []);

  useEffect(() => {
    console.log("[StructureBDD] mount");
    loadTrees();
  }, [loadTrees]);

  const handleResetWeb = async () => {
    const confirmed = window.confirm(
      "Remise à zéro de la BDD Web : toutes les données web seront réinitialisées à l'état initial. Continuer ?"
    );
    if (!confirmed) return;
    console.log("[StructureBDD] reset web start");

    setResettingWeb(true);
    try {
      const res = await fetch("/api/tree/reset", { method: "POST" });
      console.log("[StructureBDD] reset web status", res.status);
      if (!res.ok) throw new Error("Failed to reset web tree");
      await loadTrees();
      toast.success("BDD Web remise à zéro avec succès");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Reset failed";
      console.error("[StructureBDD] reset web error", msg);
      setWebError(msg);
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
    console.log("[StructureBDD] reset local start");

    setResettingLocal(true);
    try {
      await clientEngine.init();
      await clientEngine.clearAllData();
      console.log("[StructureBDD] reset local done");
      await loadTrees();
      toast.success("BDD Locale remise à zéro avec succès");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Reset failed";
      console.error("[StructureBDD] reset local error", msg);
      setLocalError(msg);
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
    console.log("[StructureBDD] clear data start");

    setClearingData(true);
    try {
      await clientEngine.init();
      await clientEngine.clearAllData();
      console.log("[StructureBDD] clear data done");
      await loadTrees();
      toast.success("Contenu de .data supprimé");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Clear failed";
      console.error("[StructureBDD] clear data error", msg);
      setLocalError(msg);
      toast.error("Erreur lors de la suppression de .data");
    } finally {
      setClearingData(false);
    }
  };

   const handleSyncToLocal = async () => {
    const confirmed = window.confirm(
      "Synchroniser la BDD Web vers la BDD Locale ? Cette opération recréera l'arborescence locale en miroir du Web."
    );
    if (!confirmed) return;
    console.log("[StructureBDD] sync to local start");

    setSyncing(true);
    try {
      const res = await fetch("/api/tree");
      console.log("[StructureBDD] fetch web tree status", res.status);
      if (!res.ok) throw new Error("Failed to fetch web tree");
      const { roots } = (await res.json()) as { roots: WebTreeNode[] };

      await initSqlite();

      await run("DELETE FROM local_tree");

      const normalizeType = (webType: string): "folder" | "file" => {
        if (webType === "file") return "file";
        return "folder";
      };

      interface FlatNode {
        remoteId: string;
        name: string;
        type: "folder" | "file";
        parentId: number | null;
        nodeOrder: number;
        content: string | null;
        size: number;
        depth: number;
      }

      const flatNodes: FlatNode[] = [];
      const queue: Array<{ node: WebTreeNode; depth: number; parentId: number | null }> = roots.map((r) => ({ node: r, depth: 0, parentId: null }));

      while (queue.length > 0) {
        const { node, depth, parentId } = queue.shift()!;
        flatNodes.push({
          remoteId: String(node.id),
          name: node.name,
          type: normalizeType(node.type),
          parentId,
          nodeOrder: node.order ?? 0,
          content: node.type === "file" ? node.metadata : null,
          size: 0,
          depth,
        });
        if (node.children?.length) {
          for (const child of node.children) {
            queue.push({ node: child, depth: depth + 1, parentId: node.id });
          }
        }
      }

      flatNodes.sort((a, b) => a.depth - b.depth || (a.nodeOrder ?? 0) - (b.nodeOrder ?? 0));

      const localIdMap = new Map<string, number>();

      for (const node of flatNodes) {
        const localParentId = node.parentId !== null && localIdMap.has(String(node.parentId))
          ? localIdMap.get(String(node.parentId))!
          : null;

        const result = await run(
          `INSERT INTO local_tree (remote_id, name, type, parent_id, node_order, size, content, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [node.remoteId, node.name, node.type, localParentId, node.nodeOrder, node.size, node.content]
        );

        if (result.lastInsertRowid) {
          localIdMap.set(node.remoteId, result.lastInsertRowid);
        }
      }

      console.log("[StructureBDD] sync to local done", { count: flatNodes.length });
      await loadTrees();
      toast.success(`Synchronisation miroir terminée (${flatNodes.length} nœuds)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sync to local failed";
      console.error("[StructureBDD] sync to local error", msg);
      setLocalError(msg);
      toast.error("Erreur lors de la synchronisation");
    } finally {
      setSyncing(false);
    }
  };

   const handleResetMirror = async () => {
    const confirmed = window.confirm(
      "Réinitialiser le miroir local ? Cette opération supprimera toute la structure locale et la reconstruira exactement comme le Web."
    );
    if (!confirmed) return;
    console.log("[StructureBDD] reset mirror start");

    setSyncing(true);
    try {
      const res = await fetch("/api/tree");
      console.log("[StructureBDD] fetch web tree for reset status", res.status);
      if (!res.ok) throw new Error("Failed to fetch web tree");
      const { roots } = (await res.json()) as { roots: WebTreeNode[] };

      await initSqlite();

      await run("DELETE FROM local_tree");

      const normalizeType = (webType: string): "folder" | "file" => {
        if (webType === "file") return "file";
        return "folder";
      };

      interface FlatNode {
        remoteId: string;
        name: string;
        type: "folder" | "file";
        parentId: number | null;
        nodeOrder: number;
        content: string | null;
        size: number;
        depth: number;
      }

      const flatNodes: FlatNode[] = [];
      const queue: Array<{ node: WebTreeNode; depth: number; parentId: number | null }> = roots.map((r) => ({ node: r, depth: 0, parentId: null }));

      while (queue.length > 0) {
        const { node, depth, parentId } = queue.shift()!;
        flatNodes.push({
          remoteId: String(node.id),
          name: node.name,
          type: normalizeType(node.type),
          parentId,
          nodeOrder: node.order ?? 0,
          content: node.type === "file" ? node.metadata : null,
          size: 0,
          depth,
        });
        if (node.children?.length) {
          for (const child of node.children) {
            queue.push({ node: child, depth: depth + 1, parentId: node.id });
          }
        }
      }

      flatNodes.sort((a, b) => a.depth - b.depth || (a.nodeOrder ?? 0) - (b.nodeOrder ?? 0));

      const localIdMap = new Map<string, number>();

      for (const node of flatNodes) {
        const localParentId = node.parentId !== null && localIdMap.has(String(node.parentId))
          ? localIdMap.get(String(node.parentId))!
          : null;

        const result = await run(
          `INSERT INTO local_tree (remote_id, name, type, parent_id, node_order, size, content, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [node.remoteId, node.name, node.type, localParentId, node.nodeOrder, node.size, node.content]
        );

        if (result.lastInsertRowid) {
          localIdMap.set(node.remoteId, result.lastInsertRowid);
        }
      }

      console.log("[StructureBDD] reset mirror done", { count: flatNodes.length });
      await loadTrees();
      toast.success(`Miroir local réinitialisé (${flatNodes.length} nœuds)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Reset mirror failed";
      console.error("[StructureBDD] reset mirror error", msg);
      setLocalError(msg);
      toast.error("Erreur lors de la réinitialisation du miroir");
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteWeb = async (node: WebTreeNode | LocalNode) => {
    const confirmed = window.confirm(`Supprimer "${node.name}" ?`);
    if (!confirmed) return;
    console.log("[StructureBDD] delete web", { id: node.id, name: node.name });

    try {
      const res = await fetch(`/api/tree/nodes/${node.id}`, { method: "DELETE" });
      console.log("[StructureBDD] delete web status", res.status);
      if (!res.ok) throw new Error("Failed to delete node");
      await loadTrees();
      toast.success("Nœud supprimé");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      console.error("[StructureBDD] delete web error", msg);
      setWebError(msg);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleDeleteLocal = async (node: WebTreeNode | LocalNode) => {
    if (!("id" in node)) return;
    const confirmed = window.confirm(`Supprimer "${node.name}" ?`);
    if (!confirmed) return;
    console.log("[StructureBDD] delete local", { id: node.id, name: node.name });

    try {
      const idStr = node.id as string;
      const numericId = parseInt(idStr.replace(/^(folder|file)-/, ""), 10);
      if (!isNaN(numericId)) {
        await deleteLocalTreeNode(numericId);
        console.log("[StructureBDD] delete local done", { numericId });
        await loadTrees();
        toast.success("Nœud supprimé");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      console.error("[StructureBDD] delete local error", msg);
      setLocalError(msg);
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
        const parentIdStr = addingNode.parentId as string;
        const parentId = parseInt(parentIdStr.replace(/^(folder|file)-/, ""), 10);
        if (isNaN(parentId)) {
          throw new Error("Invalid parent ID");
        }
        if (newNodeType === "directory") {
          await addFolder({
            remoteId: `local-${Date.now()}`,
            name: newNodeName,
            parentId,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } else {
          await addFile({
            remoteId: `local-${Date.now()}`,
            name: newNodeName,
            folderId: parentId,
            size: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
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
        const idStr = renamingNode.id as string;
        const numericId = parseInt(idStr.replace(/^(folder|file)-/, ""), 10);
        if (!isNaN(numericId) && idStr.startsWith("folder-")) {
          await updateFolder(numericId, { name: renameValue });
        }
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
    setEditingFile({ tree: "local", path: node.id as string, content: node.content ?? "" });
    setEditContent(node.content ?? "");
  };

  const confirmEditJson = async () => {
    if (!editingFile) return;

    try {
      if (editingFile.tree === "local") {
        const idStr = editingFile.path;
        const numericId = parseInt(idStr.replace(/^(folder|file)-/, ""), 10);
        if (!isNaN(numericId)) {
          await run(
            "UPDATE local_tree SET content = ?, updated_at = datetime('now') WHERE id = ?",
            [editContent, numericId]
          );
          console.log("[StructureBDD] edit local done", { numericId });
          await loadTrees();
          toast.success("Fichier JSON modifié localement");
        }
      } else {
        const res = await fetch(`/api/tree/nodes/${editingFile.path}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ metadata: editContent }),
        });
        if (!res.ok) throw new Error("Failed to edit file");

        setEditingFile(null);
        setEditContent("");
        await loadTrees();
        toast.success("Fichier JSON modifié");
      }
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

  const handlePreviewFile = async (node: WebTreeNode | LocalNode) => {
    const isLocal = "path" in node;

    // BDD Web: read metadata directly from the node (no local file needed)
    if (!isLocal) {
      const webNode = node as WebTreeNode;
      setPreviewingFile({ name: webNode.name, tree: "web" });
      setPreviewData(null);
      setPreviewLoading(false);
      try {
        const raw = webNode.metadata || "";
        const content = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);
        let pretty = content;
        try { pretty = JSON.stringify(JSON.parse(content), null, 2); } catch { /* not json */ }
        setPreviewData({
          content: pretty,
          mimeType: "application/json",
          name: webNode.name,
          size: new TextEncoder().encode(pretty).length,
          isText: true,
        });
      } catch {
        toast.error("Erreur lors de la lecture des métadonnées");
        setPreviewingFile(null);
      }
      return;
    }

    // BDD Locale: read content from the synced node
    const localNode = node as LocalNode;
    setPreviewingFile({ name: localNode.name, tree: "local" });
    setPreviewData(null);
    setPreviewLoading(false);

    if (localNode.content === undefined || localNode.content === null) {
      setPreviewData({
        content: "",
        mimeType: "text/plain",
        name: localNode.name,
        size: 0,
        isText: true,
      });
      return;
    }

    const raw = localNode.content;
    const content = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);
    let pretty = content;
    try { pretty = JSON.stringify(JSON.parse(content), null, 2); } catch { /* not json */ }

    setPreviewData({
      content: pretty,
      mimeType: "application/json",
      name: localNode.name,
      size: new TextEncoder().encode(pretty).length,
      isText: true,
    });
  };

  const vectorizeLocalFileInternal = async (node: LocalNode, path: string) => {
    const content = typeof node.content === "string" ? node.content : JSON.stringify(node.content);
    const docId = `vector-${node.id}`;

    const chunks = [{
      documentId: docId,
      documentName: node.name,
      chunkIndex: 0,
      content,
      embedding: simpleTokenEmbedding(content),
    }];

    await clientEngine.addVectorDocument({
      id: docId,
      name: node.name,
      originalPath: path,
      relativePath: path,
      chunks,
      metadata: { source: "local" },
    });

    const pathParts = path.split("/");
    let currentPath = "";
    let parentId: string | null = null;

    for (let i = 0; i < pathParts.length - 1; i++) {
      currentPath = currentPath ? `${currentPath}/${pathParts[i]}` : pathParts[i];
      const treeNodeId = `vf-${currentPath}`;
      await clientEngine.addVectorTreeNode({
        id: treeNodeId,
        name: pathParts[i],
        type: "folder",
        parentId,
        order: i,
        relativePath: currentPath,
        content: null,
        docId: null,
      });
      parentId = treeNodeId;
    }

    await clientEngine.addVectorTreeNode({
      id: `vf-${path}`,
      name: node.name,
      type: "file",
      parentId,
      order: 0,
      relativePath: path,
      content,
      docId,
    });
  };

  const handleVectorizeLocalFile = async (node: LocalNode, path: string) => {
    if (!node.content) {
      toast.error("Ce fichier n'a pas de contenu à vectoriser");
      return;
    }

    setVectorizing(true);
    try {
      await vectorizeLocalFileInternal(node, path);
      console.log("[StructureBDD] vectorize done", { nodeId: node.id, path });
      await loadTrees();
      toast.success(`Fichier vectorisé : ${node.name}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Vectorization failed";
      console.error("[StructureBDD] vectorize error", msg);
      toast.error("Erreur lors de la vectorisation");
    } finally {
      setVectorizing(false);
    }
  };

  const handleDeleteVectorNode = async (node: WebTreeNode | LocalNode) => {
    const localNode = node as LocalNode;
    const confirmed = window.confirm(`Supprimer "${localNode.name}" du vecteur ?`);
    if (!confirmed) return;
    console.log("[StructureBDD] delete vector node", { id: localNode.id, name: localNode.name });

    try {
      if (localNode.docId) {
        await clientEngine.deleteVectorDocument(localNode.docId);
      }
      await clientEngine.deleteVectorTreeNode(localNode.id);
      console.log("[StructureBDD] delete vector node done", { id: localNode.id });
      await loadTrees();
      toast.success("Nœud vectoriel supprimé");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      console.error("[StructureBDD] delete vector node error", msg);
      toast.error("Erreur lors de la suppression");
     }
  };

  const collectFileNodes = (nodes: LocalNode[], path = ""): { node: LocalNode; path: string }[] => {
    const result: { node: LocalNode; path: string }[] = [];
    for (const node of nodes) {
      const nodePath = path ? `${path}/${node.name}` : node.name;
      if (node.type === "file") {
        result.push({ node, path: nodePath });
      }
      if (node.children && node.children.length > 0) {
        result.push(...collectFileNodes(node.children, nodePath));
      }
    }
    return result;
  };

  const handleVectorizeAllLocal = async () => {
    const fileNodes = collectFileNodes(visibleLocalTree);
    if (fileNodes.length === 0) {
      toast.info("Aucun fichier local à vectoriser");
      return;
    }

     setVectorizing(true);
     let count = 0;
     for (const { node, path } of fileNodes) {
       try {
         await vectorizeLocalFileInternal(node, path);
         count++;
       } catch (err) {
         console.error("[StructureBDD] vectorize all error", { path, err });
       }
     }
     setVectorizing(false);
     await loadTrees();
     toast.success(`${count} fichier(s) vectorisé(s)`);
  };

  const visibleWebTree = filterWebTree(webTree);
  const visibleLocalTree = filterLocalTree(localTree);
  const visibleVectorTree = filterLocalTree(vectorTree);
  const totalNodes = (nodes: (WebTreeNode | LocalNode)[]): number =>
    nodes.reduce((acc, node) => acc + 1 + totalNodes(node.children), 0);

  if (loading) {
    console.log("[StructureBDD] render loading");
    return (
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-muted-foreground">Chargement de la structure...</p>
      </section>
    );
  }

  console.log("[StructureBDD] render result", {
    web: visibleWebTree.length,
    local: visibleLocalTree.length,
    vector: vectorDocs.length,
    webError: !!webError,
    localError: !!localError,
    vectorError: !!vectorError,
  });

  const activeTree = activeView === "web" ? visibleWebTree : activeView === "local" ? visibleLocalTree : visibleVectorTree;
  const activeError = activeView === "web" ? webError : activeView === "local" ? localError : vectorError;
  const totalActiveNodes = totalNodes(activeTree);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Structure BDD</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Vue active : {activeView === "web" ? "Hub / PostgreSQL" : activeView === "local" ? "Spoke / SQLite OPFS" : "Spoke / IndexedDB"} · {totalActiveNodes} nœuds
            {activeError && <span className="text-red-500"> · Erreur: {activeError}</span>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={activeView === "web" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView("web")}
          >
            Hub / Web
          </Button>
          <Button
            variant={activeView === "local" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView("local")}
          >
            SQLite
          </Button>
          <Button
            variant={activeView === "vector" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView("vector")}
          >
            Vectorielle
          </Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="border-b border-border px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Arborescence</h3>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {totalActiveNodes} nœuds
              </Badge>
              {activeView === "web" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleResetWeb}
                  disabled={resettingWeb}
                  title="Remettre à zéro"
                >
                  <RotateCcw className={`h-4 w-4 ${resettingWeb ? "animate-spin" : ""}`} />
                </Button>
              )}
              {activeView === "local" && (
                <>
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
                   <Button
                     variant="ghost"
                     size="icon"
                     onClick={handleResetMirror}
                     disabled={syncing}
                     title="Réinitialiser le miroir"
                   >
                     <ArrowRightLeft className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                   </Button>
                 </>
              )}
            </div>
          </div>
          <div className="p-2 max-h-[600px] overflow-y-auto">
            {activeError ? (
              <p className="text-sm text-red-500 text-center py-8">
                Erreur : {activeError}
              </p>
            ) : activeTree.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucune donnée.
              </p>
            ) : (
              activeTree.map((node) => (
                <TreeNodeItem
                  key={node.id}
                  node={node}
                  depth={0}
                   onDelete={activeView === "web" ? handleDeleteWeb : activeView === "local" ? handleDeleteLocal : activeView === "vector" ? handleDeleteVectorNode : undefined}
                   onAdd={activeView === "web" ? handleAddWeb : activeView === "local" ? handleAddLocal : undefined}
                   onRename={activeView === "web" ? handleRenameWeb : activeView === "local" ? handleRenameLocal : undefined}
                   onEdit={activeView === "local" ? handleEditJson : undefined}
                   onPreview={handlePreviewFile}
                   onVectorize={activeView === "local" ? handleVectorizeLocalFile : undefined}
                   vectorizing={vectorizing}
                />
              ))
            )}
          </div>
          <div className="p-3 border-t border-border flex flex-col gap-2">
            {activeView === "web" && (
              <Button
                variant="default"
                size="sm"
                onClick={handleSyncToLocal}
                disabled={syncing}
                className="w-full"
              >
                <ArrowRightLeft className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                Sync Web → Local
              </Button>
             )}
              {activeView === "local" && (
                 <Button
                   variant="outline"
                   size="sm"
                   onClick={handleResetMirror}
                   disabled={syncing}
                   className="w-full"
                 >
                   <ArrowRightLeft className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                  Réinitialiser le miroir
                </Button>
              )}
              {activeView === "local" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleVectorizeAllLocal}
                  disabled={vectorizing}
                  className="w-full"
                >
                  <Database className={`h-4 w-4 mr-2 ${vectorizing ? "animate-spin" : ""}`} />
                  Vectoriser tout
                </Button>
              )}
          </div>

          {activeView === "vector" && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (window.confirm("Vider complètement la vectorielle ?")) {
                  await clientEngine.clearVectorTree();
                  await clientEngine.clearAllVectorDocuments();
                  await loadTrees();
                  toast.success("Vectorielle vidée");
                }
              }}
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Vider la vectorielle
            </Button>
          )}
        </Card>

        <Card>
          <div className="border-b border-border px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {editingFile ? (
                <>
                  <Pencil className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Éditeur JSON</h3>
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Visualiseur</h3>
                </>
              )}
            </div>
            {editingFile && (
              <Badge variant="outline" className="text-xs">
                {editingFile.path}
              </Badge>
            )}
            {previewingFile && !editingFile && (
              <Badge variant="outline" className="text-xs">
                {previewingFile.name}
              </Badge>
            )}
          </div>
          <div className="p-4 max-h-[calc(100vh-200px)] overflow-y-auto">
            {editingFile ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Contenu</label>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder='{ "key": "value" }'
                    className="w-full h-96 p-2 font-mono text-sm border rounded-md resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingFile(null)}>
                    Annuler
                  </Button>
                  <Button size="sm" onClick={confirmEditJson}>Enregistrer</Button>
                </div>
              </div>
            ) : !previewingFile ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Sélectionnez un nœud dans l&apos;arborescence pour afficher son contenu.
              </p>
            ) : previewLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : previewData ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-2">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      {previewData.mimeType || "application/octet-stream"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {(previewData.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (previewData.content) {
                        const blob = new Blob([previewData.content], { type: previewData.mimeType || "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = previewingFile?.name || "file";
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                      } else {
                        const link = document.createElement("a");
                        link.href = previewData.dataUrl || "#";
                        link.download = previewingFile?.name || "file";
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Télécharger
                  </Button>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/10 overflow-hidden">
                  {previewData.isText && previewData.content !== undefined ? (
                    <pre className="p-4 text-sm font-mono text-foreground overflow-auto max-h-[520px] whitespace-pre-wrap break-all">
                      {previewData.content}
                    </pre>
                  ) : previewData.dataUrl ? (
                    previewData.mimeType.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewData.dataUrl}
                        alt={previewData.name}
                        className="max-h-[520px] w-full object-contain"
                      />
                    ) : previewData.mimeType.startsWith("video/") ? (
                      <video
                        src={previewData.dataUrl}
                        controls
                        className="max-h-[520px] w-full"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <FileText className="h-12 w-12 mb-2" />
                        <p className="text-sm">Aperçu non disponible pour ce type de fichier</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4"
                          onClick={() => {
                            const link = document.createElement("a");
                            link.href = previewData.dataUrl || "#";
                            link.download = previewingFile?.name || "file";
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Télécharger
                        </Button>
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <FileText className="h-12 w-12 mb-2" />
                      <p className="text-sm">Aperçu non disponible pour ce type de fichier</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun contenu.</p>
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
    </section>
  );
}
