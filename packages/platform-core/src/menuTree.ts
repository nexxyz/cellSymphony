import { listBehaviorIds, type BehaviorEngine } from "@cellsymphony/behavior-api";
import type { MenuNode, PlatformState } from "./index";

type MenuTreeDeps<TState> = {
  resolveBehavior: (id: string) => BehaviorEngine<any, any>;
  axisGroup: (label: string, prefix: "x" | "y", defaultStep: number) => MenuNode;
  presetListNodes: (state: PlatformState<TState>, mode: "load" | "delete") => MenuNode[];
  presetRenameNodes: (state: PlatformState<TState>) => MenuNode[];
  midiOutputNodes: (state: PlatformState<TState>) => MenuNode[];
  midiInputNodes: (state: PlatformState<TState>) => MenuNode[];
};

export function buildMenuTree<TState>(state: PlatformState<TState>, deps: MenuTreeDeps<TState>): MenuNode {
  const activeEngine = deps.resolveBehavior(state.runtimeConfig.activeBehavior);
  const behaviorConfigNodes: MenuNode[] = [];
  if (activeEngine.configMenu) {
    const items = activeEngine.configMenu(state.behaviorState as any);
    for (const item of items) {
      if (item.type === "number") {
        behaviorConfigNodes.push({ kind: "number", label: item.label, key: `behaviorConfig.${activeEngine.id}.${item.key}`, min: item.min ?? 0, max: item.max ?? 127, step: item.step ?? 1 });
      } else if (item.type === "bool") {
        behaviorConfigNodes.push({ kind: "bool", label: item.label, key: `behaviorConfig.${activeEngine.id}.${item.key}` });
      } else if (item.type === "enum") {
        behaviorConfigNodes.push({ kind: "enum", label: item.label, key: `behaviorConfig.${activeEngine.id}.${item.key}`, options: item.options ?? [] });
      } else if (item.type === "action") {
        behaviorConfigNodes.push({ kind: "action", label: item.label, action: { type: "behavior_action", behaviorId: activeEngine.id, actionType: item.key } });
      }
    }
  }

  return {
    kind: "group",
    label: "Root",
    children: [
      { kind: "group", label: "L1: Life", children: [{ kind: "enum", label: "Step Rate", key: "algorithmStepUnit", options: ["1/16", "1/8", "1/4", "1/2", "1/1"] }, { kind: "enum", label: "Behavior", key: "activeBehavior", options: listBehaviorIds() }, ...behaviorConfigNodes] },
      {
        kind: "group",
        label: "L2: Sense",
        children: [
          { kind: "enum", label: "Scan Mode", key: "scanMode", options: ["immediate", "scanning"] },
          { kind: "enum", label: "Scan Axis", key: "scanAxis", options: ["rows", "columns"], visible: (c) => c.scanMode === "scanning" },
          { kind: "enum", label: "Scan Unit", key: "scanUnit", options: ["1/16", "1/8", "1/4", "1/2", "1/1"], visible: (c) => c.scanMode === "scanning" },
          { kind: "enum", label: "Scan Direction", key: "scanDirection", options: ["forward", "reverse"], visible: (c) => c.scanMode === "scanning" },
          { kind: "bool", label: "Event Triggers", key: "eventEnabled" },
          { kind: "enum", label: "Event Pattern", key: "eventParity", options: ["none", "activate_even_deactivate_odd"] },
          { kind: "bool", label: "State Notes", key: "stateEnabled" },
          deps.axisGroup("X Axis", "x", 1),
          deps.axisGroup("Y Axis", "y", 8)
        ]
      },
      {
        kind: "group",
        label: "L3: Voice",
        children: [
          {
            kind: "group",
            label: "Note Mapping",
            children: [
              { kind: "number", label: "Starting Note", key: "pitch.startingNote", min: 0, max: 127, step: 1 },
              { kind: "number", label: "Lowest Note", key: "pitch.lowestNote", min: 0, max: 127, step: 1 },
              { kind: "number", label: "Highest Note", key: "pitch.highestNote", min: 0, max: 127, step: 1 },
              { kind: "enum", label: "Out of Range", key: "pitch.outOfRange", options: ["clamp", "wrap"] },
              { kind: "enum", label: "Scale", key: "pitch.scale", options: ["chromatic", "major", "natural_minor", "dorian", "mixolydian", "major_pentatonic", "minor_pentatonic", "harmonic_minor"] },
              { kind: "enum", label: "Root", key: "pitch.root", options: ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] }
            ]
          },
          { kind: "enum", label: "Activate Target", key: "mapping.activate.channel", options: ["0", "1", "2", "3"] },
          { kind: "enum", label: "Stable Target", key: "mapping.stable.channel", options: ["0", "1", "2", "3"] },
          { kind: "enum", label: "Deactivate Target", key: "mapping.deactivate.channel", options: ["0", "1", "2", "3"] },
          { kind: "enum", label: "Scanned Target", key: "mapping.scanned.channel", options: ["0", "1", "2", "3"] },
          deps.axisGroup("X Axis", "x", 1),
          deps.axisGroup("Y Axis", "y", 3)
        ]
      },
      { kind: "spacer" },
      { kind: "group", label: "Playback", children: [{ kind: "number", label: "BPM", key: "transport.bpm", min: 40, max: 240, step: 1 }] },
      {
        kind: "group",
        label: "System",
        children: [
          { kind: "group", label: "Audio", children: [{ kind: "number", label: "Master Vol", key: "masterVolume", min: 0, max: 100, step: 1 }] },
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
