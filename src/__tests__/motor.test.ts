import { describe, expect, it } from "vitest";
import { createPrototypeWorld } from "../data/prototypeTrack";
import { simulate } from "../engine/simulation";
import { isPortOccupied, moveWago, removeWago } from "../models/world";
import { connectPorts, enableSupply, portOf } from "./testHelpers";

describe("3-Phase Motor System (Thread 4: Motor & 6+1 Fixed WAGOs)", () => {
  it("initializes prototype world with dev_motor and 6+1 fixed 3-as WAGOs under the poster", () => {
    const world = createPrototypeWorld();

    const motor = world.devices.find((d) => d.type === "motor_3p");
    expect(motor).toBeDefined();
    expect(motor?.id).toBe("dev_motor");
    expect(motor?.on).toBe(false);
    expect(motor?.energized).toBe(false);
    expect(motor?.bounds.x).toBe(1750);
    expect(motor?.bounds.y).toBe(1030);

    // Exactly 7 fixed WAGOs for motor: U1, V1, W1, U2, V2, W2 + PE
    const fixedWagos = world.wagos.filter((w) => w.fixed);
    expect(fixedWagos).toHaveLength(7);

    const expectedIds = [
      "wago_motor_u1",
      "wago_motor_v1",
      "wago_motor_w1",
      "wago_motor_u2",
      "wago_motor_v2",
      "wago_motor_w2",
      "wago_motor_pe",
    ];

    for (const id of expectedIds) {
      const wago = world.wagos.find((w) => w.id === id);
      expect(wago).toBeDefined();
      expect(wago?.slots).toBe(3);
      expect(wago?.fixed).toBe(true);
      expect(wago?.y).toBe(975);
      expect(wago?.portIds).toHaveLength(3);

      // Port 1 is factory tightened, ports 2 and 3 are open
      const p1 = world.ports[wago!.portIds[0]];
      const p2 = world.ports[wago!.portIds[1]];
      const p3 = world.ports[wago!.portIds[2]];

      expect(p1.tight).toBe(true);
      expect(p2.tight).toBe(false);
      expect(p3.tight).toBe(false);
    }

    // Default simulation state: motor is OFF
    const sim = simulate(world);
    expect(sim.motor).toBeDefined();
    expect(sim.motor?.mode).toBe("off");
    expect(sim.motor?.direction).toBe("none");
    expect(sim.motor?.current).toBe(0);
    expect(sim.motor?.speed).toBe(0);
  });

  it("enforces protections: port 1 is occupied and fixed motor WAGOs cannot be moved or removed", () => {
    const world = createPrototypeWorld();
    const wagoU1 = world.wagos.find((w) => w.id === "wago_motor_u1")!;

    // Port 1 has the factory motor lead, so it is occupied
    expect(isPortOccupied(world, wagoU1.portIds[0])).toBe(true);
    // Ports 2 and 3 are free for user wires
    expect(isPortOccupied(world, wagoU1.portIds[1])).toBe(false);
    expect(isPortOccupied(world, wagoU1.portIds[2])).toBe(false);

    // Fixed WAGOs cannot be removed
    const removed = removeWago(world, wagoU1.id);
    expect(removed).toBe(false);
    expect(world.wagos.find((w) => w.id === wagoU1.id)).toBeDefined();

    // Fixed WAGOs cannot be moved
    moveWago(world, wagoU1.id, 500, 500);
    expect(wagoU1.x).toBe(740);
    expect(wagoU1.y).toBe(975);
  });

  it("runs in Star (Y) mode CW with ~1.8 A when U2-V2-W2 are bridged and L1, L2, L3 are connected", () => {
    const world = createPrototypeWorld();
    enableSupply(world, ["rcd_3p", "mcb_3p"]);

    const wU1 = world.wagos.find((w) => w.id === "wago_motor_u1")!;
    const wV1 = world.wagos.find((w) => w.id === "wago_motor_v1")!;
    const wW1 = world.wagos.find((w) => w.id === "wago_motor_w1")!;
    const wU2 = world.wagos.find((w) => w.id === "wago_motor_u2")!;
    const wV2 = world.wagos.find((w) => w.id === "wago_motor_v2")!;
    const wW2 = world.wagos.find((w) => w.id === "wago_motor_w2")!;
    const wPE = world.wagos.find((w) => w.id === "wago_motor_pe")!;

    // Star point: bridge U2 - V2 - W2
    connectPorts(world, wU2.portIds[1], wV2.portIds[1], "L1", true);
    connectPorts(world, wV2.portIds[2], wW2.portIds[1], "L1", true);

    // Feed phases L1, L2, L3 from 3P C16A
    connectPorts(world, portOf("mcb3_l1"), wU1.portIds[1], "L1", true);
    connectPorts(world, portOf("mcb3_l2"), wV1.portIds[1], "L1", true);
    connectPorts(world, portOf("mcb3_l3"), wW1.portIds[1], "L1", true);

    // Connect Protective Earth (PE)
    connectPorts(world, portOf("top_pe"), wPE.portIds[1], "PE", true);

    const sim = simulate(world);
    expect(sim.motor?.mode).toBe("star");
    expect(sim.motor?.direction).toBe("cw");
    expect(sim.motor?.current).toBe(1.8);
    expect(sim.motor?.peConnected).toBe(true);
    expect(sim.motor?.speed).toBe(1);

    const motorDev = world.devices.find((d) => d.type === "motor_3p")!;
    expect(motorDev.on).toBe(true);
    expect(motorDev.energized).toBe(true);
    expect(sim.activeDevices.has(motorDev.id)).toBe(true);
    expect(sim.warnings.some((w) => w.includes("PE"))).toBe(false);
  });

  it("rotates CCW (balra) in Star mode when two phases are swapped (L2 and L1)", () => {
    const world = createPrototypeWorld();
    enableSupply(world, ["rcd_3p", "mcb_3p"]);

    const wU1 = world.wagos.find((w) => w.id === "wago_motor_u1")!;
    const wV1 = world.wagos.find((w) => w.id === "wago_motor_v1")!;
    const wW1 = world.wagos.find((w) => w.id === "wago_motor_w1")!;
    const wU2 = world.wagos.find((w) => w.id === "wago_motor_u2")!;
    const wV2 = world.wagos.find((w) => w.id === "wago_motor_v2")!;
    const wW2 = world.wagos.find((w) => w.id === "wago_motor_w2")!;
    const wPE = world.wagos.find((w) => w.id === "wago_motor_pe")!;

    // Star point bridge
    connectPorts(world, wU2.portIds[1], wV2.portIds[1], "L1", true);
    connectPorts(world, wV2.portIds[2], wW2.portIds[1], "L1", true);

    // Swapped: U1 gets L2, V1 gets L1, W1 gets L3
    connectPorts(world, portOf("mcb3_l2"), wU1.portIds[1], "L1", true);
    connectPorts(world, portOf("mcb3_l1"), wV1.portIds[1], "L1", true);
    connectPorts(world, portOf("mcb3_l3"), wW1.portIds[1], "L1", true);
    connectPorts(world, portOf("top_pe"), wPE.portIds[1], "PE", true);

    const sim = simulate(world);
    expect(sim.motor?.mode).toBe("star");
    expect(sim.motor?.direction).toBe("ccw");
    expect(sim.motor?.current).toBe(1.8);
  });

  it("warns when motor runs without Protective Earth (PE) connection", () => {
    const world = createPrototypeWorld();
    enableSupply(world, ["rcd_3p", "mcb_3p"]);

    const wU1 = world.wagos.find((w) => w.id === "wago_motor_u1")!;
    const wV1 = world.wagos.find((w) => w.id === "wago_motor_v1")!;
    const wW1 = world.wagos.find((w) => w.id === "wago_motor_w1")!;
    const wU2 = world.wagos.find((w) => w.id === "wago_motor_u2")!;
    const wV2 = world.wagos.find((w) => w.id === "wago_motor_v2")!;
    const wW2 = world.wagos.find((w) => w.id === "wago_motor_w2")!;

    // Star point bridge
    connectPorts(world, wU2.portIds[1], wV2.portIds[1], "L1", true);
    connectPorts(world, wV2.portIds[2], wW2.portIds[1], "L1", true);

    // Phases connected, PE NOT connected
    connectPorts(world, portOf("mcb3_l1"), wU1.portIds[1], "L1", true);
    connectPorts(world, portOf("mcb3_l2"), wV1.portIds[1], "L1", true);
    connectPorts(world, portOf("mcb3_l3"), wW1.portIds[1], "L1", true);

    const sim = simulate(world);
    expect(sim.motor?.mode).toBe("star");
    expect(sim.motor?.peConnected).toBe(false);
    expect(sim.warnings.some((w) => w.includes("PE") && w.includes("védővezető"))).toBe(true);
  });

  it("detects phase fault (FÁZISHIBA) with ~8.5 A and 0 speed when 1 phase is missing", () => {
    const world = createPrototypeWorld();
    enableSupply(world, ["rcd_3p", "mcb_3p"]);

    const wU1 = world.wagos.find((w) => w.id === "wago_motor_u1")!;
    const wV1 = world.wagos.find((w) => w.id === "wago_motor_v1")!;
    const wU2 = world.wagos.find((w) => w.id === "wago_motor_u2")!;
    const wV2 = world.wagos.find((w) => w.id === "wago_motor_v2")!;
    const wW2 = world.wagos.find((w) => w.id === "wago_motor_w2")!;
    const wPE = world.wagos.find((w) => w.id === "wago_motor_pe")!;

    // Star point bridge
    connectPorts(world, wU2.portIds[1], wV2.portIds[1], "L1", true);
    connectPorts(world, wV2.portIds[2], wW2.portIds[1], "L1", true);

    // Only L1 and L2 connected, L3 missing
    connectPorts(world, portOf("mcb3_l1"), wU1.portIds[1], "L1", true);
    connectPorts(world, portOf("mcb3_l2"), wV1.portIds[1], "L1", true);
    connectPorts(world, portOf("top_pe"), wPE.portIds[1], "PE", true);

    const sim = simulate(world);
    expect(sim.motor?.mode).toBe("phase_fault");
    expect(sim.motor?.direction).toBe("none");
    expect(sim.motor?.current).toBe(8.5);
    expect(sim.motor?.speed).toBe(0);
    expect(sim.warnings.some((w) => w.includes("fázishiba") || w.includes("2 fázisú"))).toBe(true);
  });

  it("runs in Delta (Δ) mode CW with ~5.4 A when wired in triangle connection", () => {
    const world = createPrototypeWorld();
    enableSupply(world, ["rcd_3p", "mcb_3p"]);

    const wU1 = world.wagos.find((w) => w.id === "wago_motor_u1")!;
    const wV1 = world.wagos.find((w) => w.id === "wago_motor_v1")!;
    const wW1 = world.wagos.find((w) => w.id === "wago_motor_w1")!;
    const wU2 = world.wagos.find((w) => w.id === "wago_motor_u2")!;
    const wV2 = world.wagos.find((w) => w.id === "wago_motor_v2")!;
    const wW2 = world.wagos.find((w) => w.id === "wago_motor_w2")!;
    const wPE = world.wagos.find((w) => w.id === "wago_motor_pe")!;

    // Delta bridges: U1 - W2, V1 - U2, W1 - V2
    connectPorts(world, wU1.portIds[2], wW2.portIds[1], "L1", true);
    connectPorts(world, wV1.portIds[2], wU2.portIds[1], "L1", true);
    connectPorts(world, wW1.portIds[2], wV2.portIds[1], "L1", true);

    // Supply on U1, V1, W1
    connectPorts(world, portOf("mcb3_l1"), wU1.portIds[1], "L1", true);
    connectPorts(world, portOf("mcb3_l2"), wV1.portIds[1], "L1", true);
    connectPorts(world, portOf("mcb3_l3"), wW1.portIds[1], "L1", true);
    connectPorts(world, portOf("top_pe"), wPE.portIds[1], "PE", true);

    const sim = simulate(world);
    expect(sim.motor?.mode).toBe("delta");
    expect(sim.motor?.direction).toBe("cw");
    expect(sim.motor?.current).toBe(5.4);
    expect(sim.motor?.peConnected).toBe(true);

    const motorDev = world.devices.find((d) => d.type === "motor_3p")!;
    expect(motorDev.on).toBe(true);
    expect(motorDev.energized).toBe(true);
  });

  it("stays OFF when coils are open-circuit (no star point and no delta bridge)", () => {
    const world = createPrototypeWorld();
    enableSupply(world, ["rcd_3p", "mcb_3p"]);

    const wU1 = world.wagos.find((w) => w.id === "wago_motor_u1")!;
    const wV1 = world.wagos.find((w) => w.id === "wago_motor_v1")!;
    const wW1 = world.wagos.find((w) => w.id === "wago_motor_w1")!;

    // Connected to L1, L2, L3, but U2, V2, W2 are completely open
    connectPorts(world, portOf("mcb3_l1"), wU1.portIds[1], "L1", true);
    connectPorts(world, portOf("mcb3_l2"), wV1.portIds[1], "L1", true);
    connectPorts(world, portOf("mcb3_l3"), wW1.portIds[1], "L1", true);

    const sim = simulate(world);
    expect(sim.motor?.mode).toBe("off");
    expect(sim.motor?.direction).toBe("none");
    expect(sim.motor?.current).toBe(0);
  });

  it("handles Contactor-based Star-Delta start via MK1 and MK2/MK3", () => {
    const world = createPrototypeWorld();
    enableSupply(world, ["rcd_3p", "rcd_1p", "mcb_3p", "mcb_1p_b10"]);

    const wU1 = world.wagos.find((w) => w.id === "wago_motor_u1")!;
    const wV1 = world.wagos.find((w) => w.id === "wago_motor_v1")!;
    const wW1 = world.wagos.find((w) => w.id === "wago_motor_w1")!;
    const wU2 = world.wagos.find((w) => w.id === "wago_motor_u2")!;
    const wV2 = world.wagos.find((w) => w.id === "wago_motor_v2")!;
    const wW2 = world.wagos.find((w) => w.id === "wago_motor_w2")!;
    const wPE = world.wagos.find((w) => w.id === "wago_motor_pe")!;

    // PE földelés
    connectPorts(world, portOf("top_pe"), wPE.portIds[1], "PE", true);

    // 1. Főáramkör: 3P C16A -> MK1 fő bemenet
    connectPorts(world, portOf("mcb3_l1"), portOf("mk1_in_l1"), "L1", true);
    connectPorts(world, portOf("mcb3_l2"), portOf("mk1_in_l2"), "L1", true);
    connectPorts(world, portOf("mcb3_l3"), portOf("mk1_in_l3"), "L1", true);

    // MK1 fő kimenet -> Motor U1, V1, W1
    connectPorts(world, portOf("mk1_out_t1"), wU1.portIds[1], "L1", true);
    connectPorts(world, portOf("mk1_out_t2"), wV1.portIds[1], "L1", true);
    connectPorts(world, portOf("mk1_out_t3"), wW1.portIds[1], "L1", true);

    // 2. MK2 (Csillag mágneskapcsoló): bemenete U2, V2, W2; kimenete rövidre zárva
    connectPorts(world, wU2.portIds[1], portOf("mk2_in_l1"), "L1", true);
    connectPorts(world, wV2.portIds[1], portOf("mk2_in_l2"), "L1", true);
    connectPorts(world, wW2.portIds[1], portOf("mk2_in_l3"), "L1", true);
    connectPorts(world, portOf("mk2_out_t1"), portOf("mk2_out_t2"), "L1", true);
    connectPorts(world, portOf("mk2_out_t2"), portOf("mk2_out_t3"), "L1", true);

    // 3. MK3 (Delta mágneskapcsoló): delta háromszög áthidalás
    connectPorts(world, wU1.portIds[2], portOf("mk3_in_l1"), "L1", true);
    connectPorts(world, wV1.portIds[2], portOf("mk3_in_l2"), "L1", true);
    connectPorts(world, wW1.portIds[2], portOf("mk3_in_l3"), "L1", true);
    connectPorts(world, portOf("mk3_out_t1"), wW2.portIds[1], "L1", true);
    connectPorts(world, portOf("mk3_out_t2"), wU2.portIds[2], "L1", true);
    connectPorts(world, portOf("mk3_out_t3"), wV2.portIds[2], "L1", true);

    // 4. Vezérlő áramkör:
    // Nullák a mágneskapcsolók A2 kapcsaira
    connectPorts(world, portOf("top_1n"), portOf("mk1_a2"), "N", true);
    connectPorts(world, portOf("top_1n"), portOf("mk2_a2"), "N", true);
    connectPorts(world, portOf("top_1n"), portOf("mk3_a2"), "N", true);

    // Főkapcsoló (101): betáp az 1P B10A kismegszakítóból
    connectPorts(world, portOf("mcb1_b10_l1"), portOf("sw101_1"), "L1", true);
    // 101 kapcsoló kapcsolt szála táplálja MK1 tekercsét ÉS a 106-os csillag-delta választó közösét
    connectPorts(world, portOf("sw101_2"), portOf("mk1_a1"), "L1", true);
    connectPorts(world, portOf("sw101_2"), portOf("sw106_1_1"), "L1", true);

    // 106-os váltókapcsoló alapállása (kapocs 3) -> MK2 A1 (Csillag), átbillentett állása (kapocs 2) -> MK3 A1 (Delta)
    connectPorts(world, portOf("sw106_1_3"), portOf("mk2_a1"), "L1", true);
    connectPorts(world, portOf("sw106_1_2"), portOf("mk3_a1"), "L1", true);

    // 0. Kezdőállapot: sw101 le van kapcsolva -> motor ÁLL
    let sim = simulate(world);
    expect(sim.motor?.mode).toBe("off");
    expect(sim.motor?.current).toBe(0);

    // 1. Főkapcsoló (101) bekapcsolása -> MK1 behúz ÉS MK2 (Csillag) behúz -> Motor CSILLAG (Y) üzemben forog!
    world.devices.find((d) => d.id === "dev_sw101")!.on = true;
    sim = simulate(world);
    expect(sim.contactorOn.has("dev_mk1")).toBe(true);
    expect(sim.contactorOn.has("dev_mk2")).toBe(true);
    expect(sim.contactorOn.has("dev_mk3")).toBe(false);
    expect(sim.motor?.mode).toBe("star");
    expect(sim.motor?.direction).toBe("cw");
    expect(sim.motor?.current).toBe(1.8);

    // 2. Csillag-Delta átváltás (106-os kapcsoló átbillentése) -> MK2 elenged, MK3 (Delta) behúz -> DELTA (Δ) üzem!
    world.devices.find((d) => d.id === "dev_sw106_1")!.on = true;
    sim = simulate(world);
    expect(sim.contactorOn.has("dev_mk1")).toBe(true);
    expect(sim.contactorOn.has("dev_mk2")).toBe(false);
    expect(sim.contactorOn.has("dev_mk3")).toBe(true);
    expect(sim.motor?.mode).toBe("delta");
    expect(sim.motor?.direction).toBe("cw");
    expect(sim.motor?.current).toBe(5.4);

    // 3. Főkapcsoló (101) lekapcsolása -> MK1 és MK3 elenged -> Motor LEÁLL
    world.devices.find((d) => d.id === "dev_sw101")!.on = false;
    sim = simulate(world);
    expect(sim.contactorOn.has("dev_mk1")).toBe(false);
    expect(sim.motor?.mode).toBe("off");
    expect(sim.motor?.current).toBe(0);
  });

  it("detects short circuit and trips 3P C16A if both Star (MK2) and Delta (MK3) contactors are active simultaneously", () => {
    const world = createPrototypeWorld();
    enableSupply(world, ["rcd_3p", "rcd_1p", "mcb_3p", "mcb_1p_b10"]);

    const wU1 = world.wagos.find((w) => w.id === "wago_motor_u1")!;
    const wV1 = world.wagos.find((w) => w.id === "wago_motor_v1")!;
    const wW1 = world.wagos.find((w) => w.id === "wago_motor_w1")!;
    const wU2 = world.wagos.find((w) => w.id === "wago_motor_u2")!;
    const wV2 = world.wagos.find((w) => w.id === "wago_motor_v2")!;
    const wW2 = world.wagos.find((w) => w.id === "wago_motor_w2")!;
    const wPE = world.wagos.find((w) => w.id === "wago_motor_pe")!;

    connectPorts(world, portOf("top_pe"), wPE.portIds[1], "PE", true);

    // 3P C16A -> MK1 -> Motor U1, V1, W1
    connectPorts(world, portOf("mcb3_l1"), portOf("mk1_in_l1"), "L1", true);
    connectPorts(world, portOf("mcb3_l2"), portOf("mk1_in_l2"), "L1", true);
    connectPorts(world, portOf("mcb3_l3"), portOf("mk1_in_l3"), "L1", true);
    connectPorts(world, portOf("mk1_out_t1"), wU1.portIds[1], "L1", true);
    connectPorts(world, portOf("mk1_out_t2"), wV1.portIds[1], "L1", true);
    connectPorts(world, portOf("mk1_out_t3"), wW1.portIds[1], "L1", true);

    // MK2 (Star)
    connectPorts(world, wU2.portIds[1], portOf("mk2_in_l1"), "L1", true);
    connectPorts(world, wV2.portIds[1], portOf("mk2_in_l2"), "L1", true);
    connectPorts(world, wW2.portIds[1], portOf("mk2_in_l3"), "L1", true);
    connectPorts(world, portOf("mk2_out_t1"), portOf("mk2_out_t2"), "L1", true);
    connectPorts(world, portOf("mk2_out_t2"), portOf("mk2_out_t3"), "L1", true);

    // MK3 (Delta)
    connectPorts(world, wU1.portIds[2], portOf("mk3_in_l1"), "L1", true);
    connectPorts(world, wV1.portIds[2], portOf("mk3_in_l2"), "L1", true);
    connectPorts(world, wW1.portIds[2], portOf("mk3_in_l3"), "L1", true);
    connectPorts(world, portOf("mk3_out_t1"), wW2.portIds[1], "L1", true);
    connectPorts(world, portOf("mk3_out_t2"), wU2.portIds[2], "L1", true);
    connectPorts(world, portOf("mk3_out_t3"), wV2.portIds[2], "L1", true);

    // MK coils: feed N to A2
    connectPorts(world, portOf("top_1n"), portOf("mk1_a2"), "N", true);
    connectPorts(world, portOf("top_1n"), portOf("mk2_a2"), "N", true);
    connectPorts(world, portOf("top_1n"), portOf("mk3_a2"), "N", true);

    // Feed L1 directly to MK1, MK2 and MK3 A1 simultaneously (fault condition without interlock)
    connectPorts(world, portOf("mcb1_b10_l1"), portOf("mk1_a1"), "L1", true);
    connectPorts(world, portOf("mcb1_b10_l1"), portOf("mk2_a1"), "L1", true);
    connectPorts(world, portOf("mcb1_b10_l1"), portOf("mk3_a1"), "L1", true);

    const sim = simulate(world);
    // Zárlat és kismegszakító leoldás!
    expect(sim.shortCircuit).toBe(true);
    expect(world.devices.find((d) => d.id === "mcb_3p")?.on).toBe(false);
  });
});
