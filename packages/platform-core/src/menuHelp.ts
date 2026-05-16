import type { MenuHelpEntry } from "./menuHelp.generated";
import { MENU_HELP_ENTRIES } from "./menuHelp.generated";

export type HelpTarget = {
  path: string;
  key: string;
  kind: string;
  label: string;
};

export type ResolvedHelp = {
  title: string;
  detail: string;
};

function globMatch(pattern: string, value: string): boolean {
  if (!pattern || pattern === "*") return true;
  if (!pattern.includes("*")) return pattern === value;
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(value);
}

function score(entry: MenuHelpEntry, target: HelpTarget): number {
  const key = entry.key.trim();
  const path = entry.path.trim();
  if (key && !globMatch(key, target.key)) return -1;
  if (path && !globMatch(path, target.path)) return -1;
  if (entry.kind && entry.kind !== "*" && entry.kind !== target.kind) return -1;

  const keyScore = key ? (key.includes("*") ? 30 : 40) : 0;
  const pathScore = path ? (path.includes("*") ? 20 : 30) : 0;
  const kindScore = entry.kind && entry.kind !== "*" ? 10 : 0;
  return keyScore + pathScore + kindScore;
}

export function resolveMenuHelp(target: HelpTarget): ResolvedHelp {
  let best: MenuHelpEntry | null = null;
  let bestScore = -1;
  for (const entry of MENU_HELP_ENTRIES) {
    const s = score(entry, target);
    if (s > bestScore) {
      best = entry;
      bestScore = s;
    }
  }
  if (!best || bestScore < 0) {
    return {
      title: target.label || "Help",
      detail: "No help text is available for this entry yet."
    };
  }
  const lines = [best.line1, best.line2].filter((v) => v && v.trim().length > 0);
  return {
    title: best.title || target.label || "Help",
    detail: lines.join(" ")
  };
}

export function listMenuHelpEntries(): MenuHelpEntry[] {
  return MENU_HELP_ENTRIES.slice();
}
