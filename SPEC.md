# Projekt Specifikáció: Villanyszerelő Oktatófal Szimulátor (MVP Prototípus)

Készíts egy böngészőben futó, TypeScript + HTML5 Canvas alapú interaktív villanyszerelési szimulátort, amely egy sorkapocssoros oktatófal bekötését és működését modellezi.

## 1. Alapvető felhasználói élmény és eszközök (Toolbar)
Legyen egy eszköztár a következő módokkal:
- **Vezetékezés (Szabadkézi ceruza mód):** Kiválasztható színek: Fekete (`L1`), Barna (`L2`), Szürke (`L3`), Kék (`N`), Zöld-sárga (`PE`), Piros (vezérlőszál).
  - A felhasználó egy sorkapocs vagy Wago nyílás közelében lenyomja az egeret (15px-es mágneses tapadás a kezdőpontra), szabad kézzel húzza az egeret (rögzítjük a pontokat), majd egy másik kapocspontnál elengedi.
  - A vezeték két vége alapállapotban **LAZA (`isTightened: false`)**, amit egy kis vizuális jelzés (pl. narancssárga körvonal / kilátszó réz ér) mutat a végponton.
- **Csavarhúzó eszköz:** Sorkapocs csavarjára kattintva meghúzza vagy kilazítja azt (`isTightened` váltása). A csavar feje vizuálisan elfordul 90 fokkal.
- **Kéz / Ujj eszköz:**
  - Wago összekötők narancssárga karjának fel- és lehajtása (`isLeverClosed` váltása). A vezeték csak akkor csatlakozik, ha a kar lehajtott állapotban van.
  - Kapcsolók, nyomógombok és kismegszakítók működtetése (nyomás/billentés).
- **Csípőfogó eszköz:** Vezeték törlése (csak akkor engedélyezett, ha a vezeték mindkét végén ki van lazítva a csavar / nyitva van a Wago).
- **UNI-T vizsgáló eszköz (`⚡ UNI-T vizsgáló`):** Kétpólusú feszültség-, fázissorrend- és folytonosságvizsgáló (UNI-T UT18D mintára) fekete (`COM / −`) és piros (`+`) mérőtüskékkel, lebegő digitális/LED műszerpanellel és némítható Web Audio API sípoló hangjelzéssel.
- **Lakatfogó eszköz (`🧲 Lakatfogó`):** Vezetékre rázáródó digitális váltakozóáramú lakatfogó (UNI-T UT202A+ mintára) valós komplex fázor ágáram-számítással, vezetéken rögzíthető pofával, valamint szabadon mozgatható lebegő LCD műszerpanellel (`~ AC A`, analóg sávkijelző, `DATA HOLD`, lecsatolás).

## 2. Információelrejtés és Hibakereső (Debug) mód
- **Normál mód (alapértelmezett):** A sorkapcsok fölé víve az egeret **NEM jelenik meg semmilyen súgószöveg**! A felhasználónak csak a sorkapocs számozása és az alatta lévő gyári színkód-négyzetek (fekete, kék, zöld-sárga, piros) segítenek.
- **Hibakereső (Debug) mód kapcsoló:** Bekapcsolásakor:
  - Hover tooltip jelenik meg a sorkapcsok felett (eszköz neve, kapocs funkciója, aktuális potenciál: pl. `L1`, `N`, `0V`).
  - A feszültség alatt álló vezetékek vizuálisan kiemelődnek (pl. enyhe fénylés).
  - Figyelmeztetést mutat, ha van laza (nem meghúzott) kötés.

## 3. Szimulációs motor (Gráf-alapú feszültségkövetés)
- Minden sorkapocs és Wago pont egy csomópont (`Node`).
- Egy vezeték csak akkor hoz létre vezető élt (`Edge`) két csomópont között, ha **mindkét vége mechanikailag rögzítve van** (csavar meghúzva vagy Wago kar lehajtva).
- A szimulációs ciklus (BFS/DFS gráfbejárás) minden állapotváltozáskor lefut:
  1. Terjeszti a tápforrások potenciáljait (`L1`, `N`, `PE`).
  2. **Zárlatvédelem:** Ha egy összefüggő hálózaton egyszerre van jelen `L1` és `N` (vagy `L1` és `PE`), a körben lévő kismegszakító automatikusan leold (`KI` állásba ugrik) és hibaüzenetet dob.
  3. Kiértékeli a fogyasztókat (pl. lámpa világít, ha `L1` és `N` van rajta) és a mágneskapcsoló tekercsét (`A1-A2`), ami meghúzáskor zárja az `NO` (13-14) és bontja az `NC` (21-22) érintkezőket (iteratív ciklus az öntartás kezeléséhez).

## 4. Első lépés (Prototípus pálya)
Készíts egy induló tesztpályát a Canvasra a következő elemekkel, hogy azonnal tesztelhető legyen az összes mechanika:
1. Tápforrás sorkapcsok: `1P B10A (L1)`, `1 Fázis Nullája (N)`, `Védővezető (PE)`.
2. Két sorkapocscsoport a szerelvényekhez: egy `Egypólusú kapcsoló (1, 2)`, egy `Nyomógomb (NO 3-4)`, egy `Mágneskapcsoló MK1 (A1, A2, 13, 14)` és egy `Izzó 1 (L, N, PE)`.
3. Két darab 3-as `Wago` összekötő blokk működő karokkal.
4. A sorkapcsok alatt a valós falhoz hasonló színes jelölőnégyzetek, és a csavarok kattintható pozíciói.

## 5. Fájlstruktúra
A kód a következő modulokra oszlik (Vite + TypeScript, böngészőben Canvas):

- `index.html`, `src/main.ts`, `src/style.css` — belépési pont, eszköztár DOM, ciklus.
- `src/models/` — domain típusok és a világ (pálya) állapota.
  - `types.ts` — `Potential`, `ToolMode`, `Port`, `Wire`, `Device`, `World`.
  - `world.ts` — mutációk: vezeték létrehozása/törlése, csavar, kar, készülékállapot.
- `src/engine/` — szimuláció és mérőlogika, UI nélkül.
  - `simulation.ts` — gráfépítés, BFS potenciálterjesztés, zárlat, fogyasztók, MK iteráció, 3F motor.
  - `colorCheck.ts` — szabványos kábelszín validáció (Fekete / Kék / Zöld-sárga).
  - `measurements.ts` — UNI-T kétpólusú feszültségmérés (`230V` / `400V` / `0V`), fázissorrend (`R`/`L`), egypólusú fázisjelzés és BFS folytonosságvizsgálat (`0.0 Ω` / `OL`).
  - `currentSolver.ts` — Kirchhoff csomóponti komplex fázor áramhálózat-megoldó (`wireCurrents`) és lakatfogó mérési logika (`DATA HOLD`, túláram-jelzés).
- `src/ui/` — lebegő műszerfalak és vezérlőpanelek.
  - `instrumentPanel.ts` — mozgatható lebegő UNI-T UT18D feszültségvizsgáló panel (Web Audio API sípolóval) és UNI-T UT202A+ digitális lakatfogó panel (`AC A`, bargraph, `HOLD`).
- `src/canvas/` — megjelenítés és egérkezelés.
  - `renderer.ts` — sorkapocs, Wago, készülékek, 3F motor, vezeték, UNI-T mérőtüskék/mérőzsinórok, térbeli lakatfogó pofa, debug overlay.
  - `input.ts` — mágneses tapadás, szabadkézi vonal, eszközök, mérőtüskék és lakatfogó vezeték-vetítés hittestje.
  - `legendTable.ts`, `colorCheckPanel.ts` — sorkapocs-kiosztási táblázat és színhiba-panel.
- `src/data/` — pályaadatok.
  - `colors.ts` — vezeték- és jelölőszínek.
  - `prototypeTrack.ts` — az oktatófal koordinátái és csomópontjai.
  - `terminalLegend.ts`, `wagoBoxes.ts` — jegyzékcsoportok és munkapadi WAGO dobozok.
- `src/__tests__/` — Vitest automatizált unit és szimulációs regressziós tesztek (`npm test`).
  - `testHelpers.ts` — újrahasznosítható bekötő és tápkapcsoló segédfüggvények.
  - `world.test.ts`, `simulation.test.ts`, `input.test.ts`, `prototypeTrack.test.ts`, `wago.test.ts`, `rcd.test.ts`, `motor.test.ts`, `colorCheck.test.ts`, `measurements.test.ts`, `currentSolver.test.ts` — világmutációk, áramköri szimuláció, ÁVK-k, 3F motor, színellenőrzés, UNI-T mérések, fázor ágáramok és Canvas hit-testek ellenőrzése.

## 6. Vizuális referenciák
A `sources/` mappa a valós oktatófalat dokumentálja:
- `sources/pelda_kotes.jpg` — OSB oktatófal, DIN kismegszakítók, sorkapocssorok, kapcsolók, nyomógombok, izzók, Wago/vezetékezés.
- `sources/sorkapocs_kiosztas.jfif` — sorkapocs-kiosztás: függőleges feliratok, alsó színkód-sáv (N/L/PE/vezérlés).

A prototípus **nem** a teljes falat másolja, csak a 4. pont elemeit, de a sorkapocs megjelenése (fehér oszlop, függőleges címke, csavar, alsó színnégyzet) és az OSB-szerű háttér ezeket a fotókat követi.

## 7. Prototípus viselkedési pontosítások
Ezek a szabályok a SPEC 1–4. pontjait egészítik ki a megvalósítás során:

- Egy kapocspontba / Wago nyílásba **egyszerre egy vezetékvég** köthető.
- **Kezdőállapot:** Az oktatófal mindig teljesen **kikapcsolt (`on: false`)** állapotban indul (minden kismegszakító, motorvédő és kapcsoló KI állásban van), a sorkapcsok feszültségmentesek.
- **Ergonomikus csavarviselkedés:** Az üres sorkapcsok alapból **kilazított (`tight: false`)** állapotban várják a bekötést, így a tanulónak nem kell előre kitekernie a csavart a vezeték rögzítéséhez. Új vezeték bekötése után a csatlakozási pont laza marad, amit a tanulónak a Csavarhúzóval meg kell húznia (`tight: true`).
- **Csavarok megjelenése:** A felső fix és az alsó meghúzott csavar horonyiránya egységesen vízszintes (0°); laza állapotban 90°-kal elfordul (függőleges), világosabb fejjel és nyitott réz kengyellel. Csavarhúzó hover esetén célzott kiemelő gyűrű jelenik meg a csavarfej körül.
- **WAGO összekötők és dobozok:** A munkapadon két alkatrészdoboz található: **WAGO 221-413 (3-as)** és **WAGO 221-415 (5-ös)**. A dobozokból drag-and-drop húzással vagy kattintással tetszőleges számú WAGO helyezhető el a falon. Az újonnan létrehozott WAGO-k nyitott karokkal (`tight: false`) indulnak, kész a vezeték bekötésére.
- **WAGO forgathatóság:** A WAGO-k 90°-os diszkrét lépésekben (0°, 90°, 180°, 270°) szabadon elforgathatók, amíg nincsenek bekötve. A forgatás történhet az **`R` billentyűvel** (mozgatás közben vagy hovernél), a blokk jobb felső sarkában található **`↻` forgató gombbal**, vagy **jobb egérgombbal**. A kapcsok pozíciója a blokk középpontja körül forog el. Bekötött vezetékkel rendelkező WAGO sem nem mozgatható, sem nem forgatható (a forgató gomb ilyenkor elrejtődik, `R` vagy jobb klikk esetén toast figyelmeztet). A rögzített (`fixed: true`) WAGO-k szintén védettek.
- **WAGO visszadobása és védelme:** Üres, nem rögzített (`!wago.fixed && !hasWagoWires`) WAGO a munkapadi dobozokra visszahúzva törlődik. A bekötött WAGO-k nem mozgathatók, nem forgathatók és nem törölhetők a vezetékek kikötése nélkül. A rögzített (`fixed: true`) WAGO-k sem nem mozgathatók, sem nem forgathatók.
- A Wago nyílásai **közös elektromos csomópontot** alkotnak: a zárt karú, bekötött erek párhuzamosan kötnek.
- **Kismegszakító (`1P B10A`):** kéz eszközzel BE/KI. Csak BE állásban a `L1` sorkapocs tápforrás. Zárlatkor automatikus leoldás + hibaüzenet.
- **Egypólusú kapcsoló:** kattintásra billen, zárva belső él `1–2` között.
- **Nyomógomb (NO):** **lenyomva tartva** zár (`3–4`), elengedve bont (momentán).
- **Izzó 1:** világít, ha a `L` kapcson fázis (`L1`) és az `N` kapcson nulla (`N`) van. A `PE` csak védővezető, nem kell a világításhoz.
- **Mágneskapcsoló MK1:** a tekercs akkor húz, ha `A1` és `A2` között fázis és nulla van (tetszőleges polaritás). Húzáskor `13–14` (NO) zár. Az MVP pályán nincs `21–22` (NC) kivezetés, a motor ezt a típust később kezeli.
- **Zárlat:** egy összefüggő komponensben `L1`+`N` vagy `L1`+`PE`. `N`+`PE` együtt nem számít zárlatnak (nincs ÁVK az MVP-ben).
- **Csípőfogó:** a vezeték törlése csak akkor sikerül, ha mindkét vég mechanikailag laza; különben rövid hibaüzenet.
- **Normál mód:** nincs tooltip a kapcsokon. **Debug:** tooltip, élő vezeték fénylése, laza kötések számlálója.
- **Szabványos kábelszín validáció:**
  - A rendszer kizárólag a 3 villamos alapszabályt kéri számon:
    - **Fázisvezető / vezérlés:** kizárólag **Fekete (`L1`)** vezeték (a fáziságak `L1/L2/L3` között nincs külön színkövetelmény, minden fázis- és kapcsolt ág Fekete vezetékkel szabályos; kék vagy zöld-sárga szín használata tiltott).
    - **Nullavezető (`N`):** kizárólag **Kék (`N`)** vezeték (fekete vagy zöld-sárga tilos).
    - **Védővezető (`PE`):** kizárólag **Zöld-sárga (`PE`)** vezeték (egyéb színek tiltottak).
  - **Statikus és dinamikus ellenőrzés:** kikapcsolt és bekapcsolt kismegszakítóknál egyaránt azonnal lefut; a gráfösszefüggések (BFS) segítségével a WAGO-k áramköri szerepkörét is automatikusan felderíti, valamint jelzi a közvetlen zárlatos keresztkötéseket.
  - **Interakció:** Az eszköztáron elhelyezett `🎨 Színellenőrzés` gombbal lebegő panel nyitható meg, amely tételesen listázza a hibákat kapcsolati pontokkal és indoklással, a hibás vezetékek körül pedig élénk piros szaggatott aura és figyelmeztető jelvény jelenik meg a Canvas-on.


## 8. Teljes Iskolai Oktatófal Kiosztás és Bővített Rendszer

A prototípus validációja és a valós fotó (`sources/sorkapocs_kiosztas.png`) analízise alapján a rendszer a teljes iskolai oktatófal hardveres, fizikai és vizuális logikájára bővült.

### 8.1. Sorkapcsok Fizikai Felépítése és Bekötési Logikája:
- **Test feliratok nélkül:** A sorkapcsok fehér műanyag testén magán **semmilyen szöveg vagy sorszám nem szerepel** (se az eszköz neve, se a kapocs száma, se sorszámozás).
- **Kétoldalas felépítés:**
  - **Felső oldal (Előszerelt, gyári bekötés):** A sorkapocs tetejébe gyárilag be van kötve egy rövid vezeték, amely felfelé indul el és belép a fal mögé (átvezető furat). A felső csavar fixen meg van húzva. A kapocs tetején található a gyári színjelölő négyzet (`yellow`, `white`, `brown`, `pe`, `blue`, `red`, `green`, `black`), amely a mögöttes szerelvény vezetékének színét jelzi. A felhasználó a felső oldalhoz **nem köthet vezetéket**, és a felső csavart sem szerelheti (érintéskor tájékoztató figyelmeztetés jelenik meg).
  - **Alsó oldal (Felhasználói bekötési pont):** Kizárólag a sorkapcsok alsó nyílásába csatlakoztatható felhasználói vezeték, és az alsó csavart kell a csavarhúzó eszközzel meghúzni/kilazítani. (A felső és alsó csatlakozás belsőleg fémesen folytonos csomópontot képez).
- **Nyomógomb sziget:** A középső nyomógomb állomás **3 gombos** (Zöld NO, Piros NC, Zöld NO), azaz pontosan **6 sorkapcsot** foglal el (nem 8-at).

### 8.2. Különálló Magyarázó Táblázat (Sorkapocs-kiosztási Jegyzék):
- A falon (vagy lebegő/dokkolt modal ablakban) egy valósághű **Magyarázó Tábla** található, amely 1-az-1-ben tükrözi a két sorkapocssor felépítését sorszámozás nélkül:
  - **Felső sorkapocssor táblázata:** 21 eszközcsoport, összesen 65 kapocs.
  - **Alsó sorkapocssor táblázata:** 17 eszközcsoport, összesen 54 kapocs.
- **Táblázat szerkezete oszloponként (balról jobbra):**
  - **Felső cella:** Eszköz neve függőlegesen írva (`writing-mode: vertical-rl`), összevonva az eszközhöz tartozó sorkapcsok felett.
  - **Középső cella:** A kapocspont pontos jelölése (pl. `L1`, `L2`, `A1`, `A2`, `13`, `14`, `NO 3`, `NC 1` stb.).
  - **Alsó cella:** Színkód jelölőnégyzet.
- **Interakció:** A Canvas jobb alsó részén elhelyezett miniatűr táblaposzterre vagy a fejléc gombjára kattintva azonnal felugrik a részletes, zoomolható táblázat.

### 8.3. FELSŐ SORKAPOCSSOR (Összesen 65 sorkapocs - balról jobbra):
1. **3 FÁZIS NULLÁJA:** `N` (Kék)
2. **3P C16A MEGSZAKÍTÓ:** `L1` (Sárga), `L2` (Sárga), `L3` (Sárga)
3. **1 FÁZIS NULLÁJA:** `N` (Kék)
4. **VÉDŐVEZETŐ:** `PE` (Zöld-sárga)
5. **1P B10A MEGSZAKÍTÓ:** `L1` (Zöld)
6. **1P B16A MEGSZAKÍTÓ:** `L1` (Piros)
7. **IMPULZUSRELÉ:** `A1` (Sárga), `A2` (Kék), `1` (Sárga), `2` (Sárga)
8. **LÉPCSŐHÁZI AUTOMATA:** `N` (Kék), `B` (Barna), `L` (Barna), `4` (Barna)
9. **IDŐRELÉ:** `A1` (Piros), `15` (Piros), `18` (Piros), `16` (Piros), `A2` (Kék)
10. **MÁGNESKAPCSOLÓ MK1 (fő bemenet):** `L1` (Sárga), `L2` (Sárga), `L3` (Sárga)
11. **MÁGNESKAPCSOLÓ MK2 (fő bemenet):** `L1` (Fekete), `L2` (Fekete), `L3` (Fekete)
12. **MÁGNESKAPCSOLÓ MK3 (fő bemenet):** `L1` (Piros), `L2` (Piros), `L3` (Piros)
13. **MOTORVÉDŐ (fő bemenet):** `L1` (Barna), `L2` (Barna), `L3` (Barna)
14. **MÁGNESKAPCSOLÓ MK1 (fő kimenet):** `T1` (Sárga), `T2` (Sárga), `T3` (Sárga)
15. **MÁGNESKAPCSOLÓ MK2 (fő kimenet):** `T1` (Fekete), `T2` (Fekete), `T3` (Fekete)
16. **MÁGNESKAPCSOLÓ MK3 (fő kimenet):** `T1` (Piros), `T2` (Piros), `T3` (Piros)
17. **MOTORVÉDŐ (fő kimenet):** `T1` (Barna), `T2` (Barna), `T3` (Barna)
18. **MÁGNESKAPCSOLÓ MK1 (segédérintkező + tekercs):** `13` (Sárga), `21` (Sárga), `A1` (Sárga), `14` (Sárga), `22` (Sárga), `A2` (Kék)
19. **MÁGNESKAPCSOLÓ MK2 (segédérintkező + tekercs):** `13` (Fekete), `21` (Fekete), `A1` (Fekete), `14` (Fekete), `22` (Fekete), `A2` (Kék)
20. **MÁGNESKAPCSOLÓ MK3 (segédérintkező + tekercs):** `13` (Piros), `21` (Piros), `A1` (Piros), `14` (Piros), `22` (Piros), `A2` (Kék)
21. **MOTORVÉDŐ (NC segédérintkező):** `95` (Barna), `96` (Barna)

### 8.4. ALSÓ SORKAPOCSSOR (Összesen 54 sorkapocs - balról jobbra):
1. **DUGASZOLÓALJZAT:** `L` (Sárga), `N` (Kék), `PE` (Zöld-sárga)
2. **VÁLTÓKAPCSOLÓ 106 (1.):** `1` (Fekete), `2` (Fekete), `3` (Fekete)
3. **KERESZTVÁLTÓKAPCSOLÓ 107:** `1` (Fehér), `2` (Fehér), `3` (Fehér), `4` (Fehér)
4. **VÁLTÓKAPCSOLÓ 106 (2.):** `1` (Kék), `2` (Kék), `3` (Kék)
5. **NYOMÓKAPCSOLÓ 101N (1.):** `1` (Piros), `2` (Piros)
6. **NYOMÓKAPCSOLÓ 101N (2.):** `1` (Sárga), `2` (Sárga)
7. **NYOMÓKAPCSOLÓ 101N (3.):** `1` (Zöld), `2` (Zöld)
8. **EGYPÓLUSÚ KAPCSOLÓ 101:** `1` (Kék), `2` (Kék)
9. **KÉTPÓLUSÚ KAPCSOLÓ 102:** `1 L` (Piros), `2 L` (Piros), `3 N` (Kék), `4 N` (Kék)
10. **CSILLÁRKAPCSOLÓ 105:** `1` (Sárga), `2` (Sárga), `3` (Sárga)
11. **BAL OLDALI NYOMÓGOMBOK:** `NO 3` (Zöld), `NO 4` (Zöld), `NC 1` (Piros), `NC 2` (Piros)
12. **NYOMÓGOMB SZIGET (3 gombos):** `NO 3` (Zöld), `NO 4` (Zöld), `NC 1` (Piros), `NC 2` (Piros), `NO 3` (Zöld), `NO 4` (Zöld)
13. **JOBB OLDALI NYOMÓGOMBOK:** `NO 3` (Zöld), `NO 4` (Zöld), `NC 1` (Piros), `NC 2` (Piros)
14. **IZZÓ 1:** `L` (Barna), `N` (Kék), `PE` (Zöld-sárga)
15. **IZZÓ 2:** `L` (Zöld), `N` (Kék), `PE` (Zöld-sárga)
16. **IZZÓ 3:** `L` (Sárga), `N` (Kék), `PE` (Zöld-sárga)
17. **MOZGÁSÉRZÉKELŐ:** `L↑` (Piros), `N↑` (Kék), `L↓` (Piros)

### 8.5. TÁBLAMÉRET, WAGO ÉS GYAKORLÓTÉR:
- **Megnövelt munkatér (2200 x 1300 px):** A tábla teljes magassága megnövelt, biztosítva a bőséges helyet mind a vezetékezésnek, mind az oktatófali plakátnak.
- **Sorkapocssínek távolsága:** A felső sorkapocssor (`y = 180`) és az alsó sorkapocssor (`y = 460`) között több mint 140 px tiszta átvezető sáv áll rendelkezésre, így a felső és alsó kapcsok közötti kötések kényelmesen, áttekinthetően és kereszteződések nélkül vezethetők el.
- **Wago blokkok:** Az alsó sorkapocssor alatt 5 darab 5-ös Wago összekötő blokk működő, egyenként kattintható emelőkarokkal (`y = 635`).
- **Valósághű Magyarázó Plakát a falon (`y = 725..1040`):** Közvetlenül a Canvas felületén elhelyezett nagy méretű (1460 x 315 px) plakát, amely nemcsak egyszerű színcsíkokat mutat, hanem feliratozva, oszloponként részletesen ábrázolja a teljes 65-ös felső és 54-es alsó sorkapocskiosztást (eszköznevek, kapocsponti jelölések, színkód-négyzetek).
- A szimulációs motorban mind a 3 fázis, mind a védelmi eszközök (C16A, B10A, B16A, motorvédő), az impulzusrelé, lépcsőházi automata, időrelé, mágneskapcsolók (fő- és segédérintkezők) és fényforrások/érzékelők teljes gráf-alapú logikája implementálva van.

### 8.6. Áram-védőkapcsolók (ÁVK / FI-relé) és Védelmi Rendszer:
- **Két ÁVK a kiselosztóban (`sources/pelda_kotes.jpg` kiosztás):**
  - **4P ÁVK (`rcd_3p`, 40A / 30mA):** a `3P C16A` kismegszakítót és a `3 Fázis Nullája` (`top_3n`) ágat védi.
  - **2P ÁVK (`rcd_1p`, 25A / 30mA):** az `1P B10A` és `1P B16A` kismegszakítókat és az `1 Fázis Nullája` (`top_1n`) ágat védi.
  - Az ÁVK-knak nincs külön külső sorkapocs kivezetésük: belső védelmi eszközként közvetlenül az általuk védett megszakítók és nullavezetők elé vannak bekötve.
- **Kezdőállapot és Upstream tápfüggőség:**
  - Mindkét ÁVK alapértelmezetten lekapcsolt (`KI`, `on: false`) állapotban indul.
  - Ha egy ÁVK `KI` állásban van, a mögötte lévő kismegszakítók és a hozzá tartozó nulla sorkapocs feszültségmentesek (`"none"`), még akkor is, ha maga a kismegszakító fel van kapcsolva.
- **Működő T tesztgomb és főkar (Kéz eszközzel):**
  - **Főkar (`BE / KI`):** kézi működtetés, optikai állapotjelzővel (Zöld: nyitott/KI, Piros: zárt/BE).
  - **`T` tesztgomb:** `BE` állapotban megnyomva azonnal leoldja az ÁVK-t; `KI` állapotban nem vált ki leoldást.
- **Hibaáram- és zárlatvédelem:**
  - `L ↔ PE` (fázis–védővezető testzárlat): az érintett ÁVK és a kismegszakító is leold.
  - `N ↔ PE` (nulla–védővezető érintkezés bekapcsolt ÁVK mögött): az érintett ÁVK leold (a kismegszakító nem).
  - `3F N ↔ 1F N` összekötés (párhuzamosított nulla ágak): mindkét ÁVK leold.
  - **Keresztbe kötött nulla fogyasztóknál:** ha egy terhelés fázisa az egyik ÁVK-ról, nullája a másikról érkezik (`1P L` + `3F N` vagy `3F L` + `1F N`), vagy ha a nulla helyett `PE`-re van kötve a fogyasztó, hibaáram miatt az ÁVK-k leoldanak.
  - **Szelektív leoldás:** a hiba csak a közvetlenül érintett védelmi eszközt oldja le.

### 8.7. 3 Fázisú Villanymotor és 6+1 Fix WAGO Csatlakozás:
- **Ipari motor elhelyezése (`x = 1750..2040, y = 1030..1280`):**
  - Az alsó munkapad jobb szélén, a fa asztallapon elhelyezkedő bordázott ipari 3 fázisú aszinkron motor, szerelőtalpakkal és érintkezési árnyékkal.
  - Vizuális felépítés: öntvény motorház 8 hűtőbordával, szerelőtalpak és rögzítőcsavarok, emelőszem, kapocsház felső tömszelencével és PE földelési LED-del, csapágypajzs, ventilátor rács és forgó lapátkerék.
  - Dinamikus animáció: valósághű gyorsulással és lassulási tehetetlenséggel forog, forgásirány-kijelző nyíllal (`CW ↻` vagy `CCW ↺`).
  - Fázishiba (`phase_fault`) esetén a motor mechanikusan vibrál/rezeg a képernyőn.
  - Digitális LED állapotkijelző panel a motor tetején (`ÁLL (0.0 A)`, `Y ↻ CSILLAG 1.8 A`, `Δ ↻ DELTA 5.4 A`, `⚡ FÁZISHIBA! 8.5 A`).
- **6+1 db rögzített 3-as WAGO a plakát alatt (`y = 975`, `x = 740..1460`):**
  - A motortól vastag fekete gégecső fut fel a falra és a poszter alatt a 6+1 db 3-as WAGO-hoz.
  - 6 tekercskivezetés: `U1`, `V1`, `W1`, `U2`, `V2`, `W2`.
  - 1 védővezető kivezetés: `PE`.
  - Mindegyik WAGO 1. portjában gyárilag zárt (`tight: true`) fekete vezeték (PE esetén zöld-sárga) csatlakozik a motorkábelből, felette fehér szigetelőszalag kivezetési zászlóval (`U1`..`W2` és `PE`).
  - A 2. és 3. port nyitott karral (`tight: false`) indul, ide kötheti a tanuló a csillag/delta áthidalásokat és a betápláló/mágneskapcsoló vezetékeket.
  - **Védelem:** A motor WAGO-i `fixed: true` jelölésűek (nem mozgathatók, nem törölhetők), az 1. gyári karjuk nem nyitható (toast figyelmeztetés), a 2. és 3. kar Kéz eszközzel szabadon kapcsolható.
- **Elektromos szimulációs logika:**
  - **Csillagüzem (Y):** `U2, V2, W2` egy pontba kötve (áthidalás vagy behúzott `MK2`), `U1, V1, W1`-re pedig 3 fázis (`L1, L2, L3`) jut -> motor forog, névleges áram `1.8 A`.
  - **Deltaüzem (Δ):** mindhárom tekercs fázis–fázis (400V) háromszög-kapcsolást kap (`U1–W2, V1–U2, W1–V2` áthidalva vagy `MK1 + MK3`-on át) -> motor forog, vonali áram `5.4 A`.
  - **Forgásirány (`CW` / `CCW`):** ciklikus `L1–L2–L3` sorrendnél jobbra (`CW`), két fázis felcserélésekor balra (`CCW`).
  - **Fázishiba (`phase_fault`):** 1 fázis kiesése/lekötése esetén a motor nem forog (`speed: 0`), megnövekedett áramfelvétel (`8.5 A`), rezgés és figyelmeztetés.
  - **PE földelés felügyelet:** Földelés nélküli motorüzem esetén figyelmeztetés.
  - **Zárlatvédelem:** Csillag és Delta egyidejű hibás bekapcsolásakor (pl. `MK2` és `MK3` egyszerre behúzva) a kismegszakító azonnal leold.

### 8.8. UNI-T UT18D Feszültség- és Folytonosságvizsgáló Műszer:
- **Két mérőtüskés működés (`ToolMode = "tester"`):**
  - Aktiválható a felső eszköztár `⚡ UNI-T vizsgáló` gombjával vagy a munkapadon elhelyezett UNI-T műszerre kattintva.
  - **1. kattintás:** lerakja a **fekete (`COM / −`)** mérőtüskét bármely mérhető pontra (sorkapocs felső gyári vagy alsó csavarja/nyílása, szabad 3/5-ös WAGO nyílás, a motor 6+1 db fix WAGO-ja, valamint a dugaszolóaljzat `L`, `N` és `PE` érintkezői).
  - **Élő mérés és 2. kattintás:** az egér mozgatásával a **piros (`+`)** mérőtüske élőben mér a rögzített fekete ponthoz képest; 2. kattintásra a piros tüske is rögzül, így **Kéz** vagy **Csavarhúzó** eszközre átváltva kapcsolgatás közben is élőben követhető a mérés.
  - **Tüskék elemelése:** jobb egérgomb, `Esc` billentyű, üres helyre kattintás vagy a műszerpanel `⏏ Levétel` gombja.
  - **Információelrejtés védelme:** gyakorló módban a sorkapcsoknál kizárólag a fizikai sor- és oszlopszám (`X1/..`, `X2/..`) látszik a műszerpanelen, a kapocs rejtett funkciója nem jelenik meg.
- **Mérési logika:**
  - **Feszültségmérés:** Fázis (`L1/L2/L3`) ↔ `N` vagy `PE` → **`230 V AC`**; két különböző fázis (`L1–L2`, `L2–L3`, `L3–L1`) → **`400 V AC`** + forgásirány (`R ↻` vagy `L ↺`); azonos potenciál vagy lebegő pontok → **`0 V`**.
  - **Egypólusú fázisjelzés (`⚡` LED):** világít, amint bármelyik mérőtüske élő fázist (`L1/L2/L3`) érint.
  - **Folytonosságvizsgálat (`0.0 Ω` / `OL` + sípolás):** kizárólag feszültségmentes pontok között aktív (feszültség alatt nem csipog). Kikapcsolt kismegszakítóknál is ellenőrzi a fémes összeköttetést meghúzott vezetékeken és zárt érintkezőkön át; folytonosságnál `0.0 Ω`, `🔊 Rx` LED és némítható **Web Audio API** sípoló hang jelzi az áramutat.
- **Lebegő UNI-T UT18D műszerpanel:** szabadon mozgatható (draggable) panel `12V / 24V / 50V / 120V / 230V / 400V` LED sávval, `⚡ FÁZIS`, `~ AC`, `🔊 Rx` és `L / R` LED-ekkel, kétszínű háttérvilágításos LCD kijelzővel, némítás és tüske-levétel vezérlőkkel.

### 8.9. Digitális Lakatfogó (UNI-T UT202A+) és Fázor Áramhálózat-megoldó:
- **Fázor-alapú csomóponti árammegoldó (`src/engine/currentSolver.ts`):**
  - Komplex csomóponti admittanciamátrix (`L1: 230V ∠ 0°`, `L2: 230V ∠ -120°`, `L3: 230V ∠ +120°`, `N` és `PE`: `0V`) és Gauss-elimináció segítségével minden bekötött vezetéken kiszámítja a valós effektív váltakozó áramot (`SimState.wireCurrents`).
  - **Fogyasztók névleges áramfelvételei:**
    - Izzó (100 W): `~0.43 A` (párhuzamosan kötve a közös főágon és nullán `0.86 A` / `1.29 A`, az egyedi leágazásokon `0.43 A`).
    - Mágneskapcsoló tekercs (`A1–A2`): `~0.05 A`.
    - Impulzusrelé, lépcsőházi automata, időrelé és mozgásérzékelő (PIR): `~0.02 A`.
    - 3F villanymotor: álló `0.00 A`, Csillag (`Y`) üzem `~1.80 A`, Delta (`Δ`) vonali áram `~5.40 A` (delta tekercság `~3.12 A`), 2-fázisú fázishiba `~8.50 A`.
  - **Fizikai tulajdonságok:** kiegyensúlyozott 3-fázisú terhelés közös nullavezetőjén `0.00 A` (2 aktív fázisnál vektoriálisan `0.43 A`); nyitott áramkörben, laza csavarnál, nyitott WAGO karnál és `PE` védővezetőn `0.00 A`.
- **Lakatfogó használata (`ToolMode = "clamp"`):**
  - Aktiválható a felső eszköztár `🧲 Lakatfogó` gombjával vagy az alsó munkapadon lévő lakatfogóra kattintva.
  - Vezeték fölé húzva a nyitott lakatfogó pofa térben rázár a vezetékre és azonnal mutatja az élő áramerősséget; kattintással a pofa rögzül a vezetéken (`📌`), így **Kéz** vagy **Csavarhúzó** eszközre váltva kapcsolgatás közben is élőben figyelhető az áramváltozás.
  - **Információelrejtés védelme:** gyakorló módban a vezetéknél kizárólag a szigetelés színe és a fizikai végpontok (`X1/..`, `X2/..`, WAGO típus) jelennek meg, a rejtett kapocsfunkció nem szivárog ki.
  - **Lebegő UNI-T UT202A+ műszerpanel:** szabadon mozgatható panel (az UNI-T UT18D feszültségvizsgálóval párhuzamosan is nyitva tartható) `~ AC A`, `HOLD` és `MAX!` LED-ekkel, háttérvilágításos LCD kijelzővel, 20 szegmenses analóg sávkijelzővel, `⏸ HOLD` (`H` gyorsbillentyű) érték-kimerevítéssel és `⏏ Lecsatolás` (`Esc` / jobb klikk) vezérlővel.

