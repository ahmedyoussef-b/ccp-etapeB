export interface TreeNodeLike {
  id: number | string;
  name: string;
  type: string;
  parentId: number | string | null;
  order: number;
  path: string;
  size?: number;
  content?: string | null;
  children: TreeNodeLike[];
}

export function flattenTree(nodes: TreeNodeLike[]): TreeNodeLike[] {
  const result: TreeNodeLike[] = [];
  for (const node of nodes) {
    if (node.type === 'image') continue;
    result.push(node);
    if (node.children && node.children.length > 0) {
      result.push(...flattenTree(node.children));
    }
  }
  return result;
}

export function countNodes(nodes: TreeNodeLike[]): number {
  return nodes.reduce((acc, node) => acc + 1 + countNodes(node.children || []), 0);
}

export function auditTree(nodes: TreeNodeLike[], label: string): void {
  const flattened = flattenTree(nodes);
  const byType = flattened.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log(`[AUDIT][${label}]`, {
    totalRaw: countNodes(nodes),
    totalFlattened: flattened.length,
    byType,
    first10Paths: flattened.slice(0, 10).map(n => n.path || n.name),
  });
}

export function logTreeStructure(nodes: TreeNodeLike[], label: string, maxDepth: number = 3): void {
  console.log(`[TREE][${label}]`);
  
  const printNode = (node: TreeNodeLike, depth: number) => {
    const indent = '  '.repeat(depth);
    const icon = node.type === 'directory' || node.type === 'folder' ? '📁' : node.type === 'file' ? '📄' : '📦';
    console.log(`${indent}${icon} [${node.type}] ${node.name} (path: ${node.path || node.name})`);
    
    if (depth < maxDepth && node.children && node.children.length > 0) {
      for (const child of node.children) {
        printNode(child, depth + 1);
      }
    } else if (node.children && node.children.length > 0) {
      console.log(`${indent}  ... ${node.children.length} enfants (profondeur > ${maxDepth})`);
    }
  };
  
  for (const node of nodes) {
    printNode(node, 0);
  }
}

export function buildTreeFromFlatRows(rows: Array<{ id: number; uuid: string; name: string; type: string; parent_id: number | null; path: string }>): TreeNodeLike[] {
  const map = new Map<number, TreeNodeLike>();
  const roots: TreeNodeLike[] = [];
  
  for (const row of rows) {
    map.set(row.id, {
      id: row.id,
      name: row.name,
      type: row.type,
      parentId: row.parent_id,
      order: 0,
      path: row.path || row.name,
      children: [],
    });
  }
  
  for (const row of rows) {
    const node = map.get(row.id);
    if (!node) continue;
    
    if (row.parent_id !== null && map.has(row.parent_id)) {
      map.get(row.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  
  return roots;
}
