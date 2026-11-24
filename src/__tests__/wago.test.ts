import { describe, expect, it } from "vitest";
import { hitWago, hitWagoLever, hitWagoRotateButton } from "../canvas/input";
import { hitWagoBox, WAGO_BOX_3, WAGO_BOX_5 } from "../data/wagoBoxes";
import { createPrototypeWorld } from "../data/prototypeTrack";
import { simulate } from "../engine/simulation";
import {
  getWagoPortPos,
  hasWagoWires,
  moveWago,
  removeWago,
  rotateWago,
  setPortTight,
  spawnWago,
} from "../models/world";
import { connectNodes, connectPorts, enableSupply, portOf } from "./testHelpers";

describe("Wago system (Thread 2: 3-as and 5-ös Wago, Boxes, Spawning & Removal)", () => {
  it("starts prototype world with a clean wall (wagos: [])", () => {
    const world = createPrototypeWorld();
    expect(world.wagos).toHaveLength(0);
  });

  it("spawns a 3-as WAGO (221-413) with open levers and registered nodes/ports", () => {
    const world = createPrototypeWorld();
    const wago = spawnWago(world, 3, 800, 600);

    expect(wago).toBeDefined();
    expect(wago.slots).toBe(3);
    expect(wago.portIds).toHaveLength(3);
    expect(wago.fixed).toBe(false);

    expect(world.wagos).toContain(wago);
    expect(world.nodes[wago.nodeId]).toBeDefined();
    expect(world.nodes[wago.nodeId].deviceName).toBe("Wago (3-as)");

    wago.portIds.forEach((pid, idx) => {
      const p = world.ports[pid];
      expect(p).toBeDefined();
      expect(p.nodeId).toBe(wago.nodeId);
      expect(p.kind).toBe("wago");
      expect(p.tight).toBe(false); // open lever by default!
      expect(p.x).toBe(800 + 18 + idx * 24);
      expect(p.y).toBe(600 + 46);
    });
  });

  it("spawns a 5-ös WAGO (221-415) with 5 ports and updates coordinates on move", () => {
    const world = createPrototypeWorld();
    const wago = spawnWago(world, 5, 800, 600);

    expect(wago.slots).toBe(5);
    expect(wago.portIds).toHaveLength(5);

    moveWago(world, wago.id, 950, 650);
    expect(wago.x).toBe(950);
    expect(wago.y).toBe(650);

    wago.portIds.forEach((pid, idx) => {
      expect(world.ports[pid].x).toBe(950 + 18 + idx * 24);
      expect(world.ports[pid].y).toBe(650 + 46);
    });
  });

  it("functions as an electrical junction node in simulation when levers are closed", () => {
    const world = createPrototypeWorld();
    enableSupply(world, ["mcb_1p_b10"]);

    const w3 = spawnWago(world, 3, 800, 600);

    // Wire: MCB -> Wago port 0; Wago port 1 -> Lamp L
    connectPorts(world, portOf("mcb1_b10_l1"), w3.portIds[0], "L1", true);
    connectPorts(world, w3.portIds[1], portOf("lamp1_l"), "L1", true);
    // Neutral: 1N -> Lamp N
    connectNodes(world, "top_1n", "lamp1_n", "N", true);

    // Both wago levers are tight: lamp is ON
    let sim = simulate(world);
    expect(sim.potential[world.ports[w3.portIds[0]].nodeId]).toBe("L1");
    expect(sim.lampOn.has("dev_lamp1")).toBe(true);

    // Open lever on port 1: contact is broken, lamp goes OFF
    setPortTight(world, w3.portIds[1], false);
    sim = simulate(world);
    expect(sim.lampOn.has("dev_lamp1")).toBe(false);
  });

  it("cleanly removes an empty un-fixed Wago from world", () => {
    const world = createPrototypeWorld();
    const wago = spawnWago(world, 3, 800, 600);
    const portIds = [...wago.portIds];
    const nodeId = wago.nodeId;

    expect(hasWagoWires(world, wago.id)).toBe(false);

    const success = removeWago(world, wago.id);
    expect(success).toBe(true);
    expect(world.wagos.find((w) => w.id === wago.id)).toBeUndefined();
    expect(world.nodes[nodeId]).toBeUndefined();

    for (const pid of portIds) {
      expect(world.ports[pid]).toBeUndefined();
    }
  });

  it("protects wired Wagos from being removed or moved while wires are attached", () => {
    const world = createPrototypeWorld();
    const wago = spawnWago(world, 3, 800, 600);

    connectPorts(world, portOf("mcb1_b10_l1"), wago.portIds[0], "L1", true);
    expect(hasWagoWires(world, wago.id)).toBe(true);

    const success = removeWago(world, wago.id);
    expect(success).toBe(false);
    expect(world.wagos.find((w) => w.id === wago.id)).toBeDefined();
    expect(world.ports[wago.portIds[0]]).toBeDefined();
  });

  it("protects fixed Wagos from being removed or moved", () => {
    const world = createPrototypeWorld();
    const fixedWago = spawnWago(world, 3, 500, 400, { fixed: true });

    expect(fixedWago.fixed).toBe(true);

    // Cannot move
    moveWago(world, fixedWago.id, 600, 600);
    expect(fixedWago.x).toBe(500);
    expect(fixedWago.y).toBe(400);

    // Cannot remove
    const success = removeWago(world, fixedWago.id);
    expect(success).toBe(false);
    expect(world.wagos.find((w) => w.id === fixedWago.id)).toBeDefined();
  });

  it("detects clicks on 3-as and 5-ös WAGO boxes on the workbench", () => {
    // 3-as box
    const hit3 = hitWagoBox({ x: WAGO_BOX_3.x + 20, y: WAGO_BOX_3.y + 20 });
    expect(hit3).toBeDefined();
    expect(hit3?.slots).toBe(3);

    // 5-ös box
    const hit5 = hitWagoBox({ x: WAGO_BOX_5.x + 20, y: WAGO_BOX_5.y + 20 });
    expect(hit5).toBeDefined();
    expect(hit5?.slots).toBe(5);

    // Outside desk / outside boxes
    expect(hitWagoBox({ x: 100, y: 100 })).toBeUndefined();
    expect(hitWagoBox({ x: 940, y: 500 })).toBeUndefined();
  });

  describe("Wago Rotation (90-degree steps, port recalculation, hit-testing & wire endpoint tracking)", () => {
    it("cycles rotation clockwise through 0 -> 90 -> 180 -> 270 -> 0 degrees", () => {
      const world = createPrototypeWorld();
      const wago = spawnWago(world, 3, 800, 600);

      expect(wago.rotation ?? 0).toBe(0);

      rotateWago(world, wago.id);
      expect(wago.rotation).toBe(90);

      rotateWago(world, wago.id);
      expect(wago.rotation).toBe(180);

      rotateWago(world, wago.id);
      expect(wago.rotation).toBe(270);

      rotateWago(world, wago.id);
      expect(wago.rotation).toBe(0);
    });

    it("recalculates port positions accurately around center when rotated", () => {
      const world = createPrototypeWorld();
      const wago = spawnWago(world, 3, 800, 600); // 3-slot: w=90, h=66, center=(845, 633)
      const p0Id = wago.portIds[0];
      const p1Id = wago.portIds[1];

      // At 0 deg:
      expect(world.ports[p0Id].x).toBe(818);
      expect(world.ports[p0Id].y).toBe(646);
      expect(world.ports[p1Id].x).toBe(842);
      expect(world.ports[p1Id].y).toBe(646);

      // Rotate to 90 deg:
      rotateWago(world, wago.id);
      expect(wago.rotation).toBe(90);
      // center is (845, 633)
      // p0 unrotated offset: dx = 818 - 845 = -27, dy = 646 - 633 = 13
      // 90 deg rot: rotDx = -dy = -13, rotDy = dx = -27
      // p0: (845 - 13, 633 - 27) = (832, 606)
      expect(world.ports[p0Id].x).toBe(832);
      expect(world.ports[p0Id].y).toBe(606);

      // Move while rotated preserves rotated port geometry:
      moveWago(world, wago.id, 900, 700);
      const expectedP0 = getWagoPortPos(wago, 0);
      expect(world.ports[p0Id].x).toBe(expectedP0.x);
      expect(world.ports[p0Id].y).toBe(expectedP0.y);
    });

    it("protects wired Wagos from being rotated while wires are attached", () => {
      const world = createPrototypeWorld();
      const wago = spawnWago(world, 3, 800, 600);
      const p0 = wago.portIds[0];

      // Connect wire to port 0
      connectPorts(world, portOf("mcb1_b10_l1"), p0, "L1", true);
      expect(hasWagoWires(world, wago.id)).toBe(true);

      // Rotating must be prevented when wired!
      const success = rotateWago(world, wago.id);
      expect(success).toBe(false);
      expect(wago.rotation ?? 0).toBe(0);
      expect(world.ports[p0].x).toBe(818);
      expect(world.ports[p0].y).toBe(646);

      // Rotate button should also not hit wired Wagos
      expect(hitWagoRotateButton(world, { x: 875, y: 610 })).toBeUndefined();

      // Remove the wire: now rotating is allowed
      world.wires = [];
      expect(hasWagoWires(world, wago.id)).toBe(false);

      const rotateSuccess = rotateWago(world, wago.id);
      expect(rotateSuccess).toBe(true);
      expect(wago.rotation).toBe(90);
    });

    it("performs hit testing accurately for rotated WAGO body and levers", () => {
      const world = createPrototypeWorld();
      const wago = spawnWago(world, 3, 800, 600); // center (845, 633)

      rotateWago(world, wago.id); // 90 degrees
      // Rotated 90 deg: effective width is 66 (x from 845 - 33 = 812 to 845 + 33 = 878)
      // effective height is 90 (y from 633 - 45 = 588 to 633 + 45 = 678)

      // Center should hit
      expect(hitWago(world, { x: 845, y: 633 })?.id).toBe(wago.id);

      // Point near top-center of vertical wago (inside rotated body)
      expect(hitWago(world, { x: 845, y: 595 })?.id).toBe(wago.id);

      // Point that would have hit horizontal unrotated box but is outside vertical box:
      // Unrotated box had x=885, y=633. In rotated 90 deg, w=66, max x is 878.
      expect(hitWago(world, { x: 885, y: 633 })).toBeUndefined();

      // Lever hit test on rotated Wago:
      // Lever 0 in local coords is lx in [8, 26], ly in [18, 44] (if open, lh=26).
      // Center of lever 0 in local coords: lx=17, ly=31.
      // Offset from local center (45, 33): dx = 17 - 45 = -28, dy = 31 - 33 = -2.
      // Rotated by 90 deg: rotDx = -dy = 2, rotDy = dx = -28.
      // World pos: (845 + 2, 633 - 28) = (847, 605).
      const hitLever = hitWagoLever(world, { x: 847, y: 605 });
      expect(hitLever).toBeDefined();
      expect(hitLever?.id).toBe(wago.portIds[0]);
    });

    it("detects clicks on the WAGO rotate button", () => {
      const world = createPrototypeWorld();
      const wago = spawnWago(world, 3, 800, 600);

      // Rotate button is at local x in [w - 24, w - 4] = [66, 86], y in [3, 17] = [3, 17]
      // At 0 deg: world coords x = 800 + 75 = 875, y = 600 + 10 = 610
      const btnHit = hitWagoRotateButton(world, { x: 875, y: 610 });
      expect(btnHit?.id).toBe(wago.id);

      // Miss
      expect(hitWagoRotateButton(world, { x: 800, y: 600 })).toBeUndefined();
    });

    it("prevents rotation on fixed Wagos", () => {
      const world = createPrototypeWorld();
      const fixedWago = spawnWago(world, 3, 500, 400, { fixed: true });

      const success = rotateWago(world, fixedWago.id);
      expect(success).toBe(false);
      expect(fixedWago.rotation ?? 0).toBe(0);
    });
  });
});
