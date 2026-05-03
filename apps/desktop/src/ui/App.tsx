import { useEffect, useMemo, useState } from "react";
import { GRID_WIDTH, type DeviceInput } from "@cellsymphony/device-contracts";
import { lifeBehavior } from "@cellsymphony/behaviors-life";
import {
  createInitialState,
  OLED_HEIGHT,
  OLED_WIDTH,
  routeInput,
  tick,
  toOledLines,
  toSimulatorFrame
} from "@cellsymphony/platform-core";
import { nativeAudioBridge } from "../audio/nativeAudioBridge";

const ENCODERS = [
  { id: "main", label: "SW1 Main", active: true },
  { id: "aux1", label: "SW2 Aux", active: false },
  { id: "aux2", label: "SW3 Aux", active: false },
  { id: "aux3", label: "SW4 Aux", active: false },
  { id: "aux4", label: "SW5 Aux", active: false }
] as const;

const NEOKEY_BUTTONS = [
  { input: { type: "button_a" } as DeviceInput, label: "A", active: true },
  { input: { type: "button_s" } as DeviceInput, label: "S", active: true },
  { input: { type: "button_shift" } as DeviceInput, label: "Shift", active: false },
  { input: { type: "button_fn" } as DeviceInput, label: "Fn", active: false }
];

export function App() {
  const behavior = useMemo(() => lifeBehavior, []);
  const [state, setState] = useState(() => createInitialState(behavior));
  const [paintMode, setPaintMode] = useState<boolean | null>(null);
  const [painted, setPainted] = useState<Set<string>>(new Set());

  const frame = useMemo(() => toSimulatorFrame(state, behavior), [state, behavior]);
  const oledLines = useMemo(() => toOledLines(frame.display), [frame.display]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setState((prev) => {
        const result = tick(prev, behavior);
        for (const event of result.events) {
          void nativeAudioBridge.trigger(event);
        }
        return result.state;
      });
    }, 150);
    return () => window.clearInterval(id);
  }, [behavior]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key;
      if (["ArrowLeft", "ArrowRight", "Enter", "a", "A", "s", "S"].includes(key)) {
        event.preventDefault();
      }
      if (key === "ArrowLeft") dispatch({ type: "encoder_turn", delta: -1, id: "main" });
      if (key === "ArrowRight") dispatch({ type: "encoder_turn", delta: 1, id: "main" });
      if (key === "Enter") dispatch({ type: "encoder_press", id: "main" });
      if (key === "a" || key === "A") dispatch({ type: "button_a" });
      if (key === "s" || key === "S") dispatch({ type: "button_s" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function dispatch(input: DeviceInput) {
    setState((prev) => routeInput(prev, input, behavior).state);
  }

  function cellAlive(index: number): boolean {
    const c = frame.leds.cells[index];
    return c.g > 100;
  }

  function applyPaint(x: number, y: number, desired: boolean) {
    const key = `${x}-${y}`;
    if (painted.has(key)) return;
    const index = y * GRID_WIDTH + x;
    if (cellAlive(index) !== desired) {
      dispatch({ type: "grid_press", x, y });
    }
    setPainted((prev) => new Set(prev).add(key));
  }

  function endPaint() {
    setPaintMode(null);
    setPainted(new Set());
  }

  return (
    <main className="app-shell" onMouseUp={endPaint} onMouseLeave={endPaint}>
      <header className="bar">Cell Symphony Hardware Simulator</header>
      <section className="panel-layout">
        <section className="left-rail">
          <section className="oled-wrap">
            <div className="oled-bezel">
              <div className="oled-panel" style={{ width: OLED_WIDTH, height: OLED_HEIGHT }}>
                {oledLines.map((line, index) => (
                  <p key={`oled-${index}`}>{line}</p>
                ))}
              </div>
            </div>
            <p className="meta">{frame.transport.playing ? "Playing" : "Stopped"} • {frame.transport.bpm} BPM</p>
          </section>

          <section className="encoder-grid">
            {ENCODERS.map((encoder) => (
              <article key={encoder.id} className="encoder-card">
                <h3>{encoder.label}</h3>
                <div className="encoder-buttons">
                  <button type="button" onClick={() => dispatch({ type: "encoder_turn", delta: -1, id: encoder.id })}>
                    L
                  </button>
                  <button type="button" onClick={() => dispatch({ type: "encoder_press", id: encoder.id })}>
                    Push
                  </button>
                  <button type="button" onClick={() => dispatch({ type: "encoder_turn", delta: 1, id: encoder.id })}>
                    R
                  </button>
                </div>
                {!encoder.active ? <small>Reserved</small> : <small>Menu Control</small>}
              </article>
            ))}
          </section>

          <section className="neokey-row">
            {NEOKEY_BUTTONS.map((button) => (
              <button key={button.label} type="button" onClick={() => dispatch(button.input)} className={button.active ? "active" : "reserved"}>
                {button.label}
              </button>
            ))}
          </section>
        </section>

        <section className="matrix-chassis" aria-label="8 by 8 matrix">
          <div className="matrix">
            {frame.leds.cells.map((cell, index) => {
              const x = index % GRID_WIDTH;
              const y = Math.floor(index / GRID_WIDTH);
              return (
                <button
                  key={`${x}-${y}`}
                  type="button"
                  aria-label={`Grid ${x},${y}`}
                  className="cell"
                  style={{ backgroundColor: `rgb(${cell.r}, ${cell.g}, ${cell.b})` }}
                  onMouseDown={() => {
                    const desired = !cellAlive(index);
                    setPaintMode(desired);
                    setPainted(new Set());
                    applyPaint(x, y, desired);
                  }}
                  onMouseEnter={(event) => {
                    if (paintMode === null || event.buttons !== 1) return;
                    applyPaint(x, y, paintMode);
                  }}
                  onClick={(event) => event.preventDefault()}
                />
              );
            })}
          </div>
        </section>
      </section>

      <footer className="bar footer">Arrows: SW1 turn • Enter: SW1 press • A/S keys mapped • Shift/Fn and SW2..SW5 reserved</footer>
    </main>
  );
}
