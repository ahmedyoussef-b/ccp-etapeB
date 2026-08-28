'use client';

import { useCallback, useEffect, useMemo, useState, memo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Database,
  ChevronRight,
  ChevronDown,
  FolderTree,
  FileText,
  RefreshCw,
  Search,
  ImageOff,
} from 'lucide-react';
import type { UnifiedTreeNode, TreeNodeSource } from '@/lib/db/types/unified-tree-node';
import { UnifiedTreeService } from '@/lib/db/services/unified-tree.service';
import { MediaPreview } from './MediaPreview';

const iconMap: Record<string, React.ElementType> = {
  root: FolderTree,
  directory: FolderTree,
  file: FileText,
};

interface TreeNodeItemProps {
  node: UnifiedTreeNode;
  depth?: number;
  onVectorize?: (node: UnifiedTreeNode, path: string) => Promise<void> | void;
  vectorizing?: boolean;
  vectorizedPaths?: Set<string>;
  onMediaLoad?: (nodeId: string, result: { dataUrl: string; source: string }) => void;
}

const TreeNodeItem = memo(function TreeNodeItem({
  node,
  depth = 0,
  onVectorize,
  vectorizing = false,
  vectorizedPaths,
  onMediaLoad,
}: TreeNodeItemProps) {
  const [expanded, setExpanded] = useState(false);
  const display = UnifiedTreeService.toDisplay(node);
  const Icon = iconMap[node.type] ?? FileText;
  const isFolder = node.type === 'directory' || node.type === 'root';
  const isVectorized = useMemo(() => {
    if (!vectorizedPaths) return false;
    return vectorizedPaths.has(node.path) || vectorizedPaths.has(node.id);
  }, [vectorizedPaths, node.path, node.id]);

  const isMedia = node.type === 'file' && (node.name.match(/\.(jpg|jpeg|png|gif|webp|mp4|webm|ogg|mp3|wav)$/i) || Boolean(node.metadata['kind']));

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
        {display.badges.map((badge) => (
          <Badge key={badge.type} variant={badge.variant} className="text-xs">
            {badge.label}
          </Badge>
        ))}
        {isMedia && (
          <Badge variant="outline" className="text-xs">
            <ImageOff className="h-3 w-3 mr-1" />
            média
          </Badge>
        )}
        {isFolder && node.source === 'local' && onVectorize && (
          <Button
            variant="ghost"
            size="icon"
            className={`h-6 w-6 ${isVectorized ? 'text-green-500' : 'text-blue-500'}`}
            disabled={vectorizing}
            onClick={(e) => {
              e.stopPropagation();
              onVectorize(node, node.path);
            }}
            title={isVectorized ? 'Déjà vectorisé' : 'Vectoriser'}
          >
            <Database className="h-3 w-3" />
            {isVectorized && <span className="absolute h-1.5 w-1.5 rounded-full bg-green-500 -top-0.5 -right-0.5" />}
          </Button>
        )}
      </div>

      {expanded && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              onVectorize={onVectorize}
              vectorizing={vectorizing}
              vectorizedPaths={vectorizedPaths}
              onMediaLoad={onMediaLoad}
            />
          ))}
        </div>
      )}

      {isMedia && expanded && (
        <div style={{ paddingLeft: `${depth * 16 + 24}px` }} className="mt-1">
          <MediaPreview
            nodeId={node.id}
            title={node.name}
            kind={node.metadata['kind'] as 'image' | 'video' || 'image'}
            onLoad={(result) => onMediaLoad?.(node.id, result)}
          />
        </div>
      )}
    </div>
  );
});

interface UnifiedTreeViewProps {
  source?: TreeNodeSource | 'all';
  onVectorize?: (node: UnifiedTreeNode, path: string) => Promise<void> | void;
  vectorizing?: boolean;
  vectorizedPaths?: Set<string>;
  onMediaLoad?: (nodeId: string, result: { dataUrl: string; source: string }) => void;
}

export function UnifiedTreeView({ source, onVectorize, vectorizing, vectorizedPaths, onMediaLoad }: UnifiedTreeViewProps) {
  const [nodes, setNodes] = useState<UnifiedTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tree = await UnifiedTreeService.loadWebTree();
      setNodes(tree);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const filteredNodes = useMemo(() => {
    let result = nodes;
    if (source) {
      result = UnifiedTreeService.filterBySource(result, source);
    }
    if (search.trim()) {
      result = UnifiedTreeService.search(result, search);
    }
    return result;
  }, [nodes, source, search]);

  const stats = useMemo(() => UnifiedTreeService.getStats(nodes), [nodes]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Chargement de l&apos;arborescence...</p>;
  }

  if (error) {
    return <p className="text-sm text-muted-foreground">Erreur : {error}</p>;
  }

  return (
    <Card>
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderTree className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Arborescence {source ? `(${source})` : 'unifiée'}
          </h3>
          <Badge variant="secondary" className="text-xs">
            {stats.total} nœuds
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 w-32 text-xs pl-7"
            />
          </div>
          <Button size="icon" variant="ghost" onClick={loadTree} className="h-7 w-7">
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="p-2 max-h-[600px] overflow-y-auto">
        {filteredNodes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée.</p>
        ) : (
          filteredNodes.map((node) => (
            <TreeNodeItem
              key={node.id}
              node={node}
              depth={0}
              onVectorize={onVectorize}
              vectorizing={vectorizing}
              vectorizedPaths={vectorizedPaths}
              onMediaLoad={onMediaLoad}
            />
          ))
        )}
      </div>
    </Card>
  );
}
