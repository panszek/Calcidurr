import { WIRE_COLORS } from "../data/colors";
import type { ToolMode, WireColorId } from "../models/types";

export interface ToolbarToolIconDef {
  id: Exclude<ToolMode, "wire">;
  title: string;
  shortTip: string;
  svg: string;
}

export interface ToolbarSpoolIconDef {
  color: WireColorId;
  title: string;
  shortTip: string;
  isPrimaryStandard: boolean;
  svg: string;
}

export type UtilityIconName =
  | "zoomIn"
  | "zoomOut"
  | "zoomReset"
  | "fitView"
  | "legend"
  | "colorCheck"
  | "debug"
  | "reset";

export interface UtilityIconDef {
  name: UtilityIconName;
  title: string;
  shortTip: string;
  svg: string;
}

/**
 * Sorrend a felső eszköztáron és a munkapadi tekercsállványon:
 * elöl a 3 szabványos alapszín (Fekete, Kék, Zöld-sárga), majd a kiegészítő színek (Barna, Szürke, Piros).
 */
export const SPOOL_ORDER: readonly WireColorId[] = ["L1", "N", "PE", "L2", "L3", "CTRL"];

const SPOOL_META: Record<
  WireColorId,
  {
    title: string;
    shortTip: string;
    bodyFill: string;
    highlight: string;
    shadow: string;
    isPrimaryStandard: boolean;
  }
> = {
  L1: {
    title: "Fekete vezetéktekercs (1,5 mm²) — fázis- és kapcsolt szálak bekötése",
    shortTip: "Fekete tekercs (Fázis / L)",
    bodyFill: "#1e2024",
    highlight: "#525866",
    shadow: "#090a0c",
    isPrimaryStandard: true,
  },
  N: {
    title: "Kék vezetéktekercs (1,5 mm²) — nullavezető (N) bekötése",
    shortTip: "Kék tekercs (Nulla / N)",
    bodyFill: "#1d5fb0",
    highlight: "#60a5fa",
    shadow: "#1e3a8a",
    isPrimaryStandard: true,
  },
  PE: {
    title: "Zöld-sárga vezetéktekercs (1,5 mm²) — védővezető (PE) bekötése",
    shortTip: "Zöld-sárga tekercs (PE)",
    bodyFill: "#16a34a",
    highlight: "#facc15",
    shadow: "#14532d",
    isPrimaryStandard: true,
  },
  L2: {
    title: "Barna vezetéktekercs (1,5 mm²) — L2 fázis / egyéb ér",
    shortTip: "Barna tekercs (L2)",
    bodyFill: "#783f19",
    highlight: "#b46936",
    shadow: "#451a03",
    isPrimaryStandard: false,
  },
  L3: {
    title: "Szürke vezetéktekercs (1,5 mm²) — L3 fázis / egyéb ér",
    shortTip: "Szürke tekercs (L3)",
    bodyFill: "#7d8590",
    highlight: "#cbd5e1",
    shadow: "#475569",
    isPrimaryStandard: false,
  },
  CTRL: {
    title: "Piros vezetéktekercs (1,5 mm²) — segéd- / vezérlőszál",
    shortTip: "Piros tekercs (Vezérlés)",
    bodyFill: "#dc2626",
    highlight: "#fca5a5",
    shadow: "#7f1d1d",
    isPrimaryStandard: false,
  },
};

/**
 * Kéziszerszámok SVG ikonjai (Kéz/szerelőkesztyű, VDE csavarhúzó, VDE oldalcsípőfogó).
 * Egyetlen gomb sem tartalmaz feliratszöveget — tiszta, részletes vektoros piktogramok.
 */
export const TOOLBAR_HAND_TOOLS: readonly ToolbarToolIconDef[] = [
  {
    id: "hand",
    title: "Kéz / szerelőkesztyű — kapcsolók, kismegszakítók, nyomógombok és WAGO karok működtetése",
    shortTip: "Kéz / szerelőkesztyű",
    svg: `<svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true" focusable="false">
      <!-- Mandzsetta -->
      <rect x="9.5" y="24.5" width="13.5" height="5" rx="2" fill="#334155" stroke="#0f172a" stroke-width="1.1"/>
      <line x1="12.5" y1="25.2" x2="12.5" y2="28.8" stroke="#94a3b8" stroke-width="1"/>
      <line x1="16.2" y1="25.2" x2="16.2" y2="28.8" stroke="#94a3b8" stroke-width="1"/>
      <line x1="19.8" y1="25.2" x2="19.8" y2="28.8" stroke="#94a3b8" stroke-width="1"/>
      <!-- Kesztyű test + ujjak -->
      <path d="M9.5 24.5 L8.8 17.5 L5.2 14.2 C4.1 13.2 4.3 11.5 5.6 10.9 C6.7 10.4 7.9 10.9 8.9 12.1 L9.8 13.2 L9.8 6.8 C9.8 5.4 10.8 4.4 12 4.4 C13.2 4.4 14.1 5.4 14.1 6.8 L14.1 11.5 L14.5 5.3 C14.5 3.9 15.5 3 16.7 3 C17.9 3 18.8 3.9 18.8 5.3 L18.8 11.5 L19.2 6.4 C19.2 5.1 20.1 4.2 21.3 4.2 C22.4 4.2 23.3 5.1 23.3 6.4 L23.3 12.6 L23.8 8.9 C23.9 7.8 24.8 7 25.8 7.1 C26.9 7.2 27.6 8.2 27.4 9.4 L25.8 19.6 C25.4 22.2 24.2 23.8 23 24.5 Z"
            fill="#e2e8f0" stroke="#0f172a" stroke-width="1.2" stroke-linejoin="round"/>
      <!-- Narancs nitril tenyérbetét -->
      <path d="M11 14.5 Q17.5 13.2 23.5 15.2 L22.6 22.8 Q16.8 23.8 11 22.5 Z"
            fill="#ea580c" opacity="0.9"/>
      <!-- Ujj-elválasztó barázdák -->
      <line x1="14.1" y1="8" x2="14.1" y2="14" stroke="#475569" stroke-width="1" stroke-linecap="round"/>
      <line x1="18.8" y1="8" x2="18.8" y2="14" stroke="#475569" stroke-width="1" stroke-linecap="round"/>
      <line x1="23.3" y1="9.5" x2="23.3" y2="14.6" stroke="#475569" stroke-width="1" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: "screwdriver",
    title: "VDE szigetelt csavarhúzó — sorkapocs csavarok meghúzása és kilazítása",
    shortTip: "VDE csavarhúzó",
    svg: `<svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true" focusable="false">
      <g transform="translate(16 16) rotate(-45) translate(-16 -16)">
        <!-- Acél lapos pengehegy -->
        <polygon points="14.4,2.2 17.6,2.2 17.1,6.5 14.9,6.5" fill="#e2e8f0" stroke="#334155" stroke-width="0.9"/>
        <!-- Piros VDE szigetelt szár -->
        <rect x="14.5" y="6.2" width="3" height="9.5" rx="0.8" fill="#dc2626" stroke="#7f1d1d" stroke-width="0.9"/>
        <!-- Ujjvédő gallér -->
        <rect x="11.5" y="15.3" width="9" height="2.6" rx="1.2" fill="#dc2626" stroke="#7f1d1d" stroke-width="0.9"/>
        <!-- Sárga-piros ergonomikus VDE markolat -->
        <rect x="12.2" y="17.6" width="7.6" height="12" rx="3.4" fill="#facc15" stroke="#854d0e" stroke-width="1.1"/>
        <path d="M13.5 20.2 H18.5 V26.2 C18.5 27.4 17.5 28.2 16 28.2 C14.5 28.2 13.5 27.4 13.5 26.2 Z" fill="#dc2626"/>
        <line x1="14.4" y1="21.2" x2="14.4" y2="26.4" stroke="#facc15" stroke-width="1" stroke-linecap="round"/>
        <line x1="17.6" y1="21.2" x2="17.6" y2="26.4" stroke="#facc15" stroke-width="1" stroke-linecap="round"/>
      </g>
    </svg>`,
  },
  {
    id: "cutter",
    title: "VDE oldalcsípőfogó — mindkét végén kilazított vezetékek elvágása",
    shortTip: "VDE oldalcsípőfogó",
    svg: `<svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true" focusable="false">
      <g transform="translate(16 16) rotate(-35) translate(-16 -16)">
        <!-- Bal és jobb acél vágópofa -->
        <path d="M15.4 3.2 C12.2 5.2 11.4 8.8 12.6 12.6 L15.6 12.6 L15.7 5.5 Z" fill="#cbd5e1" stroke="#1e293b" stroke-width="1.1" stroke-linejoin="round"/>
        <path d="M16.6 3.2 C19.8 5.2 20.6 8.8 19.4 12.6 L16.4 12.6 L16.3 5.5 Z" fill="#94a3b8" stroke="#1e293b" stroke-width="1.1" stroke-linejoin="round"/>
        <!-- Bal VDE szigetelt szár (piros-sárga) -->
        <path d="M12.5 13 C10.2 17.5 8.8 23.2 8.4 28.5 C9.8 29.3 11.6 29 12.3 27.3 C13 23.2 14 18.4 15.4 14.5 Z"
              fill="#dc2626" stroke="#7f1d1d" stroke-width="1"/>
        <path d="M11.6 15.2 L13.8 15.8 L12.1 22.5 L9.8 21.8 Z" fill="#facc15"/>
        <!-- Jobb VDE szigetelt szár (piros-sárga) -->
        <path d="M19.5 13 C21.8 17.5 23.2 23.2 23.6 28.5 C22.2 29.3 20.4 29 19.7 27.3 C19 23.2 18 18.4 16.6 14.5 Z"
              fill="#dc2626" stroke="#7f1d1d" stroke-width="1"/>
        <path d="M20.4 15.2 L18.2 15.8 L19.9 22.5 L22.2 21.8 Z" fill="#facc15"/>
        <!-- Csukló szegecs -->
        <circle cx="16" cy="12.6" r="2.6" fill="#475569" stroke="#0f172a" stroke-width="1"/>
        <circle cx="16" cy="12.6" r="1" fill="#e2e8f0"/>
      </g>
    </svg>`,
  },
];

/**
 * Mérőműszerek SVG ikonjai (UNI-T UT18D feszültség-/folytonosságvizsgáló és UT202A+ lakatfogó).
 */
export const TOOLBAR_INSTRUMENTS: readonly ToolbarToolIconDef[] = [
  {
    id: "tester",
    title: "UNI-T UT18D feszültség- és folytonosságvizsgáló (230V / 400V / Ω sípolás)",
    shortTip: "UNI-T vizsgáló (V / Ω)",
    svg: `<svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true" focusable="false">
      <!-- Fekete és piros mérőtüske oldalt -->
      <line x1="5.5" y1="3" x2="5.5" y2="8" stroke="#cbd5e1" stroke-width="1.5" stroke-linecap="round"/>
      <rect x="3.8" y="7.8" width="3.4" height="12" rx="1.4" fill="#1f2937" stroke="#64748b" stroke-width="0.9"/>
      <line x1="26.5" y1="3" x2="26.5" y2="8" stroke="#cbd5e1" stroke-width="1.5" stroke-linecap="round"/>
      <rect x="24.8" y="7.8" width="3.4" height="12" rx="1.4" fill="#ef4444" stroke="#7f1d1d" stroke-width="0.9"/>
      <!-- Piros UNI-T műszerház -->
      <rect x="9" y="5" width="14" height="23" rx="3.2" fill="#dc2626" stroke="#fca5a5" stroke-width="1"/>
      <rect x="10.6" y="7" width="10.8" height="18.6" rx="2" fill="#181d27"/>
      <!-- LED lépcsősor -->
      <circle cx="13" cy="9.8" r="1.1" fill="#ef4444"/>
      <circle cx="13" cy="12.6" r="1.1" fill="#facc15"/>
      <circle cx="13" cy="15.4" r="1.1" fill="#10b981"/>
      <path d="M18.6 9 L16.8 12.2 H18.5 L17.3 15.2" fill="none" stroke="#facc15" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- Háttérvilágításos LCD -->
      <rect x="11.8" y="18" width="8.4" height="5.6" rx="1" fill="#86efac" stroke="#0f172a" stroke-width="0.7"/>
      <line x1="13.2" y1="20.8" x2="18.8" y2="20.8" stroke="#064e3b" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: "clamp",
    title: "UNI-T UT202A+ digitális lakatfogó — váltakozó áramfelvétel mérése vezetéken (~A)",
    shortTip: "Lakatfogó (~AC A)",
    svg: `<svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true" focusable="false">
      <!-- Piros lakatfogó vasmag-pofák fent -->
      <path d="M12.5 13 C8.2 10.6 8.8 3.6 15.3 2.4 L15.5 5 C11.8 5.8 11.6 10 14.2 12.2 Z" fill="#ef4444" stroke="#7f1d1d" stroke-width="0.9"/>
      <path d="M19.5 13 C23.8 10.6 23.2 3.6 16.7 2.4 L16.5 5 C20.2 5.8 20.4 10 17.8 12.2 Z" fill="#ef4444" stroke="#7f1d1d" stroke-width="0.9"/>
      <!-- Oldalsó nyitóravasz -->
      <rect x="6.8" y="13.5" width="3.2" height="5.2" rx="1.2" fill="#dc2626" stroke="#7f1d1d" stroke-width="0.8"/>
      <!-- Sárga-borostyán műszerház -->
      <rect x="9.5" y="11.8" width="13.5" height="17.6" rx="3.4" fill="#f59e0b" stroke="#78350f" stroke-width="1.1"/>
      <rect x="11.2" y="13.4" width="10.1" height="14.4" rx="2" fill="#181d27"/>
      <!-- Forgókapcsoló tárcsa -->
      <circle cx="16.2" cy="17.2" r="2.7" fill="#334155" stroke="#64748b" stroke-width="0.8"/>
      <line x1="14.8" y1="15.8" x2="17.6" y2="18.6" stroke="#fbbf24" stroke-width="1.4" stroke-linecap="round"/>
      <!-- Háttérvilágításos kék LCD -->
      <rect x="12.2" y="21.2" width="8.1" height="5" rx="1" fill="#7dd3fc" stroke="#0f172a" stroke-width="0.7"/>
      <line x1="13.6" y1="23.7" x2="19" y2="23.7" stroke="#0c4a6e" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`,
  },
];

/**
 * Részletes kábeldob / vezetéktekercs SVG generátor kilógó szigetelt érrel és blankolt réz véggel.
 */
export function getSpoolIconSvg(color: WireColorId): string {
  const m = SPOOL_META[color];
  const isPe = color === "PE";

  const windings = isPe
    ? `
      <rect x="8.5" y="10" width="13" height="13.5" rx="1.5" fill="#16a34a"/>
      <path d="M8.5 12.2 H21.5 M8.5 16.6 H21.5 M8.5 21 H21.5" stroke="#facc15" stroke-width="2.2"/>
      <line x1="11.5" y1="10" x2="11.5" y2="23.5" stroke="rgba(255,255,255,0.28)" stroke-width="1.3"/>
    `
    : `
      <rect x="8.5" y="10" width="13" height="13.5" rx="1.5" fill="${m.bodyFill}"/>
      <path d="M8.5 13.3 H21.5 M8.5 16.7 H21.5 M8.5 20.1 H21.5" stroke="${m.shadow}" stroke-width="1.1"/>
      <line x1="11.5" y1="10.2" x2="11.5" y2="23.3" stroke="${m.highlight}" stroke-width="1.8" stroke-linecap="round"/>
    `;

  const tailWire = isPe
    ? `
      <path d="M20.5 12.5 C25.2 11.2 26.8 8.2 26.2 4.8" fill="none" stroke="#16a34a" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M20.5 12.5 C25.2 11.2 26.8 8.2 26.2 4.8" fill="none" stroke="#facc15" stroke-width="3.2" stroke-dasharray="2.6 2.6" stroke-linecap="round"/>
    `
    : `
      <path d="M20.5 12.5 C25.2 11.2 26.8 8.2 26.2 4.8" fill="none" stroke="${m.bodyFill}" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M20.5 12.5 C25.2 11.2 26.8 8.2 26.2 4.8" fill="none" stroke="${m.highlight}" stroke-width="1" stroke-linecap="round"/>
    `;

  return `<svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true" focusable="false">
    <!-- Blankolt réz vezetékvég -->
    <line x1="26.2" y1="4.8" x2="27.8" y2="1.8" stroke="#fbbf24" stroke-width="2.2" stroke-linecap="round"/>
    <!-- Kilógó szigetelt vezetékív -->
    ${tailWire}
    <!-- Felső műanyag dobperem -->
    <rect x="6" y="7.2" width="18" height="3.4" rx="1.6" fill="#475569" stroke="#0f172a" stroke-width="1"/>
    <!-- Feltekercselt vezetékrétegek -->
    ${windings}
    <rect x="8.5" y="10" width="13" height="13.5" rx="1.2" fill="none" stroke="#0f172a" stroke-width="0.9"/>
    <!-- Alsó műanyag dobperem -->
    <rect x="6" y="23" width="18" height="3.6" rx="1.6" fill="#334155" stroke="#0f172a" stroke-width="1"/>
  </svg>`;
}

export function getToolbarSpools(): ToolbarSpoolIconDef[] {
  return SPOOL_ORDER.map((color) => ({
    color,
    title: SPOOL_META[color].title,
    shortTip: SPOOL_META[color].shortTip,
    isPrimaryStandard: SPOOL_META[color].isPrimaryStandard,
    svg: getSpoolIconSvg(color),
  }));
}

/**
 * Segédfunkciók szöveg nélküli SVG ikonjai (Zoom, Sorkapocs tábla, Színellenőrzés, Debug, Reset).
 */
export const UTILITY_ICONS: Record<UtilityIconName, UtilityIconDef> = {
  zoomIn: {
    name: "zoomIn",
    title: "Nagyítás (egérgörgő felfelé)",
    shortTip: "Nagyítás (+)",
    svg: `<svg viewBox="0 0 28 28" width="22" height="22" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2.1"/>
      <line x1="17.5" y1="17.5" x2="24" y2="24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="9" y1="12" x2="15" y2="12" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>
      <line x1="12" y1="9" x2="12" y2="15" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>
    </svg>`,
  },
  zoomOut: {
    name: "zoomOut",
    title: "Kicsinyítés (egérgörgő lefelé)",
    shortTip: "Kicsinyítés (−)",
    svg: `<svg viewBox="0 0 28 28" width="22" height="22" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2.1"/>
      <line x1="17.5" y1="17.5" x2="24" y2="24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="9" y1="12" x2="15" y2="12" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>
    </svg>`,
  },
  zoomReset: {
    name: "zoomReset",
    title: "Eredeti 100%-os (1:1) nagyítás",
    shortTip: "Eredeti méret (1:1)",
    svg: `<svg viewBox="0 0 28 28" width="22" height="22" aria-hidden="true" focusable="false">
      <circle cx="14" cy="14" r="9.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-dasharray="4 2.5"/>
      <circle cx="14" cy="14" r="3" fill="currentColor"/>
      <line x1="14" y1="2" x2="14" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="14" y1="22" x2="14" y2="26" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="2" y1="14" x2="6" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="22" y1="14" x2="26" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
  },
  fitView: {
    name: "fitView",
    title: "Teljes oktatófal képernyőre igazítása",
    shortTip: "Teljes fal nézet",
    svg: `<svg viewBox="0 0 28 28" width="22" height="22" aria-hidden="true" focusable="false">
      <path d="M4 10 V4 H10 M18 4 H24 V10 M24 18 V24 H18 M10 24 H4 V18"
            fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="9.5" y="9.5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6" opacity="0.85"/>
    </svg>`,
  },
  legend: {
    name: "legend",
    title: "Sorkapocs-kiosztási magyarázó tábla megnyitása / bezárása",
    shortTip: "Sorkapocs tábla",
    svg: `<svg viewBox="0 0 28 28" width="24" height="24" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="20" height="20" rx="2.5" fill="#f8fafc" stroke="#0f172a" stroke-width="1.2"/>
      <rect x="4" y="4" width="20" height="5" rx="2" fill="#0f172a"/>
      <!-- Sorkapocs oszlopok -->
      <line x1="9" y1="9" x2="9" y2="24" stroke="#cbd5e1" stroke-width="1"/>
      <line x1="14" y1="9" x2="14" y2="24" stroke="#cbd5e1" stroke-width="1"/>
      <line x1="19" y1="9" x2="19" y2="24" stroke="#cbd5e1" stroke-width="1"/>
      <!-- Színkód négyzetek alul -->
      <rect x="5.2" y="19" width="2.8" height="3.5" rx="0.6" fill="#2563eb"/>
      <rect x="10.1" y="19" width="2.8" height="3.5" rx="0.6" fill="#eab308"/>
      <rect x="15.1" y="19" width="2.8" height="3.5" rx="0.6" fill="#16a34a"/>
      <rect x="20" y="19" width="2.8" height="3.5" rx="0.6" fill="#dc2626"/>
      <!-- Függőleges sorkapocs-szimbólum vonalak -->
      <line x1="6.6" y1="11" x2="6.6" y2="17" stroke="#334155" stroke-width="1.4" stroke-linecap="round"/>
      <line x1="11.5" y1="11" x2="11.5" y2="17" stroke="#334155" stroke-width="1.4" stroke-linecap="round"/>
      <line x1="16.5" y1="11" x2="16.5" y2="17" stroke="#334155" stroke-width="1.4" stroke-linecap="round"/>
      <line x1="21.4" y1="11" x2="21.4" y2="17" stroke="#334155" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`,
  },
  colorCheck: {
    name: "colorCheck",
    title: "Szabványos kábelszín-ellenőrzés (Fekete / Kék / Zöld-sárga)",
    shortTip: "Kábelszín-ellenőrzés",
    svg: `<svg viewBox="0 0 28 28" width="24" height="24" aria-hidden="true" focusable="false">
      <!-- 3 szabványos vezetékér (Fekete, Kék, Zöld-sárga) -->
      <line x1="5" y1="7" x2="19" y2="7" stroke="#18181b" stroke-width="3.4" stroke-linecap="round"/>
      <line x1="5" y1="7" x2="19" y2="7" stroke="#64748b" stroke-width="0.9" stroke-linecap="round"/>
      <line x1="5" y1="13.5" x2="17" y2="13.5" stroke="#2563eb" stroke-width="3.4" stroke-linecap="round"/>
      <line x1="5" y1="20" x2="16" y2="20" stroke="#16a34a" stroke-width="3.4" stroke-linecap="round"/>
      <line x1="5" y1="20" x2="16" y2="20" stroke="#facc15" stroke-width="3.4" stroke-dasharray="2.8 2.8" stroke-linecap="round"/>
      <!-- Ellenőrző pipa jelvény -->
      <circle cx="20.5" cy="18.5" r="5.5" fill="#10b981" stroke="#064e3b" stroke-width="1.1"/>
      <path d="M17.8 18.5 L19.6 20.4 L23.3 16.5" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  },
  debug: {
    name: "debug",
    title: "Hibakereső (Debug) mód be/ki — rejtett sorkapocs-feliratok és élő feszültség megjelenítése",
    shortTip: "Hibakereső (Debug) mód",
    svg: `<svg viewBox="0 0 28 28" width="23" height="23" aria-hidden="true" focusable="false">
      <!-- Csápok és lábak -->
      <path d="M10.5 6.5 L8.2 4 M17.5 6.5 L19.8 4 M4.5 12 H8.5 M19.5 12 H23.5 M3.8 16.5 H8.2 M19.8 16.5 H24.2 M5 21.5 L8.8 19.5 M23 21.5 L19.2 19.5"
            fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
      <!-- Fej -->
      <path d="M10.5 10 C10.5 7.5 12 6 14 6 C16 6 17.5 7.5 17.5 10 Z" fill="currentColor"/>
      <!-- Bogárhát (diagnosztikai pajzs) -->
      <rect x="8.5" y="10" width="11" height="12.5" rx="5.5" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="14" y1="10.5" x2="14" y2="22" stroke="currentColor" stroke-width="1.6"/>
    </svg>`,
  },
  reset: {
    name: "reset",
    title: "Pálya törlése — minden bekötött vezeték eltávolítása és alaphelyzetbe állítás",
    shortTip: "Pálya törlése (Reset)",
    svg: `<svg viewBox="0 0 28 28" width="23" height="23" aria-hidden="true" focusable="false">
      <path d="M6.5 9.5 A9 9 0 1 1 5.3 15.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
      <polyline points="4.2,4.8 6.2,10.2 11.5,8.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <line x1="11.2" y1="11.2" x2="16.8" y2="16.8" stroke="#f87171" stroke-width="2" stroke-linecap="round"/>
      <line x1="16.8" y1="11.2" x2="11.2" y2="16.8" stroke="#f87171" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
  },
};

function encodeSvgCursor(svg: string, hotX: number, hotY: number, fallback: string): string {
  const compact = svg.replace(/\s+/g, " ").trim();
  return `url("data:image/svg+xml,${encodeURIComponent(compact)}") ${hotX} ${hotY}, ${fallback}`;
}

function buildWireCursor(color: WireColorId): string {
  const stroke = WIRE_COLORS[color]?.stroke ?? "#1c1c1c";
  const isPe = color === "PE";
  const isBlack = color === "L1";

  const insulation = isPe
    ? `<path d="M9 9 Q18 17 29 27" fill="none" stroke="#ffffff" stroke-width="6.2" stroke-linecap="round"/>
       <path d="M9 9 Q18 17 29 27" fill="none" stroke="#16a34a" stroke-width="4.4" stroke-linecap="round"/>
       <path d="M9 9 Q18 17 29 27" fill="none" stroke="#facc15" stroke-width="4.4" stroke-dasharray="3.5 3.5" stroke-linecap="round"/>`
    : `<path d="M9 9 Q18 17 29 27" fill="none" stroke="#ffffff" stroke-width="6.2" stroke-linecap="round"/>
       <path d="M9 9 Q18 17 29 27" fill="none" stroke="${stroke}" stroke-width="4.4" stroke-linecap="round"/>
       ${isBlack ? `<path d="M9.5 8.5 Q18.5 16.5 29 26.2" fill="none" stroke="#64748b" stroke-width="1.2" stroke-linecap="round"/>` : ""}`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <line x1="3" y1="3" x2="9.2" y2="9.2" stroke="#0f172a" stroke-width="4.2" stroke-linecap="round"/>
    <line x1="3" y1="3" x2="9.2" y2="9.2" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round"/>
    ${insulation}
    <circle cx="3" cy="3" r="1.7" fill="#fde047" stroke="#0f172a" stroke-width="0.9"/>
  </svg>`;

  return encodeSvgCursor(svg, 3, 3, "crosshair");
}

const SCREWDRIVER_CURSOR = encodeSvgCursor(
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <line x1="3" y1="3" x2="8.5" y2="8.5" stroke="#0f172a" stroke-width="4" stroke-linecap="round"/>
    <line x1="3" y1="3" x2="8.5" y2="8.5" stroke="#e2e8f0" stroke-width="2.2" stroke-linecap="round"/>
    <line x1="8.2" y1="8.2" x2="16" y2="16" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
    <line x1="8.2" y1="8.2" x2="16" y2="16" stroke="#dc2626" stroke-width="3.2" stroke-linecap="round"/>
    <g transform="translate(22 22) rotate(-45)">
      <rect x="-4.5" y="-8.5" width="9" height="15" rx="3.8" fill="#facc15" stroke="#0f172a" stroke-width="1.4"/>
      <rect x="-2.6" y="-4" width="5.2" height="8.5" rx="1.8" fill="#dc2626"/>
    </g>
  </svg>`,
  3,
  3,
  "pointer",
);

const CUTTER_CURSOR = encodeSvgCursor(
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <path d="M3 7 L11 12 L12 11 L7 3 Z" fill="#e2e8f0" stroke="#0f172a" stroke-width="1.3" stroke-linejoin="round"/>
    <path d="M5 12 L12 13 L13 10 Z" fill="#cbd5e1" stroke="#0f172a" stroke-width="1.1"/>
    <path d="M12.5 14.5 L21 28" stroke="#ffffff" stroke-width="5.2" stroke-linecap="round"/>
    <path d="M14.5 12.5 L28 21" stroke="#ffffff" stroke-width="5.2" stroke-linecap="round"/>
    <path d="M12.5 14.5 L21 28" stroke="#dc2626" stroke-width="3.6" stroke-linecap="round"/>
    <path d="M14.5 12.5 L28 21" stroke="#dc2626" stroke-width="3.6" stroke-linecap="round"/>
    <path d="M14 17 L17.5 22.5" stroke="#facc15" stroke-width="2" stroke-linecap="round"/>
    <path d="M17 14 L22.5 17.5" stroke="#facc15" stroke-width="2" stroke-linecap="round"/>
    <circle cx="12.5" cy="12.5" r="2.6" fill="#334155" stroke="#ffffff" stroke-width="1"/>
  </svg>`,
  5,
  5,
  "crosshair",
);

const TESTER_CURSOR = encodeSvgCursor(
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <line x1="3" y1="3" x2="9.5" y2="9.5" stroke="#0f172a" stroke-width="3.6" stroke-linecap="round"/>
    <line x1="3" y1="3" x2="9.5" y2="9.5" stroke="#f8fafc" stroke-width="1.9" stroke-linecap="round"/>
    <line x1="8" y1="12" x2="12" y2="8" stroke="#0f172a" stroke-width="3.4" stroke-linecap="round"/>
    <line x1="10.2" y1="10.2" x2="25" y2="25" stroke="#ffffff" stroke-width="6.4" stroke-linecap="round"/>
    <line x1="10.2" y1="10.2" x2="25" y2="25" stroke="#dc2626" stroke-width="4.6" stroke-linecap="round"/>
    <path d="M25 25 Q28 28 30 31" fill="none" stroke="#18181b" stroke-width="2.6" stroke-linecap="round"/>
  </svg>`,
  3,
  3,
  "crosshair",
);

const CLAMP_CURSOR = encodeSvgCursor(
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <path d="M13 16 C6 15 3 8 7 4 C9 6 9 10 14 13 Z" fill="#ef4444" stroke="#ffffff" stroke-width="1.1"/>
    <path d="M16 13 C15 6 8 3 4 7 C6 9 10 9 13 14 Z" fill="#dc2626" stroke="#ffffff" stroke-width="1.1"/>
    <g transform="translate(21.5 21.5) rotate(-45)">
      <rect x="-5" y="-7" width="10" height="15" rx="3" fill="#f59e0b" stroke="#0f172a" stroke-width="1.4"/>
      <rect x="-3.2" y="-4.5" width="6.4" height="9" rx="1.4" fill="#181d27"/>
      <rect x="-2.4" y="0.2" width="4.8" height="3.2" rx="0.6" fill="#7dd3fc"/>
    </g>
  </svg>`,
  8,
  8,
  "crosshair",
);

const WIRE_CURSORS: Record<WireColorId, string> = {
  L1: buildWireCursor("L1"),
  L2: buildWireCursor("L2"),
  L3: buildWireCursor("L3"),
  N: buildWireCursor("N"),
  PE: buildWireCursor("PE"),
  CTRL: buildWireCursor("CTRL"),
};

/**
 * Aktív eszközmódnak (és vezeték-színnek) megfelelő egyedi SVG kurzor CSS értéke.
 */
export function getToolCursor(
  tool: ToolMode,
  isPanning = false,
  wireColor: WireColorId = "L1",
): string {
  if (isPanning) return "grabbing";
  switch (tool) {
    case "wire":
      return WIRE_CURSORS[wireColor] ?? WIRE_CURSORS.L1;
    case "screwdriver":
      return SCREWDRIVER_CURSOR;
    case "cutter":
      return CUTTER_CURSOR;
    case "tester":
      return TESTER_CURSOR;
    case "clamp":
      return CLAMP_CURSOR;
    case "hand":
    default:
      return "grab";
  }
}
