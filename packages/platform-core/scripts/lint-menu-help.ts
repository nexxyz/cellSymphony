import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInitialState, enumerateMenuHelpTargets } from "../src/index";
import { lifeBehavior } from "@cellsymphony/behaviors-life";

type Entry = { id: string; path: string; key: string; kind: string; title: string; line1: string; line2: string };

const tsvPath = resolve(process.cwd(), "..", "..", "docs", "menu-help-texts.tsv");
const raw = readFileSync(tsvPath, "utf8");
const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0 && !l.trim().startsWith("#"));

const expectedHeader = ["id", "path", "key", "kind", "title", "line1", "line2"];
if (lines.length === 0) throw new Error("menu-help-texts.tsv is empty");
const header = lines[0].split("\t");
if (header.join("\t") !== expectedHeader.join("\t")) {
  throw new Error(`Invalid header in menu-help-texts.tsv. Expected: ${expectedHeader.join("\t")}`);
}

const entries: Entry[] = [];
for (let i = 1; i < lines.length; i += 1) {
  const cols = lines[i].split("\t");
  if (cols.length < 7) throw new Error(`Invalid row ${i + 1}: expected 7 columns`);
  const [id, path, key, kind, title, line1, line2] = cols;
  if (!id || !kind || !line1) throw new Error(`Invalid row ${i + 1}: id/kind/line1 are required`);
  entries.push({ id, path, key, kind, title, line1, line2 });
}

function globMatch(pattern: string, value: string): boolean {
  if (!pattern || pattern === "*") return true;
  if (!pattern.includes("*")) return pattern === value;
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(value);
}

function matches(entry: Entry, target: { path: string; key: string; kind: string }): boolean {
  if (entry.kind && entry.kind !== "*" && entry.kind !== target.kind) return false;
  if (entry.key && !globMatch(entry.key, target.key)) return false;
  if (entry.path && !globMatch(entry.path, target.path)) return false;
  return true;
}

function isExplicit(entry: Entry): boolean {
  const key = entry.key.trim();
  const path = entry.path.trim();
  return key.length > 0 || (path.length > 0 && path !== "*");
}

const state = createInitialState(lifeBehavior);
state.system.oledMode = "normal";
state.system.presetNames = ["Preset A"];
state.system.selectedPreset = "Preset A";
state.system.currentPresetName = "Preset A";
state.system.midiOutputs = [{ id: "out-1", name: "Out Port" }];
state.system.midiInputs = [{ id: "in-1", name: "In Port" }];

const targets = enumerateMenuHelpTargets(state);
const misses = targets.filter((t) => !entries.some((e) => isExplicit(e) && matches(e, t)));

if (misses.length > 0) {
  console.error("Missing menu help entries:");
  for (const m of misses) {
    console.error(`- kind=${m.kind} key=${m.key || "(none)"} path=${m.path}`);
  }
  process.exit(1);
}

console.log(`menu-help lint passed (${targets.length} menu entries covered)`);
