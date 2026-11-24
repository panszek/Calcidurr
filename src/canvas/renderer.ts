import { MARK_FILL, WIRE_COLORS } from "../data/colors";
import { UPPER_TERMINAL_GROUPS, LOWER_TERMINAL_GROUPS } from "../data/terminalLegend";
import { WAGO_BOXES } from "../data/wagoBoxes";
import {
  WORKBENCH_CLAMP_BOUNDS,
  WORKBENCH_LEGEND_SHEET_BOUNDS,
  WORKBENCH_SPOOL_RACK_BOUNDS,
  WORKBENCH_SPOOLS,
  WORKBENCH_TESTER_BOUNDS,
  WORKBENCH_TOOL_MAT_BOUNDS,
  WORKBENCH_TOOLS,
} from "./input";
import { isWireLive } from "../engine/simulation";
import { hasWagoWires, isWireEndSecure } from "../models/world";
import type {
  ClampReading,
  ClampTarget,
  Device,
  Point,
  Port,
  ProbeTarget,
  SimState,
  TerminalColumn,
  TesterReading,
  ToolMode,
  WireColorId,
  World,
} from "../models/types";

export interface RenderExtras {
  debug: boolean;
  tool?: ToolMode;
  wireColor?: WireColorId;
  hoverPortId?: string;
  hoverWireId?: string;
  hoverWagoId?: string;
  draggedWagoId?: string;
  hoverWagoBoxSlots?: 3 | 5;
  hoverSpoolColor?: WireColorId;
  hoverWorkbenchTool?: "hand" | "screwdriver" | "cutter";
  hoverWorkbenchTester?: boolean;
  hoverWorkbenchClamp?: boolean;
  hoverLegendSheet?: boolean;
  draft?: { points: Point[]; color: keyof typeof WIRE_COLORS };
  tooltip?: { x: number; y: number; lines: string[] };
  motorAngle?: number;
  motorVibration?: number;
  colorCheckActive?: boolean;
  invalidWireIds?: Set<string>;
  colorCheckSummary?: string;
  blackProbe?: ProbeTarget;
  redProbe?: ProbeTarget;
  hoverProbeTarget?: ProbeTarget;
  pointerWorldPos?: Point;
  testerReading?: TesterReading;
  clampedTarget?: ClampTarget;
  hoverClampTarget?: ClampTarget;
  clampReading?: ClampReading;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function fillOsb(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // OSB panel base gradient
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#dcb886");
  grad.addColorStop(0.35, "#cfab76");
  grad.addColorStop(0.75, "#c29c67");
  grad.addColorStop(1, "#b58e57");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Realistic OSB wood chips and flakes
  ctx.save();
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 650; i += 1) {
    const x = (i * 137) % w;
    const y = (i * 73) % h;
    const ww = 18 + (i % 11) * 14;
    const hh = 6 + (i % 7) * 4;
    const angle = ((i % 13) - 6) * 0.12;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = i % 3 === 0 ? "#7b5424" : i % 3 === 1 ? "#f5dfb8" : "#9e7039";
    ctx.fillRect(-ww / 2, -hh / 2, ww, hh);
    ctx.restore();
  }
  ctx.restore();

  // Galvanized steel DIN rails (metal rails with slot holes)
  const drawDinRail = (rx: number, ry: number, rw: number, rh = 24) => {
    ctx.save();
    ctx.fillStyle = "#a8abb0";
    ctx.fillRect(rx, ry, rw, rh);
    ctx.fillStyle = "#c5c8cd";
    ctx.fillRect(rx, ry + 2, rw, 3);
    ctx.fillStyle = "#7b7e84";
    ctx.fillRect(rx, ry + rh - 5, rw, 3);
    ctx.strokeStyle = "#5a5c60";
    ctx.lineWidth = 1;
    ctx.strokeRect(rx, ry, rw, rh);

    // DIN rail end brackets (sorkapocs végbak)
    ctx.fillStyle = "#4a4d52";
    ctx.fillRect(rx - 8, ry - 6, 8, rh + 12);
    ctx.fillRect(rx + rw, ry - 6, 8, rh + 12);

    // Perforations
    ctx.fillStyle = "#5c5e62";
    for (let hx = rx + 14; hx < rx + rw - 14; hx += 42) {
      roundRect(ctx, hx, ry + (rh - 10) / 2, 18, 10, 3);
      ctx.fill();
    }
    ctx.restore();
  };

  // Top DIN rail for MK1, MK2, MK3
  drawDinRail(840, 80, 400, 24);

  // Upper terminal strip DIN rail (upperY = 180, center at 235)
  drawDinRail(680, 235, 1450, 26);

  // Lower terminal strip DIN rail (lowerY = 460, center at 515)
  drawDinRail(680, 515, 1250, 26);
}

function formatPosterGroupTitle(title: string): string {
  // Mágneskapcsolók a plakáton: egyszerűen MK1, MK2 vagy MK3
  if (/MK1/i.test(title)) return "MK1";
  if (/MK2/i.test(title)) return "MK2";
  if (/MK3/i.test(title)) return "MK3";

  // Kapcsolók a plakáton: csak a kódjuk (101N, 106, 107, 101, 102, 105)
  const switchMatch = title.match(/\b(101N|106|107|101|102|105)\b/i);
  if (switchMatch) return switchMatch[1].toUpperCase();

  // Rövidebb címkék a keskeny cellákhoz a plakáton
  if (/3\s*FÁZIS\s*NULLÁJA/i.test(title)) return "3F N";
  if (/1\s*FÁZIS\s*NULLÁJA/i.test(title)) return "1F N";
  if (/3P\s*C16A/i.test(title)) return "3P C16A";
  if (/1P\s*B10A/i.test(title)) return "1P B10A";
  if (/1P\s*B16A/i.test(title)) return "1P B16A";
  if (/LÉPCSŐHÁZI/i.test(title)) return "LÉPCSŐHÁZI";
  if (/DUGASZOLÓALJZAT/i.test(title)) return "DUGALJ";
  if (/BAL\s*OLDALI/i.test(title)) return "BAL";
  if (/SZIGET/i.test(title)) return "SZIGET";
  if (/JOBB\s*OLDALI/i.test(title)) return "JOBB";
  if (/MOZGÁSÉRZÉKELŐ/i.test(title)) return "PIR";

  return title;
}

function drawBackgroundFixtures(ctx: CanvasRenderingContext2D) {
  // 1. Kiselosztó szekrény doboza (Distribution enclosure on the left, x = 40..576)
  ctx.save();
  // Outer white enclosure frame
  roundRect(ctx, 40, 105, 536, 175, 10);
  ctx.fillStyle = "#f3f5f8";
  ctx.fill();
  ctx.strokeStyle = "#8b929c";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner cavity (darker recess)
  roundRect(ctx, 52, 128, 512, 138, 6);
  ctx.fillStyle = "#2c313a";
  ctx.fill();

  // Internal DIN rail
  ctx.fillStyle = "#8d939e";
  ctx.fillRect(54, 190, 508, 18);
  ctx.fillStyle = "#656a73";
  ctx.fillRect(54, 196, 508, 4);

  // Smoked semi-transparent acrylic door frame (top hinged)
  roundRect(ctx, 46, 112, 524, 160, 8);
  ctx.fillStyle = "rgba(40, 52, 68, 0.28)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Enclosure branding
  ctx.fillStyle = "#64748b";
  ctx.font = "700 9px Segoe UI";
  ctx.textAlign = "left";
  ctx.fillText("KISELOSZTÓ • IP40", 58, 122);
  ctx.restore();

  // 2. Sorkapocs-kiosztás plakát (Poster on the board under wagos)
  ctx.save();
  const px = 680;
  const py = 700;
  const pw = 1460;
  const ph = 245;
  // White laminated paper
  roundRect(ctx, px, py, pw, ph, 4);
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#9ca3af";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Header banner on poster
  roundRect(ctx, px + 2, py + 2, pw - 4, 26, 3);
  ctx.fillStyle = "#1e293b";
  ctx.fill();

  ctx.fillStyle = "#f8fafc";
  ctx.font = "800 11.5px Segoe UI";
  ctx.textAlign = "left";
  ctx.fillText("OKTATÓFALI SORKAPOCS-KIOSZTÁSI JEGYZÉK (KAPCSOLÁSI TERV ÉS SZÍNKÓDOK)", px + 18, py + 18);

  // Clickable badge prompt
  roundRect(ctx, px + pw - 340, py + 4, 324, 20, 4);
  ctx.fillStyle = "#0284c7";
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 10px Segoe UI";
  ctx.textAlign = "center";
  ctx.fillText("📋 KATTINTS IDE A NAGYÍTOTT JEGYZÉKHEZ", px + pw - 178, py + 18);

  // FELSŐ SORKAPOCSSOR (X1 • 65 db sorkapocs) - Részletes rajzolat
  ctx.fillStyle = "#1e293b";
  ctx.font = "800 10px Segoe UI";
  ctx.textAlign = "left";
  ctx.fillText("FELSŐ SORKAPOCSSOR (X1 • 65 db kapocs) — TÁPOK, KISMEGSZAKÍTÓK, RELÉK, MÁGNESKAPCSOLÓK, MOTORVÉDŐ", px + 18, py + 40);

  const tableStartX = px + 16;
  const tableW = pw - 32;
  const colWTop = tableW / 65;

  let curTopColIdx = 0;
  for (const group of UPPER_TERMINAL_GROUPS) {
    const grpCount = group.terminals.length;
    const grpX = tableStartX + curTopColIdx * colWTop;
    const grpW = grpCount * colWTop;

    // Group outline
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.strokeRect(grpX, py + 44, grpW, 48);

    // Group title
    const displayTitle = formatPosterGroupTitle(group.title);
    ctx.fillStyle = "#1e293b";
    ctx.textAlign = "center";
    ctx.font = displayTitle.length <= 4 ? "800 8.5px Segoe UI" : "700 7.5px Segoe UI";
    ctx.fillText(displayTitle, grpX + grpW / 2, py + 54);

    // Terminals in group
    for (let tIdx = 0; tIdx < grpCount; tIdx++) {
      const term = group.terminals[tIdx];
      const tx = grpX + tIdx * colWTop;

      // Pin label
      ctx.fillStyle = "#0f172a";
      ctx.font = "800 8px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText(term.label, tx + colWTop / 2, py + 66);

      // Color mark square
      const swatchCol = MARK_FILL[term.mark] ?? "#94a3b8";
      ctx.fillStyle = swatchCol;
      roundRect(ctx, tx + 2, py + 71, colWTop - 4, 17, 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    curTopColIdx += grpCount;
  }

  // ALSÓ SORKAPOCSSOR (X2 • 54 db sorkapocs) - Részletes rajzolat
  ctx.fillStyle = "#1e293b";
  ctx.font = "800 10px Segoe UI";
  ctx.textAlign = "left";
  ctx.fillText("ALSÓ SORKAPOCSSOR (X2 • 54 db kapocs) — DUGALJ, KAPCSOLÓK (106, 107, 101N, 101, 102, 105), GOMBOK, IZZÓK, PIR", px + 18, py + 105);

  const colWBot = (colWTop * 65) / 54;
  let curBotColIdx = 0;
  for (const group of LOWER_TERMINAL_GROUPS) {
    const grpCount = group.terminals.length;
    const grpX = tableStartX + curBotColIdx * colWBot;
    const grpW = grpCount * colWBot;

    // Group outline
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.strokeRect(grpX, py + 110, grpW, 48);

    // Group title
    const displayTitle = formatPosterGroupTitle(group.title);
    ctx.fillStyle = "#1e293b";
    ctx.textAlign = "center";
    ctx.font = displayTitle.length <= 4 ? "800 9px Segoe UI" : "700 7.5px Segoe UI";
    ctx.fillText(displayTitle, grpX + grpW / 2, py + 120);

    // Terminals in group
    for (let tIdx = 0; tIdx < grpCount; tIdx++) {
      const term = group.terminals[tIdx];
      const tx = grpX + tIdx * colWBot;

      // Pin label
      ctx.fillStyle = "#0f172a";
      ctx.font = "800 8px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText(term.label, tx + colWBot / 2, py + 132);

      // Color mark square
      const swatchCol = MARK_FILL[term.mark] ?? "#94a3b8";
      ctx.fillStyle = swatchCol;
      roundRect(ctx, tx + 2, py + 137, colWBot - 4, 17, 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    curBotColIdx += grpCount;
  }

  // Bekötési és használati útmutató lábléc a plakáton
  ctx.fillStyle = "#475569";
  ctx.font = "600 9.5px Segoe UI";
  ctx.textAlign = "left";
  ctx.fillText("Bekötési logika: A sorkapcsok felső oldala gyárilag bekötött (fix fali átvezetés). A kapcsolási vezetéket kizárólag az ALSÓ nyílásba kösd be, és az alsó csavart húzd meg csavarhúzóval!", px + 18, py + 175);
  ctx.fillStyle = "#0284c7";
  ctx.font = "700 9.5px Segoe UI";
  ctx.fillText("Tipp: A felső ikonsávban lévő táblázat ikonra, a munkapadi rajzlapra vagy közvetlenül erre a plakátra kattintva megnyílik a nagyítható segédtáblázat.", px + 18, py + 192);

  // Thumbtacks in 4 corners
  const drawPin = (tx: number, ty: number) => {
    ctx.beginPath();
    ctx.arc(tx, ty, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#dc2626";
    ctx.fill();
    ctx.strokeStyle = "#991b1b";
    ctx.stroke();
  };
  drawPin(px + 8, py + 8);
  drawPin(px + pw - 8, py + 8);
  drawPin(px + 8, py + ph - 8);
  drawPin(px + pw - 8, py + ph - 8);
  ctx.restore();

  // 3. Alsó munkapad fa asztallap és bal szélső CEE 3F betáp (az interaktív szerszámok és tekercsek külön rétegen)
  ctx.save();
  const by = 1070;
  const woodGrad = ctx.createLinearGradient(0, by, 0, by + 230);
  woodGrad.addColorStop(0, "#b5894f");
  woodGrad.addColorStop(0.45, "#a87c43");
  woodGrad.addColorStop(1, "#936934");
  ctx.fillStyle = woodGrad;
  ctx.fillRect(0, by, 2200, 230);

  // Finom vízszintes faerezet az asztallapon
  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = "#5c3d18";
  ctx.lineWidth = 1.2;
  for (let gy = by + 22; gy < 1295; gy += 19) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(2200, gy + ((gy % 38 === 0) ? 2 : -2));
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = "#7e5726";
  ctx.fillRect(0, by, 2200, 8);
  ctx.strokeStyle = "#5e401b";
  ctx.lineWidth = 1;
  ctx.strokeRect(0, by, 2200, 230);

  // 3-Phase CEE 16A red plug on the far-left wall with white supply cable (x = 28..108)
  roundRect(ctx, 28, by + 26, 78, 76, 6);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#9ca3af";
  ctx.stroke();
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(43 + i * 12, by + 64, 3.3, 0, Math.PI * 2);
    ctx.fillStyle = "#333";
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(67, by + 102);
  ctx.bezierCurveTo(67, by + 145, 52, by + 185, 52, 1300);
  ctx.lineWidth = 11;
  ctx.strokeStyle = "#e5e7eb";
  ctx.stroke();
  roundRect(ctx, 34, by + 156, 36, 48, 6);
  ctx.fillStyle = "#dc2626";
  ctx.fill();
  ctx.strokeStyle = "#991b1b";
  ctx.stroke();
  ctx.restore();

  // 4. Motor WAGO kábelköteg a poszter alatt (y = 940) és leállás a motorkapocsházhoz (y = 1122)
  ctx.save();
  // Vastag ipari fekete gégecső/motorkábel a motor kapocsházától a WAGO-kig
  ctx.beginPath();
  ctx.moveTo(1775, 1122);
  ctx.bezierCurveTo(1775, 1010, 1630, 940, 1450, 940);
  ctx.lineTo(758, 940);
  ctx.lineWidth = 14;
  ctx.strokeStyle = "#1e293b";
  ctx.lineCap = "round";
  ctx.stroke();

  // Gégecső belső bordázat kiemelése
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#334155";
  ctx.stroke();

  // 7 db gyári bekötő ér a 6+1 WAGO 1. portjába
  const motorWireDrops = [
    { x: 740 + 18, label: "U1", color: "#111827", isPe: false },
    { x: 845 + 18, label: "V1", color: "#111827", isPe: false },
    { x: 950 + 18, label: "W1", color: "#111827", isPe: false },
    { x: 1055 + 18, label: "U2", color: "#111827", isPe: false },
    { x: 1160 + 18, label: "V2", color: "#111827", isPe: false },
    { x: 1265 + 18, label: "W2", color: "#111827", isPe: false },
    { x: 1390 + 18, label: "PE", color: "#15803d", isPe: true },
  ];

  for (const drop of motorWireDrops) {
    // Vezeték leállás a kábelből a WAGO 1. portjába
    ctx.beginPath();
    ctx.moveTo(drop.x, 940);
    ctx.lineTo(drop.x, 975);
    ctx.lineWidth = 4;
    ctx.strokeStyle = drop.color;
    ctx.stroke();

    if (drop.isPe) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#eab308";
      ctx.beginPath();
      ctx.moveTo(drop.x, 940);
      ctx.lineTo(drop.x, 975);
      ctx.stroke();
      ctx.restore();
    }

    // Fehér szigetelőszalag jelölőfül (zászlócska) a kivezetés kódjával
    const flagW = 26;
    const flagH = 14;
    const flagX = drop.x - 2;
    const flagY = 948;
    roundRect(ctx, flagX, flagY, flagW, flagH, 2);
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = drop.isPe ? "#15803d" : "#0f172a";
    ctx.font = "800 8.5px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(drop.label, flagX + flagW / 2, flagY + flagH / 2);
  }
  ctx.restore();
}

function strokePolyline(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  width: number,
  color: string,
  glow = false,
) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  if (glow) {
    ctx.strokeStyle = "rgba(255, 230, 80, 0.65)";
    ctx.lineWidth = width + 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

function strokePe(ctx: CanvasRenderingContext2D, points: Point[], glow: boolean) {
  strokePolyline(ctx, points, 5.5, "#2e8b2e", glow);
  ctx.save();
  ctx.setLineDash([12, 10]);
  ctx.lineDashOffset = 2;
  strokePolyline(ctx, points, 5.5, "#e6c200", false);
  ctx.restore();
}

function drawColumn(
  ctx: CanvasRenderingContext2D,
  col: TerminalColumn,
  port: Port,
  hover: boolean,
  isScrewdriverHover: boolean,
  debug: boolean,
) {
  ctx.save();
  const cx = col.x + col.w / 2;

  // 1. FELSŐ OLDAL: Előszerelt, fix bekötés
  // A sorkapocs tetejébe gyárilag be van kötve egy rövid vezeték, amely felfelé indul el
  // és eltűnik a fal mögé (a falba vezető kis átvezetésbe/lyukba).
  const holeY = col.y - 18;
  const wireEntryY = col.y + 6;

  // Kis lyuk/átvezetés a falban (Wall pass-through hole)
  ctx.beginPath();
  ctx.ellipse(cx, holeY, 4.5, 3.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#181512";
  ctx.fill();
  ctx.strokeStyle = "#443b32";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Felső gyári vezeték rajzolása a sorkapocs színkódja szerint
  const mark = col.mark;
  if (mark === "pe") {
    // Védővezető: zöld-sárga csíkos vezeték
    ctx.beginPath();
    ctx.moveTo(cx, wireEntryY);
    ctx.lineTo(cx, holeY);
    ctx.strokeStyle = "#16a34a";
    ctx.lineWidth = 5.2;
    ctx.lineCap = "round";
    ctx.stroke();

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 5.2;
    ctx.stroke();
    ctx.restore();
  } else {
    let wireHex = "#18181b";
    if (mark === "blue") wireHex = "#2563eb";
    else if (mark === "red") wireHex = "#dc2626";
    else if (mark === "green") wireHex = "#16a34a";
    else if (mark === "yellow") wireHex = "#eab308";
    else if (mark === "white") wireHex = "#f8fafc";
    else if (mark === "brown") wireHex = "#78350f";
    else if (mark === "grey") wireHex = "#6b7280";

    ctx.beginPath();
    ctx.moveTo(cx, wireEntryY);
    ctx.lineTo(cx, holeY);
    ctx.strokeStyle = wireHex;
    ctx.lineWidth = 5.2;
    ctx.lineCap = "round";
    ctx.stroke();

    // 3D fénycsík a vezetéken
    ctx.beginPath();
    ctx.moveTo(cx - 1, wireEntryY);
    ctx.lineTo(cx - 1, holeY);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // 2. SORKAPOCS TEST (Moduláris DIN sorkapocs test)
  // A sorkapocs magán a testén NEM tartalmaz szöveges vagy számozott feliratot!
  const isGeneralHover = hover && !isScrewdriverHover;
  roundRect(ctx, col.x, col.y, col.w, col.h, 3);
  ctx.fillStyle = isGeneralHover ? "#ffffff" : "#eeeae2";
  ctx.fill();
  ctx.strokeStyle = isGeneralHover ? "#0284c7" : "#374151";
  ctx.lineWidth = isGeneralHover ? 1.5 : 1;
  ctx.stroke();

  // Oldalsó sorolási osztóhornyok
  ctx.strokeStyle = "#d6d0c4";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(col.x + 2, col.y + 4);
  ctx.lineTo(col.x + 2, col.y + col.h - 4);
  ctx.moveTo(col.x + col.w - 2, col.y + 4);
  ctx.lineTo(col.x + col.w - 2, col.y + col.h - 4);
  ctx.stroke();

  // Középső keresztösszekötő csatorna / horony
  const midY = col.y + col.h / 2;
  roundRect(ctx, col.x + 3.5, midY - 6, col.w - 7, 12, 2);
  ctx.fillStyle = "#ded8cc";
  ctx.fill();
  ctx.strokeStyle = "#b8b1a4";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // Belső rézsín jelzés a horony mélyén
  ctx.fillStyle = "#b45309";
  ctx.fillRect(col.x + 6, midY - 1.5, col.w - 12, 3);

  // 3. FELSŐ RÉSZ KIALAKÍTÁSA:
  // a) Felső gyári vezetékbevezető nyílás
  roundRect(ctx, col.x + 4, col.y + 2, col.w - 8, 6, 2);
  ctx.fillStyle = "#27272a";
  ctx.fill();

  // b) Felső gyári fix csavar (gyárilag meg van húzva, nem forgatható)
  const topScrewY = col.y + 19;
  ctx.beginPath();
  ctx.arc(cx, topScrewY, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#cbd5e1";
  ctx.fill();
  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - 3.5, topScrewY);
  ctx.lineTo(cx + 3.5, topScrewY);
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // c) Sorkapocs tetején lévő kis színes jelölőnégyzet (fekete, kék, zöld-sárga, piros vagy zöld)
  const markerX = col.x + 3;
  const markerY = col.y + 30;
  const markerW = col.w - 6;
  const markerH = 13;
  roundRect(ctx, markerX, markerY, markerW, markerH, 2);
  if (mark === "pe") {
    ctx.fillStyle = "#16a34a";
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, markerX, markerY, markerW / 2, markerH, 2);
    ctx.fillStyle = "#eab308";
    ctx.fill();
    ctx.restore();
  } else {
    let markCol = "#18181b";
    if (mark === "blue") markCol = "#2563eb";
    else if (mark === "red") markCol = "#dc2626";
    else if (mark === "green") markCol = "#16a34a";
    else if (mark === "yellow") markCol = "#eab308";
    else if (mark === "white") markCol = "#f8fafc";
    else if (mark === "brown") markCol = "#78350f";
    else if (mark === "grey") markCol = "#6b7280";
    ctx.fillStyle = markCol;
    ctx.fill();
  }
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 0.9;
  ctx.stroke();

  // 4. ALSÓ RÉSZ KIALAKÍTÁSA:
  // a) Felhasználói alsó csavar (csavarhúzóval meghúzható/lazítható)
  const userScrewY = col.y + 92;

  // Csavarhúzó hover kiemelő gyűrű a csavarfej körül
  if (isScrewdriverHover) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, userScrewY, 11, 0, Math.PI * 2);
    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 1.8;
    ctx.setLineDash([3, 2]);
    ctx.stroke();
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(cx, userScrewY, 7.5, 0, Math.PI * 2);
  ctx.fillStyle = isScrewdriverHover
    ? "#f8fafc"
    : port.tight
      ? "#cbd5e1"
      : "#e2e8f0";
  ctx.fill();
  ctx.strokeStyle = isScrewdriverHover
    ? "#0284c7"
    : port.tight
      ? "#475569"
      : "#64748b";
  ctx.lineWidth = isScrewdriverHover ? 1.5 : 1.2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, userScrewY, 5, 0, Math.PI * 2);
  ctx.fillStyle = port.tight ? "#94a3b8" : "#cbd5e1";
  ctx.fill();

  // Alsó csavarhorony: a felső gyárilag meghúzott csavarral megegyezően vízszintes (0) meghúzva,
  // laza (tight: false) állapotban 90 fokkal elforgatva (Math.PI / 2 / függőleges)
  ctx.save();
  ctx.translate(cx, userScrewY);
  ctx.rotate(port.tight ? 0 : Math.PI / 2);
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.lineTo(4, 0);
  ctx.stroke();
  ctx.restore();

  // b) Felhasználói alsó nyílás (wire clamp entry): ide köthet a felhasználó vezetéket
  const holeBottomY = col.y + 112;
  roundRect(ctx, col.x + 3.5, holeBottomY, col.w - 7, 20, 3);
  ctx.fillStyle = "#1e242c";
  ctx.fill();
  ctx.strokeStyle = isGeneralHover ? "#0284c7" : "#475569";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Belső réz rögzítőlemez (kengyel)
  // Meghúzva (tight: true) fent rögzít (holeBottomY + 3)
  // Lazítva (tight: false) lentebb áll (holeBottomY + 11), nyitott kengyelt jelezve
  const tongueY = port.tight ? holeBottomY + 3 : holeBottomY + 11;
  ctx.fillStyle = port.tight ? "#d97706" : "#f59e0b";
  ctx.fillRect(col.x + 5.5, tongueY, col.w - 11, 3);

  // Csak Debug módban írja ki a sorkapocs jelölését (Gyakorló módban SEMMI nem jelenik meg!)
  if (debug) {
    ctx.fillStyle = "#0284c7";
    ctx.font = "700 8.5px Segoe UI";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(port.label, cx, midY - 14);
  }

  ctx.restore();
}

function drawWago(
  ctx: CanvasRenderingContext2D,
  world: World,
  wago: World["wagos"][number],
  hoverPortId?: string,
  hoverWagoId?: string,
  draggedWagoId?: string,
) {
  const slots = wago.slots ?? (wago.portIds.length as 3 | 5);
  const w = 18 + wago.portIds.length * 24;
  const h = 66;
  const cx = wago.x + w / 2;
  const cy = wago.y + h / 2;
  const isDragging = draggedWagoId === wago.id;
  const hasWires = hasWagoWires(world, wago.id);
  const isHovered = hoverWagoId === wago.id && !wago.fixed && !hasWires;

  ctx.save();
  ctx.translate(cx, cy);
  if (wago.rotation) {
    ctx.rotate((wago.rotation * Math.PI) / 180);
  }
  ctx.translate(-cx, -cy);

  if (isDragging) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6;
  }

  roundRect(ctx, wago.x, wago.y, w, h, 6);
  ctx.fillStyle = isDragging
    ? "rgba(255, 255, 255, 0.98)"
    : "rgba(240, 242, 245, 0.96)";
  ctx.fill();
  ctx.strokeStyle = isDragging ? "#2563eb" : isHovered ? "#3b82f6" : wago.fixed ? "#64748b" : "#374151";
  ctx.lineWidth = isDragging || isHovered ? 2 : 1.3;
  ctx.stroke();

  // Internal busbar graphic
  ctx.fillStyle = "#d97706";
  ctx.fillRect(wago.x + 10, wago.y + 34, w - 20, 4);

  // Model text: WAGO 221-413 (3-as) or WAGO 221-415 (5-ös)
  const modelText = slots === 3 ? "WAGO 221-413" : "WAGO 221-415";
  ctx.fillStyle = "#111";
  ctx.font = "800 8.5px Segoe UI, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(modelText, wago.x + 8, wago.y + 13);

  // Rotate button in top-right corner if not fixed and not wired
  if (!wago.fixed && !hasWires) {
    const btnX = wago.x + w - 24;
    const btnY = wago.y + 3;
    roundRect(ctx, btnX, btnY, 20, 14, 3);
    ctx.fillStyle = isHovered ? "rgba(37, 99, 235, 0.15)" : "rgba(0, 0, 0, 0.04)";
    ctx.fill();
    ctx.strokeStyle = isHovered ? "#3b82f6" : "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = isHovered ? "#1d4ed8" : "#64748b";
    ctx.font = "bold 10px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("↻", btnX + 10, btnY + 7);
  }

  wago.portIds.forEach((pid, index) => {
    const port = world.ports[pid];
    if (!port) return;
    const closed = port.tight;
    const lx = wago.x + 8 + index * 24;
    const ly = wago.y + 18;
    const lw = 18;
    const lh = closed ? 14 : 26;

    // Lever
    ctx.fillStyle = hoverPortId === pid ? "#fb923c" : "#ea580c";
    roundRect(ctx, lx, ly, lw, lh, 2);
    ctx.fill();
    ctx.strokeStyle = "#9a3412";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Port hole at unrotated local coords (canvas rotation maps it exactly to world port.x, port.y)
    const localPx = wago.x + 18 + index * 24;
    const localPy = wago.y + 46;
    ctx.beginPath();
    ctx.arc(localPx, localPy, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = "#1f2937";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(localPx, localPy, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "#f59e0b";
    ctx.fill();
  });

  ctx.restore();
}

function drawWagoBoxes(
  ctx: CanvasRenderingContext2D,
  world: World,
  extras: RenderExtras,
) {
  const draggedWago = extras.draggedWagoId
    ? world.wagos.find((w) => w.id === extras.draggedWagoId)
    : undefined;
  const isDraggingEmptyWago =
    draggedWago && !draggedWago.fixed && !hasWagoWires(world, draggedWago.id);

  for (const box of WAGO_BOXES) {
    const isHovered = extras.hoverWagoBoxSlots === box.slots;
    ctx.save();

    // Box outer container (industrial parts tray / dispenser box on desk)
    roundRect(ctx, box.x, box.y, box.w, box.h, 6);
    ctx.fillStyle = isHovered && isDraggingEmptyWago
      ? "rgba(16, 185, 129, 0.28)"
      : isDraggingEmptyWago
        ? "rgba(16, 185, 129, 0.16)"
        : isHovered
          ? "#243247"
          : "#1e293b";
    ctx.fill();

    // Border
    if (isDraggingEmptyWago) {
      ctx.setLineDash([5, 3]);
      ctx.strokeStyle = isHovered ? "#10b981" : "#34d399";
      ctx.lineWidth = isHovered ? 2.5 : 1.8;
    } else {
      ctx.strokeStyle = isHovered ? "#38bdf8" : "#475569";
      ctx.lineWidth = isHovered ? 1.8 : 1.2;
    }
    ctx.stroke();

    // Header banner
    roundRect(ctx, box.x + 2, box.y + 2, box.w - 4, 22, 4);
    ctx.fillStyle = isDraggingEmptyWago
      ? isHovered ? "#065f46" : "#064e3b"
      : isHovered ? "#0284c7" : "#0f172a";
    ctx.fill();

    // Header title
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 10px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      isDraggingEmptyWago ? "⬇ VISSZADOBÁS" : box.title.toUpperCase(),
      box.x + box.w / 2,
      box.y + 16,
    );

    // Box body content
    if (isDraggingEmptyWago) {
      ctx.fillStyle = isHovered ? "#a7f3d0" : "#6ee7b7";
      ctx.font = "700 9px Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(isHovered ? "Engedd el itt a törléshez!" : "Húzd ide a törléshez", box.x + box.w / 2, box.y + 52);

      ctx.fillStyle = "#d1fae5";
      ctx.font = "800 20px Segoe UI, sans-serif";
      ctx.fillText("♻", box.x + box.w / 2, box.y + 78);
    } else {
      // Miniature preview of the Wago block in the box
      const previewW = 14 + box.slots * 16;
      const previewH = 38;
      const prevX = box.x + (box.w - previewW) / 2;
      const prevY = box.y + 32;

      roundRect(ctx, prevX, prevY, previewW, previewH, 4);
      ctx.fillStyle = "#f1f5f9";
      ctx.fill();
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Orange levers preview
      for (let s = 0; s < box.slots; s++) {
        const lx = prevX + 6 + s * 16;
        const ly = prevY + 6;
        roundRect(ctx, lx, ly, 10, 16, 2);
        ctx.fillStyle = "#ea580c";
        ctx.fill();
      }

      // Catalog number and hint
      ctx.fillStyle = "#94a3b8";
      ctx.font = "700 8.5px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`Typ ${box.code}`, box.x + box.w / 2, box.y + 86);
    }

    ctx.restore();
  }
}

function drawMotor(
  ctx: CanvasRenderingContext2D,
  device: Device,
  sim: SimState,
  extras?: RenderExtras,
) {
  const { x, y, w } = device.bounds;
  const motor = sim.motor;
  const isPhaseFault = motor?.mode === "phase_fault";
  const isRunning = motor?.mode === "star" || motor?.mode === "delta";
  const isCw = motor?.direction === "cw";
  const isCcw = motor?.direction === "ccw";

  // Vibration translation if in phase fault
  const vib = isPhaseFault ? Math.sin((extras?.motorVibration ?? Date.now()) * 0.05) * 2.5 : 0;

  ctx.save();
  ctx.translate(vib, 0);

  // 1. Digital Status Display & Banner above motor
  const dispX = x + 44;
  const dispY = y + 5;
  const dispW = w - 54;
  const dispH = 46;

  roundRect(ctx, dispX, dispY, dispW, dispH, 6);
  ctx.fillStyle = isPhaseFault
    ? "#3b0707"
    : motor?.mode === "star"
      ? "#022c22"
      : motor?.mode === "delta"
        ? "#451a03"
        : "#0f172a";
  ctx.fill();
  ctx.strokeStyle = isPhaseFault
    ? "#ef4444"
    : motor?.mode === "star"
      ? "#10b981"
      : motor?.mode === "delta"
        ? "#f59e0b"
        : "#334155";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Status text lines
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (motor?.mode === "star") {
    ctx.fillStyle = "#34d399";
    ctx.font = "800 12px Segoe UI";
    ctx.fillText(isCw ? "Y ↻ CSILLAG ÜZEM" : "Y ↺ CSILLAG ÜZEM", dispX + dispW / 2, dispY + 16);
    ctx.font = "700 10px monospace";
    ctx.fillStyle = "#a7f3d0";
    ctx.fillText(`I = 1.8 A • 1420 RPM • ${motor.peConnected ? "PE OK" : "⚠️ PE HIÁNYZIK!"}`, dispX + dispW / 2, dispY + 33);
  } else if (motor?.mode === "delta") {
    ctx.fillStyle = "#fbbf24";
    ctx.font = "800 12px Segoe UI";
    ctx.fillText(isCw ? "Δ ↻ DELTA ÜZEM" : "Δ ↺ DELTA ÜZEM", dispX + dispW / 2, dispY + 16);
    ctx.font = "700 10px monospace";
    ctx.fillStyle = "#fde68a";
    ctx.fillText(`I = 5.4 A • 1420 RPM • ${motor.peConnected ? "PE OK" : "⚠️ PE HIÁNYZIK!"}`, dispX + dispW / 2, dispY + 33);
  } else if (isPhaseFault) {
    ctx.fillStyle = "#f87171";
    ctx.font = "900 12px Segoe UI";
    ctx.fillText("⚡ FÁZISHIBA! ⚡", dispX + dispW / 2, dispY + 16);
    ctx.font = "700 9.5px monospace";
    ctx.fillStyle = "#fecaca";
    ctx.fillText("I = 8.5 A • 2 FÁZIS (LEÁLLT)", dispX + dispW / 2, dispY + 33);
  } else {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "800 11px Segoe UI";
    ctx.fillText("3~ ASZINKRON MOTOR", dispX + dispW / 2, dispY + 16);
    ctx.font = "700 10px monospace";
    ctx.fillStyle = "#64748b";
    ctx.fillText(`ÁLLAPOT: ÁLL (0.0 A) • ${motor?.peConnected ? "PE OK" : "PE HIÁNY"}`, dispX + dispW / 2, dispY + 33);
  }

  // Motor shadow on the wooden workbench
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x + 130, y + 246, 120, 14, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.fill();
  ctx.restore();

  // 2. Mounting brackets / feet
  const footY = y + 225;
  const footH = 22;
  const drawFoot = (fx: number, fw: number) => {
    roundRect(ctx, fx, footY, fw, footH, 4);
    ctx.fillStyle = "#334155";
    ctx.fill();
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Bolts
    ctx.beginPath();
    ctx.arc(fx + fw / 2, footY + footH / 2, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = "#94a3b8";
    ctx.fill();
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.stroke();
  };
  drawFoot(x + 12, 42);
  drawFoot(x + 155, 42);

  // 3. Cast iron cylindrical stator body
  const bodyX = x + 24;
  const bodyY = y + 68;
  const bodyW = 145;
  const bodyH = 158;

  // Stator shadow and gradient
  ctx.save();
  const bodyGrad = ctx.createLinearGradient(bodyX, bodyY, bodyX, bodyY + bodyH);
  bodyGrad.addColorStop(0, "#2c4a6f");
  bodyGrad.addColorStop(0.3, "#1e3a5f");
  bodyGrad.addColorStop(0.8, "#0f233d");
  bodyGrad.addColorStop(1, "#071322");

  roundRect(ctx, bodyX, bodyY, bodyW, bodyH, 10);
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.strokeStyle = isRunning ? "#38bdf8" : isPhaseFault ? "#ef4444" : "#1e293b";
  ctx.lineWidth = isRunning ? 2 : 1.5;
  ctx.stroke();

  // Cooling fins (8 horizontal ribs across stator body)
  for (let i = 0; i < 8; i++) {
    const finY = bodyY + 16 + i * 16;
    // Fin highlight line
    ctx.fillStyle = "#4b729f";
    ctx.fillRect(bodyX + 4, finY, bodyW - 8, 2.5);
    // Fin shadow groove
    ctx.fillStyle = "#071526";
    ctx.fillRect(bodyX + 4, finY + 2.5, bodyW - 8, 3.5);
  }

  // Lifting eye (emelőszem) on top of stator
  const eyeX = bodyX + bodyW / 2;
  const eyeY = bodyY - 2;
  ctx.beginPath();
  ctx.arc(eyeX, eyeY - 6, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#475569";
  ctx.fill();
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(eyeX, eyeY - 6, 4, 0, Math.PI * 2);
  ctx.fillStyle = "#c29c67"; // background OSB showing through hole
  ctx.fill();
  ctx.stroke();

  // Rating nameplate (adattábla) on stator
  const plateX = bodyX + 10;
  const plateY = bodyY + 68;
  const plateW = 76;
  const plateH = 46;
  roundRect(ctx, plateX, plateY, plateW, plateH, 3);
  ctx.fillStyle = "#e2e8f0";
  ctx.fill();
  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#0f172a";
  ctx.font = "800 6.5px Segoe UI";
  ctx.textAlign = "center";
  ctx.fillText("3~ MOT. • 50 Hz", plateX + plateW / 2, plateY + 10);
  ctx.font = "700 6px monospace";
  ctx.fillText("Y 400V 1.8A", plateX + plateW / 2, plateY + 21);
  ctx.fillText("Δ 400V 5.4A", plateX + plateW / 2, plateY + 30);
  ctx.fillText("0.75kW 1420rpm", plateX + plateW / 2, plateY + 39);

  // 4. Terminal Box (kapocsház) on the left
  const tbX = bodyX - 18;
  const tbY = bodyY + 30;
  const tbW = 38;
  const tbH = 68;
  roundRect(ctx, tbX, tbY, tbW, tbH, 5);
  ctx.fillStyle = "#1e293b";
  ctx.fill();
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Screws on terminal box
  ctx.fillStyle = "#64748b";
  ctx.fillRect(tbX + 4, tbY + 4, 3, 3);
  ctx.fillRect(tbX + tbW - 7, tbY + 4, 3, 3);
  ctx.fillRect(tbX + 4, tbY + tbH - 7, 3, 3);
  ctx.fillRect(tbX + tbW - 7, tbY + tbH - 7, 3, 3);

  // Warning lightning bolt on terminal box
  ctx.fillStyle = "#eab308";
  ctx.font = "900 13px Segoe UI";
  ctx.textAlign = "center";
  ctx.fillText("⚡", tbX + tbW / 2, tbY + 28);

  // PE Earth symbol and LED
  ctx.fillStyle = motor?.peConnected ? "#22c55e" : "#ef4444";
  ctx.beginPath();
  ctx.arc(tbX + tbW / 2, tbY + 52, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Cable gland (tömszelence) on terminal box top where black conduit enters
  const glandX = tbX + 10;
  const glandY = tbY - 10;
  roundRect(ctx, glandX, glandY, 18, 12, 2);
  ctx.fillStyle = "#d97706";
  ctx.fill();
  ctx.strokeStyle = "#92400e";
  ctx.lineWidth = 1;
  ctx.stroke();

  // 5. Front bearing end-shield (csapágypajzs) and cooling fan
  const shieldCx = bodyX + bodyW + 8;
  const shieldCy = bodyY + bodyH / 2;
  const shieldR = 56;

  ctx.beginPath();
  ctx.arc(shieldCx, shieldCy, shieldR, 0, Math.PI * 2);
  ctx.fillStyle = "#1e3a5f";
  ctx.fill();
  ctx.strokeStyle = isRunning ? "#38bdf8" : "#0f172a";
  ctx.lineWidth = isRunning ? 2.5 : 2;
  ctx.stroke();

  // Perimeter flange bolts
  for (let b = 0; b < 6; b++) {
    const bAngle = (b * Math.PI) / 3;
    const bx = shieldCx + Math.cos(bAngle) * (shieldR - 7);
    const by = shieldCy + Math.sin(bAngle) * (shieldR - 7);
    ctx.beginPath();
    ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#94a3b8";
    ctx.fill();
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // Recessed fan cavity
  ctx.beginPath();
  ctx.arc(shieldCx, shieldCy, shieldR - 14, 0, Math.PI * 2);
  ctx.fillStyle = "#090d16";
  ctx.fill();
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Rotating fan blades
  const motorAngle = extras?.motorAngle ?? 0;
  ctx.save();
  ctx.translate(shieldCx, shieldCy);
  ctx.rotate(motorAngle);

  // 6 curved fan blades
  for (let i = 0; i < 6; i++) {
    const bladeAngle = (i * Math.PI) / 3;
    ctx.save();
    ctx.rotate(bladeAngle);
    ctx.beginPath();
    ctx.moveTo(8, -3);
    ctx.quadraticCurveTo(24, -12, 36, -4);
    ctx.lineTo(36, 4);
    ctx.quadraticCurveTo(24, -4, 8, 3);
    ctx.closePath();
    ctx.fillStyle = isRunning ? "rgba(56, 189, 248, 0.75)" : "#475569";
    ctx.fill();
    ctx.strokeStyle = isRunning ? "#0284c7" : "#334155";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  // Center rotor shaft hub and keyway
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fillStyle = "#94a3b8";
  ctx.fill();
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Keyway slot
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(-2.5, -11, 5, 6);
  ctx.restore();

  // 6. Direction arrow overlay around shaft
  if (isRunning) {
    ctx.save();
    ctx.beginPath();
    const arrowR = shieldR - 8;
    if (isCw) {
      ctx.arc(shieldCx, shieldCy, arrowR, -Math.PI * 0.65, Math.PI * 0.45, false);
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 3.5;
      ctx.stroke();
      // Arrowhead CW
      const ax = shieldCx + Math.cos(Math.PI * 0.45) * arrowR;
      const ay = shieldCy + Math.sin(Math.PI * 0.45) * arrowR;
      ctx.beginPath();
      ctx.moveTo(ax - 2, ay - 6);
      ctx.lineTo(ax + 8, ay + 1);
      ctx.lineTo(ax - 2, ay + 8);
      ctx.fillStyle = "#22c55e";
      ctx.fill();
    } else if (isCcw) {
      ctx.arc(shieldCx, shieldCy, arrowR, Math.PI * 0.45, -Math.PI * 0.65, true);
      ctx.strokeStyle = "#06b6d4";
      ctx.lineWidth = 3.5;
      ctx.stroke();
      // Arrowhead CCW
      const ax = shieldCx + Math.cos(-Math.PI * 0.65) * arrowR;
      const ay = shieldCy + Math.sin(-Math.PI * 0.65) * arrowR;
      ctx.beginPath();
      ctx.moveTo(ax + 2, ay - 6);
      ctx.lineTo(ax - 8, ay + 1);
      ctx.lineTo(ax + 2, ay + 8);
      ctx.fillStyle = "#06b6d4";
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.restore(); // end of stator save
  ctx.restore(); // end of vibration save
}

function drawDevices(ctx: CanvasRenderingContext2D, world: World, sim: SimState, extras?: RenderExtras) {
  for (const device of world.devices) {
    const { x, y, w, h } = device.bounds;

    // 0. 3 fázisú villanymotor
    if (device.type === "motor_3p") {
      drawMotor(ctx, device, sim, extras);
      continue;
    }

    // 1. Három Izzó (Top-left ceiling fixtures)
    if (device.type === "lamp") {
      const lit = sim.lampOn.has(device.id);
      // Porcelain base
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, w / 2 - 2, 0, Math.PI * 2);
      ctx.fillStyle = "#f8fafc";
      ctx.fill();
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Glow behind illuminated bulb
      if (lit) {
        ctx.save();
        const glowGrad = ctx.createRadialGradient(x + w / 2, y + h / 2, 8, x + w / 2, y + h / 2, 80);
        glowGrad.addColorStop(0, "rgba(254, 240, 138, 0.95)");
        glowGrad.addColorStop(0.4, "rgba(250, 204, 21, 0.45)");
        glowGrad.addColorStop(1, "rgba(250, 204, 21, 0)");
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, 80, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Glass bulb
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, w / 2 - 10, 0, Math.PI * 2);
      ctx.fillStyle = lit ? "#fef08a" : "#cbd5e1";
      ctx.fill();
      ctx.strokeStyle = lit ? "#eab308" : "#94a3b8";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Label
      ctx.fillStyle = "#1e293b";
      ctx.font = "800 10px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText(device.title, x + w / 2, y + h + 14);
      continue;
    }

    // 2. ÁVK-k (rcd_3p és rcd_1p) a kiselosztóban
    if (device.type === "rcd_3p" || device.type === "rcd_1p") {
      const is3p = device.type === "rcd_3p";
      // Off-white modular casing
      roundRect(ctx, x, y, w, h, 4);
      ctx.fillStyle = "#f8fafc";
      ctx.fill();
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Top label
      ctx.fillStyle = "#0f172a";
      ctx.font = is3p ? "800 10px Segoe UI" : "800 9px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText(device.title, x + w / 2, y + 14);

      // Rating label
      ctx.fillStyle = "#64748b";
      ctx.font = "700 7.5px Segoe UI";
      ctx.fillText(is3p ? "40A IΔn 30mA" : "25A 30mA", x + w / 2, y + 23);

      // "T" Test button
      const btnX = x + 10;
      const btnY = y + 26;
      const btnW = 24;
      const btnH = 18;
      roundRect(ctx, btnX, btnY, btnW, btnH, 3);
      ctx.fillStyle = "#0284c7";
      ctx.fill();
      ctx.strokeStyle = "#0369a1";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "800 10.5px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText("T", btnX + btnW / 2, btnY + 13);

      // Test hint / schematic
      if (is3p) {
        ctx.fillStyle = "#475569";
        ctx.font = "700 7px monospace";
        ctx.textAlign = "left";
        ctx.fillText("TEST", btnX + btnW + 4, btnY + 8);
        ctx.fillText("~ 30mA", btnX + btnW + 4, btnY + 16);
      }

      // Optical status indicator window (Green: open/KI, Red: closed/BE)
      const indX = is3p ? x + w - 16 : x + w - 12;
      const indY = y + 28;
      roundRect(ctx, indX - 6, indY, 12, 6, 1.5);
      ctx.fillStyle = device.on ? "#dc2626" : "#16a34a";
      ctx.fill();
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Main lever handle
      const leverOn = device.on;
      const leverX = x + 6;
      const leverY = y + 48;
      const leverW = w - 12;
      const leverH = 46;

      roundRect(ctx, leverX, leverY, leverW, leverH, 3);
      ctx.fillStyle = leverOn ? "#dc2626" : "#334155";
      ctx.fill();
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#fff";
      ctx.font = "800 10px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText(leverOn ? "BE" : "KI", x + w / 2, leverY + 28);
      continue;
    }

    // 2. 3P C16A Megszakító (inside enclosure)
    if (device.type === "mcb3p") {
      roundRect(ctx, x, y, w, h, 4);
      ctx.fillStyle = "#f8fafc";
      ctx.fill();
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = "#111";
      ctx.font = "800 10.5px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText("3P C16A", x + w / 2, y + 15);

      const leverOn = device.on;
      ctx.fillStyle = leverOn ? "#dc2626" : "#334155";
      roundRect(ctx, x + 10, y + 36, w - 20, 50, 3);
      ctx.fill();
      ctx.strokeStyle = "#0f172a";
      ctx.stroke();

      ctx.fillStyle = "#fff";
      ctx.font = "800 11px Segoe UI";
      ctx.fillText(leverOn ? "BE" : "KI", x + w / 2, y + 66);
      continue;
    }

    // 3. 1P MCB (B10A, B16A)
    if (device.type === "mcb" || device.type === "mcb1p") {
      roundRect(ctx, x, y, w, h, 4);
      ctx.fillStyle = "#f8fafc";
      ctx.fill();
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = "#111";
      ctx.font = "800 9px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText(device.title.split(" ").at(-1) ?? "B10", x + w / 2, y + 15);

      const leverOn = device.on;
      ctx.fillStyle = leverOn ? "#dc2626" : "#334155";
      roundRect(ctx, x + 4, y + 36, w - 8, 50, 3);
      ctx.fill();
      ctx.strokeStyle = "#0f172a";
      ctx.stroke();

      ctx.fillStyle = "#fff";
      ctx.font = "800 9.5px Segoe UI";
      ctx.fillText(leverOn ? "BE" : "KI", x + w / 2, y + 66);
      continue;
    }

    // 4. Impulzusrelé
    if (device.type === "impulse_relay") {
      roundRect(ctx, x, y, w, h, 4);
      ctx.fillStyle = "#e2e8f0";
      ctx.fill();
      ctx.strokeStyle = "#1e293b";
      ctx.stroke();

      ctx.fillStyle = "#0f172a";
      ctx.font = "800 9px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText("IMPULZUS", x + w / 2, y + 14);

      // Status LED
      const active = !!device.relayState;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + 36, 6, 0, Math.PI * 2);
      ctx.fillStyle = active ? "#22c55e" : "#64748b";
      ctx.fill();
      ctx.stroke();

      // Manual test button
      roundRect(ctx, x + 6, y + 56, w - 12, 32, 3);
      ctx.fillStyle = "#94a3b8";
      ctx.fill();
      ctx.strokeStyle = "#334155";
      ctx.stroke();
      ctx.fillStyle = "#0f172a";
      ctx.font = "700 8.5px Segoe UI";
      ctx.fillText("KÉZI", x + w / 2, y + 70);
      ctx.fillText(active ? "ZÁRVA" : "NYITVA", x + w / 2, y + 82);
      continue;
    }

    // 5. Lépcsőházi automata
    if (device.type === "staircase_relay") {
      roundRect(ctx, x, y, w, h, 4);
      ctx.fillStyle = "#e2e8f0";
      ctx.fill();
      ctx.strokeStyle = "#1e293b";
      ctx.stroke();

      ctx.fillStyle = "#0f172a";
      ctx.font = "800 9px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText("LÉPCSŐH.", x + w / 2, y + 14);

      const rem = device.timerRemaining ?? 0;
      const running = rem > 0;

      // Timer display
      roundRect(ctx, x + 4, y + 26, w - 8, 22, 3);
      ctx.fillStyle = running ? "#0f172a" : "#475569";
      ctx.fill();
      ctx.fillStyle = running ? "#38bdf8" : "#94a3b8";
      ctx.font = "800 11px monospace";
      ctx.fillText(running ? `${rem.toFixed(1)}s` : "KÉSZ", x + w / 2, y + 41);

      // Button
      roundRect(ctx, x + 6, y + 56, w - 12, 32, 3);
      ctx.fillStyle = running ? "#fef08a" : "#cbd5e1";
      ctx.fill();
      ctx.strokeStyle = "#475569";
      ctx.stroke();
      ctx.fillStyle = "#0f172a";
      ctx.font = "700 8.5px Segoe UI";
      ctx.fillText("B TESZT", x + w / 2, y + 76);
      continue;
    }

    // 6. Időrelé
    if (device.type === "timer_relay") {
      roundRect(ctx, x, y, w, h, 4);
      ctx.fillStyle = "#e2e8f0";
      ctx.fill();
      ctx.strokeStyle = "#1e293b";
      ctx.stroke();

      ctx.fillStyle = "#0f172a";
      ctx.font = "800 9px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText("IDŐRELÉ", x + w / 2, y + 14);

      const rem = device.timerRemaining ?? 3.0;
      const powered = !!device.energized;
      const switched = !!device.relayState;

      roundRect(ctx, x + 4, y + 26, w - 8, 24, 3);
      ctx.fillStyle = powered ? "#0f172a" : "#475569";
      ctx.fill();
      ctx.fillStyle = switched ? "#4ade80" : powered ? "#facc15" : "#94a3b8";
      ctx.font = "800 10.5px monospace";
      ctx.fillText(switched ? "NO 18" : powered ? `${rem.toFixed(1)}s` : "NC 16", x + w / 2, y + 42);

      ctx.fillStyle = "#334155";
      ctx.font = "700 8.5px Segoe UI";
      ctx.fillText(switched ? "15-18 ZÁRT" : "15-16 ZÁRT", x + w / 2, y + 72);
      ctx.fillText("3s KÉSL.", x + w / 2, y + 86);
      continue;
    }

    // 7. Motorvédő kapcsoló
    if (device.type === "motor_protector") {
      roundRect(ctx, x, y, w, h, 4);
      ctx.fillStyle = "#f1f5f9";
      ctx.fill();
      ctx.strokeStyle = "#1e293b";
      ctx.stroke();

      ctx.fillStyle = "#0f172a";
      ctx.font = "800 9px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText("MOTORVÉDŐ", x + w / 2, y + 14);

      const on = device.on;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + 46, 18, 0, Math.PI * 2);
      ctx.fillStyle = "#1e293b";
      ctx.fill();

      ctx.save();
      ctx.translate(x + w / 2, y + 46);
      ctx.rotate(on ? 0 : -Math.PI / 4);
      ctx.fillStyle = on ? "#22c55e" : "#ef4444";
      roundRect(ctx, -5, -16, 10, 32, 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = "#0f172a";
      ctx.font = "800 9px Segoe UI";
      ctx.fillText(on ? "I (BE)" : "O (KI)", x + w / 2, y + 80);
      continue;
    }

    // 8. Mágneskapcsolók MK1, MK2, MK3 (Mounted on top DIN rail)
    if (device.type === "contactor") {
      roundRect(ctx, x, y, w, h, 6);
      ctx.fillStyle = device.energized ? "#dcfce7" : "#f3f4f6";
      ctx.fill();
      ctx.strokeStyle = "#1f2937";
      ctx.lineWidth = 1.3;
      ctx.stroke();

      ctx.fillStyle = "#111827";
      ctx.font = "800 13px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText(device.title, x + w / 2, y + 16);

      // Central plunger window
      ctx.fillStyle = device.energized ? "#15803d" : "#4b5563";
      roundRect(ctx, x + 16, y + 24, w - 32, 20, 3);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 9.5px Segoe UI";
      ctx.fillText(device.energized ? "BEHÚZVA" : "NYUGALOM", x + w / 2, y + 38);

      ctx.fillStyle = "#374151";
      ctx.font = "700 8.5px Segoe UI";
      ctx.fillText("L1..L3 • 13-14 NO", x + w / 2, y + 62);
      ctx.fillText("21-22 NC • A1-A2", x + w / 2, y + 78);
      continue;
    }

    // 9. Mozgásérzékelő (PIR sensor)
    if (device.type === "motion_sensor") {
      roundRect(ctx, x, y, w, h, 8);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      const active = sim.activeDevices.has(device.id);

      // PIR Dome at bottom
      ctx.beginPath();
      ctx.arc(x + w / 2, y + 42, 22, 0, Math.PI * 2);
      ctx.fillStyle = active ? "#fef08a" : "#f1f5f9";
      ctx.fill();
      ctx.strokeStyle = "#cbd5e1";
      ctx.stroke();

      for (let r = 5; r <= 15; r += 5) {
        ctx.beginPath();
        ctx.arc(x + w / 2, y + 42, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      roundRect(ctx, x + 8, y + 74, w - 16, 22, 3);
      ctx.fillStyle = active ? "#86efac" : "#e2e8f0";
      ctx.fill();
      ctx.strokeStyle = "#475569";
      ctx.stroke();

      ctx.fillStyle = "#0f172a";
      ctx.font = "800 8.5px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText(active ? "MOZGÁS AKTÍV" : "MOZGÁS TESZT", x + w / 2, y + 88);
      continue;
    }

    // 10. Dugaszolóaljzat (Schuko socket)
    if (device.type === "socket") {
      roundRect(ctx, x, y, w, h, 8);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Recessed circle
      ctx.beginPath();
      ctx.arc(x + w / 2, y + 36, 24, 0, Math.PI * 2);
      ctx.fillStyle = "#f1f5f9";
      ctx.fill();
      ctx.strokeStyle = "#cbd5e1";
      ctx.stroke();

      // Pin holes
      ctx.beginPath();
      ctx.arc(x + w / 2 - 9, y + 36, 3.5, 0, Math.PI * 2);
      ctx.arc(x + w / 2 + 9, y + 36, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#1e293b";
      ctx.fill();

      // Earth clips
      ctx.fillStyle = "#cbd5e1";
      ctx.fillRect(x + w / 2 - 3, y + 14, 6, 5);
      ctx.fillRect(x + w / 2 - 3, y + 53, 6, 5);

      // UNI-T vizsgáló módban finom mérőpont-segédgyűrűk a dugalj furatain és PE rugóin
      if (extras?.tool === "tester") {
        ctx.save();
        ctx.strokeStyle = "rgba(14, 165, 233, 0.75)";
        ctx.lineWidth = 1.3;
        ctx.setLineDash([2, 2]);
        for (const pt of [
          { px: x + w / 2 - 9, py: y + 36 },
          { px: x + w / 2 + 9, py: y + 36 },
          { px: x + w / 2, py: y + 16.5 },
          { px: x + w / 2, py: y + 55.5 },
        ]) {
          ctx.beginPath();
          ctx.arc(pt.px, pt.py, 5.5, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      const active = sim.activeDevices.has(device.id);
      ctx.fillStyle = active ? "#16a34a" : "#64748b";
      ctx.font = "800 9px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText("DUGALJ", x + w / 2, y + 72);
      continue;
    }

    // 11. Csillárkapcsoló 105 (Két különálló billentyű)
    if (device.type === "switch_105") {
      roundRect(ctx, x, y, w, h, 8);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      const hw = (w - 18) / 2;
      // Rocker 1 (Left)
      roundRect(ctx, x + 6, y + 10, hw, 46, 3);
      ctx.fillStyle = device.on ? "#e2e8f0" : "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#cbd5e1";
      ctx.stroke();
      ctx.fillStyle = "#0f172a";
      ctx.font = "800 9px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText(device.on ? "BE" : "KI", x + 6 + hw / 2, y + 36);

      // Rocker 2 (Right)
      roundRect(ctx, x + 12 + hw, y + 10, hw, 46, 3);
      ctx.fillStyle = device.on2 ? "#e2e8f0" : "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#cbd5e1";
      ctx.stroke();
      ctx.fillStyle = "#0f172a";
      ctx.fillText(device.on2 ? "BE" : "KI", x + 12 + hw + hw / 2, y + 36);

      ctx.font = "800 8.5px Segoe UI";
      ctx.fillStyle = "#475569";
      ctx.fillText("105 CSILLÁR", x + w / 2, y + 70);
      continue;
    }

    // 12. Kapcsolók (101, 102, 106, 107)
    if (
      device.type === "switch" ||
      device.type === "switch_101" ||
      device.type === "switch_102" ||
      device.type === "switch_106" ||
      device.type === "switch_107"
    ) {
      roundRect(ctx, x, y, w, h, 8);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      roundRect(ctx, x + 10, y + 10, w - 20, 46, 4);
      ctx.fillStyle = device.on ? "#cbd5e1" : "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#94a3b8";
      ctx.stroke();

      ctx.fillStyle = "#0f172a";
      ctx.font = "800 11px Segoe UI";
      ctx.textAlign = "center";
      let posText = device.on ? "BE" : "KI";
      if (device.type === "switch_106") posText = device.on ? "1-2" : "1-3";
      if (device.type === "switch_107") posText = device.on ? "KERESZT" : "EGYENES";
      ctx.fillText(posText, x + w / 2, y + 38);

      ctx.font = "800 8.5px Segoe UI";
      ctx.fillStyle = "#475569";
      ctx.fillText(device.title, x + w / 2, y + 70);
      continue;
    }

    // 13. Nyomókapcsoló 101N
    if (device.type === "push_switch_101n") {
      roundRect(ctx, x, y, w, h, 8);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      roundRect(ctx, x + 10, y + 10, w - 20, 46, 4);
      ctx.fillStyle = device.pressed ? "#94a3b8" : "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#94a3b8";
      ctx.stroke();

      ctx.fillStyle = "#0f172a";
      ctx.font = "800 9.5px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText(device.pressed ? "LENYOMVA" : "101N", x + w / 2, y + 36);

      ctx.font = "800 8.5px Segoe UI";
      ctx.fillStyle = "#475569";
      ctx.fillText(device.title, x + w / 2, y + 70);
      continue;
    }

    // 14. Ipari nyomógombok (Industrial black button boxes)
    if (device.type === "button" || device.type === "button_no" || device.type === "button_nc") {
      const isNc = device.type === "button_nc" || device.subType === "nc";
      roundRect(ctx, x, y, w, h, 6);
      ctx.fillStyle = "#1e293b";
      ctx.fill();
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Button cap
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2 - 4, device.pressed ? 17 : 20, 0, Math.PI * 2);
      ctx.fillStyle = isNc ? "#dc2626" : "#16a34a";
      ctx.fill();
      ctx.strokeStyle = isNc ? "#991b1b" : "#15803d";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "800 10px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText(isNc ? "NC" : "NO", x + w / 2, y + h / 2);

      ctx.font = "700 8px Segoe UI";
      ctx.fillStyle = "#cbd5e1";
      ctx.fillText(device.title, x + w / 2, y + h - 5);
      continue;
    }
  }
}

function drawLooseHint(ctx: CanvasRenderingContext2D, point: Point) {
  ctx.beginPath();
  ctx.arc(point.x, point.y, 6.5, 0, Math.PI * 2);
  ctx.fillStyle = "#c25e1a";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ff9a3c";
  ctx.stroke();
}

function drawWorkbenchSpools(ctx: CanvasRenderingContext2D, extras: RenderExtras) {
  const rack = WORKBENCH_SPOOL_RACK_BOUNDS;
  const activeColor = extras.tool === "wire" ? (extras.wireColor ?? "L1") : undefined;

  ctx.save();

  // Állvány alapárnyék az asztallapon
  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  roundRect(ctx, rack.x + 2, rack.y + rack.h - 14, rack.w - 4, 16, 6);
  ctx.fill();

  // Fém kábeldob-tartó állvány keret (alsó sín, felső vezetőrúd és 3 tartóláb)
  ctx.fillStyle = "#1e293b";
  roundRect(ctx, rack.x, rack.y + rack.h - 18, rack.w, 12, 4);
  ctx.fill();
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Felső vezetékvezető keresztrúd
  roundRect(ctx, rack.x + 6, rack.y + 8, rack.w - 12, 7, 3);
  ctx.fillStyle = "#334155";
  ctx.fill();
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Központi krómozott acéltengely a dobokon át
  const axleY = rack.y + 80;
  ctx.fillStyle = "#cbd5e1";
  ctx.fillRect(rack.x + 4, axleY - 4, rack.w - 8, 8);
  ctx.fillStyle = "#64748b";
  ctx.fillRect(rack.x + 4, axleY + 1, rack.w - 8, 3);

  // Bal, középső (szabványos / kiegészítő elválasztó) és jobb tartókonzol
  for (const postX of [rack.x + 4, 330, rack.x + rack.w - 12]) {
    roundRect(ctx, postX, rack.y + 6, 8, rack.h - 14, 3);
    ctx.fillStyle = "#334155";
    ctx.fill();
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(postX + 4, axleY, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#94a3b8";
    ctx.fill();
  }

  const spoolPalette: Record<
    WireColorId,
    { fill: string; highlight: string; groove: string }
  > = {
    L1: { fill: "#181a1f", highlight: "#525866", groove: "#090a0d" },
    N: { fill: "#1d5fb0", highlight: "#60a5fa", groove: "#172554" },
    PE: { fill: "#16a34a", highlight: "#facc15", groove: "#14532d" },
    L2: { fill: "#783f19", highlight: "#b46936", groove: "#451a03" },
    L3: { fill: "#7d8590", highlight: "#cbd5e1", groove: "#334155" },
    CTRL: { fill: "#dc2626", highlight: "#fca5a5", groove: "#7f1d1d" },
  };

  for (const spool of WORKBENCH_SPOOLS) {
    const isActive = activeColor === spool.color;
    const isHovered = extras.hoverSpoolColor === spool.color;
    const pal = spoolPalette[spool.color];
    const cx = spool.x + spool.w / 2;

    ctx.save();

    // Aktív vagy hover kiemelő keret
    if (isActive || isHovered) {
      roundRect(ctx, spool.x - 2, spool.y - 4, spool.w + 4, spool.h + 6, 8);
      ctx.fillStyle = isActive
        ? "rgba(250, 204, 21, 0.16)"
        : "rgba(56, 189, 248, 0.14)";
      ctx.fill();
      ctx.strokeStyle = isActive ? "#facc15" : "#38bdf8";
      ctx.lineWidth = isActive ? 2.2 : 1.6;
      if (!isActive) ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Felső kivezető gyűrű és felfelé kilógó vezetékvég (aktív tekercsnél magasabbra kihúzva!)
    const guideY = rack.y + 11.5;
    const tipY = isActive ? spool.y - 21 : spool.y - 9;
    const tipX = cx + (isActive ? 6 : 3);

    // Szigetelt vezetékszakasz a dobtól a kivezető gyűrűn át
    ctx.beginPath();
    ctx.moveTo(cx, spool.y + 34);
    ctx.quadraticCurveTo(cx - 3, guideY + 6, tipX, tipY + 7);
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.strokeStyle = pal.fill;
    ctx.stroke();

    if (spool.color === "PE") {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.restore();
    } else if (spool.color === "L1") {
      ctx.beginPath();
      ctx.moveTo(cx - 1, spool.y + 34);
      ctx.quadraticCurveTo(cx - 4, guideY + 6, tipX - 1, tipY + 7);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = pal.highlight;
      ctx.stroke();
    }

    // Blankolt csillogó réz ér a vezeték csúcsán
    ctx.beginPath();
    ctx.moveTo(tipX, tipY + 7);
    ctx.lineTo(tipX + 1.5, tipY);
    ctx.lineWidth = 2.8;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#fbbf24";
    ctx.stroke();

    // Porcelán/fém vezetőgyűrű a felső rúdon
    ctx.beginPath();
    ctx.arc(cx, guideY, 4.2, 0, Math.PI * 2);
    ctx.fillStyle = "#0f172a";
    ctx.fill();
    ctx.strokeStyle = isActive ? "#facc15" : "#94a3b8";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Kábeldob test (bal és jobb peremkorong + feltekercselt vezetékmag)
    const drumX = spool.x + 8;
    const drumY = spool.y + 26;
    const drumW = spool.w - 16;
    const drumH = 88;

    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.36)";
    ctx.shadowBlur = 7;
    ctx.shadowOffsetY = 3;

    // Feltekercselt vezetékmag
    roundRect(ctx, drumX, drumY + 4, drumW, drumH - 8, 4);
    ctx.fillStyle = pal.fill;
    ctx.fill();
    ctx.restore();

    // Tekercsmenetek textúrája
    const strandCount = 6;
    const strandW = drumW / strandCount;
    for (let s = 0; s < strandCount; s++) {
      const sx = drumX + s * strandW;
      if (spool.color === "PE") {
        // Zöld-sárga sávos menetek
        ctx.fillStyle = "#facc15";
        ctx.fillRect(sx + 0.5, drumY + 14, strandW - 1, 12);
        ctx.fillRect(sx + 0.5, drumY + 38, strandW - 1, 12);
        ctx.fillRect(sx + 0.5, drumY + 62, strandW - 1, 12);
      }
      // Menet árnyékbarázda
      ctx.strokeStyle = pal.groove;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, drumY + 5);
      ctx.lineTo(sx, drumY + drumH - 5);
      ctx.stroke();
    }

    // Hengeres csillanás a tekercs közepén
    roundRect(ctx, drumX + 2, drumY + 22, drumW - 4, 9, 3);
    ctx.fillStyle =
      spool.color === "PE" ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.18)";
    ctx.fill();
    if (spool.color === "L1") {
      roundRect(ctx, drumX + 2, drumY + 23, drumW - 4, 5, 2);
      ctx.fillStyle = "rgba(148, 163, 184, 0.28)";
      ctx.fill();
    }

    // Bal és jobb oldali műanyag dobperem (flange)
    for (const fx of [spool.x + 3, spool.x + spool.w - 9]) {
      roundRect(ctx, fx, drumY, 6, drumH, 2.5);
      ctx.fillStyle = isActive ? "#475569" : "#27272a";
      ctx.fill();
      ctx.strokeStyle = isActive ? "#facc15" : "#09090b";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Alsó színjelző gyűrű / aktív LED pont az állvány talpán (szöveg nélkül!)
    const dotY = spool.y + spool.h - 2;
    ctx.beginPath();
    ctx.arc(cx, dotY, isActive ? 4.5 : 3.2, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? "#facc15" : pal.fill === "#181a1f" ? "#334155" : pal.fill;
    ctx.fill();
    ctx.strokeStyle = isActive ? "#ffffff" : "#0f172a";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  ctx.restore();
}

function traceGlovePath(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.beginPath();
  ctx.moveTo(cx - 12, cy + 36);
  ctx.lineTo(cx - 13, cy + 12);
  ctx.lineTo(cx - 21, cy + 2);
  ctx.bezierCurveTo(cx - 24, cy - 2, cx - 22, cy - 8, cx - 17, cy - 9);
  ctx.bezierCurveTo(cx - 14, cy - 9, cx - 12, cy - 6, cx - 10, cy - 2);
  ctx.lineTo(cx - 10, cy - 26);
  ctx.arc(cx - 6.5, cy - 26, 3.5, Math.PI, 0, false);
  ctx.lineTo(cx - 3, cy - 10);
  ctx.lineTo(cx - 2.5, cy - 31);
  ctx.arc(cx + 1.2, cy - 31, 3.7, Math.PI, 0, false);
  ctx.lineTo(cx + 5, cy - 10);
  ctx.lineTo(cx + 5.5, cy - 27);
  ctx.arc(cx + 9, cy - 27, 3.5, Math.PI, 0, false);
  ctx.lineTo(cx + 12.5, cy - 7);
  ctx.lineTo(cx + 13.5, cy - 19);
  ctx.arc(cx + 16.8, cy - 19, 3.2, Math.PI, 0, false);
  ctx.lineTo(cx + 18.5, cy + 14);
  ctx.quadraticCurveTo(cx + 18, cy + 28, cx + 13, cy + 36);
  ctx.closePath();
}

function drawWorkbenchTools(ctx: CanvasRenderingContext2D, extras: RenderExtras) {
  const mat = WORKBENCH_TOOL_MAT_BOUNDS;

  ctx.save();

  // Gumírozott VDE szerszám-alátét az asztallapon
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 9;
  ctx.shadowOffsetY = 3;
  roundRect(ctx, mat.x, mat.y, mat.w, mat.h, 9);
  ctx.fillStyle = "#181d26";
  ctx.fill();
  ctx.restore();

  roundRect(ctx, mat.x, mat.y, mat.w, mat.h, 9);
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Elválasztó vonalak a 3 szerszámhely között
  ctx.strokeStyle = "rgba(71, 85, 105, 0.5)";
  ctx.lineWidth = 1;
  for (const divX of [602.5, 661.5]) {
    ctx.beginPath();
    ctx.moveTo(divX, mat.y + 8);
    ctx.lineTo(divX, mat.y + mat.h - 8);
    ctx.stroke();
  }

  for (const slot of WORKBENCH_TOOLS) {
    const inHand = extras.tool === slot.tool;
    const isHovered = extras.hoverWorkbenchTool === slot.tool;
    const cx = slot.x + slot.w / 2;
    const cy = slot.y + slot.h / 2 + 2;

    ctx.save();

    // Fészek / hover keret
    if (inHand || isHovered) {
      roundRect(ctx, slot.x + 1, slot.y + 1, slot.w - 2, slot.h - 2, 7);
      ctx.fillStyle = inHand
        ? "rgba(250, 204, 21, 0.07)"
        : "rgba(56, 189, 248, 0.12)";
      ctx.fill();
      ctx.strokeStyle = inHand ? "rgba(250, 204, 21, 0.65)" : "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.setLineDash(inHand ? [4, 3] : []);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (slot.tool === "hand") {
      // 1. Halvány sziluett az alátéten (ha kézben van a szerszám, csak ez látszik!)
      ctx.save();
      traceGlovePath(ctx, cx, cy - 2);
      ctx.fillStyle = "rgba(148, 163, 184, 0.14)";
      ctx.fill();
      ctx.setLineDash([3, 2.5]);
      ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();

      if (!inHand) {
        // Fizikai szerelőkesztyű az asztalon
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 3;
        traceGlovePath(ctx, cx, cy - 2);
        ctx.fillStyle = "#e2e8f0";
        ctx.fill();
        ctx.restore();

        traceGlovePath(ctx, cx, cy - 2);
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 1.3;
        ctx.stroke();

        // Narancs nitril csúszásgátló tenyérbetét
        roundRect(ctx, cx - 9, cy - 6, 22, 26, 6);
        ctx.fillStyle = "#ea580c";
        ctx.fill();

        // Gumírozott csuklópánt
        roundRect(ctx, cx - 12.5, cy + 28, 26, 12, 3);
        ctx.fillStyle = "#334155";
        ctx.fill();
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }
    } else if (slot.tool === "screwdriver") {
      // 2. VDE Csavarhúzó sziluett + fizikai szerszám
      ctx.save();
      roundRect(ctx, cx - 9, cy - 52, 18, 46, 6);
      ctx.fillStyle = "rgba(148, 163, 184, 0.14)";
      ctx.fill();
      ctx.setLineDash([3, 2.5]);
      ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.rect(cx - 3, cy - 6, 6, 52);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      if (!inHand) {
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.48)";
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 3;
        // Sárga-piros VDE markolat
        roundRect(ctx, cx - 8.5, cy - 52, 17, 44, 6);
        ctx.fillStyle = "#eab308";
        ctx.fill();
        ctx.restore();

        roundRect(ctx, cx - 8.5, cy - 52, 17, 44, 6);
        ctx.strokeStyle = "#854d0e";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Piros betét a markolaton + ujjvédő perem
        roundRect(ctx, cx - 5.5, cy - 42, 11, 24, 3.5);
        ctx.fillStyle = "#dc2626";
        ctx.fill();
        roundRect(ctx, cx - 11, cy - 11, 22, 5, 2);
        ctx.fillStyle = "#dc2626";
        ctx.fill();

        // Piros VDE szigetelt szár
        roundRect(ctx, cx - 3, cy - 6, 6, 38, 1.5);
        ctx.fillStyle = "#dc2626";
        ctx.fill();
        ctx.strokeStyle = "#7f1d1d";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Edzett acél lapos pengehegy
        ctx.beginPath();
        ctx.moveTo(cx - 2.6, cy + 32);
        ctx.lineTo(cx + 2.6, cy + 32);
        ctx.lineTo(cx + 1.8, cy + 46);
        ctx.lineTo(cx - 1.8, cy + 46);
        ctx.closePath();
        ctx.fillStyle = "#cbd5e1";
        ctx.fill();
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }
    } else if (slot.tool === "cutter") {
      // 3. VDE Oldalcsípőfogó sziluett + fizikai szerszám
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy - 50);
      ctx.lineTo(cx - 13, cy - 22);
      ctx.lineTo(cx - 18, cy + 44);
      ctx.lineTo(cx - 7, cy + 46);
      ctx.lineTo(cx, cy - 6);
      ctx.lineTo(cx + 7, cy + 46);
      ctx.lineTo(cx + 18, cy + 44);
      ctx.lineTo(cx + 13, cy - 22);
      ctx.closePath();
      ctx.fillStyle = "rgba(148, 163, 184, 0.14)";
      ctx.fill();
      ctx.setLineDash([3, 2.5]);
      ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();

      if (!inHand) {
        // Acél vágópofák fent
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 3;

        ctx.beginPath();
        ctx.moveTo(cx - 1, cy - 48);
        ctx.quadraticCurveTo(cx - 12, cy - 38, cx - 10, cy - 18);
        ctx.lineTo(cx - 0.5, cy - 18);
        ctx.closePath();
        ctx.fillStyle = "#cbd5e1";
        ctx.fill();
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 1.1;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx + 1, cy - 48);
        ctx.quadraticCurveTo(cx + 12, cy - 38, cx + 10, cy - 18);
        ctx.lineTo(cx + 0.5, cy - 18);
        ctx.closePath();
        ctx.fillStyle = "#94a3b8";
        ctx.fill();
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 1.1;
        ctx.stroke();

        // Bal és jobb ívelt VDE szigetelt markolatszár (piros-sárga)
        for (const dir of [-1, 1] as const) {
          ctx.beginPath();
          ctx.moveTo(cx + dir * 3, cy - 16);
          ctx.quadraticCurveTo(cx + dir * 16, cy + 8, cx + dir * 17, cy + 44);
          ctx.lineTo(cx + dir * 8, cy + 45);
          ctx.quadraticCurveTo(cx + dir * 7, cy + 12, cx + dir * 1, cy - 8);
          ctx.closePath();
          ctx.fillStyle = "#dc2626";
          ctx.fill();
          ctx.strokeStyle = "#7f1d1d";
          ctx.lineWidth = 1.1;
          ctx.stroke();

          // Sárga VDE csúszásgátló betét a szárakon
          ctx.beginPath();
          ctx.moveTo(cx + dir * 7, cy - 4);
          ctx.lineTo(cx + dir * 13, cy + 16);
          ctx.lineTo(cx + dir * 9, cy + 18);
          ctx.lineTo(cx + dir * 4, cy - 2);
          ctx.closePath();
          ctx.fillStyle = "#facc15";
          ctx.fill();
        }
        ctx.restore();

        // Csuklószegecs
        ctx.beginPath();
        ctx.arc(cx, cy - 18, 4.8, 0, Math.PI * 2);
        ctx.fillStyle = "#475569";
        ctx.fill();
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  ctx.restore();
}

function drawWorkbenchLegendSheet(ctx: CanvasRenderingContext2D, extras: RenderExtras) {
  const b = WORKBENCH_LEGEND_SHEET_BOUNDS;
  const hovered = !!extras.hoverLegendSheet;

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.32)";
  ctx.shadowBlur = hovered ? 10 : 6;
  ctx.shadowOffsetY = 3;

  roundRect(ctx, b.x, b.y, b.w, b.h, 5);
  ctx.fillStyle = hovered ? "#ffffff" : "#f8fafc";
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = hovered ? "#0284c7" : "#64748b";
  ctx.lineWidth = hovered ? 2.2 : 1.2;
  ctx.stroke();

  // Fejléc sáv
  roundRect(ctx, b.x + 3, b.y + 3, b.w - 6, 18, 3);
  ctx.fillStyle = hovered ? "#0284c7" : "#1e293b";
  ctx.fill();

  // Miniatűr sorkapocs-színcsík mátrix (X1 és X2 vizuális előnézet szöveghalom nélkül)
  const miniColors = [
    "#2563eb",
    "#eab308",
    "#eab308",
    "#eab308",
    "#16a34a",
    "#dc2626",
    "#78350f",
    "#18181b",
    "#2563eb",
    "#dc2626",
  ];
  for (const rowY of [b.y + 30, b.y + 64]) {
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x + 10, rowY, b.w - 20, 24);
    const cellW = (b.w - 20) / miniColors.length;
    miniColors.forEach((col, idx) => {
      const cx = b.x + 10 + idx * cellW;
      ctx.strokeStyle = "#e2e8f0";
      ctx.strokeRect(cx, rowY, cellW, 24);
      ctx.fillStyle = col;
      ctx.fillRect(cx + 2, rowY + 14, cellW - 4, 7);
    });
  }

  // Nagyító piktogram a jobb alsó sarokban
  const mx = b.x + b.w - 22;
  const my = b.y + b.h - 14;
  ctx.beginPath();
  ctx.arc(mx, my, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#e0f2fe";
  ctx.fill();
  ctx.strokeStyle = "#0284c7";
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(mx + 4.2, my + 4.2);
  ctx.lineTo(mx + 9, my + 9);
  ctx.stroke();

  ctx.restore();
}

function drawWorkbenchTester(ctx: CanvasRenderingContext2D, extras: RenderExtras) {
  const b = WORKBENCH_TESTER_BOUNDS;
  const reading = extras.testerReading;
  const isTesterActive = extras.tool === "tester";
  const hasProbesOnBoard = !!(extras.blackProbe || extras.redProbe);
  const isHovered = !!extras.hoverWorkbenchTester;

  ctx.save();

  // Halvány sziluett-hely az asztallapon (amikor a műszer kézben van, ez jelzi a helyét!)
  ctx.save();
  roundRect(ctx, b.x, b.y, b.w, b.h, 11);
  ctx.fillStyle = "rgba(15, 23, 42, 0.24)";
  ctx.fill();
  ctx.setLineDash([5, 3]);
  ctx.strokeStyle = isTesterActive
    ? "rgba(56, 189, 248, 0.75)"
    : isHovered
      ? "#38bdf8"
      : "rgba(226, 232, 240, 0.42)";
  ctx.lineWidth = isTesterActive || isHovered ? 2 : 1.3;
  ctx.stroke();
  ctx.restore();

  // Kézben tartott műszer esetén halvány sziluett (ha mérőzsinór van bedugva, félig áttetsző marad a zsinórtőhöz)
  if (isTesterActive) {
    ctx.globalAlpha = hasProbesOnBoard ? 0.45 : 0.24;
  }

  // Árnyék az asztallapon
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;

  // Piros ipari UNI-T védőburkolat
  roundRect(ctx, b.x, b.y, b.w, b.h, 11);
  ctx.fillStyle = "#dc2626";
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = isTesterActive || isHovered ? "#38bdf8" : "#991b1b";
  ctx.lineWidth = isTesterActive || isHovered ? 2.4 : 1.5;
  ctx.stroke();

  // Belső antracit előlap
  roundRect(ctx, b.x + 6, b.y + 8, b.w - 12, b.h - 20, 7);
  ctx.fillStyle = "#181d27";
  ctx.fill();
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1;
  ctx.stroke();

  // UNI-T felirat
  ctx.fillStyle = "#f8fafc";
  ctx.font = "900 8.5px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("UNI-T UT18D", b.x + b.w / 2, b.y + 20);

  // Mini LED sáv (12..400V + Rx + ⚡)
  const steps = [400, 230, 120, 50, 24, 12] as const;
  const activeSet = new Set(reading?.ledSteps ?? []);
  steps.forEach((step, idx) => {
    const ly = b.y + 28 + idx * 7;
    const on = activeSet.has(step);
    ctx.beginPath();
    ctx.arc(b.x + 18, ly, 2.3, 0, Math.PI * 2);
    ctx.fillStyle = on ? (step >= 120 ? "#ef4444" : "#facc15") : "#334155";
    ctx.fill();
    ctx.fillStyle = on ? "#e2e8f0" : "#64748b";
    ctx.font = "700 6px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`${step}`, b.x + 23, ly + 2);
  });

  // Folytonosság (Rx) és Fázis (⚡) mini LED-ek a jobb oldalon
  ctx.beginPath();
  ctx.arc(b.x + 56, b.y + 34, 2.8, 0, Math.PI * 2);
  ctx.fillStyle = reading?.singlePolePhase ? "#ef4444" : "#334155";
  ctx.fill();
  ctx.fillStyle = "#94a3b8";
  ctx.font = "700 6.5px Segoe UI";
  ctx.fillText("⚡", b.x + 62, b.y + 36.5);

  ctx.beginPath();
  ctx.arc(b.x + 56, b.y + 50, 2.8, 0, Math.PI * 2);
  ctx.fillStyle = reading?.continuity ? "#10b981" : "#334155";
  ctx.fill();
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("Rx", b.x + 62, b.y + 52.5);

  // Háttérvilágításos LCD ablak
  const lcdX = b.x + 11;
  const lcdY = b.y + 74;
  const lcdW = b.w - 22;
  const lcdH = 26;
  const danger = (reading?.voltage ?? 0) >= 50 || !!reading?.singlePolePhase;
  roundRect(ctx, lcdX, lcdY, lcdW, lcdH, 3);
  ctx.fillStyle = danger ? "#fdba74" : reading?.continuity ? "#86efac" : "#a7c7a7";
  ctx.fill();
  ctx.strokeStyle = "#090d14";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = danger ? "#431407" : "#0b1f13";
  ctx.font = "900 11px monospace";
  ctx.textAlign = "right";
  ctx.fillText(reading?.lcdPrimary ?? "---", lcdX + lcdW - 4, lcdY + 17);

  // Alsó COM (-) és (+) mérőzsinór kivezető hüvelyek
  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.arc(b.x + 26, b.y + b.h - 6, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b91c1c";
  ctx.beginPath();
  ctx.arc(b.x + b.w - 26, b.y + b.h - 6, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawWorkbenchClampMeter(ctx: CanvasRenderingContext2D, extras: RenderExtras) {
  const b = WORKBENCH_CLAMP_BOUNDS;
  const reading = extras.clampReading;
  const isClampTool = extras.tool === "clamp";
  const isClampedOnBoard = !!extras.clampedTarget;
  const isHovered = !!extras.hoverWorkbenchClamp;
  const cx = b.x + b.w / 2;

  ctx.save();

  // Halvány sziluett-hely az asztallapon (pofa + műszerház körvonal)
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, b.y + 24, 21, Math.PI * 0.85, Math.PI * 0.15, false);
  ctx.fillStyle = "rgba(15, 23, 42, 0.22)";
  ctx.fill();
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = isClampTool
    ? "rgba(251, 191, 36, 0.85)"
    : isHovered
      ? "#38bdf8"
      : "rgba(226, 232, 240, 0.42)";
  ctx.lineWidth = isClampTool || isHovered ? 2 : 1.3;
  ctx.stroke();

  roundRect(ctx, b.x + 9, b.y + 42, b.w - 14, b.h - 42, 11);
  ctx.fillStyle = "rgba(15, 23, 42, 0.24)";
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Ha a lakatfogó a kezünkben van vagy vezetéken lóg a falon, csak halvány sziluett látszik az asztalon
  if (isClampTool || isClampedOnBoard) {
    ctx.globalAlpha = 0.24;
  }

  // 1. Felső lakatfogó transzformátorpofa (teardrop pincer jaws)
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;

  // Bal pofaív
  ctx.beginPath();
  ctx.moveTo(cx - 14, b.y + 46);
  ctx.bezierCurveTo(cx - 26, b.y + 34, cx - 23, b.y + 6, cx - 2, b.y + 2);
  ctx.lineTo(cx - 1, b.y + 10);
  ctx.bezierCurveTo(cx - 13, b.y + 13, cx - 14, b.y + 32, cx - 6, b.y + 44);
  ctx.closePath();
  ctx.fillStyle = "#dc2626";
  ctx.fill();
  ctx.strokeStyle = "#7f1d1d";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Jobb pofaív
  ctx.beginPath();
  ctx.moveTo(cx + 14, b.y + 46);
  ctx.bezierCurveTo(cx + 26, b.y + 34, cx + 23, b.y + 6, cx + 2, b.y + 2);
  ctx.lineTo(cx + 1, b.y + 10);
  ctx.bezierCurveTo(cx + 13, b.y + 13, cx + 14, b.y + 32, cx + 6, b.y + 44);
  ctx.closePath();
  ctx.fillStyle = "#dc2626";
  ctx.fill();
  ctx.strokeStyle = "#7f1d1d";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Fémes pofacsúcs illesztés
  ctx.fillStyle = "#94a3b8";
  ctx.fillRect(cx - 2, b.y + 2, 4, 8);
  ctx.restore();

  // Oldalsó pofanyitó ravasz (trigger lever) a bal oldalon
  roundRect(ctx, b.x + 3, b.y + 50, 9, 24, 3);
  ctx.fillStyle = "#dc2626";
  ctx.fill();
  ctx.strokeStyle = "#7f1d1d";
  ctx.lineWidth = 1;
  ctx.stroke();

  // 2. Sárga-borostyán ipari lakatfogó készülékház
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 9;
  ctx.shadowOffsetY = 4;
  roundRect(ctx, b.x + 9, b.y + 42, b.w - 14, b.h - 42, 11);
  ctx.fillStyle = "#d97706";
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = isClampTool ? "#fde047" : "#92400e";
  ctx.lineWidth = isClampTool ? 2.2 : 1.4;
  roundRect(ctx, b.x + 9, b.y + 42, b.w - 14, b.h - 42, 11);
  ctx.stroke();

  // Belső antracit előlap
  const fx = b.x + 14;
  const fy = b.y + 47;
  const fw = b.w - 24;
  const fh = b.h - 52;
  roundRect(ctx, fx, fy, fw, fh, 7);
  ctx.fillStyle = "#181d27";
  ctx.fill();
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Típusjelzés
  ctx.fillStyle = "#fde68a";
  ctx.font = "900 7.5px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("UT202A+ ~A", fx + fw / 2, fy + 11);

  // Forgókapcsoló tárcsa (~A állásban)
  const dialCx = fx + fw / 2;
  const dialCy = fy + 29;
  ctx.beginPath();
  ctx.arc(dialCx, dialCy, 11.5, 0, Math.PI * 2);
  ctx.fillStyle = "#334155";
  ctx.fill();
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.save();
  ctx.translate(dialCx, dialCy);
  ctx.rotate(-0.55);
  roundRect(ctx, -2.5, -9.5, 5, 19, 2);
  ctx.fillStyle = "#f59e0b";
  ctx.fill();
  ctx.restore();

  // Háttérvilágításos mini LCD kijelző
  const lcdX = fx + 5;
  const lcdY = fy + 46;
  const lcdW = fw - 10;
  const lcdH = 24;
  const overload = !!reading?.overloadWarn;
  const hold = !!reading?.hold;
  const hasAmp = (reading?.displayCurrent ?? 0) > 0;

  roundRect(ctx, lcdX, lcdY, lcdW, lcdH, 3);
  ctx.fillStyle = overload
    ? "#fca5a5"
    : hold
      ? "#fde047"
      : hasAmp
        ? "#7dd3fc"
        : "#cbd5e1";
  ctx.fill();
  ctx.strokeStyle = "#090d14";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#0f172a";
  ctx.font = "900 9.5px monospace";
  ctx.textAlign = "right";
  ctx.fillText(reading?.lcdPrimary ?? "0.00 A", lcdX + lcdW - 3, lcdY + 16);

  // Alsó felirat
  ctx.fillStyle = "#94a3b8";
  ctx.font = "800 6.5px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("LAKATFOGÓ", fx + fw / 2, fy + fh - 5);

  ctx.restore();
}

function clampBodyDirection(wireAngle: number): number {
  const n1 = wireAngle + Math.PI / 2;
  const n2 = wireAngle - Math.PI / 2;
  // Mindig lefelé / jobbra nézzen a lakatfogó nyele, hogy kényelmesen olvasható legyen
  const score1 = Math.sin(n1) + 0.35 * Math.cos(n1);
  const score2 = Math.sin(n2) + 0.35 * Math.cos(n2);
  return score1 >= score2 ? n1 : n2;
}

/**
 * A vezeték ALÁ kerülő hátsó lakatfogó pofaszár + vezeték-kiemelés,
 * hogy a vezeték vizuálisan térben áthaladjon a zárt pofa gyűrűjén.
 */
function drawClampUnderlay(
  ctx: CanvasRenderingContext2D,
  world: World,
  extras: RenderExtras,
) {
  const activeTarget =
    extras.clampedTarget ?? (extras.tool === "clamp" ? extras.hoverClampTarget : undefined);
  if (!activeTarget) return;

  const wire = world.wires.find((w) => w.id === activeTarget.wireId);
  if (wire && wire.points.length >= 2) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(wire.points[0].x, wire.points[0].y);
    for (let i = 1; i < wire.points.length; i++) {
      ctx.lineTo(wire.points[i].x, wire.points[i].y);
    }
    ctx.lineWidth = 11;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = extras.clampedTarget
      ? "rgba(251, 191, 36, 0.38)"
      : "rgba(56, 189, 248, 0.42)";
    ctx.stroke();
    ctx.restore();
  }

  // Hátsó (alsó) pofaív a vezeték alatt
  const bodyDir = clampBodyDirection(activeTarget.angle);
  ctx.save();
  ctx.translate(activeTarget.x, activeTarget.y);
  ctx.rotate(bodyDir);

  ctx.beginPath();
  ctx.moveTo(20, 5);
  ctx.bezierCurveTo(10, 22, -14, 22, -19, 1);
  ctx.lineTo(-12, 1);
  ctx.bezierCurveTo(-9, 13, 8, 13, 16, 3);
  ctx.closePath();
  ctx.fillStyle = "#991b1b";
  ctx.fill();
  ctx.strokeStyle = "#450a0a";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.restore();
}

/**
 * A vezeték FÖLÉ kerülő elülső lakatfogó pofaszár, készüléktest és élő Amper kijelző.
 */
function drawClampOverlay(ctx: CanvasRenderingContext2D, extras: RenderExtras) {
  // Ha már van rögzített lakatfogó, de lakatfogó módban másik vezeték fölé visszük az egeret,
  // finom szaggatott célgyűrű jelzi az új befogási pontot
  if (
    extras.tool === "clamp" &&
    extras.clampedTarget &&
    extras.hoverClampTarget &&
    extras.hoverClampTarget.wireId !== extras.clampedTarget.wireId
  ) {
    const ht = extras.hoverClampTarget;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ht.x, ht.y, 15, 0, Math.PI * 2);
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.restore();
  }

  const activeTarget =
    extras.clampedTarget ?? (extras.tool === "clamp" ? extras.hoverClampTarget : undefined);
  const pinned = !!extras.clampedTarget;

  // Ha nincs vezetéken, csak lakatfogó módban a kurzornál rajzolunk nyitott pofás előnézetet
  const inWorkbenchZone =
    extras.pointerWorldPos && extras.pointerWorldPos.y >= 1070;
  if (!activeTarget && (extras.tool !== "clamp" || !extras.pointerWorldPos || inWorkbenchZone)) {
    return;
  }

  const pos = activeTarget ?? extras.pointerWorldPos!;
  const bodyDir = activeTarget ? clampBodyDirection(activeTarget.angle) : Math.PI * 0.38;
  const jawsClosed = !!activeTarget;
  const jawOpenAngle = jawsClosed ? 0 : 0.36;
  const reading = extras.clampReading;

  ctx.save();
  ctx.globalAlpha = jawsClosed ? 1 : 0.86;
  ctx.translate(pos.x, pos.y);
  ctx.rotate(bodyDir);

  // Ha nyitott pofával a levegőben van, itt rajzoljuk meg az alsó nyitott pofaszárat is
  if (!jawsClosed) {
    ctx.save();
    ctx.translate(18, 5);
    ctx.rotate(jawOpenAngle);
    ctx.translate(-18, -5);
    ctx.beginPath();
    ctx.moveTo(20, 5);
    ctx.bezierCurveTo(10, 22, -14, 22, -19, 1);
    ctx.lineTo(-12, 1);
    ctx.bezierCurveTo(-9, 13, 8, 13, 16, 3);
    ctx.closePath();
    ctx.fillStyle = "#b91c1c";
    ctx.fill();
    ctx.strokeStyle = "#450a0a";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Fémes pofavég
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(-19, 0, 7, 2.5);
    ctx.restore();
  }

  // Elülső (felső) pofaszár — a vezeték FÖLÖTT zár át, bezárva a gyűrűt!
  ctx.save();
  if (!jawsClosed) {
    ctx.translate(18, -5);
    ctx.rotate(-jawOpenAngle);
    ctx.translate(-18, 5);
  }
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.moveTo(20, -5);
  ctx.bezierCurveTo(10, -22, -14, -22, -19, -1);
  ctx.lineTo(-12, -1);
  ctx.bezierCurveTo(-9, -13, 8, -13, 16, -3);
  ctx.closePath();
  ctx.fillStyle = "#ef4444";
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#7f1d1d";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Fémes vasmag illesztési csúcs a pofa orránál
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(-19, -2.2, 7.2, jawsClosed ? 4.4 : 2.2);
  if (jawsClosed) {
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-19, 0);
    ctx.lineTo(-11.8, 0);
    ctx.stroke();
  }
  ctx.restore();

  // Pofanyitó ravasz (benyomva, ha nyitott a pofa)
  const trigOffset = jawsClosed ? 0 : 3.5;
  roundRect(ctx, 24, -22 + trigOffset, 18, 7, 2.5);
  ctx.fillStyle = "#dc2626";
  ctx.fill();
  ctx.strokeStyle = "#7f1d1d";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Ujjvédő gallér és kompakt lakatfogó markolat (x = 17..88)
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.42)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  roundRect(ctx, 17, -16, 72, 32, 8);
  ctx.fillStyle = "#d97706";
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = pinned ? "#fde047" : "#78350f";
  ctx.lineWidth = pinned ? 2 : 1.3;
  roundRect(ctx, 17, -16, 72, 32, 8);
  ctx.stroke();

  // Belső sötét előlap a kézi fejen
  roundRect(ctx, 22, -12, 62, 24, 5);
  ctx.fillStyle = "#181d27";
  ctx.fill();

  // Mini forgókapcsoló jelzés
  ctx.beginPath();
  ctx.arc(33, 0, 6.5, 0, Math.PI * 2);
  ctx.fillStyle = "#334155";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(29, -3);
  ctx.lineTo(37, 3);
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();

  // Vízszintes (mindig olvasható!) LCD érték-címke a lakatfogó fején / mellett
  if (jawsClosed && reading) {
    const labelDist = 56;
    const lx = pos.x + Math.cos(bodyDir) * labelDist;
    const ly = pos.y + Math.sin(bodyDir) * labelDist;

    const pillText = reading.hold ? `HOLD ${reading.lcdPrimary}` : reading.lcdPrimary;
    ctx.save();
    ctx.font = "900 11px Consolas, monospace";
    const textW = ctx.measureText(pillText).width;
    const pw = Math.max(58, textW + (pinned ? 26 : 14));
    const ph = 22;

    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    roundRect(ctx, lx - pw / 2, ly - ph / 2, pw, ph, 5);
    ctx.fillStyle = reading.overloadWarn
      ? "#fecaca"
      : reading.hold
        ? "#fef08a"
        : reading.displayCurrent > 0
          ? "#bae6fd"
          : "#e2e8f0";
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = pinned ? "#f59e0b" : "#0f172a";
    ctx.lineWidth = pinned ? 2 : 1.3;
    ctx.stroke();

    ctx.fillStyle = reading.overloadWarn ? "#7f1d1d" : "#0f172a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(pinned ? `📌 ${pillText}` : pillText, lx, ly + 0.5);
    ctx.restore();
  }
}

function drawSingleProbe(
  ctx: CanvasRenderingContext2D,
  tip: Point,
  polarity: "black" | "red",
  pinned: boolean,
  snapped: boolean,
) {
  const b = WORKBENCH_TESTER_BOUNDS;
  const jackX = polarity === "black" ? b.x + 26 : b.x + b.w - 26;
  const jackY = b.y + b.h - 4;

  // V-alakú döntés lefelé, hogy két szomszédos sorkapcson vagy közös ponton se fedjék egymást
  const tiltRad = polarity === "black" ? Math.PI * 0.63 : Math.PI * 0.37;
  const dirX = Math.cos(tiltRad);
  const dirY = Math.sin(tiltRad);

  const tailDist = 76;
  const tailX = tip.x + dirX * tailDist;
  const tailY = tip.y + dirY * tailDist;

  ctx.save();
  ctx.globalAlpha = pinned || snapped ? 1 : 0.82;

  // 1. Hajlékony szilikon mérőzsinór a munkapadi UNI-T műszertől a tüske végéig
  const sag = Math.max(50, Math.min(220, Math.abs(jackY - tailY) * 0.35 + 45));
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(jackX, jackY);
  ctx.bezierCurveTo(
    jackX + (polarity === "black" ? -35 : 35),
    jackY - sag * 0.45,
    tailX + dirX * 45,
    tailY + sag * 0.55,
    tailX,
    tailY,
  );
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;
  ctx.lineWidth = 4.2;
  ctx.lineCap = "round";
  ctx.strokeStyle = polarity === "black" ? "#18181b" : "#dc2626";
  ctx.stroke();

  // Finom fénycsík a mérőzsinóron
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = polarity === "black" ? "rgba(255,255,255,0.22)" : "rgba(254,202,202,0.4)";
  ctx.stroke();
  ctx.restore();

  // 2. Érintkezési gyűrű a mérési ponton
  if (pinned || snapped) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, pinned ? 7.5 : 8.5, 0, Math.PI * 2);
    ctx.strokeStyle = polarity === "black" ? "#38bdf8" : "#facc15";
    ctx.lineWidth = pinned ? 2.2 : 1.8;
    if (!pinned) ctx.setLineDash([3, 2]);
    ctx.stroke();
    ctx.restore();
  }

  // 3. VDE szigetelt mérőtüske test kirajzolása
  ctx.save();
  ctx.translate(tip.x, tip.y);
  ctx.rotate(tiltRad);

  // Fémes mérőhegy (0..16 px)
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(16, -2.2);
  ctx.lineTo(16, 2.2);
  ctx.closePath();
  ctx.fillStyle = "#e2e8f0";
  ctx.fill();
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 0.9;
  ctx.stroke();

  // VDE ujjvédő gallér (16..21 px)
  roundRect(ctx, 15, -7.5, 5.5, 15, 2);
  ctx.fillStyle = polarity === "black" ? "#27272a" : "#ef4444";
  ctx.fill();
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Markolat (20..66 px)
  roundRect(ctx, 20, -5.2, 46, 10.4, 3.5);
  ctx.fillStyle = polarity === "black" ? "#1f2937" : "#dc2626";
  ctx.fill();
  ctx.strokeStyle = polarity === "black" ? "#4b5563" : "#7f1d1d";
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // Bordázott csúszásgátló csíkok a markolaton
  ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
  ctx.lineWidth = 1.2;
  for (let gx = 28; gx <= 40; gx += 4) {
    ctx.beginPath();
    ctx.moveTo(gx, -4);
    ctx.lineTo(gx, 4);
    ctx.stroke();
  }

  // Kábel-törésgátló nyak (66..76 px)
  roundRect(ctx, 65, -3.2, 11, 6.4, 2);
  ctx.fillStyle = polarity === "black" ? "#09090b" : "#991b1b";
  ctx.fill();

  ctx.restore();

  // 4. Polaritás jelvény a markolat mellett (- / +)
  const badgeX = tip.x + dirX * 50;
  const badgeY = tip.y + dirY * 50;
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, 7.5, 0, Math.PI * 2);
  ctx.fillStyle = polarity === "black" ? "#0f172a" : "#991b1b";
  ctx.fill();
  ctx.strokeStyle = pinned ? "#facc15" : "#e2e8f0";
  ctx.lineWidth = pinned ? 1.8 : 1.1;
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 10px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(polarity === "black" ? "−" : "+", badgeX, badgeY + 0.5);

  ctx.restore();
}

function drawTesterProbes(ctx: CanvasRenderingContext2D, extras: RenderExtras) {
  // Célpont előnézeti kiemelés UNI-T módban
  if (extras.tool === "tester" && extras.hoverProbeTarget) {
    const ht = extras.hoverProbeTarget;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ht.x, ht.y, 10.5, 0, Math.PI * 2);
    ctx.strokeStyle = extras.blackProbe ? "#ef4444" : "#38bdf8";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.restore();
  }

  // 1. Fekete (COM / -) tüske: rögzítve vagy (ha még nincs lerakva) kurzor-előnézetként a célponton
  if (extras.blackProbe) {
    drawSingleProbe(ctx, extras.blackProbe, "black", true, true);
  } else if (extras.tool === "tester" && extras.hoverProbeTarget) {
    drawSingleProbe(ctx, extras.hoverProbeTarget, "black", false, true);
  }

  // 2. Piros (+) tüske: rögzítve, vagy élő mérésként a kurzort / célpontot követve
  if (extras.redProbe) {
    drawSingleProbe(ctx, extras.redProbe, "red", true, true);
  } else if (extras.tool === "tester" && extras.blackProbe) {
    const liveTip = extras.hoverProbeTarget ?? extras.pointerWorldPos;
    if (liveTip) {
      drawSingleProbe(ctx, liveTip, "red", false, !!extras.hoverProbeTarget);
    }
  }
}

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  world: World,
  sim: SimState,
  extras: RenderExtras,
) {
  fillOsb(ctx, 2200, 1300);
  drawBackgroundFixtures(ctx);

  // Terminals and wagos
  for (const col of world.columns) {
    const port = world.ports[col.portId];
    if (port) {
      const isHovered = extras.hoverPortId === port.id;
      const isScrewdriverHover = isHovered && extras.tool === "screwdriver";
      drawColumn(ctx, col, port, isHovered, isScrewdriverHover, extras.debug);
    }
  }

  // Draw interactive workbench stations: wire spools, VDE hand tools, UNI-T tester, Clamp Meter, WAGO boxes & diagram sheet
  drawWorkbenchSpools(ctx, extras);
  drawWorkbenchTools(ctx, extras);
  drawWagoBoxes(ctx, world, extras);
  drawWorkbenchTester(ctx, extras);
  drawWorkbenchClampMeter(ctx, extras);
  drawWorkbenchLegendSheet(ctx, extras);

  for (const wago of world.wagos) {
    drawWago(ctx, world, wago, extras.hoverPortId, extras.hoverWagoId, extras.draggedWagoId);
  }

  // Devices
  drawDevices(ctx, world, sim, extras);

  // Lakatfogó hátsó pofaszára (a vezetékek alá kerül a valós térbeli átfűzéshez)
  drawClampUnderlay(ctx, world, extras);

  // Wires
  for (const wire of world.wires) {
    const isColorInvalid = !!(extras.colorCheckActive && extras.invalidWireIds?.has(wire.id));

    // Kábelszín-validációs hiba kiemelése: piros szaggatott keret a vezeték körül
    if (isColorInvalid && wire.points.length >= 2) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(wire.points[0].x, wire.points[0].y);
      for (let i = 1; i < wire.points.length; i++) {
        ctx.lineTo(wire.points[i].x, wire.points[i].y);
      }
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 11;
      ctx.strokeStyle = "#ef4444";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = "rgba(239, 68, 68, 0.85)";
      ctx.shadowBlur = 9;
      ctx.stroke();
      ctx.restore();
    }

    const glow = extras.debug && isWireLive(sim, world, wire.id);
    if (wire.color === "PE") {
      strokePe(ctx, wire.points, glow);
    } else {
      const strokeCol = WIRE_COLORS[wire.color]?.stroke ?? "#111";
      strokePolyline(
        ctx,
        wire.points,
        extras.hoverWireId === wire.id ? 6.5 : 5.2,
        strokeCol,
        glow,
      );
    }

    // Színhiba jelző ikon a vezeték felezőpontjánál
    if (isColorInvalid && wire.points.length >= 2) {
      const midIdx = Math.floor(wire.points.length / 2);
      const p = wire.points[midIdx];
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = "#dc2626";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 12px Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✕", p.x, p.y + 0.5);
      ctx.restore();
    }

    if (!isWireEndSecure(world, wire.startPortId)) drawLooseHint(ctx, wire.points[0]);
    if (!isWireEndSecure(world, wire.endPortId)) {
      drawLooseHint(ctx, wire.points[wire.points.length - 1]);
    }
  }

  // Draft wire
  if (extras.draft && extras.draft.points.length) {
    if (extras.draft.color === "PE") {
      strokePe(ctx, extras.draft.points, false);
    } else {
      const strokeCol = WIRE_COLORS[extras.draft.color]?.stroke ?? "#111";
      strokePolyline(ctx, extras.draft.points, 5.2, strokeCol, false);
    }
  }

  // UNI-T mérőtüskék, mérőzsinórok és Lakatfogó elülső pofája / kijelzője
  drawTesterProbes(ctx, extras);
  drawClampOverlay(ctx, extras);

  // Debug overlay
  if (extras.debug) {
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    roundRect(ctx, 70, 725, 580, 36, 4);
    ctx.fill();
    ctx.strokeStyle = "#38bdf8";
    ctx.stroke();

    ctx.fillStyle = "#facc15";
    ctx.font = "700 11px Segoe UI";
    ctx.textAlign = "left";
    let text = sim.warnings.length
      ? sim.warnings.join("  •  ")
      : "Rendszer üzemkész: nincs zárlat, nincs laza kötés.";
    if (extras.colorCheckSummary) {
      text += `  •  Szín: ${extras.colorCheckSummary}`;
    }
    ctx.fillText(`DEBUG: ${text}`, 80, 747);
  }

  // Tooltip
  if (extras.tooltip) {
    const pad = 10;
    ctx.font = "12px Segoe UI";
    const widthBox =
      Math.max(...extras.tooltip.lines.map((l) => ctx.measureText(l).width)) + pad * 2;
    const heightBox = extras.tooltip.lines.length * 18 + pad * 2;
    let tx = extras.tooltip.x + 14;
    let ty = extras.tooltip.y - heightBox - 8;
    if (ty < 8) ty = extras.tooltip.y + 16;
    ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
    roundRect(ctx, tx, ty, widthBox, heightBox, 6);
    ctx.fill();
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#fff";
    extras.tooltip.lines.forEach((line, i) => {
      ctx.fillText(line, tx + pad, ty + pad + 12 + i * 18);
    });
  }
}
