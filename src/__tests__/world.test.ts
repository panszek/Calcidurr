import { describe, expect, it } from "vitest";
import { LOWER_TERMINAL_GROUPS, UPPER_TERMINAL_GROUPS } from "../data/terminalLegend";
import {
  cloneWorld,
  deviceById,
  hasWagoWires,
  isPortOccupied,
  isWireRemovable,
  moveWago,
  occupyingWire,
  removeWire,
  setButtonPressed,
  setPortTight,
  tickWorld,
  toggleDevice,
  togglePortTight,
  tripMcb,
} from "../models/world";
import { connectNodes, connectPorts, createTestWorld, enableSupply, portOf } from "./testHelpers";

describe("Prototype world integrity & world mutations", () => {
  it("matches terminal legend counts (65 upper + 54 lower = 119 columns) and has valid references", () => {
    const world = createTestWorld();
    const upperLegendCols = UPPER_TERMINAL_GROUPS.flatMap((g) => g.terminals);
    const lowerLegendCols = LOWER_TERMINAL_GROUPS.flatMap((g) => g.terminals);

    expect(upperLegendCols).toHaveLength(65);
    expect(lowerLegendCols).toHaveLength(54);
    expect(world.columns).toHaveLength(119);

    const colIds = new Set(world.columns.map((c) => c.id));
    for (const term of [...upperLegendCols, ...lowerLegendCols]) {
      expect(colIds.has(term.colId)).toBe(true);
      expect(world.nodes[term.nodeId]).toBeDefined();
    }

    for (const col of world.columns) {
      expect(world.nodes[col.nodeId]).toBeDefined();
      expect(world.ports[col.portId]).toBeDefined();
      expect(world.ports[col.portId].nodeId).toBe(col.nodeId);
    }

    for (const dev of world.devices) {
      for (const nid of dev.nodeIds) {
        expect(world.nodes[nid]).toBeDefined();
      }
    }
  });

  it("deep-clones world without sharing mutable state", () => {
    const world = createTestWorld();
    const copy = cloneWorld(world);
    connectNodes(copy, "mcb1_b10_l1", "lamp1_l");

    expect(copy.wires).toHaveLength(1);
    expect(world.wires).toHaveLength(0);
  });

  it("adds wires loose by default, tracks port occupancy, and enforces looseness before removal", () => {
    const world = createTestWorld();
    const p1 = portOf("mcb1_b10_l1");
    const p2 = portOf("lamp1_l");

    expect(isPortOccupied(world, p1)).toBe(false);
    expect(isPortOccupied(world, p2)).toBe(false);

    const wire = connectPorts(world, p1, p2, "L1", false);
    expect(world.ports[p1].tight).toBe(false);
    expect(world.ports[p2].tight).toBe(false);
    expect(isPortOccupied(world, p1)).toBe(true);
    expect(isPortOccupied(world, p2)).toBe(true);
    expect(occupyingWire(world, p1)?.id).toBe(wire.id);
    expect(isPortOccupied(world, p1, wire.id)).toBe(false);
    expect(isWireRemovable(world, wire.id)).toBe(true);

    togglePortTight(world, p1);
    expect(world.ports[p1].tight).toBe(true);
    expect(isWireRemovable(world, wire.id)).toBe(false);

    setPortTight(world, p1, false);
    setPortTight(world, p2, true);
    expect(isWireRemovable(world, wire.id)).toBe(false);

    setPortTight(world, p2, false);
    expect(isWireRemovable(world, wire.id)).toBe(true);

    removeWire(world, wire.id);
    expect(world.wires).toHaveLength(0);
    expect(isPortOccupied(world, p1)).toBe(false);
    expect(isPortOccupied(world, p2)).toBe(false);
  });

  it("tracks Wago wire attachment and updates port coordinates when moving a Wago", () => {
    const world = createTestWorld();
    const wago = world.wagos[0];
    expect(wago).toBeDefined();
    expect(hasWagoWires(world, wago.id)).toBe(false);

    moveWago(world, wago.id, 900, 650);
    expect(wago.x).toBe(900);
    expect(wago.y).toBe(650);
    wago.portIds.forEach((pid, idx) => {
      expect(world.ports[pid].x).toBe(900 + 18 + idx * 24);
      expect(world.ports[pid].y).toBe(650 + 46);
    });

    connectPorts(world, portOf("mcb1_b10_l1"), wago.portIds[0], "L1", true);
    expect(hasWagoWires(world, wago.id)).toBe(true);
  });

  it("toggles switches, dual-rocker 105, relays and ignores non-toggleable devices", () => {
    const world = createTestWorld();

    const sw101 = deviceById(world, "dev_sw101");
    expect(sw101.on).toBe(false);
    toggleDevice(world, "dev_sw101");
    expect(sw101.on).toBe(true);

    const sw105 = deviceById(world, "dev_sw105");
    expect(sw105.on).toBe(false);
    expect(sw105.on2).toBe(false);
    toggleDevice(world, "dev_sw105", 1);
    expect(sw105.on).toBe(true);
    expect(sw105.on2).toBe(false);
    toggleDevice(world, "dev_sw105", 2);
    expect(sw105.on).toBe(true);
    expect(sw105.on2).toBe(true);

    const lamp = deviceById(world, "dev_lamp1");
    toggleDevice(world, "dev_lamp1");
    expect(lamp.on).toBe(false);

    const btn = deviceById(world, "dev_btn_l_no");
    toggleDevice(world, "dev_btn_l_no");
    expect(btn.on).toBe(false);
    setButtonPressed(world, "dev_btn_l_no", true);
    expect(btn.pressed).toBe(true);
    setButtonPressed(world, "dev_btn_l_no", false);
    expect(btn.pressed).toBe(false);

    const imp = deviceById(world, "dev_impulse");
    expect(imp.relayState).toBe(false);
    toggleDevice(world, "dev_impulse");
    expect(imp.relayState).toBe(true);
  });

  it("trips specific breaker or all breakers via tripMcb", () => {
    const world = createTestWorld();
    enableSupply(world, ["mcb_1p_b10", "mcb_1p_b16", "mcb_3p"]);

    tripMcb(world, "mcb_1p_b10");
    expect(deviceById(world, "mcb_1p_b10").on).toBe(false);
    expect(deviceById(world, "mcb_1p_b16").on).toBe(true);
    expect(deviceById(world, "mcb_3p").on).toBe(true);

    tripMcb(world);
    expect(deviceById(world, "mcb_1p_b16").on).toBe(false);
    expect(deviceById(world, "mcb_3p").on).toBe(false);
  });

  it("advances staircase, motion sensor and timer relay countdowns in tickWorld", () => {
    const world = createTestWorld();

    const stair = deviceById(world, "dev_staircase");
    stair.timerRemaining = 2.0;
    expect(tickWorld(world, 1.0)).toBe(false);
    expect(stair.timerRemaining).toBeCloseTo(1.0);
    expect(tickWorld(world, 1.5)).toBe(true);
    expect(stair.timerRemaining).toBe(0);

    const timer = deviceById(world, "dev_timer");
    timer.energized = true;
    timer.relayState = false;
    timer.timerRemaining = 3.0;
    expect(tickWorld(world, 2.0)).toBe(false);
    expect(timer.relayState).toBe(false);
    expect(tickWorld(world, 1.2)).toBe(true);
    expect(timer.relayState).toBe(true);

    timer.energized = false;
    expect(tickWorld(world, 0.1)).toBe(true);
    expect(timer.relayState).toBe(false);
    expect(timer.timerRemaining).toBe(3.0);
  });
});
