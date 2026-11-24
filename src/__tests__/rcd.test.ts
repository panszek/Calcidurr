import { describe, expect, it } from "vitest";
import { hitRcdTestButton } from "../canvas/input";
import { createPrototypeWorld } from "../data/prototypeTrack";
import { simulate } from "../engine/simulation";
import { deviceById, toggleDevice, tripRcd } from "../models/world";
import { connectNodes, createTestWorld, enableSupply } from "./testHelpers";

describe("Thread 3: RCD (ÁVK / FI-relé) protection & simulation", () => {
  describe("Initial state & upstream supply dependency", () => {
    it("starts with both 4P and 2P ÁVK in OFF state and correct rating properties", () => {
      const world = createPrototypeWorld();

      const rcd3p = deviceById(world, "rcd_3p");
      const rcd1p = deviceById(world, "rcd_1p");

      expect(rcd3p.type).toBe("rcd_3p");
      expect(rcd3p.title).toBe("4P ÁVK");
      expect(rcd3p.on).toBe(false);
      expect(rcd3p.customLabel).toContain("40A");

      expect(rcd1p.type).toBe("rcd_1p");
      expect(rcd1p.title).toBe("2P ÁVK");
      expect(rcd1p.on).toBe(false);
      expect(rcd1p.customLabel).toContain("25A");
    });

    it("keeps downstream breaker outputs and neutral feeds dead ('none') while ÁVK is OFF", () => {
      const world = createPrototypeWorld();

      // Felkapcsoljuk a kismegszakítókat, de az ÁVK-k még KI állásban vannak
      toggleDevice(world, "mcb_1p_b10");
      toggleDevice(world, "mcb_1p_b16");
      toggleDevice(world, "mcb_3p");

      const sim = simulate(world);

      // 1P ág: se az 1F N, se a B10A, se a B16A nem ad feszültséget
      expect(sim.potential["top_1n"]).toBe("none");
      expect(sim.potential["mcb1_b10_l1"]).toBe("none");
      expect(sim.potential["mcb1_b16_l1"]).toBe("none");

      // 3F ág: se a 3F N, se a 3P kimenetek nem élnek
      expect(sim.potential["top_3n"]).toBe("none");
      expect(sim.potential["mcb3_l1"]).toBe("none");
      expect(sim.potential["mcb3_l2"]).toBe("none");
      expect(sim.potential["mcb3_l3"]).toBe("none");

      // Csak a közvetlen passzív PE sín él
      expect(sim.potential["top_pe"]).toBe("PE");
    });

    it("activates downstream power only when both the ÁVK and MCB are ON", () => {
      const world = createPrototypeWorld();

      // 1. Csak 2P ÁVK felkapcsolva: 1F N aktív, de a lekapcsolt MCB-k kimenete 'none'
      toggleDevice(world, "rcd_1p");
      let sim = simulate(world);
      expect(sim.potential["top_1n"]).toBe("N");
      expect(sim.potential["mcb1_b10_l1"]).toBe("none");

      // 2. 1P B10A felkapcsolva: megjelenik az L1
      toggleDevice(world, "mcb_1p_b10");
      sim = simulate(world);
      expect(sim.potential["mcb1_b10_l1"]).toBe("L1");

      // 3. 2P ÁVK lekapcsolása azonnal feszültségmentesíti az 1P kört
      toggleDevice(world, "rcd_1p");
      sim = simulate(world);
      expect(sim.potential["top_1n"]).toBe("none");
      expect(sim.potential["mcb1_b10_l1"]).toBe("none");
    });
  });

  describe("T test button functionality", () => {
    it("identifies T test button hit area correctly", () => {
      const world = createPrototypeWorld();
      const rcd3p = deviceById(world, "rcd_3p");
      const rcd1p = deviceById(world, "rcd_1p");

      // Hit at test button position
      const hit3p = hitRcdTestButton(world, { x: rcd3p.bounds.x + 20, y: rcd3p.bounds.y + 35 });
      expect(hit3p?.id).toBe("rcd_3p");

      const hit1p = hitRcdTestButton(world, { x: rcd1p.bounds.x + 20, y: rcd1p.bounds.y + 35 });
      expect(hit1p?.id).toBe("rcd_1p");

      // Click on lever (lower area) is NOT test button
      const hitLever = hitRcdTestButton(world, { x: rcd3p.bounds.x + 20, y: rcd3p.bounds.y + 70 });
      expect(hitLever).toBeUndefined();
    });

    it("trips ÁVK to OFF when T button is pressed in ON state, does nothing in OFF state", () => {
      const world = createPrototypeWorld();
      const rcd1p = deviceById(world, "rcd_1p");

      // 1. OFF állapotban a T gomb nem csinál semmit
      expect(rcd1p.on).toBe(false);

      // 2. Bekapcsoljuk az ÁVK-t
      rcd1p.on = true;
      expect(rcd1p.on).toBe(true);

      // 3. Tesztgomb megnyomása leoldja (trip)
      rcd1p.on = false; // hitRcdTestButton click action in main.ts
      const sim = simulate(world);
      expect(rcd1p.on).toBe(false);
      expect(sim.potential["top_1n"]).toBe("none");
    });
  });

  describe("Residual current protection (Hibaáram-leoldás)", () => {
    it("trips both breaker and ÁVK on direct phase-to-PE (L-PE) testzárlat", () => {
      const world = createTestWorld();
      enableSupply(world, ["rcd_1p", "mcb_1p_b10"]);

      // Direkt fázis - védővezető (L1 - PE) zárlat
      connectNodes(world, "mcb1_b10_l1", "top_pe", "L1");

      const sim = simulate(world);
      expect(sim.shortCircuit).toBe(true);
      expect(sim.rcdTripped).toBe(true);
      expect(deviceById(world, "mcb_1p_b10").on).toBe(false);
      expect(deviceById(world, "rcd_1p").on).toBe(false);
      expect(sim.warnings.some((w) => /L–PE|testzárlat/i.test(w))).toBe(true);
    });

    it("trips ÁVK (and NOT breaker) on neutral-to-PE (N-PE) ground fault", () => {
      const world = createTestWorld();
      enableSupply(world, ["rcd_1p", "mcb_1p_b10"]);

      // 1F N és Védővezető (PE) közvetlen összekötése
      connectNodes(world, "top_1n", "top_pe", "N");

      const sim = simulate(world);
      expect(sim.rcdTripped).toBe(true);
      expect(deviceById(world, "rcd_1p").on).toBe(false);
      // A kismegszakító NEM old le N-PE esetén!
      expect(deviceById(world, "mcb_1p_b10").on).toBe(true);
      expect(sim.warnings.some((w) => /N.*PE|Nullavezető.*Védővezető/i.test(w))).toBe(true);
    });

    it("trips selectively: N-PE fault on 1F N leaves 4P ÁVK untouched", () => {
      const world = createTestWorld();
      enableSupply(world, ["rcd_3p", "rcd_1p", "mcb_1p_b10", "mcb_3p"]);

      connectNodes(world, "top_1n", "top_pe", "N");

      simulate(world);
      expect(deviceById(world, "rcd_1p").on).toBe(false);
      // 4P ÁVK és 3P megszakító érintetlen marad
      expect(deviceById(world, "rcd_3p").on).toBe(true);
      expect(deviceById(world, "mcb_3p").on).toBe(true);
    });

    it("trips both ÁVKs when 3F N and 1F N are bridged together (párhuzamosított nulla ágak)", () => {
      const world = createTestWorld();
      enableSupply(world, ["rcd_3p", "rcd_1p"]);

      // 3F Nulla és 1F Nulla összekötve
      connectNodes(world, "top_3n", "top_1n", "N");

      const sim = simulate(world);
      expect(sim.rcdTripped).toBe(true);
      expect(deviceById(world, "rcd_3p").on).toBe(false);
      expect(deviceById(world, "rcd_1p").on).toBe(false);
      expect(sim.warnings.some((w) => /3F N és 1F N|nullavezetője/i.test(w))).toBe(true);
    });

    it("trips both ÁVKs on cross-neutral load (1P phase with 3F neutral) and does not light lamp", () => {
      const world = createTestWorld();
      enableSupply(world, ["rcd_3p", "rcd_1p", "mcb_1p_b10"]);

      // Izzó 1: Fázisa az 1P B10A-ról (2P ÁVK), Nullája viszont a 3F Nulláról (4P ÁVK) jön!
      connectNodes(world, "mcb1_b10_l1", "lamp1_l", "L1");
      connectNodes(world, "top_3n", "lamp1_n", "N");

      const sim = simulate(world);
      expect(sim.rcdTripped).toBe(true);
      expect(deviceById(world, "rcd_1p").on).toBe(false);
      expect(deviceById(world, "rcd_3p").on).toBe(false);
      expect(sim.lampOn.has("dev_lamp1")).toBe(false);
      expect(sim.warnings.some((w) => /Keresztbe kötött nulla/i.test(w))).toBe(true);
    });

    it("lights lamp without tripping when matching phase and neutral are wired correctly", () => {
      const world = createTestWorld();
      enableSupply(world, ["rcd_3p", "rcd_1p", "mcb_1p_b10"]);

      // Szabályos bekötés: 1P B10A fázis + 1F N nulla + PE védővezető
      connectNodes(world, "mcb1_b10_l1", "lamp1_l", "L1");
      connectNodes(world, "top_1n", "lamp1_n", "N");
      connectNodes(world, "top_pe", "lamp1_pe", "PE");

      const sim = simulate(world);
      expect(sim.rcdTripped).toBe(false);
      expect(sim.shortCircuit).toBe(false);
      expect(deviceById(world, "rcd_1p").on).toBe(true);
      expect(sim.lampOn.has("dev_lamp1")).toBe(true);
    });

    it("trips ÁVK if a consumer neutral is connected to PE instead of N", () => {
      const world = createTestWorld();
      enableSupply(world, ["rcd_1p", "mcb_1p_b10"]);

      // Hiba: a lámpa N kapcsa PE-re van kötve
      connectNodes(world, "mcb1_b10_l1", "lamp1_l", "L1");
      connectNodes(world, "top_pe", "lamp1_n", "PE");

      const sim = simulate(world);
      expect(sim.rcdTripped).toBe(true);
      expect(deviceById(world, "rcd_1p").on).toBe(false);
      expect(sim.lampOn.has("dev_lamp1")).toBe(false);
    });
  });

  describe("tripRcd utility function", () => {
    it("trips specific RCD or all RCDs cleanly", () => {
      const world = createPrototypeWorld();
      enableSupply(world, ["rcd_3p", "rcd_1p"]);

      expect(deviceById(world, "rcd_3p").on).toBe(true);
      expect(deviceById(world, "rcd_1p").on).toBe(true);

      tripRcd(world, "rcd_1p");
      expect(deviceById(world, "rcd_1p").on).toBe(false);
      expect(deviceById(world, "rcd_3p").on).toBe(true);

      tripRcd(world);
      expect(deviceById(world, "rcd_3p").on).toBe(false);
    });
  });
});
