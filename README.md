# Calcidurr – Villanyszerelő Oktatófal Szimulátor

Böngészőben futó, interaktív villanyszerelési gyakorló- és szimulációs program, amely egy sorkapocssoros iskolai oktatófal fizikai bekötését és működését modellezi.

## Főbb funkciók
* **Szabadkézi vezetékezés:** Választható szabványos érszínek ($L_1$, $L_2$, $L_3$, $N$, $PE$, vezérlőszál) szabadkézi behúzása a sorkapcsok és Wago összekötők között.
* **Mechanikai rögzítés szimulációja:** A vezetékek csak akkor vezetnek áramot, ha a sorkapocs csavarja a **Csavarhúzó** eszközzel meg van húzva, vagy a **Wago** karja le van hajtva.
* **Valós idejű áramköri szimulátor:** Gráf-alapú feszültségkövetés, zárlatvédelem (kismegszakítók leoldása rövidzárlat esetén), mágneskapcsolók (öntartás, reteszelés), időrelé, impulzusrelé és lépcsőházi automata kezelése.
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

    npm run build – Éles (produkciós) verzió fordítása a dist mappába

    npm run preview – A lefordított produkciós verzió helyi előnézete