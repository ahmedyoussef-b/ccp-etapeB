"use client";

import { useCallback, useEffect, useMemo, useState, memo } from "react";
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
  Image,
  FolderOpen,
  type LucideIcon,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

import { loadLocalTreeFromSQLite, loadVectorTreeFromIndexedDB, deleteLocalTreeNode, addFolder, updateFolder, addFile } from "@/lib/db/tree";
import { clientEngine, run, simpleTokenEmbedding } from "@/lib/client-engine";
import { toast } from "sonner";
import { csrfFetch } from "@/lib/procedures/csrf-fetch";
import { syncManager, type SyncManagerStatus } from "@/lib/sync/sync-manager";

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

type ImageNode = {
  id: string;
  name: string;
  type: "directory" | "folder" | "file" | "image";
  path: string;
  children: ImageNode[];
  size?: number;
  createdAt: string;
  updatedAt: string;
  content?: string | null;
  order?: number;
  metadata?: string | null;
  parentId?: number | string | null;
  docId?: string | null;
};

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

function isImageNode(node: WebTreeNode | LocalNode | ImageNode): node is ImageNode {
  return "path" in node && (node as { type: string }).type === "image";
}

const iconMap: Record<string, LucideIcon> = {
  root: FolderTree,
  category: FolderTree,
  group: FolderTree,
  item: FileText,
  directory: FolderTree,
  folder: FolderTree,
  file: FileJson,
  image: Image,
};

const TreeNodeItem = memo(function TreeNodeItem({
  node,
  depth = 0,
  path = "",
  onDelete,
  onAdd,
  onRename,
  onEdit,
  onEditMetadata,
  onPreview,
  onVectorize,
  onDownload,
  vectorizedPaths,
  vectorizing = false,
  expandAll = false,
}: {
  node: WebTreeNode | LocalNode | ImageNode;
  depth?: number;
  path?: string;
  onDelete?: (node: WebTreeNode | LocalNode) => void;
  onAdd?: (node: WebTreeNode | LocalNode) => void;
  onRename?: (node: WebTreeNode | LocalNode) => void;
  onEdit?: (node: LocalNode) => void;
  onEditMetadata?: (node: ImageNode) => void;
  onPreview?: (node: WebTreeNode | LocalNode) => void;
  onVectorize?: (node: LocalNode, path: string) => void;
  onDownload?: (node: WebTreeNode | LocalNode) => void;
  vectorizedPaths?: Set<string>;
  vectorizing?: boolean;
  expandAll?: boolean;
}) {
  const [expanded, setExpanded] = useState(depth < 2 || expandAll);
  const [showActions, setShowActions] = useState(false);
  const isLocal = "path" in node;
  const isImage = isImageNode(node);
  const nodeType = isImage ? "image" : isLocal ? node.type : node.type;
  const Icon = iconMap[nodeType] ?? FileText;
  const nodePath = path ? `${path}/${node.name}` : node.name;

  const isFileNode = nodeType === "file" || nodeType === "item" || isImage;
  const hasLocalContent = isLocal && !isImage && nodeType === "file" && node.content !== undefined && node.content !== null;

  const isNodeVectorized = (n: LocalNode, basePath: string): boolean => {
    if (!vectorizedPaths) return false;
    const nodePath = basePath ? `${basePath}/${n.name}` : n.name;
    if (n.type === "file") {
      return vectorizedPaths.has(nodePath);
    }
    return n.children.some((child) => isNodeVectorized(child as LocalNode, nodePath));
  };

  const isVectorized = (() => {
    if (!vectorizedPaths) return false;
    if (isImage) {
      const imageId = String(node.id).replace(/^image-/, "");
      return (
        vectorizedPaths.has(`media-${imageId}`) ||
        vectorizedPaths.has(`media-${node.id}`) ||
        vectorizedPaths.has(nodePath) ||
        vectorizedPaths.has(node.name)
      );
    }
    if (!isLocal) return false;
    return isNodeVectorized(node as LocalNode, path);
  })();

  const getBadgeVariant = () => {
    if (isImage) return "default";
    if (isLocal) {
      if (nodeType === "folder") return "default";
      return "secondary";
    }
    return "secondary";
  };

  const getBadgeText = () => {
    if (isImage) return "image";
    if (isLocal) {
      if (nodeType === "folder") return "dossier";
      return "fichier";
    }
    return node.type;
  };

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
                  onAdd?.((node as unknown) as LocalNode);
                }}
                title="Ajouter"
              >
                <Plus className="h-3 w-3" />
              </Button>
            )}
            {!isLocal && (nodeType === "directory" || nodeType === "folder" || nodeType === "root") && onDownload && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-green-500"
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload?.((node as unknown) as LocalNode);
                }}
                title="Télécharger vers local"
              >
                <Download className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                  onRename?.((node as unknown) as LocalNode);
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
                  onDelete?.((node as unknown) as LocalNode);
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
                  onEdit?.((node as unknown) as LocalNode);
                }}
                title="Éditer"
              >
                <FileJson className="h-3 w-3" />
              </Button>
            )}
            {isImage && onEditMetadata && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-amber-500"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditMetadata(node as ImageNode);
                }}
                title="Éditer métadonnées JSON"
              >
                <FileJson className="h-3 w-3" />
              </Button>
            )}
              {isFileNode && onVectorize && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-6 w-6 ${isVectorized ? 'text-green-500' : 'text-blue-500'}`}
                  disabled={vectorizing}
                  onClick={(e) => {
                    e.stopPropagation();
                    onVectorize?.((node as unknown) as LocalNode, nodePath);
                  }}
                  title={isVectorized ? 'Déjà vectorisé' : 'Vectoriser'}
                >
                  <Database className="h-3 w-3" />
                  {isVectorized && <span className="absolute h-1.5 w-1.5 rounded-full bg-green-500 -top-0.5 -right-0.5" />}
                </Button>
              )}
             {isFileNode && onPreview && (
               <Button
                 variant="ghost"
                 size="icon"
                 className="h-6 w-6"
                 onClick={(e) => {
                   e.stopPropagation();
                    onPreview?.((node as unknown) as LocalNode);
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
                  onEditMetadata={onEditMetadata}
                  onPreview={onPreview}
                  onVectorize={onVectorize}
                  onDownload={onDownload}
                  vectorizedPaths={vectorizedPaths}
                  expandAll={expandAll}
                />
           ))}
        </div>
      )}
      </div>
    );
  }
);

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
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageTree, setImageTree] = useState<ImageNode[]>([]);
  const [search, setSearch] = useState("");
  const [resettingWeb, setResettingWeb] = useState(false);
  const [resettingLocal, setResettingLocal] = useState(false);
  const [resettingVector, setResettingVector] = useState(false);
  const [addingNode, setAddingNode] = useState<{ tree: "web" | "local"; parentId: number | string } | null>(null);
  const [newNodeName, setNewNodeName] = useState("");
  const [newNodeType, setNewNodeType] = useState<"file" | "directory">("directory");
  const [renamingNode, setRenamingNode] = useState<{ tree: "web" | "local" | "images"; id: number | string; currentName: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [editingFile, setEditingFile] = useState<{ tree: "web" | "local"; path: string; content: string } | null>(null);
  const [editContent, setEditContent] = useState("");
  const [previewingFile, setPreviewingFile] = useState<{ path?: string; name: string; tree: "web" | "local" } | null>(null);
  const [previewingImageId, setPreviewingImageId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{ content?: string; dataUrl?: string; mimeType: string; name: string; size: number; isText: boolean } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingVectorMirror, setSyncingVectorMirror] = useState(false);
  const [activeView, setActiveView] = useState<"web" | "local" | "vector" | "images">("web");
  const [showOnlyVectorized, setShowOnlyVectorized] = useState(false);
  const [vectorizedPaths, setVectorizedPaths] = useState<Set<string>>(new Set());
  const [vectorizedCount, setVectorizedCount] = useState(0);
  // ── Image metadata editor state ──────────────────────────────────────────────
  const [editingImageMetadata, setEditingImageMetadata] = useState<{ id: string; name: string } | null>(null);
  const [imageMetadataContent, setImageMetadataContent] = useState("");
  const [savingImageMetadata, setSavingImageMetadata] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncManagerStatus | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  const loadTrees = useCallback(async () => {
    console.log("[StructureBDD] loadTrees start");
    setLoading(true);
    setWebError(null);
    setLocalError(null);
    setVectorError(null);

    const enginePromise = clientEngine.init();

    const webPromise = fetch("/api/tree")
      .then((res) => {
        console.log("[StructureBDD] /api/tree status", res.status);
        if (!res.ok) throw new Error("Failed to fetch web tree");
        return res.json();
      })
      .then((data) => {
        const roots = (data as { roots: WebTreeNode[] }).roots || [];
        console.log("[StructureBDD] web tree loaded from PostgreSQL", { count: roots.length });
        setWebTree(roots);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("[StructureBDD] web tree error", msg);
        setWebError(msg);
        setWebTree([]);
      });

    const localPromise = enginePromise
      .then(() => loadLocalTreeFromSQLite())
      .then((tree) => {
        console.log("[StructureBDD] local tree loaded from SQLite", { count: tree.length });
        setLocalTree(tree);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("[StructureBDD] local tree error", msg);
        setLocalError(msg);
        setLocalTree([]);
      });

    const vectorPromise = enginePromise
      .then(async () => {
        const docs = await clientEngine.getAllVectorDocuments();
        const paths = new Set<string>();
        const count = docs.length;
        for (const doc of docs) {
          if (doc.id) paths.add(doc.id);
          if (doc.name) paths.add(doc.name);
          if (doc.relativePath) paths.add(doc.relativePath);
          if (doc.originalPath) paths.add(doc.originalPath);
        }
        setVectorizedPaths(paths);
        setVectorizedCount(count);
        console.log("[StructureBDD] vector docs loaded from IndexedDB", { count });
        setVectorDocs(docs.map((d) => ({ id: d.id, name: d.name, chunks: d.chunks })));

        const tree = await loadVectorTreeFromIndexedDB();
        console.log("[StructureBDD] vector tree loaded from IndexedDB", { count: tree.length, docCount: count });
        setVectorTree(tree);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("[StructureBDD] vector tree error", msg);
        setVectorError(msg);
        setVectorTree([]);
      });

    const imagePromise = fetch("/api/images/tree")
      .then((res) => {
        console.log("[StructureBDD] /api/images/tree status", res.status);
        if (!res.ok) throw new Error("Failed to fetch image tree");
        return res.json();
      })
      .then((data) => {
        const roots = (data as { roots: ImageNode[] }).roots;
        console.log("[StructureBDD] image tree loaded", { count: roots.length });
        setImageTree(roots);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("[StructureBDD] image tree error", msg);
        setImageError(msg);
        setImageTree([]);
      });

    await Promise.all([webPromise, localPromise, vectorPromise, imagePromise]);
    setLoading(false);
  }, []);

  const handleDownloadDirectory = useCallback(async (node: WebTreeNode | LocalNode) => {
    if (!("id" in node) || typeof node.id === "string") return;
    const numericId = Number(node.id);
    if (isNaN(numericId)) return;

    try {
      const response = await csrfFetch("/api/sync/download-directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directoryId: numericId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      await loadTrees();
      toast.success(`✅ "${node.name}" téléchargé (${data.count} éléments)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Download failed";
      console.error("[StructureBDD] download directory error", msg);
      toast.error(`Échec du téléchargement de "${node.name}"`);
    }
  }, [loadTrees]); // eslint-disable-line react-hooks/exhaustive-deps

   useEffect(() => {
     console.log("[StructureBDD] mount");
     loadTrees();
   }, [loadTrees]);

   useEffect(() => {
     syncManager.initialize().then((ok) => {
       console.log("[StructureBDD] syncManager initialized", ok);
     });
   }, []);

   useEffect(() => {
     if (!syncManager.isInitialized()) return;
     const updateStatus = async () => {
      try {
        const status = await syncManager.getSyncStatus();
        setSyncStatus(status);
      } catch {
        // ignore
      }
    };
    updateStatus();
    const interval = setInterval(updateStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSyncAll = async () => {
    const confirmed = window.confirm(
      "Synchronisation complète : envoyer les modifications locales vers le serveur et récupérer les mises à jour distantes. Continuer ?"
    );
    if (!confirmed) return;
    console.log("[StructureBDD] sync all start");
    setSyncingAll(true);
    try {
      const result = await syncManager.syncAll();
      console.log("[StructureBDD] sync all result", result);
      if (result.success) {
        toast.success(`Synchronisation complète réussie : ${result.pushed} push, ${result.pulled} pull`);
      } else {
        toast.error(`Synchronisation terminée avec erreurs : ${result.errors.join(", ")}`);
      }
      await loadTrees();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sync all failed";
      console.error("[StructureBDD] sync all error", msg);
      toast.error("Erreur lors de la synchronisation complète");
    } finally {
      setSyncingAll(false);
    }
  };

  const handleResetWeb = async () => {
    const confirmed = window.confirm(
      "Remise à zéro de la BDD Web : toutes les données web seront réinitialisées à l'état initial. Continuer ?"
    );
    if (!confirmed) return;
    console.log("[StructureBDD] reset web start");

    setResettingWeb(true);
    try {
      const res = await csrfFetch("/api/tree/reset", { method: "POST" });
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
      "Vider l'arborescence locale : toutes les données locales de l'arborescence seront supprimées. Continuer ?"
    );
    if (!confirmed) return;
    console.log("[StructureBDD] clear local tree start");

    setResettingLocal(true);
    try {
      await clientEngine.resetLocalTreeOnly();
      console.log("[StructureBDD] clear local tree done");
      await loadTrees();
      toast.success("Arborescence locale vidée avec succès");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Reset failed";
      console.error("[StructureBDD] reset local error", msg);
      setLocalError(msg);
      toast.error("Erreur lors du vidage de l'arborescence locale");
    } finally {
      setResettingLocal(false);
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
       const result = await syncManager.syncTable('tree_nodes');
       console.log("[StructureBDD] sync to local result", result);
       if (result.errors.length === 0) {
         toast.success(`Synchronisation terminée (${result.pulled} enregistrements)`);
       } else {
         toast.error(`Erreurs: ${result.errors.join(", ")}`);
       }
       await loadTrees();
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
       const result = await syncManager.resetAndPullTable('tree_nodes');
       console.log("[StructureBDD] reset mirror result", result);
       if (result.errors.length === 0) {
         toast.success(`Miroir réinitialisé (${result.pulled} enregistrements)`);
       } else {
         toast.error(`Erreurs: ${result.errors.join(", ")}`);
       }
       await loadTrees();
     } catch (err) {
       const msg = err instanceof Error ? err.message : "Reset mirror failed";
       console.error("[StructureBDD] reset mirror error", msg);
       setLocalError(msg);
       toast.error("Erreur lors de la réinitialisation du miroir");
     } finally {
       setSyncing(false);
     }
   };

  const handleResetVector = async () => {
    const confirmed = window.confirm(
      "Vider la BDD vectorielle (IndexedDB) ? Tous les documents, chunks et nœuds de l'arborescence vectorielle seront supprimés."
    );
    if (!confirmed) return;
    console.log("[StructureBDD] clear vector store start");

    setResettingVector(true);
    try {
      await clientEngine.clearAllVectorDocuments();
      console.log("[StructureBDD] clear vector store done");
      await loadTrees();
      toast.success("BDD vectorielle (IndexedDB) vidée avec succès");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Reset vector failed";
      console.error("[StructureBDD] reset vector error", msg);
      setVectorError(msg);
      toast.error("Erreur lors du vidage de la BDD vectorielle");
    } finally {
      setResettingVector(false);
    }
  };

  const removeNodeById = useCallback((nodes: LocalNode[] | WebTreeNode[] | ImageNode[], id: string | number): (LocalNode[] | WebTreeNode[] | ImageNode[]) => {
    return nodes
      .filter((node) => node.id !== id)
      .map((node) => ({
        ...node,
        children: removeNodeById(node.children as LocalNode[] | WebTreeNode[] | ImageNode[], id),
      })) as LocalNode[] | WebTreeNode[] | ImageNode[];
  }, []);

  const handleDeleteWeb = useCallback(async (node: WebTreeNode | LocalNode) => {
    const confirmed = window.confirm(`Supprimer "${node.name}" ?`);
    if (!confirmed) return;
    console.log("[StructureBDD] delete web", { id: node.id, name: node.name, type: isImageNode(node) ? "image" : "web" });

    setWebTree((prev) => removeNodeById(prev, node.id) as WebTreeNode[]);
    try {
      if (isImageNode(node)) {
        const imageId = String(node.id).replace(/^image-/, "");
        const res = await csrfFetch(`/api/images/${imageId}`, { method: "DELETE" });
        console.log("[StructureBDD] delete image status", res.status);
        if (!res.ok) throw new Error("Failed to delete image");
        toast.success("Image supprimée");
      } else {
        const res = await csrfFetch(`/api/tree/nodes/${node.id}`, { method: "DELETE" });
        console.log("[StructureBDD] delete web status", res.status);
        if (!res.ok) throw new Error("Failed to delete node");
        toast.success("Nœud supprimé");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      console.error("[StructureBDD] delete web error", msg);
      setWebError(msg);
      await loadTrees();
      toast.error("Erreur lors de la suppression");
    }
  }, [loadTrees, removeNodeById]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteLocal = useCallback(async (node: WebTreeNode | LocalNode) => {
    if (!("id" in node)) return;
    const confirmed = window.confirm(`Supprimer "${node.name}" ?`);
    if (!confirmed) return;
    console.log("[StructureBDD] delete local", { id: node.id, name: node.name });

    setLocalTree((prev) => removeNodeById(prev, node.id) as LocalNode[]);
    try {
      const idStr = node.id as string;
      const numericId = parseInt(idStr.replace(/^(folder|file)-/, ""), 10);
      if (isNaN(numericId)) {
        throw new Error("Invalid local node id");
      }
      await deleteLocalTreeNode(numericId);
      console.log("[StructureBDD] delete local done", { numericId });
      toast.success("Nœud supprimé");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      console.error("[StructureBDD] delete local error", msg);
      setLocalError(msg);
      await loadTrees();
      toast.error("Erreur lors de la suppression");
    }
  }, [loadTrees, removeNodeById]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteImage = useCallback(async (node: WebTreeNode | LocalNode) => {
    const imageNode = isImageNode(node);
    console.log("[StructureBDD] delete image clicked", { isImage: imageNode, nodeType: (node as { type?: string }).type, nodeId: node.id, nodeName: node.name });
    if (!imageNode) {
      console.log("[StructureBDD] delete image skipped - not an image node");
      toast.error("Sélectionnez un média à supprimer");
      return;
    }
    const confirmed = window.confirm(`Supprimer "${node.name}" ?`);
    if (!confirmed) return;
    console.log("[StructureBDD] delete image", { id: node.id, name: node.name });

    setImageTree((prev) => removeNodeById(prev, node.id) as ImageNode[]);
    try {
      const imageId = String(node.id).replace(/^image-/, "");
      console.log("[StructureBDD] delete image api", { imageId });
      const res = await csrfFetch(`/api/images/${encodeURIComponent(imageId)}`, { method: "DELETE" });
      console.log("[StructureBDD] delete image status", res.status);
      const responseText = await res.text();
      console.log("[StructureBDD] delete image response", responseText);
      if (!res.ok) throw new Error(responseText || "Failed to delete image");
      await loadTrees();
      toast.success("Image supprimée");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      console.error("[StructureBDD] delete image error", msg);
      setImageError(msg);
      await loadTrees();
      toast.error("Erreur lors de la suppression");
    }
  }, [loadTrees, removeNodeById]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Metadata editor for image nodes ─────────────────────────────────────────
  const handleEditImageMetadata = useCallback(async (node: ImageNode) => {
    const imageId = String(node.id).replace(/^image-/, "");
    console.log("[StructureBDD] edit image metadata", { imageId, name: node.name });
    try {
      const res = await fetch(`/api/images/${encodeURIComponent(imageId)}/metadata`);
      if (!res.ok) throw new Error("Failed to fetch metadata");
      const data = await res.json() as { metadata: Record<string, unknown> };
      setImageMetadataContent(JSON.stringify(data.metadata, null, 2));
      setEditingImageMetadata({ id: imageId, name: node.name });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors du chargement";
      console.error("[StructureBDD] edit image metadata error", msg);
      toast.error("Impossible de charger les métadonnées");
    }
  }, []);

  const confirmEditImageMetadata = async () => {
    if (!editingImageMetadata) return;
    setSavingImageMetadata(true);
    try {
      const parsed = JSON.parse(imageMetadataContent);
      const res = await csrfFetch(`/api/images/${encodeURIComponent(editingImageMetadata.id)}/metadata`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (!res.ok) throw new Error("Failed to save metadata");

      // Auto-vectorize for RAG search
      try {
        await clientEngine.vectorizeMediaItem({
          id: editingImageMetadata.id,
          title: parsed.title || editingImageMetadata.name,
          category: parsed.category,
          description: parsed.description,
          tags: parsed.tags,
          kind: parsed.kind,
          mimeType: parsed.mimeType,
          metadata: parsed,
        });
      } catch (vecErr) {
        console.warn("[StructureBDD] RAG auto-vectorize warning:", vecErr);
      }

      toast.success("Métadonnées mises à jour et synchronisées avec le RAG");
      setEditingImageMetadata(null);
      setImageMetadataContent("");
      await loadTrees();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la sauvegarde";
      console.error("[StructureBDD] confirm edit image metadata error", msg);
      toast.error(msg);
    } finally {
      setSavingImageMetadata(false);
    }
  };

  const handleVectorizeMedia = useCallback(async (node: LocalNode | ImageNode | WebTreeNode, path: string) => {
    const imageId = String(node.id).replace(/^image-/, "");
    console.log("[StructureBDD] vectorize media start", { imageId, path });
    try {
      setVectorizing(true);
      const res = await fetch(`/api/images/${encodeURIComponent(imageId)}`);
      let itemData: Record<string, unknown> = {};
      if (res.ok) {
        itemData = await res.json();
      }

      await clientEngine.vectorizeMediaItem({
        id: imageId,
        title: (itemData.title as string) || node.name,
        category: (itemData.category as string) || path,
        description: itemData.description as string,
        tags: itemData.tags as string[],
        kind: (itemData.kind as "image" | "video") || "image",
        mimeType: itemData.mimeType as string,
        metadata: itemData,
      });

      await loadTrees();
      toast.success(`Média "${node.name}" connecté au RAG pour recherche IA`);
    } catch (err) {
      console.error("[StructureBDD] vectorize media error", err);
      toast.error("Erreur lors de la vectorisation du média");
    } finally {
      setVectorizing(false);
    }
  }, [loadTrees]);

  const handleVectorizeAllMedia = async () => {
    setVectorizing(true);
    let count = 0;
    try {
      const res = await fetch("/api/images?limit=500");
      if (!res.ok) throw new Error("Failed to fetch media");
      const data = await res.json();
      const items = (data.items || []) as Array<{
        id: string;
        title: string;
        category: string;
        description?: string;
        tags?: string[];
        kind?: "image" | "video";
        mimeType?: string;
      }>;

      for (const item of items) {
        try {
          await clientEngine.vectorizeMediaItem({
            id: item.id,
            title: item.title,
            category: item.category,
            description: item.description,
            tags: item.tags,
            kind: item.kind,
            mimeType: item.mimeType,
          });
          count++;
        } catch (e) {
          console.warn("[StructureBDD] vectorize media item failed:", item.id, e);
        }
      }
      await loadTrees();
      toast.success(`${count} média(s) vectorisé(s) et connecté(s) au RAG`);
    } catch (err) {
      console.error("[StructureBDD] vectorize all media error:", err);
      toast.error("Erreur lors de la vectorisation globale des médias");
    } finally {
      setVectorizing(false);
    }
  };

  const handleAddWeb = useCallback((node: WebTreeNode | LocalNode) => {
    if (!("id" in node) || typeof node.id === "string") return;
    setAddingNode({ tree: "web", parentId: node.id });
    setNewNodeName("");
    setNewNodeType("directory");
  }, [setAddingNode, setNewNodeName, setNewNodeType]);

  const handleAddLocal = useCallback((node: WebTreeNode | LocalNode) => {
    if (!("id" in node)) return;
    setAddingNode({ tree: "local", parentId: node.id as string });
    setNewNodeName("");
    setNewNodeType("directory");
  }, [setAddingNode, setNewNodeName, setNewNodeType]);

  const confirmAdd = async () => {
    if (!addingNode || !newNodeName.trim()) return;

    try {
      if (addingNode.tree === "web") {
        const res = await csrfFetch(`/api/tree/nodes/${addingNode.parentId}`, {
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

  const handleRenameWeb = useCallback((node: WebTreeNode | LocalNode) => {
    if (isImageNode(node)) return;
    setRenamingNode({ tree: "web", id: node.id, currentName: node.name });
    setRenameValue(node.name);
  }, [setRenamingNode, setRenameValue]);

  const handleRenameLocal = useCallback((node: WebTreeNode | LocalNode) => {
    if (!("id" in node)) return;
    setRenamingNode({ tree: "local", id: node.id as string, currentName: node.name });
    setRenameValue(node.name);
  }, [setRenamingNode, setRenameValue]);

  const handleRenameImage = useCallback((node: WebTreeNode | LocalNode) => {
    if (!isImageNode(node)) return;
    setRenamingNode({ tree: "images", id: node.id, currentName: node.name });
    setRenameValue(node.name);
  }, [setRenamingNode, setRenameValue]);

  const confirmRename = async () => {
    if (!renamingNode || !renameValue.trim()) return;

    try {
      if (renamingNode.tree === "web") {
        const res = await csrfFetch(`/api/tree/nodes/${renamingNode.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: renameValue }),
        });
        if (!res.ok) throw new Error("Failed to rename node");
      } else if (renamingNode.tree === "images") {
        const imageId = String(renamingNode.id).replace(/^image-/, "");
        const res = await csrfFetch(`/api/images/${imageId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: renameValue }),
        });
        if (!res.ok) throw new Error("Failed to rename image");
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
      } else if (renamingNode.tree === "images") {
        setImageError(err instanceof Error ? err.message : "Rename failed");
      } else {
        setLocalError(err instanceof Error ? err.message : "Rename failed");
      }
      toast.error("Erreur lors du renommage");
    }
  };

  const handleEditJson = useCallback((node: LocalNode) => {
    if (!node.id) return;
    setEditingFile({ tree: "local", path: node.id as string, content: node.content ?? "" });
    setEditContent(node.content ?? "");
  }, [setEditingFile, setEditContent]);

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
        const res = await csrfFetch(`/api/tree/nodes/${editingFile.path}`, {
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

  const filterWebTree = useCallback((nodes: WebTreeNode[]): WebTreeNode[] => {
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
  }, [search]);

  const filterLocalTree = useCallback((nodes: LocalNode[]): LocalNode[] => {
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
  }, [search]);

  const filterLocalTreeByVectorized = useCallback((nodes: LocalNode[], parentPath = ""): LocalNode[] => {
    const prune = (items: LocalNode[]): LocalNode[] => {
      const result: LocalNode[] = [];
      for (const node of items) {
        const nodePath = parentPath ? `${parentPath}/${node.name}` : node.name;
        const isVectorized = vectorizedPaths.has(nodePath);
        const filteredChildren = prune(node.children);

        if (node.type === "file") {
          if (!showOnlyVectorized || isVectorized) {
            result.push(node);
          }
        } else if (node.type === "folder") {
          if (!showOnlyVectorized || filteredChildren.length > 0) {
            result.push({
              ...node,
              children: filteredChildren,
            });
          }
        }
      }
      return result;
    };
    return prune(nodes);
  }, [showOnlyVectorized, vectorizedPaths]);

  const handlePreviewFile = useCallback(async (node: WebTreeNode | LocalNode) => {
    const isLocal = "path" in node;

    if (isImageNode(node)) {
      const imageId = String(node.id).replace(/^image-/, "");
      setPreviewingFile({ name: node.name, tree: "web" });
      setPreviewingImageId(imageId);
      setPreviewData(null);
      setPreviewLoading(true);
      try {
        const res = await fetch(`/api/images/${imageId}`);
        if (!res.ok) throw new Error("Failed to fetch image");
        const item = await res.json();
        setPreviewData({
          content: item.dataUrl || "",
          mimeType: item.mimeType || "image/jpeg",
          name: item.title || node.name,
          size: item.size || 0,
          isText: false,
          dataUrl: item.dataUrl || undefined,
        });
      } catch {
        toast.error("Erreur lors du chargement de l'image");
        setPreviewingFile(null);
      } finally {
        setPreviewLoading(false);
      }
      return;
    }

    if (!isLocal) {
      const webNode = node as WebTreeNode;
      setPreviewingFile({ name: webNode.name, tree: "web" });
      setPreviewingImageId(null);
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

    const localNode = node as LocalNode;
    setPreviewingFile({ name: localNode.name, tree: "local" });
    setPreviewingImageId(null);
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
  }, [setPreviewingFile, setPreviewingImageId, setPreviewData, setPreviewLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenOnDisk = async () => {
    if (!previewingImageId) return;
    try {
      const res = await csrfFetch(`/api/images/${previewingImageId}/open`, { method: "POST" });
      if (!res.ok) throw new Error("open failed");
      toast.success("Dossier ouvert sur le disque");
    } catch {
      toast.error("Impossible d'ouvrir le dossier sur le disque");
    }
  };

  const vectorizeLocalFileInternal = useCallback(async (node: LocalNode, path: string) => {
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVectorizeLocalFile = useCallback(async (node: LocalNode, path: string) => {
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
  }, [loadTrees, vectorizeLocalFileInternal]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSyncVectorMirror = async () => {
    const confirmed = window.confirm(
      "Synchroniser le miroir vectoriel ? Cette opération va analyser l'arborescence locale et vectoriser tous les fichiers dans la base IndexedDB."
    );
    if (!confirmed) return;
    console.log("[StructureBDD] sync vector mirror start");
    setSyncingVectorMirror(true);
    try {
      let count = 0;
      const vectorizeRecursive = async (nodes: LocalNode[], currentPath = "") => {
        for (const node of nodes) {
          const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;
          if (node.type === "file" && node.content) {
            await vectorizeLocalFileInternal(node, nodePath);
            count++;
          } else if (node.type === "folder" || (node.children && node.children.length > 0)) {
            const treeNodeId = `vf-${nodePath}`;
            await clientEngine.addVectorTreeNode({
              id: treeNodeId,
              name: node.name,
              type: "folder",
              parentId: currentPath ? `vf-${currentPath}` : null,
              order: node.order || 0,
              relativePath: nodePath,
              content: null,
              docId: null,
            });
            if (node.children && node.children.length > 0) {
              await vectorizeRecursive(node.children as LocalNode[], nodePath);
            }
          }
        }
      };

      await vectorizeRecursive(localTree);
      await loadTrees();
      toast.success(`Miroir vectoriel synchronisé (${count} fichiers vectorisés dans IndexedDB)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sync vector mirror failed";
      console.error("[StructureBDD] sync vector mirror error", msg);
      setVectorError(msg);
      toast.error("Erreur lors de la synchronisation du miroir vectoriel");
    } finally {
      setSyncingVectorMirror(false);
    }
  };

  const handleDeleteVectorNode = useCallback(async (node: WebTreeNode | LocalNode) => {
    const localNode = node as LocalNode;
    const confirmed = window.confirm(`Supprimer "${localNode.name}" du vecteur ?`);
    if (!confirmed) return;
    console.log("[StructureBDD] delete vector node", { id: localNode.id, name: localNode.name });

    setVectorTree((prev) => removeNodeById(prev, localNode.id) as LocalNode[]);
    setVectorDocs((prev) => prev.filter((d) => d.id !== localNode.docId));
    try {
      if (localNode.docId) {
        await clientEngine.deleteVectorDocument(localNode.docId);
      }
      await clientEngine.deleteVectorTreeNode(localNode.id);
      console.log("[StructureBDD] delete vector node done", { id: localNode.id });
      toast.success("Nœud vectoriel supprimé");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      console.error("[StructureBDD] delete vector node error", msg);
      await loadTrees();
      toast.error("Erreur lors de la suppression");
    }
  }, [loadTrees, removeNodeById]); // eslint-disable-line react-hooks/exhaustive-deps

   const handleVectorizeAllLocal = async () => {
     console.log("[StructureBDD] vectorize all local start");
     setVectorizing(true);
     try {
       const result = await syncManager.syncAll();
       console.log("[StructureBDD] vectorize all local result", result);
       if (result.success) {
         toast.success(`Synchronisation terminée : ${result.pushed} push, ${result.pulled} pull`);
       } else {
         toast.error(`Erreurs: ${result.errors.join(", ")}`);
       }
       await loadTrees();
     } catch (err) {
       const msg = err instanceof Error ? err.message : "Sync all failed";
       console.error("[StructureBDD] vectorize all local error", msg);
       toast.error("Erreur lors de la synchronisation");
     } finally {
       setVectorizing(false);
     }
   };

  const visibleWebTree = useMemo(() => filterWebTree(webTree), [webTree, filterWebTree]);
  const baseLocalTree = useMemo(() => filterLocalTree(localTree), [localTree, filterLocalTree]);
  const visibleLocalTree = useMemo(
    () => (showOnlyVectorized ? filterLocalTreeByVectorized(baseLocalTree) : baseLocalTree),
    [showOnlyVectorized, baseLocalTree, filterLocalTreeByVectorized]
  );
  const visibleVectorTree = useMemo(() => filterLocalTree(vectorTree), [vectorTree]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalNodes = useMemo(() => {
    const count = (nodes: (WebTreeNode | LocalNode | ImageNode)[]): number =>
      nodes.reduce((acc, node) => acc + 1 + count(node.children), 0);
    return count;
  }, []);

  const activeTree = useMemo(
    () =>
      activeView === "web"
        ? visibleWebTree
        : activeView === "local"
          ? visibleLocalTree
          : activeView === "vector"
            ? visibleVectorTree
            : imageTree,
    [activeView, visibleWebTree, visibleLocalTree, visibleVectorTree, imageTree]
  );
  const activeError = useMemo(
    () =>
      activeView === "web"
        ? webError
        : activeView === "local"
          ? localError
          : activeView === "vector"
            ? vectorError
            : imageError,
    [activeView, webError, localError, vectorError, imageError]
  );
  const totalActiveNodes = useMemo(() => {
    if (activeView === "images") {
      return totalNodes(activeTree) + totalNodes(visibleWebTree);
    }
    return totalNodes(activeTree);
  }, [activeView, activeTree, visibleWebTree, totalNodes]);

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
    images: imageTree.length,
    webError: !!webError,
    localError: !!localError,
    vectorError: !!vectorError,
    imageError: !!imageError,
  });

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Structure BDD</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Vue active : {activeView === "web" ? "Hub / PostgreSQL" : activeView === "local" ? "Spoke / SQLite OPFS" : activeView === "vector" ? "Spoke / IndexedDB" : "Hub / Médias"} · {totalActiveNodes} nœuds
            {activeView === "local" && showOnlyVectorized && <span className="text-blue-500"> · {vectorizedCount} vectorisés</span>}
            {activeError && <span className="text-red-500"> · Erreur: {activeError}</span>}
            {syncStatus && (
              <span className={`ml-2 inline-flex items-center gap-1 ${syncStatus.isOnline ? "text-green-500" : "text-red-500"}`}>
                <span className="h-2 w-2 rounded-full bg-current" />
                {syncStatus.isOnline ? "En ligne" : "Hors ligne"}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAll}
            disabled={syncingAll}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncingAll ? "animate-spin" : ""}`} />
            Synchronisation complète
          </Button>
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
          <Button
            variant={activeView === "images" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView("images")}
          >
            Médias
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
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-7 w-32 text-xs"
              />
              {activeView === "local" && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="vectorized-filter"
                    checked={showOnlyVectorized}
                    onCheckedChange={setShowOnlyVectorized}
                  />
                  <label
                    htmlFor="vectorized-filter"
                    className="text-xs text-muted-foreground cursor-pointer select-none"
                  >
                    Vectorisés seulement ({vectorizedCount})
                  </label>
                </div>
              )}
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
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleResetLocal}
                  disabled={resettingLocal}
                  title="Vider l'arborescence locale"
                  className="text-red-500 hover:text-red-600"
                >
                  <Trash2 className={`h-4 w-4 ${resettingLocal ? "animate-spin" : ""}`} />
                </Button>
              )}
              {activeView === "vector" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleResetVector}
                  disabled={resettingVector}
                  title="Vider la BDD vectorielle (IndexedDB)"
                  className="text-red-500 hover:text-red-600"
                >
                  <Trash2 className={`h-4 w-4 ${resettingVector ? "animate-spin" : ""}`} />
                </Button>
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
                Aucune donnée vectorisée dans IndexedDB.
              </p>
            ) : (
              activeTree.map((node) => (
                <TreeNodeItem
                  key={node.id}
                  node={node as LocalNode}
                  depth={0}
                  onDelete={activeView === "web" ? handleDeleteWeb : activeView === "local" ? handleDeleteLocal : activeView === "vector" ? handleDeleteVectorNode : activeView === "images" ? handleDeleteImage : undefined}
                  onAdd={activeView === "web" ? handleAddWeb : activeView === "local" ? handleAddLocal : undefined}
                  onRename={activeView === "web" ? handleRenameWeb : activeView === "local" ? handleRenameLocal : activeView === "images" ? handleRenameImage : undefined}
                  onEdit={activeView === "local" ? handleEditJson : undefined}
                  onEditMetadata={handleEditImageMetadata}
                  onPreview={handlePreviewFile}
                  onVectorize={activeView === "local" ? handleVectorizeLocalFile : activeView === "images" ? handleVectorizeMedia : undefined}
                  onDownload={activeView === "web" ? handleDownloadDirectory : undefined}
                  vectorizedPaths={vectorizedPaths}
                  vectorizing={vectorizing}
                  expandAll={activeView === "vector" || activeView === "images"}
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
                   Sync complète
                 </Button>
               )}
              {activeView === "images" && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleVectorizeAllMedia}
                    disabled={vectorizing}
                    className="w-full"
                  >
                    <Database className={`h-4 w-4 mr-2 ${vectorizing ? "animate-spin text-primary" : "text-primary"}`} />
                    {vectorizing ? "Vectorisation en cours..." : "Connecter tous les médias au RAG"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadTrees}
                    disabled={loading}
                    className="w-full"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                    Actualiser l&apos;arborescence
                  </Button>
                </>
              )}
          </div>

          {activeView === "vector" && (
            <div className="p-3 border-t border-border flex flex-col gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleSyncVectorMirror}
                disabled={syncingVectorMirror}
                className="w-full"
              >
                <ArrowRightLeft className={`h-4 w-4 mr-2 ${syncingVectorMirror ? "animate-spin" : ""}`} />
                {syncingVectorMirror ? "Synchronisation en cours..." : "Sync miroir BDD vectorielle (depuis Local)"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetVector}
                disabled={resettingVector}
                className="w-full text-red-500 hover:text-red-600"
              >
                <Trash2 className={`h-4 w-4 mr-2 ${resettingVector ? "animate-spin" : ""}`} />
                Vider la BDD vectorielle (IndexedDB)
              </Button>
            </div>
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
                  {previewingImageId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenOnDisk}
                      title="Ouvrir le dossier sur le disque"
                    >
                      <FolderOpen className="h-4 w-4 mr-2" />
                      Ouvrir sur le disque
                    </Button>
                  )}
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

      {/* Edit Image Metadata Modal */}
      <Dialog open={!!editingImageMetadata} onOpenChange={(open) => !open && setEditingImageMetadata(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Éditer les métadonnées JSON : {editingImageMetadata?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Contenu JSON (métadonnées du média)</label>
              <textarea
                value={imageMetadataContent}
                onChange={(e) => setImageMetadataContent(e.target.value)}
                placeholder='{ "title": "...", "description": "...", "tags": [...] }'
                className="w-full h-80 p-2 font-mono text-sm border rounded-md resize-none mt-1 bg-muted/20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingImageMetadata(null)}>
              Annuler
            </Button>
            <Button onClick={confirmEditImageMetadata} disabled={savingImageMetadata}>
              {savingImageMetadata ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                "Enregistrer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
