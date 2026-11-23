import { describe, expect, it } from "vitest";
import { createPrototypeWorld } from "../data/prototypeTrack";
import { simulate } from "../engine/simulation";
import { toggleDevice } from "../models/world";

describe("Prototype track initial state (Thread 1: All OFF + Loose Screws)", () => {
  it("starts with all breakers, motor protector and controllable devices in OFF (false) state", () => {
    const world = createPrototypeWorld();

    const mcb3p = world.devices.find((d) => d.id === "mcb_3p")!;
    const mcb10 = world.devices.find((d) => d.id === "mcb_1p_b10")!;
    const mcb16 = world.devices.find((d) => d.id === "mcb_1p_b16")!;
    const mp = world.devices.find((d) => d.id === "dev_motor_protector")!;

    expect(mcb3p).toBeDefined();
    expect(mcb3p.on).toBe(false);

    expect(mcb10).toBeDefined();
    expect(mcb10.on).toBe(false);

    expect(mcb16).toBeDefined();
    expect(mcb16.on).toBe(false);

    expect(mp).toBeDefined();
    expect(mp.on).toBe(false);

    // All contactors, switches and buttons start OFF / unpressed
    for (const dev of world.devices) {
      expect(dev.on).toBe(false);
      expect(dev.pressed).toBe(false);
      expect(dev.energized).toBe(false);
    }
  });

  it("initializes all empty sorkapocs ports in loose (tight: false) state ready for wiring", () => {
    const world = createPrototypeWorld();

    expect(world.columns.length).toBe(119); // 65 + 54

    for (const col of world.columns) {
      const port = world.ports[col.portId];
      expect(port).toBeDefined();
      expect(port.tight).toBe(false);
    }
  });

  it("has zero live phase voltages on all terminals initially (only passive PE and N feeds)", () => {
    const world = createPrototypeWorld();
    const sim = simulate(world);

    // No phase is live
    expect(sim.liveNodeIds.size).toBe(0);
    expect(sim.shortCircuit).toBe(false);

    // Breaker outputs are dead (none)
    expect(sim.potential["mcb1_b10_l1"]).toBe("none");
    expect(sim.potential["mcb1_b16_l1"]).toBe("none");
    expect(sim.potential["mcb3_l1"]).toBe("none");
    expect(sim.potential["mcb3_l2"]).toBe("none");
    expect(sim.potential["mcb3_l3"]).toBe("none");

    // Passive ground and neutral feeds are available
    expect(sim.potential["top_pe"]).toBe("PE");
    expect(sim.potential["top_1n"]).toBe("N");
    expect(sim.potential["top_3n"]).toBe("N");
  });

  it("activates phase output only after the upstream breaker is toggled ON", () => {
    const world = createPrototypeWorld();

    // Toggle 1P B10A ON
    toggleDevice(world, "mcb_1p_b10");
    const sim1 = simulate(world);
    expect(sim1.potential["mcb1_b10_l1"]).toBe("L1");
    expect(sim1.potential["mcb1_b16_l1"]).toBe("none");
    expect(sim1.potential["mcb3_l1"]).toBe("none");

    // Toggle 3P C16A ON
    toggleDevice(world, "mcb_3p");
    const sim2 = simulate(world);
    expect(sim2.potential["mcb3_l1"]).toBe("L1");
    expect(sim2.potential["mcb3_l2"]).toBe("L2");
    expect(sim2.potential["mcb3_l3"]).toBe("L3");
  });
});
