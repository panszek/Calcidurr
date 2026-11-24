# Calcidurr – Villanyszerelő Oktatófal Szimulátor

Böngészőben futó, interaktív villanyszerelési gyakorló- és szimulációs program, amely egy sorkapocssoros iskolai oktatófal fizikai bekötését és működését modellezi.

## Főbb funkciók
* **Szabadkézi vezetékezés:** Választható szabványos érszínek ($L_1$, $L_2$, $L_3$, $N$, $PE$, vezérlőszál) szabadkézi behúzása a sorkapcsok és Wago összekötők között.
* **3-as és 5-ös WAGO blokkok munkapadról:** A munkapadi WAGO dobozokból korlátlan számú `WAGO 221-413` (3-as) és `WAGO 221-415` (5-ös) csatlakozó húzható ki a falra nyitott karokkal, amelyek üresen visszahúzva a dobozba törölhetők. A még be nem kötött WAGO blokkok tetszőlegesen 90°-os lépésekben elforgathatók az **`R` billentyűvel**, a blokk jobb felső **`↻` forgató gombjával**, vagy **jobb egérgombbal**. Bekötött WAGO nem forgatható és nem mozgatható a vezetékek kikötése nélkül.
* **Mechanikai rögzítés szimulációja:** Az üres sorkapcsok alapból kilazított (`tight: false`) állapotból indulnak a gyors bekötéshez. A vezetékek csak akkor vezetnek áramot, ha a sorkapocs csavarja a **Csavarhúzó** eszközzel meg van húzva, vagy a **Wago** karja a **Kéz** eszközzel le van hajtva.
* **Valós idejű áramköri szimulátor:** Minden védelmi eszköz (kismegszakítók, motorvédő) alapból **KI** állásban indul. Gráf-alapú feszültségkövetés, zárlatvédelem (kismegszakítók leoldása rövidzárlat esetén), mágneskapcsolók (öntartás, reteszelés), időrelé, impulzusrelé és lépcsőházi automata kezelése.
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