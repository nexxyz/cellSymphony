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
      type: "sample_trigger";
      patchId: string;
      note: number;
      velocity: number;
    }
  | {
      type: "cc";
      channel: number;
      controller: number;
      value: number;
    };
