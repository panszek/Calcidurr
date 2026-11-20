import type { ColorMark, WireColorId } from "../models/types";

export const WIRE_COLORS: Record<
  WireColorId,
  { name: string; stroke: string; hint: string }
> = {
  L1: { name: "Fekete", stroke: "#1c1c1c", hint: "L1" },
  L2: { name: "Barna", stroke: "#6b3a1a", hint: "L2" },
  L3: { name: "Szürke", stroke: "#8d8d8d", hint: "L3" },
  N: { name: "Kék", stroke: "#1d5fb0", hint: "N" },
  PE: { name: "Zöld-sárga", stroke: "#2e8b2e", hint: "PE" },
  CTRL: { name: "Piros", stroke: "#c3182c", hint: "vezérlés" },
};

export const MARK_FILL: Record<ColorMark, string> = {
  black: "#111111",
  brown: "#6b3a1a",
  grey: "#9a9a9a",
  blue: "#1d5fb0",
  pe: "#e6c200",
  red: "#c3182c",
};

export const SNAP_RADIUS = 15;
export const WIRE_SAMPLE_GAP = 4;
