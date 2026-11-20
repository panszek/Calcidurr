export type Potential = "none" | "L1" | "L2" | "L3" | "N" | "PE";

export type WireColorId = "L1" | "L2" | "L3" | "N" | "PE" | "CTRL";

export type ToolMode = "wire" | "screwdriver" | "hand" | "cutter";

export type PortKind = "screw" | "wago";

export type DeviceType = "mcb" | "switch" | "button" | "contactor" | "lamp";

export type ColorMark = "black" | "brown" | "grey" | "blue" | "pe" | "red";

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ElectricalNode {
  id: string;
  label: string;
  deviceName: string;
  functionLabel: string;
  sourcePotential?: Exclude<Potential, "none">;
}

export interface Port {
  id: string;
  nodeId: string;
  kind: PortKind;
  x: number;
  y: number;
  label: string;
  tight: boolean;
}

export interface TerminalColumn {
  id: string;
  nodeId: string;
  portId: string;
  title: string;
  mark: ColorMark;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Wire {
  id: string;
  color: WireColorId;
  points: Point[];
  startPortId: string;
  endPortId: string;
}

export interface WagoBlock {
  id: string;
  nodeId: string;
  x: number;
  y: number;
  portIds: [string, string, string];
}

export interface Device {
  id: string;
  type: DeviceType;
  title: string;
  bounds: Rect;
  nodeIds: string[];
  on: boolean;
  pressed: boolean;
  energized: boolean;
}

export interface World {
  nodes: Record<string, ElectricalNode>;
  ports: Record<string, Port>;
  columns: TerminalColumn[];
  wagos: WagoBlock[];
  devices: Device[];
  wires: Wire[];
  mcbId: string;
}

export interface SimState {
  potential: Record<string, Potential>;
  liveNodeIds: Set<string>;
  shortCircuit: boolean;
  shortDetail: string;
  lampOn: Set<string>;
  contactorOn: Set<string>;
  looseCount: number;
  warnings: string[];
}
