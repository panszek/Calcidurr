import { describe, expect, it } from "vitest";
import { createPrototypeWorld } from "../data/prototypeTrack";
import { CONSUMER_NOMINAL_CURRENTS, measureClampCurrent } from "../engine/currentSolver";
import { simulate } from "../engine/simulation";
import { setButtonPressed, setPortTight, spawnWago, tickWorld, toggleDevice } from "../models/world";
import {
  connectNodes,
  connectPorts,
  createTestWorld,
  enableSupply,
  portOf,
  setDeviceOn,
} from "./testHelpers";

describe("Phasor Current Solver & Clamp Meter Engine (Thread 7: currentSolver.ts)", () => {
  describe("Zero-current conditions (open circuit, loose screw, PE, unplugged socket)", () => {
    it("reports 0.00 A on all wires when breakers/RCDs are OFF, switch is open, or screw is loose", () => {
      const world = createTestWorld();
      const wPhaseIn = connectNodes(world, "mcb1_b10_l1", "sw101_1", "L1", true);
      const wSwitched = connectNodes(world, "sw101_2", "lamp1_l", "L1", true);
      const wNeutral = connectNodes(world, "lamp1_n", "top_1n", "N", true);
      const wPe = connectNodes(world, "lamp1_pe", "top_pe", "PE", true);

      // 1. Minden védelmi eszköz KI állásban -> 0 A
      let sim = simulate(world);
      expect(sim.wireCurrents[wPhaseIn.id]).toBe(0);
      expect(sim.wireCurrents[wSwitched.id]).toBe(0);
      expect(sim.wireCurrents[wNeutral.id]).toBe(0);
      expect(sim.wireCurrents[wPe.id]).toBe(0);

      // 2. Táp bekapcsolva, de a 101-es kapcsoló nyitott -> 0 A az élő betápvezetéken is!
      enableSupply(world, ["rcd_1p", "mcb_1p_b10"]);
      sim = simulate(world);
      expect(sim.wireCurrents[wPhaseIn.id]).toBe(0);
      expect(sim.wireCurrents[wSwitched.id]).toBe(0);
      expect(sim.wireCurrents[wNeutral.id]).toBe(0);
      expect(sim.wireCurrents[wPe.id]).toBe(0);

      // 3. Kapcsoló felkapcsolva, de a nullavezeték egyik csavarja laza -> nyitott kör -> 0 A
      setPortTight(world, wNeutral.startPortId, false);
      toggleDevice(world, "dev_sw101");
      sim = simulate(world);
      expect(sim.lampOn.has("dev_lamp1")).toBe(false);
      expect(sim.wireCurrents[wPhaseIn.id]).toBe(0);
      expect(sim.wireCurrents[wNeutral.id]).toBe(0);

      // 4. Laza csavar meghúzása -> az áramkör záródik -> 0.43 A fázison és nullán, PE-n továbbra is 0 A!
      setPortTight(world, wNeutral.startPortId, true);
      sim = simulate(world);
      expect(sim.lampOn.has("dev_lamp1")).toBe(true);
      expect(sim.wireCurrents[wPhaseIn.id]).toBe(0.43);
      expect(sim.wireCurrents[wSwitched.id]).toBe(0.43);
      expect(sim.wireCurrents[wNeutral.id]).toBe(0.43);
      expect(sim.wireCurrents[wPe.id]).toBe(0);
    });

    it("reports 0.00 A on dead-end live WAGO stubs and unloaded socket wires", () => {
      const world = createTestWorld();
      enableSupply(world, ["rcd_1p", "mcb_1p_b16"]);
      const wago = world.wagos[0];

      const wStub = connectPorts(world, portOf("mcb1_b16_l1"), wago.portIds[0], "L1", true);
      const wSockL = connectPorts(world, wago.portIds[1], portOf("sock_l"), "L1", true);
      const wSockN = connectNodes(world, "sock_n", "top_1n", "N", true);
      const wSockPe = connectNodes(world, "sock_pe", "top_pe", "PE", true);

      const sim = simulate(world);
      expect(sim.activeDevices.has("dev_socket")).toBe(true);
      expect(sim.wireCurrents[wStub.id]).toBe(0);
      expect(sim.wireCurrents[wSockL.id]).toBe(0);
      expect(sim.wireCurrents[wSockN.id]).toBe(0);
      expect(sim.wireCurrents[wSockPe.id]).toBe(0);
    });
  });

  describe("Single & parallel consumers (Kirchhoff node current summation)", () => {
    it("measures ~0.86 A on shared phase/neutral trunks and ~0.43 A on individual branches for 2 parallel lamps", () => {
      const world = createTestWorld();
      enableSupply(world, ["rcd_1p", "mcb_1p_b10"]);

      const wagoL = world.wagos[0];
      const wagoN = world.wagos[1];

      // Közös fázis főág -> WAGO -> 2 párhuzamos izzó ág
      const wMainL = connectPorts(world, portOf("mcb1_b10_l1"), wagoL.portIds[0], "L1", true);
      const wBranchL1 = connectPorts(world, wagoL.portIds[1], portOf("lamp1_l"), "L1", true);
      const wBranchL2 = connectPorts(world, wagoL.portIds[2], portOf("lamp2_l"), "L1", true);

      // 2 izzó nulla ága -> közös WAGO -> közös nulla főág
      const wBranchN1 = connectPorts(world, portOf("lamp1_n"), wagoN.portIds[0], "N", true);
      const wBranchN2 = connectPorts(world, portOf("lamp2_n"), wagoN.portIds[1], "N", true);
      const wMainN = connectPorts(world, wagoN.portIds[2], portOf("top_1n"), "N", true);

      const sim = simulate(world);
      expect(sim.lampOn.has("dev_lamp1")).toBe(true);
      expect(sim.lampOn.has("dev_lamp2")).toBe(true);

      // Főágakon 2 * 0.43 = 0.86 A, leágazásokon 0.43 A
      expect(sim.wireCurrents[wMainL.id]).toBe(0.86);
      expect(sim.wireCurrents[wMainN.id]).toBe(0.86);
      expect(sim.wireCurrents[wBranchL1.id]).toBe(0.43);
      expect(sim.wireCurrents[wBranchL2.id]).toBe(0.43);
      expect(sim.wireCurrents[wBranchN1.id]).toBe(0.43);
      expect(sim.wireCurrents[wBranchN2.id]).toBe(0.43);

      // Ha a 2. izzó WAGO karját felnyitjuk, a főág azonnal visszaesik 0.43 A-re!
      setPortTight(world, wagoL.portIds[2], false);
      const simOneOpen = simulate(world);
      expect(simOneOpen.wireCurrents[wMainL.id]).toBe(0.43);
      expect(simOneOpen.wireCurrents[wMainN.id]).toBe(0.43);
      expect(simOneOpen.wireCurrents[wBranchL1.id]).toBe(0.43);
      expect(simOneOpen.wireCurrents[wBranchL2.id]).toBe(0);
    });

    it("dynamically sums currents through two-circuit chandelier switch 105 (0 A -> 0.43 A -> 0.86 A -> 1.29 A)", () => {
      const world = createTestWorld();
      enableSupply(world, ["rcd_1p", "mcb_1p_b10"]);
      const wagoL = world.wagos[0];
      const wagoN = world.wagos[1];

      const wFeed = connectPorts(world, portOf("mcb1_b10_l1"), wagoL.portIds[0], "L1", true);
      const wTo105 = connectPorts(world, wagoL.portIds[1], portOf("sw105_1"), "L1", true);
      const wDirectLamp3 = connectPorts(world, wagoL.portIds[2], portOf("lamp3_l"), "L1", true);

      const w105Out1 = connectNodes(world, "sw105_2", "lamp1_l", "L1", true);
      const w105Out2 = connectNodes(world, "sw105_3", "lamp2_l", "L1", true);

      connectPorts(world, portOf("lamp1_n"), wagoN.portIds[0], "N", true);
      connectPorts(world, portOf("lamp2_n"), wagoN.portIds[1], "N", true);
      connectPorts(world, portOf("lamp3_n"), wagoN.portIds[2], "N", true);
      const wCommonN = connectPorts(world, wagoN.portIds[3], portOf("top_1n"), "N", true);

      // Csak Izzó 3 világít direktben (105 mindkét billentyűje KI)
      let sim = simulate(world);
      expect(sim.wireCurrents[wDirectLamp3.id]).toBe(0.43);
      expect(sim.wireCurrents[wTo105.id]).toBe(0);
      expect(sim.wireCurrents[wFeed.id]).toBe(0.43);

      // 105 bal billentyű BE -> Izzó 1 + Izzó 3 = 0.86 A
      toggleDevice(world, "dev_sw105", 1);
      sim = simulate(world);
      expect(sim.wireCurrents[w105Out1.id]).toBe(0.43);
      expect(sim.wireCurrents[w105Out2.id]).toBe(0);
      expect(sim.wireCurrents[wTo105.id]).toBe(0.43);
      expect(sim.wireCurrents[wFeed.id]).toBe(0.86);

      // 105 jobb billentyű is BE -> mind a 3 izzó világít = 1.29 A
      toggleDevice(world, "dev_sw105", 2);
      sim = simulate(world);
      expect(sim.wireCurrents[wTo105.id]).toBe(0.86);
      expect(sim.wireCurrents[wFeed.id]).toBe(1.29);
      expect(sim.wireCurrents[wCommonN.id]).toBe(1.29);
    });

    it("computes contactor coil (~0.05 A), relays/PIR (~0.02 A), and combined coil + lamp currents", () => {
      const world = createTestWorld();
      enableSupply(world, ["rcd_1p", "mcb_1p_b10"]);

      const wagoL = world.wagos[0];
      const wagoN = world.wagos[1];

      // Közös L1 betáp megosztva: MK1 tekercs (0.05 A), MK1 főérintkezőn át Izzó 1 (0.43 A), Időrelé tekercs (0.02 A) és PIR (0.02 A)
      const wSupplyL = connectPorts(world, portOf("mcb1_b10_l1"), wagoL.portIds[0], "L1", true);
      const wCoilL = connectPorts(world, wagoL.portIds[1], portOf("mk1_a1"), "L1", true);
      const wMainIn = connectPorts(world, wagoL.portIds[2], portOf("mk1_in_l1"), "L1", true);
      const wTimerL = connectPorts(world, wagoL.portIds[3], portOf("timer_a1"), "L1", true);
      const wPirL = connectPorts(world, wagoL.portIds[4], portOf("pir_l"), "L1", true);

      const wLampL = connectNodes(world, "mk1_out_t1", "lamp1_l", "L1", true);

      connectPorts(world, portOf("mk1_a2"), wagoN.portIds[0], "N", true);
      connectPorts(world, portOf("lamp1_n"), wagoN.portIds[1], "N", true);
      connectPorts(world, portOf("timer_a2"), wagoN.portIds[2], "N", true);
      connectPorts(world, portOf("pir_n"), wagoN.portIds[3], "N", true);
      const wSupplyN = connectPorts(world, wagoN.portIds[4], portOf("top_1n"), "N", true);

      let sim = simulate(world);
      expect(sim.contactorOn.has("dev_mk1")).toBe(true);
      expect(sim.lampOn.has("dev_lamp1")).toBe(true);

      expect(sim.wireCurrents[wCoilL.id]).toBe(CONSUMER_NOMINAL_CURRENTS.contactorCoil); // 0.05 A
      expect(sim.wireCurrents[wMainIn.id]).toBe(0.43);
      expect(sim.wireCurrents[wLampL.id]).toBe(0.43);
      expect(sim.wireCurrents[wTimerL.id]).toBe(CONSUMER_NOMINAL_CURRENTS.relay); // 0.02 A
      expect(sim.wireCurrents[wPirL.id]).toBe(CONSUMER_NOMINAL_CURRENTS.relay); // 0.02 A

      // Összegzett főág: 0.43 + 0.05 + 0.02 + 0.02 = 0.52 A
      expect(sim.wireCurrents[wSupplyL.id]).toBe(0.52);
      expect(sim.wireCurrents[wSupplyN.id]).toBe(0.52);

      // PIR mozgásérzékelő kimenetére kötött Izzó 2 bekapcsolásakor a PIR L↑ betápján 0.02 + 0.43 = 0.45 A folyik!
      const wagoN2 = world.wagos[2];
      connectPorts(world, portOf("lamp2_n"), wagoN2.portIds[0], "N", true);
      connectPorts(world, wagoN2.portIds[1], portOf("pir_n"), "N", false); // előbb teszteljük csak pir_out bekötését
      // Kössük be szabályosan Izzó 2-t a PIR kimenetére egy új WAGO-n át a nullára:
      const wPirOut = connectNodes(world, "pir_out", "lamp2_l", "L1", true);
      // Bontsuk wPirN közvetlen kötését és fűzzük be wagoN2-t
      world.wires = world.wires.filter(
        (w) =>
          !(w.startPortId === portOf("pir_n") || w.endPortId === portOf("pir_n")) &&
          !(w.startPortId === portOf("lamp2_n") || w.endPortId === portOf("lamp2_n")),
      );
      connectPorts(world, portOf("pir_n"), wagoN2.portIds[0], "N", true);
      connectPorts(world, portOf("lamp2_n"), wagoN2.portIds[1], "N", true);
      connectPorts(world, wagoN2.portIds[2], wagoN.portIds[3], "N", true);

      // Mozgás aktiválása a PIR-en
      toggleDevice(world, "dev_pir");
      sim = simulate(world);
      expect(sim.lampOn.has("dev_lamp2")).toBe(true);
      expect(sim.wireCurrents[wPirOut.id]).toBe(0.43);
      expect(sim.wireCurrents[wPirL.id]).toBe(0.45); // 0.02 A saját elektronika + 0.43 A kapcsolt izzó!

      // Időzítő lejárta után visszaáll 0.02 A készenléti áramra
      tickWorld(world, 6.0);
      sim = simulate(world);
      expect(sim.wireCurrents[wPirOut.id]).toBe(0);
      expect(sim.wireCurrents[wPirL.id]).toBe(0.02);
    });
  });

  describe("3-Phase complex phasor summation (0°, -120°, +120°)", () => {
    it("cancels to 0.00 A on the common neutral of a balanced 3-phase load, and measures 0.43 A when 1 phase is switched off", () => {
      const world = createTestWorld();
      enableSupply(world, ["rcd_3p", "mcb_3p"]);

      const wagoN = world.wagos[0];

      // L1 -> Izzó 1, L2 -> Izzó 2, L3 -> 101 kapcsoló -> Izzó 3
      const wL1 = connectNodes(world, "mcb3_l1", "lamp1_l", "L1", true);
      const wL2 = connectNodes(world, "mcb3_l2", "lamp2_l", "L1", true);
      const wL3In = connectNodes(world, "mcb3_l3", "sw101_1", "L1", true);
      const wL3Out = connectNodes(world, "sw101_2", "lamp3_l", "L1", true);

      // Mindhárom izzó nullája közös WAGO-ba, onnan 1 db közös nullavezeték a 3F N-re
      const wN1 = connectPorts(world, portOf("lamp1_n"), wagoN.portIds[0], "N", true);
      const wN2 = connectPorts(world, portOf("lamp2_n"), wagoN.portIds[1], "N", true);
      const wN3 = connectPorts(world, portOf("lamp3_n"), wagoN.portIds[2], "N", true);
      const wCommonNeutral = connectPorts(world, wagoN.portIds[3], portOf("top_3n"), "N", true);

      // 1. Szimmetrikus 3-fázisú terhelés (101 kapcsoló BE -> mind a 3 izzó világít L1, L2, L3 fázisokról)
      toggleDevice(world, "dev_sw101");
      let sim = simulate(world);
      expect(sim.lampOn.size).toBe(3);

      expect(sim.wireCurrents[wL1.id]).toBe(0.43);
      expect(sim.wireCurrents[wL2.id]).toBe(0.43);
      expect(sim.wireCurrents[wL3In.id]).toBe(0.43);
      expect(sim.wireCurrents[wL3Out.id]).toBe(0.43);
      expect(sim.wireCurrents[wN1.id]).toBe(0.43);
      expect(sim.wireCurrents[wN2.id]).toBe(0.43);
      expect(sim.wireCurrents[wN3.id]).toBe(0.43);

      // Kiegyensúlyozott 3-fázisú terhelés közös nullavezetőjén pontosan 0.00 A folyik!
      expect(sim.wireCurrents[wCommonNeutral.id]).toBe(0);

      // 2. Aszimmetrikus 2-fázisú terhelés (L3 lekapcsolva, csak L1 és L2 aktív):
      // |0.43∠0° + 0.43∠-120°| = 0.43 A a közös nullavezetőn!
      toggleDevice(world, "dev_sw101");
      sim = simulate(world);
      expect(sim.lampOn.size).toBe(2);
      expect(sim.wireCurrents[wL1.id]).toBe(0.43);
      expect(sim.wireCurrents[wL2.id]).toBe(0.43);
      expect(sim.wireCurrents[wL3In.id]).toBe(0);
      expect(sim.wireCurrents[wCommonNeutral.id]).toBe(0.43);
    });
  });

  describe("3-Phase Induction Motor currents (Star, Delta line vs winding, Star-Delta starter, Phase fault)", () => {
    it("measures ~1.80 A in Star (Y) mode on line wires and star-bridge jumpers, and 0.00 A on PE", () => {
      const world = createPrototypeWorld();
      enableSupply(world, ["rcd_3p", "mcb_3p"]);

      const wU1 = world.wagos.find((w) => w.id === "wago_motor_u1")!;
      const wV1 = world.wagos.find((w) => w.id === "wago_motor_v1")!;
      const wW1 = world.wagos.find((w) => w.id === "wago_motor_w1")!;
      const wU2 = world.wagos.find((w) => w.id === "wago_motor_u2")!;
      const wV2 = world.wagos.find((w) => w.id === "wago_motor_v2")!;
      const wW2 = world.wagos.find((w) => w.id === "wago_motor_w2")!;
      const wPE = world.wagos.find((w) => w.id === "wago_motor_pe")!;

      const wBridge1 = connectPorts(world, wU2.portIds[1], wV2.portIds[1], "L1", true);
      const wBridge2 = connectPorts(world, wV2.portIds[2], wW2.portIds[1], "L1", true);

      const wLine1 = connectPorts(world, portOf("mcb3_l1"), wU1.portIds[1], "L1", true);
      const wLine2 = connectPorts(world, portOf("mcb3_l2"), wV1.portIds[1], "L1", true);
      const wLine3 = connectPorts(world, portOf("mcb3_l3"), wW1.portIds[1], "L1", true);
      const wEarth = connectPorts(world, portOf("top_pe"), wPE.portIds[1], "PE", true);

      const sim = simulate(world);
      expect(sim.motor?.mode).toBe("star");
      expect(sim.wireCurrents[wLine1.id]).toBe(1.8);
      expect(sim.wireCurrents[wLine2.id]).toBe(1.8);
      expect(sim.wireCurrents[wLine3.id]).toBe(1.8);
      expect(sim.wireCurrents[wBridge1.id]).toBe(1.8);
      expect(sim.wireCurrents[wBridge2.id]).toBe(1.8);
      expect(sim.wireCurrents[wEarth.id]).toBe(0);
    });

    it("measures ~5.40 A on line supply wires and ~3.12 A on winding/delta-bridge wires in Delta (Δ) mode", () => {
      const world = createPrototypeWorld();
      enableSupply(world, ["rcd_3p", "mcb_3p"]);

      const wU1 = world.wagos.find((w) => w.id === "wago_motor_u1")!;
      const wV1 = world.wagos.find((w) => w.id === "wago_motor_v1")!;
      const wW1 = world.wagos.find((w) => w.id === "wago_motor_w1")!;
      const wU2 = world.wagos.find((w) => w.id === "wago_motor_u2")!;
      const wV2 = world.wagos.find((w) => w.id === "wago_motor_v2")!;
      const wW2 = world.wagos.find((w) => w.id === "wago_motor_w2")!;
      const wPE = world.wagos.find((w) => w.id === "wago_motor_pe")!;

      // Delta tekercs-áthidaló vezetékek (U1-W2, V1-U2, W1-V2) -> tekercság áram (~3.12 A)
      const wDelta1 = connectPorts(world, wU1.portIds[2], wW2.portIds[1], "L1", true);
      const wDelta2 = connectPorts(world, wV1.portIds[2], wU2.portIds[1], "L1", true);
      const wDelta3 = connectPorts(world, wW1.portIds[2], wV2.portIds[1], "L1", true);

      // Vonali betápvezetékek (3P C16A -> U1, V1, W1) -> vonali áram (~5.40 A)
      const wLine1 = connectPorts(world, portOf("mcb3_l1"), wU1.portIds[1], "L1", true);
      const wLine2 = connectPorts(world, portOf("mcb3_l2"), wV1.portIds[1], "L1", true);
      const wLine3 = connectPorts(world, portOf("mcb3_l3"), wW1.portIds[1], "L1", true);
      connectPorts(world, portOf("top_pe"), wPE.portIds[1], "PE", true);

      const sim = simulate(world);
      expect(sim.motor?.mode).toBe("delta");

      expect(sim.wireCurrents[wLine1.id]).toBe(5.4);
      expect(sim.wireCurrents[wLine2.id]).toBe(5.4);
      expect(sim.wireCurrents[wLine3.id]).toBe(5.4);

      expect(sim.wireCurrents[wDelta1.id]).toBe(3.12);
      expect(sim.wireCurrents[wDelta2.id]).toBe(3.12);
      expect(sim.wireCurrents[wDelta3.id]).toBe(3.12);
    });

    it("tracks Star -> Delta current transition in a contactor Y/Δ starter (1.80 A -> 5.40 A line / 3.12 A branch)", () => {
      const world = createPrototypeWorld();
      enableSupply(world, ["rcd_3p", "rcd_1p", "mcb_3p", "mcb_1p_b10"]);

      const wU1 = world.wagos.find((w) => w.id === "wago_motor_u1")!;
      const wV1 = world.wagos.find((w) => w.id === "wago_motor_v1")!;
      const wW1 = world.wagos.find((w) => w.id === "wago_motor_w1")!;
      const wU2 = world.wagos.find((w) => w.id === "wago_motor_u2")!;
      const wV2 = world.wagos.find((w) => w.id === "wago_motor_v2")!;
      const wW2 = world.wagos.find((w) => w.id === "wago_motor_w2")!;
      const wPE = world.wagos.find((w) => w.id === "wago_motor_pe")!;
      const wagoN = spawnWago(world, 5, 720, 640);
      const wagoCtrl = spawnWago(world, 3, 880, 640);

      connectPorts(world, portOf("top_pe"), wPE.portIds[1], "PE", true);

      // Fő betáp: 3P C16A -> MK1 -> Motor U1, V1, W1
      const wLineL1 = connectNodes(world, "mcb3_l1", "mk1_in_l1", "L1", true);
      connectNodes(world, "mcb3_l2", "mk1_in_l2", "L1", true);
      connectNodes(world, "mcb3_l3", "mk1_in_l3", "L1", true);

      connectPorts(world, portOf("mk1_out_t1"), wU1.portIds[1], "L1", true);
      connectPorts(world, portOf("mk1_out_t2"), wV1.portIds[1], "L1", true);
      connectPorts(world, portOf("mk1_out_t3"), wW1.portIds[1], "L1", true);

      // MK2 (Csillag): U2, V2, W2 -> MK2 -> csillagpont WAGO
      const starWago = spawnWago(world, 3, 1040, 640);
      const wStarBranch = connectPorts(world, wU2.portIds[1], portOf("mk2_in_l1"), "L1", true);
      connectPorts(world, wV2.portIds[1], portOf("mk2_in_l2"), "L1", true);
      connectPorts(world, wW2.portIds[1], portOf("mk2_in_l3"), "L1", true);
      connectPorts(world, portOf("mk2_out_t1"), starWago.portIds[0], "L1", true);
      connectPorts(world, portOf("mk2_out_t2"), starWago.portIds[1], "L1", true);
      connectPorts(world, portOf("mk2_out_t3"), starWago.portIds[2], "L1", true);

      // MK3 (Delta): U1->W2, V1->U2, W1->V2 MK3-on keresztül
      const wDeltaBranch = connectPorts(world, wU1.portIds[2], portOf("mk3_in_l1"), "L1", true);
      connectPorts(world, wV1.portIds[2], portOf("mk3_in_l2"), "L1", true);
      connectPorts(world, wW1.portIds[2], portOf("mk3_in_l3"), "L1", true);
      connectPorts(world, portOf("mk3_out_t1"), wW2.portIds[2], "L1", true);
      connectPorts(world, portOf("mk3_out_t2"), wU2.portIds[2], "L1", true);
      connectPorts(world, portOf("mk3_out_t3"), wV2.portIds[2], "L1", true);

      // Vezérlés: 1P B10A -> 101 főkapcsoló -> MK1 A1 + 106 csillag/delta váltó -> MK2 A1 / MK3 A1
      connectPorts(world, portOf("top_1n"), wagoN.portIds[0], "N", true);
      connectPorts(world, portOf("mk1_a2"), wagoN.portIds[1], "N", true);
      connectPorts(world, portOf("mk2_a2"), wagoN.portIds[2], "N", true);
      connectPorts(world, portOf("mk3_a2"), wagoN.portIds[3], "N", true);

      connectNodes(world, "mcb1_b10_l1", "sw101_1", "L1", true);
      connectPorts(world, portOf("sw101_2"), wagoCtrl.portIds[0], "L1", true);
      connectPorts(world, wagoCtrl.portIds[1], portOf("mk1_a1"), "L1", true);
      connectPorts(world, wagoCtrl.portIds[2], portOf("sw106_1_1"), "L1", true);
      connectNodes(world, "sw106_1_3", "mk2_a1", "L1", true);
      connectNodes(world, "sw106_1_2", "mk3_a1", "L1", true);

      // 1. ÁLL: 0.00 A
      let sim = simulate(world);
      expect(sim.wireCurrents[wLineL1.id]).toBe(0);
      expect(sim.wireCurrents[wStarBranch.id]).toBe(0);
      expect(sim.wireCurrents[wDeltaBranch.id]).toBe(0);

      // 2. CSILLAG (Y) indítás: vonali = 1.80 A, csillag ág = 1.80 A, delta ág = 0.00 A
      setDeviceOn(world, "dev_sw101", true);
      sim = simulate(world);
      expect(sim.motor?.mode).toBe("star");
      expect(sim.wireCurrents[wLineL1.id]).toBe(1.8);
      expect(sim.wireCurrents[wStarBranch.id]).toBe(1.8);
      expect(sim.wireCurrents[wDeltaBranch.id]).toBe(0);

      // 3. DELTA (Δ) átkapcsolás: vonali = 5.40 A, tekercság (MK3) = 3.12 A, csillag ág (MK2) = 0.00 A
      setDeviceOn(world, "dev_sw106_1", true);
      sim = simulate(world);
      expect(sim.motor?.mode).toBe("delta");
      expect(sim.wireCurrents[wLineL1.id]).toBe(5.4);
      expect(sim.wireCurrents[wDeltaBranch.id]).toBe(3.12);
      expect(sim.wireCurrents[wStarBranch.id]).toBe(0);
    });

    it("measures ~8.50 A on active lines and 0.00 A on open line during 2-phase motor fault (both Star and Delta)", () => {
      // A) Csillag fázishiba (L3 hiányzik / nyitott kapcsolón át)
      const worldStar = createPrototypeWorld();
      enableSupply(worldStar, ["rcd_3p", "mcb_3p"]);

      const sU1 = worldStar.wagos.find((w) => w.id === "wago_motor_u1")!;
      const sV1 = worldStar.wagos.find((w) => w.id === "wago_motor_v1")!;
      const sW1 = worldStar.wagos.find((w) => w.id === "wago_motor_w1")!;
      const sU2 = worldStar.wagos.find((w) => w.id === "wago_motor_u2")!;
      const sV2 = worldStar.wagos.find((w) => w.id === "wago_motor_v2")!;
      const sW2 = worldStar.wagos.find((w) => w.id === "wago_motor_w2")!;

      connectPorts(worldStar, sU2.portIds[1], sV2.portIds[1], "L1", true);
      connectPorts(worldStar, sV2.portIds[2], sW2.portIds[1], "L1", true);

      const sLine1 = connectPorts(worldStar, portOf("mcb3_l1"), sU1.portIds[1], "L1", true);
      const sLine2 = connectPorts(worldStar, portOf("mcb3_l2"), sV1.portIds[1], "L1", true);
      // L3 egy nyitott 101-es kapcsolón át van bekötve -> fáziskiesés!
      connectNodes(worldStar, "mcb3_l3", "sw101_1", "L1", true);
      const sOpenLine3 = connectPorts(worldStar, portOf("sw101_2"), sW1.portIds[1], "L1", true);

      const simStar = simulate(worldStar);
      expect(simStar.motor?.mode).toBe("phase_fault");
      expect(simStar.wireCurrents[sLine1.id]).toBe(8.5);
      expect(simStar.wireCurrents[sLine2.id]).toBe(8.5);
      expect(simStar.wireCurrents[sOpenLine3.id]).toBe(0);

      // B) Delta fázishiba (L3 kiesett)
      const worldDelta = createPrototypeWorld();
      enableSupply(worldDelta, ["rcd_3p", "mcb_3p"]);
      const dU1 = worldDelta.wagos.find((w) => w.id === "wago_motor_u1")!;
      const dV1 = worldDelta.wagos.find((w) => w.id === "wago_motor_v1")!;
      const dW1 = worldDelta.wagos.find((w) => w.id === "wago_motor_w1")!;
      const dU2 = worldDelta.wagos.find((w) => w.id === "wago_motor_u2")!;
      const dV2 = worldDelta.wagos.find((w) => w.id === "wago_motor_v2")!;
      const dW2 = worldDelta.wagos.find((w) => w.id === "wago_motor_w2")!;

      connectPorts(worldDelta, dU1.portIds[2], dW2.portIds[1], "L1", true);
      connectPorts(worldDelta, dV1.portIds[2], dU2.portIds[1], "L1", true);
      connectPorts(worldDelta, dW1.portIds[2], dV2.portIds[1], "L1", true);

      const dLine1 = connectPorts(worldDelta, portOf("mcb3_l1"), dU1.portIds[1], "L1", true);
      const dLine2 = connectPorts(worldDelta, portOf("mcb3_l2"), dV1.portIds[1], "L1", true);

      const simDelta = simulate(worldDelta);
      expect(simDelta.motor?.mode).toBe("phase_fault");
      expect(simDelta.wireCurrents[dLine1.id]).toBe(8.5);
      expect(simDelta.wireCurrents[dLine2.id]).toBe(8.5);
    });
  });

  describe("Clamp Meter reading & DATA HOLD evaluation (measureClampCurrent)", () => {
    it("evaluates open jaw, live current, DATA HOLD freeze/release, overload flag, and momentary button changes", () => {
      const world = createTestWorld();
      enableSupply(world, ["rcd_1p", "mcb_1p_b10"]);

      // Nyomógombos (NO) izzó áramkör élő kapcsolgatás teszteléséhez
      const wPhase = connectNodes(world, "mcb1_b10_l1", "btn_l_no_3", "L1", true);
      connectNodes(world, "btn_l_no_4", "lamp1_l", "L1", true);
      connectNodes(world, "lamp1_n", "top_1n", "N", true);

      // 1. Nyitott pofa (nincs vezeték kiválasztva)
      let sim = simulate(world);
      const openReading = measureClampCurrent(world, sim);
      expect(openReading.hasWire).toBe(false);
      expect(openReading.liveCurrent).toBe(0);
      expect(openReading.displayCurrent).toBe(0);
      expect(openReading.hold).toBe(false);
      expect(openReading.lcdPrimary).toBe("0.00 A");

      // 2. Rögzített lakatfogó a fázisvezetéken, elengedett nyomógombnál -> 0.00 A, de a vezeték élő fázison van
      const idleClamped = measureClampCurrent(world, sim, wPhase.id);
      expect(idleClamped.hasWire).toBe(true);
      expect(idleClamped.liveCurrent).toBe(0);
      expect(idleClamped.isLiveWire).toBe(true);
      expect(idleClamped.lcdPrimary).toBe("0.00 A");

      // 3. Kéz eszközzel lenyomjuk a NO nyomógombot -> élőben 0.43 A!
      setButtonPressed(world, "dev_btn_l_no", true);
      sim = simulate(world);
      const pressedClamped = measureClampCurrent(world, sim, wPhase.id);
      expect(pressedClamped.liveCurrent).toBe(0.43);
      expect(pressedClamped.displayCurrent).toBe(0.43);
      expect(pressedClamped.overloadWarn).toBe(false);
      expect(pressedClamped.lcdPrimary).toBe("0.43 A");

      // 4. DATA HOLD bekapcsolása 0.43 A-nél, majd nyomógomb elengedése -> a kijelző megtartja a 0.43 A-t!
      const heldValue = pressedClamped.liveCurrent;
      setButtonPressed(world, "dev_btn_l_no", false);
      sim = simulate(world);
      const heldReading = measureClampCurrent(world, sim, wPhase.id, heldValue);
      expect(heldReading.liveCurrent).toBe(0);
      expect(heldReading.displayCurrent).toBe(0.43);
      expect(heldReading.hold).toBe(true);
      expect(heldReading.lcdPrimary).toBe("0.43 A");

      // 5. DATA HOLD feloldása -> visszatér a valós 0.00 A értékre
      const releasedReading = measureClampCurrent(world, sim, wPhase.id, null);
      expect(releasedReading.displayCurrent).toBe(0);
      expect(releasedReading.hold).toBe(false);
      expect(releasedReading.lcdPrimary).toBe("0.00 A");

      // 6. Magas áram / fázishiba figyelmeztetés (>= 6.0 A)
      const overloadReading = measureClampCurrent(world, sim, wPhase.id, 8.5);
      expect(overloadReading.overloadWarn).toBe(true);
      expect(overloadReading.lcdPrimary).toBe("8.50 A");
    });
  });
});
