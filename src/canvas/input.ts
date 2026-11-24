import { SNAP_RADIUS, WIRE_SAMPLE_GAP } from "../data/colors";
import { hitWagoBox, WAGO_BOXES, type WagoBoxDef } from "../data/wagoBoxes";
import type {
  Device,
  Point,
  Port,
  ProbeTarget,
  ToolMode,
  WagoBlock,
  Wire,
  WireColorId,
  World,
} from "../models/types";
import { hasWagoWires } from "../models/world";

export { hitWagoBox, WAGO_BOXES, type WagoBoxDef };

export const WORKBENCH_TESTER_BOUNDS = {
  x: 740,
  y: 1088,
  w: 88,
  h: 136,
} as const;

export function hitWorkbenchTester(p: Point): boolean {
  const b = WORKBENCH_TESTER_BOUNDS;
  return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
}

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
 * Ellenőrzi, hogy a kattintás egy ÁVK (rcd_3p vagy rcd_1p) "T" tesztgombjára esett-e.
 */
export function hitRcdTestButton(world: World, p: Point): Device | undefined {
  for (const device of world.devices) {
    if (device.type === "rcd_3p" || device.type === "rcd_1p") {
      const btnX = device.bounds.x + 10;
      const btnY = device.bounds.y + 26;
      const btnW = 24;
      const btnH = 18;
      if (
        p.x >= btnX - 3 &&
        p.x <= btnX + btnW + 3 &&
        p.y >= btnY - 3 &&
        p.y <= btnY + btnH + 3
      ) {
        return device;
      }
    }
  }
  return undefined;
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
  const py = 700;
  const pw = 1460;
  const ph = 245;
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
  if (tool === "wire" || tool === "tester") return "crosshair";
  if (tool === "screwdriver") return "pointer";
  if (tool === "cutter") return "not-allowed";
  return "grab";
}

/**
 * Megkeresi az UNI-T mérőtüske célpontját a falon:
 * - Sorkapocs felső (gyári) csavarja, alsó csavarja és alsó bekötési nyílása (szomszédos oszlopok közti átfedés nélkül!)
 * - Szabadon lerakott 3-as/5-ös WAGO-k és a motor 6+1 db fix WAGO-jának összes nyílása (az 1. gyári port is!)
 * - Dugaszolóaljzat (Dugalj) bal furata (L), jobb furata (N) és felső/alsó földelő rugója (PE)
 */
export function hitProbeTarget(world: World, p: Point): ProbeTarget | undefined {
  let bestTarget: ProbeTarget | undefined;
  let bestDist = Infinity;

  const consider = (candidate: ProbeTarget, maxRadius: number) => {
    const d = dist(p, candidate);
    if (d <= maxRadius && d < bestDist) {
      bestDist = d;
      bestTarget = candidate;
    }
  };

  // 1. WAGO nyílások (szabad 3/5-ös WAGO-k + motor 6+1 fix WAGO-k összes portja)
  for (const wago of world.wagos) {
    const slots = wago.slots ?? (wago.portIds.length as 3 | 5);
    const w = 18 + slots * 24;
    const h = 66;
    const lp = toWagoLocalPoint(wago, p);
    const insideBody = lp.x >= -4 && lp.x <= w + 4 && lp.y >= -4 && lp.y <= h + 6;

    wago.portIds.forEach((pid, idx) => {
      const port = world.ports[pid];
      if (!port) return;

      let displayLabel: string;
      if (wago.fixed) {
        const flagCode = port.label.split(":")[0] ?? "M";
        displayLabel = `Motor WAGO [${flagCode}] (${idx + 1}. nyílás)`;
      } else {
        displayLabel = `${slots}-as WAGO (${idx + 1}. nyílás)`;
      }

      const candidate: ProbeTarget = {
        id: `wago:${pid}`,
        nodeId: port.nodeId,
        portId: pid,
        kind: "wago",
        x: port.x,
        y: port.y,
        displayLabel,
      };

      // Közvetlen port-közelség vagy a WAGO adott csatornájára kattintás
      consider(candidate, 15);
      if (insideBody) {
        const slotLocalX = 18 + idx * 24;
        if (Math.abs(lp.x - slotLocalX) <= 12) {
          const slotDist = Math.hypot(lp.x - slotLocalX, lp.y - 46);
          if (slotDist < bestDist) {
            bestDist = slotDist;
            bestTarget = candidate;
          }
        }
      }
    });
  }

  // 2. Dugaszolóaljzat (Schuko dugalj: L bal furat, N jobb furat, PE felső/alsó rugó)
  for (const device of world.devices) {
    if (device.type === "socket" && device.nodeIds.length >= 3) {
      const { x, y, w } = device.bounds;
      const cx = x + w / 2;
      const socketContacts: ProbeTarget[] = [
        {
          id: `socket:${device.id}:L`,
          nodeId: device.nodeIds[0],
          kind: "socket",
          x: cx - 9,
          y: y + 36,
          displayLabel: "Dugaszolóaljzat (bal furat)",
        },
        {
          id: `socket:${device.id}:N`,
          nodeId: device.nodeIds[1],
          kind: "socket",
          x: cx + 9,
          y: y + 36,
          displayLabel: "Dugaszolóaljzat (jobb furat)",
        },
        {
          id: `socket:${device.id}:PE_top`,
          nodeId: device.nodeIds[2],
          kind: "socket",
          x: cx,
          y: y + 16.5,
          displayLabel: "Dugaszolóaljzat (PE földelő rugó)",
        },
        {
          id: `socket:${device.id}:PE_bot`,
          nodeId: device.nodeIds[2],
          kind: "socket",
          x: cx,
          y: y + 55.5,
          displayLabel: "Dugaszolóaljzat (PE földelő rugó)",
        },
      ];
      for (const sc of socketContacts) {
        consider(sc, 14);
      }
    }
  }

  // 3. Sorkapcsok (felső gyári csavar, alsó csavar, alsó bekötési nyílás — szomszédos átfedés nélkül!)
  let upperIdx = 0;
  let lowerIdx = 0;
  for (const col of world.columns) {
    const isUpperRow = col.y < 320;
    const colNum = isUpperRow ? ++upperIdx : ++lowerIdx;
    const rowCode = isUpperRow ? `X1/${colNum}` : `X2/${colNum}`;

    const cx = col.x + col.w / 2;
    const dx = Math.abs(p.x - cx);
    if (dx > 10.8) continue;

    if (p.y >= col.y - 8 && p.y <= col.y + 56) {
      // Felső (gyári) csavarfej
      const targetY = col.y + 19;
      const d = Math.hypot(p.x - cx, p.y - targetY);
      if (d < bestDist) {
        bestDist = d;
        bestTarget = {
          id: `screw-top:${col.id}`,
          nodeId: col.nodeId,
          portId: col.portId,
          kind: "screw_top",
          x: cx,
          y: targetY,
          displayLabel: `${rowCode}. sorkapocs (felső csavar)`,
        };
      }
    } else if (p.y > col.y + 56 && p.y <= col.y + 107) {
      // Alsó felhasználói csavarfej
      const targetY = col.y + 92;
      const d = Math.hypot(p.x - cx, p.y - targetY);
      if (d < bestDist) {
        bestDist = d;
        bestTarget = {
          id: `screw-bot:${col.id}`,
          nodeId: col.nodeId,
          portId: col.portId,
          kind: "screw_bottom",
          x: cx,
          y: targetY,
          displayLabel: `${rowCode}. sorkapocs (alsó csavar)`,
        };
      }
    } else if (p.y > col.y + 107 && p.y <= col.y + col.h + 14) {
      // Alsó bekötési nyílás
      const targetY = col.y + 122;
      const d = Math.hypot(p.x - cx, p.y - targetY);
      if (d < bestDist) {
        bestDist = d;
        bestTarget = {
          id: `port:${col.portId}`,
          nodeId: col.nodeId,
          portId: col.portId,
          kind: "port",
          x: cx,
          y: targetY,
          displayLabel: `${rowCode}. sorkapocs (alsó nyílás)`,
        };
      }
    }
  }

  return bestTarget;
}

/**
 * Szinkronban tartja a lerakott mérőtüskét a világgal (pl. ha egy WAGO-t elmozgattak vagy töröltek).
 */
export function syncProbeTarget(
  world: World,
  target: ProbeTarget | undefined,
): ProbeTarget | undefined {
  if (!target) return undefined;
  if (!world.nodes[target.nodeId]) return undefined;
  if (target.kind === "wago" && target.portId) {
    const port = world.ports[target.portId];
    if (!port) return undefined;
    if (port.x !== target.x || port.y !== target.y) {
      return { ...target, x: port.x, y: port.y };
    }
  }
  return target;
}

export type DraftWire = {
  color: WireColorId;
  points: Point[];
  startPortId: string;
};
