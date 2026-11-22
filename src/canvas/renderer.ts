import { MARK_FILL, WIRE_COLORS } from "../data/colors";
import { UPPER_TERMINAL_GROUPS, LOWER_TERMINAL_GROUPS } from "../data/terminalLegend";
import { isWireLive } from "../engine/simulation";
import { hasWagoWires, isWireEndSecure } from "../models/world";
import type { Point, Port, SimState, TerminalColumn, World } from "../models/types";

export interface RenderExtras {
  debug: boolean;
  hoverPortId?: string;
  hoverWireId?: string;
  hoverWagoId?: string;
  draggedWagoId?: string;
  draft?: { points: Point[]; color: keyof typeof WIRE_COLORS };
  tooltip?: { x: number; y: number; lines: string[] };
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
  // 1. Kiselosztó szekrény doboza (Distribution enclosure on the left)
  ctx.save();
  // Outer white enclosure frame
  roundRect(ctx, 70, 105, 488, 175, 10);
  ctx.fillStyle = "#f3f5f8";
  ctx.fill();
  ctx.strokeStyle = "#8b929c";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner cavity (darker recess)
  roundRect(ctx, 84, 128, 460, 138, 6);
  ctx.fillStyle = "#2c313a";
  ctx.fill();

  // Internal DIN rail
  ctx.fillStyle = "#8d939e";
  ctx.fillRect(86, 190, 456, 18);
  ctx.fillStyle = "#656a73";
  ctx.fillRect(86, 196, 456, 4);

  // Smoked semi-transparent acrylic door frame (top hinged)
  roundRect(ctx, 76, 112, 476, 160, 8);
  ctx.fillStyle = "rgba(40, 52, 68, 0.28)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Enclosure branding
  ctx.fillStyle = "#64748b";
  ctx.font = "700 9px Segoe UI";
  ctx.textAlign = "left";
  ctx.fillText("KISELOSZTÓ • IP40", 90, 122);
  ctx.restore();

  // 2. Sorkapocs-kiosztás plakát (Poster on the board under wagos)
  ctx.save();
  const px = 680;
  const py = 725;
  const pw = 1460;
  const ph = 315;
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
  roundRect(ctx, px + 2, py + 2, pw - 4, 30, 3);
  ctx.fillStyle = "#1e293b";
  ctx.fill();

  ctx.fillStyle = "#f8fafc";
  ctx.font = "800 12px Segoe UI";
  ctx.textAlign = "left";
  ctx.fillText("OKTATÓFALI SORKAPOCS-KIOSZTÁSI JEGYZÉK (KAPCSOLÁSI TERV ÉS SZÍNKÓDOK)", px + 18, py + 21);

  // Clickable badge prompt
  roundRect(ctx, px + pw - 340, py + 5, 324, 22, 4);
  ctx.fillStyle = "#0284c7";
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 10.5px Segoe UI";
  ctx.textAlign = "center";
  ctx.fillText("📋 KATTINTS IDE A NAGYÍTOTT JEGYZÉKHEZ", px + pw - 178, py + 20);

  // FELSŐ SORKAPOCSSOR (X1 • 65 db sorkapocs) - Részletes rajzolat
  ctx.fillStyle = "#1e293b";
  ctx.font = "800 10.5px Segoe UI";
  ctx.textAlign = "left";
  ctx.fillText("FELSŐ SORKAPOCSSOR (X1 • 65 db kapocs) — TÁPOK, KISMEGSZAKÍTÓK, RELÉK, MÁGNESKAPCSOLÓK, MOTORVÉDŐ", px + 18, py + 48);

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
    ctx.strokeRect(grpX, py + 54, grpW, 58);

    // Group title
    const displayTitle = formatPosterGroupTitle(group.title);
    ctx.fillStyle = "#1e293b";
    ctx.textAlign = "center";
    ctx.font = displayTitle.length <= 4 ? "800 9px Segoe UI" : "700 8px Segoe UI";
    ctx.fillText(displayTitle, grpX + grpW / 2, py + 66);

    // Terminals in group
    for (let tIdx = 0; tIdx < grpCount; tIdx++) {
      const term = group.terminals[tIdx];
      const tx = grpX + tIdx * colWTop;

      // Pin label
      ctx.fillStyle = "#0f172a";
      ctx.font = "800 8.5px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText(term.label, tx + colWTop / 2, py + 80);

      // Color mark square
      const swatchCol = MARK_FILL[term.mark] ?? "#94a3b8";
      ctx.fillStyle = swatchCol;
      roundRect(ctx, tx + 2, py + 86, colWTop - 4, 20, 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    curTopColIdx += grpCount;
  }

  // ALSÓ SORKAPOCSSOR (X2 • 54 db sorkapocs) - Részletes rajzolat
  ctx.fillStyle = "#1e293b";
  ctx.font = "800 10.5px Segoe UI";
  ctx.textAlign = "left";
  ctx.fillText("ALSÓ SORKAPOCSSOR (X2 • 54 db kapocs) — DUGALJ, KAPCSOLÓK (106, 107, 101N, 101, 102, 105), GOMBOK, IZZÓK, PIR", px + 18, py + 132);

  const colWBot = (colWTop * 65) / 54; // vagy a teljes tábla szélessége alapján
  let curBotColIdx = 0;
  for (const group of LOWER_TERMINAL_GROUPS) {
    const grpCount = group.terminals.length;
    const grpX = tableStartX + curBotColIdx * colWBot;
    const grpW = grpCount * colWBot;

    // Group outline
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.strokeRect(grpX, py + 138, grpW, 58);

    // Group title
    const displayTitle = formatPosterGroupTitle(group.title);
    ctx.fillStyle = "#1e293b";
    ctx.textAlign = "center";
    ctx.font = displayTitle.length <= 4 ? "800 9.5px Segoe UI" : "700 8px Segoe UI";
    ctx.fillText(displayTitle, grpX + grpW / 2, py + 150);

    // Terminals in group
    for (let tIdx = 0; tIdx < grpCount; tIdx++) {
      const term = group.terminals[tIdx];
      const tx = grpX + tIdx * colWBot;

      // Pin label
      ctx.fillStyle = "#0f172a";
      ctx.font = "800 8.5px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText(term.label, tx + colWBot / 2, py + 164);

      // Color mark square
      const swatchCol = MARK_FILL[term.mark] ?? "#94a3b8";
      ctx.fillStyle = swatchCol;
      roundRect(ctx, tx + 2, py + 170, colWBot - 4, 20, 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    curBotColIdx += grpCount;
  }

  // Bekötési és használati útmutató lábléc a plakáton
  ctx.fillStyle = "#475569";
  ctx.font = "600 10.5px Segoe UI";
  ctx.textAlign = "left";
  ctx.fillText("Bekötési logika: A sorkapcsok felső oldala gyárilag bekötött (fix fali átvezetés). A kapcsolási vezetéket kizárólag az ALSÓ nyílásba kösd be, és az alsó csavart húzd meg csavarhúzóval!", px + 18, py + 235);
  ctx.fillStyle = "#0284c7";
  ctx.font = "700 10.5px Segoe UI";
  ctx.fillText("Tipp: A felső menüsorban lévő '📋 Sorkapocs tábla' gombra vagy közvetlenül a fenti plakátra kattintva megnyílik a teljes függőleges feliratozású segédtáblázat.", px + 18, py + 255);

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

  // 3. Alsó munkapad asztal és szerszámok (Workbench shelf at the bottom)
  ctx.save();
  const by = 1070;
  // Wooden tabletop
  ctx.fillStyle = "#ad824a";
  ctx.fillRect(0, by, 2200, 230);
  ctx.fillStyle = "#8a612d";
  ctx.fillRect(0, by, 2200, 8);
  ctx.strokeStyle = "#65451e";
  ctx.lineWidth = 1;
  ctx.strokeRect(0, by, 2200, 230);

  // 3-Phase CEE 16A red plug on the left wall with white cable
  // White wall junction box
  roundRect(ctx, 90, by + 30, 80, 80, 6);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#9ca3af";
  ctx.stroke();
  // 5 terminal dots on box
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(106 + i * 12, by + 70, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#333";
    ctx.fill();
  }
  // Thick white supply cable
  ctx.beginPath();
  ctx.moveTo(130, by + 110);
  ctx.bezierCurveTo(130, by + 150, 110, by + 190, 110, 1300);
  ctx.lineWidth = 12;
  ctx.strokeStyle = "#e5e7eb";
  ctx.stroke();
  // Red CEE plug
  roundRect(ctx, 92, by + 160, 36, 48, 6);
  ctx.fillStyle = "#dc2626";
  ctx.fill();
  ctx.strokeStyle = "#991b1b";
  ctx.stroke();

  // Blueprint diagram on the desk
  roundRect(ctx, 320, by + 25, 140, 100, 3);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#9ca3af";
  ctx.stroke();
  ctx.fillStyle = "#1e3a8a";
  ctx.font = "700 8.5px Segoe UI";
  ctx.fillText("KAPCSOLÁSI RAJZ", 330, by + 42);
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 1;
  ctx.strokeRect(330, by + 50, 60, 45);
  ctx.beginPath();
  ctx.moveTo(340, by + 72);
  ctx.lineTo(410, by + 72);
  ctx.stroke();

  // Screwdriver on the desk
  ctx.save();
  ctx.translate(560, by + 50);
  ctx.rotate(0.3);
  // Yellow handle
  roundRect(ctx, -6, -24, 12, 32, 4);
  ctx.fillStyle = "#eab308";
  ctx.fill();
  ctx.strokeStyle = "#ca8a04";
  ctx.stroke();
  // Red insulation
  ctx.fillStyle = "#dc2626";
  ctx.fillRect(-3, 8, 6, 26);
  // Metal tip
  ctx.fillStyle = "#9ca3af";
  ctx.fillRect(-2, 34, 4, 10);
  ctx.restore();

  // Pliers on the desk
  ctx.save();
  ctx.translate(650, by + 60);
  ctx.rotate(-0.2);
  // Red/black handles
  roundRect(ctx, -14, 0, 10, 38, 4);
  roundRect(ctx, 4, 0, 10, 38, 4);
  ctx.fillStyle = "#dc2626";
  ctx.fill();
  // Steel jaw
  ctx.fillStyle = "#6b7280";
  ctx.fillRect(-10, -22, 20, 22);
  ctx.restore();

  // Multimeter on the desk
  roundRect(ctx, 750, by + 25, 75, 110, 8);
  ctx.fillStyle = "#dc2626";
  ctx.fill();
  ctx.strokeStyle = "#991b1b";
  ctx.stroke();
  // Screen
  roundRect(ctx, 760, by + 35, 55, 24, 3);
  ctx.fillStyle = "#a3e635";
  ctx.fill();
  ctx.fillStyle = "#166534";
  ctx.font = "800 11px monospace";
  ctx.fillText("230.4 V", 764, by + 52);
  // Dial
  ctx.beginPath();
  ctx.arc(787, by + 82, 16, 0, Math.PI * 2);
  ctx.fillStyle = "#1f2937";
  ctx.fill();

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
  roundRect(ctx, col.x, col.y, col.w, col.h, 3);
  ctx.fillStyle = hover ? "#ffffff" : "#eeeae2";
  ctx.fill();
  ctx.strokeStyle = hover ? "#0284c7" : "#374151";
  ctx.lineWidth = hover ? 1.5 : 1;
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
  ctx.beginPath();
  ctx.arc(cx, userScrewY, 7.5, 0, Math.PI * 2);
  ctx.fillStyle = hover ? "#f1f5f9" : "#cbd5e1";
  ctx.fill();
  ctx.strokeStyle = hover ? "#0284c7" : "#475569";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, userScrewY, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#94a3b8";
  ctx.fill();

  // Alsó csavarhorony: elforog a meghúzási állapottól függően
  ctx.save();
  ctx.translate(cx, userScrewY);
  ctx.rotate(port.tight ? Math.PI / 2 : 0);
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
  ctx.strokeStyle = hover ? "#0284c7" : "#475569";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Belső réz rögzítőlemez
  const tongueY = port.tight ? holeBottomY + 3 : holeBottomY + 7;
  ctx.fillStyle = "#d97706";
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
  const w = 18 + wago.portIds.length * 24;
  const h = 66;
  const isDragging = draggedWagoId === wago.id;
  const hasWires = hasWagoWires(world, wago.id);
  const isHovered = hoverWagoId === wago.id && !hasWires;

  ctx.save();
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
  ctx.strokeStyle = isDragging ? "#2563eb" : isHovered ? "#3b82f6" : "#374151";
  ctx.lineWidth = isDragging || isHovered ? 2 : 1.3;
  ctx.stroke();

  // Internal busbar graphic
  ctx.fillStyle = "#d97706";
  ctx.fillRect(wago.x + 10, wago.y + 34, w - 20, 4);

  ctx.fillStyle = "#111";
  ctx.font = "800 9.5px Segoe UI, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("WAGO 221", wago.x + 8, wago.y + 13);

  // If movable (no wires attached), show subtle grip indicator dots at top-right
  if (!hasWires) {
    const gripX = wago.x + w - 16;
    const gripY = wago.y + 7;
    ctx.fillStyle = isHovered || isDragging ? "#2563eb" : "#9ca3af";
    for (let gx = 0; gx < 2; gx += 1) {
      for (let gy = 0; gy < 3; gy += 1) {
        ctx.beginPath();
        ctx.arc(gripX + gx * 4.5, gripY + gy * 4, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
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

    // Port hole
    ctx.beginPath();
    ctx.arc(port.x, port.y, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = "#1f2937";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(port.x, port.y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "#f59e0b";
    ctx.fill();
  });

  ctx.restore();
}

function drawDevices(ctx: CanvasRenderingContext2D, world: World, sim: SimState) {
  for (const device of world.devices) {
    const { x, y, w, h } = device.bounds;

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
    if (port) drawColumn(ctx, col, port, extras.hoverPortId === port.id, extras.debug);
  }

  for (const wago of world.wagos) {
    drawWago(ctx, world, wago, extras.hoverPortId, extras.hoverWagoId, extras.draggedWagoId);
  }

  // Devices
  drawDevices(ctx, world, sim);

  // Wires
  for (const wire of world.wires) {
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
    const text = sim.warnings.length
      ? sim.warnings.join("  •  ")
      : "Rendszer üzemkész: nincs zárlat, nincs laza kötés.";
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
