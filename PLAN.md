# Véglegesített megvalósítási terv — `TODO.md`

Ez a dokumentum a `TODO.md` összes elemét tartalmazza a véglegesített döntésekkel és önállóan tesztelhető részfeladatokra bontva, hogy külön szálakon, egyesével is megvalósítható és ellenőrizhető legyen.

---

## Rögzített tervezési döntések

1. **Sorkapocs csavarok:** A felhasználónak nem kell előre kicsavarnia a csavarokat — az üres sorkapcsok alapból **kilazított (`tight: false`)** állapotból indulnak, a csavarok kattintási zónája pontos (átfedés nélküli), és a felső/alsó csavarok horonyiránya egységes.
2. **3 fázisú villanymotor csatlakozása:** Kapocsléc helyett a sorkapocs-kiosztási poszter alatt **6+1 db rögzített 3-as WAGO** található, amelyek 1. nyílásába gyárilag/fixen be vannak kötve a motor kábeléből érkező **fekete** (`U1`, `V1`, `W1`, `U2`, `V2`, `W2` — fehér szigszalag zászlócskákkal jelölve) és **zöld-sárga** (`PE`) erek.
3. **Kábelszín-validáció:** Kizárólag a 3 alapszabályt ellenőrzi: **Fekete** = fázisvezető (minden fázis- és kapcsolt fáziság, `L1/L2/L3` további bontás nélkül), **Kék** = nullavezető (`N`), **Zöld-sárga** = védővezető (`PE`).
4. **Kezdőállapot és ÁVK-k:** Mindig **minden `KI` állapotban indul** (kismegszakítók, mindkét ÁVK, motorvédő, kapcsolók). Az ÁVK-knak **nincs** külön sorkapocs-kivezetésük; belsőleg csak az őket követő kismegszakítókat (és a hozzájuk tartozó nulla kört) védik.
5. **Eszközök, tekercsek, szerszámok:** **Hibrid megoldás** — az alsó Canvas munkapad elemei (vezetéktekercsek, WAGO dobozok, szerszámok, műszerek) közvetlenül kattinthatók, és emellett a felső sávban is szöveg nélküli grafikus SVG ikonok állnak rendelkezésre rázoomolt munkához.

---

## I. Lefejlesztendő elemek

### 1. 3 fázisú villanymotor

A falon már meglévő `3P C16A`, `Motorvédő`, `Időrelé` és `MK1–MK3` mágneskapcsolók segítségével direkt indítás, forgásirány-váltás és csillag–delta (Y/Δ) indítás is megvalósítható.

- **Elhelyezés a Canvas-on:**
  - A **sorkapocs poszter** (`y = 725..1040`) magassága kissé tömörül (pl. `y = 700..945`), így közvetlenül a poszter alatt (`y = 955..1060`) tiszta hely nyílik a motor **6+1 db fix 3-as WAGO**-jának és a kábelbevezetésnek.
  - Maga a **3 fázisú villanymotor** a fal jobb oldalán (az alsó sorkapocssor mellett, `x = 1900..2175, y = 375..695`) jelenik meg, ahonnan vastag fekete motorkábel fut le a poszter alatti 6+1 db 3-as WAGO-hoz.
- **6+1 db rögzített 3-as WAGO (valós gyakorlati bekötés):**
  - **6 db tekercs-kivezetés (`U1`, `V1`, `W1`, `U2`, `V2`, `W2`):**
    - Mindegyik 3-as WAGO 1. portjában gyárilag, fixen (zárt karral, nem bonthatóan) egy **fekete** vezeték van bekötve a motor kábelkötegéből.
    - Minden fekete éren a WAGO felett egy **fehér szigetelőszalag fül (zászlócska)** látható a ráírt kivezetés kóddal: `U1`, `V1`, `W1`, `U2`, `V2`, `W2`.
    - A maradék 2-2 szabad WAGO nyílás nyitott karral indul: a tanuló ide kötheti a csillag/delta áthidalókat és a betáp/mágneskapcsoló szálakat.
  - **+1 db védővezető (`PE`) 3-as WAGO:**
    - Az 1. portjában fixen a kábelkötegből érkező **zöld-sárga (`PE`)** vezeték van bekötve (opcionálisan `PE` jelölőfüllel), 2 szabad nyílással.
  - **Védelem:** A motor WAGO-i `fixed: true` jelölést kapnak: nem mozgathatók, nem dobhatók vissza a WAGO dobozba, és a gyári 1. karjuk nem nyitható ki (próbálkozáskor tájékoztató toast).
- **Szimuláció (`src/engine/simulation.ts`):**
  - 3 tekercs (`U1–U2`, `V1–V2`, `W1–W2`) kiértékelése a potenciálok és az összekötött gráf alapján:
    - **Csillagüzem (Y):** `U2`, `V2`, `W2` azonos összefüggő komponensben van (pl. áthidalt WAGO-k vagy behúzott `MK2`), és `U1, V1, W1` három különböző fázist kap (`L1, L2, L3`).
    - **Deltaüzem (Δ):** mindhárom tekercsen 400V fázis–fázis feszültség van szabályos háromszög-kapcsolásban (pl. `U1–W2`, `V1–U2`, `W1–V2` áthidalva vagy `MK1` + `MK3`-on át).
    - **Forgásirány:** `L1–L2–L3` ciklikus sorrend → jobbra (`CW`), két fázis felcserélve → balra (`CCW`).
    - **Hibaállapotok:** 2 fázisú táplálásnál nem forog szabályosan (búg/rezeg, megnövekedett áram, figyelmeztetés); hibás Y+Δ egyidejű összekötésnél zárlat (`3P C16A` leold); hiányzó `PE` bekötésnél figyelmeztetés.
  - **Névleges áramok (lakatfogóhoz):** álló `0.0 A`, Csillag `~1.8 A`, Delta vonali `~5.4 A` (tekercság `~3.1 A`), fázishiba `~8.5 A`.
- **Megjelenítés és animáció (`src/canvas/renderer.ts`, `src/main.ts`):**
  - Bordázott ipari motorház, animált forgó tengely/lapát (gyorsulással/lassulással, `CW`/`CCW` nyíllal), üzemmód kijelző (`ÁLL` / `Y ↻` / `Δ ↻` / `↺` / `FÁZISHIBA`).
- **Érintett fájlok:** `src/models/types.ts`, `src/data/prototypeTrack.ts`, `src/models/world.ts`, `src/engine/simulation.ts`, `src/canvas/renderer.ts`, `src/canvas/input.ts`, `src/main.ts`.
- **Tesztelési szempontok:**
  - A poszter alatt megjelenik a 6+1 db fix 3-as WAGO a kábelköteggel és fehér szigszalag fülekkel (`U1..W2` + zöld-sárga `PE`).
  - A fix WAGO-k nem húzhatók el és az 1. karjuk nem nyitható, a 2. és 3. nyílás viszont szabadon beköthető.
  - Csillag kötés (`U2–V2–W2` áthidalva, `U1/V1/W1`-re `L1/L2/L3`) → motor forog jobbra; 2 fázis cseréjével balra forog.
  - 1 fázis lekötésével fázishiba állapot látszik; Delta kötésben is szabályosan forog.

---

### 2. UNI-T folytonosság vizsgáló és feszmérő eszköz

Kétpólusú feszültség- és folytonosságvizsgáló (UNI-T UT18C/UT18D mintára).

- **Új eszközmód:** `ToolMode` bővítése `"tester"` értékkel.
- **Két mérőtüskés működés:**
  - 1. kattintás bármely mérhető pontra (sorkapocs alsó/felső pontja, WAGO nyílás, dugalj, motor WAGO-k) lerakja a **fekete (COM / `-`)** mérőtüskét.
  - Az egér mozgatásával a **piros (`+`)** mérőtüske élőben méri a feszültséget/folytonosságot az aktuális pont és a rögzített fekete tüske között.
  - 2. kattintás rögzíti a piros tüskét is (így Kéz eszközre váltva kapcsolgatás közben is látható a mérés). Jobb klikk / `Esc` / üres helyre kattintás elemeli a tüskéket.
  - A két mérőtüske és mérőzsinór vizuálisan kirajzolódik a Canvas-on.
- **Mérési logika (`src/engine/measurements.ts`):**
  - **Feszültségmérés:**
    - Fázis (`L1/L2/L3`) ↔ `N` vagy `PE` → **`230 V AC`**
    - Két különböző fázis (`L1–L2`, `L2–L3`, `L3–L1`) → **`400 V AC`** + fázissorrend (`R`/`L`)
    - Azonos potenciál vagy lebegő pontok → **`0 V`**
    - Egypólusú fázisjelzés (`⚡` LED), ha valamelyik tüske fázison van.
  - **Folytonosság-vizsgálat (csipogás):**
    - Csak **feszültségmentes** pontok között aktív (ha >12V van, automatikusan feszültséget mér és nem csipog).
    - Gráf-elérhetőség (BFS) meghúzott vezetékeken és zárt érintkezőkön át (kikapcsolt kismegszakítóknál is!).
    - Folytonosságnál `0.0 Ω` / `🔊` LED + **Web Audio API** sípoló hang (némítható); szakadásnál `OL`.
- **Lebegő UNI-T műszerpanel (`src/ui/instrumentPanel.ts`):**
  - LCD kijelző + LED feszültségsáv (`12V / 24V / 50V / 120V / 230V / 400V`) + `AC`, `⚡`, `🔊 Rx`, `R/L` LED-ek + hang némítása / tüskék levétele gomb.
- **Érintett fájlok:** `src/engine/measurements.ts` (új), `src/ui/instrumentPanel.ts` (új), `src/models/types.ts`, `src/canvas/renderer.ts`, `src/canvas/input.ts`, `src/main.ts`, `src/style.css`.
- **Tesztelési szempontok:**
  - Kikapcsolt kismegszakítónál egy meghúzott vezeték két vége vagy egy zárt kapcsoló `1–2` kapcsa között csipog és `0.0 Ω`-t mutat; nyitott kapcsolónál vagy laza csavarnál `OL`.
  - Bekapcsolt ÁVK + kismegszakítónál `L1–N` és `L1–PE` között `230 V AC`, `L1–L2` között `400 V AC` jelenik meg, és feszültség alatt nem csipog folytonosságot.
  - Rögzített tüskékkel Kéz eszközre váltva kapcsoló billentésekor élőben frissül a műszer kijelzője.

---

### 3. ÁVK-k működő tesztgombbal

A `sources/pelda_kotes.jpg` kiosztásának megfelelően **2 db ÁVK** kerül a kiselosztóba, saját sorkapocs-kivezetések nélkül — belsőleg közvetlenül a mögöttük lévő kismegszakítókat (és a hozzájuk tartozó nulla kört) védik:

1. **4P ÁVK (`rcd_3p`, 40A / 30mA):** belsőleg védi a `3P C16A` kismegszakítót és a `3 Fázis Nullája` (`top_3n`) ágat.
2. **2P ÁVK (`rcd_1p`, 25A / 30mA):** belsőleg védi az `1P B10A` és `1P B16A` kismegszakítókat és az `1 Fázis Nullája` (`top_1n`) ágat.

- **Kiselosztó elrendezés (`src/data/prototypeTrack.ts`, `src/canvas/renderer.ts`):**
  - A `Motorvédő` kikerül a kiselosztó doboz jobb oldala mellé (`x ≈ 590`, mint a valós fotón), a kiselosztó kicsit szélesedik (`x = 40..576`), sorrendben: `4P ÁVK` → `3P C16A` → `2P ÁVK` → `1P B10A` → `1P B16A` → `Impulzusrelé` → `Lépcsőházi aut.` → `Időrelé`.
  - A sorkapocssor (65 felső + 54 alsó) és a magyarázó tábla **változatlan marad**.
- **Működő `T` tesztgomb és főkar:**
  - Mindkét ÁVK-nak két külön kattintható zónája van (Kéz eszközzel):
    - **Főkar (`BE / KI`):** manuális be-/kikapcsolás (`on` váltás).
    - **`T` tesztgomb:** `BE` állapotban megnyomva azonnal leoldja az adott ÁVK-t `KI` állásba (toast üzenettel: *"4P/2P ÁVK teszt sikeres — leoldott"*); `KI` állapotban megnyomva nem történik leoldás.
- **Elektromos védelmi logika (`src/engine/simulation.ts`):**
  - **Upstream tápfüggőség:** Ha egy ÁVK `KI` állapotban van, a mögötte lévő kismegszakítók kimenetei és a hozzá tartozó nulla sorkapocs feszültségmentesek (`"none"`), akkor is, ha a kismegszakító fel van kapcsolva.
  - **Hibaáram-leoldás:**
    - `L ↔ PE` érintkezés/testzárlat → az érintett ÁVK (és direkt zárlatnál a kismegszakító) leold.
    - `N ↔ PE` összekötés bekapcsolt ÁVK mögött → az érintett ÁVK leold.
    - **Keresztbe kötött nulla:** ha egy fogyasztó az `1P` kör fázisát (`2P ÁVK`) és a `3F` kör nulláját (`4P ÁVK`) használja (vagy fordítva), illetve ha `3F N` és `1F N` össze van kötve → hibaáram miatt az ÁVK-k leoldanak érthető hibaüzenettel.
  - **Pontos forráskövetés:** A BFS során a csomópontok forrás-megszakítóját és forrás-ÁVK-ját is tároljuk, így zárlatnál csak az érintett védelmi eszköz(ök) oldanak le, nem az összes.
- **Érintett fájlok:** `src/models/types.ts`, `src/data/prototypeTrack.ts`, `src/models/world.ts`, `src/engine/simulation.ts`, `src/canvas/renderer.ts`, `src/canvas/input.ts`, `src/main.ts`.
- **Tesztelési szempontok:**
  - Mindkét ÁVK `KI` állapotban indul; `KI` állapotban a `T` gomb nem csinál semmit, `BE` állapotban a `T` gomb leoldja az adott ÁVK-t.
  - Ha `2P ÁVK` le van kapcsolva és `1P B10A` fel van kapcsolva, az `1P B10A` kimenete feszültségmentes marad; `2P ÁVK` felkapcsolása után megjelenik az `L1`.
  - `1P B10A (L1)` + `3F N` közé kötött izzónál bekapcsoláskor leold az ÁVK; `N–PE` összekötéskor is leold.

---

### 4. Lakatfogó az áramfelvétel méréshez

Valós ágáram-számítás minden bekötött vezetéken, hogy párhuzamos fogyasztóknál, közös főágakon, nullavezetőkön és a 3 fázisú motor csillag/delta üzemében is fizikailag helyes Amper értékeket lehessen mérni.

- **Fázor-alapú áramhálózat megoldó (`src/engine/currentSolver.ts`):**
  - Fogyasztók névleges áramai:
    - Izzó (100 W): `~0.43 A`
    - Mágneskapcsoló tekercs: `~0.05 A`
    - Relék / PIR: `~0.02 A`
    - 3F villanymotor: Csillag `~1.80 A`, Delta vonali `~5.40 A` (tekercság `~3.12 A`), fázishibás `~8.50 A`
  - Kirchhoff csomóponti/ágáram-számítás komplex fázorokkal (`L1: 0°`, `L2: -120°`, `L3: +120°`):
    - Két párhuzamos izzó közös betápvezetékén `~0.86 A`, az elágazásokon `~0.43 A` mérhető.
    - Kiegyensúlyozott 3-fázisú terhelés közös nullavezetőjén `0.00 A`.
    - Nyitott körben, laza kötésnél vagy `PE` vezetéken `0.00 A`.
  - A `SimState` bővítése `wireCurrents: Record<string, number>` mezővel.
- **Lakatfogó mód (`ToolMode = "clamp"`):**
  - Vezeték fölé húzva a lakatfogó pofája vizuálisan rázár a vezetékre, kattintással rögzíthető az adott vezetéken (így Kéz eszközzel kapcsolgatva élőben figyelhető az áramváltozás).
  - Lebegő lakatfogó LCD panel (`AC A`, Amper érték, `HOLD`, lecsatolás gomb).
- **Érintett fájlok:** `src/engine/currentSolver.ts` (új), `src/ui/instrumentPanel.ts`, `src/models/types.ts`, `src/engine/simulation.ts`, `src/canvas/renderer.ts`, `src/canvas/input.ts`, `src/main.ts`.
- **Tesztelési szempontok:**
  - Kikapcsolt fogyasztó vezetékén `0.00 A`, 1 világító izzó fázis- és nullavezetékén `~0.43 A`.
  - 2 párhuzamos izzó közös betápján `~0.86 A`, egyedi ágain `~0.43 A`.
  - 3F motor csillag üzemben `~1.80 A`, delta üzemben vonali szálon `~5.40 A`, tekercságban `~3.12 A`.

---

### 5. Használt kábel szín helyesség ellenőrzés

Egyszerű, egyértelmű szabványi színvalidáció (`src/engine/colorCheck.ts`), amely kikapcsolt és bekapcsolt kismegszakítóknál is működik.

- **Szabályrendszer (rögzített döntés alapján):**
  - **Fázisvezető / vezérlőág** (minden fázisforrás `L1/L2/L3`, kapcsolók, nyomógombok, relé/MK fő- és segédérintkezők, tekercs `A1`, lámpa/dugalj `L`, motor `U1..W2` ágai): kizárólag **Fekete** (`L1`)! *(A fázisvezetők között nincs `L1/L2/L3` megkülönböztetés.)*
  - **Nullavezető (`N`):** kizárólag **Kék** (`N`)! (`3F N`, `1F N`, fogyasztók `N`, tekercsek `A2` ágai.)
  - **Védővezető (`PE`):** kizárólag **Zöld-sárga** (`PE`)! (`Védővezető`, lámpák/dugalj/motor `PE` ágai.)
- **Statikus + dinamikus felismerés:**
  - A bekötött gráf összefüggő komponenseiben a csomópont-szerepkörök (és bekapcsolt állapotban a tényleges potenciál) alapján meghatározza minden vezeték elvárt kategóriáját (`phase` / `neutral` / `pe`).
  - Ha egy vezeték színe eltér az elvárttól (pl. kék szál fáziskörben, fekete szál nullakörben, zöld-sárga nem-PE körben, vagy egyéb színű szál), hibaként listázza.
- **UI megjelenítés (információelrejtés tiszteletben tartásával):**
  - Külön **Színellenőrzés** gomb/ikon az eszköztáron (és összegzés Debug módban).
  - Aktiváláskor kompakt ellenőrző panel jelenik meg: összesítés (pl. `10/12 vezeték színhelyes`), hibás vezetékek listája érthető leírással, és a hibás vezetékek vizuális kiemelése a Canvas-on (piros szaggatott keret).
- **Érintett fájlok:** `src/engine/colorCheck.ts` (új), `src/models/types.ts`, `src/canvas/renderer.ts`, `src/main.ts`, `src/style.css`.
- **Tesztelési szempontok:**
  - Fekete fázisszál, kék nullaszál és zöld-sárga PE esetén 100% színhelyes eredmény — kikapcsolt kismegszakítónál is.
  - Fekete vezeték `L2` vagy `L3` ágban / kapcsolt szálon helyesnek számít (nincs plusz fázisszín-ellenőrzés).
  - Kék vezeték fáziskörben, fekete a nullán vagy nem zöld-sárga a PE-n → hiba listázva és kiemelve a Canvas-on.

---

### 6. Szöveg helyett eszközök, tekercsek, szerszámok

A szöveges eszköztár és a dekoratív munkapad lecserélése hibrid grafikus rendszerre: **interaktív munkapad a Canvas alján + szöveg nélküli grafikus SVG eszköztár felül**.

- **Felső grafikus eszköztár (`src/ui/toolIcons.ts`, `src/main.ts`, `src/style.css`):**
  - Szöveges gombok helyett részletes, azonnal felismerhető SVG ikonok (`title` hover tooltippel):
    - **Szerszámok:** Kéz/szerelőkesztyű, VDE csavarhúzó (sárga-piros), VDE oldalcsípőfogó.
    - **Mérőműszerek:** UNI-T feszültség-/folytonosságvizsgáló, Lakatfogó.
    - **Vezetéktekercsek:** kábeldob/tekercs ikonok kilógó érrel (Fekete, Kék, Zöld-sárga — és igény szerint Barna, Szürke, Piros) — rákattintva automatikusan vezetékezés módba és az adott színre vált.
    - **Segédfunkciók ikonokkal:** Nagyítás/kicsinyítés/teljes nézet, Sorkapocs tábla, Színellenőrzés, Hibakereső mód, Pálya törlése.
- **Interaktív munkapad a Canvas alján (`y = 1070..1300`, `src/canvas/renderer.ts`, `src/canvas/input.ts`):**
  - Kattintható **vezetéktekercsek** állványon (az aktív tekercs kiemelve),
  - **2 db WAGO doboz** (`3-as` és `5-ös`, innen húzható ki új WAGO és ide dobható vissza),
  - **Szerszámok** (csavarhúzó, csípőfogó, kéz/kesztyű) és **mérőműszerek** (UNI-T, lakatfogó) — a kézben lévő szerszám helye halvány sziluettel látszik az asztalon.
  - A felső SVG eszköztár és az alsó munkapad 100%-ban szinkronban működik.
- **Egyedi szerszám-kurzorok:** aktív módnak megfelelő SVG kurzor (csavarhúzó, csípőfogó, lakatfogó, mérőtüske, vezetékvég).
- **Érintett fájlok:** `src/ui/toolIcons.ts` (új), `src/main.ts`, `src/style.css`, `src/canvas/renderer.ts`, `src/canvas/input.ts`.
- **Tesztelési szempontok:**
  - A felső eszköztáron nincsenek hosszú szöveges gombok, minden szerszám/tekercs/műszer grafikus ikonnal választható.
  - Az alsó munkapadon bármely szerszámra, tekercsre vagy műszerre kattintva átvált az aktív eszköz és a felső sáv kijelölése is frissül.
  - Rázoomolt nézetben a felső sávból 1 kattintással váltható minden eszköz és tekercs.

---

## II. Hibák, javítandók

### 7. Kismegszakító (és minden eszköz) lekapcsolva kezdjen

- **Jelenlegi hiba:** A `src/data/prototypeTrack.ts` fájlban `mcb_3p`, `mcb_1p_b10`, `mcb_1p_b16` és `dev_motor_protector` `on: true` kezdőértékkel indul.
- **Javítás:**
  - Minden kismegszakító (`mcb_3p`, `mcb_1p_b10`, `mcb_1p_b16`), a `dev_motor_protector` és a két új ÁVK (`rcd_3p`, `rcd_1p`) is `on: false` kezdőállapottal jön létre (és `Pálya törlése` után is így áll vissza).
- **Érintett fájl:** `src/data/prototypeTrack.ts`.
- **Tesztelési szempontok:**
  - Oldalbetöltés és reset után minden megszakító, ÁVK és motorvédő `KI` állásban van; egyetlen sorkapocson sincs fázisfeszültség (csak a `PE` passzív védővezető aktív).

---

### 8. Fura sorkapocs csavar viselkedés

A kódban feltárt hibák javítása úgy, hogy a felhasználót ne terhelje előzetes csavarkicsavarás:

1. **Átfedő hitbox javítása (`src/canvas/input.ts`):**
   - A `col.x - 3 .. col.x + col.w + 3` (`26 px` a `22 px`-es osztáson!) átfedés és a `nearestPort(..., 18)` fallback eltávolítása.
   - A `hitScrewdriverTarget` pontosan a legközelebbi csavarfej-középpontot (`cx`, `col.y + 92`) találja el az osztás felén belül (`|dx| <= 10.5`, `|dy| <= 14`).
2. **Kezdőállapot (`tight: false`) és ergonomikus bekötés (`src/data/prototypeTrack.ts`, `src/models/world.ts`):**
   - Az üres sorkapcsok alapból **kilazított (`tight: false`)** állapotból indulnak, így a vezeték azonnal beköthető kézi kicsavarás nélkül, majd csavarhúzóval meghúzható.
   - Ha valaki egy üres csavart mégis előre beteker, vezeték bedugásakor se blokkolja (a bekötött vég `tight: false` lesz, meghúzásra várva).
3. **Egységes és jól látható csavarrajz (`src/canvas/renderer.ts`):**
   - A felső gyári meghúzott csavar és az alsó meghúzott (`tight: true`) csavar horonyiránya megegyezik; laza (`tight: false`) állapotban 90°-kal elfordítva, kissé világosabb/kiemelt csavarfejjel és nyitott réz kengyellel jelenik meg.
   - Csavarhúzó hover esetén célzottan a csavarfej kap kiemelő gyűrűt.
4. **Holtzóna megszüntetése és visszajelzés (`src/canvas/input.ts`, `src/main.ts`):**
   - Vezetékezés módban az alsó csavar környékén kattintva ne indítson véletlen vászonhúzást (pan).
   - Csavarhúzóval WAGO-ra kattintva rövid toast üzenet jelzi, hogy a WAGO karhoz a Kéz eszköz szükséges.
- **Érintett fájlok:** `src/canvas/input.ts`, `src/canvas/renderer.ts`, `src/data/prototypeTrack.ts`, `src/models/world.ts`, `src/main.ts`.
- **Tesztelési szempontok:**
  - Egymás melletti sorkapcsok csavarjainak bal/jobb szélére kattintva mindig pontosan a kattintott csavar fordul el, soha nem a bal szomszéd.
  - Üres kapcsok alapból laza állapotban látszanak; vezeték bekötése közvetlenül működik előzetes kicsavarás nélkül, majd csavarhúzóval egyértelműen meghúzható.
  - A felső és alsó meghúzott csavarok megjelenése egységes.

---

### 9. Wago fejlesztések (3-as és 5-ös Wago, dobozból húzás, visszadobás, forgathatóság)

- **3-as és 5-ös Wago támogatás (`WagoBlock.slots: 3 | 5`, `fixed?: boolean`):**
  - `WAGO 221-413` (3-as, `90 px` széles) és `WAGO 221-415` (5-ös, `138 px` széles) kivitel tiszta felirattal és forgató gombbal (`↻`).
- **Wago forgathatóság (90°-os lépések: 0°, 90°, 180°, 270°):**
  - `rotation?: 0 | 90 | 180 | 270` a `WagoBlock` modellben.
  - `rotateWago(world, wagoId)`: 90 fokos lépésekben forgatja a blokkot a középpontja körül.
  - A forgatás során a portok pozíciója (`getWagoPortPos`) pontosan kiszámolásra kerül.
  - **Védelem:** Bekötött (`hasWagoWires`) vagy rögzített (`wago.fixed`) WAGO egyáltalán nem forgatható (mint ahogy mozgatni és törölni sem lehet), próbálkozáskor toast figyelmeztetés jelenik meg.
  - `toWagoLocalPoint`: inverz forgatásos koordináta-transzformáció a pontos hit-testinghez (`hitWago`, `hitWagoLever`, `hitWagoRotateButton`).
  - **Irányítás:**
    - `R` billentyű lenyomása a Wago húzása (drag) vagy felette lebegés (hover) közben.
    - Kattintás a Wago jobb felső sarkában lévő `↻` forgató gombra (csak üres, még be nem kötött WAGO-n jelenik meg).
    - Jobb egérgombbal kattintás a Wagora.
- **Új Wago dobozból (`spawnWago`):**
  - A fal induláskor nem 5 előre lerakott szabad Wago-val van tele (a szabad tér üresen indul, kivéve a motor fix 6+1 Wago-ját).
  - A munkapadon két vizuális **WAGO doboz** van: **3-as WAGO doboz** és **5-ös WAGO doboz**.
  - A dobozból drag-and-drop (vagy kattintás) segítségével bármikor kihúzható egy új 3-as vagy 5-ös Wago (nyitott karokkal, kész a bekötésre), és bárhová letehető a falra.
- **Visszadobható Wago (`removeWago`):**
  - Üres, nem fix (`!wago.fixed && !hasWagoWires`) Wago húzásakor a WAGO doboz zónája vizuálisan kiemelődik (visszadobási zóna).
  - A doboz felett elengedve a Wago, annak portjai és csomópontja tisztán törlődik a `world`-ből.
  - Bekötött Wago nem mozgatható / nem dobható vissza, amíg van benne vezeték (helyben forgatása viszont megengedett).
- **Érintett fájlok:** `src/models/types.ts`, `src/models/world.ts`, `src/data/prototypeTrack.ts`, `src/canvas/renderer.ts`, `src/canvas/input.ts`, `src/main.ts`.
- **Tesztelési szempontok:**
  - A 3-as dobozból 3 portos, az 5-ös dobozból 5 portos Wago húzható ki a falra, korlátlan darabszámban.
  - Üres Wago a dobozra visszahúzva eltűnik; bekötött Wago nem mozgatható és hibaüzenetet ad.
  - A 3-as és 5-ös Wago-k elektromosan ugyanúgy közös csomópontként működnek zárt karoknál.
  - Forgatáskor 90°-onként forog a blokk, a kapcsok és a bekötött vezetékek a helyükön maradnak, a hit-test pontosan működik.

---

## III. Automatizált tesztelési stratégia (Vitest)

A szimulációs, modell-, adat- és hit-test réteg (`src/models/`, `src/engine/`, `src/data/`, `src/canvas/input.ts`) teljesen DOM- és Canvas-független TypeScript, ezért **Vitest** alapú unit és szimulációs integrációs tesztekkel gyorsan és stabilan lefedhető.

- **Parancsok:**
  - `npm test` — teljes Vitest tesztcsomag egyszeri futtatása (`vitest run`).
  - `npm run test:watch` — fejlesztés közbeni figyelő mód.
  - **Szálankénti elfogadási feltétel:** minden szál csak akkor kész, ha az új funkció saját tesztfájlja/tesztesetei megvannak, és `npm run build && npm test` hiba nélkül zöld.
- **Tesztek elhelyezése:** `src/__tests__/` alatt (így a `tsconfig.json` `tsc --noEmit` lépése a teszteket is típusellenőrzi):
  - `testHelpers.ts` — újrahasznosítható bekötő, csavarhúzó, kapcsoló- és szimulációs segédfüggvények.
  - `simulation.test.ts` — alap regressziós tesztek (izzók, 101/102/105/106/107 kapcsolók, nyomógombok, MK öntartás, impulzusrelé, lépcsőházi automata, időrelé, PIR, zárlatvédelem, laza kötések).
  - `world.test.ts` — port-foglaltság, vezeték létrehozás/törlés, Wago mozgatás, időzítő léptetés (`tickWorld`), sorkapocs-konzisztencia.
  - `input.test.ts` — hit-test és geometria (port tapadás, felső oldal tiltása, csavarhúzó célpont, Wago kar, vezeték-találat, plakát).
  - **Későbbi szálak új tesztfájljai:**
    - 1. szál: `prototypeTrack.test.ts` (minden `KI`-ben indul) + `input.test.ts` bővítése (szomszédos csavarok nem fednek át)
    - 2. szál: `wago.test.ts` (3-as/5-ös spawn, visszadobás, bekötött és `fixed` védelem)
    - 3. szál: `rcd.test.ts` (4P/2P ÁVK `T` gomb, upstream tiltás, `L–PE`, `N–PE`, kereszt-nulla)
    - 4. szál: `motor.test.ts` (Y/Δ üzem, `CW`/`CCW`, 2-fázisú hiba, Y→Δ átkapcsolás)
    - 5. szál: `colorCheck.test.ts` (fekete/kék/zöld-sárga kikapcsolt és bekapcsolt állapotban)
    - 6. szál: `measurements.test.ts` (UNI-T 230V/400V/0V, folytonosság kikapcsolt MCB-nél)
    - 7. szál: `currentSolver.test.ts` (párhuzamos áramok, 3F nulla = 0 A, motor Y/Δ áramok)

---

## IV. Javasolt megvalósítási sorrend (külön szálakra bontva)

```mermaid
flowchart LR
    T0["0. szál: Vitest<br/>+ Regressziós tesztek"] --> T1["1. szál: Alap hibák<br/>(Minden KI + Csavar fix)"]
    T1 --> T2["2. szál: Wago rendszer<br/>(3-as/5-ös + Doboz + Visszadobás)"]
    T2 --> T3["3. szál: ÁVK-k<br/>(4P + 2P + T-gomb + védelem)"]
    T3 --> T4["4. szál: 3F Villanymotor<br/>(Motor + 6+1 fix 3-as WAGO)"]
    T4 --> T5["5. szál: Színellenőrzés<br/>(Fekete / Kék / Zöld-sárga)"]
    T5 --> T6["6. szál: UNI-T műszer<br/>(Feszmérés + Folytonosság)"]
    T6 --> T7["7. szál: Lakatfogó<br/>(Fázor áram + Lakatfogó UI)"]
    T7 --> T8["8. szál: Grafikus UI<br/>(Eszközök, tekercsek, szerszámok)"]
```

- [x] **0. szál (Teszt-alapok) — KÉSZ:** Vitest (`^3.2.7`) telepítve és konfigurálva (`package.json`: `npm test`, `npm run test:watch`), regressziós tesztek elkészítve és zöldre futtatva (`29/29` teszt + `npm run build` sikeres):
  - `src/__tests__/testHelpers.ts` — bekötő és tápbekapcsoló segédfüggvények (`createTestWorld`, `enableSupply`, `connectNodes`, `connectPorts`).
  - `src/__tests__/world.test.ts` (7 teszt) — sorkapocs/legend konzisztencia (`65 + 54 = 119`), `cloneWorld`, vezeték foglaltság/eltávolíthatóság, Wago mozgatás, kapcsolók/relék/gombok, `tripMcb`, `tickWorld`.
  - `src/__tests__/simulation.test.ts` (17 teszt) — laza/meghúzott kötések, dugalj, Wago párhuzamos elosztás, `101`/`102`/`105`/`106+107+106`/`101N` kapcsolók, `MK1` öntartás Start/Stop nyomógombokkal, motorvédő, impulzusrelé, lépcsőházi automata, időrelé, mozgásérzékelő, `L1–N` / `L1–PE` / `L1–L2` zárlatvédelem.
  - `src/__tests__/input.test.ts` (5 teszt) — `dist`, `sampleDraft`, `nearestPort`, felső/alsó sorkapocs elválasztás, Wago test/karok, eszköz/vezeték/plakát hit-test és kurzorok.
- [x] **1. szál (Hibajavítások) — KÉSZ:** Minden induló állapot és sorkapocs csavar viselkedés javítva, Vitest tesztek zöldek (`34/34` teszt + `npm run build` sikeres):
  - **Minden eszköz `KI` (`on: false`) állapotban indul:** `mcb_3p`, `mcb_1p_b10`, `mcb_1p_b16`, `dev_motor_protector` alapból lekapcsolva jön létre és resetkor is így áll vissza; induláskor nulla fázisfeszültség van a kapcsokon (csak passzív `PE` és `N` él).
  - **Üres sorkapcsok kilazítva indulnak (`tight: false`):** a tanuló azonnal bekötheti a vezetéket kézi előzetes kicsavarás nélkül, majd csavarhúzóval meghúzhatja.
  - **Átfedésmentes csavarhitbox (`src/canvas/input.ts`):** `hitScrewdriverTarget` pontosan a legközelebbi csavarfej-középpontot (`cx`, `col.y + 92`) találja el az osztás felén belül (`|dx| <= 10.5`, `|dy| <= 14`), szomszédos csavarok bal/jobb szélén sincs átfedés, fallback eltávolítva.
  - **Egységes csavarrajz és vizuális állapotok (`src/canvas/renderer.ts`):** a felső és alsó meghúzott (`tight: true`) csavarok horonyiránya egységesen vízszintes (0°); laza (`tight: false`) állapotban 90°-kal elfordítva (függőleges) világosabb fejjel és nyitott réz kengyellel jelenik meg. Csavarhúzó eszköznél a célzott csavarfej köré kiemelő szaggatott gyűrű rajzolódik.
  - **Holtzóna és visszajelzés javítások (`src/canvas/input.ts`, `src/main.ts`):** új `hitColumnLowerHalf` megakadályozza a véletlen pan (vászonhúzás) indítását sorkapocs alsó részére kattintáskor; csavarhúzóval WAGO-ra kattintva toast figyelmeztet a Kéz eszköz használatára.
  - **Elírás javítása:** `src/canvas/legendTable.ts` és `src/data/prototypeTrack.ts` `56 db → 54 db` sorkapocs javítva.
  - **Tesztek:** `src/__tests__/prototypeTrack.test.ts` (4 teszt: OFF állapotok, laza csavarok, 0V feszültség, kapcsolható kimenetek) létrehozva, `src/__tests__/input.test.ts` bővítve szomszédos csavarhatárok és alsó oszlop hit-testekkel.
- [x] **2. szál (Wago) — KÉSZ (3-as és 5-ös WAGO, dobozok, forgathatóság):** 3-as és 5-ös WAGO támogatás, WAGO dobozok a munkapadon, dobozból kihúzás és visszadobás, valamint 90°-os lépésekben történő tetszőleges forgatás kész, Vitest tesztek zöldek (`48/48` teszt + `npm run build` sikeres):
  - **3-as és 5-ös WAGO típusok (`WagoBlock.slots: 3 | 5`, `fixed?: boolean`):** `WAGO 221-413` (3-as, 90 px) és `WAGO 221-415` (5-ös, 138 px) típusok pontos tipográfiával és forgató gombbal (`↻`).
  - **2 db WAGO doboz a munkapadon (`src/data/wagoBoxes.ts`, `src/canvas/renderer.ts`):** 3-as (`x = 940..1075`) és 5-ös (`x = 1105..1260`) vizuális alkatrészdoboz belső miniatűr előnézettel a munkapad asztallapján.
  - **Új WAGO dobozból (`spawnWago`):** A dobozra kattintva vagy abból drag-and-drop húzással korlátlan számú új 3-as vagy 5-ös Wago hozható létre (alapból nyitott karokkal, bekötésre készen). A táblafelület tiszta indulóállapottal indul (`wagos: []`).
  - **Visszadobható WAGO (`removeWago`):** Üres, nem rögzített (`!wago.fixed && !hasWagoWires`) Wago húzásakor mindkét doboz kiemelkedő zöld szaggatott keretes visszadobási zónává (drop target) alakul át (`⬇ VISSZADOBÁS` / `♻`). A doboz felett elengedve a WAGO, a portjai és csomópontja tisztán törlődik a modellből.
  - **WAGO forgathatóság (`rotateWago`):** 90°-os diszkrét lépésekben (0°, 90°, 180°, 270°) forgatható az üres blokk a középpontja körül. Vezérlés: `R` billentyűvel (mozgatás közben vagy hovernél), a blokk jobb felső `↻` gombjára kattintva, vagy jobb klikkel.
  - **Védelem:** Bekötött WAGO (`hasWagoWires`) és rögzített WAGO (`wago.fixed`) sem nem mozgatható, sem nem forgatható, sem nem dobható vissza (figyelmeztető toast).
  - **Tesztek:** [`src/__tests__/wago.test.ts`](file:///c:/Users/SIH6SS/Calcidurr/src/__tests__/wago.test.ts) (14 teszt: 3-as/5-ös spawn, tiszta kezdőfal, mozgathatóság, szimuláció, törlés, bekötött/rögzített mozgatási ÉS forgatási védelmek, doboz hit-test, 90°-os ciklikus forgatás, kapcsok pozíció-újratervezése, forgatott hit-testing és kar-érzékelés) mind zöld.
- [x] **3. szál (ÁVK-k) — KÉSZ (4P és 2P ÁVK, T tesztgomb, upstream és hibaáram-védelem):** A `sources/pelda_kotes.jpg` fotó szerinti 2 db ÁVK (`rcd_3p` 40A/30mA és `rcd_1p` 25A/30mA) beépítve a kiselosztóba, a kiselosztó szélesítve (`x = 40..576`), a Motorvédő kikerült a kiselosztó mellé (`x = 590`). Működő `T` tesztgomb, upstream tápfüggőség, valamint teljes hibaáram- és zárlatvédelem implementálva és automatizált tesztekkel lefedve (`61/61` teszt + `npm run build` sikeres):
  - **Kiselosztó és DIN sín elrendezés (`src/data/prototypeTrack.ts`, `src/canvas/renderer.ts`):** `4P ÁVK` (x = 60..132) → `3P C16A` (x = 138..200) → `2P ÁVK` (x = 206..252) → `1P B10A` (x = 258..288) → `1P B16A` (x = 294..324) → `Impulzusrelé` → `Lépcsőházi aut.` → `Időrelé`. A kiselosztó külső doboza (`x = 40..576`), a `Motorvédő` közvetlenül mellette (`x = 590`), a sorkapocssor és a magyarázó tábla változatlan.
  - **Működő `T` tesztgomb és főkar (`src/canvas/input.ts`, `src/canvas/renderer.ts`, `src/main.ts`):** Kéz eszközzel külön kattintható a főkar (`BE / KI`) és a dedikált kék `T` tesztgomb (`hitRcdTestButton`). `BE` állapotban a `T` azonnal leoldja az ÁVK-t `KI` állásba tájékoztató toast üzenettel; `KI` állapotban nem történik leoldás. Vizuális optikai állapotjelző ablak (Zöld: nyitott/KI, Piros: zárt/BE).
  - **Upstream tápfüggőség (`src/engine/simulation.ts`):** Ha egy ÁVK `KI` állapotban van, az általa védett kismegszakító kimenetek és a hozzá tartozó nulla sorkapocs feszültségmentesek (`"none"`), akkor is, ha a kismegszakító fel van kapcsolva. `top_1n` és `top_3n` csak a megfelelő ÁVK felkapcsolásakor ad `N` potenciált.
  - **Hibaáram- és zárlatvédelmi logika (`src/engine/simulation.ts`, `src/models/world.ts`):**
    - `L ↔ PE` (fázis–védővezető testzárlat): az érintett ÁVK és a kismegszakító is azonnal leold.
    - `N ↔ PE` (nulla–védővezető érintkezés bekapcsolt ÁVK mögött): az érintett ÁVK azonnal leold (a kismegszakító bekapcsolva marad).
    - `3F N ↔ 1F N` összekötés (párhuzamosított nulla ágak): mindkét ÁVK leold hibaüzenettel.
    - **Keresztbe kötött nulla fogyasztóknál:** ha egy terhelés (izzó, dugalj, mágneskapcsoló, relé) fázisa az egyik ÁVK-ról, nullája a másikról érkezik (pl. `1P L1` + `3F N`), vagy nullája `PE`-re van kötve, a hibaáram miatt mindkét/érintett ÁVK leold.
    - **Szelektív leoldás (`tripRcd`):** A gráfbejárás során forrás-ÁVK követés működik, így a hibák csak a közvetlenül érintett ÁVK-t oldják le, a másik független marad.
  - **Tesztek:** [`src/__tests__/rcd.test.ts`](file:///c:/Users/SIH6SS/Calcidurr/src/__tests__/rcd.test.ts) (13 teszt: kezdőállapotok, upstream tápfüggőség, T gomb hit-test és tesztelés, L-PE, N-PE, szelektív leoldás, 3F N - 1F N összekötés, keresztbe kötött nulla fogyasztónál, PE-re kötött fogyasztói nulla, szabályos működés és `tripRcd`) mind zöld.
- [x] **4. szál (3F Villanymotor) — KÉSZ (Motor animációval + 6+1 fix 3-as WAGO + Csillag/Delta/Fázishiba szimuláció):** Ipari 3 fázisú aszinkron villanymotor és a poszter alatti 6+1 db rögzített 3-as WAGO sora (`U1`, `V1`, `W1`, `U2`, `V2`, `W2` + `PE`) megvalósítva, kábelköteggel, fehér szigetelőszalag zászlócskákkal, forgásirány- és fázishiba-érzékeléssel, valósághű animációval és automatizált tesztekkel (`71/71` teszt + `npm run build` sikeres):
  - **Canvas elrendezés és tömörített poszter (`src/canvas/renderer.ts`, `src/canvas/input.ts`):** A magyarázó plakát magassága tömörítve (`y = 700..945`), alatta (`y = 955..1060`) tágas hely nyílt a 6+1 db fix 3-as WAGO-nak (`x = 740..1460, y = 975`). A motor lent az alsó munkapad jobb oldalán (`x = 1750..2040, y = 1030..1280`) helyezkedik el, stabil szerelőtalpakkal és érintkezési árnyékkal a fa asztallapon, felette gégecsővel a poszter alatti WAGO-kig.
  - **6+1 db rögzített 3-as WAGO és gyári kábelköteg (`src/data/prototypeTrack.ts`, `src/models/world.ts`, `src/canvas/renderer.ts`):**
    - A motortól vastag fekete gégecső fut le a poszter alatt a WAGO-khoz.
    - Mind a 7 WAGO 1. portjában gyárilag zárt (`tight: true`) bekötés van (6 db fekete tekercsvég + 1 db zöld-sárga PE ér).
    - Minden ér felett fehér szigetelőszalag jelölőfül (zászlócska) látható a kivezetés kódjával (`U1`, `V1`, `W1`, `U2`, `V2`, `W2`, `PE`).
    - A 2. és 3. port nyitott karral (`tight: false`) szabadon beköthető a tanuló által (áthidalók és betáplálás).
    - **Védelem (`src/main.ts`):** A motor WAGO-i `fixed: true` jelöléssel védettek (nem mozgathatók, nem dobhatók vissza a dobozba), az 1. gyári karjuk nem bontható (toast figyelmeztetés), a 2. és 3. kar viszont szabadon működtethető Kéz eszközzel.
  - **Elektromos szimulációs motor (`src/engine/simulation.ts`):**
    - **Csillagüzem (Y):** `U2–V2–W2` áthidalva és `U1, V1, W1`-re `L1, L2, L3` kapcsolva -> `mode: "star"`, névleges áram `1.8 A`, `speed: 1`.
    - **Deltaüzem (Δ):** mindhárom tekercs fázis–fázis (400V) táplálást kap háromszög-kötésben -> `mode: "delta"`, vonali áram `5.4 A`, `speed: 1`.
    - **Forgásirány (`cw` / `ccw`):** ciklikus `L1–L2–L3` sorrendnél jobbra (`CW ↻`), két fázis felcserélésekor balra (`CCW ↺`).
    - **Fázishiba (`phase_fault`):** 1 fázis kiesése/lekötése esetén a motor nem forog (`speed: 0`), fázishiba állapotba lép, áramfelvétele megnő (`8.5 A`), a motor rezeg és toast/sim figyelmeztetés jelenik meg.
    - **Földelés (PE) felügyelet:** Földelés nélküli motorüzem esetén biztonsági figyelmeztetés a szimulációban.
    - **Zárlatvédelem:** Csillag és Delta egyidejű hibás kapcsolásakor a kismegszakító azonnal leold.
    - **Mágneskapcsolós Csillag-Delta indítás:** `MK1` (Fő) + `MK2` (Csillag) és `MK1` + `MK3` (Delta) kontaktorokon keresztül teljes körűen működik.
  - **Vizuális megjelenítés és animáció (`src/canvas/renderer.ts`, `src/main.ts`):**
    - Bordázott öntvény motorház 8 db hűtőbordával, szerelőtalpakkal, emelőszemmel és kapocsházzal (tömszelencével és PE állapotjelző LED-del).
    - Csapágypajzs, ventilátor rács és forgó lapátkerék: valósághű gyorsulással és lassulási tehetetlenséggel forog, zöld `CW ↻` vagy cián `CCW ↺` forgásirány-nyíllal.
    - Fázishiba esetén a motor mechanikusan vibrál/rezeg a képernyőn.
    - Digitális LED állapotkijelző panel a motor tetején (`ÁLL (0.0 A)`, `Y ↻ CSILLAG 1.8 A`, `Δ ↻ DELTA 5.4 A`, `⚡ FÁZISHIBA! 8.5 A`).
  - **Tesztek:** [`src/__tests__/motor.test.ts`](file:///c:/Users/SIH6SS/Calcidurr/src/__tests__/motor.test.ts) (10 teszt: inicializálás, védelem, direkt Csillag üzem, forgásirány-váltás, hiányzó PE figyelmeztetés, fázishiba, direkt Delta üzem, nyitott tekercsek, mágneskapcsolós Csillag-Delta átkapcsolás és Y+Δ egyidejű zárlatvédelem) mind zöld.
- [x] **5. szál (Kábelszín validáció) — KÉSZ (Szabályrendszer + Statikus/dinamikus gráf + Lebegő panel + Canvas kiemelés):** A 3 szabványos alapszabályra épülő kábelszín-ellenőrző rendszer megvalósítva, összefüggő komponens gráfbejárással, lebegő modern információs panellel, eszköztár gombbal és élénk piros szaggatott Canvas kiemeléssel a hibás vezetékek körül. Vitest automatizált tesztek és build zöldek (`85/85` teszt + `npm run build` sikeres):
  - **Szabályrendszer (`src/engine/colorCheck.ts`):**
    - **Fázisvezető / vezérlőág:** kizárólag **Fekete (`L1`)**! Nincs különbségtétel fáziságak (`L1/L2/L3`) között — minden fázisforrás, kapcsoló, nyomógomb, mágneskapcsoló és motor tekercs Fekete vezetékkel szabályos. Kék vagy zöld-sárga (valamint barna, szürke, piros) használata tiltott és hibaként van jelölve.
    - **Nullavezető (`N`):** kizárólag **Kék (`N`)**! Táp nullák (`top_3n`, `top_1n`), fogyasztók nulla pontjai, tekercs `A2` és relé `N` kivezetései. Fekete vagy zöld-sárga vezeték használata tilos.
    - **Védővezető (`PE`):** kizárólag **Zöld-sárga (`PE`)**! Táp védővezető, dugalj/izzó/motor `PE` pontjai. Más szín használata szigorúan tiltott.
  - **Statikus + dinamikus felismerő motor (`src/engine/colorCheck.ts`):**
    - **Kikapcsolt kismegszakítóknál is működik:** az előszerelt 119 sorkapocspont és a 7 motorkivezetés funkcionális szerepkörei alapján a huzalozás már a tápfeszültség bekapcsolása előtt azonnal validálható.
    - **Hálózat- és WAGO-terjesztés:** a bekötött gráf összefüggő komponenseinek (BFS) bejárásával a WAGO blokkok automatikusan átveszik a hozzájuk csatlakoztatott áramkör szerepkörét (Nulla-elosztásnál a WAGO és minden leágazása Kék, Fázis-elosztásnál Fekete, PE-nél Zöld-sárga).
    - **Közvetlen zárlati / keresztkötés felismerése:** Fázis és Nulla, Fázis és PE, vagy Nulla és PE közé közvetlenül bekötött vezetékek azonnal kiemelt hibaként jelennek meg részletes magyarázattal.
  - **Felhasználói felület és interakció (`src/canvas/colorCheckPanel.ts`, `src/main.ts`, `src/style.css`):**
    - **Eszköztár gomb:** `🎨 Színellenőrzés` gomb a felső sávban, aktív állapotjelzővel.
    - **Lebegő ellenőrző panel (`ColorCheckPanel`):** modern, sötét tónusú kártya a jobb felső sarokban összesítéssel (`X/Y vezeték színhelyes`), állapotjelző szalaggal (Zöld: 100% siker, Piros: hibák listája), és az alkalmazott érszabályok összefoglalójával.
    - **Részletes hibakártyák:** minden hibás vezetékhez megjelenik a kezdő- és végpont pontos felirata (pl. `1P B10A [L1] ➔ Egypólusú kapcsoló 101 [1]`), az aktuális vs. elvárt szín színmintákkal (swatch), valamint a szabványossági indoklás.
    - **Élő Canvas kiemelés (`src/canvas/renderer.ts`):** a hibás vezetékek körül élénk, pulzáló piros szaggatott aura rajzolódik ki, a vezeték felezőpontján pedig piros `✕` hibajelvény látható. A hibalistán az egérrel lebegve a fókuszált vezeték azonnal kiemelődik.
    - **Debug overlay integráció:** bekapcsolt Hibakereső módban a színstátusz a debug infósávban is élőben megjelenik.
  - **Tesztek:** [`src/__tests__/colorCheck.test.ts`](file:///c:/Users/SIH6SS/Calcidurr/src/__tests__/colorCheck.test.ts) (14 teszt: üres pálya, kikapcsolt MCB melletti 100% siker, Fekete L2/L3 és kapcsolt ágak elfogadása, Kék fázisban, Fekete nullán, nem zöld-sárga PE-n, tiltott zöld-sárga fázisban/nullán, Barna/Szürke/Piros fáziságban, WAGO Nulla-terjesztés, WAGO hibás Nulla- és Fázis-elágazások, motor Csillag/Delta és PE validáció, közvetlen fázis-nulla zárlati keresztkötés, valamint bekapcsolt dinamikus szimulációs működés) mind zöld.
- [x] **6. szál (UNI-T vizsgáló) — KÉSZ (Kétpólusú feszültség- és folytonosságvizsgáló + Web Audio sípolás + Lebegő UT18D műszerpanel):** Az UNI-T UT18C/UT18D mintájára készült kétpólusú feszültség-, fázissorrend- és folytonosságvizsgáló teljes körűen megvalósítva, élő Canvas mérőtüskékkel, mérőzsinórokkal, mozgatható lebegő műszerpanellel, Web Audio API piezo hangjelzéssel és automatizált tesztekkel (`96/96` teszt + `npm run build` sikeres):
  - **Mérési motor (`src/engine/measurements.ts`, `src/engine/simulation.ts`):**
    - **Feszültségmérés és fázissorrend:** Fázis (`L1/L2/L3`) ↔ `N` vagy `PE` között **`230 V AC`** (`12V..230V` LED-ek), két különböző fázis (`L1–L2`, `L2–L3`, `L3–L1`) között **`400 V AC`** (`12V..400V` LED-ek) + forgásirány (`R ↻` / `L ↺`), azonos potenciál vagy lebegő pontok között **`0 V`**.
    - **Egypólusú fázisjelzés (`⚡` LED):** már egyetlen lerakott mérőtüskénél (és kétpólusú mérésnél is) azonnal jelez, ha bármelyik tüske élő fázist (`L1/L2/L3`) érint.
    - **Folytonosságvizsgálat (`0.0 Ω` / `OL`):** kizárólag feszültségmentes pontok között aktív (feszültség vagy élő fázis jelenlétekor automatikusan feszültségmérésre vált és nem csipog). Kikapcsolt kismegszakítóknál is működő BFS gráfbejárás meghúzott vezetékeken és zárt készülékérintkezőkön (`101`, `102`, `105`, `106`, `107`, `NO/NC` nyomógombok, `MK1–MK3` fő/segédérintkezők, relék, WAGO-k) keresztül.
  - **Két mérőtüskés interakció és hit-test (`src/canvas/input.ts`, `src/main.ts`, `src/models/types.ts`):**
    - Új `ToolMode = "tester"` (`⚡ UNI-T vizsgáló` gomb a felső eszköztáron + közvetlenül kattintható UNI-T műszer a munkapadon).
    - **1. kattintás:** lerakja a fekete (`COM / −`) mérőtüskét bármely mérhető pontra (sorkapocs felső gyári csavarja, alsó csavarja, alsó nyílása, szabad 3/5-ös WAGO nyílások, a motor 6+1 db fix WAGO-jának összes portja, valamint a dugalj `L`, `N` és `PE` érintkezői).
    - **Élő mérés + 2. kattintás:** az egér mozgatásával a piros (`+`) mérőtüske élőben mér, 2. kattintásra pedig rögzül — így Kéz vagy Csavarhúzó eszközre váltva kapcsolgatás/csavarozás közben is élőben frissül a műszer kijelzője és hangjelzése.
    - **Tüskék elemelése:** jobb klikk, `Esc` billentyű, üres helyre kattintás (a vászonhúzás/pan megtartása mellett) vagy a műszerpanel `⏏ Levétel` gombja.
    - **Információelrejtés védelme:** gyakorló módban a sorkapcsoknál csak a fizikai pozíció (`X1/..`, `X2/..`) jelenik meg, a rejtett kapocsfunkció nem szivárog ki.
  - **Canvas megjelenítés (`src/canvas/renderer.ts`) és lebegő UNI-T UT18D panel (`src/ui/instrumentPanel.ts`, `src/style.css`):**
    - V-alakban döntött VDE szigetelt fekete és piros mérőtüskék hajlékony szilikon mérőzsinórokkal, a munkapadon elhelyezett élő LCD-s UNI-T UT18D műszerrel, valamint dugalj mérőpont-segédgyűrűkkel.
    - Fejlécénél fogva szabadon mozgatható (draggable) lebegő műszerpanel `12V / 24V / 50V / 120V / 230V / 400V` LED sávval, `⚡ FÁZIS`, `~ AC`, `🔊 Rx`, `L / R` LED-ekkel, kéttónusú háttérvilágításos LCD-vel, némítható **Web Audio API** piezo sípolóval (`~2650 Hz`) és tüske-levétel gombbal.
  - **Tesztek:** [`src/__tests__/measurements.test.ts`](file:///c:/Users/SIH6SS/Calcidurr/src/__tests__/measurements.test.ts) (10 átfogó tesztcsoport: készenlét, egypólusú fázis, `230 V` / `400 V` + `R/L` fázissorrend, feszültség alatti csipogástiltás, kikapcsolt MCB melletti folytonosság laza/meghúzott csavarokon, kapcsolókon, NO/NC gombokon, reléken és WAGO-kon, fogyasztói szakadás, valamint rögzített tüskés élő kapcsolgatás) és a kibővített [`src/__tests__/input.test.ts`](file:///c:/Users/SIH6SS/Calcidurr/src/__tests__/input.test.ts) mind zöld.
- [x] **7. szál (Lakatfogó) — KÉSZ (Komplex fázor áramhálózat-megoldó + 3D lakatfogó pofa + Lebegő UT202A+ LCD műszerpanel):** Valós, Kirchhoff-törvényeken alapuló komplex fázor áramhálózat-megoldó és interaktív UNI-T UT202A+ digitális lakatfogó teljes körűen megvalósítva, térbeli vezetékre záródó pofával, rögzíthető élő méréssel, `DATA HOLD` funkcióval és automatizált tesztekkel (`108/108` teszt + `npm run build` sikeres):
  - **Komplex fázor csomóponti árammegoldó (`src/engine/currentSolver.ts`, `src/engine/simulation.ts`, `src/models/types.ts`):**
    - `SimState` kibővítve a `wireCurrents: Record<string, number>` mezővel, amely minden szimulációs lépésben kiszámítja az összes vezeték valós effektív váltakozó áramát (`0.01 A` felbontással).
    - **Komplex csomóponti admittanciamátrix (`Y · V = I`) + Gauss-elimináció részleges főelemkiválasztással:** `230 V` effektív szimmetrikus 3-fázisú fázorokkal (`L1: 0°`, `L2: -120°`, `L3: +120°`, `N/PE: 0 V`), meghúzott vezetékeken és zárt készülékérintkezőkön (`101`, `102`, `105`, `106`, `107`, `NO/NC` gombok, `MK1–MK3`, motorvédő, relék, WAGO-k) keresztül.
    - **Fogyasztók névleges áramai és Kirchhoff-összegzés:** 100 W izzó `0.43 A` (2 párhuzamos izzó közös főágán `0.86 A`, 3 izzón `1.29 A`, egyedi leágazásokon `0.43 A`), mágneskapcsoló tekercs `0.05 A`, impulzus-/idő-/lépcsőházi relé és PIR `0.02 A` (kapcsolt terheléssel együtt a betápon összegződve, pl. `0.45 A`).
    - **3-fázisú csillagponti és nullavezető fázor-kioltás:** szimmetrikus 3-fázisú terhelés (`L1`, `L2`, `L3` izzók közös WAGO-n) közös nullavezetőjén pontosan `0.00 A`, 2 aktív fázisnál vektoriálisan `0.43 A`. Nyitott körben, laza csavarnál/WAGO karnál és `PE` védővezetőn `0.00 A`.
    - **3F aszinkron villanymotor áramok:** álló helyzetben `0.00 A`, Csillag (`Y`) üzemben `1.80 A` (vonali és csillag-áthidaló szálakon egyaránt), Delta (`Δ`) üzemben a vonali betápszálakon `5.40 A`, a delta tekercságakon / `MK3` ágakon pedig `3.12 A` (`1.80 · √3`), 2-fázisú fázishiba (`phase_fault`) esetén az élő fázisokon `8.50 A`.
  - **Lakatfogó interakció és hit-test (`src/canvas/input.ts`, `src/main.ts`):**
    - Új `ToolMode = "clamp"` (`🧲 Lakatfogó` gomb a felső eszköztáron + közvetlenül kattintható lakatfogó az alsó munkapadon az UNI-T UT18D mellett).
    - **Vezetékre vetített tapadás (`hitClampTarget`, `syncClampTarget`):** vezetékszakasz fölé húzva kiszámítja a pontos vetületi pontot és a vezeték érintőszögét; gyakorló módban az információelrejtést tisztelő fizikai megnevezést ad (`Fekete vezeték (X1/.. ↔ X2/..)`).
    - **Rögzíthető mérés:** kattintással a lakatfogó pofája rögzül a vezetéken (`📌`), így **Kéz** vagy **Csavarhúzó** eszközre váltva kapcsolgatás, nyomógomb-nyomás vagy Csillag–Delta átkapcsolás közben élőben figyelhető az Amper-változás. Jobb klikk, `Esc`, üres helyre kattintás vagy a `⏏ Lecsatolás` gomb lecsatolja.
  - **3D Canvas megjelenítés (`src/canvas/renderer.ts`) és lebegő UT202A+ LCD panel (`src/ui/instrumentPanel.ts`, `src/style.css`):**
    - Szabad levegőben nyitott pofával követi a kurzort, vezeték fölé érve pedig térben rázár a vezetékre (alsó pofaív a vezeték alatt, felső pofaív és kézi műszerfej a vezeték felett, mindig vízszintes élő Amper címkével).
    - Szabadon mozgatható (draggable), az UNI-T UT18D műszerrel egyidejűleg is nyitva tartható lebegő **UNI-T UT202A+** panel (`~ AC A`, `HOLD`, `MAX!` LED-ek, háttérvilágításos LCD, 20 szegmenses `0..10 A` analóg bargraph, `⏸ HOLD` gomb / `H` gyorsbillentyű és `⏏ Lecsatolás` gomb).
  - **Tesztek:** [`src/__tests__/currentSolver.test.ts`](file:///c:/Users/SIH6SS/Calcidurr/src/__tests__/currentSolver.test.ts) (11 átfogó teszt: nyitott kör / laza csavar / PE / üres dugalj = `0 A`, párhuzamos izzók `0.86 A` / `0.43 A`, 105-ös csillárkapcsoló lépcsőzetes áramösszegzés, mágneskapcsoló + relé + PIR kombinált áramok, szimmetrikus 3F közös nulla = `0.00 A` és aszimmetrikus 2F nulla = `0.43 A`, motor Csillag `1.80 A`, direkt Delta `5.40 A` vonali / `3.12 A` tekercság, mágneskapcsolós Y/Δ átkapcsolás, Csillag és Delta fázishiba `8.50 A`, valamint `measureClampCurrent` és `DATA HOLD`) és a kibővített [`src/__tests__/input.test.ts`](file:///c:/Users/SIH6SS/Calcidurr/src/__tests__/input.test.ts) mind zöld.
- [ ] **8. szál (Grafikus eszközök, tekercsek, szerszámok):** 6. pont (szöveg nélküli SVG eszköztár + teljes interaktív munkapad + egyedi kurzorok).
