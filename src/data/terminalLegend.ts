import type { ColorMark } from "../models/types";

export interface LegendTerminalItem {
  colId: string;
  nodeId: string;
  label: string;
  mark: ColorMark;
}

export interface LegendDeviceGroup {
  id: string;
  title: string;
  terminals: LegendTerminalItem[];
}

export interface LegendStrip {
  id: "upper" | "lower";
  name: string;
  description: string;
  totalColumns: number;
  groups: LegendDeviceGroup[];
}

// 1. FELSŐ SORKAPOCSSOR (65 db sorkapocs) - sorkapocs_kiosztas.png alapján
export const UPPER_TERMINAL_GROUPS: LegendDeviceGroup[] = [
  {
    id: "top_3n",
    title: "3 FÁZIS NULLÁJA",
    terminals: [{ colId: "col-top_3n", nodeId: "top_3n", label: "N", mark: "blue" }],
  },
  {
    id: "top_mcb3",
    title: "3P C16A MEGSZAKÍTÓ",
    terminals: [
      { colId: "col-mcb3_l1", nodeId: "mcb3_l1", label: "L1", mark: "yellow" },
      { colId: "col-mcb3_l2", nodeId: "mcb3_l2", label: "L2", mark: "yellow" },
      { colId: "col-mcb3_l3", nodeId: "mcb3_l3", label: "L3", mark: "yellow" },
    ],
  },
  {
    id: "top_1n",
    title: "1 FÁZIS NULLÁJA",
    terminals: [{ colId: "col-top_1n", nodeId: "top_1n", label: "N", mark: "blue" }],
  },
  {
    id: "top_pe",
    title: "VÉDŐVEZETŐ",
    terminals: [{ colId: "col-top_pe", nodeId: "top_pe", label: "PE", mark: "pe" }],
  },
  {
    id: "top_mcb1_b10",
    title: "1P B10A MEGSZAKÍTÓ",
    terminals: [
      { colId: "col-mcb1_b10_l1", nodeId: "mcb1_b10_l1", label: "L1", mark: "green" },
    ],
  },
  {
    id: "top_mcb1_b16",
    title: "1P B16A MEGSZAKÍTÓ",
    terminals: [
      { colId: "col-mcb1_b16_l1", nodeId: "mcb1_b16_l1", label: "L1", mark: "red" },
    ],
  },
  {
    id: "top_impulse",
    title: "IMPULZUSRELÉ",
    terminals: [
      { colId: "col-imp_a1", nodeId: "imp_a1", label: "A1", mark: "yellow" },
      { colId: "col-imp_a2", nodeId: "imp_a2", label: "A2", mark: "blue" },
      { colId: "col-imp_1", nodeId: "imp_1", label: "1", mark: "yellow" },
      { colId: "col-imp_2", nodeId: "imp_2", label: "2", mark: "yellow" },
    ],
  },
  {
    id: "top_staircase",
    title: "LÉPCSŐHÁZI AUTOMATA",
    terminals: [
      { colId: "col-stair_n", nodeId: "stair_n", label: "N", mark: "blue" },
      { colId: "col-stair_b", nodeId: "stair_b", label: "B", mark: "brown" },
      { colId: "col-stair_l", nodeId: "stair_l", label: "L", mark: "brown" },
      { colId: "col-stair_4", nodeId: "stair_4", label: "4", mark: "brown" },
    ],
  },
  {
    id: "top_timer",
    title: "IDŐRELÉ",
    terminals: [
      { colId: "col-timer_a1", nodeId: "timer_a1", label: "A1", mark: "red" },
      { colId: "col-timer_15", nodeId: "timer_15", label: "15", mark: "red" },
      { colId: "col-timer_18", nodeId: "timer_18", label: "18", mark: "red" },
      { colId: "col-timer_16", nodeId: "timer_16", label: "16", mark: "red" },
      { colId: "col-timer_a2", nodeId: "timer_a2", label: "A2", mark: "blue" },
    ],
  },
  {
    id: "top_mk1_in",
    title: "MÁGNESKAPCSOLÓ MK1",
    terminals: [
      { colId: "col-mk1_in_l1", nodeId: "mk1_in_l1", label: "L1", mark: "yellow" },
      { colId: "col-mk1_in_l2", nodeId: "mk1_in_l2", label: "L2", mark: "yellow" },
      { colId: "col-mk1_in_l3", nodeId: "mk1_in_l3", label: "L3", mark: "yellow" },
    ],
  },
  {
    id: "top_mk2_in",
    title: "MÁGNESKAPCSOLÓ MK2",
    terminals: [
      { colId: "col-mk2_in_l1", nodeId: "mk2_in_l1", label: "L1", mark: "black" },
      { colId: "col-mk2_in_l2", nodeId: "mk2_in_l2", label: "L2", mark: "black" },
      { colId: "col-mk2_in_l3", nodeId: "mk2_in_l3", label: "L3", mark: "black" },
    ],
  },
  {
    id: "top_mk3_in",
    title: "MÁGNESKAPCSOLÓ MK3",
    terminals: [
      { colId: "col-mk3_in_l1", nodeId: "mk3_in_l1", label: "L1", mark: "red" },
      { colId: "col-mk3_in_l2", nodeId: "mk3_in_l2", label: "L2", mark: "red" },
      { colId: "col-mk3_in_l3", nodeId: "mk3_in_l3", label: "L3", mark: "red" },
    ],
  },
  {
    id: "top_mp_in",
    title: "MOTORVÉDŐ",
    terminals: [
      { colId: "col-mp_in_l1", nodeId: "mp_in_l1", label: "L1", mark: "brown" },
      { colId: "col-mp_in_l2", nodeId: "mp_in_l2", label: "L2", mark: "brown" },
      { colId: "col-mp_in_l3", nodeId: "mp_in_l3", label: "L3", mark: "brown" },
    ],
  },
  {
    id: "top_mk1_out",
    title: "MÁGNESKAPCSOLÓ MK1",
    terminals: [
      { colId: "col-mk1_out_t1", nodeId: "mk1_out_t1", label: "T1", mark: "yellow" },
      { colId: "col-mk1_out_t2", nodeId: "mk1_out_t2", label: "T2", mark: "yellow" },
      { colId: "col-mk1_out_t3", nodeId: "mk1_out_t3", label: "T3", mark: "yellow" },
    ],
  },
  {
    id: "top_mk2_out",
    title: "MÁGNESKAPCSOLÓ MK2",
    terminals: [
      { colId: "col-mk2_out_t1", nodeId: "mk2_out_t1", label: "T1", mark: "black" },
      { colId: "col-mk2_out_t2", nodeId: "mk2_out_t2", label: "T2", mark: "black" },
      { colId: "col-mk2_out_t3", nodeId: "mk2_out_t3", label: "T3", mark: "black" },
    ],
  },
  {
    id: "top_mk3_out",
    title: "MÁGNESKAPCSOLÓ MK3",
    terminals: [
      { colId: "col-mk3_out_t1", nodeId: "mk3_out_t1", label: "T1", mark: "red" },
      { colId: "col-mk3_out_t2", nodeId: "mk3_out_t2", label: "T2", mark: "red" },
      { colId: "col-mk3_out_t3", nodeId: "mk3_out_t3", label: "T3", mark: "red" },
    ],
  },
  {
    id: "top_mp_out",
    title: "MOTORVÉDŐ",
    terminals: [
      { colId: "col-mp_out_t1", nodeId: "mp_out_t1", label: "T1", mark: "brown" },
      { colId: "col-mp_out_t2", nodeId: "mp_out_t2", label: "T2", mark: "brown" },
      { colId: "col-mp_out_t3", nodeId: "mp_out_t3", label: "T3", mark: "brown" },
    ],
  },
  {
    id: "top_mk1_aux",
    title: "MÁGNESKAPCSOLÓ MK1",
    terminals: [
      { colId: "col-mk1_13", nodeId: "mk1_13", label: "13", mark: "yellow" },
      { colId: "col-mk1_21", nodeId: "mk1_21", label: "21", mark: "yellow" },
      { colId: "col-mk1_a1", nodeId: "mk1_a1", label: "A1", mark: "yellow" },
      { colId: "col-mk1_14", nodeId: "mk1_14", label: "14", mark: "yellow" },
      { colId: "col-mk1_22", nodeId: "mk1_22", label: "22", mark: "yellow" },
      { colId: "col-mk1_a2", nodeId: "mk1_a2", label: "A2", mark: "blue" },
    ],
  },
  {
    id: "top_mk2_aux",
    title: "MÁGNESKAPCSOLÓ MK2",
    terminals: [
      { colId: "col-mk2_13", nodeId: "mk2_13", label: "13", mark: "black" },
      { colId: "col-mk2_21", nodeId: "mk2_21", label: "21", mark: "black" },
      { colId: "col-mk2_a1", nodeId: "mk2_a1", label: "A1", mark: "black" },
      { colId: "col-mk2_14", nodeId: "mk2_14", label: "14", mark: "black" },
      { colId: "col-mk2_22", nodeId: "mk2_22", label: "22", mark: "black" },
      { colId: "col-mk2_a2", nodeId: "mk2_a2", label: "A2", mark: "blue" },
    ],
  },
  {
    id: "top_mk3_aux",
    title: "MÁGNESKAPCSOLÓ MK3",
    terminals: [
      { colId: "col-mk3_13", nodeId: "mk3_13", label: "13", mark: "red" },
      { colId: "col-mk3_21", nodeId: "mk3_21", label: "21", mark: "red" },
      { colId: "col-mk3_a1", nodeId: "mk3_a1", label: "A1", mark: "red" },
      { colId: "col-mk3_14", nodeId: "mk3_14", label: "14", mark: "red" },
      { colId: "col-mk3_22", nodeId: "mk3_22", label: "22", mark: "red" },
      { colId: "col-mk3_a2", nodeId: "mk3_a2", label: "A2", mark: "blue" },
    ],
  },
  {
    id: "top_mp_aux",
    title: "MOTORVÉDŐ",
    terminals: [
      { colId: "col-mp_95", nodeId: "mp_95", label: "95", mark: "brown" },
      { colId: "col-mp_96", nodeId: "mp_96", label: "96", mark: "brown" },
    ],
  },
];

// 2. ALSÓ SORKAPOCSSOR (54 db sorkapocs) - sorkapocs_kiosztas.png alapján
export const LOWER_TERMINAL_GROUPS: LegendDeviceGroup[] = [
  {
    id: "bot_sock",
    title: "DUGASZOLÓALJZAT",
    terminals: [
      { colId: "col-sock_l", nodeId: "sock_l", label: "L", mark: "yellow" },
      { colId: "col-sock_n", nodeId: "sock_n", label: "N", mark: "blue" },
      { colId: "col-sock_pe", nodeId: "sock_pe", label: "PE", mark: "pe" },
    ],
  },
  {
    id: "bot_sw106_1",
    title: "VÁLTÓKAPCSOLÓ 106",
    terminals: [
      { colId: "col-sw106_1_1", nodeId: "sw106_1_1", label: "1", mark: "black" },
      { colId: "col-sw106_1_2", nodeId: "sw106_1_2", label: "2", mark: "black" },
      { colId: "col-sw106_1_3", nodeId: "sw106_1_3", label: "3", mark: "black" },
    ],
  },
  {
    id: "bot_sw107",
    title: "KERESZTVÁLTÓKAPCSOLÓ 107",
    terminals: [
      { colId: "col-sw107_1", nodeId: "sw107_1", label: "1", mark: "white" },
      { colId: "col-sw107_2", nodeId: "sw107_2", label: "2", mark: "white" },
      { colId: "col-sw107_3", nodeId: "sw107_3", label: "3", mark: "white" },
      { colId: "col-sw107_4", nodeId: "sw107_4", label: "4", mark: "white" },
    ],
  },
  {
    id: "bot_sw106_2",
    title: "VÁLTÓKAPCSOLÓ 106",
    terminals: [
      { colId: "col-sw106_2_1", nodeId: "sw106_2_1", label: "1", mark: "blue" },
      { colId: "col-sw106_2_2", nodeId: "sw106_2_2", label: "2", mark: "blue" },
      { colId: "col-sw106_2_3", nodeId: "sw106_2_3", label: "3", mark: "blue" },
    ],
  },
  {
    id: "bot_p101n_1",
    title: "NYOMÓKAPCSOLÓ 101N",
    terminals: [
      { colId: "col-p101n_1_1", nodeId: "p101n_1_1", label: "1", mark: "red" },
      { colId: "col-p101n_1_2", nodeId: "p101n_1_2", label: "2", mark: "red" },
    ],
  },
  {
    id: "bot_p101n_2",
    title: "NYOMÓKAPCSOLÓ 101N",
    terminals: [
      { colId: "col-p101n_2_1", nodeId: "p101n_2_1", label: "1", mark: "yellow" },
      { colId: "col-p101n_2_2", nodeId: "p101n_2_2", label: "2", mark: "yellow" },
    ],
  },
  {
    id: "bot_p101n_3",
    title: "NYOMÓKAPCSOLÓ 101N",
    terminals: [
      { colId: "col-p101n_3_1", nodeId: "p101n_3_1", label: "1", mark: "green" },
      { colId: "col-p101n_3_2", nodeId: "p101n_3_2", label: "2", mark: "green" },
    ],
  },
  {
    id: "bot_sw101",
    title: "EGYPÓLUSÚ KAPCSOLÓ 101",
    terminals: [
      { colId: "col-sw101_1", nodeId: "sw101_1", label: "1", mark: "blue" },
      { colId: "col-sw101_2", nodeId: "sw101_2", label: "2", mark: "blue" },
    ],
  },
  {
    id: "bot_sw102",
    title: "KÉTPÓLUSÚ KAPCSOLÓ 102",
    terminals: [
      { colId: "col-sw102_1", nodeId: "sw102_1", label: "1 L", mark: "red" },
      { colId: "col-sw102_2", nodeId: "sw102_2", label: "2 L", mark: "red" },
      { colId: "col-sw102_3", nodeId: "sw102_3", label: "3 N", mark: "blue" },
      { colId: "col-sw102_4", nodeId: "sw102_4", label: "4 N", mark: "blue" },
    ],
  },
  {
    id: "bot_sw105",
    title: "CSILLÁRKAPCSOLÓ 105",
    terminals: [
      { colId: "col-sw105_1", nodeId: "sw105_1", label: "1", mark: "yellow" },
      { colId: "col-sw105_2", nodeId: "sw105_2", label: "2", mark: "yellow" },
      { colId: "col-sw105_3", nodeId: "sw105_3", label: "3", mark: "yellow" },
    ],
  },
  {
    id: "bot_btn_l",
    title: "BAL OLDALI NYOMÓGOMBOK",
    terminals: [
      { colId: "col-btn_l_no_3", nodeId: "btn_l_no_3", label: "NO 3", mark: "green" },
      { colId: "col-btn_l_no_4", nodeId: "btn_l_no_4", label: "NO 4", mark: "green" },
      { colId: "col-btn_l_nc_1", nodeId: "btn_l_nc_1", label: "NC 1", mark: "red" },
      { colId: "col-btn_l_nc_2", nodeId: "btn_l_nc_2", label: "NC 2", mark: "red" },
    ],
  },
  {
    id: "bot_btn_is",
    title: "NYOMÓGOMB SZIGET",
    terminals: [
      { colId: "col-btn_is1_no_3", nodeId: "btn_is1_no_3", label: "NO 3", mark: "green" },
      { colId: "col-btn_is1_no_4", nodeId: "btn_is1_no_4", label: "NO 4", mark: "green" },
      { colId: "col-btn_is_nc_1", nodeId: "btn_is_nc_1", label: "NC 1", mark: "red" },
      { colId: "col-btn_is_nc_2", nodeId: "btn_is_nc_2", label: "NC 2", mark: "red" },
      { colId: "col-btn_is2_no_3", nodeId: "btn_is2_no_3", label: "NO 3", mark: "green" },
      { colId: "col-btn_is2_no_4", nodeId: "btn_is2_no_4", label: "NO 4", mark: "green" },
    ],
  },
  {
    id: "bot_btn_r",
    title: "JOBB OLDALI NYOMÓGOMBOK",
    terminals: [
      { colId: "col-btn_r_no_3", nodeId: "btn_r_no_3", label: "NO 3", mark: "green" },
      { colId: "col-btn_r_no_4", nodeId: "btn_r_no_4", label: "NO 4", mark: "green" },
      { colId: "col-btn_r_nc_1", nodeId: "btn_r_nc_1", label: "NC 1", mark: "red" },
      { colId: "col-btn_r_nc_2", nodeId: "btn_r_nc_2", label: "NC 2", mark: "red" },
    ],
  },
  {
    id: "bot_lamp1",
    title: "IZZÓ 1",
    terminals: [
      { colId: "col-lamp1_l", nodeId: "lamp1_l", label: "L", mark: "brown" },
      { colId: "col-lamp1_n", nodeId: "lamp1_n", label: "N", mark: "blue" },
      { colId: "col-lamp1_pe", nodeId: "lamp1_pe", label: "PE", mark: "pe" },
    ],
  },
  {
    id: "bot_lamp2",
    title: "IZZÓ 2",
    terminals: [
      { colId: "col-lamp2_l", nodeId: "lamp2_l", label: "L", mark: "green" },
      { colId: "col-lamp2_n", nodeId: "lamp2_n", label: "N", mark: "blue" },
      { colId: "col-lamp2_pe", nodeId: "lamp2_pe", label: "PE", mark: "pe" },
    ],
  },
  {
    id: "bot_lamp3",
    title: "IZZÓ 3",
    terminals: [
      { colId: "col-lamp3_l", nodeId: "lamp3_l", label: "L", mark: "yellow" },
      { colId: "col-lamp3_n", nodeId: "lamp3_n", label: "N", mark: "blue" },
      { colId: "col-lamp3_pe", nodeId: "lamp3_pe", label: "PE", mark: "pe" },
    ],
  },
  {
    id: "bot_pir",
    title: "MOZGÁSÉRZÉKELŐ",
    terminals: [
      { colId: "col-pir_l", nodeId: "pir_l", label: "L↑", mark: "red" },
      { colId: "col-pir_n", nodeId: "pir_n", label: "N↑", mark: "blue" },
      { colId: "col-pir_out", nodeId: "pir_out", label: "L↓", mark: "red" },
    ],
  },
];
