'use client';

import { useState, memo, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FolderTree,
  FileText,
  ChevronRight,
  ChevronDown,
  Search,
  RefreshCw,
} from 'lucide-react';
import type { UnifiedTreeNode, TreeNodeSource } from '@/lib/db/types/unified-tree-node';

const iconMap: Record<string, React.ElementType> = {
  root: FolderTree,
  directory: FolderTree,
  file: FileText,
  item: FileText,
};

interface AdminTreeViewProps {
  data: UnifiedTreeNode[];
  source: TreeNodeSource;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onAction?: (action: string, nodeId: string) => void;
}

interface TreeNodeItemProps {
  node: UnifiedTreeNode;
  depth: number;
  onAction?: (action: string, nodeId: string) => void;
}

const TreeNodeItem = memo(function TreeNodeItem({ node, depth, onAction }: TreeNodeItemProps) {
  const [expanded, setExpanded] = useState(false);
  const Icon = iconMap[node.type] ?? FileText;
  const isFolder = node.type === 'directory' || node.type === 'root';

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
        <Badge variant={isFolder ? 'default' : 'secondary'} className="text-xs">
          {node.type}
        </Badge>
        {node.source === 'local' && (
          <Badge variant="outline" className="text-xs">
            {node.syncStatus}
          </Badge>
        )}
        {node.source === 'vector' && (
          <Badge variant="outline" className="text-xs">
            {node.indexStatus}
          </Badge>
        )}
      </div>

      {expanded && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              onAction={onAction}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export function AdminTreeView({ data, source, loading = false, error = null, onRefresh, onAction }: AdminTreeViewProps) {
  const [search, setSearch] = useState('');

  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const term = search.toLowerCase();
    const matches = (node: UnifiedTreeNode): boolean => {
      const nameMatch = node.name.toLowerCase().includes(term);
      const childMatch = node.children.some(matches);
      return nameMatch || childMatch;
    };
    const prune = (nodes: UnifiedTreeNode[]): UnifiedTreeNode[] => {
      return nodes
        .filter(matches)
        .map((node) => ({
          ...node,
          children: prune(node.children),
        }));
    };
    return prune(data);
  }, [data, search]);

  const stats = useMemo(() => {
    let total = 0;
    let folders = 0;
    let files = 0;
    const count = (nodes: UnifiedTreeNode[]) => {
      for (const node of nodes) {
        total++;
        if (node.type === 'directory' || node.type === 'root') folders++;
        else files++;
        if (node.children.length > 0) count(node.children);
      }
    };
    count(data);
    return { total, folders, files };
  }, [data]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Chargement de l&apos;arborescence...</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive">Erreur : {error}</p>;
  }

  return (
    <Card>
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderTree className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Arborescence {source}
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
          {onRefresh && (
            <Button size="icon" variant="ghost" onClick={onRefresh} className="h-7 w-7">
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      <div className="p-2 max-h-[500px] overflow-y-auto">
        {filteredData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {search ? 'Aucun résultat.' : 'Aucune donnée.'}
          </p>
        ) : (
          filteredData.map((node) => (
            <TreeNodeItem
              key={node.id}
              node={node}
              depth={0}
              onAction={onAction}
            />
          ))
        )}
      </div>
    </Card>
  );
}
