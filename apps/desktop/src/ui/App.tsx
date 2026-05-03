import { useEffect, useState } from "react";
import { GRID_WIDTH, type DeviceInput } from "@cellsymphony/device-contracts";
import { OLED_HEIGHT, OLED_WIDTH } from "@cellsymphony/platform-core";
import { mapKeyboardEventToInputAction, shouldPreventKeyboardDefault } from "../runtime/inputAdapters/keyboardAdapter";
import { sendEventsToAudio } from "../runtime/outputAdapters/audioSink";
import { createSimulatorRuntime } from "../runtime/simulatorRuntime";

const runtime = createSimulatorRuntime();

const ENCODERS = [
  { id: "main", label: "SW1 Main", active: true },
  { id: "aux1", label: "SW2 Aux", active: false },
  { id: "aux2", label: "SW3 Aux", active: false },
  { id: "aux3", label: "SW4 Aux", active: false },
  { id: "aux4", label: "SW5 Aux", active: false }
] as const;

const NEOKEY_BUTTONS = [
  { input: { type: "button_a" } as DeviceInput, label: "Back", key: "back" as const },
  { input: { type: "button_s" } as DeviceInput, label: "Space", key: "space" as const },
  { input: { type: "button_shift" } as DeviceInput, label: "Shift", key: "shift" as const },
  { input: { type: "button_fn" } as DeviceInput, label: "Fn", key: "fn" as const }
];

export function App() {
  const [snapshot, setSnapshot] = useState(() => runtime.getSnapshot());
  const [paintMode, setPaintMode] = useState<boolean | null>(null);
  const [painted, setPainted] = useState<Set<string>>(new Set());
  const frame = snapshot.frame;
  const oledLines = snapshot.oledLines;
  const isEventBlip = snapshot.transportIndicator.eventBlipUntilMs > Date.now();

  useEffect(() => {
    const unsubscribeState = runtime.subscribe(setSnapshot);
    const unsubscribeEvents = runtime.subscribeEvents((events) => {
      void sendEventsToAudio(events);
    });
    runtime.start();
    return () => {
      unsubscribeState();
      unsubscribeEvents();
      runtime.stop();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (shouldPreventKeyboardDefault(event)) {
        event.preventDefault();
      }
      const action = mapKeyboardEventToInputAction(event);
      if (action) runtime.dispatchAction(action);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function dispatch(input: DeviceInput) {
    runtime.dispatch(input);
  }

  function turnWithAcceleration(id: DeviceInput["id"], delta: -1 | 1, magnitude: number) {
    const turns = magnitude >= 90 ? 4 : magnitude >= 40 ? 2 : 1;
    for (let i = 0; i < turns; i += 1) {
      dispatch({ type: "encoder_turn", delta, id });
    }
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
                <div className={`transport-indicator ${snapshot.transportIndicator.flash}`}>
                  <span>{snapshot.transportIndicator.icon === "play" ? "▶" : "■"}</span>
                  <span className={`event-dot ${isEventBlip ? "on" : ""}`} />
                </div>
              </div>
            </div>
            <p className="meta">{frame.transport.playing ? "Playing" : "Stopped"} • {frame.transport.bpm} BPM</p>
          </section>

          <section className="encoder-grid">
            {ENCODERS.map((encoder) => (
              <article key={encoder.id} className="encoder-card">
                <h3>{encoder.label}</h3>
                <div
                  className="encoder-dial"
                  onWheel={(event) => {
                    event.preventDefault();
                    turnWithAcceleration(encoder.id, event.deltaY > 0 ? 1 : -1, Math.abs(event.deltaY));
                  }}
                >
                  <button type="button" className="encoder-center" onClick={() => dispatch({ type: "encoder_press", id: encoder.id })}>
                    Push
                  </button>
                </div>
                {!encoder.active ? <small>Reserved</small> : <small>Menu Control</small>}
              </article>
            ))}
          </section>

          <section className="neokey-row">
            {NEOKEY_BUTTONS.map((button) => (
              <button
                key={button.label}
                type="button"
                onClick={() => dispatch(button.input)}
                className={`neokey-${button.key} ${snapshot.neoKeyLeds[button.key]}`}
              >
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

      <footer className="bar footer">Arrows/Wheel: SW1 turn • Enter: SW1 press • Backspace: Back • Space: Play/Stop • Shift+Space: Brake</footer>
    </main>
  );
}
