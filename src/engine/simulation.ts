import type { MotorState, Potential, SimState, World } from "../models/types";
import { isWireEndSecure, tripMcb, tripRcd } from "../models/world";

const LIVE: Potential[] = ["L1", "L2", "L3"];

function emptySim(): SimState {
  return {
    potential: {},
    liveNodeIds: new Set(),
    shortCircuit: false,
    shortDetail: "",
    rcdTripped: false,
    rcdDetail: "",
    lampOn: new Set(),
    contactorOn: new Set(),
    activeDevices: new Set(),
    looseCount: 0,
    warnings: [],
  };
}

function coilEnergized(potential: Record<string, Potential>, a1Id: string, a2Id: string): boolean {
  const p1 = potential[a1Id] ?? "none";
  const p2 = potential[a2Id] ?? "none";
  const hasPhase = LIVE.includes(p1) || LIVE.includes(p2);
  const hasN = p1 === "N" || p2 === "N";
  return hasPhase && hasN;
}

function neighborsOf(world: World, energizedContactors: Set<string>): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  const link = (a?: string, b?: string) => {
    if (!a || !b || a === b) return;
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push(b);
    adj.get(b)!.push(a);
  };

  for (const node of Object.values(world.nodes)) {
    if (!adj.has(node.id)) adj.set(node.id, []);
  }

  // Wires
  for (const wire of world.wires) {
    if (!isWireEndSecure(world, wire.startPortId) || !isWireEndSecure(world, wire.endPortId)) {
      continue;
    }
    const a = world.ports[wire.startPortId];
    const b = world.ports[wire.endPortId];
    if (a && b) link(a.nodeId, b.nodeId);
  }

  // Devices internal connections
  for (const device of world.devices) {
    // Breakers provide potentials at their output terminals, handled by sourceOf
    if (device.type === "mcb" || device.type === "mcb3p" || device.type === "mcb1p") {
      continue;
    }

    if ((device.type === "switch" || device.type === "switch_101") && device.on && device.nodeIds.length >= 2) {
      link(device.nodeIds[0], device.nodeIds[1]);
    }

    if (device.type === "switch_102" && device.on && device.nodeIds.length >= 4) {
      link(device.nodeIds[0], device.nodeIds[1]);
      link(device.nodeIds[2], device.nodeIds[3]);
    }

    if (device.type === "switch_105" && device.nodeIds.length >= 3) {
      // 0 is common, 1 is rocker 1, 2 is rocker 2
      if (device.on) link(device.nodeIds[0], device.nodeIds[1]);
      if (device.on2) link(device.nodeIds[0], device.nodeIds[2]);
    }

    if (device.type === "switch_106" && device.nodeIds.length >= 3) {
      // 0 is common: switch between 1 and 2
      if (device.on) link(device.nodeIds[0], device.nodeIds[1]);
      else link(device.nodeIds[0], device.nodeIds[2]);
    }

    if (device.type === "switch_107" && device.nodeIds.length >= 4) {
      // 107 Intermediate (keresztváltó): straight (1-3 & 2-4) or cross (1-4 & 2-3)
      if (device.on) {
        link(device.nodeIds[0], device.nodeIds[3]);
        link(device.nodeIds[1], device.nodeIds[2]);
      } else {
        link(device.nodeIds[0], device.nodeIds[2]);
        link(device.nodeIds[1], device.nodeIds[3]);
      }
    }

    if ((device.type === "button" || device.type === "button_no") && device.pressed && device.nodeIds.length >= 2) {
      link(device.nodeIds[0], device.nodeIds[1]);
    }

    if (device.type === "button_nc" && !device.pressed && device.nodeIds.length >= 2) {
      link(device.nodeIds[0], device.nodeIds[1]);
    }

    if (device.type === "push_switch_101n" && device.pressed && device.nodeIds.length >= 2) {
      link(device.nodeIds[0], device.nodeIds[1]);
    }

    if (device.type === "motor_protector" && device.on && device.nodeIds.length >= 8) {
      // [L1, L2, L3, T1, T2, T3, 95, 96]
      link(device.nodeIds[0], device.nodeIds[3]);
      link(device.nodeIds[1], device.nodeIds[4]);
      link(device.nodeIds[2], device.nodeIds[5]);
      link(device.nodeIds[6], device.nodeIds[7]);
    }

    if (device.type === "contactor" && device.nodeIds.length >= 6) {
      // [13, 14, 21, 22, A1, A2, (L1, L2, L3, T1, T2, T3)]
      const isEnergized = energizedContactors.has(device.id);
      if (isEnergized) {
        // Aux NO 13-14 closed
        link(device.nodeIds[0], device.nodeIds[1]);
        // Main contacts L1-T1, L2-T2, L3-T3 closed (indices 6-9, 7-10, 8-11)
        if (device.nodeIds.length >= 12) {
          link(device.nodeIds[6], device.nodeIds[9]);
          link(device.nodeIds[7], device.nodeIds[10]);
          link(device.nodeIds[8], device.nodeIds[11]);
        }
      } else {
        // Aux NC 21-22 closed
        link(device.nodeIds[2], device.nodeIds[3]);
      }
    }

    if (device.type === "impulse_relay" && device.relayState && device.nodeIds.length >= 4) {
      // [A1, A2, 1, 2] -> 1-2 closed
      link(device.nodeIds[2], device.nodeIds[3]);
    }

    if (device.type === "staircase_relay" && (device.timerRemaining ?? 0) > 0 && device.nodeIds.length >= 4) {
      // [N, B, L, 4] -> L-4 closed
      link(device.nodeIds[2], device.nodeIds[3]);
    }

    if (device.type === "timer_relay" && device.nodeIds.length >= 5) {
      // [A1, 15, 18, 16, A2]
      if (device.relayState) {
        // 15-18 closed (NO)
        link(device.nodeIds[1], device.nodeIds[2]);
      } else {
        // 15-16 closed (NC)
        link(device.nodeIds[1], device.nodeIds[3]);
      }
    }

    if (device.type === "motion_sensor" && (device.timerRemaining ?? 0) > 0 && device.nodeIds.length >= 3) {
      // [L, N, out] -> L-out closed
      link(device.nodeIds[0], device.nodeIds[2]);
    }
  }

  return adj;
}

function sourceOf(world: World, nodeId: string): { pot: Potential; breakerId?: string; rcdId?: string } {
  const node = world.nodes[nodeId];
  if (!node?.sourcePotential) return { pot: "none" };

  // 1. Upstream ÁVK (RCD) tápfüggőség
  if (node.rcdId) {
    const rcd = world.devices.find((d) => d.id === node.rcdId);
    if (!rcd?.on) return { pot: "none" };
  }

  // 2. Kismegszakító (MCB) tápfüggőség
  if (node.breakerId) {
    const breaker = world.devices.find((d) => d.id === node.breakerId);
    if (!breaker?.on) return { pot: "none" };
  } else if (node.sourcePotential === "L1") {
    const mcb = world.devices.find((d) => d.id === world.mcbId);
    if (mcb && !mcb.on) return { pot: "none" };
  }

  return { pot: node.sourcePotential, breakerId: node.breakerId, rcdId: node.rcdId };
}

interface PropagateResult {
  potential: Record<string, Potential>;
  shortCircuit: boolean;
  shortDetail: string;
  faultyBreakerIds: Set<string>;
  faultyRcdIds: Set<string>;
  rcdTripped: boolean;
  rcdDetail: string;
  nodeRcd: Record<string, string>;
  nodeBreaker: Record<string, string>;
}

function propagate(
  world: World,
  adj: Map<string, string[]>,
): PropagateResult {
  const potential: Record<string, Potential> = {};
  for (const id of Object.keys(world.nodes)) potential[id] = "none";

  const nodeRcd: Record<string, string> = {};
  const nodeBreaker: Record<string, string> = {};
  const visited = new Set<string>();

  let shortCircuit = false;
  let shortDetail = "";
  let rcdTripped = false;
  let rcdDetail = "";
  const faultyBreakerIds = new Set<string>();
  const faultyRcdIds = new Set<string>();

  const seeds: Array<{
    id: string;
    pot: Exclude<Potential, "none">;
    breakerId?: string;
    rcdId?: string;
  }> = [];

  for (const node of Object.values(world.nodes)) {
    const src = sourceOf(world, node.id);
    if (src.pot !== "none") {
      seeds.push({
        id: node.id,
        pot: src.pot,
        breakerId: src.breakerId,
        rcdId: src.rcdId,
      });
    }
  }

  for (const seed of seeds) {
    // 1. Collision check at the seed itself if already reached by another seed
    if (visited.has(seed.id) && potential[seed.id] !== "none") {
      const existing = potential[seed.id];
      const existingRcd = nodeRcd[seed.id];
      const existingBreaker = nodeBreaker[seed.id];

      if (existing !== seed.pot) {
        const isLiveFault =
          (LIVE.includes(existing) && (seed.pot === "N" || seed.pot === "PE")) ||
          (LIVE.includes(seed.pot) && (existing === "N" || existing === "PE")) ||
          (LIVE.includes(existing) && LIVE.includes(seed.pot));

        if (isLiveFault) {
          shortCircuit = true;
          shortDetail =
            existing === "PE" || seed.pot === "PE"
              ? "Fázis–Védővezető (L–PE) testzárlat"
              : `${existing} és ${seed.pot} zárlat`;
          if (seed.breakerId) faultyBreakerIds.add(seed.breakerId);
          if (existingBreaker) faultyBreakerIds.add(existingBreaker);

          if (existing === "PE" || seed.pot === "PE") {
            rcdTripped = true;
            rcdDetail = "ÁVK hibaáram-leoldás: Fázis–Védővezető (L–PE) testzárlat.";
            if (seed.rcdId) faultyRcdIds.add(seed.rcdId);
            if (existingRcd) faultyRcdIds.add(existingRcd);
          } else if (seed.rcdId && existingRcd && seed.rcdId !== existingRcd) {
            rcdTripped = true;
            rcdDetail = "ÁVK hibaáram-leoldás: Kereszt-fázis/nulla zárlat eltérő ÁVK-k között.";
            faultyRcdIds.add(seed.rcdId);
            faultyRcdIds.add(existingRcd);
          }
          break;
        } else if ((existing === "N" && seed.pot === "PE") || (existing === "PE" && seed.pot === "N")) {
          const activeRcd = existingRcd ?? seed.rcdId;
          if (activeRcd) {
            rcdTripped = true;
            rcdDetail = "ÁVK hibaáram-leoldás: Nullavezető (N) és Védővezető (PE) zárlat/összekötés. ÁVK leoldott.";
            faultyRcdIds.add(activeRcd);
            break;
          }
        }
      } else if (existing === "N" && seed.pot === "N") {
        if (existingRcd && seed.rcdId && existingRcd !== seed.rcdId) {
          rcdTripped = true;
          rcdDetail = "ÁVK hibaáram-leoldás: A 3 fázisú és 1 fázisú hálózat nullavezetője (3F N és 1F N) össze van kötve. Mindkét ÁVK leoldott.";
          faultyRcdIds.add(existingRcd);
          faultyRcdIds.add(seed.rcdId);
          break;
        }
      }
    }

    const queue = [seed.id];
    const seen = new Set<string>();

    while (queue.length) {
      const cur = queue.shift()!;
      if (seen.has(cur)) continue;
      seen.add(cur);
      visited.add(cur);

      const existing = potential[cur];
      const existingRcd = nodeRcd[cur];
      const existingBreaker = nodeBreaker[cur];

      if (existing !== "none") {
        if (existing !== seed.pot) {
          const isLiveFault =
            (LIVE.includes(existing) && (seed.pot === "N" || seed.pot === "PE")) ||
            (LIVE.includes(seed.pot) && (existing === "N" || existing === "PE")) ||
            (LIVE.includes(existing) && LIVE.includes(seed.pot));

          if (isLiveFault) {
            shortCircuit = true;
            shortDetail =
              existing === "PE" || seed.pot === "PE"
                ? "Fázis–Védővezető (L–PE) testzárlat"
                : `${[existing, seed.pot].sort().join(" és ")} zárlat`;
            if (seed.breakerId) faultyBreakerIds.add(seed.breakerId);
            if (existingBreaker) faultyBreakerIds.add(existingBreaker);

            if (existing === "PE" || seed.pot === "PE") {
              rcdTripped = true;
              rcdDetail = "ÁVK hibaáram-leoldás: Fázis–Védővezető (L–PE) testzárlat.";
              if (seed.rcdId) faultyRcdIds.add(seed.rcdId);
              if (existingRcd) faultyRcdIds.add(existingRcd);
            } else if (seed.rcdId && existingRcd && seed.rcdId !== existingRcd) {
              rcdTripped = true;
              rcdDetail = "ÁVK hibaáram-leoldás: Kereszt-fázis/nulla zárlat eltérő ÁVK-k között.";
              faultyRcdIds.add(seed.rcdId);
              faultyRcdIds.add(existingRcd);
            }
          } else if ((existing === "N" && seed.pot === "PE") || (existing === "PE" && seed.pot === "N")) {
            const activeRcd = existingRcd ?? seed.rcdId;
            if (activeRcd) {
              rcdTripped = true;
              rcdDetail = "ÁVK hibaáram-leoldás: Nullavezető (N) és Védővezető (PE) zárlat/összekötés. ÁVK leoldott.";
              faultyRcdIds.add(activeRcd);
            }
          }
          continue;
        } else if (existing === "N" && seed.pot === "N") {
          if (existingRcd && seed.rcdId && existingRcd !== seed.rcdId) {
            rcdTripped = true;
            rcdDetail = "ÁVK hibaáram-leoldás: A 3 fázisú és 1 fázisú hálózat nullavezetője (3F N és 1F N) össze van kötve. Mindkét ÁVK leoldott.";
            faultyRcdIds.add(existingRcd);
            faultyRcdIds.add(seed.rcdId);
            continue;
          }
        }
      }

      potential[cur] = seed.pot;
      if (seed.rcdId) nodeRcd[cur] = seed.rcdId;
      if (seed.breakerId) nodeBreaker[cur] = seed.breakerId;

      for (const next of adj.get(cur) ?? []) {
        if (!seen.has(next)) queue.push(next);
      }
    }

    if (shortCircuit || rcdTripped) break;
  }

  return {
    potential,
    shortCircuit,
    shortDetail,
    faultyBreakerIds,
    faultyRcdIds,
    rcdTripped,
    rcdDetail,
    nodeRcd,
    nodeBreaker,
  };
}

function areNodesConnected(adj: Map<string, string[]>, startId: string, targetId: string): boolean {
  if (startId === targetId) return true;
  const visited = new Set<string>();
  const queue = [startId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === targetId) return true;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const next of adj.get(cur) ?? []) {
      if (!visited.has(next)) {
        queue.push(next);
      }
    }
  }
  return false;
}

function evaluateMotor(
  world: World,
  potential: Record<string, Potential>,
  adj: Map<string, string[]>,
): MotorState {
  const defaultState: MotorState = {
    mode: "off",
    direction: "none",
    speed: 0,
    peConnected: false,
    uPhase: "none",
    vPhase: "none",
    wPhase: "none",
    current: 0,
  };

  const motor = world.devices.find((d) => d.type === "motor_3p");
  if (!motor || motor.nodeIds.length < 7) {
    return defaultState;
  }

  const [u1Id, v1Id, w1Id, u2Id, v2Id, w2Id, peId] = motor.nodeIds;
  const pU1 = potential[u1Id] ?? "none";
  const pV1 = potential[v1Id] ?? "none";
  const pW1 = potential[w1Id] ?? "none";
  const pU2 = potential[u2Id] ?? "none";
  const pV2 = potential[v2Id] ?? "none";
  const pW2 = potential[w2Id] ?? "none";
  const pPE = potential[peId] ?? "none";

  const peConnected = pPE === "PE";

  // Check Star connection: U2, V2, W2 connected together
  const isStarPoint =
    areNodesConnected(adj, u2Id, v2Id) &&
    areNodesConnected(adj, u2Id, w2Id);

  // Check Reverse Star connection: U1, V1, W1 connected together
  const isReverseStarPoint =
    areNodesConnected(adj, u1Id, v1Id) &&
    areNodesConnected(adj, u1Id, w1Id);

  // 1. Regular Star mode (line supply on U1, V1, W1; star point at U2-V2-W2)
  if (isStarPoint && !isReverseStarPoint) {
    const inputPhases = [pU1, pV1, pW1];
    const livePhases = inputPhases.filter((p) => LIVE.includes(p));
    const uniqueLive = new Set(livePhases);

    if (uniqueLive.size === 3) {
      const isCw =
        (pU1 === "L1" && pV1 === "L2" && pW1 === "L3") ||
        (pU1 === "L2" && pV1 === "L3" && pW1 === "L1") ||
        (pU1 === "L3" && pV1 === "L1" && pW1 === "L2");

      return {
        mode: "star",
        direction: isCw ? "cw" : "ccw",
        speed: 1,
        peConnected,
        uPhase: pU1,
        vPhase: pV1,
        wPhase: pW1,
        current: 1.8,
      };
    } else if (uniqueLive.size === 2) {
      return {
        mode: "phase_fault",
        direction: "none",
        speed: 0,
        peConnected,
        uPhase: pU1,
        vPhase: pV1,
        wPhase: pW1,
        current: 8.5,
      };
    } else {
      return {
        ...defaultState,
        peConnected,
        uPhase: pU1,
        vPhase: pV1,
        wPhase: pW1,
      };
    }
  }

  // 2. Reverse Star mode (line supply on U2, V2, W2; star point at U1-V1-W1)
  if (isReverseStarPoint && !isStarPoint) {
    const inputPhases = [pU2, pV2, pW2];
    const livePhases = inputPhases.filter((p) => LIVE.includes(p));
    const uniqueLive = new Set(livePhases);

    if (uniqueLive.size === 3) {
      const isCw =
        (pU2 === "L1" && pV2 === "L2" && pW2 === "L3") ||
        (pU2 === "L2" && pV2 === "L3" && pW2 === "L1") ||
        (pU2 === "L3" && pV2 === "L1" && pW2 === "L2");

      return {
        mode: "star",
        direction: isCw ? "cw" : "ccw",
        speed: 1,
        peConnected,
        uPhase: pU2,
        vPhase: pV2,
        wPhase: pW2,
        current: 1.8,
      };
    } else if (uniqueLive.size === 2) {
      return {
        mode: "phase_fault",
        direction: "none",
        speed: 0,
        peConnected,
        uPhase: pU2,
        vPhase: pV2,
        wPhase: pW2,
        current: 8.5,
      };
    }
  }

  // 3. Delta mode
  const coilUPotDiff = LIVE.includes(pU1) && LIVE.includes(pU2) && pU1 !== pU2;
  const coilVPotDiff = LIVE.includes(pV1) && LIVE.includes(pV2) && pV1 !== pV2;
  const coilWPotDiff = LIVE.includes(pW1) && LIVE.includes(pW2) && pW1 !== pW2;

  if (coilUPotDiff && coilVPotDiff && coilWPotDiff) {
    const isCw =
      (pU1 === "L1" && pV1 === "L2" && pW1 === "L3") ||
      (pU1 === "L2" && pV1 === "L3" && pW1 === "L1") ||
      (pU1 === "L3" && pV1 === "L1" && pW1 === "L2");

    return {
      mode: "delta",
      direction: isCw ? "cw" : "ccw",
      speed: 1,
      peConnected,
      uPhase: pU1,
      vPhase: pV1,
      wPhase: pW1,
      current: 5.4,
    };
  }

  const allMotorPhases = [pU1, pV1, pW1, pU2, pV2, pW2].filter((p) => LIVE.includes(p));
  const uniqueAllPhases = new Set(allMotorPhases);
  if (uniqueAllPhases.size === 2 && (coilUPotDiff || coilVPotDiff || coilWPotDiff)) {
    return {
      mode: "phase_fault",
      direction: "none",
      speed: 0,
      peConnected,
      uPhase: pU1,
      vPhase: pV1,
      wPhase: pW1,
      current: 8.5,
    };
  }

  return {
    ...defaultState,
    peConnected,
    uPhase: pU1,
    vPhase: pV1,
    wPhase: pW1,
  };
}

export function simulate(world: World): SimState {
  const result = emptySim();
  let contactors = new Set<string>(
    world.devices
      .filter((d) => d.type === "contactor" && d.energized)
      .map((d) => d.id),
  );

  // Multi-pass relaxation loop for contactors and dynamic feedback
  for (let passIdx = 0; passIdx < 8; passIdx += 1) {
    const adj = neighborsOf(world, contactors);
    const pass = propagate(world, adj);
    result.potential = pass.potential;
    result.shortCircuit = pass.shortCircuit;
    result.shortDetail = pass.shortDetail;
    result.rcdTripped = pass.rcdTripped;
    result.rcdDetail = pass.rcdDetail;

    // Check for consumer cross-neutral or N-PE faults on energized consumers
    if (!pass.shortCircuit && !pass.rcdTripped) {
      const checkConsumer = (lNodeId: string, nNodeId: string, devTitle: string) => {
        const lPot = pass.potential[lNodeId] ?? "none";
        const nPot = pass.potential[nNodeId] ?? "none";
        if (!LIVE.includes(lPot)) return;

        const rcdL = pass.nodeRcd[lNodeId];
        const rcdN = pass.nodeRcd[nNodeId];

        if (nPot === "N") {
          if (rcdL && rcdN && rcdL !== rcdN) {
            pass.rcdTripped = true;
            pass.faultyRcdIds.add(rcdL);
            pass.faultyRcdIds.add(rcdN);
            pass.rcdDetail = `ÁVK hibaáram-leoldás: Keresztbe kötött nulla hiba a(z) ${devTitle} fogyasztónál (${rcdL === "rcd_1p" ? "1P fázis és 3F nulla" : "3F fázis és 1F nulla"}). Mindkét ÁVK leoldott.`;
          }
        } else if (nPot === "PE") {
          if (rcdL) {
            pass.rcdTripped = true;
            pass.faultyRcdIds.add(rcdL);
            pass.rcdDetail = `ÁVK hibaáram-leoldás: A(z) ${devTitle} fogyasztó nullavezető helyett a védővezetőre (PE) van kötve. ÁVK leoldott.`;
          }
        }
      };

      for (const d of world.devices) {
        if (d.type === "lamp" && d.nodeIds.length >= 2) {
          checkConsumer(d.nodeIds[0], d.nodeIds[1], d.title);
        } else if (d.type === "socket" && d.nodeIds.length >= 2) {
          checkConsumer(d.nodeIds[0], d.nodeIds[1], d.title);
        } else if (d.type === "contactor" && d.nodeIds.length >= 6) {
          checkConsumer(d.nodeIds[4], d.nodeIds[5], d.title);
        } else if (d.type === "impulse_relay" && d.nodeIds.length >= 2) {
          checkConsumer(d.nodeIds[0], d.nodeIds[1], d.title);
        } else if (d.type === "staircase_relay" && d.nodeIds.length >= 3) {
          checkConsumer(d.nodeIds[2], d.nodeIds[0], d.title);
        } else if (d.type === "timer_relay" && d.nodeIds.length >= 5) {
          checkConsumer(d.nodeIds[0], d.nodeIds[4], d.title);
        } else if (d.type === "motion_sensor" && d.nodeIds.length >= 2) {
          checkConsumer(d.nodeIds[0], d.nodeIds[1], d.title);
        }
        if (pass.rcdTripped) break;
      }
      result.rcdTripped = pass.rcdTripped;
      result.rcdDetail = pass.rcdDetail;
    }

    if (result.shortCircuit || pass.rcdTripped) {
      if (result.shortCircuit) {
        if (pass.faultyBreakerIds.size > 0) {
          for (const bid of pass.faultyBreakerIds) tripMcb(world, bid);
        } else {
          tripMcb(world);
        }
      }
      if (pass.faultyRcdIds.size > 0) {
        for (const rid of pass.faultyRcdIds) tripRcd(world, rid);
      } else if (pass.rcdTripped) {
        tripRcd(world);
      }

      if (result.shortCircuit && pass.rcdTripped) {
        result.warnings.push(`Zárlat és hibaáram-leoldás: ${result.shortDetail || "zárlat"}. Megszakító és ÁVK leoldott.`);
      } else if (result.shortCircuit) {
        result.warnings.push(`Zárlatvédelem: ${result.shortDetail || "rövidzárlat"}. Megszakító leoldott.`);
      } else {
        result.warnings.push(pass.rcdDetail || "ÁVK hibaáram-leoldás: Hibaáram észlelve, az ÁVK leoldott.");
      }

      // Re-run with tripped breakers & RCDs
      const safeAdj = neighborsOf(world, new Set());
      const safePass = propagate(world, safeAdj);
      result.potential = safePass.potential;
      for (const d of world.devices) {
        if (d.type === "contactor") d.energized = false;
      }
      result.contactorOn = new Set();
      break;
    }

    const nextContactors = new Set<string>();
    for (const device of world.devices) {
      if (device.type === "contactor" && device.nodeIds.length >= 6) {
        // A1 is index 4, A2 is index 5
        const a1 = device.nodeIds[4];
        const a2 = device.nodeIds[5];
        const on = coilEnergized(result.potential, a1, a2);
        device.energized = on;
        if (on) nextContactors.add(device.id);
      }
    }

    const same =
      nextContactors.size === contactors.size &&
      [...nextContactors].every((id) => contactors.has(id));
    contactors = nextContactors;
    if (same) break;
  }

  if (!result.shortCircuit && !result.rcdTripped) {
    result.contactorOn = contactors;

    // Evaluate Impulse relay pulse
    for (const device of world.devices) {
      if (device.type === "impulse_relay" && device.nodeIds.length >= 4) {
        const isPulse = coilEnergized(result.potential, device.nodeIds[0], device.nodeIds[1]);
        if (isPulse && !device.prevEnergized) {
          device.relayState = !device.relayState;
        }
        device.prevEnergized = isPulse;
        device.energized = isPulse;
        if (device.relayState) result.activeDevices.add(device.id);
      }
    }

    // Evaluate Staircase relay pulse
    for (const device of world.devices) {
      if (device.type === "staircase_relay" && device.nodeIds.length >= 4) {
        // [N, B, L, 4]
        const nPot = result.potential[device.nodeIds[0]];
        const bPot = result.potential[device.nodeIds[1]];
        const lPot = result.potential[device.nodeIds[2]];
        const hasPower = LIVE.includes(lPot) && nPot === "N";
        const hasPulse = LIVE.includes(bPot);

        if (hasPower && hasPulse && !device.prevEnergized) {
          device.timerRemaining = 5.0;
        }
        device.prevEnergized = hasPulse;
        device.energized = (device.timerRemaining ?? 0) > 0;
        if (device.energized) result.activeDevices.add(device.id);
      }
    }

    // Evaluate Timer relay
    for (const device of world.devices) {
      if (device.type === "timer_relay" && device.nodeIds.length >= 5) {
        // [A1, 15, 18, 16, A2]
        const on = coilEnergized(result.potential, device.nodeIds[0], device.nodeIds[4]);
        device.energized = on;
        if (device.relayState) result.activeDevices.add(device.id);
      }
    }

    // Evaluate Motion sensor
    for (const device of world.devices) {
      if (device.type === "motion_sensor" && device.nodeIds.length >= 3) {
        // [L, N, out]
        const lPot = result.potential[device.nodeIds[0]];
        const nPot = result.potential[device.nodeIds[1]];
        const hasPower = LIVE.includes(lPot) && nPot === "N";
        device.energized = hasPower && (device.timerRemaining ?? 0) > 0;
        if (device.energized) result.activeDevices.add(device.id);
      }
    }
  }

  // Live node IDs
  for (const [id, pot] of Object.entries(result.potential)) {
    if (LIVE.includes(pot)) result.liveNodeIds.add(id);
  }

  // Lamps
  for (const device of world.devices) {
    if (device.type === "lamp" && device.nodeIds.length >= 2) {
      const l = result.potential[device.nodeIds[0]];
      const n = result.potential[device.nodeIds[1]];
      if (LIVE.includes(l) && n === "N") {
        result.lampOn.add(device.id);
        result.activeDevices.add(device.id);
      }
    }
  }

  // Sockets
  for (const device of world.devices) {
    if (device.type === "socket" && device.nodeIds.length >= 2) {
      const l = result.potential[device.nodeIds[0]];
      const n = result.potential[device.nodeIds[1]];
      if (LIVE.includes(l) && n === "N") {
        result.activeDevices.add(device.id);
      }
    }
  }

  // Loose wires
  for (const wire of world.wires) {
    const startOk = isWireEndSecure(world, wire.startPortId);
    const endOk = isWireEndSecure(world, wire.endPortId);
    if (!startOk || !endOk) result.looseCount += 1;
  }

  if (result.looseCount > 0) {
    result.warnings.push(`${result.looseCount} laza kötés (meghúzatlan csavar / nyitott Wago).`);
  }

  // Evaluate 3-phase induction motor
  const finalAdj = neighborsOf(world, contactors);
  const motorState = evaluateMotor(world, result.potential, finalAdj);
  result.motor = motorState;

  const motorDev = world.devices.find((d) => d.type === "motor_3p");
  if (motorDev) {
    motorDev.energized = motorState.mode !== "off";
    motorDev.on = motorState.mode === "star" || motorState.mode === "delta";
    if (motorDev.energized) {
      result.activeDevices.add(motorDev.id);
    }
  }

  if (motorState.mode === "phase_fault") {
    result.warnings.push("3F Motor fázishiba: Aszimmetrikus 2 fázisú táplálás! A motor nem tud felpörögni és túlterhelődik.");
  }
  if (motorState.mode !== "off" && !motorState.peConnected) {
    result.warnings.push("3F Motor: A védővezető (PE) nincs bekötve a motorhoz! Földelés nélkül nem üzemeltethető.");
  }

  return result;
}

export function portPotential(sim: SimState, world: World, portId: string): Potential {
  const port = world.ports[portId];
  if (!port) return "none";
  return sim.potential[port.nodeId] ?? "none";
}

export function isWireLive(sim: SimState, world: World, wireId: string): boolean {
  const wire = world.wires.find((w) => w.id === wireId);
  if (!wire) return false;
  if (!isWireEndSecure(world, wire.startPortId) || !isWireEndSecure(world, wire.endPortId)) {
    return false;
  }
  const a = world.ports[wire.startPortId];
  const b = world.ports[wire.endPortId];
  return !!(a && (sim.liveNodeIds.has(a.nodeId) || (b && sim.liveNodeIds.has(b.nodeId))));
}
