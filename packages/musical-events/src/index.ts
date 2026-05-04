export type MusicalEvent =
  | {
      type: "note_on";
      channel: number;
      note: number;
      velocity: number;
      durationMs?: number;
    }
  | {
      type: "note_off";
      channel: number;
      note: number;
    }
  | {
      type: "cc";
      channel: number;
      controller: number;
      value: number;
    };

export const MUSICAL_EVENT_KINDS = ["note_on", "note_off", "cc"] as const;
export type MusicalEventKind = (typeof MUSICAL_EVENT_KINDS)[number];

export function isMusicalEventKind(value: string): value is MusicalEventKind {
  return (MUSICAL_EVENT_KINDS as readonly string[]).includes(value);
}
