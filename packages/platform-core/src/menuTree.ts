import { listBehaviorIds, type BehaviorEngine } from "@cellsymphony/behavior-api";
import type { MenuNode, PlatformState } from "./index";
import { SYNTH_PRESETS } from "./synthPresets";
import { clampSampleSlotIndex, instrumentIndexOptions, partIndexOptions, PLATFORM_CAPS, sampleSlotOptions } from "./platformCaps";

type MenuTreeDeps<TState> = {
  resolveBehavior: (id: string) => BehaviorEngine<any, any>;
  axisGroup: (label: string, prefix: string, defaultStep: number) => MenuNode;
  presetListNodes: (state: PlatformState<TState>, mode: "load" | "delete") => MenuNode[];
  presetRenameNodes: (state: PlatformState<TState>) => MenuNode[];
  midiOutputNodes: (state: PlatformState<TState>) => MenuNode[];
  midiInputNodes: (state: PlatformState<TState>) => MenuNode[];
  sampleBrowserNodes: (state: PlatformState<TState>, instrumentSlot: number, sampleSlot: number) => MenuNode[];
};

export function buildMenuTree<TState>(state: PlatformState<TState>, deps: MenuTreeDeps<TState>): MenuNode {
  const partOptions = partIndexOptions();
  const activePartIndex = Math.max(0, Math.min(partOptions.length - 1, Number((state.runtimeConfig as any).activePartIndex ?? 0)));
  const partPrefix = `parts.${activePartIndex}`;
  const activePart: any = (state.runtimeConfig as any).parts?.[activePartIndex] ?? null;
  const activeBehaviorId = String(activePart?.l1?.behaviorId ?? state.runtimeConfig.activeBehavior);
  const activeEngine = deps.resolveBehavior(activeBehaviorId);
  const instrumentSlotOptions = instrumentIndexOptions();
  const sampleSlots = sampleSlotOptions();

  const instrumentLabel = (idx: number): string => {
    const inst: any = (state.runtimeConfig as any).instruments?.[idx] ?? {};
    const typeLabel = inst.type === "midi" ? "MIDI" : inst.type === "sample" ? "sample" : "synth";
    const mode = String(inst.nameMode ?? "auto");
    const custom = typeof inst.customName === "string" ? inst.customName.trim() : "";
    if (mode === "drums") return `I${idx + 1}: Drums`;
    if (mode === "pad") return `I${idx + 1}: Pad`;
    if (mode === "lead") return `I${idx + 1}: Lead`;
    if (mode === "bass") return `I${idx + 1}: Bass`;
    if (mode === "fx") return `I${idx + 1}: FX`;
    if (mode === "custom" && custom.length > 0) return `I${idx + 1}: ${custom}`;
    return `I${idx + 1}: ${typeLabel}`;
  };
  const behaviorConfigNodes: MenuNode[] = [];
  if (activeEngine.configMenu) {
    const items = activeEngine.configMenu(state.behaviorState as any);
    for (const item of items) {
      if (item.type === "number") {
        behaviorConfigNodes.push({ kind: "number", label: item.label, key: `${partPrefix}.l1.behaviorConfig.${item.key}`, min: item.min ?? 0, max: item.max ?? 127, step: item.step ?? 1 });
      } else if (item.type === "bool") {
        behaviorConfigNodes.push({ kind: "bool", label: item.label, key: `${partPrefix}.l1.behaviorConfig.${item.key}` });
      } else if (item.type === "enum") {
        behaviorConfigNodes.push({ kind: "enum", label: item.label, key: `${partPrefix}.l1.behaviorConfig.${item.key}`, options: item.options ?? [] });
      } else if (item.type === "action") {
        behaviorConfigNodes.push({ kind: "action", label: item.label, action: { type: "behavior_action", behaviorId: activeEngine.id, actionType: item.key } });
      }
    }
  }

  return {
    kind: "group",
    label: "Root",
    children: [
      { kind: "group", label: "L1: Life", children: [{ kind: "enum", label: "Part", key: "activePartIndex", options: partOptions }, { kind: "bool", label: "Save Grid State", key: `${partPrefix}.l1.saveGridState` }, { kind: "enum", label: "Step Rate", key: `${partPrefix}.l1.stepRate`, options: ["1/16", "1/8", "1/4", "1/2", "1/1"] }, { kind: "enum", label: "Behavior", key: `${partPrefix}.l1.behaviorId`, options: listBehaviorIds() }, ...behaviorConfigNodes] },
      {
        kind: "group",
        label: "L2: Sense",
        children: [
          { kind: "enum", label: "Part", key: "activePartIndex", options: partOptions },
          { kind: "enum", label: "Scan Mode", key: `${partPrefix}.l2.scanMode`, options: ["immediate", "scanning"] },
          { kind: "enum", label: "Scan Axis", key: `${partPrefix}.l2.scanAxis`, options: ["rows", "columns"], visible: (c: any) => c.parts?.[activePartIndex]?.l2?.scanMode === "scanning" },
          { kind: "enum", label: "Scan Unit", key: `${partPrefix}.l2.scanUnit`, options: ["1/16", "1/8", "1/4", "1/2", "1/1"], visible: (c: any) => c.parts?.[activePartIndex]?.l2?.scanMode === "scanning" },
          { kind: "enum", label: "Scan Direction", key: `${partPrefix}.l2.scanDirection`, options: ["forward", "reverse"], visible: (c: any) => c.parts?.[activePartIndex]?.l2?.scanMode === "scanning" },
          { kind: "bool", label: "Event Triggers", key: `${partPrefix}.l2.eventEnabled` },
          { kind: "bool", label: "State Notes", key: `${partPrefix}.l2.stateEnabled` },
          {
            kind: "group",
            label: "Instrument Targets",
            children: [
              { kind: "enum", label: "Activate Action", key: `${partPrefix}.l2.mapping.activate.action`, options: ["none", "note_on", "note_off"] },
              { kind: "enum", label: "Activate Instrument", key: `${partPrefix}.l2.mapping.activate.slot`, options: instrumentSlotOptions },
              { kind: "enum", label: "Stable Action", key: `${partPrefix}.l2.mapping.stable.action`, options: ["none", "note_on", "note_off"] },
              { kind: "enum", label: "Stable Instrument", key: `${partPrefix}.l2.mapping.stable.slot`, options: instrumentSlotOptions },
              { kind: "enum", label: "Deactivate Action", key: `${partPrefix}.l2.mapping.deactivate.action`, options: ["none", "note_on", "note_off"] },
              { kind: "enum", label: "Deactivate Instrument", key: `${partPrefix}.l2.mapping.deactivate.slot`, options: instrumentSlotOptions },
              { kind: "enum", label: "Scanned Action", key: `${partPrefix}.l2.mapping.scanned.action`, options: ["none", "note_on", "note_off"] },
              { kind: "enum", label: "Scanned Instrument", key: `${partPrefix}.l2.mapping.scanned.slot`, options: instrumentSlotOptions },
              { kind: "enum", label: "Scanned Empty Action", key: `${partPrefix}.l2.mapping.scanned_empty.action`, options: ["none", "note_on", "note_off"] },
              { kind: "enum", label: "Scanned Empty Instrument", key: `${partPrefix}.l2.mapping.scanned_empty.slot`, options: instrumentSlotOptions }
            ]
          },
          deps.axisGroup("X Axis", `${partPrefix}.l2.x`, 1),
          deps.axisGroup("Y Axis", `${partPrefix}.l2.y`, 8),
          {
            kind: "group",
            label: "Note Mapping",
            children: [
              { kind: "number", label: "Starting Note", key: `${partPrefix}.l2.pitch.startingNote`, min: 0, max: 127, step: 1 },
              { kind: "number", label: "Lowest Note", key: `${partPrefix}.l2.pitch.lowestNote`, min: 0, max: 127, step: 1 },
              { kind: "number", label: "Highest Note", key: `${partPrefix}.l2.pitch.highestNote`, min: 0, max: 127, step: 1 },
              { kind: "enum", label: "Out of Range", key: `${partPrefix}.l2.pitch.outOfRange`, options: ["clamp", "wrap"] },
              { kind: "enum", label: "Scale", key: `${partPrefix}.l2.pitch.scale`, options: ["chromatic", "major", "natural_minor", "dorian", "mixolydian", "major_pentatonic", "minor_pentatonic", "harmonic_minor"] },
              { kind: "enum", label: "Root", key: `${partPrefix}.l2.pitch.root`, options: ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] }
            ]
          }
        ]
      },
      {
        kind: "group",
        label: "L3: Voice",
        children: [
          {
            kind: "group",
            label: "Instruments",
            children: Array.from({ length: instrumentSlotOptions.length }, (_, idx) => {
              const prefix = `instruments.${idx}`;
              return {
                kind: "group",
                label: instrumentLabel(idx),
                children: [
                  { kind: "enum", label: "Type", key: `${prefix}.type`, options: ["synth", "sample", "midi"] },
                  { kind: "enum", label: "Name", key: `${prefix}.nameMode`, options: ["auto", "drums", "pad", "lead", "bass", "fx", "custom"] },
                  { kind: "text", label: "Custom Name", key: `${prefix}.customName`, maxLen: 32 },
                  { kind: "enum", label: "Note Behavior", key: `${prefix}.noteBehavior`, options: ["oneshot", "hold"] },
                  {
                    kind: "group",
                    label: "Synth",
                    visible: (c: any) => (c.instruments?.[idx]?.type ?? "synth") === "synth",
                    children: [
                      {
                        kind: "group",
                        label: "Preset",
                        children: [
                          {
                            kind: "group",
                            label: "Load",
                            children: SYNTH_PRESETS.map((preset) => ({
                              kind: "action",
                              label: preset.label,
                              action: { type: "synth_preset_load", slot: idx, presetId: preset.id, presetLabel: preset.label }
                            }))
                          }
                        ]
                      },
                      {
                        kind: "group",
                        label: "Oscillator",
                        children: [
                          {
                            kind: "group",
                            label: "Osc 1",
                            children: [
                              { kind: "enum", label: "Wave", key: `${prefix}.synth.osc1.waveform`, options: ["sine", "triangle", "saw", "square", "pulse"] },
                              { kind: "number", label: "Level", key: `${prefix}.synth.osc1.levelPct`, min: 0, max: 100, step: 1 },
                              { kind: "number", label: "Octave", key: `${prefix}.synth.osc1.octave`, min: -2, max: 2, step: 1 },
                              { kind: "number", label: "Detune", key: `${prefix}.synth.osc1.detuneCents`, min: -50, max: 50, step: 1 },
                              { kind: "number", label: "Pulse Width", key: `${prefix}.synth.osc1.pulseWidthPct`, min: 5, max: 95, step: 1 }
                            ]
                          },
                          {
                            kind: "group",
                            label: "Osc 2",
                            children: [
                              { kind: "enum", label: "Wave", key: `${prefix}.synth.osc2.waveform`, options: ["sine", "triangle", "saw", "square", "pulse"] },
                              { kind: "number", label: "Level", key: `${prefix}.synth.osc2.levelPct`, min: 0, max: 100, step: 1 },
                              { kind: "number", label: "Octave", key: `${prefix}.synth.osc2.octave`, min: -2, max: 2, step: 1 },
                              { kind: "number", label: "Detune", key: `${prefix}.synth.osc2.detuneCents`, min: -50, max: 50, step: 1 },
                              { kind: "number", label: "Pulse Width", key: `${prefix}.synth.osc2.pulseWidthPct`, min: 5, max: 95, step: 1 }
                            ]
                          }
                        ]
                      },
                      {
                        kind: "group",
                        label: "Volume",
                        children: [
                          {
                            kind: "group",
                            label: "Amp",
                            children: [
                              { kind: "number", label: "Gain", key: `${prefix}.synth.amp.gainPct`, min: 0, max: 100, step: 1 },
                              { kind: "number", label: "Vel Sens", key: `${prefix}.synth.amp.velocitySensitivityPct`, min: 0, max: 100, step: 1 }
                            ]
                          },
                          {
                            kind: "group",
                            label: "Envelope",
                            children: [
                              { kind: "number", label: "Attack", key: `${prefix}.synth.ampEnv.attackMs`, min: 0, max: 5000, step: 5 },
                              { kind: "number", label: "Decay", key: `${prefix}.synth.ampEnv.decayMs`, min: 0, max: 5000, step: 5 },
                              { kind: "number", label: "Sustain", key: `${prefix}.synth.ampEnv.sustainPct`, min: 0, max: 100, step: 1 },
                              { kind: "number", label: "Release", key: `${prefix}.synth.ampEnv.releaseMs`, min: 0, max: 8000, step: 5 }
                            ]
                          }
                        ]
                      },
                      {
                        kind: "group",
                        label: "Filter",
                        children: [
                          {
                            kind: "group",
                            label: "Filter",
                            children: [
                              { kind: "enum", label: "Type", key: `${prefix}.synth.filter.type`, options: ["lowpass", "highpass", "bandpass", "notch"] },
                              { kind: "number", label: "Cutoff", key: `${prefix}.synth.filter.cutoffHz`, min: 80, max: 16000, step: 20 },
                              { kind: "number", label: "Res", key: `${prefix}.synth.filter.resonance`, min: 0, max: 100, step: 1 },
                              { kind: "number", label: "Env Amt", key: `${prefix}.synth.filter.envAmountPct`, min: -100, max: 100, step: 1 },
                              { kind: "number", label: "Key Track", key: `${prefix}.synth.filter.keyTrackingPct`, min: 0, max: 100, step: 1 }
                            ]
                          },
                          {
                            kind: "group",
                            label: "Envelope",
                            children: [
                              { kind: "number", label: "Attack", key: `${prefix}.synth.filterEnv.attackMs`, min: 0, max: 5000, step: 5 },
                              { kind: "number", label: "Decay", key: `${prefix}.synth.filterEnv.decayMs`, min: 0, max: 5000, step: 5 },
                              { kind: "number", label: "Sustain", key: `${prefix}.synth.filterEnv.sustainPct`, min: 0, max: 100, step: 1 },
                              { kind: "number", label: "Release", key: `${prefix}.synth.filterEnv.releaseMs`, min: 0, max: 8000, step: 5 }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    kind: "group",
                    label: "Sample",
                    visible: (c: any) => c.instruments?.[idx]?.type === "sample",
                    children: [
                      { kind: "enum", label: "Sample Slot", key: `${prefix}.sample.selectedSlot`, options: sampleSlots },
                      {
                        kind: "group",
                        label: "Choose Sample",
                        children: (s) => {
                          const ss = clampSampleSlotIndex((s.runtimeConfig as any).instruments?.[idx]?.sample?.selectedSlot ?? 0);
                          return deps.sampleBrowserNodes(s, idx, ss);
                        }
                      },
                      {
                        kind: "action",
                        label: "Assign",
                        action: {
                          type: "sample_assign_enter",
                          instrumentSlot: idx,
                          sampleSlot: clampSampleSlotIndex((state.runtimeConfig as any).instruments?.[idx]?.sample?.selectedSlot ?? 0)
                        }
                      },
                      { kind: "bool", label: "Velocity Levels", key: `${prefix}.sample.velocityLevelsEnabled` },
                      { kind: "number", label: "Level High", key: `${prefix}.sample.velocityLevels.high`, min: 1, max: 127, step: 1, visible: (c: any) => c.instruments?.[idx]?.sample?.velocityLevelsEnabled === true },
                      { kind: "number", label: "Level Medium", key: `${prefix}.sample.velocityLevels.medium`, min: 1, max: 127, step: 1, visible: (c: any) => c.instruments?.[idx]?.sample?.velocityLevelsEnabled === true },
                      { kind: "number", label: "Level Low", key: `${prefix}.sample.velocityLevels.low`, min: 1, max: 127, step: 1, visible: (c: any) => c.instruments?.[idx]?.sample?.velocityLevelsEnabled === true },
                      { kind: "number", label: "Base Velocity", key: `${prefix}.sample.baseVelocity`, min: 1, max: 127, step: 1 },
                      { kind: "number", label: "Tune Semis", key: `${prefix}.sample.tuneSemis`, min: -24, max: 24, step: 1 },
                      {
                        kind: "group",
                        label: "Volume",
                        children: [
                          {
                            kind: "group",
                            label: "Amp",
                            children: [
                              { kind: "number", label: "Gain", key: `${prefix}.sample.amp.gainPct`, min: 0, max: 100, step: 1 },
                              { kind: "number", label: "Vel Sens", key: `${prefix}.sample.amp.velocitySensitivityPct`, min: 0, max: 100, step: 1 }
                            ]
                          },
                          {
                            kind: "group",
                            label: "Envelope",
                            children: [
                              { kind: "number", label: "Attack", key: `${prefix}.sample.ampEnv.attackMs`, min: 0, max: 5000, step: 5 },
                              { kind: "number", label: "Decay", key: `${prefix}.sample.ampEnv.decayMs`, min: 0, max: 5000, step: 5 },
                              { kind: "number", label: "Sustain", key: `${prefix}.sample.ampEnv.sustainPct`, min: 0, max: 100, step: 1 },
                              { kind: "number", label: "Release", key: `${prefix}.sample.ampEnv.releaseMs`, min: 0, max: 8000, step: 5 }
                            ]
                          }
                        ]
                      },
                      {
                        kind: "group",
                        label: "Filter",
                        children: [
                          {
                            kind: "group",
                            label: "Filter",
                            children: [
                              { kind: "enum", label: "Type", key: `${prefix}.sample.filter.type`, options: ["lowpass", "highpass", "bandpass", "notch"] },
                              { kind: "number", label: "Cutoff", key: `${prefix}.sample.filter.cutoffHz`, min: 80, max: 16000, step: 20 },
                              { kind: "number", label: "Res", key: `${prefix}.sample.filter.resonance`, min: 0, max: 100, step: 1 },
                              { kind: "number", label: "Env Amt", key: `${prefix}.sample.filter.envAmountPct`, min: -100, max: 100, step: 1 },
                              { kind: "number", label: "Key Track", key: `${prefix}.sample.filter.keyTrackingPct`, min: 0, max: 100, step: 1 }
                            ]
                          },
                          {
                            kind: "group",
                            label: "Envelope",
                            children: [
                              { kind: "number", label: "Attack", key: `${prefix}.sample.filterEnv.attackMs`, min: 0, max: 5000, step: 5 },
                              { kind: "number", label: "Decay", key: `${prefix}.sample.filterEnv.decayMs`, min: 0, max: 5000, step: 5 },
                              { kind: "number", label: "Sustain", key: `${prefix}.sample.filterEnv.sustainPct`, min: 0, max: 100, step: 1 },
                              { kind: "number", label: "Release", key: `${prefix}.sample.filterEnv.releaseMs`, min: 0, max: 8000, step: 5 }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    kind: "group",
                    label: "Note Settings",
                    visible: (c: any) => c.instruments?.[idx]?.type === "midi",
                    children: [
                      { kind: "number", label: "Velocity", key: `${prefix}.midiEngine.velocity`, min: 1, max: 127, step: 1 },
                      { kind: "number", label: "Duration", key: `${prefix}.midiEngine.durationMs`, min: 10, max: 2000, step: 10 }
                    ]
                  },
                  {
                    kind: "group",
                    label: "MIDI",
                    children: [
                      { kind: "bool", label: "Enabled", key: `${prefix}.midi.enabled` },
                      { kind: "number", label: "Channel", key: `${prefix}.midi.channel`, min: 0, max: 15, step: 1 }
                    ]
                  },
                  {
                    kind: "group",
                    label: "Mixer",
                    children: [
                      { kind: "enum", label: "Route", key: `${prefix}.mixer.route`, options: ["direct", ...Array.from({ length: PLATFORM_CAPS.busCount }, (_, i) => `bus_${i + 1}`)] },
                      { kind: "number", label: "Pan Pos", key: `${prefix}.mixer.panPos`, min: 0, max: PLATFORM_CAPS.gridWidth - 1, step: 1 }
                    ]
                  }
                ]
              } satisfies MenuNode;
            })
          },
          {
            kind: "group",
            label: "FX Buses",
            children: Array.from({ length: PLATFORM_CAPS.busCount }, (_, busIdx) => ({
              kind: "group",
              label: `Bus ${busIdx + 1}`,
              children: [
                { kind: "enum", label: "Slot 1", key: `mixer.buses.${busIdx}.slot1`, options: ["none"] },
                { kind: "enum", label: "Slot 2", key: `mixer.buses.${busIdx}.slot2`, options: ["none"] },
                { kind: "number", label: "Pan Pos", key: `mixer.buses.${busIdx}.panPos`, min: 0, max: PLATFORM_CAPS.gridWidth - 1, step: 1 }
              ]
            }))
          }
        ]
      },
      { kind: "spacer" },
      { kind: "group", label: "Playback", children: [{ kind: "number", label: "BPM", key: "transport.bpm", min: 40, max: 240, step: 1 }] },
      {
        kind: "group",
        label: "System",
        children: [
          {
            kind: "group",
            label: "Audio",
            children: [
              { kind: "number", label: "Master Vol", key: "masterVolume", min: 0, max: 100, step: 1 },
              { kind: "enum", label: "Voice Stealing", key: "sound.voiceStealingMode", options: ["off", "lenient", "balanced", "aggressive"] }
            ]
          },
          {
            kind: "group",
            label: "Presets",
            children: [
              {
                kind: "group",
                label: "Library",
                children: [
                  { kind: "group", label: "Save As", children: [{ kind: "text", label: "Name", key: "system.draftName", maxLen: 32, onExitSaveAction: { type: "preset_save" } }, { kind: "action", label: "Save", action: { type: "preset_save" } }] },
                  { kind: "action", label: "Save Current", action: { type: "preset_save_current" } },
                  { kind: "group", label: "Load", children: (s) => deps.presetListNodes(s, "load") },
                  { kind: "group", label: "Rename", children: (s) => deps.presetRenameNodes(s) },
                  { kind: "group", label: "Delete", children: (s) => deps.presetListNodes(s, "delete") },
                  { kind: "action", label: "Refresh List", action: { type: "refresh_presets" } }
                ]
              },
              { kind: "group", label: "Default", children: [{ kind: "action", label: "Save Default", action: { type: "default_save" } }, { kind: "action", label: "Load Default", action: { type: "default_load" } }, { kind: "bool", label: "Auto Save", key: "autoSaveDefault" }] },
              { kind: "group", label: "Factory", children: [{ kind: "action", label: "Load Fact. Default", action: { type: "factory_load" } }] }
            ]
          },
          {
            kind: "group",
            label: "MIDI",
            children: [
              { kind: "bool", label: "Enabled", key: "midi.enabled" },
              { kind: "action", label: "Panic", action: { type: "midi_panic" } },
              { kind: "group", label: "MIDI Out", children: (s) => deps.midiOutputNodes(s) },
              { kind: "group", label: "MIDI In", children: (s) => deps.midiInputNodes(s) },
              { kind: "group", label: "Sync & Clock", children: [{ kind: "enum", label: "Sync Mode", key: "midi.syncMode", options: ["internal", "external"] }, { kind: "bool", label: "Clock Out", key: "midi.clockOutEnabled" }, { kind: "bool", label: "Clock In", key: "midi.clockInEnabled" }, { kind: "bool", label: "Respond Start/Stop", key: "midi.respondToStartStop" }] }
            ]
          },
          { kind: "group", label: "Sound", children: [{ kind: "number", label: "Note Length", key: "sound.noteLengthMs", min: 30, max: 2000, step: 10 }, { kind: "number", label: "Velocity Scale", key: "sound.velocityScalePct", min: 0, max: 200, step: 5 }, { kind: "enum", label: "Velocity Curve", key: "sound.velocityCurve", options: ["linear", "soft", "hard"] }] },
          { kind: "group", label: "UI Settings", children: [{ kind: "number", label: "Screen Sleep", key: "screenSleepSeconds", min: 0, max: 600, step: 10 }, { kind: "number", label: "Display Brightness", key: "displayBrightness", min: 10, max: 100, step: 5 }, { kind: "number", label: "Grid Brightness", key: "gridBrightness", min: 10, max: 100, step: 5 }, { kind: "number", label: "Button Brightness", key: "buttonBrightness", min: 10, max: 100, step: 5 }] }
        ]
      }
    ]
  };
}
