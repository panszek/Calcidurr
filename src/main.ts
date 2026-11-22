import "./style.css";
import { renderWorld } from "./canvas/renderer";
import {
  cursorFor,
  hitColumnUpperHalf,
  hitDevice,
  hitLegendPoster,
  hitScrewdriverTarget,
  hitWago,
  hitWagoLever,
  hitWire,
  nearestPort,
  sampleDraft,
  type DraftWire,
} from "./canvas/input";
import { LegendTableViewer } from "./canvas/legendTable";
import { WIRE_COLORS } from "./data/colors";
import { createPrototypeWorld } from "./data/prototypeTrack";
import { portPotential, simulate } from "./engine/simulation";
import type { Port, SimState, ToolMode, WireColorId, World } from "./models/types";
import {
  addWire,
  hasWagoWires,
  isPortOccupied,
  isWireRemovable,
  moveWago,
  removeWire,
  setButtonPressed,
  tickWorld,
  toggleDevice,
  togglePortTight,
} from "./models/world";

const canvas = document.querySelector<HTMLCanvasElement>("#board")!;
const toolbar = document.querySelector<HTMLElement>("#toolbar")!;
const toastEl = document.querySelector<HTMLDivElement>("#toast")!;
const ctx = canvas.getContext("2d")!;

const LOGICAL = { w: 2200, h: 1300 };
let view = { scale: 0.5, ox: 0, oy: 0 };

let world: World = createPrototypeWorld();
let sim: SimState = simulate(world);
let tool: ToolMode = "wire";
let wireColor: WireColorId = "L1";
let debug = false;
let draft: DraftWire | undefined;
let hoverPortId: string | undefined;
let hoverWireId: string | undefined;
let hoveredWagoId: string | undefined;
let draggedWago:
  | {
      id: string;
      startX: number;
      startY: number;
      ox: number;
      oy: number;
      moved: boolean;
    }
  | undefined;
let pendingLeverPort: Port | undefined;
let pressedButtonId: string | undefined;
let toastTimer = 0;

const legendViewer = new LegendTableViewer({
  onHoverCol: (colId) => {
    hoverPortId = colId ? `p-${colId.replace(/^col-/, "")}` : undefined;
    draw();
  },
});

// Panning state
let isPanning = false;
let panStart = { clientX: 0, clientY: 0, ox: 0, oy: 0 };
let spacePressed = false;

function showToast(message: string) {
  toastEl.hidden = false;
  toastEl.textContent = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastEl.hidden = true;
  }, 3200);
}

function runSim() {
  sim = simulate(world);
  if (sim.shortCircuit) {
    showToast(sim.warnings[0] ?? "Zárlat keletkezett! A kismegszakító leoldott.");
  }
}

function eventPoint(event: PointerEvent) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left - view.ox) / view.scale,
    y: (event.clientY - rect.top - view.oy) / view.scale,
  };
}

function zoomAt(factor: number, clientX?: number, clientY?: number) {
  const stage = canvas.parentElement!;
  const rect = canvas.getBoundingClientRect();
  const cx = clientX !== undefined ? clientX - rect.left : stage.clientWidth / 2;
  const cy = clientY !== undefined ? clientY - rect.top : stage.clientHeight / 2;
  const wx = (cx - view.ox) / view.scale;
  const wy = (cy - view.oy) / view.scale;

  const newScale = Math.max(0.2, Math.min(2.5, view.scale * factor));
  view.scale = newScale;
  view.ox = cx - wx * newScale;
  view.oy = cy - wy * newScale;
  draw();
}

function fitView() {
  const stage = canvas.parentElement!;
  const cssW = Math.max(stage.clientWidth, 1);
  const cssH = Math.max(stage.clientHeight, 1);
  const scale = Math.min(cssW / LOGICAL.w, cssH / LOGICAL.h) * 0.96;
  view = {
    scale,
    ox: (cssW - LOGICAL.w * scale) / 2,
    oy: (cssH - LOGICAL.h * scale) / 2,
  };
  draw();
}

function resetZoom() {
  const stage = canvas.parentElement!;
  const cssW = Math.max(stage.clientWidth, 1);
  const cssH = Math.max(stage.clientHeight, 1);
  view.scale = 1.0;
  view.ox = Math.max(20, (cssW - LOGICAL.w) / 2);
  view.oy = Math.max(20, (cssH - LOGICAL.h) / 2);
  draw();
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
      <button type="button" data-zoom-in title="Nagyítás">+</button>
      <button type="button" data-zoom-out title="Kicsinyítés">−</button>
      <button type="button" data-zoom-reset title="100% nézet">1:1</button>
      <button type="button" data-fit title="Teljes fal nézet">Teljes fal</button>
    </div>
    <div class="group">
      <button type="button" data-legend class="highlight-btn" title="Sorkapocs-kiosztási magyarázó tábla megnyitása">📋 Sorkapocs tábla</button>
    </div>
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
  fitView();
}

function tooltipForPort(portId: string) {
  if (!debug) return undefined;
  const port = world.ports[portId];
  if (!port) return undefined;
  const node = world.nodes[port.nodeId];
  if (!node) return undefined;
  const pot = portPotential(sim, world, portId);
  const locked = port.tight
    ? port.kind === "wago"
      ? "kar lehajtva (kontakt zárva)"
      : "csavar meghúzva"
    : "laza (nem vezet!)";
  return {
    x: port.x,
    y: port.y,
    lines: [
      node.deviceName,
      `${node.functionLabel} [${node.label}]`,
      `Potenciál: ${pot === "none" ? "0V (Feszültségmentes)" : pot}`,
      locked,
    ],
  };
}

function draw() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#181716";
  ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, dpr * view.ox, dpr * view.oy);
  renderWorld(ctx, world, sim, {
    debug,
    hoverPortId,
    hoverWireId,
    hoverWagoId: hoveredWagoId,
    draggedWagoId: draggedWago?.id,
    draft: draft ? { points: draft.points, color: draft.color } : undefined,
    tooltip: hoverPortId ? tooltipForPort(hoverPortId) : undefined,
  });
}

// Canvas Wheel for Zoom
canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.15 : 0.85;
    zoomAt(factor, event.clientX, event.clientY);
  },
  { passive: false },
);

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

canvas.addEventListener("pointerdown", (event) => {
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch {
    /* pointer capture ignore */
  }

  // Right-click or middle-click or space+click starts panning
  if (event.button === 2 || event.button === 1 || spacePressed) {
    isPanning = true;
    panStart = {
      clientX: event.clientX,
      clientY: event.clientY,
      ox: view.ox,
      oy: view.oy,
    };
    canvas.style.cursor = "grabbing";
    return;
  }

  const p = eventPoint(event);

  // Magyarázó plakátra való kattintás az oktatófalon
  if (hitLegendPoster(p)) {
    legendViewer.open();
    return;
  }

  if (tool === "wire") {
    const upperCol = hitColumnUpperHalf(world, p);
    if (upperCol) {
      showToast("A sorkapcsok felső oldala gyárilag előszerelt és fixen bekötött! Új vezetéket kizárólag az alsó nyílásba köthetsz.");
      return;
    }

    const port = nearestPort(world, p);
    if (!port) {
      const clickedWago = hitWago(world, p);
      if (clickedWago) {
        if (!hasWagoWires(world, clickedWago.id)) {
          draggedWago = {
            id: clickedWago.id,
            startX: p.x,
            startY: p.y,
            ox: p.x - clickedWago.x,
            oy: p.y - clickedWago.y,
            moved: false,
          };
          draw();
          return;
        }
        showToast("Bekötött WAGO nem mozgatható! Előbb kösd ki a vezetékeket.");
        return;
      }

      // Clicked on empty space: start panning
      isPanning = true;
      panStart = {
        clientX: event.clientX,
        clientY: event.clientY,
        ox: view.ox,
        oy: view.oy,
      };
      canvas.style.cursor = "grabbing";
      return;
    }
    if (isPortOccupied(world, port.id)) {
      showToast("A kapocs már foglalt! Egy kapocspontba egyszerre egy vezeték köthető.");
      return;
    }
    draft = { color: wireColor, points: [{ x: port.x, y: port.y }, p], startPortId: port.id };
    draw();
    return;
  }

  if (tool === "screwdriver") {
    const upperCol = hitColumnUpperHalf(world, p);
    if (upperCol) {
      showToast("A felső csavar gyárilag meg van húzva és fix. Csak az alsó csavart tudod meghúzni/lazítani!");
      return;
    }

    const port = hitScrewdriverTarget(world, p);
    if (port?.kind === "screw") {
      togglePortTight(world, port.id);
      runSim();
      draw();
    } else {
      isPanning = true;
      panStart = {
        clientX: event.clientX,
        clientY: event.clientY,
        ox: view.ox,
        oy: view.oy,
      };
    }
    return;
  }

  if (tool === "hand") {
    const clickedWago = hitWago(world, p);
    if (clickedWago) {
      const isWired = hasWagoWires(world, clickedWago.id);
      const lever = hitWagoLever(world, p);

      if (isWired) {
        if (lever) {
          togglePortTight(world, lever.id);
          runSim();
          draw();
          return;
        }
        showToast("Bekötött WAGO nem mozgatható! Előbb kösd ki a vezetékeket.");
        return;
      }

      // Üres wago mozgatható
      if (lever) {
        pendingLeverPort = lever;
      }
      draggedWago = {
        id: clickedWago.id,
        startX: p.x,
        startY: p.y,
        ox: p.x - clickedWago.x,
        oy: p.y - clickedWago.y,
        moved: false,
      };
      draw();
      return;
    }

    const device = hitDevice(world, p);
    if (device) {
      if (
        device.type === "button" ||
        device.type === "button_no" ||
        device.type === "button_nc" ||
        device.type === "push_switch_101n"
      ) {
        pressedButtonId = device.id;
        setButtonPressed(world, device.id, true);
        runSim();
        draw();
        return;
      }

      if (device.type === "switch_105") {
        // Rocker 1 (left) or Rocker 2 (right)
        const midX = device.bounds.x + device.bounds.w / 2;
        const subControl = p.x < midX ? 1 : 2;
        toggleDevice(world, device.id, subControl);
        runSim();
        draw();
        return;
      }

      if (device.type !== "lamp" && device.type !== "socket") {
        toggleDevice(world, device.id);
        runSim();
        draw();
        return;
      }
    }

    // Hand clicked empty space: start panning
    isPanning = true;
    panStart = {
      clientX: event.clientX,
      clientY: event.clientY,
      ox: view.ox,
      oy: view.oy,
    };
    canvas.style.cursor = "grabbing";
    return;
  }

  if (tool === "cutter") {
    const wire = hitWire(world, p, 9);
    if (!wire) {
      isPanning = true;
      panStart = {
        clientX: event.clientX,
        clientY: event.clientY,
        ox: view.ox,
        oy: view.oy,
      };
      return;
    }
    if (!isWireRemovable(world, wire.id)) {
      showToast("A csípőfogó csak laza kötésű vezetéket vág: mindkét végét lazítsd ki előbb.");
      return;
    }
    removeWire(world, wire.id);
    runSim();
    draw();
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (isPanning) {
    view.ox = panStart.ox + (event.clientX - panStart.clientX);
    view.oy = panStart.oy + (event.clientY - panStart.clientY);
    draw();
    return;
  }

  const p = eventPoint(event);

  if (draggedWago) {
    const distFromStart = Math.hypot(p.x - draggedWago.startX, p.y - draggedWago.startY);
    if (distFromStart > 4) {
      draggedWago.moved = true;
      pendingLeverPort = undefined;
    }
    if (draggedWago.moved) {
      const wago = world.wagos.find((w) => w.id === draggedWago!.id);
      if (wago) {
        const w = 18 + wago.portIds.length * 24;
        const nx = Math.max(10, Math.min(LOGICAL.w - w - 10, p.x - draggedWago.ox));
        const ny = Math.max(10, Math.min(LOGICAL.h - 76, p.y - draggedWago.oy));
        moveWago(world, draggedWago.id, nx, ny);
      }
      canvas.style.cursor = "grabbing";
      draw();
      return;
    }
  }

  hoverPortId = (tool === "screwdriver" ? hitScrewdriverTarget(world, p) : nearestPort(world, p))?.id;
  hoverWireId = hitWire(world, p, 9)?.id;
  const hoveredWago = hitWago(world, p);
  hoveredWagoId = hoveredWago?.id;

  if (hitLegendPoster(p)) {
    canvas.style.cursor = "pointer";
  } else if (tool === "hand") {
    if (hitWagoLever(world, p)) {
      canvas.style.cursor = "pointer";
    } else if (hoveredWago && !hasWagoWires(world, hoveredWago.id)) {
      canvas.style.cursor = "grab";
    } else if (hitDevice(world, p)) {
      canvas.style.cursor = "pointer";
    } else {
      canvas.style.cursor = cursorFor(tool, isPanning);
    }
  } else if (tool === "wire") {
    if (nearestPort(world, p)) {
      canvas.style.cursor = "crosshair";
    } else if (hoveredWago && !hasWagoWires(world, hoveredWago.id)) {
      canvas.style.cursor = "grab";
    } else {
      canvas.style.cursor = cursorFor(tool, isPanning);
    }
  } else {
    canvas.style.cursor = cursorFor(tool, isPanning);
  }

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
  if (isPanning) {
    isPanning = false;
    canvas.style.cursor = cursorFor(tool);
  }

  if (draggedWago) {
    if (!draggedWago.moved && pendingLeverPort) {
      togglePortTight(world, pendingLeverPort.id);
      runSim();
    }
    draggedWago = undefined;
    pendingLeverPort = undefined;
    canvas.style.cursor = cursorFor(tool);
    draw();
  }

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
  if (isPanning) {
    isPanning = false;
  }
  if (draggedWago) {
    draggedWago = undefined;
    pendingLeverPort = undefined;
  }
  hoverPortId = undefined;
  hoverWireId = undefined;
  hoveredWagoId = undefined;
  draw();
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") spacePressed = true;
});

window.addEventListener("keyup", (e) => {
  if (e.code === "Space") spacePressed = false;
});

toolbar.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;

  const toolBtn = target.closest<HTMLButtonElement>("[data-tool]");
  if (toolBtn?.dataset.tool) {
    tool = toolBtn.dataset.tool as ToolMode;
    paintToolbar();
    return;
  }

  if (target.closest("[data-zoom-in]")) {
    zoomAt(1.2);
    return;
  }
  if (target.closest("[data-zoom-out]")) {
    zoomAt(0.8);
    return;
  }
  if (target.closest("[data-zoom-reset]")) {
    resetZoom();
    return;
  }
  if (target.closest("[data-fit]")) {
    fitView();
    return;
  }

  if (target.closest("[data-legend]")) {
    legendViewer.toggle();
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
    draggedWago = undefined;
    pendingLeverPort = undefined;
    hoveredWagoId = undefined;
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

// Dynamic Animation & Simulation Loop for Timers
let lastTime = performance.now();
function animLoop(now: number) {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  const changed = tickWorld(world, dt);
  if (changed) {
    runSim();
    draw();
  } else {
    // Redraw if any timer is actively running so numbers update
    const isAnyTimerRunning = world.devices.some(
      (d) =>
        (d.type === "staircase_relay" && (d.timerRemaining ?? 0) > 0) ||
        (d.type === "motion_sensor" && (d.timerRemaining ?? 0) > 0) ||
        (d.type === "timer_relay" && d.energized && !d.relayState),
    );
    if (isAnyTimerRunning) {
      draw();
    }
  }

  requestAnimationFrame(animLoop);
}
requestAnimationFrame(animLoop);

window.addEventListener("resize", resize);
paintToolbar();
resize();
runSim();
draw();

Object.defineProperty(window, "__simApp", {
  configurable: true,
  get: () => ({ world, sim, tool, debug }),
});
