import { describe, expect, it } from "vitest";
import { isWireLive, portPotential, simulate } from "../engine/simulation";
import {
  deviceById,
  setButtonPressed,
  setPortTight,
  tickWorld,
  toggleDevice,
} from "../models/world";
import {
  connectNodes,
  connectPorts,
  createTestWorld,
  enableSupply,
  portOf,
  setDeviceOn,
} from "./testHelpers";

describe("Electrical simulation engine", () => {
  describe("Basic circuit, loose terminals & MCB control", () => {
    it("lights a lamp only when MCB is ON and all wire ends are tightened", () => {
      const world = createTestWorld();
      enableSupply(world, ["mcb_1p_b10"]);

      const wPhase = connectNodes(world, "mcb1_b10_l1", "lamp1_l", "L1", false);
      const wNeutral = connectNodes(world, "top_1n", "lamp1_n", "N", false);

      // Mindkét vezeték laza
      let sim = simulate(world);
      expect(sim.lampOn.has("dev_lamp1")).toBe(false);
      expect(sim.looseCount).toBe(2);
      expect(sim.warnings.length).toBeGreaterThan(0);
      expect(isWireLive(sim, world, wPhase.id)).toBe(false);

      // Csak az egyik vezeték meghúzva
      setPortTight(world, wPhase.startPortId, true);
      setPortTight(world, wPhase.endPortId, true);
      sim = simulate(world);
      expect(sim.lampOn.has("dev_lamp1")).toBe(false);
      expect(sim.looseCount).toBe(1);
      expect(isWireLive(sim, world, wPhase.id)).toBe(true);

      // Mindkét vezeték meghúzva
      setPortTight(world, wNeutral.startPortId, true);
      setPortTight(world, wNeutral.endPortId, true);
      sim = simulate(world);
      expect(sim.lampOn.has("dev_lamp1")).toBe(true);
      expect(sim.looseCount).toBe(0);
      expect(isWireLive(sim, world, wPhase.id)).toBe(true);
      expect(isWireLive(sim, world, wNeutral.id)).toBe(false);
      expect(portPotential(sim, world, portOf("lamp1_l"))).toBe("L1");
      expect(portPotential(sim, world, portOf("lamp1_n"))).toBe("N");

      // Kismegszakító lekapcsolása lekapcsolja a lámpát
      setDeviceOn(world, "mcb_1p_b10", false);
      sim = simulate(world);
      expect(sim.lampOn.has("dev_lamp1")).toBe(false);
      expect(portPotential(sim, world, portOf("mcb1_b10_l1"))).toBe("none");
    });

    it("activates socket when phase and neutral are present", () => {
      const world = createTestWorld();
      enableSupply(world, ["mcb_1p_b16"]);
      connectNodes(world, "mcb1_b16_l1", "sock_l", "L1");
      connectNodes(world, "top_1n", "sock_n", "N");
      connectNodes(world, "top_pe", "sock_pe", "PE");

      const sim = simulate(world);
      expect(sim.activeDevices.has("dev_socket")).toBe(true);
      expect(sim.potential["sock_pe"]).toBe("PE");
    });

    it("distributes parallel connections via Wago blocks only on closed levers", () => {
      const world = createTestWorld();
      enableSupply(world, ["mcb_1p_b10"]);

      const w1 = world.wagos[0];
      const w2 = world.wagos[1];

      // Fázis elosztása Wago 1-en keresztül
      connectPorts(world, portOf("mcb1_b10_l1"), w1.portIds[0], "L1");
      connectPorts(world, w1.portIds[1], portOf("lamp1_l"), "L1");
      connectPorts(world, w1.portIds[2], portOf("lamp2_l"), "L1");

      // Nulla elosztása Wago 2-n keresztül
      connectPorts(world, portOf("top_1n"), w2.portIds[0], "N");
      connectPorts(world, w2.portIds[1], portOf("lamp1_n"), "N");
      connectPorts(world, w2.portIds[2], portOf("lamp2_n"), "N");

      let sim = simulate(world);
      expect(sim.lampOn.has("dev_lamp1")).toBe(true);
      expect(sim.lampOn.has("dev_lamp2")).toBe(true);

      // Csak a 2. izzó Wago karját nyitjuk fel
      setPortTight(world, w1.portIds[2], false);
      sim = simulate(world);
      expect(sim.lampOn.has("dev_lamp1")).toBe(true);
      expect(sim.lampOn.has("dev_lamp2")).toBe(false);
    });
  });

  describe("Wall switches (101, 102, 105, 106, 107, 101N)", () => {
    it("operates single-pole switch 101", () => {
      const world = createTestWorld();
      enableSupply(world, ["mcb_1p_b10"]);
      connectNodes(world, "mcb1_b10_l1", "sw101_1", "L1");
      connectNodes(world, "sw101_2", "lamp1_l", "L1");
      connectNodes(world, "top_1n", "lamp1_n", "N");

      expect(simulate(world).lampOn.has("dev_lamp1")).toBe(false);
      toggleDevice(world, "dev_sw101");
      expect(simulate(world).lampOn.has("dev_lamp1")).toBe(true);
      toggleDevice(world, "dev_sw101");
      expect(simulate(world).lampOn.has("dev_lamp1")).toBe(false);
    });

    it("operates double-pole switch 102 breaking both L and N", () => {
      const world = createTestWorld();
      enableSupply(world, ["mcb_1p_b10"]);
      connectNodes(world, "mcb1_b10_l1", "sw102_1", "L1");
      connectNodes(world, "sw102_2", "lamp1_l", "L1");
      connectNodes(world, "top_1n", "sw102_3", "N");
      connectNodes(world, "sw102_4", "lamp1_n", "N");

      let sim = simulate(world);
      expect(sim.lampOn.has("dev_lamp1")).toBe(false);
      expect(sim.potential["lamp1_l"]).toBe("none");
      expect(sim.potential["lamp1_n"]).toBe("none");

      toggleDevice(world, "dev_sw102");
      sim = simulate(world);
      expect(sim.lampOn.has("dev_lamp1")).toBe(true);
      expect(sim.potential["lamp1_l"]).toBe("L1");
      expect(sim.potential["lamp1_n"]).toBe("N");
    });

    it("operates chandelier switch 105 independently on both rockers", () => {
      const world = createTestWorld();
      enableSupply(world, ["mcb_1p_b10"]);
      const wN = world.wagos[0];

      connectNodes(world, "mcb1_b10_l1", "sw105_1", "L1");
      connectNodes(world, "sw105_2", "lamp1_l", "L1");
      connectNodes(world, "sw105_3", "lamp2_l", "L1");
      connectPorts(world, portOf("top_1n"), wN.portIds[0], "N");
      connectPorts(world, wN.portIds[1], portOf("lamp1_n"), "N");
      connectPorts(world, wN.portIds[2], portOf("lamp2_n"), "N");

      expect(simulate(world).lampOn.size).toBe(0);

      toggleDevice(world, "dev_sw105", 1);
      let sim = simulate(world);
      expect(sim.lampOn.has("dev_lamp1")).toBe(true);
      expect(sim.lampOn.has("dev_lamp2")).toBe(false);

      toggleDevice(world, "dev_sw105", 2);
      sim = simulate(world);
      expect(sim.lampOn.has("dev_lamp1")).toBe(true);
      expect(sim.lampOn.has("dev_lamp2")).toBe(true);

      toggleDevice(world, "dev_sw105", 1);
      sim = simulate(world);
      expect(sim.lampOn.has("dev_lamp1")).toBe(false);
      expect(sim.lampOn.has("dev_lamp2")).toBe(true);
    });

    it("operates 106 + 107 + 106 intermediate (keresztváltó) switching across every toggle", () => {
      const world = createTestWorld();
      enableSupply(world, ["mcb_1p_b10"]);

      // 106(1) -> 107 -> 106(2) -> Izzó 1
      connectNodes(world, "mcb1_b10_l1", "sw106_1_1", "L1");
      connectNodes(world, "sw106_1_2", "sw107_1", "L1");
      connectNodes(world, "sw106_1_3", "sw107_2", "L1");
      connectNodes(world, "sw107_3", "sw106_2_2", "L1");
      connectNodes(world, "sw107_4", "sw106_2_3", "L1");
      connectNodes(world, "sw106_2_1", "lamp1_l", "L1");
      connectNodes(world, "top_1n", "lamp1_n", "N");

      let expected = simulate(world).lampOn.has("dev_lamp1");
      for (const swId of ["dev_sw106_1", "dev_sw107", "dev_sw106_2", "dev_sw107", "dev_sw106_1"]) {
        toggleDevice(world, swId);
        expected = !expected;
        expect(simulate(world).lampOn.has("dev_lamp1")).toBe(expected);
      }
    });

    it("operates momentary push switch 101N", () => {
      const world = createTestWorld();
      enableSupply(world, ["mcb_1p_b10"]);
      connectNodes(world, "mcb1_b10_l1", "p101n_1_1", "L1");
      connectNodes(world, "p101n_1_2", "lamp1_l", "L1");
      connectNodes(world, "top_1n", "lamp1_n", "N");

      expect(simulate(world).lampOn.has("dev_lamp1")).toBe(false);
      setButtonPressed(world, "dev_p101n_1", true);
      expect(simulate(world).lampOn.has("dev_lamp1")).toBe(true);
      setButtonPressed(world, "dev_p101n_1", false);
      expect(simulate(world).lampOn.has("dev_lamp1")).toBe(false);
    });
  });

  describe("Contactor (MK1) self-holding & motor protector", () => {
    it("latches MK1 with Start (NO) + 13-14 self-hold and releases with Stop (NC)", () => {
      const world = createTestWorld();
      enableSupply(world, ["mcb_1p_b10"]);

      const wFeed = world.wagos[0];
      const wStartOut = world.wagos[1];
      const wNeutral = world.wagos[2];
      const wAfterStop = world.wagos[3];

      // Fázis elosztása: Stop NC (1) + MK1 fő L1
      connectPorts(world, portOf("mcb1_b10_l1"), wFeed.portIds[0], "L1");
      connectPorts(world, wFeed.portIds[1], portOf("btn_l_nc_1"), "L1");
      connectPorts(world, wFeed.portIds[2], portOf("mk1_in_l1"), "L1");

      // Stop NC (2) -> Start NO (3) és MK1 (13)
      connectPorts(world, portOf("btn_l_nc_2"), wAfterStop.portIds[0], "L1");
      connectPorts(world, wAfterStop.portIds[1], portOf("btn_l_no_3"), "L1");
      connectPorts(world, wAfterStop.portIds[2], portOf("mk1_13"), "L1");

      // Start NO (4) és MK1 (14) -> MK1 (A1)
      connectPorts(world, portOf("btn_l_no_4"), wStartOut.portIds[0], "L1");
      connectPorts(world, portOf("mk1_14"), wStartOut.portIds[1], "L1");
      connectPorts(world, wStartOut.portIds[2], portOf("mk1_a1"), "L1");

      // MK1 fő T1 -> Izzó 1 (L)
      connectNodes(world, "mk1_out_t1", "lamp1_l", "L1");

      // Nulla elosztása: MK1 (A2) + Izzó 1 (N)
      connectPorts(world, portOf("top_1n"), wNeutral.portIds[0], "N");
      connectPorts(world, wNeutral.portIds[1], portOf("mk1_a2"), "N");
      connectPorts(world, wNeutral.portIds[2], portOf("lamp1_n"), "N");

      // 1. Alapállapot: nyugalmi
      let sim = simulate(world);
      expect(sim.contactorOn.has("dev_mk1")).toBe(false);
      expect(sim.lampOn.has("dev_lamp1")).toBe(false);

      // 2. Start nyomógomb megnyomása -> behúz
      setButtonPressed(world, "dev_btn_l_no", true);
      sim = simulate(world);
      expect(sim.contactorOn.has("dev_mk1")).toBe(true);
      expect(sim.lampOn.has("dev_lamp1")).toBe(true);

      // 3. Start elengedése -> öntartva marad
      setButtonPressed(world, "dev_btn_l_no", false);
      sim = simulate(world);
      expect(sim.contactorOn.has("dev_mk1")).toBe(true);
      expect(sim.lampOn.has("dev_lamp1")).toBe(true);

      // 4. Stop nyomógomb megnyomása -> elenged
      setButtonPressed(world, "dev_btn_l_nc", true);
      sim = simulate(world);
      expect(sim.contactorOn.has("dev_mk1")).toBe(false);
      expect(sim.lampOn.has("dev_lamp1")).toBe(false);

      // 5. Stop elengedése -> kikapcsolva marad
      setButtonPressed(world, "dev_btn_l_nc", false);
      sim = simulate(world);
      expect(sim.contactorOn.has("dev_mk1")).toBe(false);
      expect(sim.lampOn.has("dev_lamp1")).toBe(false);
    });

    it("conducts 3 phases and 95-96 NC through motor protector only when ON", () => {
      const world = createTestWorld();
      enableSupply(world, ["mcb_3p", "mcb_1p_b10", "dev_motor_protector"]);

      connectNodes(world, "mcb3_l1", "mp_in_l1", "L1");
      connectNodes(world, "mcb3_l2", "mp_in_l2", "L2");
      connectNodes(world, "mcb3_l3", "mp_in_l3", "L3");
      connectNodes(world, "mcb1_b10_l1", "mp_95", "L1");

      let sim = simulate(world);
      expect(sim.potential["mp_out_t1"]).toBe("L1");
      expect(sim.potential["mp_out_t2"]).toBe("L2");
      expect(sim.potential["mp_out_t3"]).toBe("L3");
      expect(sim.potential["mp_96"]).toBe("L1");

      setDeviceOn(world, "dev_motor_protector", false);
      sim = simulate(world);
      expect(sim.potential["mp_out_t1"]).toBe("none");
      expect(sim.potential["mp_out_t2"]).toBe("none");
      expect(sim.potential["mp_out_t3"]).toBe("none");
      expect(sim.potential["mp_96"]).toBe("none");
    });
  });

  describe("Relays & timers (impulse, staircase, timer, motion sensor)", () => {
    it("toggles impulse relay on each rising pulse edge", () => {
      const world = createTestWorld();
      enableSupply(world, ["mcb_1p_b10"]);
      const wL = world.wagos[0];
      const wN = world.wagos[1];

      connectPorts(world, portOf("mcb1_b10_l1"), wL.portIds[0], "L1");
      connectPorts(world, wL.portIds[1], portOf("p101n_1_1"), "L1");
      connectPorts(world, wL.portIds[2], portOf("imp_1"), "L1");
      connectNodes(world, "p101n_1_2", "imp_a1", "L1");
      connectNodes(world, "imp_2", "lamp1_l", "L1");
      connectPorts(world, portOf("top_1n"), wN.portIds[0], "N");
      connectPorts(world, wN.portIds[1], portOf("imp_a2"), "N");
      connectPorts(world, wN.portIds[2], portOf("lamp1_n"), "N");

      // 1. impulzus: BE
      setButtonPressed(world, "dev_p101n_1", true);
      simulate(world);
      expect(deviceById(world, "dev_impulse").relayState).toBe(true);

      setButtonPressed(world, "dev_p101n_1", false);
      expect(simulate(world).lampOn.has("dev_lamp1")).toBe(true);

      // 2. impulzus: KI
      setButtonPressed(world, "dev_p101n_1", true);
      simulate(world);
      expect(deviceById(world, "dev_impulse").relayState).toBe(false);

      setButtonPressed(world, "dev_p101n_1", false);
      expect(simulate(world).lampOn.has("dev_lamp1")).toBe(false);
    });

    it("activates staircase relay on B pulse and turns off after countdown", () => {
      const world = createTestWorld();
      enableSupply(world, ["mcb_1p_b10"]);
      const wL = world.wagos[0];
      const wN = world.wagos[1];

      connectPorts(world, portOf("mcb1_b10_l1"), wL.portIds[0], "L1");
      connectPorts(world, wL.portIds[1], portOf("stair_l"), "L1");
      connectPorts(world, wL.portIds[2], portOf("p101n_1_1"), "L1");
      connectNodes(world, "p101n_1_2", "stair_b", "L1");
      connectNodes(world, "stair_4", "lamp1_l", "L1");
      connectPorts(world, portOf("top_1n"), wN.portIds[0], "N");
      connectPorts(world, wN.portIds[1], portOf("stair_n"), "N");
      connectPorts(world, wN.portIds[2], portOf("lamp1_n"), "N");

      setButtonPressed(world, "dev_p101n_1", true);
      simulate(world);
      setButtonPressed(world, "dev_p101n_1", false);

      expect(simulate(world).lampOn.has("dev_lamp1")).toBe(true);

      tickWorld(world, 5.1);
      expect(simulate(world).lampOn.has("dev_lamp1")).toBe(false);
    });

    it("switches timer relay from NC (15-16) to NO (15-18) after 3s delay", () => {
      const world = createTestWorld();
      enableSupply(world, ["mcb_1p_b10"]);
      const wL = world.wagos[0];
      const wN = world.wagos[1];

      connectPorts(world, portOf("mcb1_b10_l1"), wL.portIds[0], "L1");
      connectPorts(world, wL.portIds[1], portOf("sw101_1"), "L1");
      connectPorts(world, wL.portIds[2], portOf("timer_15"), "L1");
      connectNodes(world, "sw101_2", "timer_a1", "L1");
      connectNodes(world, "timer_16", "lamp1_l", "L1");
      connectNodes(world, "timer_18", "lamp2_l", "L1");

      connectPorts(world, portOf("top_1n"), wN.portIds[0], "N");
      connectPorts(world, wN.portIds[1], portOf("timer_a2"), "N");
      connectPorts(world, wN.portIds[2], portOf("lamp1_n"), "N");
      connectPorts(world, wN.portIds[3], portOf("lamp2_n"), "N");

      // Alaphelyzetben NC (15-16) zárva -> Izzó 1 világít, Izzó 2 nem
      let sim = simulate(world);
      expect(sim.lampOn.has("dev_lamp1")).toBe(true);
      expect(sim.lampOn.has("dev_lamp2")).toBe(false);

      // Tekercs bekapcsolása -> még késleltetés alatt (NC)
      toggleDevice(world, "dev_sw101");
      sim = simulate(world);
      expect(deviceById(world, "dev_timer").energized).toBe(true);
      expect(sim.lampOn.has("dev_lamp1")).toBe(true);
      expect(sim.lampOn.has("dev_lamp2")).toBe(false);

      // 3 másodperc letelte után átvált NO (15-18)-ra
      tickWorld(world, 3.1);
      sim = simulate(world);
      expect(sim.lampOn.has("dev_lamp1")).toBe(false);
      expect(sim.lampOn.has("dev_lamp2")).toBe(true);

      // Kikapcsolás után visszaáll NC-re
      toggleDevice(world, "dev_sw101");
      simulate(world);
      tickWorld(world, 0.1);
      sim = simulate(world);
      expect(sim.lampOn.has("dev_lamp1")).toBe(true);
      expect(sim.lampOn.has("dev_lamp2")).toBe(false);
    });

    it("activates motion sensor output while triggered and powered", () => {
      const world = createTestWorld();
      enableSupply(world, ["mcb_1p_b10"]);
      const wN = world.wagos[0];

      connectNodes(world, "mcb1_b10_l1", "pir_l", "L1");
      connectNodes(world, "pir_out", "lamp1_l", "L1");
      connectPorts(world, portOf("top_1n"), wN.portIds[0], "N");
      connectPorts(world, wN.portIds[1], portOf("pir_n"), "N");
      connectPorts(world, wN.portIds[2], portOf("lamp1_n"), "N");

      expect(simulate(world).lampOn.has("dev_lamp1")).toBe(false);

      toggleDevice(world, "dev_pir");
      expect(simulate(world).lampOn.has("dev_lamp1")).toBe(true);

      tickWorld(world, 5.1);
      expect(simulate(world).lampOn.has("dev_lamp1")).toBe(false);
    });
  });

  describe("Short-circuit protection", () => {
    it("detects L1-N short circuit and trips breaker", () => {
      const world = createTestWorld();
      enableSupply(world, ["mcb_1p_b10"]);
      connectNodes(world, "mcb1_b10_l1", "top_1n", "L1");

      const sim = simulate(world);
      expect(sim.shortCircuit).toBe(true);
      expect(deviceById(world, "mcb_1p_b10").on).toBe(false);
      expect(sim.warnings.some((w) => /zárlat/i.test(w))).toBe(true);
    });

    it("detects L1-PE short circuit and trips breaker", () => {
      const world = createTestWorld();
      enableSupply(world, ["mcb_1p_b10"]);
      connectNodes(world, "mcb1_b10_l1", "top_pe", "L1");

      const sim = simulate(world);
      expect(sim.shortCircuit).toBe(true);
      expect(deviceById(world, "mcb_1p_b10").on).toBe(false);
    });

    it("detects L1-L2 phase-to-phase short circuit on 3P C16A", () => {
      const world = createTestWorld();
      enableSupply(world, ["mcb_3p"]);
      connectNodes(world, "mcb3_l1", "mcb3_l2", "L1");

      const sim = simulate(world);
      expect(sim.shortCircuit).toBe(true);
      expect(deviceById(world, "mcb_3p").on).toBe(false);
    });
  });
});
