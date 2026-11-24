import { WIRE_COLORS } from "../data/colors";
import type {
  ColorCheckResult,
  ElectricalNode,
  ExpectedWireRole,
  SimState,
  WireColorId,
  WireColorIssue,
  World,
} from "../models/types";

export type { ExpectedWireRole, WireColorIssue, ColorCheckResult };

/**
 * Szabványos kábelszínek a három alapszabály szerint:
 * - Fázisvezető / minden fázis- és kapcsolt fáziság (L1/L2/L3 bontás nélkül): Fekete ("L1")
 * - Nullavezető (N): Kék ("N")
 * - Védővezető (PE): Zöld-sárga ("PE")
 */
export const EXPECTED_ROLE_COLORS: Record<ExpectedWireRole, WireColorId> = {
  phase: "L1",
  neutral: "N",
  pe: "PE",
};

/**
 * Meghatározza egy beépített, rögzített kapocspont alapértelmezett villamos szerepkörét.
 * A szabad WAGO blokkok nem rendelkeznek fix szerepkörrel (undefined),
 * szerepkörüket a hozzájuk csatlakozó hálózat határozza meg.
 */
export function getNodeBaseRole(node: ElectricalNode | undefined): ExpectedWireRole | undefined {
  if (!node) return undefined;

  // 1. Védővezető (PE)
  if (
    node.sourcePotential === "PE" ||
    node.id === "top_pe" ||
    node.id === "sock_pe" ||
    node.id === "motor_pe" ||
    node.id.endsWith("_pe") ||
    node.label === "PE" ||
    node.functionLabel.toLowerCase().includes("védővezető") ||
    node.functionLabel.toLowerCase().includes("pe")
  ) {
    return "pe";
  }

  // 2. Nullavezető (N)
  if (
    node.sourcePotential === "N" ||
    node.id === "top_3n" ||
    node.id === "top_1n" ||
    node.id === "sock_n" ||
    node.id === "lamp1_n" ||
    node.id === "lamp2_n" ||
    node.id === "lamp3_n" ||
    node.id === "mk1_a2" ||
    node.id === "mk2_a2" ||
    node.id === "mk3_a2" ||
    node.id === "imp_a2" ||
    node.id === "stair_n" ||
    node.id === "timer_a2" ||
    node.id === "pir_n" ||
    node.id === "sw102_3" ||
    node.id === "sw102_4" ||
    node.label === "N" ||
    node.functionLabel.toLowerCase().startsWith("n táp") ||
    node.functionLabel.toLowerCase().startsWith("n nulla")
  ) {
    return "neutral";
  }

  // 3. Tiszta WAGO blokkok (nincs előre rögzített szerepkörük)
  // Megjegyzés: a motor fix WAGO-i "motor_u1..w2" és "motor_pe" nodeId-val rendelkeznek,
  // ezek a motor tekercs/PE kivezetéseihez tartoznak.
  if (
    !node.id.startsWith("motor_") &&
    (node.id.startsWith("wago") ||
      node.id.startsWith("w-") ||
      node.deviceName.toLowerCase().includes("wago"))
  ) {
    return undefined;
  }

  // 4. Minden egyéb rögzített készülék- és sorkapocspont fázisvezető / vezérlőág:
  // - 1P és 3P kismegszakítók kimenetei (L1, L2, L3)
  // - Kapcsolók (101, 102 1-2, 105, 106, 107) és nyomókapcsolók (101N)
  // - Ipari nyomógombok (NO, NC)
  // - Mágneskapcsolók főérintkezői és segédérintkezői (13, 14, 21, 22), tekercs A1
  // - Motorvédő főérintkezői és 95-96 segédérintkezője
  // - Relék (Impulzusrelé A1/1/2, Lépcsőházi aut. B/L/4, Időrelé A1/15/18/16)
  // - Dugasztó L, Izzók L, Mozgásérzékelő L és kapcsolt kimenet (L↓)
  // - 3F villanymotor tekercsvégek (U1, V1, W1, U2, V2, W2)
  return "phase";
}

/**
 * Barátságos, felhasználóbarát címke egy kapocspontról (hibajelentéshez).
 */
export function getPortFriendlyLabel(world: World, portId: string): string {
  const port = world.ports[portId];
  if (!port) return portId;
  const node = world.nodes[port.nodeId];

  if (port.kind === "wago") {
    const wago = world.wagos.find((w) => w.portIds.includes(portId));
    const slotIdx = wago ? wago.portIds.indexOf(portId) + 1 : 1;
    if (wago?.fixed) {
      return `Motor WAGO ${node?.label ?? ""} (${slotIdx}. nyílás)`;
    }
    return `WAGO ${wago?.slots ?? 3}-as (${slotIdx}. nyílás)`;
  }

  if (node) {
    return `${node.deviceName} [${node.label}]`;
  }
  return port.label || portId;
}

function roleNameHu(role: ExpectedWireRole): string {
  switch (role) {
    case "phase":
      return "Fázis / vezérlés";
    case "neutral":
      return "Nullavezető (N)";
    case "pe":
      return "Védővezető (PE)";
  }
}

function colorNameHu(colorId: WireColorId): string {
  const c = WIRE_COLORS[colorId];
  return c ? `${c.name} [${colorId}]` : colorId;
}

/**
 * Szabványossági kábelszín validáció végrehajtása.
 *
 * Működik bekapcsolt és kikapcsolt kismegszakítóknál is:
 * 1. Feltérképezi a huzalozási gráf összefüggő komponenseit (WAGO-kkal és készülékkapcsokkal).
 * 2. Csomópont-szerepkörök és feszültségpotenciálok alapján meghatározza a komponensek elvárt kategóriáját.
 * 3. Minden vezetékre ellenőrzi a 3 alapszabályt:
 *    - Fáziságban kizárólag Fekete ("L1") engedélyezett (nincs L1/L2/L3 megkülönböztetés).
 *    - Nullavezető ágban kizárólag Kék ("N") engedélyezett.
 *    - Védővezető ágban kizárólag Zöld-sárga ("PE") engedélyezett.
 * 4. Részletes, érthető magyar nyelvű indoklással és érintett kapcsokkal listázza a hibákat.
 */
export function checkWireColors(world: World, sim?: SimState): ColorCheckResult {
  const totalWires = world.wires.length;
  if (totalWires === 0) {
    return {
      totalWires: 0,
      correctWires: 0,
      valid: true,
      issues: [],
      summary: "Nincs bekötött vezeték a falon.",
    };
  }

  // 1. Kiinduló csomópont-szerepkörök feltérképezése (statikus + dinamikus)
  const initialRoles = new Map<string, ExpectedWireRole>();
  for (const node of Object.values(world.nodes)) {
    // Dinamikus potenciál prioritása (ha a szimuláció már él)
    if (sim?.potential[node.id]) {
      const pot = sim.potential[node.id];
      if (pot === "PE") {
        initialRoles.set(node.id, "pe");
        continue;
      }
      if (pot === "N") {
        initialRoles.set(node.id, "neutral");
        continue;
      }
      if (pot === "L1" || pot === "L2" || pot === "L3") {
        initialRoles.set(node.id, "phase");
        continue;
      }
    }

    // Statikus szerepkör kikapcsolt állapotban is
    const baseRole = getNodeBaseRole(node);
    if (baseRole) {
      initialRoles.set(node.id, baseRole);
    }
  }

  // 2. Huzalozási gráf összefüggő komponenseinek felépítése
  const nodeAdj = new Map<string, Set<string>>();
  const linkNodes = (a: string, b: string) => {
    if (!nodeAdj.has(a)) nodeAdj.set(a, new Set());
    if (!nodeAdj.has(b)) nodeAdj.set(b, new Set());
    nodeAdj.get(a)!.add(b);
    nodeAdj.get(b)!.add(a);
  };

  for (const wire of world.wires) {
    const pA = world.ports[wire.startPortId];
    const pB = world.ports[wire.endPortId];
    if (pA && pB) {
      linkNodes(pA.nodeId, pB.nodeId);
    }
  }

  // Összefüggő komponensek keresése (BFS)
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const nodeId of nodeAdj.keys()) {
    if (visited.has(nodeId)) continue;
    const comp: string[] = [];
    const queue = [nodeId];
    visited.add(nodeId);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      comp.push(curr);
      const neighbors = nodeAdj.get(curr) ?? new Set();
      for (const next of neighbors) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    components.push(comp);
  }

  // 3. Komponensenkénti szerepkör-kiértékelés
  const componentRoleMap = new Map<string, ExpectedWireRole>();
  const componentConflictMap = new Map<string, boolean>();

  for (const comp of components) {
    const rolesInComp = new Set<ExpectedWireRole>();
    for (const nId of comp) {
      const r = initialRoles.get(nId);
      if (r) rolesInComp.add(r);
    }

    const hasConflict = rolesInComp.size > 1;
    let resolvedRole: ExpectedWireRole | undefined;

    if (rolesInComp.size === 1) {
      resolvedRole = rolesInComp.values().next().value;
    } else if (rolesInComp.size === 0) {
      // Lebegő, ismeretlen komponens (pl. csak WAGO-k kapcsok nélkül)
      resolvedRole = "phase";
    }

    for (const nId of comp) {
      if (resolvedRole) componentRoleMap.set(nId, resolvedRole);
      if (hasConflict) componentConflictMap.set(nId, true);
    }
  }

  // 4. Minden vezeték ellenőrzése
  const issues: WireColorIssue[] = [];

  for (const wire of world.wires) {
    const pA = world.ports[wire.startPortId];
    const pB = world.ports[wire.endPortId];
    const nodeA = pA ? world.nodes[pA.nodeId] : undefined;
    const nodeB = pB ? world.nodes[pB.nodeId] : undefined;
    const fromLabel = getPortFriendlyLabel(world, wire.startPortId);
    const toLabel = getPortFriendlyLabel(world, wire.endPortId);

    const baseRoleA = nodeA ? initialRoles.get(nodeA.id) : undefined;
    const baseRoleB = nodeB ? initialRoles.get(nodeB.id) : undefined;

    let expectedRole: ExpectedWireRole;
    let isCrossConnection = false;

    if (baseRoleA && baseRoleB) {
      if (baseRoleA === baseRoleB) {
        expectedRole = baseRoleA;
      } else {
        // Közvetlen szabálytalan zárlati vagy keresztkötés két eltérő tartomány között!
        isCrossConnection = true;
        expectedRole = baseRoleA === "pe" || baseRoleB === "pe" ? "pe" : "neutral";
      }
    } else if (baseRoleA) {
      expectedRole = baseRoleA;
    } else if (baseRoleB) {
      expectedRole = baseRoleB;
    } else {
      const compRole =
        (nodeA ? componentRoleMap.get(nodeA.id) : undefined) ??
        (nodeB ? componentRoleMap.get(nodeB.id) : undefined) ??
        "phase";
      expectedRole = compRole;
    }

    const expectedColor = EXPECTED_ROLE_COLORS[expectedRole];
    const actualColor = wire.color;

    if (isCrossConnection) {
      const rA = baseRoleA ? roleNameHu(baseRoleA) : "ismeretlen";
      const rB = baseRoleB ? roleNameHu(baseRoleB) : "ismeretlen";
      issues.push({
        wireId: wire.id,
        wire,
        expectedRole,
        expectedColor,
        actualColor,
        reason: `Szabálytalan közvetlen összekötés ${rA} és ${rB} között (${fromLabel} ↔ ${toLabel})! Fázis, nulla és PE nem hidalható át közvetlenül.`,
        fromLabel,
        toLabel,
      });
      continue;
    }

    // Színhelyesség ellenőrzése a 3 szabványos alapszabály szerint
    if (actualColor !== expectedColor) {
      let reason: string;

      if (expectedRole === "phase") {
        if (actualColor === "N") {
          reason = `Fázisáramkörbe kötött vezeték: a Kék nullavezető szín használata fáziságban tiltott! Elvárt szabványos szín: Fekete [L1].`;
        } else if (actualColor === "PE") {
          reason = `Fázisáramkörbe kötött vezeték: a Zöld-sárga védővezető szín fáziságban szigorúan tilos és életveszélyes! Elvárt: Fekete [L1].`;
        } else {
          reason = `Fázisáramkörbe kötött vezeték: a fázis- és kapcsolt fáziságakban az elvárt szabványos szín Fekete [L1], jelenleg: ${colorNameHu(actualColor)}.`;
        }
      } else if (expectedRole === "neutral") {
        if (actualColor === "PE") {
          reason = `Nullavezető (N) ágba kötött vezeték: a Zöld-sárga védővezető szín használata nullán tiltott! Elvárt: Kék [N].`;
        } else if (actualColor === "L1") {
          reason = `Nullavezető (N) ágba kötött vezeték: Fekete szín használata nullán szabványtalan! Elvárt: Kék [N].`;
        } else {
          reason = `Nullavezető (N) ágba kötött vezeték: az elvárt szabványos szín Kék [N], jelenleg: ${colorNameHu(actualColor)}.`;
        }
      } else {
        // PE
        if (actualColor === "L1" || actualColor === "N") {
          reason = `Védővezető (PE) ágba kötött vezeték: kizárólag Zöld-sárga [PE] szín használható! Jelenleg: ${colorNameHu(actualColor)}.`;
        } else {
          reason = `Védővezető (PE) ágba kötött vezeték: az elvárt szabványos szín Zöld-sárga [PE], jelenleg: ${colorNameHu(actualColor)}.`;
        }
      }

      issues.push({
        wireId: wire.id,
        wire,
        expectedRole,
        expectedColor,
        actualColor,
        reason,
        fromLabel,
        toLabel,
      });
    }
  }

  const correctWires = totalWires - issues.length;
  const valid = issues.length === 0;

  let summary: string;
  if (valid) {
    summary = `Minden vezeték (${totalWires} db) szabványosan színhelyes!`;
  } else {
    summary = `${correctWires}/${totalWires} vezeték színhelyes (${issues.length} hibás kábelszín)`;
  }

  return {
    totalWires,
    correctWires,
    valid,
    issues,
    summary,
  };
}
