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

export function toggleDevice(world: World, deviceId: string, subControl?: number) {
  const device = deviceById(world, deviceId);
  if (
    device.type === "button" ||
    device.type === "button_no" ||
    device.type === "button_nc" ||
    device.type === "push_switch_101n" ||
    device.type === "lamp" ||
    device.type === "contactor" ||
    device.type === "socket"
  ) {
    return;
  }

  if (device.type === "switch_105") {
    if (subControl === 2) {
      device.on2 = !device.on2;
    } else {
      device.on = !device.on;
    }
    return;
  }

  if (device.type === "motion_sensor") {
    device.timerRemaining = 5.0;
    return;
  }

  if (device.type === "impulse_relay") {
    device.relayState = !device.relayState;
    return;
  }

  if (device.type === "staircase_relay") {
    device.timerRemaining = (device.timerRemaining && device.timerRemaining > 0) ? 0 : 5.0;
    return;
  }

  device.on = !device.on;
}

export function setButtonPressed(world: World, deviceId: string, pressed: boolean) {
  const device = deviceById(world, deviceId);
  if (
    device.type === "button" ||
    device.type === "button_no" ||
    device.type === "button_nc" ||
    device.type === "push_switch_101n"
  ) {
    device.pressed = pressed;
  }
}

export function tripMcb(world: World, breakerId?: string) {
  if (breakerId) {
    const b = world.devices.find((d) => d.id === breakerId);
    if (b) b.on = false;
    return;
  }

  // Trip all active breakers or default
  const breakers = world.devices.filter(
    (d) => d.type === "mcb" || d.type === "mcb3p" || d.type === "mcb1p",
  );
  if (breakers.length > 0) {
    for (const b of breakers) {
      b.on = false;
    }
  } else {
    const mcb = world.devices.find((d) => d.id === world.mcbId);
    if (mcb) mcb.on = false;
  }
}

export function tickWorld(world: World, dt: number): boolean {
  let changed = false;

  for (const device of world.devices) {
    if (device.type === "staircase_relay" || device.type === "motion_sensor") {
      if (device.timerRemaining !== undefined && device.timerRemaining > 0) {
        device.timerRemaining = Math.max(0, device.timerRemaining - dt);
        if (device.timerRemaining === 0) {
          changed = true;
        }
      }
    }

    if (device.type === "timer_relay") {
      if (device.energized) {
        if (!device.relayState) {
          const rem = device.timerRemaining ?? 3.0;
          if (rem > 0) {
            device.timerRemaining = Math.max(0, rem - dt);
            if (device.timerRemaining === 0) {
              device.relayState = true;
              changed = true;
            }
          }
        }
      } else {
        if (device.relayState || (device.timerRemaining !== 3.0 && device.timerRemaining !== undefined)) {
          device.relayState = false;
          device.timerRemaining = 3.0;
          changed = true;
        }
      }
    }
  }

  return changed;
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
