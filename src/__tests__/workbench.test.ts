import { describe, expect, it } from "vitest";
import {
  cursorFor,
  hitAnyWorkbenchInteractive,
  hitWagoBox,
  hitWorkbenchClamp,
  hitWorkbenchLegendSheet,
  hitWorkbenchSpool,
  hitWorkbenchTester,
  hitWorkbenchTool,
  WAGO_BOXES,
  WORKBENCH_CLAMP_BOUNDS,
  WORKBENCH_LEGEND_SHEET_BOUNDS,
  WORKBENCH_SPOOL_RACK_BOUNDS,
  WORKBENCH_SPOOLS,
  WORKBENCH_TESTER_BOUNDS,
  WORKBENCH_TOOL_MAT_BOUNDS,
  WORKBENCH_TOOLS,
} from "../canvas/input";
import { renderWorld } from "../canvas/renderer";
import { createPrototypeWorld } from "../data/prototypeTrack";
import { simulate } from "../engine/simulation";
import type { Rect, ToolMode, WireColorId } from "../models/types";
import {
  getSpoolIconSvg,
  getToolbarSpools,
  getToolCursor,
  SPOOL_ORDER,
  TOOLBAR_HAND_TOOLS,
  TOOLBAR_INSTRUMENTS,
  UTILITY_ICONS,
} from "../ui/toolIcons";

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function createMockCanvasContext() {
  const alphasSeen: number[] = [];
  let currentAlpha = 1;

  const gradientStub = {
    addColorStop: () => {},
  };

  const target: Record<string, unknown> = {
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    lineDashOffset: 0,
    font: "10px sans-serif",
    textAlign: "left",
    textBaseline: "alphabetic",
    shadowColor: "transparent",
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arcTo: () => {},
    arc: () => {},
    ellipse: () => {},
    rect: () => {},
    roundRect: () => {},
    quadraticCurveTo: () => {},
    bezierCurveTo: () => {},
    fill: () => {
      alphasSeen.push(currentAlpha);
    },
    stroke: () => {
      alphasSeen.push(currentAlpha);
    },
    fillRect: () => {
      alphasSeen.push(currentAlpha);
    },
    strokeRect: () => {},
    fillText: () => {},
    setLineDash: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    setTransform: () => {},
    measureText: (text: string) => ({ width: text.length * 6 }),
    createLinearGradient: () => gradientStub,
    createRadialGradient: () => gradientStub,
  };

  Object.defineProperty(target, "globalAlpha", {
    get: () => currentAlpha,
    set: (val: number) => {
      currentAlpha = val;
      alphasSeen.push(val);
    },
  });

  return {
    ctx: target as unknown as CanvasRenderingContext2D,
    alphasSeen,
  };
}

describe("Thread 8: Graphical SVG toolbar icons, interactive workbench & custom tool cursors", () => {
  describe("Text-free SVG toolbar icon definitions (toolIcons.ts)", () => {
    it("provides text-free SVG icons and Hungarian tooltips for all hand tools and instruments", () => {
      expect(TOOLBAR_HAND_TOOLS.map((t) => t.id)).toEqual(["hand", "screwdriver", "cutter"]);
      expect(TOOLBAR_INSTRUMENTS.map((t) => t.id)).toEqual(["tester", "clamp"]);

      for (const item of [...TOOLBAR_HAND_TOOLS, ...TOOLBAR_INSTRUMENTS]) {
        expect(item.title.length).toBeGreaterThan(10);
        expect(item.shortTip.length).toBeGreaterThan(3);
        expect(item.svg).toContain("<svg");
        expect(item.svg).toContain("</svg>");
        // Nincs szöveges <text> elem az ikonokban — tisztán grafikus szimbólumok
        expect(item.svg).not.toContain("<text");
      }
    });

    it("provides distinct wire spool SVGs with protruding copper wire tips for all 6 wire colors", () => {
      const spools = getToolbarSpools();
      expect(spools.map((s) => s.color)).toEqual([...SPOOL_ORDER]);
      expect(spools.filter((s) => s.isPrimaryStandard).map((s) => s.color)).toEqual([
        "L1",
        "N",
        "PE",
      ]);

      const svgSet = new Set<string>();
      for (const spool of spools) {
        expect(spool.svg).toContain("<svg");
        expect(spool.svg).toContain("#fbbf24"); // Blankolt réz vezetékvég
        expect(spool.svg).not.toContain("<text");
        expect(spool.title.length).toBeGreaterThan(10);
        svgSet.add(spool.svg);
      }
      // Mind a 6 színű kábeldob egyedi SVG-vel rendelkezik
      expect(svgSet.size).toBe(6);

      // Zöld-sárga PE tekercs mindkét szabványos színt tartalmazza
      const peSvg = getSpoolIconSvg("PE");
      expect(peSvg).toContain("#16a34a");
      expect(peSvg).toContain("#facc15");
    });

    it("provides text-free graphical SVG icons for all 8 utility actions", () => {
      const keys = Object.keys(UTILITY_ICONS);
      expect(keys).toEqual([
        "zoomIn",
        "zoomOut",
        "zoomReset",
        "fitView",
        "legend",
        "colorCheck",
        "debug",
        "reset",
      ]);

      for (const def of Object.values(UTILITY_ICONS)) {
        expect(def.svg).toContain("<svg");
        expect(def.svg).not.toContain("<text");
        expect(def.title.length).toBeGreaterThan(8);
        expect(def.shortTip.length).toBeGreaterThan(4);
      }
    });
  });

  describe("Custom SVG tool cursors", () => {
    it("generates browser-safe encoded SVG data-URI cursors with hotspot and CSS fallback", () => {
      const modes: Exclude<ToolMode, "hand">[] = [
        "wire",
        "screwdriver",
        "cutter",
        "tester",
        "clamp",
      ];

      for (const mode of modes) {
        const css = cursorFor(mode, false);
        expect(css).toMatch(/^url\("data:image\/svg\+xml,[^"]+"\)\s+\d+\s+\d+,\s*(pointer|crosshair)$/);
        // Nem maradhat kódolatlan '#' karakter az URL-ben (böngésző-kompatibilitás)
        const urlPart = css.split('"')[1]!;
        expect(urlPart).not.toContain("#");
      }

      expect(cursorFor("hand", false)).toBe("grab");
      for (const mode of ["hand", ...modes] as ToolMode[]) {
        expect(cursorFor(mode, true)).toBe("grabbing");
      }
    });

    it("adapts wire-end cursor insulation color to the selected wire spool", () => {
      const colors: WireColorId[] = ["L1", "N", "PE", "L2", "L3", "CTRL"];
      const cursors = colors.map((c) => getToolCursor("wire", false, c));
      expect(new Set(cursors).size).toBe(colors.length);

      // Kék (N) vezeték kurzora tartalmazza a kék szigetelés kódolt színét (%231d5fb0)
      expect(getToolCursor("wire", false, "N")).toContain("%231d5fb0");
      // PE vezeték kurzora tartalmazza a zöld és sárga csíkozást
      expect(getToolCursor("wire", false, "PE")).toContain("%2316a34a");
      expect(getToolCursor("wire", false, "PE")).toContain("%23facc15");
    });
  });

  describe("Interactive workbench hit-testing & non-overlapping layout", () => {
    it("hits all 6 wire spools on the workbench rack and misses gaps", () => {
      expect(WORKBENCH_SPOOLS).toHaveLength(6);

      for (const spool of WORKBENCH_SPOOLS) {
        expect(spool.y).toBeGreaterThanOrEqual(1070);
        expect(spool.y + spool.h).toBeLessThanOrEqual(1300);
        expect(spool.x).toBeGreaterThanOrEqual(WORKBENCH_SPOOL_RACK_BOUNDS.x);
        expect(spool.x + spool.w).toBeLessThanOrEqual(
          WORKBENCH_SPOOL_RACK_BOUNDS.x + WORKBENCH_SPOOL_RACK_BOUNDS.w,
        );

        const center = { x: spool.x + spool.w / 2, y: spool.y + spool.h / 2 };
        expect(hitWorkbenchSpool(center)?.color).toBe(spool.color);
        expect(hitAnyWorkbenchInteractive(center)).toBe(true);
      }

      // Tartókonzol rés a PE és L2 tekercsek között (x = 333) nem talál el tekercset
      expect(hitWorkbenchSpool({ x: 333, y: 1150 })).toBeUndefined();
      expect(hitWorkbenchSpool({ x: 200, y: 500 })).toBeUndefined();
    });

    it("hits all 3 VDE hand tools (glove, screwdriver, cutter) on the workbench tool mat", () => {
      expect(WORKBENCH_TOOLS.map((t) => t.tool)).toEqual(["hand", "screwdriver", "cutter"]);

      for (const toolDef of WORKBENCH_TOOLS) {
        expect(toolDef.x).toBeGreaterThanOrEqual(WORKBENCH_TOOL_MAT_BOUNDS.x);
        expect(toolDef.x + toolDef.w).toBeLessThanOrEqual(
          WORKBENCH_TOOL_MAT_BOUNDS.x + WORKBENCH_TOOL_MAT_BOUNDS.w,
        );

        const center = { x: toolDef.x + toolDef.w / 2, y: toolDef.y + toolDef.h / 2 };
        expect(hitWorkbenchTool(center)?.tool).toBe(toolDef.tool);
        expect(hitAnyWorkbenchInteractive(center)).toBe(true);
      }

      expect(hitWorkbenchTool({ x: 500, y: 1150 })).toBeUndefined();
    });

    it("hits the workbench legend sheet, instruments and WAGO boxes without any pairwise overlap", () => {
      const world = createPrototypeWorld();
      const motor = world.devices.find((d) => d.id === "dev_motor")!;

      const legendCenter = {
        x: WORKBENCH_LEGEND_SHEET_BOUNDS.x + WORKBENCH_LEGEND_SHEET_BOUNDS.w / 2,
        y: WORKBENCH_LEGEND_SHEET_BOUNDS.y + WORKBENCH_LEGEND_SHEET_BOUNDS.h / 2,
      };
      expect(hitWorkbenchLegendSheet(legendCenter)).toBe(true);
      expect(hitAnyWorkbenchInteractive(legendCenter)).toBe(true);
      expect(hitWorkbenchLegendSheet({ x: 1285, y: 800 })).toBe(false);

      expect(
        hitWorkbenchTester({
          x: WORKBENCH_TESTER_BOUNDS.x + 10,
          y: WORKBENCH_TESTER_BOUNDS.y + 10,
        }),
      ).toBe(true);
      expect(
        hitWorkbenchClamp({
          x: WORKBENCH_CLAMP_BOUNDS.x + 10,
          y: WORKBENCH_CLAMP_BOUNDS.y + 10,
        }),
      ).toBe(true);
      expect(hitWagoBox({ x: WAGO_BOXES[0].x + 10, y: WAGO_BOXES[0].y + 10 })?.slots).toBe(3);
      expect(hitWagoBox({ x: WAGO_BOXES[1].x + 10, y: WAGO_BOXES[1].y + 10 })?.slots).toBe(5);
      expect(hitAnyWorkbenchInteractive({ x: 600, y: 600 })).toBe(false);

      // Ellenőrizzük, hogy a munkapad összes interaktív eleme és a 3F motor páronként átfedésmentes
      const allStations: { label: string; rect: Rect }[] = [
        ...WORKBENCH_SPOOLS.map((s) => ({
          label: `spool:${s.color}`,
          rect: { x: s.x, y: s.y, w: s.w, h: s.h },
        })),
        ...WORKBENCH_TOOLS.map((t) => ({
          label: `tool:${t.tool}`,
          rect: { x: t.x, y: t.y, w: t.w, h: t.h },
        })),
        { label: "tester", rect: { ...WORKBENCH_TESTER_BOUNDS } },
        { label: "clamp", rect: { ...WORKBENCH_CLAMP_BOUNDS } },
        ...WAGO_BOXES.map((b) => ({
          label: `wago:${b.slots}`,
          rect: { x: b.x, y: b.y, w: b.w, h: b.h },
        })),
        { label: "legendSheet", rect: { ...WORKBENCH_LEGEND_SHEET_BOUNDS } },
        { label: "motor3p", rect: motor.bounds },
      ];

      for (let i = 0; i < allStations.length; i++) {
        for (let j = i + 1; j < allStations.length; j++) {
          expect(
            rectsOverlap(allStations[i].rect, allStations[j].rect),
            `Overlap between ${allStations[i].label} and ${allStations[j].label}`,
          ).toBe(false);
        }
      }
    });
  });

  describe("Workbench Canvas rendering & active tool silhouette behavior", () => {
    it("renders all workbench stations cleanly across tool modes and draws translucent silhouettes for active instruments", () => {
      const world = createPrototypeWorld();
      const sim = simulate(world);

      const modes: ToolMode[] = ["wire", "hand", "screwdriver", "cutter", "tester", "clamp"];
      for (const tool of modes) {
        const { ctx, alphasSeen } = createMockCanvasContext();
        expect(() =>
          renderWorld(ctx, world, sim, {
            debug: false,
            tool,
            wireColor: tool === "wire" ? "PE" : "L1",
            hoverSpoolColor: "N",
            hoverWorkbenchTool: "screwdriver",
            hoverWorkbenchTester: true,
            hoverWorkbenchClamp: true,
            hoverLegendSheet: true,
          }),
        ).not.toThrow();

        // Amikor a UNI-T vizsgáló vagy a lakatfogó kézben van, a munkapadi helyén 0.24-es sziluett-alfa aktiválódik
        if (tool === "tester" || tool === "clamp") {
          expect(alphasSeen).toContain(0.24);
        }
      }
    });
  });
});
