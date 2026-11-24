import { WIRE_COLORS } from "../data/colors";
import type { ColorCheckResult, WireColorId } from "../models/types";

export interface ColorCheckPanelOptions {
  onClose?: () => void;
  onHoverWire?: (wireId: string | undefined) => void;
  onSelectWire?: (wireId: string) => void;
}

export class ColorCheckPanel {
  private container: HTMLDivElement;
  private isOpenState = false;
  private lastResult?: ColorCheckResult;
  private options: ColorCheckPanelOptions;

  constructor(options: ColorCheckPanelOptions = {}) {
    this.options = options;
    this.container = document.createElement("div");
    this.container.id = "color-check-panel-container";
    this.container.className = "color-check-container hidden";
    document.body.appendChild(this.container);
    this.render();
  }

  public isOpen(): boolean {
    return this.isOpenState;
  }

  public show(): void {
    this.isOpenState = true;
    this.container.classList.remove("hidden");
    this.render();
  }

  public hide(): void {
    this.isOpenState = false;
    this.container.classList.add("hidden");
    if (this.options.onHoverWire) {
      this.options.onHoverWire(undefined);
    }
  }

  public toggle(): void {
    if (this.isOpenState) {
      this.hide();
      if (this.options.onClose) this.options.onClose();
    } else {
      this.show();
    }
  }

  public update(result: ColorCheckResult): void {
    this.lastResult = result;
    if (this.isOpenState) {
      this.render();
    }
  }

  private getColorInfo(colorId: WireColorId) {
    const c = WIRE_COLORS[colorId];
    return {
      name: c ? c.name : colorId,
      stroke: c ? c.stroke : "#999",
    };
  }

  private render(): void {
    const res = this.lastResult;
    const total = res?.totalWires ?? 0;
    const correct = res?.correctWires ?? 0;
    const issues = res?.issues ?? [];
    const valid = res?.valid ?? true;

    let contentHtml = "";

    if (total === 0) {
      contentHtml = `
        <div class="color-check-empty">
          <div class="empty-icon">🔌</div>
          <p><strong>Nincs bekötött vezeték a falon.</strong></p>
          <p class="empty-sub">Húzz be vezetékeket a sorkapcsok és WAGO-k közé a vezetékezés eszközzel!</p>
        </div>
      `;
    } else if (valid) {
      contentHtml = `
        <div class="color-status-banner success">
          <div class="status-icon">✓</div>
          <div class="status-body">
            <h4>Minden vezeték (${total} db) szabályosan színhelyes!</h4>
            <p>A fázis-, nulla- és védővezető ágak érszínei maradéktalanul megfelelnek a szabványoknak.</p>
          </div>
        </div>
        <div class="color-rules-box">
          <div class="rules-title">Alkalmazott szabványos érszínek:</div>
          <div class="rule-item">
            <span class="swatch" style="background:${WIRE_COLORS.L1.stroke}"></span>
            <strong>Fázis / vezérlés (L1, L2, L3):</strong> Fekete
          </div>
          <div class="rule-item">
            <span class="swatch" style="background:${WIRE_COLORS.N.stroke}"></span>
            <strong>Nullavezető (N):</strong> Kék
          </div>
          <div class="rule-item">
            <span class="swatch" style="background: repeating-linear-gradient(45deg, #15803d, #15803d 4px, #eab308 4px, #eab308 8px)"></span>
            <strong>Védővezető (PE):</strong> Zöld-sárga
          </div>
        </div>
      `;
    } else {
      contentHtml = `
        <div class="color-status-banner error">
          <div class="status-icon">⚠</div>
          <div class="status-body">
            <h4>${correct}/${total} vezeték színhelyes (${issues.length} hibás szín)</h4>
            <p>Az alábbi vezetékek színe eltér a villamos szabvány szerinti elvárástól:</p>
          </div>
        </div>
        <div class="color-issues-list">
          ${issues
            .map((issue, idx) => {
              const act = this.getColorInfo(issue.actualColor);
              const exp = this.getColorInfo(issue.expectedColor);
              const actSwatchBg =
                issue.actualColor === "PE"
                  ? "repeating-linear-gradient(45deg, #15803d, #15803d 4px, #eab308 4px, #eab308 8px)"
                  : act.stroke;
              const expSwatchBg =
                issue.expectedColor === "PE"
                  ? "repeating-linear-gradient(45deg, #15803d, #15803d 4px, #eab308 4px, #eab308 8px)"
                  : exp.stroke;

              return `
                <div class="color-issue-card" data-wire-id="${issue.wireId}">
                  <div class="issue-header">
                    <span class="issue-badge">#${idx + 1}</span>
                    <span class="issue-endpoints" title="${issue.fromLabel} ➔ ${issue.toLabel}">
                      ${issue.fromLabel} ➔ ${issue.toLabel}
                    </span>
                  </div>
                  <div class="issue-pills-row">
                    <div class="pill actual">
                      <span class="swatch" style="background:${actSwatchBg}"></span>
                      <span>Jelenleg: <strong>${act.name}</strong></span>
                    </div>
                    <div class="pill-arrow">➔</div>
                    <div class="pill expected">
                      <span class="swatch" style="background:${expSwatchBg}"></span>
                      <span>Elvárt: <strong>${exp.name}</strong></span>
                    </div>
                  </div>
                  <div class="issue-reason-text">${issue.reason}</div>
                </div>
              `;
            })
            .join("")}
        </div>
      `;
    }

    this.container.innerHTML = `
      <div class="color-check-window">
        <div class="color-check-header">
          <div class="header-title">
            <span class="header-icon">🎨</span>
            <span>Kábelszín Validáció</span>
            <span class="header-badge ${valid ? "badge-success" : "badge-warn"}">${total} vezeték</span>
          </div>
          <button type="button" class="close-btn" title="Bezárás">✕</button>
        </div>
        <div class="color-check-body">
          ${contentHtml}
        </div>
        <div class="color-check-footer">
          <span class="footer-hint">Tipp: vidd az egeret egy hiba fölé a vezetéke kiemeléséhez!</span>
        </div>
      </div>
    `;

    // Event handlers
    const closeBtn = this.container.querySelector<HTMLButtonElement>(".close-btn");
    if (closeBtn) {
      closeBtn.onclick = () => {
        this.hide();
        if (this.options.onClose) this.options.onClose();
      };
    }

    // Hover wire highlight
    const issueCards = this.container.querySelectorAll<HTMLDivElement>(".color-issue-card");
    issueCards.forEach((card) => {
      const wireId = card.getAttribute("data-wire-id");
      if (wireId) {
        card.onmouseenter = () => {
          if (this.options.onHoverWire) this.options.onHoverWire(wireId);
        };
        card.onmouseleave = () => {
          if (this.options.onHoverWire) this.options.onHoverWire(undefined);
        };
        card.onclick = () => {
          if (this.options.onSelectWire) this.options.onSelectWire(wireId);
        };
      }
    });
  }
}
