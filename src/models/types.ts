export type Potential = "none" | "L1" | "L2" | "L3" | "N" | "PE";

export type WireColorId = "L1" | "L2" | "L3" | "N" | "PE" | "CTRL";

export type ToolMode = "wire" | "screwdriver" | "hand" | "cutter";

export type PortKind = "screw" | "wago";

export type DeviceType =
  | "mcb"
  | "mcb3p"
  | "mcb1p"
  | "rcd"
  | "rcd_3p"
  | "rcd_1p"
  | "switch"
  | "switch_101"
  | "switch_102"
  | "switch_105"
  | "switch_106"
  | "switch_107"
  | "push_switch_101n"
  | "button"
  | "button_no"
  | "button_nc"
  | "contactor"
  | "motor_protector"
  | "impulse_relay"
  | "staircase_relay"
  | "timer_relay"
  | "motion_sensor"
  | "socket"
  | "lamp"
  | "motor_3p";

export type ColorMark =
  | "black"
  | "brown"
  | "grey"
  | "blue"
  | "pe"
  | "red"
  | "green"
  | "yellow"
  | "white";

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
  breakerId?: string;
  rcdId?: string;
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
  portIds: string[];
  slots?: 3 | 5;
  fixed?: boolean;
  rotation?: 0 | 90 | 180 | 270;
}

export interface Device {
  id: string;
  type: DeviceType;
  title: string;
  bounds: Rect;
  nodeIds: string[];
  on: boolean;
  on2?: boolean;
  pressed: boolean;
  energized: boolean;
  timerRemaining?: number;
  timerActive?: boolean;
  relayState?: boolean;
  prevEnergized?: boolean;
  customLabel?: string;
  subType?: "no" | "nc";
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
  rcdTripped?: boolean;
  rcdDetail?: string;
  lampOn: Set<string>;
  contactorOn: Set<string>;
  activeDevices: Set<string>;
  looseCount: number;
  warnings: string[];
  motor?: MotorState;
}

export type MotorMode = "off" | "star" | "delta" | "phase_fault";
export type MotorDirection = "cw" | "ccw" | "none";

export interface MotorState {
  mode: MotorMode;
  direction: MotorDirection;
  speed: number;
  peConnected: boolean;
  uPhase: Potential;
  vPhase: Potential;
  wPhase: Potential;
  current: number;
}
