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
    looseCount: 0,
    warnings: [],
  };
}

function neighborsOf(world: World, energizedContactors: Set<string>): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push(b);
    adj.get(b)!.push(a);
  };

  for (const node of Object.values(world.nodes)) {
    if (!adj.has(node.id)) adj.set(node.id, []);
  }

  for (const wire of world.wires) {
    if (!isWireEndSecure(world, wire.startPortId) || !isWireEndSecure(world, wire.endPortId)) {
      continue;
    }
    const a = world.ports[wire.startPortId];
    const b = world.ports[wire.endPortId];
    if (a && b) link(a.nodeId, b.nodeId);
  }

  for (const device of world.devices) {
    if (device.type === "mcb") continue;
    if (device.type === "switch" && device.on && device.nodeIds.length >= 2) {
      link(device.nodeIds[0], device.nodeIds[1]);
    }
    if (device.type === "button" && device.pressed && device.nodeIds.length >= 2) {
      link(device.nodeIds[0], device.nodeIds[1]);
    }
    if (device.type === "contactor" && energizedContactors.has(device.id) && device.nodeIds.length >= 4) {
      link(device.nodeIds[2], device.nodeIds[3]);
    }
  }

  return adj;
}

function sourceOf(world: World, nodeId: string): Potential {
  const node = world.nodes[nodeId];
  if (!node?.sourcePotential) return "none";
  if (node.sourcePotential === "L1") {
    const mcb = world.devices.find((d) => d.id === world.mcbId);
    if (!mcb?.on) return "none";
  }
  return node.sourcePotential;
}

function propagate(world: World, adj: Map<string, string[]>): {
  potential: Record<string, Potential>;
  shortCircuit: boolean;
  shortDetail: string;
} {
  const potential: Record<string, Potential> = {};
  for (const id of Object.keys(world.nodes)) potential[id] = "none";

  const visited = new Set<string>();
  let shortCircuit = false;
  let shortDetail = "";

  const seeds = Object.values(world.nodes)
    .map((node) => ({ id: node.id, pot: sourceOf(world, node.id) }))
    .filter((s) => s.pot !== "none");

  for (const seed of seeds) {
    if (visited.has(seed.id) && potential[seed.id] !== "none" && potential[seed.id] !== seed.pot) {
      shortCircuit = true;
      shortDetail = `${potential[seed.id]} és ${seed.pot} zárlat`;
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
          (existing === "L1" && (seed.pot === "N" || seed.pot === "PE")) ||
          (seed.pot === "L1" && (existing === "N" || existing === "PE")) ||
          (LIVE.includes(existing) && LIVE.includes(seed.pot) && existing !== seed.pot);
        if (isFault) {
          shortCircuit = true;
          shortDetail = `${pair.replace("+", " és ")} zárlat`;
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

  return { potential, shortCircuit, shortDetail };
}

function coilEnergized(potential: Record<string, Potential>, a1: string, a2: string): boolean {
  const p = new Set([potential[a1], potential[a2]]);
  return (p.has("L1") || p.has("L2") || p.has("L3")) && p.has("N");
}

export function simulate(world: World): SimState {
  const result = emptySim();
  let contactors = new Set<string>();

  for (let i = 0; i < 8; i += 1) {
    const adj = neighborsOf(world, contactors);
    const pass = propagate(world, adj);
    result.potential = pass.potential;
    result.shortCircuit = pass.shortCircuit;
    result.shortDetail = pass.shortDetail;

    const next = new Set<string>();
    for (const device of world.devices) {
      if (device.type !== "contactor" || device.nodeIds.length < 2) continue;
      const on = coilEnergized(result.potential, device.nodeIds[0], device.nodeIds[1]);
      device.energized = on;
      if (on) next.add(device.id);
    }

    const same =
      next.size === contactors.size && [...next].every((id) => contactors.has(id));
    contactors = next;
    if (same) break;
  }

  result.contactorOn = contactors;

  if (result.shortCircuit) {
    tripMcb(world);
    result.warnings.push(`Zárlatvédelem: ${result.shortDetail || "rövidzárlat"}. A 1P B10A leoldott.`);
    const adj = neighborsOf(world, new Set());
    const pass = propagate(world, adj);
    result.potential = pass.potential;
    for (const device of world.devices) {
      if (device.type === "contactor") device.energized = false;
    }
    result.contactorOn = new Set();
  }

  for (const [id, pot] of Object.entries(result.potential)) {
    if (LIVE.includes(pot)) result.liveNodeIds.add(id);
  }

  for (const device of world.devices) {
    if (device.type !== "lamp" || device.nodeIds.length < 2) continue;
    const l = result.potential[device.nodeIds[0]];
    const n = result.potential[device.nodeIds[1]];
    if (LIVE.includes(l) && n === "N") result.lampOn.add(device.id);
  }

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
