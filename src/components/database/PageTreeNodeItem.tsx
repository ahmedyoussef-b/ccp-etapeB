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

export interface PageTreeNodeItemProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node: any;
  depth?: number;
  path?: string;
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

export const PageTreeNodeItem = memo(function PageTreeNodeItem({
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
}: PageTreeNodeItemProps) {
  const [expanded, setExpanded] = useState(expandAll);
  const [showActions, setShowActions] = useState(false);
  const isLocal = "path" in node;
  const isImage = node.type === "image";
  const nodeType = isImage ? "image" : isLocal ? node.type : node.type;
  const Icon = iconMap[nodeType] ?? FileText;
  const nodePath = path ? `${path}/${node.name}` : node.name;

  const isFileNode = nodeType === "file" || nodeType === "item" || isImage;
  const hasLocalContent = isLocal && !isImage && nodeType === "file" && node.content !== undefined && node.content !== null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isNodeVectorized = (n: any, basePath: string): boolean => {
    if (!vectorizedPaths) return false;
    const nodePath = basePath ? `${basePath}/${n.name}` : n.name;
    if (n.type === "file") {
      return vectorizedPaths.has(nodePath);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return n.children.some((child: any) => isNodeVectorized(child, nodePath));
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
    return isNodeVectorized(node, path);
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
                  onAdd?.(node);
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
                  onDownload?.(node);
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
                  onEdit?.(node);
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
                  onVectorize?.(node, nodePath);
                }}
                title={isVectorized ? "Déjà vectorisé" : "Vectoriser"}
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
                  onPreview?.(node);
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
            <PageTreeNodeItem
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
});
