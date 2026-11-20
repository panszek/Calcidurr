import { SNAP_RADIUS, WIRE_SAMPLE_GAP } from "../data/colors";
import type { Point, Port, ToolMode, Wire, WireColorId, World } from "../models/types";

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function nearestPort(world: World, p: Point, max = SNAP_RADIUS): Port | undefined {
  let best: Port | undefined;
  let bestD = max;
  for (const port of Object.values(world.ports)) {
    const d = dist(p, port);
    if (d <= bestD) {
      best = port;
      bestD = d;
    }
  }
  return best;
}

export function hitDevice(world: World, p: Point) {
  return world.devices.find((d) => {
    const { x, y, w, h } = d.bounds;
    return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
  });
}

export function hitWagoLever(world: World, p: Point): Port | undefined {
  for (const wago of world.wagos) {
    for (let i = 0; i < wago.portIds.length; i += 1) {
      const pid = wago.portIds[i];
      const closed = world.ports[pid].tight;
      const lx = wago.x + 22 + i * 52;
      const ly = wago.y + 28;
      const lw = 28;
      const lh = closed ? 18 : 36;
      if (p.x >= lx && p.x <= lx + lw && p.y >= ly && p.y <= ly + lh) {
        return world.ports[pid];
      }
    }
  }
  return undefined;
}

function pointToSegment(p: Point, a: Point, b: Point): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy || 1;
  let t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

export function hitWire(world: World, p: Point, threshold = 7): Wire | undefined {
  let best: Wire | undefined;
  let bestD = threshold;
  for (const wire of world.wires) {
    for (let i = 1; i < wire.points.length; i += 1) {
      const d = pointToSegment(p, wire.points[i - 1], wire.points[i]);
      if (d < bestD) {
        best = wire;
        bestD = d;
      }
    }
  }
  return best;
}

export function sampleDraft(points: Point[], next: Point): Point[] {
  if (!points.length) return [next];
  const last = points[points.length - 1];
  if (dist(last, next) < WIRE_SAMPLE_GAP) return points;
  return [...points, next];
}

export function cursorFor(tool: ToolMode): string {
  if (tool === "wire") return "crosshair";
  if (tool === "screwdriver") return "pointer";
  if (tool === "cutter") return "not-allowed";
  return "grab";
}

export type DraftWire = {
  color: WireColorId;
  points: Point[];
  startPortId: string;
};
