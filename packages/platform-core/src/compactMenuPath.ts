export function compactMenuPath(basePath: string, selectedLabel?: string): string {
  const mapSeg = (seg: string): string => {
    if (seg === "Menu" || seg === "MENU") return "MENU";
    if (seg === "L1: Life") return "L1";
    if (seg === "L2: Sense") return "L2";
    if (seg === "L3: Voice") return "L3";
    if (seg === "L4: Touch") return "L4";
    if (seg === "FX Page") return "FX";
    if (seg === "Instruments") return "Inst";
    if (/^I\d+:/.test(seg)) return seg.split(":")[0];
    if (/^P\d+:/.test(seg)) return seg.split(":")[0];
    if (/^B\d+:/.test(seg)) return seg.split(":")[0];
    if (seg === "Slot 1") return "S1";
    if (seg === "Slot 2") return "S2";
    return seg;
  };

  const base = String(basePath || "")
    .split("/")
    .filter((s) => s.length > 0)
    .map(mapSeg)
    .join(">") || "MENU";

  const labelRaw = String(selectedLabel ?? "").replace(/^\d[-!]\s?/, "");
  const label = mapSeg(labelRaw);
  return label.length > 0 ? `${base}>${label}` : base;
}
