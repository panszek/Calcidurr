import type {
  PhaseRotation,
  Potential,
  SimState,
  TesterReading,
  VoltageLedStep,
  World,
} from "../models/types";
import { areNodesConnected, buildConductiveGraph } from "./simulation";

const PHASES: ReadonlyArray<Potential> = ["L1", "L2", "L3"];
const VOLTAGE_LED_STEPS: ReadonlyArray<VoltageLedStep> = [12, 24, 50, 120, 230, 400];

export function isLivePhase(pot: Potential): boolean {
  return PHASES.includes(pot);
}

/**
 * Meghatározza a két potenciál közötti effektív váltakozó feszültséget (V AC):
 * - Fázis (L1/L2/L3) ↔ N vagy PE -> 230 V
 * - Két különböző fázis (L1–L2, L2–L3, L3–L1) -> 400 V
 * - Azonos potenciál vagy lebegő (feszültségmentes) pontok -> 0 V
 */
export function measureVoltageBetweenPotentials(potA: Potential, potB: Potential): number {
  if (potA === "none" || potB === "none" || potA === potB) {
    return 0;
  }

  const aPhase = isLivePhase(potA);
  const bPhase = isLivePhase(potB);

  if (aPhase && bPhase && potA !== potB) {
    return 400;
  }

  if (
    (aPhase && (potB === "N" || potB === "PE")) ||
    (bPhase && (potA === "N" || potA === "PE"))
  ) {
    return 230;
  }

  return 0;
}

/**
 * Meghatározza a fázissorrendet 400 V-os kétpólusú mérésnél:
 * Fekete (COM / L1 tüske) -> Piros (+ / L2 tüske)
 * - L1 -> L2, L2 -> L3, L3 -> L1 => "R" (jobb / óramutató járásával egyező)
 * - L2 -> L1, L3 -> L2, L1 -> L3 => "L" (bal / fordított)
 */
export function measurePhaseRotation(blackPot: Potential, redPot: Potential): PhaseRotation {
  if (!isLivePhase(blackPot) || !isLivePhase(redPot) || blackPot === redPot) {
    return "none";
  }

  const isRight =
    (blackPot === "L1" && redPot === "L2") ||
    (blackPot === "L2" && redPot === "L3") ||
    (blackPot === "L3" && redPot === "L1");

  return isRight ? "R" : "L";
}

/**
 * Visszaadja az adott feszültségszintnél világító UNI-T LED sáv fokozatokat.
 */
export function computeLedSteps(voltage: number): VoltageLedStep[] {
  if (voltage < 12) return [];
  return VOLTAGE_LED_STEPS.filter((step) => voltage >= step);
}

/**
 * Folytonosságvizsgálat (BFS) két csomópont között meghúzott vezetékeken
 * és zárt készülékérintkezőkön át (kikapcsolt kismegszakítóknál is működik!).
 */
export function checkContinuityPath(
  world: World,
  sim: SimState,
  nodeAId: string,
  nodeBId: string,
): boolean {
  if (!world.nodes[nodeAId] || !world.nodes[nodeBId]) {
    return false;
  }
  if (nodeAId === nodeBId) {
    return true;
  }
  const adj = buildConductiveGraph(world, sim.contactorOn);
  return areNodesConnected(adj, nodeAId, nodeBId);
}

/**
 * Teljes kétpólusú UNI-T (UT18C / UT18D) mérés kiértékelése
 * a fekete (COM / -) és piros (+) mérőtüske csomópontjai alapján.
 */
export function measureUniT(
  world: World,
  sim: SimState,
  blackNodeId?: string,
  redNodeId?: string,
): TesterReading {
  const validBlack = blackNodeId && world.nodes[blackNodeId] ? blackNodeId : undefined;
  const validRed = redNodeId && world.nodes[redNodeId] ? redNodeId : undefined;

  const blackPot: Potential = validBlack ? (sim.potential[validBlack] ?? "none") : "none";
  const redPot: Potential = validRed ? (sim.potential[validRed] ?? "none") : "none";
  const singlePolePhase = isLivePhase(blackPot) || isLivePhase(redPot);

  // 0. Nincs egyetlen lerakott mérőtüske sem
  if (!validBlack && !validRed) {
    return {
      active: false,
      hasAnyProbe: false,
      voltage: 0,
      isAcVoltage: false,
      ledSteps: [],
      singlePolePhase: false,
      phaseRotation: "none",
      continuityActive: false,
      continuity: false,
      resistanceText: null,
      lcdPrimary: "---",
      lcdSecondary: "KÉSZENLÉT",
      blackPotential: "none",
      redPotential: "none",
    };
  }

  // 1. Csak az egyik mérőtüske van mérési ponton (egypólusú állapot)
  if (!validBlack || !validRed) {
    return {
      active: false,
      hasAnyProbe: true,
      voltage: 0,
      isAcVoltage: false,
      ledSteps: [],
      singlePolePhase,
      phaseRotation: "none",
      continuityActive: false,
      continuity: false,
      resistanceText: null,
      lcdPrimary: singlePolePhase ? "⚡ POL" : "---",
      lcdSecondary: singlePolePhase
        ? "EGYPÓLUSÚ FÁZISJELZÉS"
        : "ÉRINTSD A (+) TÜSKÉT MÉRÉSI PONTHOZ",
      blackPotential: blackPot,
      redPotential: redPot,
    };
  }

  // 2. Kétpólusú mérés (mindkét tüske mérési ponton van)
  const voltage = measureVoltageBetweenPotentials(blackPot, redPot);
  const ledSteps = computeLedSteps(voltage);
  const phaseRotation = voltage === 400 ? measurePhaseRotation(blackPot, redPot) : "none";

  // Feszültségmérés elsőbbsége (>12 V AC jelenlétekor automatikusan feszültséget mér, nem csipog!)
  if (voltage > 12) {
    const rotSuffix =
      phaseRotation === "R"
        ? " • FORGÁSIRÁNY: R ↻"
        : phaseRotation === "L"
          ? " • FORGÁSIRÁNY: L ↺"
          : "";
    return {
      active: true,
      hasAnyProbe: true,
      voltage,
      isAcVoltage: true,
      ledSteps,
      singlePolePhase,
      phaseRotation,
      continuityActive: false,
      continuity: false,
      resistanceText: null,
      lcdPrimary: `${voltage} V`,
      lcdSecondary: `AC • 50.0 Hz${rotSuffix}`,
      blackPotential: blackPot,
      redPotential: redPot,
    };
  }

  // Ha valamelyik tüske élő fázison van, de a potenciálkülönbség 0 V (pl. azonos fázis L1–L1 vagy fázis–lebegő pont):
  // A kör NEM feszültségmentes -> 0 V-ot mutat, ⚡ LED világít, és NEM csipog folytonosságot!
  if (singlePolePhase) {
    return {
      active: true,
      hasAnyProbe: true,
      voltage: 0,
      isAcVoltage: false,
      ledSteps: [],
      singlePolePhase: true,
      phaseRotation: "none",
      continuityActive: false,
      continuity: false,
      resistanceText: null,
      lcdPrimary: "0 V",
      lcdSecondary: "⚡ ÉLŐ FÁZIS JELEN (NEM FESZÜLTSÉGMENTES)",
      blackPotential: blackPot,
      redPotential: redPot,
    };
  }

  // 3. Feszültségmentes állapot: Folytonosságvizsgálat (0.0 Ω + sípolás vagy OL)
  const continuity = checkContinuityPath(world, sim, validBlack, validRed);
  const resistanceText = continuity ? "0.0 Ω" : "OL";

  return {
    active: true,
    hasAnyProbe: true,
    voltage: 0,
    isAcVoltage: false,
    ledSteps: [],
    singlePolePhase: false,
    phaseRotation: "none",
    continuityActive: true,
    continuity,
    resistanceText,
    lcdPrimary: resistanceText,
    lcdSecondary: continuity ? "0 V • FOLYTONOS (Rx < 40 Ω)" : "0 V • SZAKADÁS (NYITOTT KÖR)",
    blackPotential: blackPot,
    redPotential: redPot,
  };
}
