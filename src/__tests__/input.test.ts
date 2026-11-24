import { describe, expect, it } from "vitest";
import {
  cursorFor,
  dist,
  hitColumnLowerHalf,
  hitColumnUpperHalf,
  hitDevice,
  hitLegendPoster,
  hitProbeTarget,
  hitScrewdriverTarget,
  hitWago,
  hitWagoLever,
  hitWire,
  hitWorkbenchTester,
  nearestPort,
  sampleDraft,
  syncProbeTarget,
  WORKBENCH_TESTER_BOUNDS,
} from "../canvas/input";
import { SNAP_RADIUS } from "../data/colors";
import { moveWago, removeWago, setPortTight, spawnWago } from "../models/world";
import { connectNodes, createTestWorld, portOf } from "./testHelpers";

describe("Canvas input hit-testing & geometry", () => {
  it("computes Euclidean distance and filters draft samples by gap", () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);

    const p0 = { x: 10, y: 10 };
    expect(sampleDraft([], p0)).toEqual([p0]);
    expect(sampleDraft([p0], { x: 11, y: 11 })).toEqual([p0]);
    expect(sampleDraft([p0], { x: 20, y: 10 })).toEqual([p0, { x: 20, y: 10 }]);
  });

  it("snaps to nearest port within SNAP_RADIUS and returns undefined when far away", () => {
    const world = createTestWorld();
    const target = world.ports[portOf("mcb1_b10_l1")];

    expect(nearestPort(world, { x: target.x + 5, y: target.y - 3 })?.id).toBe(target.id);
    expect(nearestPort(world, { x: target.x + SNAP_RADIUS + 20, y: 50 })).toBeUndefined();
  });

  it("distinguishes upper factory-wired column half from lower user screw target", () => {
    const world = createTestWorld();
    const col0 = world.columns[0];
    const col1 = world.columns[1];
    const cx0 = col0.x + col0.w / 2; // 700
    const cx1 = col1.x + col1.w / 2; // 722
    const cy = col0.y + 92;

    expect(hitColumnUpperHalf(world, { x: cx0, y: col0.y + 20 })?.id).toBe(col0.id);
    expect(hitColumnUpperHalf(world, { x: cx0, y: cy })).toBeUndefined();

    // Exact screw center hit
    expect(hitScrewdriverTarget(world, { x: cx0, y: cy })?.id).toBe(col0.portId);
    expect(hitScrewdriverTarget(world, { x: cx1, y: cy })?.id).toBe(col1.portId);

    // Non-overlapping hitboxes between adjacent columns (Col0 right edge vs Col1 left edge)
    // col0 at 690..710 (cx0=700), col1 at 712..732 (cx1=722)
    // Clicking at x=712 (left edge of col1) MUST hit col1, never col0!
    expect(hitScrewdriverTarget(world, { x: 712, y: cy })?.id).toBe(col1.portId);
    expect(hitScrewdriverTarget(world, { x: cx0 + 10, y: cy })?.id).toBe(col0.portId);

    // Outside bounds returns undefined
    expect(hitScrewdriverTarget(world, { x: cx0, y: cy + 25 })).toBeUndefined();

    // Screwdriver does NOT hit Wago (nearestPort fallback removed)
    const wago = world.wagos[0];
    expect(hitScrewdriverTarget(world, { x: wago.x + 18, y: wago.y + 46 })).toBeUndefined();
  });

  it("detects lower column half for wire clicks to prevent unwanted canvas panning", () => {
    const world = createTestWorld();
    const col = world.columns[0];
    const cx = col.x + col.w / 2;

    // Screw area in lower half
    expect(hitColumnLowerHalf(world, { x: cx, y: col.y + 92 })?.id).toBe(col.id);
    // Wire entry area in lower half
    expect(hitColumnLowerHalf(world, { x: cx, y: col.y + 122 })?.id).toBe(col.id);
    // Upper half is not lower half
    expect(hitColumnLowerHalf(world, { x: cx, y: col.y + 20 })).toBeUndefined();
  });

  it("detects Wago block body and levers for both closed and open lever heights", () => {
    const world = createTestWorld();
    const wago = world.wagos[0];
    const firstPortId = wago.portIds[0];

    expect(hitWago(world, { x: wago.x + 20, y: wago.y + 10 })?.id).toBe(wago.id);
    expect(hitWago(world, { x: wago.x - 10, y: wago.y - 10 })).toBeUndefined();

    // Zárt kar (magasság 14 -> y+18..y+32)
    setPortTight(world, firstPortId, true);
    expect(hitWagoLever(world, { x: wago.x + 15, y: wago.y + 25 })?.id).toBe(firstPortId);
    expect(hitWagoLever(world, { x: wago.x + 15, y: wago.y + 40 })).toBeUndefined();

    // Nyitott kar (magasság 26 -> y+18..y+44)
    setPortTight(world, firstPortId, false);
    expect(hitWagoLever(world, { x: wago.x + 15, y: wago.y + 40 })?.id).toBe(firstPortId);
  });

  it("detects devices, wires, legend poster and maps cursors for tool modes", () => {
    const world = createTestWorld();

    const sw = world.devices.find((d) => d.id === "dev_sw101")!;
    expect(
      hitDevice(world, { x: sw.bounds.x + sw.bounds.w / 2, y: sw.bounds.y + sw.bounds.h / 2 })?.id,
    ).toBe("dev_sw101");
    expect(hitDevice(world, { x: 1, y: 1 })).toBeUndefined();

    const wire = connectNodes(world, "mcb1_b10_l1", "lamp1_l", "L1");
    const mid = {
      x: (wire.points[0].x + wire.points[1].x) / 2,
      y: (wire.points[0].y + wire.points[1].y) / 2,
    };
    expect(hitWire(world, mid, 8)?.id).toBe(wire.id);
    expect(hitWire(world, { x: 0, y: 0 }, 8)).toBeUndefined();

    expect(hitLegendPoster({ x: 800, y: 800 })).toBe(true);
    expect(hitLegendPoster({ x: 100, y: 100 })).toBe(false);

    expect(cursorFor("wire", false)).toBe("crosshair");
    expect(cursorFor("tester", false)).toBe("crosshair");
    expect(cursorFor("screwdriver", false)).toBe("pointer");
    expect(cursorFor("cutter", false)).toBe("not-allowed");
    expect(cursorFor("hand", false)).toBe("grab");
    expect(cursorFor("wire", true)).toBe("grabbing");
  });

  it("hits UNI-T probe targets on upper/lower terminal screws, WAGOs, motor WAGOs and socket without leaking secret names", () => {
    const world = createTestWorld();
    const col0 = world.columns[0];
    const col1 = world.columns[1];
    const cx0 = col0.x + col0.w / 2;

    // 1. Sorkapocs felső (gyári) csavar és alsó csavar + szomszédos oszlop elválasztás
    const topHit = hitProbeTarget(world, { x: cx0, y: col0.y + 19 });
    expect(topHit?.kind).toBe("screw_top");
    expect(topHit?.nodeId).toBe(col0.nodeId);
    expect(topHit?.displayLabel).toContain("X1/1");
    expect(topHit?.displayLabel).not.toContain("Nullája");

    const botHit = hitProbeTarget(world, { x: cx0, y: col0.y + 92 });
    expect(botHit?.kind).toBe("screw_bottom");
    expect(botHit?.nodeId).toBe(col0.nodeId);

    const col1EdgeHit = hitProbeTarget(world, { x: col1.x, y: col1.y + 92 });
    expect(col1EdgeHit?.nodeId).toBe(col1.nodeId);

    // 2. Motor rögzített WAGO 1. gyári portja is mérhető
    const motorWago = world.wagos.find((w) => w.id === "wago_motor_u1")!;
    const p1 = world.ports[motorWago.portIds[0]];
    const motorHit = hitProbeTarget(world, { x: p1.x, y: p1.y });
    expect(motorHit?.kind).toBe("wago");
    expect(motorHit?.nodeId).toBe("motor_u1");
    expect(motorHit?.displayLabel).toContain("U1");

    // 3. Dugaszolóaljzat L, N és PE érintkezői
    const socket = world.devices.find((d) => d.id === "dev_socket")!;
    const scx = socket.bounds.x + socket.bounds.w / 2;
    expect(hitProbeTarget(world, { x: scx - 9, y: socket.bounds.y + 36 })?.nodeId).toBe("sock_l");
    expect(hitProbeTarget(world, { x: scx + 9, y: socket.bounds.y + 36 })?.nodeId).toBe("sock_n");
    expect(hitProbeTarget(world, { x: scx, y: socket.bounds.y + 16.5 })?.nodeId).toBe("sock_pe");

    // 4. Munkapadi UNI-T műszer hit-test és WAGO szinkronizálás
    expect(
      hitWorkbenchTester({
        x: WORKBENCH_TESTER_BOUNDS.x + 20,
        y: WORKBENCH_TESTER_BOUNDS.y + 30,
      }),
    ).toBe(true);
    expect(hitWorkbenchTester({ x: 100, y: 100 })).toBe(false);

    const freeWago = spawnWago(world, 3, 900, 650);
    const wPort = world.ports[freeWago.portIds[1]];
    const wProbe = hitProbeTarget(world, { x: wPort.x, y: wPort.y })!;
    expect(wProbe.nodeId).toBe(freeWago.nodeId);

    moveWago(world, freeWago.id, 950, 670);
    const synced = syncProbeTarget(world, wProbe)!;
    expect(synced.x).toBe(world.ports[freeWago.portIds[1]].x);
    expect(synced.y).toBe(world.ports[freeWago.portIds[1]].y);

    removeWago(world, freeWago.id);
    expect(syncProbeTarget(world, synced)).toBeUndefined();
  });
});
