import { useEffect, useMemo, useState } from "react";
import type { DeviceInput } from "@cellsymphony/device-contracts";
import { lifeBehavior } from "@cellsymphony/behaviors-life";
import { createInitialState, routeInput, tick, toSimulatorFrame } from "@cellsymphony/platform-core";
import { nativeAudioBridge } from "../audio/nativeAudioBridge";

export function App() {
  const behavior = useMemo(() => lifeBehavior, []);
  const [state, setState] = useState(() => createInitialState(behavior));
  const [paintMode, setPaintMode] = useState<boolean | null>(null);
  const [painted, setPainted] = useState<Set<string>>(new Set());

  const frame = useMemo(() => toSimulatorFrame(state, behavior), [state, behavior]);

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
      if (key === "ArrowLeft") dispatch({ type: "encoder_turn", delta: -1 });
      if (key === "ArrowRight") dispatch({ type: "encoder_turn", delta: 1 });
      if (key === "Enter") dispatch({ type: "encoder_press" });
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
    if (painted.has(key)) {
      return;
    }
    const index = y * 16 + x;
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
      <header className="bar">Cell Symphony Simulator</header>

      <section className="layout">
        <section className="controls">
          <button type="button" onClick={() => dispatch({ type: "encoder_turn", delta: -1 })}>
            Encoder Left
          </button>
          <button type="button" onClick={() => dispatch({ type: "encoder_press" })}>
            Encoder Press
          </button>
          <button type="button" onClick={() => dispatch({ type: "encoder_turn", delta: 1 })}>
            Encoder Right
          </button>
          <button type="button" onClick={() => dispatch({ type: "button_a" })}>
            A
          </button>
          <button type="button" onClick={() => dispatch({ type: "button_s" })}>
            S
          </button>
        </section>

        <section className="content">
          <section className="screen">
            <h1>{frame.display.title}</h1>
            <p>Page: {frame.display.page}</p>
            <p>Mode: {frame.display.editing ? "Edit" : "Select"}</p>
            {frame.display.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </section>

          <section className="matrix" aria-label="16 by 16 matrix">
            {frame.leds.cells.map((cell, index) => {
              const x = index % 16;
              const y = Math.floor(index / 16);
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
                    if (paintMode === null || event.buttons !== 1) {
                      return;
                    }
                    applyPaint(x, y, paintMode);
                  }}
                  onClick={(event) => event.preventDefault()}
                />
              );
            })}
          </section>
        </section>
      </section>

      <footer className="bar footer">Arrows: encoder, Enter: press, A: back, S: play/stop</footer>
    </main>
  );
}
