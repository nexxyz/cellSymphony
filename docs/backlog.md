# Backlog — Cell Symphony

> Central requirement backlog. Status: `open` | `in-progress` | `closed`.
> Each phase must be completed and manually tested before moving to the next.

---

## Phase 1: Quality & Consistency

*Foundation — fix issues, standardize, polish. No new features.*

---

### REQ-09 — Duck Self-Reference Prevention

| Field | Value |
|-------|-------|
| **Status** | open |
| **Phase** | 1 |
| **Priority** | high |
| **Scope** | tiny |
| **Depends on** | — |
| **Source** | line 60 |

Prevent selecting the current FX bus as its own duck source to avoid cyclic routing.

**Decision:** Block new cyclic assignments only. Do not auto-clear existing cyclic configs on load — old configs that happen to be cyclic simply won't route (no audio feedback). No broader routing validation needed.

**Acceptance:**
- When editing duck source on an FX bus, the bus itself is not listed as an option (or selecting it is rejected).
- Existing cyclic configs remain in data but produce no routing / no audio feedback loop.

---

### REQ-12 — "none" Options + Naming Standardization

| Field | Value |
|-------|-------|
| **Status** | open |
| **Phase** | 1 |
| **Priority** | high |
| **Scope** | small |
| **Depends on** | — |
| **Source** | lines 80–81, 85 |

Add "none" instrument type. Add "none" for all no-op selectable elements where non-destructive. Standardize naming: use "none" everywhere, never "no scan" or similar variants.

**"none" instrument semantics:** Consumes a slot, has configurable FX bus routing, produces silence. Visible in lists, appears as a routing target, but generates no audio.

**Acceptance:**
- Instrument type `"none"` exists — silent placeholder, consumes slot, has FX bus config.
- Every enum/dropdown with a no-op uses label `"none"` (not `"no scan"`, `"off"`, `"disabled"` etc.).
- Existing `"no scan"` (and similar) values are migrated to `"none"`.

---

### REQ-16 — Parameter Range Standardization

| Field | Value |
|-------|-------|
| **Status** | open |
| **Phase** | 1 |
| **Priority** | medium |
| **Scope** | medium |
| **Depends on** | — |
| **Source** | line 123 |

Replace unusable raw technical values with reasonable editor ranges. Remap display values only — engine keeps internal units. Old saves remain compatible.

**Strategy:**
- **Unit in the label** for parameters where the unit is meaningful: delay times, envelope attack/decay/release, note length, compressor/duck attack/release, BPM, dB thresholds/gains, screen sleep, MIDI velocity. The value shown is always just a number. No dynamic unit conversion needed.
- **Abstract 0–255** for parameters where the unit is not meaningful to the user: filter cutoff, resonance, envelope amounts, key tracking, all EQ params (gains mapped to ±12 dB, mid freq mapped logarithmically 40–8000 Hz, Q mapped to 0.25–20), filter LFO center frequency, LFO rates, FX dimensionless values (drive, feedback, Q, threshold, decay, etc.), behaviour tick counts/spawn intervals, L2 modulation values.

**Acceptance:**
- Filter cutoff uses 0–255 range in menu/encoder; translated to Hz internally.
- All numeric parameters reviewed for usability — no values that require hundreds of encoder clicks to traverse.
- Hard-unit parameters (ms, dB, BPM) keep the unit in the label, value is a plain number.
- Abstract/dimensionless parameters migrated to 0–255.
- Encoder acceleration + shift+turn for coarse adjust across all numeric params.

---

### REQ-11 — Quality Pass

| Field | Value |
|-------|-------|
| **Status** | open |
| **Phase** | 1 |
| **Priority** | high |
| **Scope** | medium-large |
| **Depends on** | — |
| **Source** | lines 68–76 |

Code quality improvement pass across the codebase. Both targeted hotspot cleanup and broad sweep.

**Targeted hotspots (priority order):**

| # | File | Issues |
|---|------|--------|
| 1 | `storeRuntime.ts` | `sanitizePayload` 231 lines / 124 `as any`; `applyStoreResult` 14-branch pattern match |
| 2 | `inputRouter.ts` | `routeInputWithDeps` 247 lines; 3 functions duplicated with `transportRuntime.ts` |
| 3 | `stateHelpers.ts` | `applyAutoName` 9 manual blocks → data-driven loop; `writeAnyValue` duplicate normalizations |
| 4 | `simulatorRuntime.ts` | 531-line factory closure; 15-branch `execEffect`; magic MIDI hex bytes |
| 5 | `transportRuntime.ts` | Dedupe with inputRouter; `toRuntimeConfigForPart` ternary nesting |
| 6 | `menuTree.ts` | 200+ lines structural duplication in synth/sample instrument trees |
| 7 | `fxBusMenu.ts` | 15 repeated effect-type blocks → data-driven from effect→params map |
| 8 | `coreUtils.ts` | `formatDisplayValue` 18-branch if/else → `Map` lookup |
| 9 | `App.tsx` | Inline magic numbers; NeoKey event handler dedup |
| 10 | `initialState.ts` | ~20 magic numbers → named constants shared with storeRuntime/musicTransforms |

**Cross-cutting deduplication targets:**
- Velocity defaults (120/85/45) duplicated across `initialState.ts`, `storeRuntime.ts`, `musicTransforms.ts`
- `noteBehavior`/`profileFromConfig`/`withScaleSteps` duplicated across `inputRouter.ts` and `transportRuntime.ts`
- 5-way mapping trigger pattern (activate/stable/deactivate/scanned/scanned_empty) duplicated across 3 files

**Acceptance:**
- Magic numbers/strings extracted to named constants (local `const` minimum; parameters into config/capabilities).
- High-complexity functions (cyclomatic, LOC) refactored or broken down.
- Duplicate logic eliminated; repeated operational patterns centralized behind helpers.
- Uncritical "close enough" parameter values normalised to helper defaults unless semantically meaningful.
- Code smells addressed (long parameter lists, mutable shared state, etc.).
- Pragmatic design patterns applied where they reduce complexity.

---

## Phase 2: Menu, Navigation & Defaults

*Structural improvements to how users find and manage things.*

---

### REQ-13 — Menu Cleanup

| Field | Value |
|-------|-------|
| **Status** | open |
| **Phase** | 2 |
| **Priority** | high |
| **Scope** | medium |
| **Depends on** | REQ-11 (clean base to work from) |
| **Source** | lines 84–88 |

Consistent, well-ordered menus.

**Acceptance:**
- Important parameters first (e.g. Mixer above MIDI in instrument menu). Research typical synth/audio UI ordering and apply.
- Part selection is list-based (same pattern as instruments and FX buses) — each part shown as a named entry in a submenu. Selecting one in the menu selects that part and enters that part's life/sense config in the menu.
- Bus names are displayed in the bus selection list (not just "Bus 1"–"Bus 4").
- Name setting lives inside the bus config, not outside it.

---

### REQ-01 — Clone/Reset Part

| Field | Value |
|-------|-------|
| **Status** | open |
| **Phase** | 2 |
| **Priority** | medium |
| **Scope** | small |
| **Depends on** | — |
| **Source** | line 2 |

Clone a part (duplicate its behaviour, mapping, triggers) or delete/reset it, via grid interaction. All 8 (or max) part slots always exist.

**Interaction:**
- **Clone:** FN+SHIFT+rightmost column of source part → release → press target part's column. Target part receives a copy of source's full config (behaviour, grid, mapping, triggers).
- **Delete/Reset:** FN+SHIFT+BACK (back button) on the selected part → sets it to no-op defaults (grid cleared, behaviour "none", sense "none", no mappings).

**Acceptance:**
- Clone duplicates all part config: behaviour type + params, grid cells, trigger mappings, scan settings.
- Delete/Reset sets part to complete no-op defaults (no grid state, behaviour "none", no triggers).
- All parts remain in the parts list; no slot creation or removal.

---

### REQ-02 — Clone/Reset Instrument

| Field | Value |
|-------|-------|
| **Status** | open |
| **Phase** | 2 |
| **Priority** | medium |
| **Scope** | small |
| **Depends on** | REQ-13 (menu structure for the action) |
| **Source** | line 3 |

Clone an instrument (duplicate its type, preset, FX routing) or reset it to defaults. Menu-based action inside the instrument's config menu.

**Acceptance:**
- Instrument config menu has "Clone" action — creates a new instrument with identical type, preset, FX bus assignment, and aux send settings.
- Instrument config menu has "Reset" action — restores instrument to factory defaults (type "none", no routing).
- "Clone" appends to the instruments list (uses the first available "none" slot, or adds if all full).

---

### REQ-14 — Factory Reset Defaults

| Field | Value |
|-------|-------|
| **Status** | open |
| **Phase** | 2 |
| **Priority** | medium |
| **Scope** | small |
| **Depends on** | REQ-12 ("none" instrument type), REQ-11 (clean base) |
| **Source** | lines 92–106 |

On factory reset: 2 active parts, rest "none".

**Acceptance:**
- P1: behaviour=life, auto-spawn=12, activate→I1 (synth with nice preset), routed→FX Bus 1 (delay + duck sourcing I2).
- P2: behaviour=sequencer with cells from current default preset, horizontal scan, scanned→I2 (drum kit from current default preset), routed direct.
- All other parts (P3–P8): behaviour "none", no triggers.
- All other instruments (I3–I8): type "none".
- All other FX buses: no effects, no duck.

**P2/I2 details:** Use current default preset content for sequencer cell pattern, sample assignments, and drum mappings.

---

### REQ-10 — Audio Load Indicator

| Field | Value |
|-------|-------|
| **Status** | open |
| **Phase** | 2 |
| **Priority** | low |
| **Scope** | small |
| **Depends on** | IPC infra: Rust→TS `"audio_load"` event channel (built in this phase before the indicator) |
| **Source** | line 64 |

Audio DSP load / voice-steal indicator in top-right corner of OLED display.

**Infrastructure needed (do first):** No existing load reporting IPC. Must add:
- Back-channel from `rodio-engine-source` (where `smoothed_load_ratio` is computed) → Tauri audio thread → `app.emit("audio_load", { ratio, voiceSteal })`.
- Follow existing `"midi_in"` event pattern.

**Acceptance:**
- Yellow indicator when DSP load moderate or voice stealing active.
- Red indicator when load heavy.
- Nothing displayed when idle.

---

## Phase 3: Grid & Scan

*Enhancements to grid display and scanning engine.*

---

### REQ-03 — Ghost Cells

| Field | Value |
|-------|-------|
| **Status** | open |
| **Phase** | 3 |
| **Priority** | medium |
| **Scope** | small-medium |
| **Depends on** | — |
| **Source** | line 7 |

Show dimmed/ghosted cells from inactive parts on the grid, toggleable.

**Acceptance:**
- When viewing a part, cells active on other parts appear at drastically reduced brightness.
- Toggle in runtime config to enable/disable ghost cells.
- Off by default (clarity first).

---

### REQ-04 — Section Scan Mode

| Field | Value |
|-------|-------|
| **Status** | open |
| **Phase** | 3 |
| **Priority** | medium |
| **Scope** | medium |
| **Depends on** | — |
| **Source** | lines 11–16 |

Add "Section Size" parameter (1, 2, 4, 8) to scan behaviour. Scan ray is `n` cells wide, moves along axis, steps by `n` on wrap. When last section reached, reset to origin. Stop resets to origin.

Also add per-section note mapping: restart note mapping from "First note" after each section boundary (configurable per axis), enabling longer melodies with limited note range.

**Worked example:** 8×8 grid, horizontal scan, section size 4 → 2 lanes of 4×8. Lane 1 scans rows 0–3 left-to-right (8 steps), then lane 2 scans rows 4–7 left-to-right (8 steps). Total: 16 scan steps. Note mapping restarts from First Note at each lane boundary — same 8 notes play in each lane, but on different grid rows.

**Acceptance:**
- Scan behaviour has Section Size parameter (powers of 2, default 1 = current behaviour).
- Scanning progresses in lanes of width n, covering all cells sequentially.
- Stop resets scan to origin.
- Note mapping can restart per section (configurable toggle per axis).

---

## Phase 4: Performance & Effects (L4)

*New L4: Touch/Performance layer, grid-triggered effects, master FX, aux integration, signal viz.*

---

### REQ-07 — L4: Touch / Performance Layer

| Field | Value |
|-------|-------|
| **Status** | open |
| **Phase** | 4 |
| **Priority** | high |
| **Scope** | medium |
| **Depends on** | REQ-13 (menu hooks for new layer) |
| **Source** | lines 36–39 |

New L4 layer: "Touch" / "Performance". Contains grid-mode pages (switched via rightmost column) for mixing, panning, and momentary effects, plus BPM as a regular menu parameter.

**Pages (grid modes):**
- **Mix (volume/mute):** Each row/column = an instrument. Y axis = volume (bottom row = mute, top row = max volume). Direct-instrument marker colour = green. FX-bus-routed marker colour = purple.
- **Pan:** Each row/column = an instrument. X axis = pan position (left→right).
- **Momentary FX:** Grid cells trigger effects per REQ-06.

**Navigation:** FN+rightmost column jumps to Touch from any layer. Within Touch, rightmost column switches between pages (rows = pages).

**Aux encoders:** User-mapped assignments stay active across all Touch pages.

**BPM:** Regular menu parameter in the Touch section (not a grid mode). Assignable to encoders like any other parameter.

**Acceptance:**
- L4 appears in layer navigation labelled "Touch".
- Rightmost column switches pages: Mix, Pan, FX.
- Mix page: volume grid mode with mute at bottom. Green marker for direct, purple for FX-bus.
- Pan page: pan position grid mode.
- BPM parameter exists in Touch menu section.
- FN+rightmost column jumps to Touch from any layer.
- Aux encoder mappings work consistently across all Touch pages.

---

### REQ-06 — Grid-Triggered Momentary Effects

| Field | Value |
|-------|-------|
| **Status** | open |
| **Phase** | 4 |
| **Priority** | high |
| **Scope** | large |
| **Depends on** | REQ-07 (L4 structure with FX page) |
| **Source** | lines 26–35 |

Assign momentary effects to grid cells in the Touch FX page. All effects are momentary (active only while held). Effects: stutter, freeze (floating hold with reverb), filter-sweep (closing filter + resonance fade-in, fade-out on release), pitch shift.

**Concurrency rules:**
- Max concurrent effects = capability setting (default 4, configurable).
- When all slots full, remaining active cells gray out and do not respond to press until a slot frees.
- Same effect type pressed while already active: new press takes over, old cell "released" even if still held. (You cannot have two stutters active simultaneously, but pressing a second stutter cell replaces the first.)
- Each effect type has its own identifying colour (palette chosen during design proposal — keep in mind more types may be added later).

**Target:** Each effect assigned per cell with target (global output, specific instrument, or FX bus) and configurable parameters.

**Acceptance:**
- All effects momentary (on while held, off on release).
- Max concurrent effects enforced by capability setting.
- Grayed-out cells unresponsive when all slots exhausted.
- Same-type press replaces existing (old cell released).
- Effect types have distinct identifying grid colours.
- Filter-sweep fades in on press, fades out on release.
- Reuse existing filter/FX code where overlapping.

---

### REQ-05 — Global FX (Master Bus)

| Field | Value |
|-------|-------|
| **Status** | open |
| **Phase** | 4 |
| **Priority** | medium |
| **Scope** | medium |
| **Depends on** | REQ-07 (L3 Voice area as parent) |
| **Source** | lines 19–23 |

Add master/global FX section in L3:Voice parallel to Instruments. Post-instrument/pre-output. Effects: vinyl simulator (warm saturation, crackling, uneven/warped pitch), EQ, compressor.

**Acceptance:**
- Global FX section in L3:Voice, operates post-instrument/pre-output.
- Vinyl simulator: saturation amount, crackle level, warp depth.
- EQ: low/mid/high bands or parametric.
- Compressor: threshold, ratio, attack, release, gain makeup.
- Reuse existing FX infrastructure, refactor where overlapping (no separate filter implementations).

---

### REQ-08 — Aux Encoder Mapping in Performance

| Field | Value |
|-------|-------|
| **Status** | open |
| **Phase** | 4 |
| **Priority** | medium |
| **Scope** | medium |
| **Depends on** | REQ-07 (Performance area exists) + design proposal (see below) |
| **Source** | lines 42–48 |

Aux encoders auto-map to important numeric values, enum selections, and actions for the current context in Touch area. Show mapping indicators on OLED. Outside Touch area, aux encoders do nothing.

**Prerequisite:** Write a design proposal/doc covering:
- How "most important" params are determined per context (menu node metadata? whitelist per node type?)
- OLED indicator rendering: labels per aux slot, position on screen
- How manual user binding interacts with auto-mapping
- Edge cases: nested menus, empty groups, no eligible params
- Mapping persistence: are auto-mappings saved per context, or re-derived each time?

**Acceptance:**
- When entering instrument/effect/behaviour detail in Touch area, aux encoders map to the important tweakable parameters.
- Mapping indicators visible on OLED (labels per aux slot).
- Enables intuitive live tweaking without menu diving.
- Outside Touch area, aux encoders do nothing.
- Proposal reviewed and approved before implementation begins.

---

### REQ-15 — Signal Path Visualization

| Field | Value |
|-------|-------|
| **Status** | open |
| **Phase** | 4 |
| **Priority** | low |
| **Scope** | medium |
| **Depends on** | REQ-07 + REQ-06 + REQ-05 (routing fully defined) |
| **Source** | lines 109–118 |

OLED graphical display of signal/routing paths: parts → instruments → FX buses → output.

**Layout rules:**
- Always show only active routes — entities with "none" or no mappings are hidden.
- When diagram becomes too crowded for the 128×64 OLED, abbreviate names to compact IDs (e.g. "I1" instead of "I1: Drums", "P1" instead of "P1: Atmosphere", "dk" for duck, "rv" for reverb). No scrolling needed — simplify first.
- Auto-layout from top to bottom: Parts → Instruments → FX Buses → Output.
- Navigable: highlight a box via encoder, press to enter that entity's menu.

**Acceptance:**
- Shows active part→instrument→FX routing as boxes/arrows on OLED.
- "None" entities hidden.
- Crowded diagrams use abbreviated IDs instead of full names.
- Navigable: highlight and click to enter entity config.
- Fits on OLED at readable scale for typical use-cases (2–4 parts, 2–4 instruments, 1–2 buses).

---

## Phase 5: Advanced / Hardware

*Hardware-specific features and tooling.*

---

### REQ-17 — Hardware Test Harness

| Field | Value |
|-------|-------|
| **Status** | open |
| **Phase** | 5 |
| **Priority** | medium |
| **Scope** | medium |
| **Depends on** | — |
| **Source** | line 52 |

Tool launched on Raspberry Pi that guides through testing every button, grid element, encoder, and audio output — to verify hardware assembly per PCB design. *(Placeholder — details to be specified at Phase 5.)*

**Acceptance:**
- Step-by-step guided tests: "Press button A1", "Turn encoder 1 clockwise", etc.
- Grid: "Tap each cell", "Verify colour X at Y,Z".
- Audio: play back a test sample through output.
- Reports pass/fail per test.

---

### REQ-18 — Over-the-Air Updates

| Field | Value |
|-------|-------|
| **Status** | open |
| **Phase** | 5 |
| **Priority** | low |
| **Scope** | small |
| **Depends on** | — |
| **Source** | line 56 |

"Update from GitHub" function on hardware — fast, dynamic update to latest firmware/software. *(Placeholder — details to be specified at Phase 5.)*

**Acceptance:**
- Single action triggers check for updates from GitHub.
- Downloads and applies update automatically.
- Rollback on failure.
- Progress indication on OLED.
