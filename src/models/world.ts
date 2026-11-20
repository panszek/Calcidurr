import type { Device, Port, World } from "./types";

export function cloneWorld(world: World): World {
  return structuredClone(world);
}

export function portById(world: World, id: string): Port {
  const port = world.ports[id];
  if (!port) throw new Error(`Ismeretlen kapocs: ${id}`);
  return port;
}

export function deviceById(world: World, id: string): Device {
  const device = world.devices.find((item) => item.id === id);
  if (!device) throw new Error(`Ismeretlen készülék: ${id}`);
  return device;
}

export function occupyingWire(world: World, portId: string) {
  return world.wires.find(
    (wire) => wire.startPortId === portId || wire.endPortId === portId,
  );
}

export function isPortOccupied(world: World, portId: string, ignoreWireId?: string) {
  return world.wires.some(
    (wire) =>
      wire.id !== ignoreWireId &&
      (wire.startPortId === portId || wire.endPortId === portId),
  );
}

export function isWireEndSecure(world: World, portId: string): boolean {
  return portById(world, portId).tight;
}

export function isWireRemovable(world: World, wireId: string): boolean {
  const wire = world.wires.find((item) => item.id === wireId);
  if (!wire) return false;
  return !isWireEndSecure(world, wire.startPortId) && !isWireEndSecure(world, wire.endPortId);
}

export function nextId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function togglePortTight(world: World, portId: string) {
  const port = portById(world, portId);
  port.tight = !port.tight;
}

export function setPortTight(world: World, portId: string, tight: boolean) {
  portById(world, portId).tight = tight;
}

export function toggleDevice(world: World, deviceId: string) {
  const device = deviceById(world, deviceId);
  if (device.type === "button") return;
  device.on = !device.on;
}

export function setButtonPressed(world: World, deviceId: string, pressed: boolean) {
  const device = deviceById(world, deviceId);
  if (device.type !== "button") return;
  device.pressed = pressed;
}

export function tripMcb(world: World) {
  const mcb = deviceById(world, world.mcbId);
  mcb.on = false;
}

export function addWire(
  world: World,
  color: World["wires"][number]["color"],
  points: { x: number; y: number }[],
  startPortId: string,
  endPortId: string,
) {
  world.wires.push({
    id: nextId("wire"),
    color,
    points: points.map((p) => ({ ...p })),
    startPortId,
    endPortId,
  });
  setPortTight(world, startPortId, false);
  setPortTight(world, endPortId, false);
}

export function removeWire(world: World, wireId: string) {
  world.wires = world.wires.filter((wire) => wire.id !== wireId);
}
