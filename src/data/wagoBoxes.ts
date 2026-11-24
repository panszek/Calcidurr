import type { Point } from "../models/types";

export interface WagoBoxDef {
  slots: 3 | 5;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  code: string;
}

export const WAGO_BOX_3: WagoBoxDef = {
  slots: 3,
  x: 940,
  y: 1095,
  w: 135,
  h: 100,
  title: "WAGO 3-as",
  code: "221-413",
};

export const WAGO_BOX_5: WagoBoxDef = {
  slots: 5,
  x: 1105,
  y: 1095,
  w: 155,
  h: 100,
  title: "WAGO 5-ös",
  code: "221-415",
};

export const WAGO_BOXES: WagoBoxDef[] = [WAGO_BOX_3, WAGO_BOX_5];

export function hitWagoBox(p: Point): WagoBoxDef | undefined {
  return WAGO_BOXES.find(
    (b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h,
  );
}
