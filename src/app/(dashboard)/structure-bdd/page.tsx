"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RenameNodeDialog } from "@/components/database/modals/RenameNodeDialog";
import { EditMetadataDialog } from "@/components/database/modals/EditMetadataDialog";
import { JsonEditorPanel } from "@/components/database/JsonEditorPanel";
import { PageTreeNodeItem } from "@/components/database/PageTreeNodeItem";
import { useWebTreeQuery, useImageTreeQuery, useResetWebMutation, useCompressSqliteMutation, useReindexVectorMutation, useDeleteImageMutation, useRenameImageMutation, useEditImageMetadataMutation } from "@/lib/database/queries";
import {
  Database,
  FolderTree,
  FileText,
  Eye,
  RefreshCw,
  RotateCcw,
  Trash2,
  Pencil,
  Download,
  FolderOpen,
  Bug,
  Cpu,
  Activity,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

import { loadLocalTreeFromSQLite, loadVectorTreeFromIndexedDB } from "@/lib/db/tree";
import { clientEngine, simpleTokenEmbedding, dataReference, localTreeService } from "@/lib/client-engine";
import { generateOpenScript, downloadScript } from "@/lib/client-engine/folder-opener";
import { dbInitService } from "@/lib/client-engine/init.service";
import type { UnifiedTreeNode } from "@/lib/db/types/unified-tree-node";
import { toast } from "sonner";
import { csrfFetch } from "@/lib/procedures/csrf-fetch";
import { syncManager, type SyncManagerStatus } from "@/lib/sync/sync-manager";
import type { DatabaseLocations } from "@/lib/client-engine/locations";
import { UnifiedTreeView } from "@/components/database/UnifiedTreeView";
import { ConfirmDialog } from "@/components/database/modals/ConfirmDialog";
import { AddNodeDialog } from "@/components/database/modals/AddNodeDialog";

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
  const [resettingVector, setResettingVector] = useState(false);
  const [addingNode, setAddingNode] = useState<{ tree: "web" | "local"; parentId: number | string } | null>(null);
  const [newNodeName, setNewNodeName] = useState("");
  const [newNodeType, setNewNodeType] = useState<"file" | "directory">("directory");
  const [renamingNode, setRenamingNode] = useState<{ tree: "web" | "local" | "images"; id: number | string; currentName: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description: string;
    resolve: (value: boolean) => void;
  } | null>(null);

  const showConfirm = useCallback(
    (description: string, title = "Confirmer ?") =>
      new Promise<boolean>((resolve) => {
        setConfirmDialog({ title, description, resolve });
      }),
    []
  );
  const [editingFile, setEditingFile] = useState<{ tree: "web" | "local"; path: string; content: string } | null>(null);
  const [previewingFile, setPreviewingFile] = useState<{ path?: string; name: string; tree: "web" | "local" } | null>(null);
  const [previewingImageId, setPreviewingImageId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{ content?: string; dataUrl?: string; mimeType: string; name: string; size: number; isText: boolean } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [activeView, setActiveView] = useState<"web" | "local" | "vector" | "images" | "comparison">("web");
  const [showOnlyVectorized, setShowOnlyVectorized] = useState(false);
  const [vectorizedPaths, setVectorizedPaths] = useState<Set<string>>(new Set());
  const [vectorizedCount, setVectorizedCount] = useState(0);
  // ── Image metadata editor state ──────────────────────────────────────────────
  const [editingImageMetadata, setEditingImageMetadata] = useState<{ id: string; name: string; content: string } | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncManagerStatus | null>(null);
  const [dbLocations, setDbLocations] = useState<DatabaseLocations | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);

  const loadTrees = useCallback(async () => {
    console.log("[StructureBDD] loadTrees start");
    setLoading(true);
    setWebError(null);
    setLocalError(null);
    setVectorError(null);

    const enginePromise = clientEngine.init();

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

    await Promise.all([localPromise, vectorPromise]);
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

    useEffect(() => {
      if (!syncManager.isInitialized()) return;
      let cancelled = false;
      const injectWebFiles = async () => {
        try {
          const result = await syncManager.injectWebFilesToLocal();
          if (cancelled) return;
          if (result.injected > 0 || result.created > 0) {
            console.log("[StructureBDD] web files injected to local", result);
            toast.success(`Injection web → locale : ${result.injected} fichiers, ${result.created} dossiers créés`);
          }
        } catch {
          // ignore injection errors
        }
      };
      injectWebFiles();
      return () => { cancelled = true; };
    }, [loadTrees]);

  const updateDbStatus = useCallback(async () => {
    await dbInitService.initialize({ autoSync: false, autoVectorize: false });
    // setDbStatus({ sqlite: status.sqlite, vector: status.vector, json: status.json });
    // setLastSyncCount(0);
    // setVectorizedCountLocal(0);
  }, []);


  const handleQuickVectorize = useCallback(async () => {
    try {
      const { getAllFiles } = await import('@/lib/db/db');
      const files = await getAllFiles();
      let count = 0;
      for (const file of files) {
        const content = typeof file.content === 'string' ? file.content : '';
        if (content && content.length > 0) {
          const embedding = simpleTokenEmbedding(content);
          await clientEngine.addVectorDocument({
            id: `file-${file.id}`,
            name: file.name,
            originalPath: file.path || file.name,
            relativePath: file.path || file.name,
            chunks: [{ documentId: `file-${file.id}`, documentName: file.name, chunkIndex: 0, content, embedding, metadata: {} }],
            metadata: {}
          });
          count++;
        }
      }
      // setVectorizedCountLocal(count);
      await loadTrees();
      toast.success(`Vectorisé: ${count} fichiers`);
    } catch {
      toast.error('Vectorization failed');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadTrees]);

    useEffect(() => {
      updateDbStatus();
    }, [updateDbStatus]);

    const { data: webTreeData, error: webTreeError } = useWebTreeQuery();
    const { data: imageTreeData, error: imageTreeError } = useImageTreeQuery();
    const resetWebMutation = useResetWebMutation();
    const compressSqliteMutation = useCompressSqliteMutation();
    const reindexVectorMutation = useReindexVectorMutation();
    const deleteImageMutation = useDeleteImageMutation();
    const renameImageMutation = useRenameImageMutation();
    const editImageMetadataMutation = useEditImageMetadataMutation();

    useEffect(() => {
      if (webTreeData) {
        setWebTree(webTreeData);
      }
    }, [webTreeData]);

    useEffect(() => {
      if (imageTreeData) {
        setImageTree(imageTreeData);
      }
    }, [imageTreeData]);

    useEffect(() => {
      if (webTreeError) {
        setWebError(webTreeError instanceof Error ? webTreeError.message : 'Unknown error');
      }
    }, [webTreeError]);

    useEffect(() => {
      if (imageTreeError) {
        setImageError(imageTreeError instanceof Error ? imageTreeError.message : 'Unknown error');
      }
    }, [imageTreeError]);

    useEffect(() => {
      const loadLocations = async () => {
        try {
          const { getDatabaseLocations } = await import('@/lib/client-engine/locations');
          setDbLocations(await getDatabaseLocations());
        } catch {
          // locations non disponibles
        }
      };
      loadLocations();
    }, []);

    const handleResetWeb = async () => {
      const confirmed = await showConfirm(
        "Remise à zéro de la BDD Web : toutes les données web seront réinitialisées à l'état initial. Continuer ?"
      );
      if (!confirmed) return;
      console.log("[StructureBDD] reset web start");

      setResettingWeb(true);
      try {
        const { script, filename } = await dataReference.ensurePhysicalDataStructure()
        const blob = new Blob([script], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        toast.info('📥 Script de création de la structure .data téléchargé. Exécutez-le avant de continuer.')

        await resetWebMutation.mutateAsync();
        await loadTrees();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Reset failed";
        console.error("[StructureBDD] reset web error", msg);
        setWebError(msg);
        toast.error("Erreur lors de la remise à zéro de la BDD Web");
      } finally {
        setResettingWeb(false);
      }
    };









  const handleResetVector = async () => {
      const confirmed = await showConfirm(
        "Vider la BDD vectorielle (IndexedDB) ? Tous les documents, chunks et nœuds de l'arborescence vectorielle seront supprimés."
      );
      if (!confirmed) return;
     console.log("[StructureBDD] clear vector store start");

     setResettingVector(true);
     try {
       const { script, filename } = await dataReference.ensurePhysicalDataStructure()
       const blob = new Blob([script], { type: 'text/plain' })
       const url = URL.createObjectURL(blob)
       const link = document.createElement('a')
       link.href = url
       link.download = filename
       document.body.appendChild(link)
       link.click()
       document.body.removeChild(link)
       URL.revokeObjectURL(url)
       toast.info('📥 Script de création de la structure .data téléchargé. Exécutez-le avant de continuer.')

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

       const handleOpenDevTools = () => {
         toast.info('💡 Ouvrez DevTools (F12) → Application → IndexedDB / Storage');
       };

       const handleOpenMirror = async (type: 'sqlite' | 'indexeddb' | 'media') => {
         try {
           toast.loading(`Génération du miroir ${type}...`);

           const response = await fetch(`/api/tree/mirror/${type}`, { method: 'POST' });
           if (!response.ok) throw new Error(`HTTP ${response.status}`);

           const data = await response.json();
           toast.dismiss();

           const script = generateOpenScript(
             data.absolutePath,
             `Miroir ${type} (${data.stats.directories} dossiers, ${data.stats.files} fichiers)`
           );
           downloadScript(script, `open-mirror-${type}`);

             toast.success(`✅ Miroir ${type} généré : ${data.stats.directories} dossiers`);
          } catch (e) {
           toast.dismiss();
           toast.error(`❌ Erreur : ${e instanceof Error ? e.message : 'unknown'}`);
         }
       };

        const handleOpenSqliteMirror = () => handleOpenMirror('sqlite');
        const handleOpenIndexedDBMirror = () => handleOpenMirror('indexeddb');
        const handleOpenMediaMirror = () => handleOpenMirror('media');

  const removeNodeById = useCallback((nodes: LocalNode[] | WebTreeNode[] | ImageNode[], id: string | number): (LocalNode[] | WebTreeNode[] | ImageNode[]) => {
    return nodes
      .filter((node) => node.id !== id)
      .map((node) => ({
        ...node,
        children: removeNodeById(node.children as LocalNode[] | WebTreeNode[] | ImageNode[], id),
      })) as LocalNode[] | WebTreeNode[] | ImageNode[];
   }, []);

  const handleDeleteLocal = useCallback(async (node: WebTreeNode | LocalNode) => {
     if (!("id" in node)) return;
     const confirmed = await showConfirm(`Supprimer "${node.name}" ?`);
     if (!confirmed) return;
    console.log("[StructureBDD] delete local", { id: node.id, name: node.name });

    setLocalTree((prev) => removeNodeById(prev, node.id) as LocalNode[]);
    try {
      const idStr = node.id as string;
      const numericId = parseInt(idStr.replace(/^(folder|file)-/, ""), 10);
      if (!isNaN(numericId)) {
        await localTreeService.deleteNode(numericId);
      }
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
    const confirmed = await showConfirm(`Supprimer "${node.name}" ?`);
    if (!confirmed) return;
    console.log("[StructureBDD] delete image", { id: node.id, name: node.name });

    setImageTree((prev) => removeNodeById(prev, node.id) as ImageNode[]);
    try {
      const imageId = String(node.id).replace(/^image-/, "");
      console.log("[StructureBDD] delete image api", { imageId });
      await deleteImageMutation.mutateAsync(imageId);
      await loadTrees();
      toast.success("Image supprimée");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      console.error("[StructureBDD] delete image error", msg);
      setImageError(msg);
      await loadTrees();
      toast.error("Erreur lors de la suppression");
    }
  }, [loadTrees, removeNodeById, deleteImageMutation]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Metadata editor for image nodes ─────────────────────────────────────────
  const handleEditImageMetadata = useCallback(async (node: ImageNode) => {
    const imageId = String(node.id).replace(/^image-/, "");
    console.log("[StructureBDD] edit image metadata", { imageId, name: node.name });
    try {
      const res = await fetch(`/api/images/${encodeURIComponent(imageId)}/metadata`);
      if (!res.ok) throw new Error("Failed to fetch metadata");
      const data = await res.json() as { metadata: Record<string, unknown> };
      setEditingImageMetadata({ id: imageId, name: node.name, content: JSON.stringify(data.metadata, null, 2) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors du chargement";
      console.error("[StructureBDD] edit image metadata error", msg);
      toast.error("Impossible de charger les métadonnées");
    }
  }, []);

  const handleSaveImageMetadata = async (content: string) => {
    if (!editingImageMetadata) return;
    try {
      const parsed = JSON.parse(content);
      await editImageMetadataMutation.mutateAsync({
        imageId: editingImageMetadata.id,
        metadata: parsed,
      });

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
      await loadTrees();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la sauvegarde";
      console.error("[StructureBDD] confirm edit image metadata error", msg);
      toast.error(msg);
      throw err;
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

  const handleAddLocal = useCallback((node: WebTreeNode | LocalNode) => {
    if (!("id" in node)) return;
    setAddingNode({ tree: "local", parentId: node.id as string });
    setNewNodeName("");
    setNewNodeType("directory");
  }, [setAddingNode, setNewNodeName, setNewNodeType]);

  const confirmAdd = async (name: string, type: "file" | "directory") => {
    if (!addingNode || !name.trim()) return;

    try {
      if (addingNode.tree === "web") {
        const res = await csrfFetch(`/api/tree/nodes/${addingNode.parentId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, type }),
        });
        if (!res.ok) throw new Error("Failed to add node");
      } else {
        const parentIdStr = addingNode.parentId as string;
        const numericParentId = parseInt(parentIdStr.replace(/^(folder|file)-/, ""), 10);
        const parentId = isNaN(numericParentId) ? null : numericParentId;
        if (type === "directory") {
          await localTreeService.createFolder(parentId, name);
        } else {
          await localTreeService.createFile(parentId, name, '');
        }
      }

      setAddingNode(null);
      setNewNodeName("");
      await loadTrees();
      if (addingNode.tree !== "web") {
      }
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

  const confirmRename = async (newName: string) => {
    if (!renamingNode || !newName.trim()) return;

    try {
      if (renamingNode.tree === "web") {
        const res = await csrfFetch(`/api/tree/nodes/${renamingNode.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName }),
        });
        if (!res.ok) throw new Error("Failed to rename node");
      } else if (renamingNode.tree === "images") {
        const imageId = String(renamingNode.id).replace(/^image-/, "");
        await renameImageMutation.mutateAsync({ imageId, name: newName });
      } else {
        const idStr = renamingNode.id as string;
        const numericId = parseInt(idStr.replace(/^(folder|file)-/, ""), 10);
        if (!isNaN(numericId)) {
          await localTreeService.renameNode(numericId, newName);
        }
      }

      setRenamingNode(null);
      setRenameValue("");
      await loadTrees();
      if (renamingNode.tree !== "web" && renamingNode.tree !== "images") {
      }
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
  }, [setEditingFile]);

  const handleSaveJson = async (content: string) => {
    if (!editingFile) return;

    try {
      if (editingFile.tree === "local") {
        const idStr = editingFile.path;
        const numericId = parseInt(idStr.replace(/^(folder|file)-/, ""), 10);
        if (!isNaN(numericId)) {
          await localTreeService.editFileContent(numericId, content);
          console.log("[StructureBDD] edit local done", { numericId });
          await loadTrees();
          toast.success("Fichier JSON modifié localement");
        }
      } else {
        const res = await csrfFetch(`/api/tree/nodes/${editingFile.path}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ metadata: content }),
        });
        if (!res.ok) throw new Error("Failed to edit file");

        setEditingFile(null);
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


  const handleCompressSqlite = async () => {
    const confirmed = await showConfirm("Compresser la base SQLite ? Cette action réduit la taille des données.");
    if (!confirmed) return;
    setCompressing(true);
    try {
      const result = await compressSqliteMutation.mutateAsync();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.success(`Compression OK : ${(result as any).compressed} éléments compressés`);
      await loadTrees();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Compression failed";
      toast.error(`Erreur : ${msg}`);
    } finally {
      setCompressing(false);
    }
  };

  const handleReindexVector = async () => {
    const confirmed = await showConfirm("Réindexer la base vectorielle ? Cette action va réindexer tous les documents.");
    if (!confirmed) return;
    setReindexing(true);
    try {
      const result = await reindexVectorMutation.mutateAsync();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.success(`Réindexation OK : ${(result as any).documentCount} docs, ${(result as any).chunkCount} chunks`);
      await loadTrees();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Reindex failed";
      toast.error(`Erreur : ${msg}`);
    } finally {
      setReindexing(false);
    }
  };

  const handleDeleteVectorNode = useCallback(async (node: WebTreeNode | LocalNode) => {
    const localNode = node as LocalNode;
    const confirmed = await showConfirm(`Supprimer "${localNode.name}" du vecteur ?`);
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

  const visibleWebTree = useMemo(() => filterWebTree(webTree), [webTree, filterWebTree]);
  const baseLocalTree = useMemo(() => filterLocalTree(localTree), [localTree, filterLocalTree]);
  const visibleLocalTree = useMemo(
    () => (showOnlyVectorized ? filterLocalTreeByVectorized(baseLocalTree) : baseLocalTree),
    [showOnlyVectorized, baseLocalTree, filterLocalTreeByVectorized]
  );

  const totalNodes = useMemo(() => {
    const count = (nodes: (WebTreeNode | LocalNode | ImageNode)[]): number =>
      nodes.reduce((acc, node) => acc + 1 + count(node.children), 0);
    return count;
  }, []);

  const activeTree = useMemo(() => {
    if (activeView === "local") return visibleLocalTree;
    if (activeView === "vector") return vectorTree;
    if (activeView === "images") return imageTree;
    return visibleWebTree;
  }, [activeView, visibleWebTree, visibleLocalTree, vectorTree, imageTree]);
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
  const totalActiveNodes = useMemo(() => totalNodes(activeTree), [activeTree, totalNodes]);

   const renderActions = () => {
     switch (activeView) {
       case "web":
         return (
           <>
             <Button
               size="sm"
               variant="outline"
               onClick={handleResetWeb}
               disabled={resettingWeb}
               className="flex-1"
             >
               <RotateCcw className={`h-4 w-4 mr-2 ${resettingWeb ? "animate-spin" : ""}`} />
               Réinitialiser PostgreSQL
             </Button>
            </>
           );
        case "local":
         return (
           <>
               <Button
                 size="sm"
                 variant="secondary"
                 onClick={handleCompressSqlite}
                 disabled={compressing}
                 className="flex-1"
               >
                 <Activity className={`h-4 w-4 mr-2 ${compressing ? "animate-spin" : ""}`} />
                 Compresser
               </Button>
               <Button
                 size="sm"
                 variant="default"
                 onClick={handleOpenSqliteMirror}
                 className="flex-1"
               >
                 <FolderOpen className="h-4 w-4 mr-2" />
                 📂 Ouvrir miroir SQLite
               </Button>
             </>
          );
         case "vector":
           return (
             <>
               <Button
                 size="sm"
                 variant="outline"
                 onClick={handleQuickVectorize}
                 disabled={vectorizing}
                 className="flex-1"
               >
                 <Database className={`h-4 w-4 mr-2 ${vectorizing ? "animate-spin" : ""}`} />
                 Vectoriser
               </Button>
               <Button
                 size="sm"
                 variant="outline"
                 onClick={handleReindexVector}
                 disabled={reindexing}
                 className="flex-1"
               >
                 <Cpu className={`h-4 w-4 mr-2 ${reindexing ? "animate-spin" : ""}`} />
                 Réindexer
               </Button>
               <Button
                 size="sm"
                 variant="destructive"
                 onClick={handleResetVector}
                 disabled={resettingVector}
                 className="flex-1"
               >
                 <Trash2 className={`h-4 w-4 mr-2 ${resettingVector ? "animate-spin" : ""}`} />
                 Vider IndexedDB
               </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleOpenIndexedDBMirror}
                  className="flex-1"
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  📂 Ouvrir miroir IndexedDB
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenDevTools}
                  className="flex-1"
                >
                  <Bug className="h-4 w-4 mr-2" />
                  🐛 DevTools
                </Button>
              </>
          );
         case "images":
           return (
             <>
               <Button
                 size="sm"
                 variant="outline"
                 onClick={handleVectorizeAllMedia}
                 disabled={vectorizing}
                 className="flex-1"
               >
                 <Database className={`h-4 w-4 mr-2 ${vectorizing ? "animate-spin" : ""}`} />
                 Connecter au RAG
               </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleOpenMediaMirror}
                  className="flex-1"
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  📂 Ouvrir miroir Médias
                </Button>
               <Button
                 size="sm"
                 variant="outline"
                 onClick={() => loadTrees()}
                 className="flex-1"
               >
                 <RefreshCw className="h-4 w-4 mr-2" />
                 Actualiser
               </Button>
             </>
           );
        default:
          return null;
      }
    };

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
          <Button
            variant={activeView === "comparison" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView("comparison")}
          >
            Comparaison
          </Button>
        </div>
      </div>

      {/* Carte Actions contextuelle */}
      <Card className="p-4 mt-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">
            Actions - {activeView === "web" ? "PostgreSQL" : activeView === "local" ? "SQLite" : activeView === "vector" ? "Vectorielle" : "Médias"}
          </h3>
          <span className="text-xs text-muted-foreground">
            {activeView === "web" && `${totalNodes(visibleWebTree)} nœuds`}
            {activeView === "local" && `${totalNodes(visibleLocalTree)} nœuds`}
            {activeView === "vector" && `${vectorDocs.length} documents`}
            {activeView === "images" && `${imageTree.length} médias`}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {renderActions()}
        </div>
      </Card>

      {activeView === "comparison" && (
        <div className="mt-6">
          <UnifiedTreeView
            source="all"
            onVectorize={handleVectorizeLocalFile as (node: UnifiedTreeNode, path: string) => Promise<void>}
            vectorizing={vectorizing}
            vectorizedPaths={vectorizedPaths}
          />
        </div>
      )}

      {activeView !== "comparison" && (
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
                <PageTreeNodeItem
                  key={node.id}
                   node={node}
                  depth={0}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onDelete={activeView === "local" ? handleDeleteLocal as any : activeView === "vector" ? handleDeleteVectorNode as any : activeView === "images" ? handleDeleteImage as any : undefined}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onAdd={activeView === "local" ? handleAddLocal as any : undefined}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onRename={activeView === "local" ? handleRenameLocal as any : activeView === "images" ? handleRenameImage as any : undefined}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onEdit={activeView === "local" ? handleEditJson as any : undefined}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onEditMetadata={handleEditImageMetadata as any}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onPreview={handlePreviewFile as any}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onVectorize={activeView === "local" ? handleVectorizeLocalFile as any : activeView === "images" ? handleVectorizeMedia as any : undefined}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onDownload={activeView === "web" ? handleDownloadDirectory as any : undefined}
                  vectorizedPaths={vectorizedPaths}
                  vectorizing={vectorizing}
                  expandAll={activeView === "vector" || activeView === "images"}
                />
              ))
            )}
          </div>
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
              <JsonEditorPanel
                node={editingFile}
                defaultContent={editingFile.content}
                onSave={handleSaveJson}
                onCancel={() => setEditingFile(null)}
              />
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
      )}

      {showLocationModal && dbLocations && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6 max-w-lg w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">📁 Emplacements des bases</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-medium">SQLite (OPFS)</p>
                <p className="text-muted-foreground font-mono text-xs bg-muted p-2 rounded">
                  navigator.storage.getDirectory() → nexaflow-client.sqlite
                </p>
              </div>
              <div>
                <p className="font-medium">IndexedDB (Vectorielle)</p>
                <p className="text-muted-foreground font-mono text-xs bg-muted p-2 rounded">
                  DevTools → Application → IndexedDB → nexaflow-vector-db
                </p>
              </div>
              <div>
                <p className="font-medium">IndexedDB (JSON)</p>
                <p className="text-muted-foreground font-mono text-xs bg-muted p-2 rounded">
                  DevTools → Application → IndexedDB → nexaflow-json-db
                </p>
              </div>
              <div>
                <p className="font-medium">Médias (serveur)</p>
                <p className="text-muted-foreground font-mono text-xs bg-muted p-2 rounded">
                  .data/registry/
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" onClick={() => setShowLocationModal(false)}>
                Fermer
              </Button>
              <Button variant="default" onClick={handleOpenDevTools}>
                🐛 Ouvrir DevTools
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Add Node Modal */}
      <AddNodeDialog
        isOpen={!!addingNode}
        onOpenChange={(open) => !open && setAddingNode(null)}
        defaultName={newNodeName}
        defaultType={newNodeType}
        onConfirm={(name, type) => confirmAdd(name, type)}
      />

      <RenameNodeDialog
        isOpen={!!renamingNode}
        onOpenChange={(open) => !open && setRenamingNode(null)}
        defaultName={renameValue}
        onConfirm={(newName) => confirmRename(newName)}
      />

      <ConfirmDialog
        isOpen={!!confirmDialog}
        onOpenChange={(open) => {
          if (!open) {
            confirmDialog?.resolve(false);
            setConfirmDialog(null);
          }
        }}
        title={confirmDialog?.title ?? ""}
        description={confirmDialog?.description ?? ""}
        onConfirm={() => {
          confirmDialog?.resolve(true);
          setConfirmDialog(null);
        }}
      />

      <EditMetadataDialog
        isOpen={!!editingImageMetadata}
        onOpenChange={(open) => !open && setEditingImageMetadata(null)}
        defaultContent={editingImageMetadata?.content || ""}
        name={editingImageMetadata?.name || ""}
        onSave={handleSaveImageMetadata}
      />
    </section>
  );
}
