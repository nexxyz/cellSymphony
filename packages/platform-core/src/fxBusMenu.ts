import type { MenuNode } from "./index";
import { PLATFORM_CAPS } from "./platformCaps";

const FX_SLOT_TYPES = [
  "none",
  "reverb",
  "delay",
  "tremolo",
  "vibrato",
  "auto_pan",
  "chorus",
  "flanger",
  "wah",
  "filter_lfo",
  "duck",
  "bitcrusher",
  "saturator",
  "distortion",
  "glitch"
];

function duckSourceOptions(): string[] {
  return [
    ...Array.from({ length: PLATFORM_CAPS.instrumentCount }, (_, i) => `I${i + 1}`),
    ...Array.from({ length: PLATFORM_CAPS.busCount }, (_, i) => `B${i + 1}`)
  ];
}

function fxSlotNode(busIdx: number, slotIdx: 1 | 2): MenuNode {
  const slotKey = slotIdx === 1 ? "slot1" : "slot2";
  return {
    kind: "group",
    label: `Slot ${slotIdx}`,
    children: [
      { kind: "enum", label: "Type", key: `mixer.buses.${busIdx}.${slotKey}.type`, options: FX_SLOT_TYPES },
      {
        kind: "group",
        label: "Duck",
        visible: (c: any) => c.mixer?.buses?.[busIdx]?.[slotKey]?.type === "duck",
        children: [
          { kind: "enum", label: "Source", key: `mixer.buses.${busIdx}.${slotKey}.params.source`, options: duckSourceOptions() },
          { kind: "number", label: "Threshold", key: `mixer.buses.${busIdx}.${slotKey}.params.threshold`, min: 0, max: 1, step: 0.01 },
          { kind: "number", label: "Amount %", key: `mixer.buses.${busIdx}.${slotKey}.params.amountPct`, min: 0, max: 100, step: 1 },
          { kind: "number", label: "Attack ms", key: `mixer.buses.${busIdx}.${slotKey}.params.attackMs`, min: 1, max: 500, step: 1 },
          { kind: "number", label: "Release ms", key: `mixer.buses.${busIdx}.${slotKey}.params.releaseMs`, min: 1, max: 5000, step: 5 }
        ]
      },
      {
        kind: "group",
        label: "Delay",
        visible: (c: any) => c.mixer?.buses?.[busIdx]?.[slotKey]?.type === "delay",
        children: [
          { kind: "number", label: "Time ms", key: `mixer.buses.${busIdx}.${slotKey}.params.timeMs`, min: 1, max: 2000, step: 5 },
          { kind: "number", label: "Feedback", key: `mixer.buses.${busIdx}.${slotKey}.params.feedback`, min: 0, max: 0.98, step: 0.01 },
          { kind: "number", label: "Mix %", key: `mixer.buses.${busIdx}.${slotKey}.params.mixPct`, min: 0, max: 100, step: 1 }
        ]
      },
      {
        kind: "group",
        label: "Tremolo",
        visible: (c: any) => c.mixer?.buses?.[busIdx]?.[slotKey]?.type === "tremolo",
        children: [
          { kind: "number", label: "Rate Hz", key: `mixer.buses.${busIdx}.${slotKey}.params.rateHz`, min: 0.05, max: 40, step: 0.05 },
          { kind: "number", label: "Depth %", key: `mixer.buses.${busIdx}.${slotKey}.params.depthPct`, min: 0, max: 100, step: 1 }
        ]
      },
      {
        kind: "group",
        label: "Saturator",
        visible: (c: any) => c.mixer?.buses?.[busIdx]?.[slotKey]?.type === "saturator",
        children: [
          { kind: "number", label: "Drive", key: `mixer.buses.${busIdx}.${slotKey}.params.drive`, min: 0, max: 20, step: 0.1 },
          { kind: "number", label: "Mix %", key: `mixer.buses.${busIdx}.${slotKey}.params.mixPct`, min: 0, max: 100, step: 1 }
        ]
      },
      {
        kind: "group",
        label: "Distortion",
        visible: (c: any) => c.mixer?.buses?.[busIdx]?.[slotKey]?.type === "distortion",
        children: [
          { kind: "number", label: "Drive", key: `mixer.buses.${busIdx}.${slotKey}.params.drive`, min: 0, max: 50, step: 0.5 },
          { kind: "number", label: "Clip", key: `mixer.buses.${busIdx}.${slotKey}.params.clip`, min: 0.05, max: 2, step: 0.05 },
          { kind: "number", label: "Mix %", key: `mixer.buses.${busIdx}.${slotKey}.params.mixPct`, min: 0, max: 100, step: 1 }
        ]
      },
      {
        kind: "group",
        label: "Bitcrusher",
        visible: (c: any) => c.mixer?.buses?.[busIdx]?.[slotKey]?.type === "bitcrusher",
        children: [
          { kind: "number", label: "Rate Div", key: `mixer.buses.${busIdx}.${slotKey}.params.rateDiv`, min: 1, max: 128, step: 1 },
          { kind: "number", label: "Bits", key: `mixer.buses.${busIdx}.${slotKey}.params.bits`, min: 1, max: 16, step: 1 },
          { kind: "number", label: "Mix %", key: `mixer.buses.${busIdx}.${slotKey}.params.mixPct`, min: 0, max: 100, step: 1 }
        ]
      }
    ]
  };
}

export function fxBusesMenuNode(): MenuNode {
  return {
    kind: "group",
    label: "FX Buses",
    children: Array.from({ length: PLATFORM_CAPS.busCount }, (_, busIdx) => ({
      kind: "group",
      label: `Bus ${busIdx + 1}`,
      children: [
        fxSlotNode(busIdx, 1),
        fxSlotNode(busIdx, 2),
        { kind: "number", label: "Pan Pos", key: `mixer.buses.${busIdx}.panPos`, min: 0, max: PLATFORM_CAPS.gridWidth - 1, step: 1 }
      ]
    }))
  };
}
