"use client";

import { memo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  ChevronDown,
  FolderTree,
  FileText,
  FileJson,
  Eye,
  Database,
  Image,
  Plus,
  Pencil,
  Trash2,
  Download,
  type LucideIcon,
} from "lucide-react";

export interface UnifiedTreeNodeProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node: any;
  depth: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDelete?: (node: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAdd?: (node: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onRename?: (node: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEdit?: (node: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEditMetadata?: (node: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onPreview?: (node: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onVectorize?: (node: any, path: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDownload?: (node: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderMedia?: (node: any, depth: number) => React.ReactNode;
  vectorizedPaths?: Set<string>;
  vectorizing?: boolean;
  expandAll?: boolean;
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

export interface UnifiedTreeNodeProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node: any;
  depth: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDelete?: (node: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAdd?: (node: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onRename?: (node: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEdit?: (node: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEditMetadata?: (node: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onPreview?: (node: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onVectorize?: (node: any, path: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDownload?: (node: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderMedia?: (node: any, depth: number) => React.ReactNode;
  vectorizedPaths?: Set<string>;
  vectorizing?: boolean;
  expandAll?: boolean;
}

export const UnifiedTreeNode = memo(function UnifiedTreeNode({
  node,
  depth = 0,
  onDelete,
  onAdd,
  onRename,
  onEdit,
  onEditMetadata,
  onPreview,
  onVectorize,
  onDownload,
  renderMedia,
  vectorizedPaths,
  vectorizing = false,
  expandAll = false,
}: UnifiedTreeNodeProps) {
  const [expanded, setExpanded] = useState(expandAll);
  const [showActions] = useState(false);

  const nodeType = node.type;
  const Icon = iconMap[nodeType] ?? FileText;
  const nodePath = node.path || node.name;

  const isFolder = nodeType === "directory" || nodeType === "folder" || nodeType === "root";
  const isFileNode = nodeType === "file" || nodeType === "item" || nodeType === "image";
  const hasLocalContent = Boolean(node.content && node.content.trim && node.content.trim() !== "");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isNodeVectorized = (n: any, basePath: string): boolean => {
    if (!vectorizedPaths) return false;
    const currentPath = basePath ? `${basePath}/${n.name}` : n.name;
    if (n.type === "file") {
      return vectorizedPaths.has(currentPath);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return n.children.some((child: any) => isNodeVectorized(child, currentPath));
  };

  const isVectorized = (() => {
    if (!vectorizedPaths) return false;
    if (nodeType === "image") {
      const imageId = String(node.id).replace(/^image-/, "");
      return (
        vectorizedPaths.has(`media-${imageId}`) ||
        vectorizedPaths.has(`media-${node.id}`) ||
        vectorizedPaths.has(nodePath) ||
        vectorizedPaths.has(node.name)
      );
    }
    if (node.path) {
      return isNodeVectorized(node, "");
    }
    return false;
  })();

  const getBadgeVariant = () => {
    if (nodeType === "image") return "default";
    if (isFolder) return "default";
    return "secondary";
  };

  const getBadgeText = () => {
    if (nodeType === "image") return "image";
    if (isFolder) return nodeType === "folder" ? "dossier" : nodeType;
    return nodeType;
  };

  const isMedia = nodeType === "image" || (nodeType === "file" && (
    node.name.match(/\.(jpg|jpeg|png|gif|webp|mp4|webm|ogg|mp3|wav)$/i) ||
    (node.metadata && typeof node.metadata === "object" && (node.metadata as Record<string, unknown>)["kind"])
  ));

  return (
    <div className="group relative">
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
            {isFolder && onAdd && (
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
            {isFolder && onDownload && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-green-500"
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload(node);
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
                  onEdit(node);
                }}
                title="Éditer"
              >
                <FileJson className="h-3 w-3" />
              </Button>
            )}
            {nodeType === "image" && onEditMetadata && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-amber-500"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditMetadata(node);
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
                className={`h-6 w-6 ${isVectorized ? "text-green-500" : "text-blue-500"}`}
                disabled={vectorizing}
                onClick={(e) => {
                  e.stopPropagation();
                  onVectorize(node, nodePath);
                }}
                title={isVectorized ? "Déjà vectorisé" : "Vectoriser"}
              >
                <Database className="h-3 w-3" />
                {isVectorized && (
                  <span className="absolute h-1.5 w-1.5 rounded-full bg-green-500 -top-0.5 -right-0.5" />
                )}
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
          {node.children.map((child: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
            <UnifiedTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
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

      {isMedia && expanded && renderMedia && renderMedia(node, depth)}
    </div>
  );
});
