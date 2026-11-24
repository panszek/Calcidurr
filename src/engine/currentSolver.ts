import type { ClampReading, Potential, SimState, World } from "../models/types";
import { isWireEndSecure } from "../models/world";
import { areNodesConnected, buildConductiveGraph, isWireLive, sourceOf } from "./simulation";

export interface Complex {
  re: number;
  im: number;
}

const SQRT3 = Math.sqrt(3);
const PHASE_VOLTAGE = 230;

/**
 * 3-fázisú szimmetrikus tápfeszültség fázorok (effektív értékek, 50 Hz):
 * - L1: 230 V ∠ 0°
 * - L2: 230 V ∠ -120°
 * - L3: 230 V ∠ +120°
 * - N, PE: 0 V ∠ 0°
 */
export const POTENTIAL_PHASORS: Record<Exclude<Potential, "none">, Complex> = {
  L1: { re: PHASE_VOLTAGE, im: 0 },
  L2: { re: -PHASE_VOLTAGE * 0.5, im: (-PHASE_VOLTAGE * SQRT3) / 2 },
  L3: { re: -PHASE_VOLTAGE * 0.5, im: (PHASE_VOLTAGE * SQRT3) / 2 },
  N: { re: 0, im: 0 },
  PE: { re: 0, im: 0 },
};

/**
 * Fogyasztók névleges áramfelvételei (A AC):
 * - Izzó (100 W @ 230 V): ~0.43 A
 * - Mágneskapcsoló tekercs (@ 230 V): ~0.05 A
 * - Relék és PIR érzékelő (@ 230 V): ~0.02 A
 * - 3F villanymotor: Csillag ~1.80 A, Delta vonali ~5.40 A (tekercság ~3.12 A), Fázishiba ~8.50 A
 */
export const CONSUMER_NOMINAL_CURRENTS = {
  lamp: 0.43,
  contactorCoil: 0.05,
  relay: 0.02,
  motorStar: 1.8,
  motorDeltaLine: 5.4,
  motorDeltaWinding: 1.8 * SQRT3,
  motorPhaseFault: 8.5,
} as const;

/** Vezetékek és zárt érintkezők nagy vezetőképessége (R = 0.0001 Ω) */
const G_WIRE = 10_000;
const G_CONTACT = 10_000;
/** Numerikus regularizáció lebegő részgráfok szingularitásának elkerülésére (0.23 nA << 0.01 A) */
const G_LEAK = 1e-12;

interface AdmittanceBranch {
  a: string;
  b: string;
  g: number;
  wireId?: string;
}

function cZero(): Complex {
  return { re: 0, im: 0 };
}

function cSub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}

function cMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

function cDiv(a: Complex, b: Complex): Complex {
  const denom = b.re * b.re + b.im * b.im;
  if (denom === 0) return cZero();
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom,
  };
}

function cAbs(a: Complex): number {
  return Math.hypot(a.re, a.im);
}

function cAbs2(a: Complex): number {
  return a.re * a.re + a.im * a.im;
}

/**
 * Komplex Gauss-elimináció részleges főelemkiválasztással (A * x = b).
 */
function solveComplexLinearSystem(A: Complex[][], b: Complex[]): Complex[] {
  const n = b.length;
  if (n === 0) return [];

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxMag2 = cAbs2(A[col][col]);
    for (let row = col + 1; row < n; row++) {
      const mag2 = cAbs2(A[row][col]);
      if (mag2 > maxMag2) {
        maxMag2 = mag2;
        pivotRow = row;
      }
    }

    if (maxMag2 < 1e-30) {
      continue;
    }

    if (pivotRow !== col) {
      const tmpRow = A[col];
      A[col] = A[pivotRow];
      A[pivotRow] = tmpRow;

      const tmpB = b[col];
      b[col] = b[pivotRow];
      b[pivotRow] = tmpB;
    }

    const pivot = A[col][col];
    for (let row = col + 1; row < n; row++) {
      const entry = A[row][col];
      if (entry.re === 0 && entry.im === 0) continue;
      const factor = cDiv(entry, pivot);
      A[row][col] = cZero();

      for (let k = col + 1; k < n; k++) {
        const prod = cMul(factor, A[col][k]);
        A[row][k].re -= prod.re;
        A[row][k].im -= prod.im;
      }

      const bProd = cMul(factor, b[col]);
      b[row].re -= bProd.re;
      b[row].im -= bProd.im;
    }
  }

  const x: Complex[] = Array.from({ length: n }, () => cZero());
  for (let i = n - 1; i >= 0; i--) {
    let sumRe = b[i].re;
    let sumIm = b[i].im;
    for (let j = i + 1; j < n; j++) {
      const prod = cMul(A[i][j], x[j]);
      sumRe -= prod.re;
      sumIm -= prod.im;
    }
    x[i] = cDiv({ re: sumRe, im: sumIm }, A[i][i]);
  }

  return x;
}

/**
 * Meghatározza a 3F villanymotor egy tekercsének vezetőképességét (S) az aktuális üzemmódban.
 */
function computeMotorWindingConductance(world: World, sim: SimState): number {
  const mode = sim.motor?.mode ?? "off";
  if (mode === "off") return 0;

  if (mode === "star" || mode === "delta") {
    return CONSUMER_NOMINAL_CURRENTS.motorStar / PHASE_VOLTAGE;
  }

  // mode === "phase_fault" (2 fázisú táplálás, álló forgórész ~8.50 A vonali árammal)
  const motor = world.devices.find((d) => d.type === "motor_3p");
  if (!motor || motor.nodeIds.length < 7) return 0;

  const [u1Id, v1Id, w1Id, u2Id, v2Id, w2Id] = motor.nodeIds;
  const adj = buildConductiveGraph(world, sim.contactorOn);

  const isStarPoint =
    areNodesConnected(adj, u2Id, v2Id) && areNodesConnected(adj, u2Id, w2Id);
  const isReverseStarPoint =
    areNodesConnected(adj, u1Id, v1Id) && areNodesConnected(adj, u1Id, w1Id);

  const lineVoltage = PHASE_VOLTAGE * SQRT3;

  if (isStarPoint || isReverseStarPoint) {
    // Csillag fázishiba: két tekercs sorban a két élő fázis (400 V) között -> G_eq = G_w / 2
    return (CONSUMER_NOMINAL_CURRENTS.motorPhaseFault * 2) / lineVoltage;
  }

  // Delta fázishiba: megvizsgáljuk a tekercsek effektív áthidalási tényezőjét a két élő fázis között
  const coils: ReadonlyArray<[string, string]> = [
    [u1Id, u2Id],
    [v1Id, v2Id],
    [w1Id, w2Id],
  ];
  const isLive = (pot: Potential) => pot === "L1" || pot === "L2" || pot === "L3";

  let directCount = 0;
  const singleEndedCoils: Array<{ livePot: Potential; freeNode: string }> = [];

  for (const [aId, bId] of coils) {
    const pA = sim.potential[aId] ?? "none";
    const pB = sim.potential[bId] ?? "none";
    if (isLive(pA) && isLive(pB) && pA !== pB) {
      directCount += 1;
    } else if (isLive(pA) && pB === "none") {
      singleEndedCoils.push({ livePot: pA, freeNode: bId });
    } else if (isLive(pB) && pA === "none") {
      singleEndedCoils.push({ livePot: pB, freeNode: aId });
    }
  }

  let seriesFactor = 0;
  if (
    singleEndedCoils.length === 2 &&
    singleEndedCoils[0].livePot !== singleEndedCoils[1].livePot &&
    areNodesConnected(adj, singleEndedCoils[0].freeNode, singleEndedCoils[1].freeNode)
  ) {
    seriesFactor = 0.5;
  }

  const totalFactor = Math.max(0.5, directCount + seriesFactor);
  return CONSUMER_NOMINAL_CURRENTS.motorPhaseFault / (totalFactor * lineVoltage);
}

/**
 * Kirchhoff csomóponti fázor-megoldó (Nodal Admittance Analysis):
 * kiszámítja minden bekötött vezeték valós váltakozó áramát (Amper, effektív érték).
 */
export function solveWireCurrents(world: World, sim: SimState): Record<string, number> {
  const wireCurrents: Record<string, number> = {};
  for (const wire of world.wires) {
    wireCurrents[wire.id] = 0;
  }

  if (world.wires.length === 0) {
    return wireCurrents;
  }

  // 1. Aktív feszültségforrások (Dirichlet peremfeltételek) összegyűjtése
  const dirichlet = new Map<string, Complex>();
  let hasLiveSource = false;

  for (const node of Object.values(world.nodes)) {
    const src = sourceOf(world, node.id);
    if (src.pot !== "none") {
      dirichlet.set(node.id, POTENTIAL_PHASORS[src.pot]);
      if (src.pot === "L1" || src.pot === "L2" || src.pot === "L3") {
        hasLiveSource = true;
      }
    }
  }

  if (!hasLiveSource) {
    return wireCurrents;
  }

  // Biztonsági ellenőrzés arra az esetre, ha egy tesztpályán megszakító nélküli aktív zárlat maradt volna
  if (sim.shortCircuit) {
    const condAdj = buildConductiveGraph(world, sim.contactorOn);
    const activeEntries = [...dirichlet.entries()];
    for (let i = 0; i < activeEntries.length; i++) {
      for (let j = i + 1; j < activeEntries.length; j++) {
        const [idA, vA] = activeEntries[i];
        const [idB, vB] = activeEntries[j];
        if ((vA.re !== vB.re || vA.im !== vB.im) && areNodesConnected(condAdj, idA, idB)) {
          return wireCurrents;
        }
      }
    }
  }

  // 2. Hálózati ágak felépítése: meghúzott vezetékek, zárt érintkezők és fogyasztói admittanciák
  const branches: AdmittanceBranch[] = [];
  const addBranch = (a?: string, b?: string, g = 0, wireId?: string) => {
    if (!a || !b || a === b || g <= 0) return;
    if (!world.nodes[a] || !world.nodes[b]) return;
    branches.push({ a, b, g, wireId });
  };

  // a) Meghúzott felhasználói vezetékek
  for (const wire of world.wires) {
    if (!isWireEndSecure(world, wire.startPortId) || !isWireEndSecure(world, wire.endPortId)) {
      continue;
    }
    const pA = world.ports[wire.startPortId];
    const pB = world.ports[wire.endPortId];
    if (pA && pB && pA.nodeId !== pB.nodeId) {
      addBranch(pA.nodeId, pB.nodeId, G_WIRE, wire.id);
    }
  }

  const gLamp = CONSUMER_NOMINAL_CURRENTS.lamp / PHASE_VOLTAGE;
  const gCoil = CONSUMER_NOMINAL_CURRENTS.contactorCoil / PHASE_VOLTAGE;
  const gRelay = CONSUMER_NOMINAL_CURRENTS.relay / PHASE_VOLTAGE;
  const gMotorWinding = computeMotorWindingConductance(world, sim);

  // b) Készülékek belső érintkezői és fogyasztói terhelései
  for (const device of world.devices) {
    if (device.type === "mcb" || device.type === "mcb3p" || device.type === "mcb1p") {
      continue;
    }

    if ((device.type === "switch" || device.type === "switch_101") && device.on && device.nodeIds.length >= 2) {
      addBranch(device.nodeIds[0], device.nodeIds[1], G_CONTACT);
    }

    if (device.type === "switch_102" && device.on && device.nodeIds.length >= 4) {
      addBranch(device.nodeIds[0], device.nodeIds[1], G_CONTACT);
      addBranch(device.nodeIds[2], device.nodeIds[3], G_CONTACT);
    }

    if (device.type === "switch_105" && device.nodeIds.length >= 3) {
      if (device.on) addBranch(device.nodeIds[0], device.nodeIds[1], G_CONTACT);
      if (device.on2) addBranch(device.nodeIds[0], device.nodeIds[2], G_CONTACT);
    }

    if (device.type === "switch_106" && device.nodeIds.length >= 3) {
      if (device.on) addBranch(device.nodeIds[0], device.nodeIds[1], G_CONTACT);
      else addBranch(device.nodeIds[0], device.nodeIds[2], G_CONTACT);
    }

    if (device.type === "switch_107" && device.nodeIds.length >= 4) {
      if (device.on) {
        addBranch(device.nodeIds[0], device.nodeIds[3], G_CONTACT);
        addBranch(device.nodeIds[1], device.nodeIds[2], G_CONTACT);
      } else {
        addBranch(device.nodeIds[0], device.nodeIds[2], G_CONTACT);
        addBranch(device.nodeIds[1], device.nodeIds[3], G_CONTACT);
      }
    }

    if ((device.type === "button" || device.type === "button_no") && device.pressed && device.nodeIds.length >= 2) {
      addBranch(device.nodeIds[0], device.nodeIds[1], G_CONTACT);
    }

    if (device.type === "button_nc" && !device.pressed && device.nodeIds.length >= 2) {
      addBranch(device.nodeIds[0], device.nodeIds[1], G_CONTACT);
    }

    if (device.type === "push_switch_101n" && device.pressed && device.nodeIds.length >= 2) {
      addBranch(device.nodeIds[0], device.nodeIds[1], G_CONTACT);
    }

    if (device.type === "motor_protector" && device.on && device.nodeIds.length >= 8) {
      addBranch(device.nodeIds[0], device.nodeIds[3], G_CONTACT);
      addBranch(device.nodeIds[1], device.nodeIds[4], G_CONTACT);
      addBranch(device.nodeIds[2], device.nodeIds[5], G_CONTACT);
      addBranch(device.nodeIds[6], device.nodeIds[7], G_CONTACT);
    }

    if (device.type === "contactor" && device.nodeIds.length >= 6) {
      const isEnergized = sim.contactorOn.has(device.id);
      if (isEnergized) {
        addBranch(device.nodeIds[0], device.nodeIds[1], G_CONTACT);
        if (device.nodeIds.length >= 12) {
          addBranch(device.nodeIds[6], device.nodeIds[9], G_CONTACT);
          addBranch(device.nodeIds[7], device.nodeIds[10], G_CONTACT);
          addBranch(device.nodeIds[8], device.nodeIds[11], G_CONTACT);
        }
      } else {
        addBranch(device.nodeIds[2], device.nodeIds[3], G_CONTACT);
      }
      // Mágneskapcsoló tekercs (A1–A2): ~0.05 A
      addBranch(device.nodeIds[4], device.nodeIds[5], gCoil);
    }

    if (device.type === "impulse_relay" && device.nodeIds.length >= 4) {
      if (device.relayState) {
        addBranch(device.nodeIds[2], device.nodeIds[3], G_CONTACT);
      }
      // Impulzusrelé tekercs (A1–A2): ~0.02 A
      addBranch(device.nodeIds[0], device.nodeIds[1], gRelay);
    }

    if (device.type === "staircase_relay" && device.nodeIds.length >= 4) {
      if ((device.timerRemaining ?? 0) > 0) {
        addBranch(device.nodeIds[2], device.nodeIds[3], G_CONTACT);
      }
      // Lépcsőházi automata táp (L–N): ~0.02 A
      addBranch(device.nodeIds[2], device.nodeIds[0], gRelay);
    }

    if (device.type === "timer_relay" && device.nodeIds.length >= 5) {
      if (device.relayState) {
        addBranch(device.nodeIds[1], device.nodeIds[2], G_CONTACT);
      } else {
        addBranch(device.nodeIds[1], device.nodeIds[3], G_CONTACT);
      }
      // Időrelé tekercs (A1–A2): ~0.02 A
      addBranch(device.nodeIds[0], device.nodeIds[4], gRelay);
    }

    if (device.type === "motion_sensor" && device.nodeIds.length >= 3) {
      if ((device.timerRemaining ?? 0) > 0) {
        addBranch(device.nodeIds[0], device.nodeIds[2], G_CONTACT);
      }
      // PIR érzékelő elektronika (L↑–N↑): ~0.02 A
      addBranch(device.nodeIds[0], device.nodeIds[1], gRelay);
    }

    if (device.type === "lamp" && device.nodeIds.length >= 2) {
      // Izzó (L–N): ~0.43 A
      addBranch(device.nodeIds[0], device.nodeIds[1], gLamp);
    }

    if (device.type === "motor_3p" && device.nodeIds.length >= 7 && gMotorWinding > 0) {
      const [u1Id, v1Id, w1Id, u2Id, v2Id, w2Id] = device.nodeIds;
      addBranch(u1Id, u2Id, gMotorWinding);
      addBranch(v1Id, v2Id, gMotorWinding);
      addBranch(w1Id, w2Id, gMotorWinding);
    }
  }

  // 3. Csomóponti admittanciamátrix összeállítása az aktív hálózatban részt vevő ismeretlen csomópontokra
  const activeNodes = new Set<string>();
  for (const br of branches) {
    activeNodes.add(br.a);
    activeNodes.add(br.b);
  }

  const unknownNodes: string[] = [];
  const unknownIdx = new Map<string, number>();
  for (const nodeId of activeNodes) {
    if (!dirichlet.has(nodeId)) {
      unknownIdx.set(nodeId, unknownNodes.length);
      unknownNodes.push(nodeId);
    }
  }

  const n = unknownNodes.length;
  const nodeVoltages = new Map<string, Complex>(dirichlet);

  if (n > 0) {
    const Y: Complex[][] = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => ({ re: i === j ? G_LEAK : 0, im: 0 })),
    );
    const rhs: Complex[] = Array.from({ length: n }, () => cZero());

    for (const br of branches) {
      const idxA = unknownIdx.get(br.a);
      const idxB = unknownIdx.get(br.b);
      const vA = dirichlet.get(br.a);
      const vB = dirichlet.get(br.b);

      if (idxA !== undefined && idxB !== undefined) {
        Y[idxA][idxA].re += br.g;
        Y[idxB][idxB].re += br.g;
        Y[idxA][idxB].re -= br.g;
        Y[idxB][idxA].re -= br.g;
      } else if (idxA !== undefined && vB !== undefined) {
        Y[idxA][idxA].re += br.g;
        rhs[idxA].re += br.g * vB.re;
        rhs[idxA].im += br.g * vB.im;
      } else if (idxB !== undefined && vA !== undefined) {
        Y[idxB][idxB].re += br.g;
        rhs[idxB].re += br.g * vA.re;
        rhs[idxB].im += br.g * vA.im;
      }
    }

    const solved = solveComplexLinearSystem(Y, rhs);
    for (let i = 0; i < n; i++) {
      nodeVoltages.set(unknownNodes[i], solved[i]);
    }
  }

  // 4. Egyedi ágáramok kiszámítása minden vezetékre: I = G_WIRE * |V_a - V_b|
  for (const br of branches) {
    if (!br.wireId) continue;
    const vA = nodeVoltages.get(br.a) ?? cZero();
    const vB = nodeVoltages.get(br.b) ?? cZero();
    const rawAmps = br.g * cAbs(cSub(vA, vB));
    const rounded = rawAmps < 5e-4 ? 0 : Math.round(rawAmps * 100) / 100;
    wireCurrents[br.wireId] = rounded === 0 ? 0 : rounded;
  }

  return wireCurrents;
}

/**
 * Lakatfogó (UNI-T UT202A+ / AC Clamp Meter) mérési állapotának kiértékelése
 * a kiválasztott vagy rögzített vezetékre, opcionális DATA HOLD értékkel.
 */
export function measureClampCurrent(
  world: World,
  sim: SimState,
  wireId?: string,
  holdValue?: number | null,
): ClampReading {
  const validWire = wireId ? world.wires.find((w) => w.id === wireId) : undefined;
  const hasWire = !!validWire;
  const liveCurrent = validWire ? (sim.wireCurrents[validWire.id] ?? 0) : 0;
  const isHold = holdValue !== undefined && holdValue !== null;
  const displayCurrent = isHold ? holdValue : liveCurrent;
  const isLiveWire = validWire ? isWireLive(sim, world, validWire.id) : false;
  const overloadWarn = displayCurrent >= 6.0;

  const lcdPrimary = `${displayCurrent.toFixed(2)} A`;

  let lcdSecondary: string;
  if (isHold) {
    lcdSecondary = "HOLD • ADAT RÖGZÍTVE (AC 50 Hz)";
  } else if (!hasWire) {
    lcdSecondary = "NYITOTT POFA — HÚZD VEZETÉKRE";
  } else if (overloadWarn) {
    lcdSecondary = "⚠️ TÚLÁRAM / FÁZISHIBA! (50.0 Hz)";
  } else if (displayCurrent > 0) {
    lcdSecondary = "AC • 50.0 Hz • ÁRAMFOLYÁS";
  } else {
    lcdSecondary = "AC • 50.0 Hz • NINCS ÁRAMFOLYÁS";
  }

  return {
    hasWire,
    liveCurrent,
    displayCurrent,
    hold: isHold,
    isLiveWire,
    overloadWarn,
    lcdPrimary,
    lcdSecondary,
  };
}
