export type Potential = "none" | "L1" | "L2" | "L3" | "N" | "PE";

export type WireColorId = "L1" | "L2" | "L3" | "N" | "PE" | "CTRL";

export type ToolMode = "wire" | "screwdriver" | "hand" | "cutter" | "tester";

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

export type ExpectedWireRole = "phase" | "neutral" | "pe";

export interface WireColorIssue {
  wireId: string;
  wire: Wire;
  expectedRole: ExpectedWireRole;
  expectedColor: WireColorId;
  actualColor: WireColorId;
  reason: string;
  fromLabel: string;
  toLabel: string;
}

export interface ColorCheckResult {
  totalWires: number;
  correctWires: number;
  valid: boolean;
  issues: WireColorIssue[];
  summary: string;
}

export type PhaseRotation = "R" | "L" | "none";

export type VoltageLedStep = 12 | 24 | 50 | 120 | 230 | 400;

export type ProbeTargetKind = "screw_top" | "screw_bottom" | "port" | "wago" | "socket";

export interface ProbeTarget {
  id: string;
  nodeId: string;
  portId?: string;
  kind: ProbeTargetKind;
  x: number;
  y: number;
  /** Információelrejtést tisztelő fizikai megnevezés a műszerpanelen */
  displayLabel: string;
}

export interface TesterReading {
  /** Mindkét mérőtüske mérési ponton van-e */
  active: boolean;
  /** Legalább az egyik mérőtüske le van-e téve */
  hasAnyProbe: boolean;
  /** Mért váltakozó feszültség (0, 230 vagy 400 V) */
  voltage: number;
  /** Igaz, ha a mért feszültség >= 12 V AC */
  isAcVoltage: boolean;
  /** Világító feszültség-lépcső LED-ek (12V, 24V, 50V, 120V, 230V, 400V) */
  ledSteps: VoltageLedStep[];
  /** Egypólusú fázisjelzés (⚡ LED), ha bármelyik tüske élő fázison (L1/L2/L3) van */
  singlePolePhase: boolean;
  /** Fázissorrend jelzés 400 V-os vonali mérésnél ("R" jobbra, "L" balra) */
  phaseRotation: PhaseRotation;
  /** Folytonosságvizsgálat aktív-e (mindkét tüske feszültségmentes ponton van) */
  continuityActive: boolean;
  /** Folytonos fémes kapcsolat áll-e fenn (0.0 Ω + 🔊 Rx LED + sípolás) */
  continuity: boolean;
  /** Ellenállás / folytonosság kijelzés ("0.0 Ω" vagy "OL", feszültség alatt null) */
  resistanceText: "0.0 Ω" | "OL" | null;
  /** Elsődleges LCD kijelzés ("230 V", "400 V", "0 V", "0.0 Ω", "OL", "---") */
  lcdPrimary: string;
  /** Másodlagos LCD státuszsor */
  lcdSecondary: string;
  /** Fekete (COM / -) tüske potenciálja */
  blackPotential: Potential;
  /** Piros (+) tüske potenciálja */
  redPotential: Potential;
}


