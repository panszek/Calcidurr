import "./style.css";
import { renderWorld } from "./canvas/renderer";
import {
  cursorFor,
  hitDevice,
  hitWagoLever,
  hitWire,
  nearestPort,
  sampleDraft,
  type DraftWire,
} from "./canvas/input";
import { WIRE_COLORS } from "./data/colors";
import { createPrototypeWorld } from "./data/prototypeTrack";
import { portPotential, simulate } from "./engine/simulation";
import type { SimState, ToolMode, WireColorId, World } from "./models/types";
import {
  addWire,
  isPortOccupied,
  isWireRemovable,
  removeWire,
  setButtonPressed,
  toggleDevice,
  togglePortTight,
} from "./models/world";

const canvas = document.querySelector<HTMLCanvasElement>("#board")!;
const toolbar = document.querySelector<HTMLElement>("#toolbar")!;
const toastEl = document.querySelector<HTMLDivElement>("#toast")!;
const ctx = canvas.getContext("2d")!;

const LOGICAL = { w: 1100, h: 720 };
let view = { scale: 1, ox: 0, oy: 0 };

let world: World = createPrototypeWorld();
let sim: SimState = simulate(world);
let tool: ToolMode = "wire";
let wireColor: WireColorId = "L1";
let debug = false;
let draft: DraftWire | undefined;
let hoverPortId: string | undefined;
let hoverWireId: string | undefined;
let pressedButtonId: string | undefined;
let toastTimer = 0;

function showToast(message: string) {
  toastEl.hidden = false;
  toastEl.textContent = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastEl.hidden = true;
  }, 2800);
}

function runSim() {
  sim = simulate(world);
  if (sim.shortCircuit) showToast(sim.warnings[0] ?? "Zárlat, kismegszakító leoldott.");
}

function eventPoint(event: PointerEvent) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left - view.ox) / view.scale,
    y: (event.clientY - rect.top - view.oy) / view.scale,
  };
}

function paintToolbar() {
  const tools: { id: ToolMode; label: string }[] = [
    { id: "wire", label: "Vezetékezés" },
    { id: "screwdriver", label: "Csavarhúzó" },
    { id: "hand", label: "Kéz / ujj" },
    { id: "cutter", label: "Csípőfogó" },
  ];

  const colorButtons = (Object.keys(WIRE_COLORS) as WireColorId[])
    .map((id) => {
      const c = WIRE_COLORS[id];
      const active = wireColor === id && tool === "wire" ? "active" : "";
      return `<label class="chip ${active}">
        <input type="radio" name="color" value="${id}" ${wireColor === id ? "checked" : ""} />
        <span class="swatch" style="background:${c.stroke}"></span>${c.name}
      </label>`;
    })
    .join("");

  toolbar.innerHTML = `
    <div class="group">
      ${tools
        .map(
          (t) =>
            `<button type="button" data-tool="${t.id}" class="${tool === t.id ? "active" : ""}">${t.label}</button>`,
        )
        .join("")}
    </div>
    <div class="group" data-colors>${colorButtons}</div>
    <div class="group">
      <button type="button" data-debug class="${debug ? "active" : ""}">Hibakereső mód</button>
      <button type="button" data-reset>Pálya törlése</button>
    </div>
  `;
}

function resize() {
  const stage = canvas.parentElement!;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = Math.max(stage.clientWidth, 1);
  const cssH = Math.max(stage.clientHeight, 1);
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  const scale = Math.min(cssW / LOGICAL.w, cssH / LOGICAL.h);
  view = {
    scale,
    ox: (cssW - LOGICAL.w * scale) / 2,
    oy: (cssH - LOGICAL.h * scale) / 2,
  };
  draw();
}

function tooltipForPort(portId: string) {
  if (!debug) return undefined;
  const port = world.ports[portId];
  const node = world.nodes[port.nodeId];
  const pot = portPotential(sim, world, portId);
  const locked = port.tight ? (port.kind === "wago" ? "kar lehajtva" : "csavar meghúzva") : "laza";
  return {
    x: port.x,
    y: port.y,
    lines: [
      node.deviceName,
      `${node.functionLabel} (${node.label})`,
      `Potenciál: ${pot === "none" ? "0V" : pot}`,
      locked,
    ],
  };
}

function draw() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#1c1b19";
  ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, dpr * view.ox, dpr * view.oy);
  renderWorld(ctx, world, sim, {
    debug,
    hoverPortId,
    hoverWireId,
    draft: draft ? { points: draft.points, color: draft.color } : undefined,
    tooltip: hoverPortId ? tooltipForPort(hoverPortId) : undefined,
  });
}

canvas.addEventListener("pointerdown", (event) => {
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch {
    /* automatizált / nem primer pointer */
  }
  const p = eventPoint(event);
  if (tool === "wire") {
    const port = nearestPort(world, p);
    if (!port || isPortOccupied(world, port.id)) {
      showToast("Kezdd a vezetéket egy üres kapocsnál (15 px tapadás).");
      return;
    }
    draft = { color: wireColor, points: [{ x: port.x, y: port.y }, p], startPortId: port.id };
    draw();
    return;
  }

  if (tool === "screwdriver") {
    const port = nearestPort(world, p, 16);
    if (port?.kind === "screw") {
      togglePortTight(world, port.id);
      runSim();
      draw();
    }
    return;
  }

  if (tool === "hand") {
    const lever = hitWagoLever(world, p);
    if (lever) {
      togglePortTight(world, lever.id);
      runSim();
      draw();
      return;
    }
    const device = hitDevice(world, p);
    if (device?.type === "button") {
      pressedButtonId = device.id;
      setButtonPressed(world, device.id, true);
      runSim();
      draw();
      return;
    }
    if (device && device.type !== "lamp" && device.type !== "contactor") {
      toggleDevice(world, device.id);
      runSim();
      draw();
    }
    return;
  }

  if (tool === "cutter") {
    const wire = hitWire(world, p, 8);
    if (!wire) return;
    if (!isWireRemovable(world, wire.id)) {
      showToast("A csípőfogó csak laza kötésű vezetéket vág: mindkét véget lazítsd ki.");
      return;
    }
    removeWire(world, wire.id);
    runSim();
    draw();
  }
});

canvas.addEventListener("pointermove", (event) => {
  const p = eventPoint(event);
  hoverPortId = nearestPort(world, p)?.id;
  hoverWireId = hitWire(world, p, 8)?.id;
  canvas.style.cursor = cursorFor(tool);
  if (draft) {
    const snap = nearestPort(world, p);
    const target =
      snap && snap.id !== draft.startPortId && !isPortOccupied(world, snap.id)
        ? { x: snap.x, y: snap.y }
        : p;
    draft.points = sampleDraft(draft.points, target);
  }
  draw();
});

function finishDraft(p: { x: number; y: number }) {
  if (!draft) return;
  const end = nearestPort(world, p);
  if (
    end &&
    end.id !== draft.startPortId &&
    !isPortOccupied(world, end.id) &&
    draft.points.length >= 2
  ) {
    const points = [...draft.points];
    points[points.length - 1] = { x: end.x, y: end.y };
    addWire(world, draft.color, points, draft.startPortId, end.id);
    runSim();
  }
  draft = undefined;
  draw();
}

canvas.addEventListener("pointerup", (event) => {
  const p = eventPoint(event);
  if (draft) finishDraft(p);
  if (pressedButtonId) {
    setButtonPressed(world, pressedButtonId, false);
    pressedButtonId = undefined;
    runSim();
    draw();
  }
});

canvas.addEventListener("pointerleave", () => {
  hoverPortId = undefined;
  hoverWireId = undefined;
  draw();
});

toolbar.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const toolBtn = target.closest<HTMLButtonElement>("[data-tool]");
  if (toolBtn?.dataset.tool) {
    tool = toolBtn.dataset.tool as ToolMode;
    paintToolbar();
    return;
  }
  if (target.closest("[data-debug]")) {
    debug = !debug;
    paintToolbar();
    draw();
    return;
  }
  if (target.closest("[data-reset]")) {
    world = createPrototypeWorld();
    draft = undefined;
    runSim();
    paintToolbar();
    draw();
  }
});

toolbar.addEventListener("change", (event) => {
  const input = event.target as HTMLInputElement;
  if (input.name === "color") {
    wireColor = input.value as WireColorId;
    tool = "wire";
    paintToolbar();
  }
});

window.addEventListener("resize", resize);
paintToolbar();
resize();
runSim();
draw();

Object.defineProperty(window, "__simApp", {
  configurable: true,
  get: () => ({ world, sim, tool, debug }),
});
