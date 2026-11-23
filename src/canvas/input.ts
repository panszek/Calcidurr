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

/**
 * Ellenőrzi, hogy a kattintás egy sorkapocs előszerelt, fix felső oldalára történt-e.
 * A felső oldal a fal felé vezet, a diák ide nem köthet vezetéket és nem csavarozhatja.
 */
export function hitColumnUpperHalf(world: World, p: Point) {
  return world.columns.find((col) => {
    return (
      p.x >= col.x - 2 &&
      p.x <= col.x + col.w + 2 &&
      p.y >= col.y - 25 &&
      p.y < col.y + 70
    );
  });
}

/**
 * Megkeresi a csavarhúzó célpontját: pontosan a legközelebbi alsó csavarfej-középpontot
 * (cx, col.y + 92) az osztás felén belül (|dx| <= 10.5, |dy| <= 14).
 * Megszünteti a korábbi átfedéseket és a téves fallback találatokat.
 */
export function hitScrewdriverTarget(world: World, p: Point): Port | undefined {
  let bestPort: Port | undefined;
  let bestDist = Infinity;

  for (const col of world.columns) {
    const cx = col.x + col.w / 2;
    const cy = col.y + 92;
    const dx = Math.abs(p.x - cx);
    const dy = Math.abs(p.y - cy);
    if (dx <= 10.5 && dy <= 14) {
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d < bestDist) {
        bestDist = d;
        bestPort = world.ports[col.portId];
      }
    }
  }

  return bestPort;
}

/**
 * Ellenőrzi, hogy a pont egy sorkapocs alsó felhasználói felére esik-e
 * (alsó csavar vagy alsó vezetéknyílás környéke: |dx| <= 11 és y >= col.y + 70 && y <= col.y + col.h + 8).
 * Megszünteti a holtzónát vezetékezés közben, hogy a kattintás ne váltson véletlen vászonhúzásra (pan).
 */
export function hitColumnLowerHalf(world: World, p: Point) {
  let bestCol: (typeof world.columns)[number] | undefined;
  let bestDist = Infinity;

  for (const col of world.columns) {
    const cx = col.x + col.w / 2;
    const cy = col.y + 102;
    const dx = Math.abs(p.x - cx);
    if (dx <= 11 && p.y >= col.y + 70 && p.y <= col.y + col.h + 8) {
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d < bestDist) {
        bestDist = d;
        bestCol = col;
      }
    }
  }

  return bestCol;
}

/**
 * Ellenőrzi, hogy a kattintás az oktatófalon lévő magyarázó plakátra esett-e.
 */
export function hitLegendPoster(p: Point): boolean {
  const px = 680;
  const py = 725;
  const pw = 1460;
  const ph = 315;
  return p.x >= px && p.x <= px + pw && p.y >= py && p.y <= py + ph;
}

export function hitWagoLever(world: World, p: Point): Port | undefined {
  for (const wago of world.wagos) {
    for (let i = 0; i < wago.portIds.length; i += 1) {
      const pid = wago.portIds[i];
      const closed = world.ports[pid].tight;
      const lx = wago.x + 8 + i * 24;
      const ly = wago.y + 18;
      const lw = 18;
      const lh = closed ? 14 : 26;
      if (p.x >= lx && p.x <= lx + lw && p.y >= ly && p.y <= ly + lh) {
        return world.ports[pid];
      }
    }
  }
  return undefined;
}

export function hitWago(world: World, p: Point) {
  return world.wagos.find((wago) => {
    const w = 18 + wago.portIds.length * 24;
    const h = 66;
    return p.x >= wago.x && p.x <= wago.x + w && p.y >= wago.y && p.y <= wago.y + h;
  });
}

function pointToSegment(p: Point, a: Point, b: Point): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy || 1;
  let t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

export function hitWire(world: World, p: Point, threshold = 8): Wire | undefined {
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

export function cursorFor(tool: ToolMode, isPanning = false): string {
  if (isPanning) return "grabbing";
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
