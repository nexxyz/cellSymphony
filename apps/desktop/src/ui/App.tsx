import { useEffect, useState } from "react";
import { GRID_WIDTH, type DeviceInput } from "@cellsymphony/device-contracts";
import { OLED_HEIGHT, OLED_WIDTH } from "@cellsymphony/platform-core";
import { mapKeyboardEventToInputAction, mapKeyboardKeyupToInputAction, shouldPreventKeyboardDefault } from "../runtime/inputAdapters/keyboardAdapter";
import { sendEventsToAudio } from "../runtime/outputAdapters/audioSink";
import { createSimulatorRuntime } from "../runtime/simulatorRuntime";

const runtime = createSimulatorRuntime();

const ENCODERS = [
  { id: "main", label: "SW1", active: true },
  { id: "aux1", label: "SW2", active: false },
  { id: "aux2", label: "SW3", active: false },
  { id: "aux3", label: "SW4", active: false },
  { id: "aux4", label: "SW5", active: false }
] as const;

const NEOKEY_BUTTONS = [
  { input: { type: "button_a" } as DeviceInput, label: "Back", key: "back" as const },
  { input: { type: "button_s" } as DeviceInput, label: "Space ▶/⏸", key: "space" as const },
  { input: { type: "button_shift" } as DeviceInput, label: "Shift", key: "shift" as const },
  { input: { type: "button_fn" } as DeviceInput, label: "Fn", key: "fn" as const }
];

export function App() {
  const [snapshot, setSnapshot] = useState(() => runtime.getSnapshot());
  const [paintMode, setPaintMode] = useState<boolean | null>(null);
  const [painted, setPainted] = useState<Set<string>>(new Set());
  const [dialDrag, setDialDrag] = useState<{ id: DeviceInput["id"]; y: number; acc: number } | null>(null);
  const [dialPhase, setDialPhase] = useState<Record<string, number>>({ main: 0, aux1: 0, aux2: 0, aux3: 0, aux4: 0 });
  const frame = snapshot.frame;
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
      if (shouldPreventKeyboardDefault(event)) event.preventDefault();
      const action = mapKeyboardEventToInputAction(event);
      if (!action) return;
      if (action.type === "device_input" && action.input.type === "encoder_turn") {
        bumpDialPhase(action.input.id, action.input.delta);
      }
      runtime.dispatchAction(action);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const action = mapKeyboardKeyupToInputAction(event);
      if (action) runtime.dispatchAction(action);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  });

  useEffect(() => {
    if (!dialDrag) return;
    const onMove = (event: MouseEvent) => {
      const deltaY = dialDrag.y - event.clientY;
      const nextAcc = dialDrag.acc + deltaY;
      if (Math.abs(nextAcc) < 12) {
        setDialDrag({ ...dialDrag, y: event.clientY, acc: nextAcc });
        return;
      }
      turnWithAcceleration(dialDrag.id, nextAcc > 0 ? 1 : -1, Math.abs(nextAcc));
      setDialDrag({ ...dialDrag, y: event.clientY, acc: 0 });
    };
    const onUp = () => setDialDrag(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dialDrag]);

  function dispatch(input: DeviceInput) {
    if (input.type === "encoder_turn") {
      bumpDialPhase(input.id, input.delta);
    }
    runtime.dispatch(input);
  }

  function bumpDialPhase(id: DeviceInput["id"], delta: -1 | 1) {
    const key = id ?? "main";
    setDialPhase((prev) => ({ ...prev, [key]: ((prev[key] ?? 0) + delta + 8) % 8 }));
  }

  function turnWithAcceleration(id: DeviceInput["id"], delta: -1 | 1, magnitude: number) {
    const turns = magnitude >= 90 ? 4 : magnitude >= 40 ? 2 : 1;
    for (let i = 0; i < turns; i += 1) dispatch({ type: "encoder_turn", delta, id });
  }

  function cellAlive(index: number): boolean {
    const c = frame.leds.cells[index];
    return c.g > 100;
  }

  function applyPaint(x: number, y: number, desired: boolean) {
    const key = `${x}-${y}`;
    if (painted.has(key)) return;
    const index = y * GRID_WIDTH + x;
    if (cellAlive(index) !== desired) dispatch({ type: "grid_press", x, y });
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
        <section className="control-grid">
          <article className="encoder-card sw1">
            <h3>{ENCODERS[0].label}</h3>
            <div
              className="encoder-dial"
              onMouseDown={(event) => {
                event.preventDefault();
                setDialDrag({ id: "main", y: event.clientY, acc: 0 });
              }}
              onWheel={(event) => {
                event.preventDefault();
                turnWithAcceleration("main", event.deltaY > 0 ? 1 : -1, Math.abs(event.deltaY));
              }}
            >
              <div className="encoder-ring" aria-hidden="true">
                {Array.from({ length: 8 }, (_, i) => (
                  <span
                    key={`main-tick-${i}`}
                    className={`encoder-tick ${i === (dialPhase.main ?? 0) ? "active" : ""}`}
                    style={{ transform: `translate(-50%, -50%) rotate(${i * 45}deg) translateY(-45px)` }}
                  />
                ))}
              </div>
              <button type="button" className="encoder-center" onClick={() => dispatch({ type: "encoder_press", id: "main" })}>
                Push
              </button>
            </div>
            <small>Menu Control</small>
          </article>

          <section className="oled-wrap">
            <div className="oled-bezel">
              <div className="oled-panel" style={{ width: OLED_WIDTH, height: OLED_HEIGHT }}>
                {snapshot.oledLines.map((line, index) => {
                  const selected = line.startsWith("@@");
                  const text = selected ? line.slice(2) : line;
                  return (
                    <p key={`oled-${index}`} className={selected ? "oled-selected" : ""}>
                      {text}
                    </p>
                  );
                })}
                <div className={`transport-indicator ${snapshot.transportIndicator.flash}`}>
                  {snapshot.transportIndicator.icon === "play" ? <span>▶</span> : snapshot.transportIndicator.icon === "stop" ? <span>■</span> : <span>⏸</span>}
                  <span className={`event-dot ${isEventBlip ? "on" : ""}`} />
                </div>
              </div>
            </div>
            <p className="meta">{frame.transport.playing ? "Playing" : "Paused"} • {frame.transport.bpm} BPM</p>
          </section>

          <article className="encoder-card sw2">
            <h3>{ENCODERS[1].label}</h3>
            <Dial id="aux1" phase={dialPhase.aux1 ?? 0} dispatch={dispatch} setDialDrag={setDialDrag} turnWithAcceleration={turnWithAcceleration} />
            <small>Reserved</small>
          </article>
          <article className="encoder-card sw3">
            <h3>{ENCODERS[2].label}</h3>
            <Dial id="aux2" phase={dialPhase.aux2 ?? 0} dispatch={dispatch} setDialDrag={setDialDrag} turnWithAcceleration={turnWithAcceleration} />
            <small>Reserved</small>
          </article>
          <section className="button-stack stack-a">
            {NEOKEY_BUTTONS.slice(0, 2).map((button) => (
              <NeoKey key={button.key} button={button} dispatch={dispatch} snapshot={snapshot} />
            ))}
          </section>

          <article className="encoder-card sw4">
            <h3>{ENCODERS[3].label}</h3>
            <Dial id="aux3" phase={dialPhase.aux3 ?? 0} dispatch={dispatch} setDialDrag={setDialDrag} turnWithAcceleration={turnWithAcceleration} />
            <small>Reserved</small>
          </article>
          <article className="encoder-card sw5">
            <h3>{ENCODERS[4].label}</h3>
            <Dial id="aux4" phase={dialPhase.aux4 ?? 0} dispatch={dispatch} setDialDrag={setDialDrag} turnWithAcceleration={turnWithAcceleration} />
            <small>Reserved</small>
          </article>
          <section className="button-stack stack-b">
            {NEOKEY_BUTTONS.slice(2).map((button) => (
              <NeoKey key={button.key} button={button} dispatch={dispatch} snapshot={snapshot} />
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

      <footer className="bar footer">Left/Right/Up/Down or Wheel: SW1 turn • Enter: SW1 press • Backspace: Back • Space: Play/Pause • Shift+Space: Stop</footer>
    </main>
  );
}

function Dial({
  id,
  phase,
  dispatch,
  setDialDrag,
  turnWithAcceleration
}: {
  id: DeviceInput["id"];
  phase: number;
  dispatch: (input: DeviceInput) => void;
  setDialDrag: (state: { id: DeviceInput["id"]; y: number; acc: number } | null) => void;
  turnWithAcceleration: (id: DeviceInput["id"], delta: -1 | 1, magnitude: number) => void;
}) {
  return (
    <div
      className="encoder-dial"
      onMouseDown={(event) => {
        event.preventDefault();
        setDialDrag({ id, y: event.clientY, acc: 0 });
      }}
      onWheel={(event) => {
        event.preventDefault();
        turnWithAcceleration(id, event.deltaY > 0 ? 1 : -1, Math.abs(event.deltaY));
      }}
    >
      <div className="encoder-ring" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <span
            key={`${id}-tick-${i}`}
            className={`encoder-tick ${i === phase ? "active" : ""}`}
            style={{ transform: `translate(-50%, -50%) rotate(${i * 45}deg) translateY(-45px)` }}
          />
        ))}
      </div>
      <button type="button" className="encoder-center" onClick={() => dispatch({ type: "encoder_press", id })}>
        Push
      </button>
    </div>
  );
}

function NeoKey({
  button,
  dispatch,
  snapshot
}: {
  button: (typeof NEOKEY_BUTTONS)[number];
  dispatch: (input: DeviceInput) => void;
  snapshot: ReturnType<typeof runtime.getSnapshot>;
}) {
  return (
    <button
      type="button"
      onClick={() => dispatch(button.input)}
      onMouseDown={() => {
        if (button.key === "shift") runtime.dispatchAction({ type: "shift", active: true });
      }}
      onMouseUp={() => {
        if (button.key === "shift") runtime.dispatchAction({ type: "shift", active: false });
      }}
      onMouseLeave={() => {
        if (button.key === "shift") runtime.dispatchAction({ type: "shift", active: false });
      }}
      className={`neokey-${button.key} ${snapshot.neoKeyLeds[button.key]}`}
    >
      {button.label}
    </button>
  );
}
