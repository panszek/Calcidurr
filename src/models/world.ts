import type { Device, Port, WagoBlock, World } from "./types";

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

export function hasWagoWires(world: World, wagoId: string): boolean {
  const wago = world.wagos.find((w) => w.id === wagoId);
  if (!wago) return false;
  return world.wires.some(
    (wire) => wago.portIds.includes(wire.startPortId) || wago.portIds.includes(wire.endPortId),
  );
}

export function getWagoPortPos(
  wago: Pick<WagoBlock, "x" | "y" | "portIds" | "slots" | "rotation">,
  index: number,
): { x: number; y: number } {
  const slots = wago.slots ?? (wago.portIds.length as 3 | 5);
  const w = 18 + slots * 24;
  const h = 66;
  const cx = wago.x + w / 2;
  const cy = wago.y + h / 2;

  const dx = 18 + index * 24 - w / 2;
  const dy = 46 - h / 2;

  const rot = wago.rotation ?? 0;
  let rotDx = dx;
  let rotDy = dy;
  if (rot === 90) {
    rotDx = -dy;
    rotDy = dx;
  } else if (rot === 180) {
    rotDx = -dx;
    rotDy = -dy;
  } else if (rot === 270) {
    rotDx = dy;
    rotDy = -dx;
  }

  return {
    x: Math.round(cx + rotDx),
    y: Math.round(cy + rotDy),
  };
}

export function moveWago(world: World, wagoId: string, x: number, y: number) {
  const wago = world.wagos.find((w) => w.id === wagoId);
  if (!wago || wago.fixed) return;
  wago.x = x;
  wago.y = y;
  wago.portIds.forEach((pid, index) => {
    const port = world.ports[pid];
    if (port) {
      const pos = getWagoPortPos(wago, index);
      port.x = pos.x;
      port.y = pos.y;
    }
  });
}

export function rotateWago(
  world: World,
  wagoId: string,
  deltaDegrees: 90 | 180 | 270 = 90,
): boolean {
  const wago = world.wagos.find((w) => w.id === wagoId);
  if (!wago || wago.fixed || hasWagoWires(world, wago.id)) return false;

  const currentRot = wago.rotation ?? 0;
  const nextRot = (((currentRot + deltaDegrees) % 360) as 0 | 90 | 180 | 270);
  wago.rotation = nextRot;

  // Frissítjük a kapcsok pozícióját
  wago.portIds.forEach((pid, index) => {
    const port = world.ports[pid];
    if (port) {
      const pos = getWagoPortPos(wago, index);
      port.x = pos.x;
      port.y = pos.y;
    }
  });

  return true;
}

export function spawnWago(
  world: World,
  slots: 3 | 5,
  x: number,
  y: number,
  options?: { fixed?: boolean; rotation?: 0 | 90 | 180 | 270 },
): WagoBlock {
  const wagoId = nextId("wago");
  const nodeId = nextId("wago_node");

  world.nodes[nodeId] = {
    id: nodeId,
    deviceName: `Wago (${slots}-as)`,
    functionLabel: `${slots}-as összekötő`,
    label: `W`,
  };

  const portIds: string[] = [];
  for (let i = 0; i < slots; i++) {
    const pid = `${wagoId}_p${i + 1}`;
    portIds.push(pid);
  }

  const wago: WagoBlock = {
    id: wagoId,
    nodeId,
    x,
    y,
    portIds,
    slots,
    fixed: options?.fixed ?? false,
    rotation: options?.rotation ?? 0,
  };

  for (let i = 0; i < slots; i++) {
    const pid = portIds[i];
    const pos = getWagoPortPos(wago, i);
    world.ports[pid] = {
      id: pid,
      nodeId,
      kind: "wago",
      x: pos.x,
      y: pos.y,
      label: `${wagoId}:${i + 1}`,
      tight: false, // nyitott karral indul, bekötésre készen
    };
  }

  world.wagos.push(wago);
  return wago;
}

export function removeWago(world: World, wagoId: string): boolean {
  const wagoIndex = world.wagos.findIndex((w) => w.id === wagoId);
  if (wagoIndex === -1) return false;
  const wago = world.wagos[wagoIndex];

  // Rögzített (fixed) vagy bekötött (hasWagoWires) WAGO nem távolítható el
  if (wago.fixed || hasWagoWires(world, wago.id)) {
    return false;
  }

  // Töröljük a hozzá tartozó portokat
  for (const pid of wago.portIds) {
    delete world.ports[pid];
  }

  // Töröljük az elektromos csomópontot
  delete world.nodes[wago.nodeId];

  // Töröljük a wagos tömbből
  world.wagos.splice(wagoIndex, 1);
  return true;
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
