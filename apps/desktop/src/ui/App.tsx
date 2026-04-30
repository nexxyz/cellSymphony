import { useEffect, useMemo, useState } from "react";
import type { DeviceInput } from "@cellsymphony/device-contracts";
import { lifeBehavior } from "@cellsymphony/behaviors-life";
import { createInitialState, routeInput, tick, toSimulatorFrame } from "@cellsymphony/platform-core";

export function App() {
  const behavior = useMemo(() => lifeBehavior, []);
  const [state, setState] = useState(() => createInitialState(behavior));

  const frame = useMemo(() => toSimulatorFrame(state, behavior), [state, behavior]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setState((prev) => tick(prev, behavior).state);
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

  return (
    <main className="layout">
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
              onClick={() => dispatch({ type: "grid_press", x, y })}
            />
          );
        })}
      </section>

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
    </main>
  );
}
