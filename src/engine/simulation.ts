import type { Potential, SimState, World } from "../models/types";
import { isWireEndSecure, tripMcb } from "../models/world";

const LIVE: Potential[] = ["L1", "L2", "L3"];

function emptySim(): SimState {
  return {
    potential: {},
    liveNodeIds: new Set(),
    shortCircuit: false,
    shortDetail: "",
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

function sourceOf(world: World, nodeId: string): Potential {
  const node = world.nodes[nodeId];
  if (!node?.sourcePotential) return "none";

  if (node.breakerId) {
    const breaker = world.devices.find((d) => d.id === node.breakerId);
    if (!breaker?.on) return "none";
  } else if (node.sourcePotential === "L1") {
    const mcb = world.devices.find((d) => d.id === world.mcbId);
    if (mcb && !mcb.on) return "none";
  }

  return node.sourcePotential;
}

function propagate(
  world: World,
  adj: Map<string, string[]>,
): {
  potential: Record<string, Potential>;
  shortCircuit: boolean;
  shortDetail: string;
  faultyBreakerIds: Set<string>;
} {
  const potential: Record<string, Potential> = {};
  for (const id of Object.keys(world.nodes)) potential[id] = "none";

  const visited = new Set<string>();
  let shortCircuit = false;
  let shortDetail = "";
  const faultyBreakerIds = new Set<string>();

  const seeds = Object.values(world.nodes)
    .map((node) => ({
      id: node.id,
      pot: sourceOf(world, node.id),
      breakerId: node.breakerId ?? (node.sourcePotential === "L1" ? world.mcbId : undefined),
    }))
    .filter((s) => s.pot !== "none");

  for (const seed of seeds) {
    if (visited.has(seed.id) && potential[seed.id] !== "none" && potential[seed.id] !== seed.pot) {
      shortCircuit = true;
      shortDetail = `${potential[seed.id]} és ${seed.pot} zárlat`;
      if (seed.breakerId) faultyBreakerIds.add(seed.breakerId);
      break;
    }

    const queue = [seed.id];
    const seen = new Set<string>();

    while (queue.length) {
      const cur = queue.shift()!;
      if (seen.has(cur)) continue;
      seen.add(cur);
      visited.add(cur);

      const existing = potential[cur];
      if (existing !== "none" && existing !== seed.pot) {
        const pair = [existing, seed.pot].sort().join("+");
        const isFault =
          (LIVE.includes(existing) && (seed.pot === "N" || seed.pot === "PE")) ||
          (LIVE.includes(seed.pot) && (existing === "N" || existing === "PE")) ||
          (LIVE.includes(existing) && LIVE.includes(seed.pot) && existing !== seed.pot);

        if (isFault) {
          shortCircuit = true;
          shortDetail = `${pair.replace("+", " és ")} zárlat`;
          if (seed.breakerId) faultyBreakerIds.add(seed.breakerId);
        }
        continue;
      }

      potential[cur] = seed.pot;
      for (const next of adj.get(cur) ?? []) {
        if (!seen.has(next)) queue.push(next);
      }
    }

    if (shortCircuit) break;
  }

  return { potential, shortCircuit, shortDetail, faultyBreakerIds };
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

    if (result.shortCircuit) {
      // Trip faulty breaker(s)
      if (pass.faultyBreakerIds.size > 0) {
        for (const bid of pass.faultyBreakerIds) tripMcb(world, bid);
      } else {
        tripMcb(world);
      }
      result.warnings.push(`Zárlatvédelem: ${result.shortDetail || "rövidzárlat"}. Megszakító leoldott.`);

      // Re-run with tripped breakers
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

  if (!result.shortCircuit) {
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
