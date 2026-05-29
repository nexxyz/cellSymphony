export function sanitizeAuxBindings(raw: any): Record<string, any> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, any> = {};
  for (const id of ["aux1", "aux2", "aux3", "aux4"]) {
    const b = (raw as any)[id];
    if (b === null || b === undefined) {
      out[id] = null;
      continue;
    }
    const turn = (b as any).turn ?? null;
    const press = (b as any).press ?? null;
    out[id] = {
      turn: turn && typeof turn.key === "string" ? structuredClone(turn) : null,
      press: press && (press.kind === "behavior_action" || press.kind === "menu_action") ? structuredClone(press) : null
    };
  }
  return out;
}

export function cloneAuxBindings(raw: any): Record<string, any> {
  return structuredClone((raw ?? {}) as any);
}
