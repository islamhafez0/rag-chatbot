/**
 * Tiny layered-DAG layout (Sugiyama-lite) for the diagram block.
 * Pure and deterministic: cycle breaking (DFS back edges), longest-path
 * layering, two barycenter passes to reduce crossings, then coordinates
 * for a top-to-bottom SVG. No dependencies, no LLM markup ever executed.
 */

export interface DiagramInputNode {
  id: string;
  label: string;
  detail?: string | null;
}
export interface DiagramInputEdge {
  from: string;
  to: string;
  label?: string | null;
}

export interface LaidOutNode extends DiagramInputNode {
  layer: number;
  lines: string[];
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface LaidOutEdge extends DiagramInputEdge {
  path: string;
  /** Label anchor (bezier midpoint). */
  lx: number;
  ly: number;
  /** Edge that points back up (cycle) and is routed around the side. */
  back: boolean;
}
export interface DiagramLayout {
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
  width: number;
  height: number;
  layers: number;
}

export const NODE_W = 172;
const LINE_H = 16;
const PAD_Y = 13;
const GAP_X = 26;
const MARGIN = 12;
const MAX_LINE = 21;
const MAX_LINES = 3;

/** Greedy word wrap into at most MAX_LINES lines (ellipsis on overflow). */
export function wrapLabel(label: string, max = MAX_LINE, maxLines = MAX_LINES): string[] {
  const words = label.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w0 of words) {
    const w = w0.length > max ? `${w0.slice(0, max - 1)}…` : w0;
    if (!cur) cur = w;
    else if (`${cur} ${w}`.length <= max) cur = `${cur} ${w}`;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    const last = kept[maxLines - 1];
    kept[maxLines - 1] = last.length >= max ? `${last.slice(0, max - 1)}…` : `${last}…`;
    return kept;
  }
  return lines.length ? lines : [""];
}

export function layoutDiagram(
  inNodes: DiagramInputNode[],
  inEdges: DiagramInputEdge[],
): DiagramLayout {
  const ids = new Set(inNodes.map((n) => n.id));
  const nodes = inNodes.filter((n, i) => inNodes.findIndex((m) => m.id === n.id) === i);
  const edges = inEdges.filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to);

  const out = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  for (const e of edges) out.get(e.from)!.push(e.to);

  // 1. Break cycles: DFS in input order; edges to a node on the stack are back edges.
  const state = new Map<string, 0 | 1 | 2>();
  const backKeys = new Set<string>();
  const key = (a: string, b: string) => `${a}\u0000${b}`;
  const visit = (id: string) => {
    state.set(id, 1);
    for (const t of out.get(id) ?? []) {
      const s = state.get(t) ?? 0;
      if (s === 1) backKeys.add(key(id, t));
      else if (s === 0) visit(t);
    }
    state.set(id, 2);
  };
  // Prefer true sources as DFS roots so the "natural" direction wins.
  const indeg = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (const e of edges) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  for (const n of nodes) if ((indeg.get(n.id) ?? 0) === 0 && !state.get(n.id)) visit(n.id);
  for (const n of nodes) if (!state.get(n.id)) visit(n.id);

  const fwd = edges.filter((e) => !backKeys.has(key(e.from, e.to)));

  // 2. Longest-path layering over the DAG (Kahn order).
  const layer = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  const deg = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (const e of fwd) deg.set(e.to, (deg.get(e.to) ?? 0) + 1);
  const queue = nodes.filter((n) => deg.get(n.id) === 0).map((n) => n.id);
  while (queue.length) {
    const id = queue.shift()!;
    for (const e of fwd) {
      if (e.from !== id) continue;
      layer.set(e.to, Math.max(layer.get(e.to)!, layer.get(id)! + 1));
      deg.set(e.to, deg.get(e.to)! - 1);
      if (deg.get(e.to) === 0) queue.push(e.to);
    }
  }
  const layerCount = Math.max(0, ...layer.values()) + 1;

  // 3. Order within layers: input order, then barycenter sweeps down & up.
  const rows: string[][] = Array.from({ length: layerCount }, () => []);
  for (const n of nodes) rows[layer.get(n.id)!].push(n.id);
  const pos = new Map<string, number>();
  const index = () => rows.forEach((r) => r.forEach((id, i) => pos.set(id, i)));
  index();
  const sweep = (down: boolean) => {
    const range = down ? [...rows.keys()].slice(1) : [...rows.keys()].reverse().slice(1);
    for (const li of range) {
      const bary = (id: string) => {
        const nb = fwd
          .filter((e) => (down ? e.to === id : e.from === id))
          .map((e) => pos.get(down ? e.from : e.to)!)
          .filter((v) => v !== undefined);
        return nb.length ? nb.reduce((a, b) => a + b, 0) / nb.length : pos.get(id)!;
      };
      rows[li] = [...rows[li]].sort((a, b) => bary(a) - bary(b) || pos.get(a)! - pos.get(b)!);
      index();
    }
  };
  sweep(true);
  sweep(false);
  sweep(true);

  // 4. Coordinates.
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const lines = new Map(nodes.map((n) => [n.id, wrapLabel(n.label)]));
  const heightOf = (id: string) => PAD_Y * 2 + lines.get(id)!.length * LINE_H;
  const rowH = rows.map((r) => Math.max(0, ...r.map(heightOf)));
  const hasLabels = edges.some((e) => e.label);
  const gapY = hasLabels ? 62 : 44;
  const widest = Math.max(1, ...rows.map((r) => r.length));
  const sideRoom = backKeys.size > 0 ? 52 : 0;
  const innerW = widest * NODE_W + (widest - 1) * GAP_X;
  const width = innerW + MARGIN * 2 + sideRoom;

  const laid = new Map<string, LaidOutNode>();
  let y = MARGIN;
  rows.forEach((r, li) => {
    const rowW = r.length * NODE_W + (r.length - 1) * GAP_X;
    let x = MARGIN + (innerW - rowW) / 2;
    for (const id of r) {
      const h = heightOf(id);
      const n = byId.get(id)!;
      laid.set(id, {
        ...n,
        layer: li,
        lines: lines.get(id)!,
        x,
        y: y + (rowH[li] - h) / 2,
        w: NODE_W,
        h,
      });
      x += NODE_W + GAP_X;
    }
    y += rowH[li] + gapY;
  });
  const height = y - gapY + MARGIN;

  // Spread multiple ports along a node side so parallel edges stay distinct.
  const outPorts = new Map<string, DiagramInputEdge[]>();
  const inPorts = new Map<string, DiagramInputEdge[]>();
  for (const e of fwd) {
    (outPorts.get(e.from) ?? outPorts.set(e.from, []).get(e.from)!).push(e);
    (inPorts.get(e.to) ?? inPorts.set(e.to, []).get(e.to)!).push(e);
  }
  const portX = (n: LaidOutNode, list: DiagramInputEdge[] | undefined, e: DiagramInputEdge, other: (e: DiagramInputEdge) => LaidOutNode) => {
    const sorted = [...(list ?? [e])].sort((a, b) => other(a).x - other(b).x);
    const k = sorted.length;
    const i = Math.max(0, sorted.indexOf(e));
    const span = Math.min(n.w * 0.6, (k - 1) * 22);
    return n.x + n.w / 2 - span / 2 + (k > 1 ? (span * i) / (k - 1) : 0);
  };

  const laidEdges: LaidOutEdge[] = edges.map((e) => {
    const a = laid.get(e.from)!;
    const b = laid.get(e.to)!;
    const back = backKeys.has(key(e.from, e.to)) || b.layer <= a.layer;
    if (back) {
      const x1 = a.x + a.w;
      const y1 = a.y + a.h / 2;
      const x2 = b.x + b.w;
      const y2 = b.y + b.h / 2;
      const bulge = Math.max(x1, x2) + 44;
      const path = `M ${x1} ${y1} C ${bulge} ${y1}, ${bulge} ${y2}, ${x2 + 6} ${y2}`;
      return { ...e, path, back: true, lx: bulge - 11, ly: (y1 + y2) / 2 };
    }
    const x1 = portX(a, outPorts.get(e.from), e, (o) => laid.get(o.to)!);
    const y1 = a.y + a.h;
    const x2 = portX(b, inPorts.get(e.to), e, (o) => laid.get(o.from)!);
    const y2 = b.y - 6;
    const dy = Math.max(18, (y2 - y1) / 2);
    const c1y = y1 + dy;
    const c2y = y2 - dy;
    const path = `M ${x1} ${y1} C ${x1} ${c1y}, ${x2} ${c2y}, ${x2} ${y2}`;
    // Cubic midpoint (t = 0.5) for the label.
    const lx = (x1 + 3 * x1 + 3 * x2 + x2) / 8;
    const ly = (y1 + 3 * c1y + 3 * c2y + y2) / 8;
    return { ...e, path, back: false, lx, ly };
  });

  return {
    nodes: nodes.map((n) => laid.get(n.id)!),
    edges: laidEdges,
    width,
    height,
    layers: layerCount,
  };
}
