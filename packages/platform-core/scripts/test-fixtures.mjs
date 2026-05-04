import fs from "node:fs";

const hasDocs = fs.existsSync(new URL("../../../docs/menu-and-controls-spec.md", import.meta.url));
if (!hasDocs) {
  console.error("Required docs fixture is missing.");
  process.exit(1);
}

console.log("Fixture validation passed.");
