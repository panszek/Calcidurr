import { MARK_FILL, WIRE_COLORS } from "../data/colors";
import { isWireLive } from "../engine/simulation";
import { isWireEndSecure } from "../models/world";
import type { Point, Port, SimState, TerminalColumn, World } from "../models/types";

export interface RenderExtras {
  debug: boolean;
  hoverPortId?: string;
  hoverWireId?: string;
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
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#d2b48c");
  grad.addColorStop(0.45, "#c4a574");
  grad.addColorStop(1, "#b8935c");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 220; i += 1) {
    const x = (i * 97) % w;
    const y = (i * 53) % h;
    const ww = 18 + (i % 7) * 10;
    const hh = 6 + (i % 4) * 3;
    ctx.fillStyle = i % 2 ? "#8a6a3a" : "#e8d3a8";
    ctx.fillRect(x, y, ww, hh);
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
    ctx.strokeStyle = "rgba(255, 220, 80, 0.55)";
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
  ctx.setLineDash([10, 8]);
  ctx.lineDashOffset = 2;
  strokePolyline(ctx, points, 5.5, "#e6c200", false);
  ctx.restore();
}

function drawStackedLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const chars = text.replace(/\s+/g, "").split("");
  ctx.fillStyle = "#111";
  ctx.font = "700 10px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const startY = y + 22;
  const available = h - 58;
  const step = Math.min(12, available / Math.max(chars.length, 1));
  chars.forEach((ch, i) => {
    ctx.fillText(ch, x + w / 2, startY + i * step);
  });
}

function drawScrew(ctx: CanvasRenderingContext2D, port: Port) {
  ctx.beginPath();
  ctx.arc(port.x, port.y, 11, 0, Math.PI * 2);
  ctx.fillStyle = "#c9ccd1";
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "#5c6168";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(port.x, port.y, 7.2, 0, Math.PI * 2);
  ctx.fillStyle = "#9aa0a8";
  ctx.fill();

  ctx.save();
  ctx.translate(port.x, port.y);
  ctx.rotate(port.tight ? Math.PI / 2 : 0);
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-5.5, 0);
  ctx.lineTo(5.5, 0);
  ctx.stroke();
  ctx.restore();
}

function drawColumn(ctx: CanvasRenderingContext2D, col: TerminalColumn, port: Port, hover: boolean) {
  ctx.save();
  roundRect(ctx, col.x, col.y, col.w, col.h, 4);
  ctx.fillStyle = hover ? "#f7f7f4" : "#efeee9";
  ctx.fill();
  ctx.strokeStyle = "#2b2b2b";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  drawStackedLabel(ctx, col.title, col.x, col.y, col.w, col.h);
  drawScrew(ctx, port);

  const markY = col.y + col.h - 16;
  ctx.fillStyle = MARK_FILL[col.mark];
  ctx.fillRect(col.x + 4, markY, col.w - 8, 12);
  if (col.mark === "pe") {
    ctx.fillStyle = "#2e8b2e";
    ctx.fillRect(col.x + 4, markY, (col.w - 8) / 2, 12);
  }
  ctx.strokeStyle = "#222";
  ctx.strokeRect(col.x + 4, markY, col.w - 8, 12);

  ctx.fillStyle = "#111";
  ctx.font = "700 11px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(port.label, col.x + col.w / 2, col.y + 6);
  ctx.restore();
}

function drawWago(ctx: CanvasRenderingContext2D, world: World, wago: World["wagos"][number], hoverPortId?: string) {
  roundRect(ctx, wago.x, wago.y, 176, 92, 8);
  ctx.fillStyle = "#ececec";
  ctx.fill();
  ctx.strokeStyle = "#333";
  ctx.stroke();
  ctx.fillStyle = "#222";
  ctx.font = "700 12px Segoe UI, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("WAGO 221", wago.x + 10, wago.y + 18);

  wago.portIds.forEach((pid, index) => {
    const port = world.ports[pid];
    const closed = port.tight;
    const lx = wago.x + 22 + index * 52;
    const ly = wago.y + 28;
    ctx.fillStyle = hoverPortId === pid ? "#ffb347" : "#f08a16";
    roundRect(ctx, lx, ly, 28, closed ? 18 : 36, 3);
    ctx.fill();
    ctx.strokeStyle = "#9a4b00";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(port.x, port.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#333";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(port.x, port.y, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = "#c9a227";
    ctx.fill();
  });
}

function drawDevices(ctx: CanvasRenderingContext2D, world: World, sim: SimState) {
  for (const device of world.devices) {
    const { x, y, w, h } = device.bounds;
    if (device.type === "mcb") {
      roundRect(ctx, x, y, w, h, 6);
      ctx.fillStyle = "#eceff3";
      ctx.fill();
      ctx.strokeStyle = "#222";
      ctx.stroke();
      ctx.fillStyle = "#111";
      ctx.font = "700 11px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText("1P", x + w / 2, y + 16);
      ctx.fillText("B10A", x + w / 2, y + 32);
      const leverOn = device.on;
      ctx.fillStyle = leverOn ? "#d12c2c" : "#3a3a3a";
      roundRect(ctx, x + 22, y + 48, 28, 70, 4);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "800 13px Segoe UI";
      ctx.fillText(leverOn ? "BE" : "KI", x + w / 2, y + 88);
      continue;
    }

    if (device.type === "switch") {
      roundRect(ctx, x, y, w, h, 10);
      ctx.fillStyle = "#f4f4f4";
      ctx.fill();
      ctx.stroke();
      roundRect(ctx, x + 22, y + 18, 50, 58, 6);
      ctx.fillStyle = device.on ? "#dedede" : "#fff";
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#111";
      ctx.font = "700 11px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText(device.on ? "BE" : "KI", x + w / 2, y + h - 12);
      continue;
    }

    if (device.type === "button") {
      roundRect(ctx, x, y, w, h, 10);
      ctx.fillStyle = "#1a1a1a";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2 - 4, device.pressed ? 18 : 22, 0, Math.PI * 2);
      ctx.fillStyle = "#d01212";
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "700 11px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText("NO", x + w / 2, y + h - 10);
      continue;
    }

    if (device.type === "contactor") {
      roundRect(ctx, x, y, w, h, 8);
      ctx.fillStyle = device.energized ? "#cfe8d4" : "#e7e7e7";
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#111";
      ctx.font = "700 16px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText("MK1", x + w / 2, y + 28);
      ctx.font = "12px Segoe UI";
      ctx.fillText(device.energized ? "TEKERCSEL HÚZ" : "NYUGALMI", x + w / 2, y + 52);
      ctx.fillText("NO 13–14", x + w / 2, y + 74);
      ctx.fillText(device.energized ? "ZÁRVA" : "NYITVA", x + w / 2, y + 92);
      continue;
    }

    if (device.type === "lamp") {
      const lit = sim.lampOn.has(device.id);
      roundRect(ctx, x, y, w, h, 8);
      ctx.fillStyle = "#2b2b2b";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + w / 2, y + 48, 28, 0, Math.PI * 2);
      if (lit) {
        ctx.fillStyle = "#ffe56a";
        ctx.shadowColor = "#ffd24a";
        ctx.shadowBlur = 28;
      } else {
        ctx.fillStyle = "#9a9a9a";
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff";
      ctx.font = "700 12px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText("IZZÓ 1", x + w / 2, y + h - 14);
    }
  }
}

function drawLooseHint(ctx: CanvasRenderingContext2D, point: Point) {
  ctx.beginPath();
  ctx.arc(point.x, point.y, 7, 0, Math.PI * 2);
  ctx.fillStyle = "#b87333";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ff8a1d";
  ctx.stroke();
}

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  world: World,
  sim: SimState,
  extras: RenderExtras,
) {
  fillOsb(ctx, 1100, 720);

  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.font = "700 18px Segoe UI, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Oktatófal – prototípus pálya", 48, 48);

  ctx.font = "12px Segoe UI";
  ctx.fillText("Sorkapocs-kiosztás a valós fal mintájára. Bekötés: vezeték → meghúzás / Wago kar → működés.", 48, 68);

  for (const col of world.columns) {
    const port = world.ports[col.portId];
    drawColumn(ctx, col, port, extras.hoverPortId === port.id);
  }
  for (const wago of world.wagos) drawWago(ctx, world, wago, extras.hoverPortId);

  drawDevices(ctx, world, sim);

  for (const wire of world.wires) {
    const glow = extras.debug && isWireLive(sim, world, wire.id);
    if (wire.color === "PE") strokePe(ctx, wire.points, glow);
    else strokePolyline(ctx, wire.points, extras.hoverWireId === wire.id ? 6.5 : 5.2, WIRE_COLORS[wire.color].stroke, glow);

    if (!isWireEndSecure(world, wire.startPortId)) drawLooseHint(ctx, wire.points[0]);
    if (!isWireEndSecure(world, wire.endPortId)) drawLooseHint(ctx, wire.points[wire.points.length - 1]);
  }

  if (extras.draft && extras.draft.points.length) {
    if (extras.draft.color === "PE") strokePe(ctx, extras.draft.points, false);
    else strokePolyline(ctx, extras.draft.points, 5.2, WIRE_COLORS[extras.draft.color].stroke, false);
  }

  if (extras.debug) {
    ctx.fillStyle = "rgba(20,20,20,0.72)";
    roundRect(ctx, 320, 430, 720, 70, 8);
    ctx.fill();
    ctx.fillStyle = "#ffe08a";
    ctx.font = "13px Segoe UI";
    ctx.textAlign = "left";
    const text = sim.warnings.length ? sim.warnings.join("  •  ") : "Nincs laza kötés, nincs zárlat.";
    ctx.fillText(`DEBUG: ${text}`, 336, 458);
    ctx.fillStyle = "#ddd";
    ctx.fillText("Tooltip a kapcsokon. Élő vezetékek fénylenek.", 336, 480);
  }

  if (extras.tooltip) {
    const pad = 8;
    ctx.font = "12px Segoe UI";
    const widthBox = Math.max(...extras.tooltip.lines.map((l) => ctx.measureText(l).width)) + pad * 2;
    const heightBox = extras.tooltip.lines.length * 16 + pad * 2;
    let tx = extras.tooltip.x + 14;
    let ty = extras.tooltip.y - heightBox - 8;
    if (ty < 8) ty = extras.tooltip.y + 16;
    ctx.fillStyle = "rgba(18,18,18,0.92)";
    roundRect(ctx, tx, ty, widthBox, heightBox, 6);
    ctx.fill();
    ctx.fillStyle = "#fff";
    extras.tooltip.lines.forEach((line, i) => {
      ctx.fillText(line, tx + pad, ty + pad + 12 + i * 16);
    });
  }
}
