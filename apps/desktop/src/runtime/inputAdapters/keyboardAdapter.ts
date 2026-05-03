import type { DeviceInput } from "@cellsymphony/device-contracts";

export function mapKeyboardEventToDeviceInput(event: KeyboardEvent): DeviceInput | null {
  const key = event.key;
  if (key === "ArrowLeft") return { type: "encoder_turn", delta: -1, id: "main" };
  if (key === "ArrowRight") return { type: "encoder_turn", delta: 1, id: "main" };
  if (key === "Enter") return { type: "encoder_press", id: "main" };
  if (key === "a" || key === "A") return { type: "button_a" };
  if (key === " ") return { type: "button_s" };
  return null;
}

export function shouldPreventKeyboardDefault(event: KeyboardEvent): boolean {
  return mapKeyboardEventToDeviceInput(event) !== null;
}
