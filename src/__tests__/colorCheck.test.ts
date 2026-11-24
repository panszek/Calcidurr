import { describe, expect, it } from "vitest";
import { checkWireColors } from "../engine/colorCheck";
import { simulate } from "../engine/simulation";
import {
  connectNodes,
  connectPorts,
  createTestWorld,
  enableSupply,
  portOf,
} from "./testHelpers";

describe("5. szál — Használt kábelszín validáció (colorCheck)", () => {
  it("üres pályán 0 vezeték esetén 100% érvényes eredményt ad", () => {
    const world = createTestWorld();
    world.wires = [];
    const result = checkWireColors(world);

    expect(result.totalWires).toBe(0);
    expect(result.correctWires).toBe(0);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.summary).toContain("Nincs bekötött vezeték");
  });

  it("fekete fázis, kék nulla és zöld-sárga PE esetén 100% színhelyes — kikapcsolt kismegszakítóknál is", () => {
    const world = createTestWorld();
    world.wires = [];

    // Fáziság: 1P B10A -> 101 kapcsoló -> Izzó 1 L (Fekete L1)
    connectNodes(world, "mcb1_b10_l1", "sw101_1", "L1");
    connectNodes(world, "sw101_2", "lamp1_l", "L1");

    // Nullakör: 1F N -> Izzó 1 N (Kék N)
    connectNodes(world, "top_1n", "lamp1_n", "N");

    // Védővezető: PE -> Izzó 1 PE (Zöld-sárga PE)
    connectNodes(world, "top_pe", "lamp1_pe", "PE");

    // Minden megszakító kikapcsolt állapotban van!
    const mcb1 = world.devices.find((d) => d.id === "mcb_1p_b10");
    expect(mcb1?.on).toBe(false);

    const result = checkWireColors(world);
    expect(result.totalWires).toBe(4);
    expect(result.correctWires).toBe(4);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.summary).toContain("Minden vezeték (4 db) szabványosan színhelyes");
  });

  it("fekete vezeték L2 és L3 ágakban, valamint kapcsolt szálakon szabályosnak minősül", () => {
    const world = createTestWorld();
    world.wires = [];

    // 3F L2 és L3 ágak bekötése Fekete (L1) vezetékkel (nincs külön fázisszín elvárás)
    connectNodes(world, "mcb3_l2", "mk1_in_l2", "L1");
    connectNodes(world, "mcb3_l3", "mk1_in_l3", "L1");

    // Kapcsolt fázisszálak: 105 csillárkapcsoló kimenet, mozgásérzékelő kapcsolt kimenet Fekete vezetékkel
    connectNodes(world, "sw105_2", "lamp2_l", "L1");
    connectNodes(world, "pir_out", "lamp3_l", "L1");

    const result = checkWireColors(world);
    expect(result.totalWires).toBe(4);
    expect(result.correctWires).toBe(4);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("kék vezeték fáziskörben hibát jelez", () => {
    const world = createTestWorld();
    world.wires = [];

    // Fázisforrás és kapcsoló közé véletlenül Kék (N) vezetéket húzunk
    const badWire = connectNodes(world, "mcb1_b10_l1", "sw101_1", "N");

    const result = checkWireColors(world);
    expect(result.totalWires).toBe(1);
    expect(result.correctWires).toBe(0);
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(1);

    const issue = result.issues[0];
    expect(issue.wireId).toBe(badWire.id);
    expect(issue.expectedRole).toBe("phase");
    expect(issue.expectedColor).toBe("L1");
    expect(issue.actualColor).toBe("N");
    expect(issue.reason).toContain("Kék");
    expect(issue.reason).toContain("tiltott");
  });

  it("fekete vezeték nullakörben hibát jelez", () => {
    const world = createTestWorld();
    world.wires = [];

    // Nullakörbe Fekete (L1) vezetéket kötünk
    const badWire = connectNodes(world, "top_1n", "lamp1_n", "L1");

    const result = checkWireColors(world);
    expect(result.totalWires).toBe(1);
    expect(result.correctWires).toBe(0);
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(1);

    const issue = result.issues[0];
    expect(issue.wireId).toBe(badWire.id);
    expect(issue.expectedRole).toBe("neutral");
    expect(issue.expectedColor).toBe("N");
    expect(issue.actualColor).toBe("L1");
    expect(issue.reason).toContain("Kék [N]");
  });

  it("nem zöld-sárga vezeték PE körben hibát jelez", () => {
    const world = createTestWorld();
    world.wires = [];

    // PE körbe fekete vezetéket kötünk
    connectNodes(world, "top_pe", "lamp1_pe", "L1");
    // PE körbe kék vezetéket kötünk
    connectNodes(world, "top_pe", "sock_pe", "N");

    const result = checkWireColors(world);
    expect(result.totalWires).toBe(2);
    expect(result.correctWires).toBe(0);
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(2);

    expect(result.issues[0].expectedRole).toBe("pe");
    expect(result.issues[0].expectedColor).toBe("PE");
    expect(result.issues[1].expectedRole).toBe("pe");
    expect(result.issues[1].expectedColor).toBe("PE");
  });

  it("zöld-sárga vezeték fáziskörben vagy nullakörben szigorúan tiltott és hibás", () => {
    const world = createTestWorld();
    world.wires = [];

    // Fáziságba zöld-sárga (életveszélyes!)
    connectNodes(world, "mcb1_b10_l1", "sw101_1", "PE");
    // Nullakörbe zöld-sárga (tiltott!)
    connectNodes(world, "top_1n", "lamp1_n", "PE");

    const result = checkWireColors(world);
    expect(result.totalWires).toBe(2);
    expect(result.correctWires).toBe(0);
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0].reason).toContain("fáziságban szigorúan tilos");
    expect(result.issues[1].reason).toContain("nullán tiltott");
  });

  it("barna, szürke vagy piros vezeték fáziskörben hibát jelez (kizárólag Fekete L1 engedélyezett)", () => {
    const world = createTestWorld();
    world.wires = [];

    connectNodes(world, "mcb3_l2", "mk1_in_l2", "L2"); // Barna
    connectNodes(world, "mcb3_l3", "mk1_in_l3", "L3"); // Szürke
    connectNodes(world, "sw101_2", "lamp1_l", "CTRL"); // Piros

    const result = checkWireColors(world);
    expect(result.totalWires).toBe(3);
    expect(result.correctWires).toBe(0);
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(3);
    expect(result.issues[0].expectedColor).toBe("L1");
    expect(result.issues[1].expectedColor).toBe("L1");
    expect(result.issues[2].expectedColor).toBe("L1");
  });

  it("WAGO összekötőn keresztül menő hálózatok helyes szerepkör-terjesztése (szabályos 3 db kék nullaszál)", () => {
    const world = createTestWorld();
    world.wires = [];

    const wago = world.wagos[0]; // Teszt WAGO
    // 1F N -> WAGO 1. nyílás (Kék)
    connectPorts(world, portOf("top_1n"), wago.portIds[0], "N");
    // WAGO 2. nyílás -> Izzó 1 N (Kék)
    connectPorts(world, wago.portIds[1], portOf("lamp1_n"), "N");
    // WAGO 3. nyílás -> Izzó 2 N (Kék)
    connectPorts(world, wago.portIds[2], portOf("lamp2_n"), "N");

    const result = checkWireColors(world);
    expect(result.totalWires).toBe(3);
    expect(result.correctWires).toBe(3);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("WAGO összekötőn keresztül menő Nulla elágazásnál a fekete szál hibát jelez", () => {
    const world = createTestWorld();
    world.wires = [];

    const wago = world.wagos[0];
    // 1F N -> WAGO (Kék N)
    connectPorts(world, portOf("top_1n"), wago.portIds[0], "N");
    // WAGO -> Izzó 1 N (szabálytalanul Fekete L1)
    const badWire = connectPorts(world, wago.portIds[1], portOf("lamp1_n"), "L1");

    const result = checkWireColors(world);
    expect(result.totalWires).toBe(2);
    expect(result.correctWires).toBe(1);
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].wireId).toBe(badWire.id);
    expect(result.issues[0].expectedRole).toBe("neutral");
    expect(result.issues[0].expectedColor).toBe("N");
    expect(result.issues[0].actualColor).toBe("L1");
  });

  it("WAGO összekötőn keresztül menő Fázis elágazásnál a kék szál hibát jelez", () => {
    const world = createTestWorld();
    world.wires = [];

    const wago = world.wagos[0];
    // 1P B10A -> WAGO (Fekete L1)
    connectPorts(world, portOf("mcb1_b10_l1"), wago.portIds[0], "L1");
    // WAGO -> 101 kapcsoló (szabálytalanul Kék N)
    const badWire = connectPorts(world, wago.portIds[1], portOf("sw101_1"), "N");

    const result = checkWireColors(world);
    expect(result.totalWires).toBe(2);
    expect(result.correctWires).toBe(1);
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].wireId).toBe(badWire.id);
    expect(result.issues[0].expectedRole).toBe("phase");
    expect(result.issues[0].expectedColor).toBe("L1");
    expect(result.issues[0].actualColor).toBe("N");
  });

  it("3F villanymotor és fix WAGO-k kábelszín ellenőrzése (Csillag átkötések és PE)", () => {
    const world = createTestWorld();
    world.wires = [];

    // Csillag rövidzár U2-V2-W2 között Fekete (L1) vezetékekkel
    connectPorts(world, "wago_motor_u2_p2", "wago_motor_v2_p2", "L1");
    connectPorts(world, "wago_motor_v2_p3", "wago_motor_w2_p2", "L1");

    // PE bekötés Zöld-sárga (PE) vezetékkel
    connectPorts(world, portOf("top_pe"), "wago_motor_pe_p2", "PE");

    const result = checkWireColors(world);
    expect(result.totalWires).toBe(3);
    expect(result.correctWires).toBe(3);
    expect(result.valid).toBe(true);

    // Ha a motor PE-re hibásan fekete vezetéket kötnek:
    const badPe = connectPorts(world, portOf("top_pe"), "wago_motor_pe_p3", "L1");
    const result2 = checkWireColors(world);
    expect(result2.valid).toBe(false);
    expect(result2.issues.some((i) => i.wireId === badPe.id)).toBe(true);
  });

  it("közvetlen zárlatos bekötés fázis és nulla között hibát jelez", () => {
    const world = createTestWorld();
    world.wires = [];

    // Közvetlen összekötés fázis (1P B10A) és nulla (1F N) között
    const badWire = connectNodes(world, "mcb1_b10_l1", "top_1n", "L1");

    const result = checkWireColors(world);
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].wireId).toBe(badWire.id);
    expect(result.issues[0].reason).toContain("Szabálytalan közvetlen összekötés");
  });

  it("bekapcsolt kismegszakítóknál (dinamikus szimulációval) is hibátlanul működik a validáció", () => {
    const world = createTestWorld();
    world.wires = [];

    connectNodes(world, "mcb1_b10_l1", "lamp1_l", "L1");
    connectNodes(world, "top_1n", "lamp1_n", "N");
    connectNodes(world, "top_pe", "lamp1_pe", "PE");

    // Táp bekapcsolása és szimuláció futtatása
    enableSupply(world, ["rcd_1p", "mcb_1p_b10"]);
    const sim = simulate(world);
    expect(sim.lampOn.has("dev_lamp1")).toBe(true);

    const result = checkWireColors(world, sim);
    expect(result.totalWires).toBe(3);
    expect(result.correctWires).toBe(3);
    expect(result.valid).toBe(true);
  });
});
