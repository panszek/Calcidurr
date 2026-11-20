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
- `src/engine/` — szimuláció, UI nélkül.
  - `simulation.ts` — gráfépítés, BFS potenciálterjesztés, zárlat, fogyasztók, MK iteráció.
- `src/canvas/` — megjelenítés és egérkezelés.
  - `renderer.ts` — sorkapocs, Wago, készülékek, vezeték, debug overlay.
  - `input.ts` — mágneses tapadás, szabadkézi vonal, eszközök hittestje.
- `src/data/` — pályaadatok.
  - `colors.ts` — vezeték- és jelölőszínek.
  - `prototypeTrack.ts` — az MVP tesztpálya koordinátái és csomópontjai.

## 6. Vizuális referenciák
A `sources/` mappa a valós oktatófalat dokumentálja:
- `sources/pelda_kotes.jpg` — OSB oktatófal, DIN kismegszakítók, sorkapocssorok, kapcsolók, nyomógombok, izzók, Wago/vezetékezés.
- `sources/sorkapocs_kiosztas.jfif` — sorkapocs-kiosztás: függőleges feliratok, alsó színkód-sáv (N/L/PE/vezérlés).

A prototípus **nem** a teljes falat másolja, csak a 4. pont elemeit, de a sorkapocs megjelenése (fehér oszlop, függőleges címke, csavar, alsó színnégyzet) és az OSB-szerű háttér ezeket a fotókat követi.

## 7. Prototípus viselkedési pontosítások
Ezek a szabályok a SPEC 1–4. pontjait egészítik ki a megvalósítás során:

- Egy kapocspontba / Wago nyílásba **egyszerre egy vezetékvég** köthető.
- Új vezeték rögzítésekor a két végpont **automatikusan meglazul** (sorkapocsnál csavar ki, Wago-nál kar fel), a tanulónak meg kell húznia / le kell hajtania a kart.
- A Wago 3 nyílása **közös elektromos csomópont**: a zárt karú, bekötött erek párhuzamosan kötnek.
- **Kismegszakító (`1P B10A`):** kéz eszközzel BE/KI. Csak BE állásban a `L1` sorkapocs tápforrás. Zárlatkor automatikus leoldás + hibaüzenet.
- **Egypólusú kapcsoló:** kattintásra billen, zárva belső él `1–2` között.
- **Nyomógomb (NO):** **lenyomva tartva** zár (`3–4`), elengedve bont (momentán).
- **Izzó 1:** világít, ha a `L` kapcson fázis (`L1`) és az `N` kapcson nulla (`N`) van. A `PE` csak védővezető, nem kell a világításhoz.
- **Mágneskapcsoló MK1:** a tekercs akkor húz, ha `A1` és `A2` között fázis és nulla van (tetszőleges polaritás). Húzáskor `13–14` (NO) zár. Az MVP pályán nincs `21–22` (NC) kivezetés, a motor ezt a típust később kezeli.
- **Zárlat:** egy összefüggő komponensben `L1`+`N` vagy `L1`+`PE`. `N`+`PE` együtt nem számít zárlatnak (nincs ÁVK az MVP-ben).
- **Csípőfogó:** a vezeték törlése csak akkor sikerül, ha mindkét vég mechanikailag laza; különben rövid hibaüzenet.
- **Normál mód:** nincs tooltip a kapcsokon. **Debug:** tooltip, élő vezeték fénylése, laza kötések számlálója.
