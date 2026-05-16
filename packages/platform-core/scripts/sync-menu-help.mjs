import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const tsvPath = resolve(process.cwd(), "..", "..", "docs", "menu-help-texts.tsv");
const outPath = resolve(process.cwd(), "src", "menuHelp.generated.ts");

const raw = readFileSync(tsvPath, "utf8");
const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0 && !l.trim().startsWith("#"));
if (lines.length === 0) throw new Error("menu-help-texts.tsv is empty");
const header = lines[0].split("\t");
const expected = ["id", "path", "key", "kind", "title", "line1", "line2"];
if (header.join("\t") !== expected.join("\t")) {
  throw new Error(`Invalid TSV header. Expected: ${expected.join("\t")}`);
}

const rows = [];
for (let i = 1; i < lines.length; i += 1) {
  const cols = lines[i].split("\t");
  if (cols.length < 7) continue;
  const [id, path, key, kind, title, line1, line2] = cols;
  rows.push({ id, path, key, kind, title, line1, line2 });
}

const out = `export type MenuHelpEntry = {\n  id: string;\n  path: string;\n  key: string;\n  kind: string;\n  title: string;\n  line1: string;\n  line2: string;\n};\n\nexport const MENU_HELP_ENTRIES: MenuHelpEntry[] = ${JSON.stringify(rows, null, 2)};\n`;

writeFileSync(outPath, out, "utf8");
console.log(`Wrote ${rows.length} help entries to ${outPath}`);
