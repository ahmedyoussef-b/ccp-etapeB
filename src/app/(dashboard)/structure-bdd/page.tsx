"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Database,
  ChevronRight,
  ChevronDown,
  FolderTree,
  FileText,
  Image,
  Users,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

type TreeNode = {
  id: number;
  name: string;
  type: string;
  metadata: string | null;
  parentId: number | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  children: TreeNode[];
};

type TreeResponse = {
  roots: TreeNode[];
};

const iconMap: Record<string, LucideIcon> = {
  root: FolderTree,
  category: FolderTree,
  group: Users,
  item: FileText,
};

function TreeNodeItem({
  node,
  depth = 0,
}: {
  node: TreeNode;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const Icon = iconMap[node.type] ?? FileText;

  return (
    <div>
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
        <span className="text-sm font-medium text-foreground">{node.name}</span>
        <Badge variant="secondary" className="text-xs">
          {node.type}
        </Badge>
      </div>

      {expanded && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function StructureBDDPage() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/tree")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch tree");
        return res.json();
      })
      .then((data: TreeResponse) => {
        setTree(data.roots);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filterTree = (nodes: TreeNode[]): TreeNode[] => {
    if (!search.trim()) return nodes;

    const term = search.toLowerCase();

    const matches = (node: TreeNode): boolean => {
      const nameMatch = node.name.toLowerCase().includes(term);
      const typeMatch = node.type.toLowerCase().includes(term);
      const childMatch = node.children.some(matches);
      return nameMatch || typeMatch || childMatch;
    };

    const prune = (nodes: TreeNode[]): TreeNode[] => {
      return nodes
        .filter(matches)
        .map((node) => ({
          ...node,
          children: prune(node.children),
        }));
    };

    return prune(nodes);
  };

  const visibleTree = filterTree(tree);
  const totalNodes = (nodes: TreeNode[]): number =>
    nodes.reduce((acc, node) => acc + 1 + totalNodes(node.children), 0);
  const nodeCount = totalNodes(visibleTree);

  if (loading) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-muted-foreground">Chargement de la structure...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-red-500">Erreur : {error}</p>
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
            Arborescence des données · {nodeCount} nœud{nodeCount > 1 ? "s" : ""}
          </p>
        </div>

        <div className="relative">
          <Input
            placeholder="Rechercher dans l'arborescence..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-80"
          />
        </div>
      </div>

      <Card className="mt-8">
        <div className="border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderTree className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Arborescence</h3>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs">
            Actualiser
          </Button>
        </div>

        <div className="p-2">
          {visibleTree.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucun nœud trouvé.
            </p>
          ) : (
            visibleTree.map((node) => <TreeNodeItem key={node.id} node={node} />)
          )}
        </div>
      </Card>
    </section>
  );
}
