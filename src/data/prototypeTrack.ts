import type {
  Device,
  ElectricalNode,
  Port,
  TerminalColumn,
  WagoBlock,
  World,
} from "../models/types";

const COL_W = 46;
const COL_H = 168;

function node(
  id: string,
  deviceName: string,
  functionLabel: string,
  label: string,
  sourcePotential?: ElectricalNode["sourcePotential"],
): ElectricalNode {
  return { id, deviceName, functionLabel, label, sourcePotential };
}

function port(id: string, nodeId: string, kind: Port["kind"], x: number, y: number, label: string): Port {
  return { id, nodeId, kind, x, y, label, tight: true };
}

function column(
  id: string,
  nodeId: string,
  portId: string,
  title: string,
  mark: TerminalColumn["mark"],
  x: number,
  y: number,
): TerminalColumn {
  return { id, nodeId, portId, title, mark, x, y, w: COL_W, h: COL_H };
}

export function createPrototypeWorld(): World {
  const nodes: Record<string, ElectricalNode> = {
    supplyL1: node("supplyL1", "1P B10A", "L1 kimenet", "L1", "L1"),
    supplyN: node("supplyN", "1 Fázis Nullája", "N", "N", "N"),
    supplyPE: node("supplyPE", "Védővezető", "PE", "PE", "PE"),
    sw1: node("sw1", "Egypólusú kapcsoló", "kapocs 1", "1"),
    sw2: node("sw2", "Egypólusú kapcsoló", "kapocs 2", "2"),
    btn3: node("btn3", "Nyomógomb NO", "kapocs 3", "3"),
    btn4: node("btn4", "Nyomógomb NO", "kapocs 4", "4"),
    mkA1: node("mkA1", "Mágneskapcsoló MK1", "A1 tekercs", "A1"),
    mkA2: node("mkA2", "Mágneskapcsoló MK1", "A2 tekercs", "A2"),
    mk13: node("mk13", "Mágneskapcsoló MK1", "NO 13", "13"),
    mk14: node("mk14", "Mágneskapcsoló MK1", "NO 14", "14"),
    lampL: node("lampL", "Izzó 1", "L", "L"),
    lampN: node("lampN", "Izzó 1", "N", "N"),
    lampPE: node("lampPE", "Izzó 1", "PE", "PE"),
    wagoA: node("wagoA", "Wago 1", "3-as összekötő", "W1"),
    wagoB: node("wagoB", "Wago 2", "3-as összekötő", "W2"),
  };

  const supplyY = 86;
  const deviceY = 86;
  const screwY = (colY: number) => colY + 118;

  const columns: TerminalColumn[] = [
    column("c-l1", "supplyL1", "p-l1", "1P B10A", "black", 138, supplyY),
    column("c-n", "supplyN", "p-n", "1 FÁZIS NULLÁJA", "blue", 186, supplyY),
    column("c-pe", "supplyPE", "p-pe", "VÉDŐVEZETŐ", "pe", 234, supplyY),

    column("c-sw1", "sw1", "p-sw1", "KAPCSOLÓ", "black", 360, deviceY),
    column("c-sw2", "sw2", "p-sw2", "KAPCSOLÓ", "red", 408, deviceY),

    column("c-btn3", "btn3", "p-btn3", "NYOMÓGOMB", "red", 480, deviceY),
    column("c-btn4", "btn4", "p-btn4", "NYOMÓGOMB", "red", 528, deviceY),

    column("c-a1", "mkA1", "p-a1", "MK1", "red", 600, deviceY),
    column("c-a2", "mkA2", "p-a2", "MK1", "blue", 648, deviceY),
    column("c-13", "mk13", "p-13", "MK1", "black", 696, deviceY),
    column("c-14", "mk14", "p-14", "MK1", "black", 744, deviceY),

    column("c-ll", "lampL", "p-ll", "IZZÓ 1", "black", 816, deviceY),
    column("c-ln", "lampN", "p-ln", "IZZÓ 1", "blue", 864, deviceY),
    column("c-lpe", "lampPE", "p-lpe", "IZZÓ 1", "pe", 912, deviceY),
  ];

  const ports: Record<string, Port> = {};
  for (const col of columns) {
    ports[col.portId] = port(col.portId, col.nodeId, "screw", col.x + col.w / 2, screwY(col.y), worldLabel(col));
  }

  const wagos: WagoBlock[] = [
    { id: "wago-1", nodeId: "wagoA", x: 80, y: 430, portIds: ["w1a", "w1b", "w1c"] },
    { id: "wago-2", nodeId: "wagoB", x: 80, y: 560, portIds: ["w2a", "w2b", "w2c"] },
  ];

  for (const wago of wagos) {
    wago.portIds.forEach((pid, index) => {
      ports[pid] = port(pid, wago.nodeId, "wago", wago.x + 38 + index * 52, wago.y + 58, `${wago.id}:${index + 1}`);
    });
  }

  const devices: Device[] = [
    {
      id: "mcb1",
      type: "mcb",
      title: "1P B10A",
      bounds: { x: 48, y: 92, w: 72, h: 156 },
      nodeIds: ["supplyL1"],
      on: true,
      pressed: false,
      energized: false,
    },
    {
      id: "switch1",
      type: "switch",
      title: "Egypólusú kapcsoló",
      bounds: { x: 360, y: 300, w: 94, h: 94 },
      nodeIds: ["sw1", "sw2"],
      on: false,
      pressed: false,
      energized: false,
    },
    {
      id: "button1",
      type: "button",
      title: "Nyomógomb NO",
      bounds: { x: 480, y: 300, w: 94, h: 94 },
      nodeIds: ["btn3", "btn4"],
      on: false,
      pressed: false,
      energized: false,
    },
    {
      id: "mk1",
      type: "contactor",
      title: "MK1",
      bounds: { x: 618, y: 292, w: 150, h: 110 },
      nodeIds: ["mkA1", "mkA2", "mk13", "mk14"],
      on: false,
      pressed: false,
      energized: false,
    },
    {
      id: "lamp1",
      type: "lamp",
      title: "Izzó 1",
      bounds: { x: 830, y: 292, w: 120, h: 110 },
      nodeIds: ["lampL", "lampN", "lampPE"],
      on: false,
      pressed: false,
      energized: false,
    },
  ];

  return {
    nodes,
    ports,
    columns,
    wagos,
    devices,
    wires: [],
    mcbId: "mcb1",
  };
}

function worldLabel(col: TerminalColumn): string {
  return col.title.split(" ").at(-1) ?? col.id;
}
