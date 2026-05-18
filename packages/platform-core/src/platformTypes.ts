import type { MappingConfig } from "@cellsymphony/mapping-core";
import type { TransportFrame } from "@cellsymphony/device-contracts";

export type ScanMode = "immediate" | "scanning";
export type ScanAxis = "rows" | "columns";
export type Direction = "forward" | "reverse";
export type NoteUnit = "1/16" | "1/8" | "1/4" | "1/2" | "1/1";
export type Curve = "linear" | "curve";
export type ScaleId = "chromatic" | "major" | "natural_minor" | "dorian" | "mixolydian" | "major_pentatonic" | "minor_pentatonic" | "harmonic_minor";
export type RootName = "C" | "C#" | "D" | "D#" | "E" | "F" | "F#" | "G" | "G#" | "A" | "A#" | "B";
type OutOfRangeMode = "clamp" | "wrap";
type PitchSettings = { startingNote: number; lowestNote: number; highestNote: number; outOfRange: OutOfRangeMode; scale: ScaleId; root: RootName };
type PitchLaneConfig = { enabled: boolean; steps: number };
export type ValueLaneConfig = { enabled: boolean; from: number; to: number; gridOffset: number; curve: Curve };
type AxisModConfig = { pitch: PitchLaneConfig; velocity: ValueLaneConfig; filterCutoff: ValueLaneConfig; filterResonance: ValueLaneConfig };

export type RuntimeConfig = {
  masterVolume: number; displayBrightness: number; gridBrightness: number; buttonBrightness: number; screenSleepSeconds: number;
  midi: { enabled: boolean; outId: string | null; clockOutEnabled: boolean; inId: string | null; clockInEnabled: boolean; syncMode: "internal" | "external"; respondToStartStop: boolean };
  sound: { noteLengthMs: number; velocityScalePct: number; velocityCurve: "linear" | "soft" | "hard" };
  scanMode: ScanMode; scanAxis: ScanAxis; scanUnit: NoteUnit; scanDirection: Direction; algorithmStepUnit: NoteUnit;
  activeBehavior: string; autoSaveDefault: boolean; behaviorConfig: Record<string, unknown>; eventEnabled: boolean; eventParity: "none" | "activate_even_deactivate_odd"; stateEnabled: boolean;
  pitch: PitchSettings; x: AxisModConfig; y: AxisModConfig;
};

export type ActionSpec =
  | { type: "refresh_presets" } | { type: "preset_save_current" } | { type: "preset_save" }
  | { type: "preset_load"; name: string } | { type: "preset_delete"; name: string }
  | { type: "preset_rename_pick"; name: string } | { type: "preset_rename_apply" }
  | { type: "default_save" } | { type: "default_load" } | { type: "factory_load" }
  | { type: "midi_select_output"; id: string | null } | { type: "midi_select_input"; id: string | null }
  | { type: "midi_panic" } | { type: "behavior_action"; behaviorId: string; actionType: string };

export type MenuState = { stack: number[]; cursor: number; editing: boolean };
export type ConfigPayload = { activeBehavior: string; runtimeConfig: RuntimeConfig; mappingConfig: MappingConfig };
export type ConfirmKind = "overwrite_preset" | "delete_preset" | "rename_preset" | "load_preset" | "load_default" | "load_factory" | "save_default" | "text_dirty_exit" | "midi_panic" | "aux_unbind" | "help_info";
type TextConfirmMode = "save" | "discard";
export type PendingAction =
  | { kind: "preset_save"; name: string } | { kind: "preset_delete"; name: string } | { kind: "preset_load"; name: string }
  | { kind: "preset_rename"; from: string; to: string } | { kind: "default_save" } | { kind: "default_load" } | { kind: "factory_load" } | { kind: "midi_panic" }
  | { kind: "aux_unbind"; encoderId: string } | { kind: "help_info"; title: string; lines: string[] }
  | { kind: "text_dirty_exit"; key: string; original: string; saveAction?: ActionSpec; backAfter: boolean; mode: TextConfirmMode };
export type ConfirmState = { kind: ConfirmKind; action: PendingAction; cursor: number; options: string[]; scroll: number };
export type TextEditSession = { key: string; original: string; saveAction?: ActionSpec };
type ToastState = { message: string; untilMs: number };
export type MidiPortInfo = { id: string; name: string };
export type AuxTurnBinding = { key: string; label?: string; kind: "number" | "enum" | "bool"; min?: number; max?: number; step?: number; options?: string[] };
export type AuxPressBinding = { actionType: string; routeKey?: string; label?: string };
export type AuxBinding = { turn: AuxTurnBinding | null; press: AuxPressBinding | null };
export type SystemState = {
  shiftHeld: boolean; fnHeld: boolean; presetNames: string[]; selectedPreset: string | null; currentPresetName: string | null; draftName: string; nameCursor: number;
  pendingRename: { from: string; to: string } | null; confirm: ConfirmState | null; toast: ToastState | null; eventBlipUntilMs: number; stopLatched: boolean;
  transportFlash: "none" | "beat" | "measure"; transportFlashUntilMs: number; textEdit: TextEditSession | null;
  midiOutputs: MidiPortInfo[]; midiInputs: MidiPortInfo[]; midiStatus: string | null; externalPpqnPulse: number; pendingResync: boolean; pausedByUser: boolean;
  oledMode: "normal" | "splash" | "off"; oledSplashText: string; oledSplashUntilMs: number; lastInteractionMs: number; auxBindings: Record<string, AuxBinding | null>;
};

export type PlatformEffectBase =
  | { type: "store_list_presets" } | { type: "store_load_preset"; name: string } | { type: "store_save_preset"; name: string; payload: ConfigPayload }
  | { type: "store_delete_preset"; name: string } | { type: "store_load_default" } | { type: "store_save_default"; payload: ConfigPayload };
export type MidiEffect =
  | { type: "midi_list_outputs_request" } | { type: "midi_list_inputs_request" }
  | { type: "midi_select_output"; id: string | null } | { type: "midi_select_input"; id: string | null } | { type: "midi_panic" };
export type PlatformEffect = PlatformEffectBase | MidiEffect;
export type StoreResultBase =
  | { type: "list_presets_result"; names: string[] } | { type: "load_preset_result"; name: string; payload: ConfigPayload | null }
  | { type: "save_preset_result"; name: string; outcome: "created" | "overwritten" } | { type: "delete_preset_result"; name: string; ok: boolean }
  | { type: "load_default_result"; payload: ConfigPayload | null } | { type: "save_default_result"; ok: boolean } | { type: "store_error"; message: string };
export type MidiResult =
  | { type: "midi_list_outputs_result"; outputs: MidiPortInfo[] }
  | { type: "midi_list_inputs_result"; inputs: MidiPortInfo[] }
  | { type: "midi_status"; ok: boolean; message?: string; selectedOutId?: string | null; selectedInId?: string | null };
export type StoreResult = StoreResultBase | MidiResult;

export type PlatformState<TState> = {
  transport: TransportFrame; behaviorState: TState; activeBehavior: string; mappingConfig: MappingConfig; runtimeConfig: RuntimeConfig; menu: MenuState; system: SystemState;
  scanIndex: number; scanPulseAccumulator: number; algorithmPulseAccumulator: number; ppqnPulseRemainder: number;
};

export type MenuNode =
  | { kind: "group"; label: string; children: MenuNode[] | ((state: PlatformState<any>) => MenuNode[]); visible?: (c: RuntimeConfig) => boolean }
  | { kind: "enum"; label: string; key: string; options: string[]; visible?: (c: RuntimeConfig) => boolean }
  | { kind: "number"; label: string; key: string; min: number; max: number; step: number; visible?: (c: RuntimeConfig) => boolean }
  | { kind: "bool"; label: string; key: string; visible?: (c: RuntimeConfig) => boolean }
  | { kind: "action"; label: string; action: ActionSpec }
  | { kind: "text"; label: string; key: string; maxLen: number; onExitSaveAction?: ActionSpec }
  | { kind: "spacer" };

export const OLED_WIDTH = 128;
export const OLED_HEIGHT = 128;
export const OLED_TEXT_COLUMNS = 20;
export const OLED_TEXT_LINES = 8;
