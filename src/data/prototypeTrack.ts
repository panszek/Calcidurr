import type {
  Device,
  ElectricalNode,
  Port,
  TerminalColumn,
  WagoBlock,
  World,
} from "../models/types";

const COL_W = 20;
const COL_H = 138;
const COL_PITCH = 22;

function node(
  id: string,
  deviceName: string,
  functionLabel: string,
  label: string,
  sourcePotential?: ElectricalNode["sourcePotential"],
  breakerId?: string,
): ElectricalNode {
  return { id, deviceName, functionLabel, label, sourcePotential, breakerId };
}

function port(
  id: string,
  nodeId: string,
  kind: Port["kind"],
  x: number,
  y: number,
  label: string,
  tight = false,
): Port {
  return { id, nodeId, kind, x, y, label, tight };
}

function column(
  id: string,
  nodeId: string,
  portId: string,
  title: string,
  mark: TerminalColumn["mark"],
  x: number,
  y: number,
): TerminalColumn {
  return { id, nodeId, portId, title, mark, x, y, w: COL_W, h: COL_H };
}

export function createPrototypeWorld(): World {
  const nodes: Record<string, ElectricalNode> = {
    // FELSŐ SORKAPOCSSOR (65 db)
    // 1. 3 Fázis Nullája: [N (Kék)]
    top_3n: node("top_3n", "3 Fázis Nullája", "N táp", "N", "N"),

    // 2. 3P C16A Megszakító: [L1, L2, L3]
    mcb3_l1: node("mcb3_l1", "3P C16A", "L1 kimenet", "L1", "L1", "mcb_3p"),
    mcb3_l2: node("mcb3_l2", "3P C16A", "L2 kimenet", "L2", "L2", "mcb_3p"),
    mcb3_l3: node("mcb3_l3", "3P C16A", "L3 kimenet", "L3", "L3", "mcb_3p"),

    // 3. 1 Fázis Nullája: [N]
    top_1n: node("top_1n", "1 Fázis Nullája", "N táp", "N", "N"),

    // 4. Védővezető: [PE]
    top_pe: node("top_pe", "Védővezető", "PE táp", "PE", "PE"),

    // 5. 1P B10A Megszakító: [L1]
    mcb1_b10_l1: node("mcb1_b10_l1", "1P B10A", "L1 kimenet", "L1", "L1", "mcb_1p_b10"),

    // 6. 1P B16A Megszakító: [L1]
    mcb1_b16_l1: node("mcb1_b16_l1", "1P B16A", "L1 kimenet", "L1", "L1", "mcb_1p_b16"),

    // 7. Impulzusrelé: [A1, A2, 1, 2]
    imp_a1: node("imp_a1", "Impulzusrelé", "A1 tekercs", "A1"),
    imp_a2: node("imp_a2", "Impulzusrelé", "A2 tekercs", "A2"),
    imp_1: node("imp_1", "Impulzusrelé", "1 főérintkező", "1"),
    imp_2: node("imp_2", "Impulzusrelé", "2 főérintkező", "2"),

    // 8. Lépcsőházi automata: [N, B, L, 4]
    stair_n: node("stair_n", "Lépcsőházi automata", "N táp", "N"),
    stair_b: node("stair_b", "Lépcsőházi automata", "B vezérlés", "B"),
    stair_l: node("stair_l", "Lépcsőházi automata", "L táp", "L"),
    stair_4: node("stair_4", "Lépcsőházi automata", "4 kapcsolt L", "4"),

    // 9. Időrelé: [A1, 15, 18, 16, A2]
    timer_a1: node("timer_a1", "Időrelé", "A1 tekercs", "A1"),
    timer_15: node("timer_15", "Időrelé", "15 közös", "15"),
    timer_18: node("timer_18", "Időrelé", "18 NO", "18"),
    timer_16: node("timer_16", "Időrelé", "16 NC", "16"),
    timer_a2: node("timer_a2", "Időrelé", "A2 tekercs", "A2"),

    // 10. MK1 Főérintkezők bemenet: [L1, L2, L3]
    mk1_in_l1: node("mk1_in_l1", "MK1 Főérintkező bemenet", "L1 bemenet", "L1"),
    mk1_in_l2: node("mk1_in_l2", "MK1 Főérintkező bemenet", "L2 bemenet", "L2"),
    mk1_in_l3: node("mk1_in_l3", "MK1 Főérintkező bemenet", "L3 bemenet", "L3"),

    // 11. MK2 Főérintkezők bemenet: [L1, L2, L3]
    mk2_in_l1: node("mk2_in_l1", "MK2 Főérintkező bemenet", "L1 bemenet", "L1"),
    mk2_in_l2: node("mk2_in_l2", "MK2 Főérintkező bemenet", "L2 bemenet", "L2"),
    mk2_in_l3: node("mk2_in_l3", "MK2 Főérintkező bemenet", "L3 bemenet", "L3"),

    // 12. MK3 Főérintkezők bemenet: [L1, L2, L3]
    mk3_in_l1: node("mk3_in_l1", "MK3 Főérintkező bemenet", "L1 bemenet", "L1"),
    mk3_in_l2: node("mk3_in_l2", "MK3 Főérintkező bemenet", "L2 bemenet", "L2"),
    mk3_in_l3: node("mk3_in_l3", "MK3 Főérintkező bemenet", "L3 bemenet", "L3"),

    // 13. Motorvédő bemenet: [L1, L2, L3]
    mp_in_l1: node("mp_in_l1", "Motorvédő bemenet", "L1 bemenet", "L1"),
    mp_in_l2: node("mp_in_l2", "Motorvédő bemenet", "L2 bemenet", "L2"),
    mp_in_l3: node("mp_in_l3", "Motorvédő bemenet", "L3 bemenet", "L3"),

    // 14. MK1 Főérintkezők kimenet: [T1, T2, T3]
    mk1_out_t1: node("mk1_out_t1", "MK1 Főérintkező kimenet", "T1 kimenet", "T1"),
    mk1_out_t2: node("mk1_out_t2", "MK1 Főérintkező kimenet", "T2 kimenet", "T2"),
    mk1_out_t3: node("mk1_out_t3", "MK1 Főérintkező kimenet", "T3 kimenet", "T3"),

    // 15. MK2 Főérintkezők kimenet: [T1, T2, T3]
    mk2_out_t1: node("mk2_out_t1", "MK2 Főérintkező kimenet", "T1 kimenet", "T1"),
    mk2_out_t2: node("mk2_out_t2", "MK2 Főérintkező kimenet", "T2 kimenet", "T2"),
    mk2_out_t3: node("mk2_out_t3", "MK2 Főérintkező kimenet", "T3 kimenet", "T3"),

    // 16. MK3 Főérintkezők kimenet: [T1, T2, T3]
    mk3_out_t1: node("mk3_out_t1", "MK3 Főérintkező kimenet", "T1 kimenet", "T1"),
    mk3_out_t2: node("mk3_out_t2", "MK3 Főérintkező kimenet", "T2 kimenet", "T2"),
    mk3_out_t3: node("mk3_out_t3", "MK3 Főérintkező kimenet", "T3 kimenet", "T3"),

    // 17. Motorvédő kimenet: [T1, T2, T3]
    mp_out_t1: node("mp_out_t1", "Motorvédő kimenet", "T1 kimenet", "T1"),
    mp_out_t2: node("mp_out_t2", "Motorvédő kimenet", "T2 kimenet", "T2"),
    mp_out_t3: node("mp_out_t3", "Motorvédő kimenet", "T3 kimenet", "T3"),

    // 18. MK1 Segéd + Tekercs: [13, 14, 21, 22, A1, A2]
    mk1_13: node("mk1_13", "MK1 Segédérintkező", "13 NO", "13"),
    mk1_14: node("mk1_14", "MK1 Segédérintkező", "14 NO", "14"),
    mk1_21: node("mk1_21", "MK1 Segédérintkező", "21 NC", "21"),
    mk1_22: node("mk1_22", "MK1 Segédérintkező", "22 NC", "22"),
    mk1_a1: node("mk1_a1", "MK1 Mágneskapcsoló", "A1 tekercs", "A1"),
    mk1_a2: node("mk1_a2", "MK1 Mágneskapcsoló", "A2 tekercs", "A2"),

    // 19. MK2 Segéd + Tekercs: [13, 14, 21, 22, A1, A2]
    mk2_13: node("mk2_13", "MK2 Segédérintkező", "13 NO", "13"),
    mk2_14: node("mk2_14", "MK2 Segédérintkező", "14 NO", "14"),
    mk2_21: node("mk2_21", "MK2 Segédérintkező", "21 NC", "21"),
    mk2_22: node("mk2_22", "MK2 Segédérintkező", "22 NC", "22"),
    mk2_a1: node("mk2_a1", "MK2 Mágneskapcsoló", "A1 tekercs", "A1"),
    mk2_a2: node("mk2_a2", "MK2 Mágneskapcsoló", "A2 tekercs", "A2"),

    // 20. MK3 Segéd + Tekercs: [13, 14, 21, 22, A1, A2]
    mk3_13: node("mk3_13", "MK3 Segédérintkező", "13 NO", "13"),
    mk3_14: node("mk3_14", "MK3 Segédérintkező", "14 NO", "14"),
    mk3_21: node("mk3_21", "MK3 Segédérintkező", "21 NC", "21"),
    mk3_22: node("mk3_22", "MK3 Segédérintkező", "22 NC", "22"),
    mk3_a1: node("mk3_a1", "MK3 Mágneskapcsoló", "A1 tekercs", "A1"),
    mk3_a2: node("mk3_a2", "MK3 Mágneskapcsoló", "A2 tekercs", "A2"),

    // 21. Motorvédő segédérintkező: [95, 96]
    mp_95: node("mp_95", "Motorvédő segédérintkező", "95 NC", "95"),
    mp_96: node("mp_96", "Motorvédő segédérintkező", "96 NC", "96"),

    // ALSÓ SORKAPOCSSOR (54 db)
    // 1. Dugaszolóaljzat: [L, N, PE]
    sock_l: node("sock_l", "Dugaszolóaljzat", "L pont", "L"),
    sock_n: node("sock_n", "Dugaszolóaljzat", "N pont", "N"),
    sock_pe: node("sock_pe", "Dugaszolóaljzat", "PE védővezető", "PE"),

    // 2. Váltókapcsoló 106 (1.): [1, 2, 3]
    sw106_1_1: node("sw106_1_1", "Váltókapcsoló 106 (1.)", "1 közös", "1"),
    sw106_1_2: node("sw106_1_2", "Váltókapcsoló 106 (1.)", "2 váltó", "2"),
    sw106_1_3: node("sw106_1_3", "Váltókapcsoló 106 (1.)", "3 váltó", "3"),

    // 3. Keresztváltókapcsoló 107: [1, 2, 3, 4]
    sw107_1: node("sw107_1", "Keresztváltó 107", "kapocs 1", "1"),
    sw107_2: node("sw107_2", "Keresztváltó 107", "kapocs 2", "2"),
    sw107_3: node("sw107_3", "Keresztváltó 107", "kapocs 3", "3"),
    sw107_4: node("sw107_4", "Keresztváltó 107", "kapocs 4", "4"),

    // 4. Váltókapcsoló 106 (2.): [1, 2, 3]
    sw106_2_1: node("sw106_2_1", "Váltókapcsoló 106 (2.)", "1 közös", "1"),
    sw106_2_2: node("sw106_2_2", "Váltókapcsoló 106 (2.)", "2 váltó", "2"),
    sw106_2_3: node("sw106_2_3", "Váltókapcsoló 106 (2.)", "3 váltó", "3"),

    // 5. Nyomókapcsoló 101N (1.): [1, 2]
    p101n_1_1: node("p101n_1_1", "Nyomókapcsoló 101N (1.)", "kapocs 1", "1"),
    p101n_1_2: node("p101n_1_2", "Nyomókapcsoló 101N (1.)", "kapocs 2", "2"),

    // 6. Nyomókapcsoló 101N (2.): [1, 2]
    p101n_2_1: node("p101n_2_1", "Nyomókapcsoló 101N (2.)", "kapocs 1", "1"),
    p101n_2_2: node("p101n_2_2", "Nyomókapcsoló 101N (2.)", "kapocs 2", "2"),

    // 7. Nyomókapcsoló 101N (3.): [1, 2]
    p101n_3_1: node("p101n_3_1", "Nyomókapcsoló 101N (3.)", "kapocs 1", "1"),
    p101n_3_2: node("p101n_3_2", "Nyomókapcsoló 101N (3.)", "kapocs 2", "2"),

    // 8. Egypólusú kapcsoló 101: [1, 2]
    sw101_1: node("sw101_1", "Egypólusú kapcsoló 101", "kapocs 1", "1"),
    sw101_2: node("sw101_2", "Egypólusú kapcsoló 101", "kapocs 2", "2"),

    // 9. Kétpólusú kapcsoló 102: [1(L), 2(L), 3(N), 4(N)]
    sw102_1: node("sw102_1", "Kétpólusú kapcsoló 102", "1(L) be", "1"),
    sw102_2: node("sw102_2", "Kétpólusú kapcsoló 102", "2(L) ki", "2"),
    sw102_3: node("sw102_3", "Kétpólusú kapcsoló 102", "3(N) be", "3"),
    sw102_4: node("sw102_4", "Kétpólusú kapcsoló 102", "4(N) ki", "4"),

    // 10. Csillárkapcsoló 105: [1, 2, 3]
    sw105_1: node("sw105_1", "Csillárkapcsoló 105", "1 közös", "1"),
    sw105_2: node("sw105_2", "Csillárkapcsoló 105", "2 kör 1", "2"),
    sw105_3: node("sw105_3", "Csillárkapcsoló 105", "3 kör 2", "3"),

    // 11. Bal oldali nyomógombok: [NO 3, NO 4, NC 1, NC 2]
    btn_l_no_3: node("btn_l_no_3", "Bal nyomógomb (NO)", "NO 3", "3"),
    btn_l_no_4: node("btn_l_no_4", "Bal nyomógomb (NO)", "NO 4", "4"),
    btn_l_nc_1: node("btn_l_nc_1", "Bal nyomógomb (NC)", "NC 1", "1"),
    btn_l_nc_2: node("btn_l_nc_2", "Bal nyomógomb (NC)", "NC 2", "2"),

    // 12. Nyomógomb sziget (3 gomb: Zöld NO, Piros NC, Zöld NO): [NO 3, NO 4, NC 1, NC 2, NO 3, NO 4]
    btn_is1_no_3: node("btn_is1_no_3", "Sziget gomb 1 (Zöld NO)", "NO 3", "NO 3"),
    btn_is1_no_4: node("btn_is1_no_4", "Sziget gomb 1 (Zöld NO)", "NO 4", "NO 4"),
    btn_is_nc_1: node("btn_is_nc_1", "Sziget gomb 2 (Piros NC)", "NC 1", "NC 1"),
    btn_is_nc_2: node("btn_is_nc_2", "Sziget gomb 2 (Piros NC)", "NC 2", "NC 2"),
    btn_is2_no_3: node("btn_is2_no_3", "Sziget gomb 3 (Zöld NO)", "NO 3", "NO 3"),
    btn_is2_no_4: node("btn_is2_no_4", "Sziget gomb 3 (Zöld NO)", "NO 4", "NO 4"),

    // 13. Jobb oldali nyomógombok: [NO 3, NO 4, NC 1, NC 2]
    btn_r_no_3: node("btn_r_no_3", "Jobb nyomógomb (NO)", "NO 3", "3"),
    btn_r_no_4: node("btn_r_no_4", "Jobb nyomógomb (NO)", "NO 4", "4"),
    btn_r_nc_1: node("btn_r_nc_1", "Jobb nyomógomb (NC)", "NC 1", "1"),
    btn_r_nc_2: node("btn_r_nc_2", "Jobb nyomógomb (NC)", "NC 2", "2"),

    // 14. Izzó 1: [L, N, PE]
    lamp1_l: node("lamp1_l", "Izzó 1", "L fázis", "L"),
    lamp1_n: node("lamp1_n", "Izzó 1", "N nulla", "N"),
    lamp1_pe: node("lamp1_pe", "Izzó 1", "PE védővezető", "PE"),

    // 15. Izzó 2: [L, N, PE]
    lamp2_l: node("lamp2_l", "Izzó 2", "L fázis", "L"),
    lamp2_n: node("lamp2_n", "Izzó 2", "N nulla", "N"),
    lamp2_pe: node("lamp2_pe", "Izzó 2", "PE védővezető", "PE"),

    // 16. Izzó 3: [L, N, PE]
    lamp3_l: node("lamp3_l", "Izzó 3", "L fázis", "L"),
    lamp3_n: node("lamp3_n", "Izzó 3", "N nulla", "N"),
    lamp3_pe: node("lamp3_pe", "Izzó 3", "PE védővezető", "PE"),

    // 17. Mozgásérzékelő: [L↑, N↑, L↓]
    pir_l: node("pir_l", "Mozgásérzékelő", "L↑ betáp", "L↑"),
    pir_n: node("pir_n", "Mozgásérzékelő", "N↑ betáp", "N↑"),
    pir_out: node("pir_out", "Mozgásérzékelő", "L↓ kapcsolt fázis", "L↓"),

    // 5 Wago csomópont
    wago_node_1: node("wago_node_1", "Wago 1 (5-ös)", "5-ös összekötő", "W1"),
    wago_node_2: node("wago_node_2", "Wago 2 (5-ös)", "5-ös összekötő", "W2"),
    wago_node_3: node("wago_node_3", "Wago 3 (5-ös)", "5-ös összekötő", "W3"),
    wago_node_4: node("wago_node_4", "Wago 4 (5-ös)", "5-ös összekötő", "W4"),
    wago_node_5: node("wago_node_5", "Wago 5 (5-ös)", "5-ös összekötő", "W5"),
  };

  // Pozíciók a pelda_kotes.jpg alapján
  // A sorkapocssorok egymás alatt találhatók, bőséges hellyel a kötésekhez
  const upperStartX = 690;
  const upperY = 180;
  const lowerStartX = 690;
  const lowerY = 460;
  // A vezetékek bekötési pontja kizárólag a sorkapocs alsó nyílásában van (y + 122)
  const portY = (colY: number) => colY + 122;

  const columns: TerminalColumn[] = [];

  // FELSŐ SORKAPOCSSOR
  let curUpperX = upperStartX;
  const addUpperCol = (nodeId: string, title: string, mark: TerminalColumn["mark"]) => {
    const portId = `p-${nodeId}`;
    columns.push(column(`col-${nodeId}`, nodeId, portId, title, mark, curUpperX, upperY));
    curUpperX += COL_PITCH;
  };

  // 1. 3 Fázis Nullája: [N (Kék)]
  addUpperCol("top_3n", "3 FÁZIS NULLÁJA", "blue");

  // 2. 3P C16A Megszakító: [L1, L2, L3 (Sárga)]
  addUpperCol("mcb3_l1", "3P C16A", "yellow");
  addUpperCol("mcb3_l2", "3P C16A", "yellow");
  addUpperCol("mcb3_l3", "3P C16A", "yellow");

  // 3. 1 Fázis Nullája: [N (Kék)]
  addUpperCol("top_1n", "1 FÁZIS NULLÁJA", "blue");

  // 4. Védővezető: [PE (Zöld-sárga)]
  addUpperCol("top_pe", "VÉDŐVEZETŐ", "pe");

  // 5. 1P B10A Megszakító: [L1 (Zöld)]
  addUpperCol("mcb1_b10_l1", "1P B10A", "green");

  // 6. 1P B16A Megszakító: [L1 (Piros)]
  addUpperCol("mcb1_b16_l1", "1P B16A", "red");

  // 7. Impulzusrelé: [A1(Sárga), A2(Kék), 1(Sárga), 2(Sárga)]
  addUpperCol("imp_a1", "IMPULZUSRELÉ", "yellow");
  addUpperCol("imp_a2", "IMPULZUSRELÉ", "blue");
  addUpperCol("imp_1", "IMPULZUSRELÉ", "yellow");
  addUpperCol("imp_2", "IMPULZUSRELÉ", "yellow");

  // 8. Lépcsőházi automata: [N(Kék), B(Barna), L(Barna), 4(Barna)]
  addUpperCol("stair_n", "LÉPCSŐHÁZI", "blue");
  addUpperCol("stair_b", "LÉPCSŐHÁZI", "brown");
  addUpperCol("stair_l", "LÉPCSŐHÁZI", "brown");
  addUpperCol("stair_4", "LÉPCSŐHÁZI", "brown");

  // 9. Időrelé: [A1(Piros), 15(Piros), 18(Piros), 16(Piros), A2(Kék)]
  addUpperCol("timer_a1", "IDŐRELÉ", "red");
  addUpperCol("timer_15", "IDŐRELÉ", "red");
  addUpperCol("timer_18", "IDŐRELÉ", "red");
  addUpperCol("timer_16", "IDŐRELÉ", "red");
  addUpperCol("timer_a2", "IDŐRELÉ", "blue");

  // 10. MK1 Főérintkezők bemenet: [L1, L2, L3 (Sárga)]
  addUpperCol("mk1_in_l1", "MK1 FŐ BE", "yellow");
  addUpperCol("mk1_in_l2", "MK1 FŐ BE", "yellow");
  addUpperCol("mk1_in_l3", "MK1 FŐ BE", "yellow");

  // 11. MK2 Főérintkezők bemenet: [L1, L2, L3 (Fekete)]
  addUpperCol("mk2_in_l1", "MK2 FŐ BE", "black");
  addUpperCol("mk2_in_l2", "MK2 FŐ BE", "black");
  addUpperCol("mk2_in_l3", "MK2 FŐ BE", "black");

  // 12. MK3 Főérintkezők bemenet: [L1, L2, L3 (Piros)]
  addUpperCol("mk3_in_l1", "MK3 FŐ BE", "red");
  addUpperCol("mk3_in_l2", "MK3 FŐ BE", "red");
  addUpperCol("mk3_in_l3", "MK3 FŐ BE", "red");

  // 13. Motorvédő bemenet: [L1, L2, L3 (Barna)]
  addUpperCol("mp_in_l1", "MOTORVÉDŐ BE", "brown");
  addUpperCol("mp_in_l2", "MOTORVÉDŐ BE", "brown");
  addUpperCol("mp_in_l3", "MOTORVÉDŐ BE", "brown");

  // 14. MK1 Főérintkezők kimenet: [T1, T2, T3 (Sárga)]
  addUpperCol("mk1_out_t1", "MK1 FŐ KI", "yellow");
  addUpperCol("mk1_out_t2", "MK1 FŐ KI", "yellow");
  addUpperCol("mk1_out_t3", "MK1 FŐ KI", "yellow");

  // 15. MK2 Főérintkezők kimenet: [T1, T2, T3 (Fekete)]
  addUpperCol("mk2_out_t1", "MK2 FŐ KI", "black");
  addUpperCol("mk2_out_t2", "MK2 FŐ KI", "black");
  addUpperCol("mk2_out_t3", "MK2 FŐ KI", "black");

  // 16. MK3 Főérintkezők kimenet: [T1, T2, T3 (Piros)]
  addUpperCol("mk3_out_t1", "MK3 FŐ KI", "red");
  addUpperCol("mk3_out_t2", "MK3 FŐ KI", "red");
  addUpperCol("mk3_out_t3", "MK3 FŐ KI", "red");

  // 17. Motorvédő kimenet: [T1, T2, T3 (Barna)]
  addUpperCol("mp_out_t1", "MOTORVÉDŐ KI", "brown");
  addUpperCol("mp_out_t2", "MOTORVÉDŐ KI", "brown");
  addUpperCol("mp_out_t3", "MOTORVÉDŐ KI", "brown");

  // 18. MK1 Segéd + Tekercs: [13, 21, A1, 14, 22, A2 (Sárga + Kék)]
  addUpperCol("mk1_13", "MK1 SEGÉD", "yellow");
  addUpperCol("mk1_21", "MK1 SEGÉD", "yellow");
  addUpperCol("mk1_a1", "MK1 TEKERCS", "yellow");
  addUpperCol("mk1_14", "MK1 SEGÉD", "yellow");
  addUpperCol("mk1_22", "MK1 SEGÉD", "yellow");
  addUpperCol("mk1_a2", "MK1 TEKERCS", "blue");

  // 19. MK2 Segéd + Tekercs: [13, 21, A1, 14, 22, A2 (Fekete + Kék)]
  addUpperCol("mk2_13", "MK2 SEGÉD", "black");
  addUpperCol("mk2_21", "MK2 SEGÉD", "black");
  addUpperCol("mk2_a1", "MK2 TEKERCS", "black");
  addUpperCol("mk2_14", "MK2 SEGÉD", "black");
  addUpperCol("mk2_22", "MK2 SEGÉD", "black");
  addUpperCol("mk2_a2", "MK2 TEKERCS", "blue");

  // 20. MK3 Segéd + Tekercs: [13, 21, A1, 14, 22, A2 (Piros + Kék)]
  addUpperCol("mk3_13", "MK3 SEGÉD", "red");
  addUpperCol("mk3_21", "MK3 SEGÉD", "red");
  addUpperCol("mk3_a1", "MK3 TEKERCS", "red");
  addUpperCol("mk3_14", "MK3 SEGÉD", "red");
  addUpperCol("mk3_22", "MK3 SEGÉD", "red");
  addUpperCol("mk3_a2", "MK3 TEKERCS", "blue");

  // 21. Motorvédő segédérintkező: [95, 96 (Barna)]
  addUpperCol("mp_95", "MOTORVÉDŐ NC", "brown");
  addUpperCol("mp_96", "MOTORVÉDŐ NC", "brown");

  // ALSÓ SORKAPOCSSOR
  let curLowerX = lowerStartX;
  const addLowerCol = (nodeId: string, title: string, mark: TerminalColumn["mark"]) => {
    const portId = `p-${nodeId}`;
    columns.push(column(`col-${nodeId}`, nodeId, portId, title, mark, curLowerX, lowerY));
    curLowerX += COL_PITCH;
  };

  // 1. Dugaszolóaljzat: [L(Sárga), N(Kék), PE(Zöld-sárga)]
  addLowerCol("sock_l", "DUGALJ", "yellow");
  addLowerCol("sock_n", "DUGALJ", "blue");
  addLowerCol("sock_pe", "DUGALJ", "pe");

  // 2. Váltókapcsoló 106 (1.): [1, 2, 3 (Fekete)]
  addLowerCol("sw106_1_1", "106 VÁLTÓ 1", "black");
  addLowerCol("sw106_1_2", "106 VÁLTÓ 1", "black");
  addLowerCol("sw106_1_3", "106 VÁLTÓ 1", "black");

  // 3. Keresztváltókapcsoló 107: [1, 2, 3, 4 (Fehér)]
  addLowerCol("sw107_1", "107 KERESZT", "white");
  addLowerCol("sw107_2", "107 KERESZT", "white");
  addLowerCol("sw107_3", "107 KERESZT", "white");
  addLowerCol("sw107_4", "107 KERESZT", "white");

  // 4. Váltókapcsoló 106 (2.): [1, 2, 3 (Kék)]
  addLowerCol("sw106_2_1", "106 VÁLTÓ 2", "blue");
  addLowerCol("sw106_2_2", "106 VÁLTÓ 2", "blue");
  addLowerCol("sw106_2_3", "106 VÁLTÓ 2", "blue");

  // 5. Nyomókapcsoló 101N (1.): [1, 2 (Piros)]
  addLowerCol("p101n_1_1", "101N NYOMÓ 1", "red");
  addLowerCol("p101n_1_2", "101N NYOMÓ 1", "red");

  // 6. Nyomókapcsoló 101N (2.): [1, 2 (Sárga)]
  addLowerCol("p101n_2_1", "101N NYOMÓ 2", "yellow");
  addLowerCol("p101n_2_2", "101N NYOMÓ 2", "yellow");

  // 7. Nyomókapcsoló 101N (3.): [1, 2 (Zöld)]
  addLowerCol("p101n_3_1", "101N NYOMÓ 3", "green");
  addLowerCol("p101n_3_2", "101N NYOMÓ 3", "green");

  // 8. Egypólusú kapcsoló 101: [1, 2 (Kék)]
  addLowerCol("sw101_1", "101 KAPCSOLÓ", "blue");
  addLowerCol("sw101_2", "101 KAPCSOLÓ", "blue");

  // 9. Kétpólusú kapcsoló 102: [1(L)(Piros), 2(L)(Piros), 3(N)(Kék), 4(N)(Kék)]
  addLowerCol("sw102_1", "102 KÉTPÓLUS", "red");
  addLowerCol("sw102_2", "102 KÉTPÓLUS", "red");
  addLowerCol("sw102_3", "102 KÉTPÓLUS", "blue");
  addLowerCol("sw102_4", "102 KÉTPÓLUS", "blue");

  // 10. Csillárkapcsoló 105: [1, 2, 3 (Sárga)]
  addLowerCol("sw105_1", "105 CSILLÁR", "yellow");
  addLowerCol("sw105_2", "105 CSILLÁR", "yellow");
  addLowerCol("sw105_3", "105 CSILLÁR", "yellow");

  // 11. Bal oldali nyomógombok: [NO 3, NO 4 (Zöld), NC 1, NC 2 (Piros)]
  addLowerCol("btn_l_no_3", "BAL GOMBOK", "green");
  addLowerCol("btn_l_no_4", "BAL GOMBOK", "green");
  addLowerCol("btn_l_nc_1", "BAL GOMBOK", "red");
  addLowerCol("btn_l_nc_2", "BAL GOMBOK", "red");

  // 12. Nyomógomb sziget (3 gomb = 6 kapocs! Zöld NO, Piros NC, Zöld NO):
  addLowerCol("btn_is1_no_3", "SZIGET GOMB", "green");
  addLowerCol("btn_is1_no_4", "SZIGET GOMB", "green");
  addLowerCol("btn_is_nc_1", "SZIGET GOMB", "red");
  addLowerCol("btn_is_nc_2", "SZIGET GOMB", "red");
  addLowerCol("btn_is2_no_3", "SZIGET GOMB", "green");
  addLowerCol("btn_is2_no_4", "SZIGET GOMB", "green");

  // 13. Jobb oldali nyomógombok: [NO 3, NO 4 (Zöld), NC 1, NC 2 (Piros)]
  addLowerCol("btn_r_no_3", "JOBB GOMBOK", "green");
  addLowerCol("btn_r_no_4", "JOBB GOMBOK", "green");
  addLowerCol("btn_r_nc_1", "JOBB GOMBOK", "red");
  addLowerCol("btn_r_nc_2", "JOBB GOMBOK", "red");

  // 14. Izzó 1: [L(Barna), N(Kék), PE(Zöld-sárga)]
  addLowerCol("lamp1_l", "IZZÓ 1", "brown");
  addLowerCol("lamp1_n", "IZZÓ 1", "blue");
  addLowerCol("lamp1_pe", "IZZÓ 1", "pe");

  // 15. Izzó 2: [L(Zöld), N(Kék), PE(Zöld-sárga)]
  addLowerCol("lamp2_l", "IZZÓ 2", "green");
  addLowerCol("lamp2_n", "IZZÓ 2", "blue");
  addLowerCol("lamp2_pe", "IZZÓ 2", "pe");

  // 16. Izzó 3: [L(Sárga), N(Kék), PE(Zöld-sárga)]
  addLowerCol("lamp3_l", "IZZÓ 3", "yellow");
  addLowerCol("lamp3_n", "IZZÓ 3", "blue");
  addLowerCol("lamp3_pe", "IZZÓ 3", "pe");

  // 17. Mozgásérzékelő: [L↑(Piros), N↑(Kék), L↓(Piros)]
  addLowerCol("pir_l", "MOZGÁSÉRZ.", "red");
  addLowerCol("pir_n", "MOZGÁSÉRZ.", "blue");
  addLowerCol("pir_out", "MOZGÁSÉRZ.", "red");

  // Generate ports for columns (csak az alsó nyílásba köthető)
  const ports: Record<string, Port> = {};
  for (const col of columns) {
    const nd = nodes[col.nodeId];
    ports[col.portId] = port(
      col.portId,
      col.nodeId,
      "screw",
      col.x + col.w / 2,
      portY(col.y),
      nd ? nd.label : col.title,
    );
  }

  // 5 darab 5-ös Wago összekötő az alsó sorkapocssor alatt kényelmes távolságban
  const wagos: WagoBlock[] = [
    { id: "wago-1", nodeId: "wago_node_1", x: 700, y: 635, portIds: ["w1_1", "w1_2", "w1_3", "w1_4", "w1_5"] },
    { id: "wago-2", nodeId: "wago_node_2", x: 860, y: 635, portIds: ["w2_1", "w2_2", "w2_3", "w2_4", "w2_5"] },
    { id: "wago-3", nodeId: "wago_node_3", x: 1020, y: 635, portIds: ["w3_1", "w3_2", "w3_3", "w3_4", "w3_5"] },
    { id: "wago-4", nodeId: "wago_node_4", x: 1180, y: 635, portIds: ["w4_1", "w4_2", "w4_3", "w4_4", "w4_5"] },
    { id: "wago-5", nodeId: "wago_node_5", x: 1340, y: 635, portIds: ["w5_1", "w5_2", "w5_3", "w5_4", "w5_5"] },
  ];

  for (const wago of wagos) {
    wago.portIds.forEach((pid, index) => {
      ports[pid] = port(
        pid,
        wago.nodeId,
        "wago",
        wago.x + 18 + index * 24,
        wago.y + 46,
        `${wago.id}:${index + 1}`,
      );
    });
  }

  // Interaktív és vizuális készülékek elhelyezése a pelda_kotes.jpg alapján:
  const devices: Device[] = [
    // 1. Három Izzó fent a bal felső sarokban vízszintesen egymás mellett
    {
      id: "dev_lamp1",
      type: "lamp",
      title: "Izzó 1",
      bounds: { x: 130, y: 20, w: 68, h: 68 },
      nodeIds: ["lamp1_l", "lamp1_n", "lamp1_pe"],
      on: false,
      pressed: false,
      energized: false,
    },
    {
      id: "dev_lamp2",
      type: "lamp",
      title: "Izzó 2",
      bounds: { x: 235, y: 20, w: 68, h: 68 },
      nodeIds: ["lamp2_l", "lamp2_n", "lamp2_pe"],
      on: false,
      pressed: false,
      energized: false,
    },
    {
      id: "dev_lamp3",
      type: "lamp",
      title: "Izzó 3",
      bounds: { x: 340, y: 20, w: 68, h: 68 },
      nodeIds: ["lamp3_l", "lamp3_n", "lamp3_pe"],
      on: false,
      pressed: false,
      energized: false,
    },

    // 2. Kiselosztó doboz a 3 izzó alatt: benne a megszakítók és relék
    // 3P C16A Megszakító
    {
      id: "mcb_3p",
      type: "mcb3p",
      title: "3P C16A",
      bounds: { x: 100, y: 145, w: 72, h: 100 },
      nodeIds: ["mcb3_l1", "mcb3_l2", "mcb3_l3"],
      on: false,
      pressed: false,
      energized: false,
    },
    // 1P B10A Megszakító
    {
      id: "mcb_1p_b10",
      type: "mcb1p",
      title: "1P B10A",
      bounds: { x: 178, y: 145, w: 32, h: 100 },
      nodeIds: ["mcb1_b10_l1"],
      on: false,
      pressed: false,
      energized: false,
    },
    // 1P B16A Megszakító
    {
      id: "mcb_1p_b16",
      type: "mcb1p",
      title: "1P B16A",
      bounds: { x: 214, y: 145, w: 32, h: 100 },
      nodeIds: ["mcb1_b16_l1"],
      on: false,
      pressed: false,
      energized: false,
    },
    // Impulzusrelé
    {
      id: "dev_impulse",
      type: "impulse_relay",
      title: "Impulzusrelé",
      bounds: { x: 252, y: 145, w: 58, h: 100 },
      nodeIds: ["imp_a1", "imp_a2", "imp_1", "imp_2"],
      on: false,
      relayState: false,
      pressed: false,
      energized: false,
    },
    // Lépcsőházi automata
    {
      id: "dev_staircase",
      type: "staircase_relay",
      title: "Lépcsőházi aut.",
      bounds: { x: 316, y: 145, w: 60, h: 100 },
      nodeIds: ["stair_n", "stair_b", "stair_l", "stair_4"],
      on: false,
      timerRemaining: 0,
      pressed: false,
      energized: false,
    },
    // Időrelé
    {
      id: "dev_timer",
      type: "timer_relay",
      title: "Időrelé",
      bounds: { x: 382, y: 145, w: 64, h: 100 },
      nodeIds: ["timer_a1", "timer_15", "timer_18", "timer_16", "timer_a2"],
      on: false,
      relayState: false,
      timerRemaining: 3.0,
      pressed: false,
      energized: false,
    },

    // Motorvédő kapcsoló közvetlenül a kiselosztó mellett
    {
      id: "dev_motor_protector",
      type: "motor_protector",
      title: "Motorvédő",
      bounds: { x: 494, y: 145, w: 60, h: 100 },
      nodeIds: [
        "mp_in_l1", "mp_in_l2", "mp_in_l3",
        "mp_out_t1", "mp_out_t2", "mp_out_t3",
        "mp_95", "mp_96",
      ],
      on: false,
      pressed: false,
      energized: false,
    },

    // 3. Mágneskapcsolók MK1, MK2, MK3 fent középen a sorkapcsok felett
    {
      id: "dev_mk1",
      type: "contactor",
      title: "MK1",
      bounds: { x: 860, y: 45, w: 100, h: 95 },
      nodeIds: [
        "mk1_13", "mk1_14", "mk1_21", "mk1_22", "mk1_a1", "mk1_a2",
        "mk1_in_l1", "mk1_in_l2", "mk1_in_l3", "mk1_out_t1", "mk1_out_t2", "mk1_out_t3",
      ],
      on: false,
      pressed: false,
      energized: false,
    },
    {
      id: "dev_mk2",
      type: "contactor",
      title: "MK2",
      bounds: { x: 975, y: 45, w: 100, h: 95 },
      nodeIds: [
        "mk2_13", "mk2_14", "mk2_21", "mk2_22", "mk2_a1", "mk2_a2",
        "mk2_in_l1", "mk2_in_l2", "mk2_in_l3", "mk2_out_t1", "mk2_out_t2", "mk2_out_t3",
      ],
      on: false,
      pressed: false,
      energized: false,
    },
    {
      id: "dev_mk3",
      type: "contactor",
      title: "MK3",
      bounds: { x: 1090, y: 45, w: 100, h: 95 },
      nodeIds: [
        "mk3_13", "mk3_14", "mk3_21", "mk3_22", "mk3_a1", "mk3_a2",
        "mk3_in_l1", "mk3_in_l2", "mk3_in_l3", "mk3_out_t1", "mk3_out_t2", "mk3_out_t3",
      ],
      on: false,
      pressed: false,
      energized: false,
    },

    // 4. Mozgásérzékelő a jobb felső részen
    {
      id: "dev_pir",
      type: "motion_sensor",
      title: "Mozgásérzékelő",
      bounds: { x: 1350, y: 45, w: 86, h: 105 },
      nodeIds: ["pir_l", "pir_n", "pir_out"],
      on: false,
      timerRemaining: 0,
      pressed: false,
      energized: false,
    },

    // 5. Kapcsolók mátrixa a bal oldalon a kiselosztó alatt (3 oszlop, 3 sor + aljzat)
    // 1. sor (y = 320)
    {
      id: "dev_sw106_1",
      type: "switch_106",
      title: "106 Váltó 1",
      bounds: { x: 80, y: 320, w: 78, h: 78 },
      nodeIds: ["sw106_1_1", "sw106_1_2", "sw106_1_3"],
      on: false,
      pressed: false,
      energized: false,
    },
    {
      id: "dev_sw107",
      type: "switch_107",
      title: "107 Kereszt",
      bounds: { x: 180, y: 320, w: 78, h: 78 },
      nodeIds: ["sw107_1", "sw107_2", "sw107_3", "sw107_4"],
      on: false,
      pressed: false,
      energized: false,
    },
    {
      id: "dev_sw106_2",
      type: "switch_106",
      title: "106 Váltó 2",
      bounds: { x: 280, y: 320, w: 78, h: 78 },
      nodeIds: ["sw106_2_1", "sw106_2_2", "sw106_2_3"],
      on: false,
      pressed: false,
      energized: false,
    },
    // Dugaszolóaljzat a kapcsolók mellett a falon
    {
      id: "dev_socket",
      type: "socket",
      title: "Dugaszolóaljzat",
      bounds: { x: 385, y: 320, w: 78, h: 78 },
      nodeIds: ["sock_l", "sock_n", "sock_pe"],
      on: false,
      pressed: false,
      energized: false,
    },

    // 2. sor (y = 425): 101N nyomókapcsolók
    {
      id: "dev_p101n_1",
      type: "push_switch_101n",
      title: "Nyomó 101N (1)",
      bounds: { x: 80, y: 425, w: 78, h: 78 },
      nodeIds: ["p101n_1_1", "p101n_1_2"],
      on: false,
      pressed: false,
      energized: false,
    },
    {
      id: "dev_p101n_2",
      type: "push_switch_101n",
      title: "Nyomó 101N (2)",
      bounds: { x: 180, y: 425, w: 78, h: 78 },
      nodeIds: ["p101n_2_1", "p101n_2_2"],
      on: false,
      pressed: false,
      energized: false,
    },
    {
      id: "dev_p101n_3",
      type: "push_switch_101n",
      title: "Nyomó 101N (3)",
      bounds: { x: 280, y: 425, w: 78, h: 78 },
      nodeIds: ["p101n_3_1", "p101n_3_2"],
      on: false,
      pressed: false,
      energized: false,
    },

    // 3. sor (y = 530): 101, 102, 105 kapcsolók
    {
      id: "dev_sw101",
      type: "switch_101",
      title: "Egypólusú 101",
      bounds: { x: 80, y: 530, w: 78, h: 78 },
      nodeIds: ["sw101_1", "sw101_2"],
      on: false,
      pressed: false,
      energized: false,
    },
    {
      id: "dev_sw102",
      type: "switch_102",
      title: "Kétpólusú 102",
      bounds: { x: 180, y: 530, w: 78, h: 78 },
      nodeIds: ["sw102_1", "sw102_2", "sw102_3", "sw102_4"],
      on: false,
      pressed: false,
      energized: false,
    },
    {
      id: "dev_sw105",
      type: "switch_105",
      title: "Csillár 105",
      bounds: { x: 280, y: 530, w: 78, h: 78 },
      nodeIds: ["sw105_1", "sw105_2", "sw105_3"],
      on: false,
      on2: false,
      pressed: false,
      energized: false,
    },

    // 6. Ipari nyomógombok vízszintes dobozsorban (y = 635)
    {
      id: "dev_btn_l_no",
      type: "button_no",
      title: "Bal (NO)",
      bounds: { x: 80, y: 635, w: 66, h: 66 },
      nodeIds: ["btn_l_no_3", "btn_l_no_4"],
      on: false,
      pressed: false,
      energized: false,
      subType: "no",
    },
    {
      id: "dev_btn_l_nc",
      type: "button_nc",
      title: "Bal (NC)",
      bounds: { x: 154, y: 635, w: 66, h: 66 },
      nodeIds: ["btn_l_nc_1", "btn_l_nc_2"],
      on: false,
      pressed: false,
      energized: false,
      subType: "nc",
    },
    {
      id: "dev_btn_is1_no",
      type: "button_no",
      title: "Sziget Zöld (NO)",
      bounds: { x: 232, y: 635, w: 66, h: 66 },
      nodeIds: ["btn_is1_no_3", "btn_is1_no_4"],
      on: false,
      pressed: false,
      energized: false,
      subType: "no",
    },
    {
      id: "dev_btn_is_nc",
      type: "button_nc",
      title: "Sziget Piros (NC)",
      bounds: { x: 304, y: 635, w: 66, h: 66 },
      nodeIds: ["btn_is_nc_1", "btn_is_nc_2"],
      on: false,
      pressed: false,
      energized: false,
      subType: "nc",
    },
    {
      id: "dev_btn_is2_no",
      type: "button_no",
      title: "Sziget Zöld (NO)",
      bounds: { x: 376, y: 635, w: 66, h: 66 },
      nodeIds: ["btn_is2_no_3", "btn_is2_no_4"],
      on: false,
      pressed: false,
      energized: false,
      subType: "no",
    },
    {
      id: "dev_btn_r_no",
      type: "button_no",
      title: "Jobb (NO)",
      bounds: { x: 454, y: 635, w: 66, h: 66 },
      nodeIds: ["btn_r_no_3", "btn_r_no_4"],
      on: false,
      pressed: false,
      energized: false,
      subType: "no",
    },
    {
      id: "dev_btn_r_nc",
      type: "button_nc",
      title: "Jobb (NC)",
      bounds: { x: 526, y: 635, w: 66, h: 66 },
      nodeIds: ["btn_r_nc_1", "btn_r_nc_2"],
      on: false,
      pressed: false,
      energized: false,
      subType: "nc",
    },
  ];

  return {
    nodes,
    ports,
    columns,
    wagos,
    devices,
    wires: [],
    mcbId: "mcb_1p_b10",
  };
}
