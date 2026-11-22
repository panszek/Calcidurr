import {
  LOWER_TERMINAL_GROUPS,
  UPPER_TERMINAL_GROUPS,
  type LegendDeviceGroup,
} from "../data/terminalLegend";

export class LegendTableViewer {
  private container: HTMLDivElement;
  private zoomLevel = 1.0;
  private currentTab: "all" | "upper" | "lower" = "all";
  private isDocked = false;
  private isOpenState = false;
  private onHoverCol?: (colId?: string) => void;

  constructor(options?: { onHoverCol?: (colId?: string) => void }) {
    this.onHoverCol = options?.onHoverCol;
    this.container = document.createElement("div");
    this.container.id = "legend-modal-container";
    this.container.className = "legend-modal-container hidden";
    document.body.appendChild(this.container);
    this.render();
  }

  public isOpen(): boolean {
    return this.isOpenState;
  }

  public toggle(): void {
    if (this.isOpenState) {
      this.close();
    } else {
      this.open();
    }
  }

  public open(tab?: "all" | "upper" | "lower"): void {
    if (tab) this.currentTab = tab;
    this.isOpenState = true;
    this.container.classList.remove("hidden");
    this.render();
  }

  public close(): void {
    this.isOpenState = false;
    this.container.classList.add("hidden");
    if (this.onHoverCol) this.onHoverCol(undefined);
  }

  public setZoom(zoom: number): void {
    this.zoomLevel = Math.max(0.7, Math.min(2.5, zoom));
    const wrapper = this.container.querySelector<HTMLElement>(".legend-zoomable-content");
    if (wrapper) {
      wrapper.style.transform = `scale(${this.zoomLevel})`;
      wrapper.style.transformOrigin = "top left";
    }
    const zoomText = this.container.querySelector<HTMLElement>(".zoom-indicator");
    if (zoomText) zoomText.textContent = `${Math.round(this.zoomLevel * 100)}%`;
  }

  private renderTable(groups: LegendDeviceGroup[], title: string, subtitle: string): string {
    // Felső nagy cella: az eszköz neve függőlegesen írva (colspan átfogja a kapcsokat)
    let rowDevices = `<tr class="row-devices"><th class="corner-header">Készülék neve</th>`;
    // Középső sor: a kapocspont jelölése
    let rowLabels = `<tr class="row-labels"><th class="corner-header">Kapocspont</th>`;
    // Alsó sor: az adott sorkapocs színkódja
    let rowColors = `<tr class="row-colors"><th class="corner-header">Színkód</th>`;

    groups.forEach((group, groupIdx) => {
      const span = group.terminals.length;
      const groupBgClass = groupIdx % 2 === 0 ? "group-even" : "group-odd";

      // Device header cell with vertical text
      rowDevices += `<th class="cell-device ${groupBgClass}" colspan="${span}" title="${group.title} (${span} kapocs)">
        <div class="vertical-device-label">${group.title}</div>
      </th>`;

      // Terminals
      group.terminals.forEach((term) => {
        rowLabels += `<td class="cell-label ${groupBgClass}" data-col="${term.colId}" title="${group.title} • Kapocs: ${term.label}">
          <strong>${term.label}</strong>
        </td>`;

        let colorVisual = "";
        let colorName = "Fekete";
        if (term.mark === "pe") {
          colorName = "Zöld-sárga (PE)";
          colorVisual = `<span class="swatch-pe" title="${colorName}"></span>`;
        } else if (term.mark === "blue") {
          colorName = "Kék";
          colorVisual = `<span class="swatch-color swatch-blue" title="${colorName}"></span>`;
        } else if (term.mark === "red") {
          colorName = "Piros";
          colorVisual = `<span class="swatch-color swatch-red" title="${colorName}"></span>`;
        } else if (term.mark === "green") {
          colorName = "Zöld";
          colorVisual = `<span class="swatch-color swatch-green" title="${colorName}"></span>`;
        } else if (term.mark === "yellow") {
          colorName = "Sárga";
          colorVisual = `<span class="swatch-color swatch-yellow" title="${colorName}"></span>`;
        } else if (term.mark === "white") {
          colorName = "Fehér";
          colorVisual = `<span class="swatch-color swatch-white" title="${colorName}"></span>`;
        } else if (term.mark === "brown") {
          colorName = "Barna";
          colorVisual = `<span class="swatch-color swatch-brown" title="${colorName}"></span>`;
        } else {
          colorName = "Fekete";
          colorVisual = `<span class="swatch-color swatch-black" title="${colorName}"></span>`;
        }

        rowColors += `<td class="cell-color ${groupBgClass}" data-col="${term.colId}" title="${colorName}">
          ${colorVisual}
        </td>`;
      });
    });

    rowDevices += `</tr>`;
    rowLabels += `</tr>`;
    rowColors += `</tr>`;

    return `
      <div class="legend-section">
        <div class="legend-section-header">
          <h3>${title}</h3>
          <span class="legend-section-desc">${subtitle}</span>
        </div>
        <div class="legend-table-scroll-container">
          <table class="legend-table">
            <thead>
              ${rowDevices}
            </thead>
            <tbody>
              ${rowLabels}
              ${rowColors}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  private render(): void {
    if (!this.isOpenState) return;

    const upperHtml = this.renderTable(
      UPPER_TERMINAL_GROUPS,
      "FELSŐ SORKAPOCSSOR (X1)",
      "65 sorkapocs • Táp, megszakítók, impulzusrelé, lépcsőházi automata, időrelé, MK1..MK3 mágneskapcsolók és motorvédő",
    );

    const lowerHtml = this.renderTable(
      LOWER_TERMINAL_GROUPS,
      "ALSÓ SORKAPOCSSOR (X2)",
      "54 sorkapocs • Dugalj, 106/107/101/102/105 kapcsolók, 101N nyomók, vezérlő nyomógombok, izzók és mozgásérzékelő",
    );

    this.container.className = `legend-modal-container ${this.isDocked ? "docked" : "modal"}`;

    this.container.innerHTML = `
      <div class="legend-backdrop"></div>
      <div class="legend-window">
        <header class="legend-header">
          <div class="legend-title-area">
            <span class="legend-icon">📋</span>
            <div>
              <h2>OKTATÓFALI SORKAPOCS-KIOSZTÁSI JEGYZÉK</h2>
              <p>Minden sorkapocs felül fixen előszerelt • Alul szabadon beköthető</p>
            </div>
          </div>

          <div class="legend-toolbar-actions">
            <!-- Tab switches -->
            <div class="btn-group">
              <button type="button" class="tab-btn ${this.currentTab === "all" ? "active" : ""}" data-tab="all">Összes sor</button>
              <button type="button" class="tab-btn ${this.currentTab === "upper" ? "active" : ""}" data-tab="upper">Felső sor (65 db)</button>
              <button type="button" class="tab-btn ${this.currentTab === "lower" ? "active" : ""}" data-tab="lower">Alsó sor (56 db)</button>
            </div>

            <!-- Zoom Controls -->
            <div class="btn-group">
              <button type="button" data-zoom-out title="Kicsinyítés">🔍−</button>
              <span class="zoom-indicator">${Math.round(this.zoomLevel * 100)}%</span>
              <button type="button" data-zoom-in title="Nagyítás">🔍+</button>
              <button type="button" data-zoom-reset title="100% méretarány">1:1</button>
            </div>

            <!-- Dock / Pop-out toggle -->
            <button type="button" class="action-btn" data-toggle-dock title="${this.isDocked ? "Nagy ablakos nézet" : "Dokkolás a képernyő aljára"}">
              ${this.isDocked ? "⤢ Nagy ablak" : "🗗 Alsó dokkolás"}
            </button>

            <!-- Close button -->
            <button type="button" class="close-btn" data-close title="Bezárás (Esc)">✕</button>
          </div>
        </header>

        <div class="legend-content-viewport">
          <div class="legend-zoomable-content" style="transform: scale(${this.zoomLevel}); transform-origin: top left;">
            ${this.currentTab === "all" || this.currentTab === "upper" ? upperHtml : ""}
            ${this.currentTab === "all" || this.currentTab === "lower" ? lowerHtml : ""}
          </div>
        </div>

        <footer class="legend-footer">
          <div class="legend-info-pill" id="legend-hover-info">
            💡 <strong>Tipp diákoknak:</strong> Vidd az egeret bármelyik oszlop fölé a kapocspont azonosításához. A sorkapcsok teteje már előszerelt; csak az alsó nyílásba köss vezetéket!
          </div>
        </footer>
      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    const backdrop = this.container.querySelector(".legend-backdrop");
    backdrop?.addEventListener("click", () => this.close());

    const closeBtn = this.container.querySelector("[data-close]");
    closeBtn?.addEventListener("click", () => this.close());

    const tabBtns = this.container.querySelectorAll<HTMLButtonElement>("[data-tab]");
    tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        this.currentTab = btn.dataset.tab as "all" | "upper" | "lower";
        this.render();
      });
    });

    const zoomInBtn = this.container.querySelector("[data-zoom-in]");
    zoomInBtn?.addEventListener("click", () => this.setZoom(this.zoomLevel + 0.2));

    const zoomOutBtn = this.container.querySelector("[data-zoom-out]");
    zoomOutBtn?.addEventListener("click", () => this.setZoom(this.zoomLevel - 0.2));

    const zoomResetBtn = this.container.querySelector("[data-zoom-reset]");
    zoomResetBtn?.addEventListener("click", () => this.setZoom(1.0));

    const dockBtn = this.container.querySelector("[data-toggle-dock]");
    dockBtn?.addEventListener("click", () => {
      this.isDocked = !this.isDocked;
      this.render();
    });

    // Hover detection over cells to highlight and inform
    const cells = this.container.querySelectorAll<HTMLElement>("[data-col]");
    const infoPill = this.container.querySelector<HTMLElement>("#legend-hover-info");

    cells.forEach((cell) => {
      cell.addEventListener("mouseenter", () => {
        const colId = cell.dataset.col;
        if (!colId) return;

        // Highlight matching column in table
        this.container.querySelectorAll<HTMLElement>(`[data-col="${colId}"]`).forEach((c) => {
          c.classList.add("col-highlight");
        });

        if (infoPill) {
          infoPill.innerHTML = `📍 Kiválasztva: <strong>${cell.getAttribute("title") || colId}</strong>`;
        }

        if (this.onHoverCol) this.onHoverCol(colId);
      });

      cell.addEventListener("mouseleave", () => {
        const colId = cell.dataset.col;
        if (colId) {
          this.container.querySelectorAll<HTMLElement>(`[data-col="${colId}"]`).forEach((c) => {
            c.classList.remove("col-highlight");
          });
        }
        if (infoPill) {
          infoPill.innerHTML = `💡 <strong>Tipp diákoknak:</strong> Vidd az egeret bármelyik oszlop fölé a kapocspont azonosításához. A sorkapcsok teteje már előszerelt; csak az alsó nyílásba köss vezetéket!`;
        }
        if (this.onHoverCol) this.onHoverCol(undefined);
      });
    });

    // Close on Escape
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && this.isOpenState) {
        this.close();
        window.removeEventListener("keydown", onKey);
      }
    };
    window.addEventListener("keydown", onKey);
  }
}
