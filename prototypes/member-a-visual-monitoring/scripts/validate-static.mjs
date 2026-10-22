import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
const required = ["app-shell", "main-content", "toast-region", "model-dialog", "evidence-dialog", "app.js"];
const missing = required.filter((token) => !html.includes(token));

if (missing.length) {
  console.error(`静态页面缺少必要标记: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Static structure check passed.");
