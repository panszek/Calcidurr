import { describe, expect, it } from "vitest";
import {
  checkContinuityPath,
  computeLedSteps,
  measurePhaseRotation,
  measureUniT,
  measureVoltageBetweenPotentials,
} from "../engine/measurements";
import { simulate } from "../engine/simulation";
import { setButtonPressed, setPortTight, toggleDevice } from "../models/world";
import {
  connectNodes,
  connectPorts,
  createTestWorld,
  enableSupply,
  portOf,
  setDeviceOn,
} from "./testHelpers";

describe("UNI-T voltage & continuity tester engine (measurements.ts)", () => {
  describe("Standby & single-pole phase detection", () => {
    it("returns standby reading when no probes are placed", () => {
      const world = createTestWorld();
      const sim = simulate(world);
      const reading = measureUniT(world, sim);

      expect(reading.active).toBe(false);
      expect(reading.hasAnyProbe).toBe(false);
      expect(reading.voltage).toBe(0);
      expect(reading.isAcVoltage).toBe(false);
      expect(reading.ledSteps).toEqual([]);
      expect(reading.singlePolePhase).toBe(false);
      expect(reading.continuityActive).toBe(false);
      expect(reading.continuity).toBe(false);
      expect(reading.lcdPrimary).toBe("---");
    });

    it("detects single-pole live phase (⚡ LED) when one probe touches L1/L2/L3", () => {
      const world = createTestWorld();
      enableSupply(world, ["mcb_3p"]);
      const sim = simulate(world);

      // Csak fekete tüske élő L1 fázison
      const blackOnL1 = measureUniT(world, sim, "mcb3_l1", undefined);
      expect(blackOnL1.active).toBe(false);
      expect(blackOnL1.hasAnyProbe).toBe(true);
      expect(blackOnL1.singlePolePhase).toBe(true);
      expect(blackOnL1.continuity).toBe(false);
      expect(blackOnL1.lcdPrimary).toBe("⚡ POL");

      // Csak fekete tüske feszültségmentes ponton
      const blackOnDead = measureUniT(world, sim, "sw101_1", undefined);
      expect(blackOnDead.singlePolePhase).toBe(false);
      expect(blackOnDead.lcdPrimary).toBe("---");
    });
  });

  describe("AC voltage & phase rotation measurements", () => {
    it("measures 230 V AC between any live phase (L1/L2/L3) and N or PE, without continuity beep", () => {
      const world = createTestWorld();
      enableSupply(world, ["rcd_3p", "mcb_3p", "rcd_1p", "mcb_1p_b10"]);
      const sim = simulate(world);

      const l1N = measureUniT(world, sim, "mcb1_b10_l1", "top_1n");
      expect(l1N.active).toBe(true);
      expect(l1N.voltage).toBe(230);
      expect(l1N.isAcVoltage).toBe(true);
      expect(l1N.ledSteps).toEqual([12, 24, 50, 120, 230]);
      expect(l1N.singlePolePhase).toBe(true);
      expect(l1N.phaseRotation).toBe("none");
      expect(l1N.continuityActive).toBe(false);
      expect(l1N.continuity).toBe(false);
      expect(l1N.resistanceText).toBeNull();
      expect(l1N.lcdPrimary).toBe("230 V");

      const l1Pe = measureUniT(world, sim, "mcb1_b10_l1", "top_pe");
      expect(l1Pe.voltage).toBe(230);
      expect(l1Pe.continuity).toBe(false);

      const l2N = measureUniT(world, sim, "mcb3_l2", "top_3n");
      expect(l2N.voltage).toBe(230);

      const peL3 = measureUniT(world, sim, "top_pe", "mcb3_l3");
      expect(peL3.voltage).toBe(230);
      expect(peL3.singlePolePhase).toBe(true);
    });

    it("measures 400 V AC and R/L phase sequence between two different phases", () => {
      const world = createTestWorld();
      enableSupply(world, ["rcd_3p", "mcb_3p"]);
      const sim = simulate(world);

      // Jobb (R) forgásirány: L1->L2, L2->L3, L3->L1
      const l1L2 = measureUniT(world, sim, "mcb3_l1", "mcb3_l2");
      expect(l1L2.voltage).toBe(400);
      expect(l1L2.isAcVoltage).toBe(true);
      expect(l1L2.ledSteps).toEqual([12, 24, 50, 120, 230, 400]);
      expect(l1L2.phaseRotation).toBe("R");
      expect(l1L2.singlePolePhase).toBe(true);
      expect(l1L2.continuity).toBe(false);
      expect(l1L2.lcdPrimary).toBe("400 V");

      expect(measureUniT(world, sim, "mcb3_l2", "mcb3_l3").phaseRotation).toBe("R");
      expect(measureUniT(world, sim, "mcb3_l3", "mcb3_l1").phaseRotation).toBe("R");

      // Bal (L) forgásirány: felcserélt tüskék (L2->L1, L3->L2, L1->L3)
      const l2L1 = measureUniT(world, sim, "mcb3_l2", "mcb3_l1");
      expect(l2L1.voltage).toBe(400);
      expect(l2L1.phaseRotation).toBe("L");
      expect(measureUniT(world, sim, "mcb3_l3", "mcb3_l2").phaseRotation).toBe("L");
      expect(measureUniT(world, sim, "mcb3_l1", "mcb3_l3").phaseRotation).toBe("L");
    });

    it("shows 0 V with ⚡ warning and suppresses continuity beep when probing same live phase or live-to-floating", () => {
      const world = createTestWorld();
      enableSupply(world, ["rcd_1p", "mcb_1p_b10"]);
      connectNodes(world, "mcb1_b10_l1", "sw101_1", "L1", true);
      const sim = simulate(world);

      // Ugyanazon élő L1 potenciálon lévő két pont: 0 V különbség, de feszültség alatt áll -> NEM sípolhat!
      const sameLive = measureUniT(world, sim, "mcb1_b10_l1", "sw101_1");
      expect(sameLive.voltage).toBe(0);
      expect(sameLive.singlePolePhase).toBe(true);
      expect(sameLive.continuityActive).toBe(false);
      expect(sameLive.continuity).toBe(false);
      expect(sameLive.lcdPrimary).toBe("0 V");

      // Élő L1 és lebegő (bekötetlen) kapocs között: 0 V, ⚡ aktív, nem sípol
      const liveToFloating = measureUniT(world, sim, "mcb1_b10_l1", "lamp1_l");
      expect(liveToFloating.voltage).toBe(0);
      expect(liveToFloating.singlePolePhase).toBe(true);
      expect(liveToFloating.continuity).toBe(false);
      expect(liveToFloating.lcdPrimary).toBe("0 V");
    });

    it("covers helper functions directly for all potential combinations", () => {
      expect(measureVoltageBetweenPotentials("none", "none")).toBe(0);
      expect(measureVoltageBetweenPotentials("N", "PE")).toBe(0);
      expect(measureVoltageBetweenPotentials("L1", "L1")).toBe(0);
      expect(measureVoltageBetweenPotentials("L2", "PE")).toBe(230);
      expect(measureVoltageBetweenPotentials("L1", "L3")).toBe(400);

      expect(measurePhaseRotation("L1", "N")).toBe("none");
      expect(measurePhaseRotation("L1", "L1")).toBe("none");
      expect(computeLedSteps(0)).toEqual([]);
      expect(computeLedSteps(50)).toEqual([12, 24, 50]);
    });
  });

  describe("Continuity testing (0.0 Ω / OL) with circuit breakers OFF", () => {
    it("measures 0.0 Ω across a tightened wire when MCB is OFF, and OL when either screw is loose", () => {
      const world = createTestWorld();
      // Minden megszakító és ÁVK KI állapotban marad!
      const wire = connectNodes(world, "mcb1_b10_l1", "sw101_1", "L1", false);
      let sim = simulate(world);

      // Laza csavaroknál szakadás (OL)
      let res = measureUniT(world, sim, "mcb1_b10_l1", "sw101_1");
      expect(res.continuityActive).toBe(true);
      expect(res.continuity).toBe(false);
      expect(res.resistanceText).toBe("OL");
      expect(res.lcdPrimary).toBe("OL");

      // Csak az egyik vég meghúzva -> még mindig OL
      setPortTight(world, wire.startPortId, true);
      sim = simulate(world);
      res = measureUniT(world, sim, "mcb1_b10_l1", "sw101_1");
      expect(res.continuity).toBe(false);
      expect(res.lcdPrimary).toBe("OL");

      // Mindkét vég meghúzva -> folytonos (0.0 Ω + sípolás), kikapcsolt MCB mellett is!
      setPortTight(world, wire.endPortId, true);
      sim = simulate(world);
      res = measureUniT(world, sim, "mcb1_b10_l1", "sw101_1");
      expect(res.continuityActive).toBe(true);
      expect(res.continuity).toBe(true);
      expect(res.resistanceText).toBe("0.0 Ω");
      expect(res.lcdPrimary).toBe("0.0 Ω");
    });

    it("measures continuity across switches, pushbuttons, NC/NO contacts and WAGO blocks with power OFF", () => {
      const world = createTestWorld();
      const wago = world.wagos[0];

      // 1. Egypólusú kapcsoló 101: nyitva OL, zárva 0.0 Ω
      let sim = simulate(world);
      expect(measureUniT(world, sim, "sw101_1", "sw101_2").continuity).toBe(false);
      expect(measureUniT(world, sim, "sw101_1", "sw101_2").lcdPrimary).toBe("OL");

      toggleDevice(world, "dev_sw101");
      sim = simulate(world);
      expect(measureUniT(world, sim, "sw101_1", "sw101_2").continuity).toBe(true);
      expect(measureUniT(world, sim, "sw101_1", "sw101_2").lcdPrimary).toBe("0.0 Ω");

      // 2. Váltókapcsoló 106 alaphelyzetben: 1-3 zárt (0.0 Ω), 1-2 nyitott (OL)
      expect(measureUniT(world, sim, "sw106_1_1", "sw106_1_3").continuity).toBe(true);
      expect(measureUniT(world, sim, "sw106_1_1", "sw106_1_2").continuity).toBe(false);

      // 3. Nyomógombok: NC alaphelyzetben 0.0 Ω (lenyomva OL), NO alaphelyzetben OL (lenyomva 0.0 Ω)
      expect(measureUniT(world, sim, "btn_l_nc_1", "btn_l_nc_2").continuity).toBe(true);
      expect(measureUniT(world, sim, "btn_l_no_3", "btn_l_no_4").continuity).toBe(false);

      setButtonPressed(world, "dev_btn_l_nc", true);
      setButtonPressed(world, "dev_btn_l_no", true);
      sim = simulate(world);
      expect(measureUniT(world, sim, "btn_l_nc_1", "btn_l_nc_2").continuity).toBe(false);
      expect(measureUniT(world, sim, "btn_l_no_3", "btn_l_no_4").continuity).toBe(true);

      // 4. MK1 mágneskapcsoló és Időrelé nyugalmi NC érintkezői folytonosak (21-22 és 15-16)
      expect(measureUniT(world, sim, "mk1_21", "mk1_22").continuity).toBe(true);
      expect(measureUniT(world, sim, "mk1_13", "mk1_14").continuity).toBe(false);
      expect(measureUniT(world, sim, "timer_15", "timer_16").continuity).toBe(true);
      expect(measureUniT(world, sim, "timer_15", "timer_18").continuity).toBe(false);

      // 5. WAGO kötés: zárt karoknál 0.0 Ω, felnyitott karnál OL
      connectPorts(world, portOf("lamp1_pe"), wago.portIds[0], "PE", true);
      connectPorts(world, wago.portIds[1], portOf("top_pe"), "PE", true);
      sim = simulate(world);
      expect(measureUniT(world, sim, "top_pe", "lamp1_pe").continuity).toBe(true);
      expect(measureUniT(world, sim, "top_pe", "lamp1_pe").lcdPrimary).toBe("0.0 Ω");

      setPortTight(world, wago.portIds[0], false);
      sim = simulate(world);
      expect(measureUniT(world, sim, "top_pe", "lamp1_pe").continuity).toBe(false);
      expect(measureUniT(world, sim, "top_pe", "lamp1_pe").lcdPrimary).toBe("OL");
    });

    it("does not report a 0.0 Ω dead short across a properly wired lamp load when MCB is OFF", () => {
      const world = createTestWorld();
      connectNodes(world, "mcb1_b10_l1", "lamp1_l", "L1", true);
      connectNodes(world, "top_1n", "lamp1_n", "N", true);
      const sim = simulate(world);

      // Fogyasztón (izzón) keresztül nincs fémes rövidzárlat L és N között
      const res = measureUniT(world, sim, "mcb1_b10_l1", "top_1n");
      expect(res.continuity).toBe(false);
      expect(res.lcdPrimary).toBe("OL");

      // Ugyanazon csomópont önmagával folytonos, nem létező csomópontra hamis
      expect(checkContinuityPath(world, sim, "lamp1_l", "lamp1_l")).toBe(true);
      expect(checkContinuityPath(world, sim, "lamp1_l", "nonexistent")).toBe(false);
    });
  });

  describe("Live updates with pinned probes while operating switches & breakers", () => {
    it("dynamically transitions between OL, 0.0 Ω and 230 V AC as switches and breakers toggle", () => {
      const world = createTestWorld();
      connectNodes(world, "mcb1_b10_l1", "sw101_1", "L1", true);
      connectNodes(world, "sw101_2", "sock_l", "L1", true);
      connectNodes(world, "top_1n", "sock_n", "N", true);
      connectNodes(world, "top_pe", "sock_pe", "PE", true);

      // 1. Rögzített tüskék a dugalj L és N pontján, lekapcsolt kismegszakítóval -> OL (0 V)
      let sim = simulate(world);
      let socketReading = measureUniT(world, sim, "sock_n", "sock_l");
      expect(socketReading.voltage).toBe(0);
      expect(socketReading.lcdPrimary).toBe("OL");

      // 2. Bekapcsoljuk a 2P ÁVK-t és az 1P B10A-t, de a 101-es kapcsoló még KI állásban van -> 0 V (OL)
      enableSupply(world, ["rcd_1p", "mcb_1p_b10"]);
      sim = simulate(world);
      socketReading = measureUniT(world, sim, "sock_n", "sock_l");
      expect(socketReading.voltage).toBe(0);
      expect(socketReading.lcdPrimary).toBe("OL");

      // 3. Kéz eszközzel felbillentjük a 101-es kapcsolót -> élőben 230 V AC jelenik meg a dugaljban!
      toggleDevice(world, "dev_sw101");
      sim = simulate(world);
      socketReading = measureUniT(world, sim, "sock_n", "sock_l");
      expect(socketReading.voltage).toBe(230);
      expect(socketReading.isAcVoltage).toBe(true);
      expect(socketReading.continuity).toBe(false);
      expect(socketReading.lcdPrimary).toBe("230 V");

      // 4. Lekapcsoljuk a kismegszakítót, miközben a kapcsoló BE marad:
      // a fáziság két vége (mcb1_b10_l1 <-> sock_l) azonnal 0.0 Ω folytonosságot mutat!
      setDeviceOn(world, "mcb_1p_b10", false);
      sim = simulate(world);
      const phaseChain = measureUniT(world, sim, "mcb1_b10_l1", "sock_l");
      expect(phaseChain.voltage).toBe(0);
      expect(phaseChain.continuity).toBe(true);
      expect(phaseChain.lcdPrimary).toBe("0.0 Ω");
    });
  });
});
