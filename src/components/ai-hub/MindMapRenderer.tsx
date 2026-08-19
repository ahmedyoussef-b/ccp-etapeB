"use client";

import { useState, useCallback, useMemo, useRef } from "react";

export interface TreeNodeData {
  id: string;
  label: string;
  children?: TreeNodeData[];
}

interface LayoutNode {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children: LayoutNode[];
}

interface Link {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Props {
  data: TreeNodeData;
  width?: number;
  height?: number;
}

const NODE_HEIGHT = 34;
const HORIZONTAL_GAP = 16;
const VERTICAL_GAP = 56;

function computeSubtreeWidth(node: TreeNodeData): number {
  if (!node.children || node.children.length === 0) {
    return Math.max(node.label.length * 7.5 + 20, 72);
  }
  const children = node.children;
  let width = 0;
  children.forEach((child, i) => {
    width += computeSubtreeWidth(child);
    if (i < children.length - 1) width += HORIZONTAL_GAP;
  });
  return Math.max(width, node.label.length * 7.5 + 20);
}

function layoutTree(node: TreeNodeData, x: number, y: number, width: number): LayoutNode {
  const nodeWidth = Math.max(width, node.label.length * 7.5 + 20);
  const nodeX = x + width / 2;

  if (!node.children || node.children.length === 0) {
    return {
      id: node.id,
      label: node.label,
      x: nodeX,
      y,
      width: nodeWidth,
      height: NODE_HEIGHT,
      children: [],
    };
  }

  const childY = y + VERTICAL_GAP;
  const childCount = node.children.length;
  const totalChildWidth = node.children.reduce((sum, child) => sum + computeSubtreeWidth(child), 0) + (childCount - 1) * HORIZONTAL_GAP;
  let childX = x + (width - totalChildWidth) / 2;

  const children: LayoutNode[] = node.children.map((child) => {
    const cw = computeSubtreeWidth(child);
    const childNode = layoutTree(child, childX, childY, cw);
    childX += cw + HORIZONTAL_GAP;
    return childNode;
  });

  return {
    id: node.id,
    label: node.label,
    x: nodeX,
    y,
    width: nodeWidth,
    height: NODE_HEIGHT,
    children,
  };
}

function flatten(root: LayoutNode): { nodes: LayoutNode[]; links: Link[] } {
  const nodes: LayoutNode[] = [];
  const links: Link[] = [];

  function walk(node: LayoutNode): void {
    nodes.push(node);
    node.children.forEach((child) => {
      links.push({
        id: `${node.id}-${child.id}`,
        x1: node.x,
        y1: node.y + NODE_HEIGHT,
        x2: child.x,
        y2: child.y,
      });
      walk(child);
    });
  }

  walk(root);
  return { nodes, links };
}

export function MindMapRenderer({ data, width = 800, height = 520 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: width / 2, y: 32 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const layout = useMemo(() => {
    const root = layoutTree(data, -width / 2, 32, width);
    return flatten(root);
  }, [data, width]);

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setScale((s) => Math.max(0.3, Math.min(2.5, s + delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX - translate.x, y: e.clientY - translate.y });
  }, [translate]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isPanning) return;
    setTranslate({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    });
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const resetView = useCallback(() => {
    setScale(1);
    setTranslate({ x: width / 2, y: 32 });
  }, [width]);

  return (
    <div className="relative rounded-xl border border-border/60 bg-muted/10 overflow-hidden">
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
        <button
          onClick={() => setScale((s) => Math.max(0.3, s - 0.1))}
          className="h-8 w-8 rounded-lg bg-background/80 border border-border/60 text-xs font-medium hover:bg-muted backdrop-blur"
        >
          -
        </button>
        <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(scale * 100)}%</span>
        <button
          onClick={() => setScale((s) => Math.min(2.5, s + 0.1))}
          className="h-8 w-8 rounded-lg bg-background/80 border border-border/60 text-xs font-medium hover:bg-muted backdrop-blur"
        >
          +
        </button>
        <button
          onClick={resetView}
          className="h-8 px-2 rounded-lg bg-background/80 border border-border/60 text-xs font-medium hover:bg-muted backdrop-blur"
        >
          Reset
        </button>
      </div>

      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="w-full h-auto cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" className="text-muted-foreground/40" />
          </marker>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="currentColor" floodOpacity="0.1" />
          </filter>
        </defs>

        <g transform={`translate(${translate.x}, ${translate.y}) scale(${scale})`}>
          {layout.links.map((link) => (
            <line
              key={link.id}
              x1={link.x1}
              y1={link.y1}
              x2={link.x2}
              y2={link.y2}
              stroke="currentColor"
              className="text-muted-foreground/30"
              strokeWidth="2"
              markerEnd="url(#arrowhead)"
            />
          ))}

          {layout.nodes.map((node) => {
            const isRoot = node.y === 32;
            return (
              <g key={node.id} transform={`translate(${node.x - node.width / 2}, ${node.y})`}>
                <rect
                  width={node.width}
                  height={NODE_HEIGHT}
                  rx={isRoot ? 12 : 8}
                  className={
                    isRoot
                      ? "fill-primary/10 stroke-primary/40"
                      : "fill-background/80 stroke-border/60"
                  }
                  strokeWidth="1.5"
                  filter="url(#shadow)"
                />
                <text
                  x={node.width / 2}
                  y={NODE_HEIGHT / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={`text-xs font-medium ${isRoot ? "fill-primary" : "fill-foreground"}`}
                  style={{ fontSize: 12 }}
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
