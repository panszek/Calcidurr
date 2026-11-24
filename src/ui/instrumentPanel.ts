import type { ProbeTarget, TesterReading, VoltageLedStep } from "../models/types";

export class ContinuityBuzzer {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private muted = false;
  private beeping = false;

  constructor() {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          this.stopTone();
        } else if (this.beeping && !this.muted) {
          this.startTone();
        }
      });
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.muted) {
      this.stopTone();
    } else if (this.beeping) {
      this.startTone();
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public setBeeping(shouldBeep: boolean): void {
    if (this.beeping === shouldBeep) return;
    this.beeping = shouldBeep;
    if (shouldBeep && !this.muted) {
      this.startTone();
    } else {
      this.stopTone();
    }
  }

  public stop(): void {
    this.beeping = false;
    this.stopTone();
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      try {
        this.ctx = new AudioCtx();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {
        /* autoplay policy ignore until next gesture */
      });
    }
    return this.ctx;
  }

  private startTone(): void {
    if (this.osc) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      // Piezo sípoló hangkarakter (UNI-T ~2650 Hz)
      osc.type = "square";
      osc.frequency.setValueAtTime(2650, ctx.currentTime);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(3800, ctx.currentTime);

      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.008);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      this.osc = osc;
      this.gain = gain;
    } catch {
      this.osc = null;
      this.gain = null;
    }
  }

  private stopTone(): void {
    if (!this.osc || !this.ctx || !this.gain) {
      this.osc = null;
      this.gain = null;
      return;
    }

    const osc = this.osc;
    const gain = this.gain;
    this.osc = null;
    this.gain = null;

    try {
      const now = this.ctx.currentTime;
      gain.gain.setTargetAtTime(0.0001, now, 0.006);
      osc.stop(now + 0.03);
      window.setTimeout(() => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {
          /* ignore */
        }
      }, 50);
    } catch {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        /* ignore */
      }
    }
  }
}

export interface InstrumentPanelState {
  reading: TesterReading;
  blackProbe?: ProbeTarget;
  redProbe?: ProbeTarget;
  liveRedTarget?: ProbeTarget;
  toolActive: boolean;
}

export interface InstrumentPanelOptions {
  onClearProbes?: () => void;
  onClose?: () => void;
}

const LED_STEPS_DESC: ReadonlyArray<{ step: VoltageLedStep; danger: boolean }> = [
  { step: 400, danger: true },
  { step: 230, danger: true },
  { step: 120, danger: true },
  { step: 50, danger: false },
  { step: 24, danger: false },
  { step: 12, danger: false },
];

export class InstrumentPanel {
  private container: HTMLDivElement;
  private isOpenState = false;
  private buzzer = new ContinuityBuzzer();
  private options: InstrumentPanelOptions;

  // Gyorsítótárazott DOM referenciák a 60fps élő frissítéshez
  private voltageLedEls = new Map<VoltageLedStep, HTMLElement>();
  private ledHvEl!: HTMLElement;
  private ledAcEl!: HTMLElement;
  private ledRxEl!: HTMLElement;
  private ledRotLEl!: HTMLElement;
  private ledRotREl!: HTMLElement;

  private lcdScreenEl!: HTMLElement;
  private lcdIconAcEl!: HTMLElement;
  private lcdIconHvEl!: HTMLElement;
  private lcdIconRxEl!: HTMLElement;
  private lcdIconRotREl!: HTMLElement;
  private lcdIconRotLEl!: HTMLElement;
  private lcdIconMuteEl!: HTMLElement;
  private lcdPrimaryEl!: HTMLElement;
  private lcdSecondaryEl!: HTMLElement;

  private blackStatusEl!: HTMLElement;
  private redStatusEl!: HTMLElement;
  private muteBtnEl!: HTMLButtonElement;
  private clearBtnEl!: HTMLButtonElement;

  private lastState?: InstrumentPanelState;

  constructor(options: InstrumentPanelOptions = {}) {
    this.options = options;
    this.container = document.createElement("div");
    this.container.id = "unit-instrument-panel";
    this.container.className = "unit-panel-container hidden";
    this.buildDom();
    document.body.appendChild(this.container);
  }

  public isOpen(): boolean {
    return this.isOpenState;
  }

  public show(): void {
    this.isOpenState = true;
    this.container.classList.remove("hidden");
    if (this.lastState) {
      this.applyState(this.lastState);
    }
  }

  public hide(): void {
    this.isOpenState = false;
    this.container.classList.add("hidden");
    this.buzzer.stop();
  }

  public stopAudio(): void {
    this.buzzer.stop();
  }

  public update(state: InstrumentPanelState): void {
    this.lastState = state;
    if (!this.isOpenState) {
      this.buzzer.stop();
      return;
    }
    this.applyState(state);
  }

  private buildDom(): void {
    const voltageRowsHtml = LED_STEPS_DESC.map(
      ({ step, danger }) => `
        <div class="unit-vled-row ${danger ? "danger" : "safe"}" data-vstep="${step}">
          <span class="unit-led-dot"></span>
          <span class="unit-vled-label">${step}V</span>
        </div>
      `,
    ).join("");

    this.container.innerHTML = `
      <div class="unit-holster">
        <div class="unit-header" title="Húzd a fejlécet a műszer mozgatásához">
          <div class="unit-brand">
            <span class="unit-logo-badge">UNI-T</span>
            <span class="unit-model-code">UT18D</span>
          </div>
          <button type="button" class="unit-close-btn" title="Műszer bezárása és tüskék levétele">✕</button>
        </div>

        <div class="unit-faceplate">
          <div class="unit-led-section">
            <div class="unit-voltage-bar">
              ${voltageRowsHtml}
            </div>
            <div class="unit-status-leds">
              <div class="unit-sled danger" data-sled="hv" title="Egypólusú / veszélyes fázisfeszültség jelzés">
                <span class="unit-led-dot"></span>
                <span class="unit-sled-label">⚡ FÁZIS</span>
              </div>
              <div class="unit-sled ac" data-sled="ac" title="Váltakozó feszültség (AC)">
                <span class="unit-led-dot"></span>
                <span class="unit-sled-label">~ AC</span>
              </div>
              <div class="unit-sled rx" data-sled="rx" title="Folytonosság (Rx < 40 Ω)">
                <span class="unit-led-dot"></span>
                <span class="unit-sled-label">🔊 Rx</span>
              </div>
              <div class="unit-rot-pair">
                <div class="unit-sled rot" data-sled="rotL" title="Bal forgásirány (L)">
                  <span class="unit-led-dot"></span>
                  <span class="unit-sled-label">L ↺</span>
                </div>
                <div class="unit-sled rot" data-sled="rotR" title="Jobb forgásirány (R)">
                  <span class="unit-led-dot"></span>
                  <span class="unit-sled-label">R ↻</span>
                </div>
              </div>
            </div>
          </div>

          <div class="unit-lcd">
            <div class="unit-lcd-icons">
              <span class="lcd-seg" data-lcd-icon="ac">AC</span>
              <span class="lcd-seg" data-lcd-icon="hv">⚡</span>
              <span class="lcd-seg" data-lcd-icon="rx">🔊 Rx</span>
              <span class="lcd-seg" data-lcd-icon="rotR">R↻</span>
              <span class="lcd-seg" data-lcd-icon="rotL">L↺</span>
              <span class="lcd-seg" data-lcd-icon="mute">🔇</span>
            </div>
            <div class="unit-lcd-primary">---</div>
            <div class="unit-lcd-secondary">KÉSZENLÉT</div>
          </div>

          <div class="unit-probes-box">
            <div class="unit-probe-row">
              <span class="probe-badge black">COM −</span>
              <span class="probe-status-text" data-probe="black">Szabad — 1. kattintás lerakja</span>
            </div>
            <div class="unit-probe-row">
              <span class="probe-badge red">L2 +</span>
              <span class="probe-status-text" data-probe="red">Várakozás a fekete tüskére</span>
            </div>
          </div>

          <div class="unit-actions">
            <button type="button" class="unit-btn mute-btn" title="Folytonossági sípoló hang némítása / visszakapcsolása">
              🔊 Hang: BE
            </button>
            <button type="button" class="unit-btn clear-btn" disabled title="Mérőtüskék elemelése a falról (Esc / Jobb klikk)">
              ⏏ Levétel
            </button>
          </div>
        </div>

        <div class="unit-footer-hint">
          Jobb klikk / Esc / üres hely: tüskék elemelése
        </div>
      </div>
    `;

    for (const { step } of LED_STEPS_DESC) {
      const el = this.container.querySelector<HTMLElement>(`[data-vstep="${step}"]`)!;
      this.voltageLedEls.set(step, el);
    }

    this.ledHvEl = this.container.querySelector<HTMLElement>('[data-sled="hv"]')!;
    this.ledAcEl = this.container.querySelector<HTMLElement>('[data-sled="ac"]')!;
    this.ledRxEl = this.container.querySelector<HTMLElement>('[data-sled="rx"]')!;
    this.ledRotLEl = this.container.querySelector<HTMLElement>('[data-sled="rotL"]')!;
    this.ledRotREl = this.container.querySelector<HTMLElement>('[data-sled="rotR"]')!;

    this.lcdScreenEl = this.container.querySelector<HTMLElement>(".unit-lcd")!;
    this.lcdIconAcEl = this.container.querySelector<HTMLElement>('[data-lcd-icon="ac"]')!;
    this.lcdIconHvEl = this.container.querySelector<HTMLElement>('[data-lcd-icon="hv"]')!;
    this.lcdIconRxEl = this.container.querySelector<HTMLElement>('[data-lcd-icon="rx"]')!;
    this.lcdIconRotREl = this.container.querySelector<HTMLElement>('[data-lcd-icon="rotR"]')!;
    this.lcdIconRotLEl = this.container.querySelector<HTMLElement>('[data-lcd-icon="rotL"]')!;
    this.lcdIconMuteEl = this.container.querySelector<HTMLElement>('[data-lcd-icon="mute"]')!;
    this.lcdPrimaryEl = this.container.querySelector<HTMLElement>(".unit-lcd-primary")!;
    this.lcdSecondaryEl = this.container.querySelector<HTMLElement>(".unit-lcd-secondary")!;

    this.blackStatusEl = this.container.querySelector<HTMLElement>('[data-probe="black"]')!;
    this.redStatusEl = this.container.querySelector<HTMLElement>('[data-probe="red"]')!;
    this.muteBtnEl = this.container.querySelector<HTMLButtonElement>(".mute-btn")!;
    this.clearBtnEl = this.container.querySelector<HTMLButtonElement>(".clear-btn")!;

    const closeBtn = this.container.querySelector<HTMLButtonElement>(".unit-close-btn")!;
    closeBtn.addEventListener("click", () => {
      this.hide();
      if (this.options.onClose) this.options.onClose();
    });

    this.muteBtnEl.addEventListener("click", () => {
      const muted = this.buzzer.toggleMute();
      this.muteBtnEl.textContent = muted ? "🔇 Némítva" : "🔊 Hang: BE";
      this.muteBtnEl.classList.toggle("muted", muted);
      this.lcdIconMuteEl.classList.toggle("on", muted);
    });

    this.clearBtnEl.addEventListener("click", () => {
      if (this.options.onClearProbes) this.options.onClearProbes();
    });

    // Mozgatható fejléc (drag)
    const headerEl = this.container.querySelector<HTMLElement>(".unit-header")!;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let origLeft = 0;
    let origTop = 0;

    headerEl.addEventListener("pointerdown", (e) => {
      if ((e.target as HTMLElement).closest(".unit-close-btn")) return;
      dragging = true;
      const rect = this.container.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      origLeft = rect.left;
      origTop = rect.top;
      this.container.style.left = `${origLeft}px`;
      this.container.style.top = `${origTop}px`;
      this.container.style.bottom = "auto";
      this.container.style.right = "auto";
      try {
        headerEl.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    });

    headerEl.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const rect = this.container.getBoundingClientRect();
      const nextLeft = Math.max(8, Math.min(window.innerWidth - rect.width - 8, origLeft + (e.clientX - startX)));
      const nextTop = Math.max(54, Math.min(window.innerHeight - rect.height - 8, origTop + (e.clientY - startY)));
      this.container.style.left = `${nextLeft}px`;
      this.container.style.top = `${nextTop}px`;
    });

    const endDrag = () => {
      dragging = false;
    };
    headerEl.addEventListener("pointerup", endDrag);
    headerEl.addEventListener("pointercancel", endDrag);
  }

  private applyState(state: InstrumentPanelState): void {
    const { reading, blackProbe, redProbe, liveRedTarget } = state;

    // 1. Feszültség LED sáv frissítése
    const activeSteps = new Set(reading.ledSteps);
    for (const [step, el] of this.voltageLedEls.entries()) {
      el.classList.toggle("on", activeSteps.has(step));
    }

    // 2. Státusz LED-ek frissítése
    this.ledHvEl.classList.toggle("on", reading.singlePolePhase);
    this.ledAcEl.classList.toggle("on", reading.isAcVoltage);
    this.ledRxEl.classList.toggle("on", reading.continuity);
    this.ledRotLEl.classList.toggle("on", reading.phaseRotation === "L");
    this.ledRotREl.classList.toggle("on", reading.phaseRotation === "R");

    // 3. LCD háttérvilágítás és szimbólumok
    const isDanger = reading.voltage >= 50 || reading.singlePolePhase;
    this.lcdScreenEl.classList.toggle("lcd-danger", isDanger);
    this.lcdScreenEl.classList.toggle("lcd-continuity", !isDanger && reading.continuity);

    this.lcdIconAcEl.classList.toggle("on", reading.isAcVoltage);
    this.lcdIconHvEl.classList.toggle("on", reading.singlePolePhase);
    this.lcdIconRxEl.classList.toggle("on", reading.continuityActive);
    this.lcdIconRotREl.classList.toggle("on", reading.phaseRotation === "R");
    this.lcdIconRotLEl.classList.toggle("on", reading.phaseRotation === "L");
    this.lcdIconMuteEl.classList.toggle("on", this.buzzer.isMuted());

    this.lcdPrimaryEl.textContent = reading.lcdPrimary;
    this.lcdSecondaryEl.textContent = reading.lcdSecondary;

    // 4. Mérőtüskék állapotai
    if (blackProbe) {
      this.blackStatusEl.textContent = `📌 ${blackProbe.displayLabel}`;
      this.blackStatusEl.classList.add("pinned");
    } else {
      this.blackStatusEl.textContent = "Szabad — 1. kattintás lerakja";
      this.blackStatusEl.classList.remove("pinned");
    }

    if (redProbe) {
      this.redStatusEl.textContent = `📌 ${redProbe.displayLabel}`;
      this.redStatusEl.classList.add("pinned");
      this.redStatusEl.classList.remove("live");
    } else if (blackProbe && liveRedTarget) {
      this.redStatusEl.textContent = `Élő: ${liveRedTarget.displayLabel} (kattints = rögzít)`;
      this.redStatusEl.classList.remove("pinned");
      this.redStatusEl.classList.add("live");
    } else if (blackProbe) {
      this.redStatusEl.textContent = "Mozgasd mérési pontra (2. katt = rögzít)";
      this.redStatusEl.classList.remove("pinned", "live");
    } else {
      this.redStatusEl.textContent = "Várakozás a fekete tüskére";
      this.redStatusEl.classList.remove("pinned", "live");
    }

    // 5. Gombok és sípolás vezérlése
    this.clearBtnEl.disabled = !blackProbe && !redProbe;
    this.buzzer.setBeeping(reading.continuity);
  }
}
