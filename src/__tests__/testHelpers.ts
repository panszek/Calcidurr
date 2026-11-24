import { createPrototypeWorld } from "../data/prototypeTrack";
import type { Wire, WireColorId, World } from "../models/types";
import { addWire, setPortTight, spawnWago } from "../models/world";

export function createTestWorld(): World {
  const world = createPrototypeWorld();
  // 5 darab teszt 5-ös WAGO a szimulációs és regressziós tesztekhez
  spawnWago(world, 5, 700, 635);
  spawnWago(world, 5, 860, 635);
  spawnWago(world, 5, 1020, 635);
  spawnWago(world, 5, 1180, 635);
  spawnWago(world, 5, 1340, 635);
  return world;
}

export function portOf(nodeId: string): string {
  return `p-${nodeId}`;
}

export function setDeviceOn(world: World, deviceId: string, on: boolean): void {
  const dev = world.devices.find((d) => d.id === deviceId);
  if (!dev) throw new Error(`Ismeretlen készülék tesztben: ${deviceId}`);
  dev.on = on;
}

/**
 * Explicit módon bekapcsolja a megadott táp-/védelmi eszközöket (így a tesztek akkor is
 * zöldek maradnak, ha később minden megszakító/ÁVK KI állapotból indul).
 */
export function enableSupply(
  world: World,
  deviceIds: string[] = ["rcd_3p", "rcd_1p", "mcb_1p_b10", "mcb_1p_b16", "mcb_3p", "dev_motor_protector"],
): void {
  for (const id of deviceIds) {
    const dev = world.devices.find((d) => d.id === id);
    if (dev) dev.on = true;
  }
  // Ha valamelyik 1P/3P kismegszakító be van kapcsolva a tesztben,
  // az upstream ÁVK-t is kapcsoljuk be automatikusan
  if (deviceIds.includes("mcb_1p_b10") || deviceIds.includes("mcb_1p_b16")) {
    const rcd1 = world.devices.find((d) => d.id === "rcd_1p");
    if (rcd1) rcd1.on = true;
  }
  if (deviceIds.includes("mcb_3p")) {
    const rcd3 = world.devices.find((d) => d.id === "rcd_3p");
    if (rcd3) rcd3.on = true;
  }
}

export function connectPorts(
  world: World,
  startPortId: string,
  endPortId: string,
  color: WireColorId = "L1",
  tighten = true,
): Wire {
  const pA = world.ports[startPortId];
  const pB = world.ports[endPortId];
  if (!pA) throw new Error(`Ismeretlen kezdő kapocs: ${startPortId}`);
  if (!pB) throw new Error(`Ismeretlen vég kapocs: ${endPortId}`);

  addWire(world, color, [{ x: pA.x, y: pA.y }, { x: pB.x, y: pB.y }], startPortId, endPortId);
  if (tighten) {
    setPortTight(world, startPortId, true);
    setPortTight(world, endPortId, true);
  }
  return world.wires[world.wires.length - 1];
}

export function connectNodes(
  world: World,
  startNodeId: string,
  endNodeId: string,
  color: WireColorId = "L1",
  tighten = true,
): Wire {
  return connectPorts(world, portOf(startNodeId), portOf(endNodeId), color, tighten);
}
