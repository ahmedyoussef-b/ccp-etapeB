'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FolderTree,
  RefreshCw,
  Search,
} from 'lucide-react';
import type { UnifiedTreeNode, TreeNodeSource } from '@/lib/db/types/unified-tree-node';
import { UnifiedTreeService } from '@/lib/db/services/unified-tree.service';
import { MediaPreview } from './MediaPreview';
import { UnifiedTreeNode as TreeNodeComponent } from './UnifiedTreeNode';

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
            <TreeNodeComponent
              key={node.id}
              node={node}
              depth={0}
              onVectorize={onVectorize as any} // eslint-disable-line @typescript-eslint/no-explicit-any
              vectorizing={vectorizing}
              vectorizedPaths={vectorizedPaths}
              renderMedia={(n, d) => (
                <div style={{ paddingLeft: `${d * 16 + 24}px` }} className="mt-1">
                  <MediaPreview
                    nodeId={String(n.id)}
                    title={n.name}
                    kind={((n.metadata as any)?.['kind'] as 'image' | 'video') || 'image'} // eslint-disable-line @typescript-eslint/no-explicit-any
                    onLoad={(result) => onMediaLoad?.(String(n.id), result)}
                  />
                </div>
              )}
            />
          ))
        )}
      </div>
    </Card>
  );
}
