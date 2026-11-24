# Calcidurr – Villanyszerelő Oktatófal Szimulátor

Böngészőben futó, interaktív villanyszerelési gyakorló- és szimulációs program, amely egy sorkapocssoros iskolai oktatófal fizikai bekötését és működését modellezi.

## Főbb funkciók
* **Hibrid grafikus eszköztár, interaktív munkapad és szerszám-kurzorok:** Felül szöveg nélküli, részletes SVG ikonsáv (hover tooltipekkel rázoomolt munkához), alul pedig 100%-ban szinkronizált interaktív fa munkapad fém kábeldob-állvánnyal (Fekete, Kék, Zöld-sárga, Barna, Szürke, Piros tekercsekkel), gumírozott VDE szerszámalátéttel (szerelőkesztyű, VDE csavarhúzó, VDE oldalcsípőfogó), UNI-T műszerekkel, WAGO dobozokkal és kattintható sorkapocs-segédlappal. A kézben tartott szerszám vagy műszer helyén halvány sziluett látszik az asztalon, a kurzor pedig az aktív eszköznek (és a választott tekercs érszínének) megfelelő SVG szerszámra vált.
* **Szabadkézi vezetékezés:** Választható szabványos érszínek ($L_1$, $L_2$, $L_3$, $N$, $PE$, vezérlőszál) szabadkézi behúzása a sorkapcsok és Wago összekötők között, közvetlenül a vezetéktekercsekre kattintva.
* **3-as és 5-ös WAGO blokkok munkapadról:** A munkapadi WAGO dobozokból korlátlan számú `WAGO 221-413` (3-as) és `WAGO 221-415` (5-ös) csatlakozó húzható ki a falra nyitott karokkal, amelyek üresen visszahúzva a dobozba törölhetők. A még be nem kötött WAGO blokkok tetszőlegesen 90°-os lépésekben elforgathatók az **`R` billentyűvel**, a blokk jobb felső **`↻` forgató gombjával**, vagy **jobb egérgombbal**. Bekötött WAGO nem forgatható és nem mozgatható a vezetékek kikötése nélkül.
* **Mechanikai rögzítés szimulációja:** Az üres sorkapcsok alapból kilazított (`tight: false`) állapotból indulnak a gyors bekötéshez. A vezetékek csak akkor vezetnek áramot, ha a sorkapocs csavarja a **Csavarhúzó** eszközzel meg van húzva, vagy a **Wago** karja a **Kéz** eszközzel le van hajtva.
* **Valós idejű áramköri szimulátor:** Minden védelmi eszköz (kismegszakítók, ÁVK-k, motorvédő) alapból **KI** állásban indul. Gráf-alapú feszültségkövetés, zárlatvédelem (kismegszakítók leoldása rövidzárlat esetén), mágneskapcsolók (öntartás, reteszelés), időrelé, impulzusrelé és lépcsőházi automata kezelése.
* **4P és 2P Áram-védőkapcsolók (ÁVK / FI-relé):** Élethű kiselosztó elrendezés 4P (`40A / 30mA`) és 2P (`25A / 30mA`) ÁVK-kkal a DIN sínen. Működő `T` tesztgombbal, kézi főkarral, optikai állapotjelzővel, upstream tápfüggőséggel, testzárlat (`L–PE`), nulla–védővezető zárlat (`N–PE`), párhuzamosított nulla (`3F N` + `1F N`) és fogyasztói keresztbe kötött nulla hibaáram-leoldással.
* **3 fázisú aszinkron villanymotor és 6+1 fix WAGO bekötés:** Valósághű ipari 3F villanymotor animált forgó lapátkerékkel, tehetetlenségi gyorsulással/lassulással, forgásirány-kijelzővel (`CW ↻` / `CCW ↺`) és digitális LED állapotkijelzővel (`Y ↻ 1.8A`, `Δ ↻ 5.4A`, `⚡ FÁZISHIBA! 8.5A`). A motor kábele a sorkapocs poszter alatti 6+1 db fix 3-as WAGO-ba fut be gyárilag zárt 1. karral és fehér szigetelőszalag kivezetési zászlókkal (`U1`, `V1`, `W1`, `U2`, `V2`, `W2`, `PE`), a tanuló számára szabad 2. és 3. nyílásokkal csillag/delta átkötésekhez. Direkt indítás, forgásirány-váltás, 2 fázisú fázishiba-érzékelés rezgéssel, és mágneskapcsolós (`MK1`, `MK2`, `MK3`) csillag-delta automatika.
* **UNI-T UT18D feszültség- és folytonosságvizsgáló műszer:** Két mérőtüskés (`COM −` fekete és `+` piros) vizsgálóműszer élő Canvas mérőzsinórokkal, szabadon mozgatható lebegő műszerpanellel (`12V..400V` LED sáv, `⚡` egypólusú fázisjelzés, `~ AC`, `🔊 Rx`, `R/L` fázissorrend LED-ek, háttérvilágításos LCD) és némítható **Web Audio API** sípoló hangjelzéssel. Mérhető vele a `230 V AC` fázis–nulla/PE és `400 V AC` vonali feszültség (forgásiránnyal), kikapcsolt kismegszakítóknál pedig a meghúzott vezetékek és zárt érintkezők folytonossága (`0.0 Ω` / `OL`). Rögzített tüskékkel Kéz eszközre váltva kapcsolgatás közben is élőben frissül a mérés.
* **UNI-T UT202A+ digitális lakatfogó és fázor árammérés:** Kirchhoff csomóponti törvényén alapuló komplex fázor áramhálózat-megoldó (`L1: 0°`, `L2: -120°`, `L3: +120°`), amely minden bekötött vezetéken kiszámítja a valós effektív váltakozó áramot (izzó `~0.43 A`, párhuzamos főág `~0.86 A`, mágneskapcsoló tekercs `~0.05 A`, relék/PIR `~0.02 A`, kiegyensúlyozott 3F közös nulla `0.00 A`, 3F motor csillag `~1.80 A`, delta vonali `~5.40 A` / tekercság `~3.12 A`, fázishiba `~8.50 A`). Vezeték fölé húzva a lakatfogó pofája térben rázár a vezetékre, kattintással rögzíthető (így Kéz eszközzel kapcsolgatva élőben követhető az áramváltozás), lebegő LCD panellel (`~ AC A`, analóg sávkijelző, `DATA HOLD`, lecsatolás), amely az UNI-T UT18D műszerrel párhuzamosan is használható.
* **Szabványos kábelszín validáció:** Szabványossági érszín-ellenőrző rendszer (Fekete: minden fázis és kapcsolt fáziság $L_1/L_2/L_3$ bontás nélkül, Kék: $N$ nulla, Zöld-sárga: $PE$ védővezető). Kikapcsolt és bekapcsolt kismegszakítóknál egyaránt azonnal működik: gráfbejárással automatikusan felderíti a WAGO-k áramköri szerepkörét, a tiltott színeket (pl. kék fáziságban, fekete nullán, nem zöld-sárga PE-n) és a közvetlen zárlati keresztkötéseket. Lebegő információs panellel és a hibás vezetékek élénk piros szaggatott Canvas kiemelésével.
* **Gyakorló és Hibakereső (Debug) mód:** Normál módban a sorkapcsok funkciója rejtve van (a táblázatból és színjelölésből kell azonosítani), hibakereső módban viszont megjelennek a feszültségszintek és a laza kötések figyelmeztetései.

---

## Előfeltételek
* [Node.js](https://nodejs.org/) (v18 vagy újabb ajánlott) és `npm`

---

## Telepítés és lokális indítás

1. **Repó klónozása:**
    ```bash
    git clone [https://github.com/panszek/Calcidurr.git](https://github.com/panszek/Calcidurr.git)
    cd Calcidurr
    ```

2. **Függőségek telepítése:**

    ```bash
    npm install
    ```
3. **Fejlesztői szerver indítása (lokális futtatás):**

    ```bash
    npm run dev
    ```
4. **Nyisd meg a böngészőben a terminálban megjelenő helyi címet (jellemzően: http://localhost:5173).**

5. **Hasznos parancsok:**

    npm run dev – Lokális fejlesztői szerver indítása (élő újratöltéssel)

    npm run build – Típusellenőrzés (`tsc --noEmit`) és éles (produkciós) verzió fordítása a `dist` mappába

    npm run preview – A lefordított produkciós verzió helyi előnézete

    npm test – Automatizált Vitest unit és szimulációs tesztek futtatása (`vitest run`)

    npm run test:watch – Vitest tesztek futtatása figyelő módban fejlesztés közben