import { describe, expect, it } from "vitest";
import {
  cursorFor,
  dist,
  hitColumnUpperHalf,
  hitDevice,
  hitLegendPoster,
  hitScrewdriverTarget,
  hitWago,
  hitWagoLever,
  hitWire,
  nearestPort,
  sampleDraft,
} from "../canvas/input";
import { SNAP_RADIUS } from "../data/colors";
import { setPortTight } from "../models/world";
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
    const col = world.columns[0];
    const cx = col.x + col.w / 2;

    expect(hitColumnUpperHalf(world, { x: cx, y: col.y + 20 })?.id).toBe(col.id);
    expect(hitColumnUpperHalf(world, { x: cx, y: col.y + 92 })).toBeUndefined();

    expect(hitScrewdriverTarget(world, { x: cx, y: col.y + 92 })?.id).toBe(col.portId);
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
    expect(cursorFor("screwdriver", false)).toBe("pointer");
    expect(cursorFor("cutter", false)).toBe("not-allowed");
    expect(cursorFor("hand", false)).toBe("grab");
    expect(cursorFor("wire", true)).toBe("grabbing");
  });
});
