import { SNAP_RADIUS, WIRE_SAMPLE_GAP } from "../data/colors";
import { hitWagoBox, WAGO_BOXES, type WagoBoxDef } from "../data/wagoBoxes";
import type { Point, Port, ToolMode, WagoBlock, Wire, WireColorId, World } from "../models/types";
import { hasWagoWires } from "../models/world";

export { hitWagoBox, WAGO_BOXES, type WagoBoxDef };

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

export function toWagoLocalPoint(
  wago: Pick<WagoBlock, "x" | "y" | "portIds" | "slots" | "rotation">,
  p: Point,
): Point {
  const slots = wago.slots ?? (wago.portIds.length as 3 | 5);
  const w = 18 + slots * 24;
  const h = 66;
  const cx = wago.x + w / 2;
  const cy = wago.y + h / 2;
  const dx = p.x - cx;
  const dy = p.y - cy;
  const rot = wago.rotation ?? 0;

  let localDx = dx;
  let localDy = dy;
  if (rot === 90) {
    localDx = dy;
    localDy = -dx;
  } else if (rot === 180) {
    localDx = -dx;
    localDy = -dy;
  } else if (rot === 270) {
    localDx = -dy;
    localDy = dx;
  }

  return {
    x: localDx + w / 2,
    y: localDy + h / 2,
  };
}

export function hitWagoLever(world: World, p: Point): Port | undefined {
  for (const wago of world.wagos) {
    const lp = toWagoLocalPoint(wago, p);
    for (let i = 0; i < wago.portIds.length; i += 1) {
      const pid = wago.portIds[i];
      const closed = world.ports[pid].tight;
      const lx = 8 + i * 24;
      const ly = 18;
      const lw = 18;
      const lh = closed ? 14 : 26;
      if (lp.x >= lx && lp.x <= lx + lw && lp.y >= ly && lp.y <= ly + lh) {
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
    const lp = toWagoLocalPoint(wago, p);
    return lp.x >= 0 && lp.x <= w && lp.y >= 0 && lp.y <= h;
  });
}

export function hitWagoRotateButton(world: World, p: Point): WagoBlock | undefined {
  for (const wago of world.wagos) {
    if (wago.fixed || hasWagoWires(world, wago.id)) continue;
    const w = 18 + wago.portIds.length * 24;
    const lp = toWagoLocalPoint(wago, p);
    if (lp.x >= w - 24 && lp.x <= w - 4 && lp.y >= 3 && lp.y <= 17) {
      return wago;
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
