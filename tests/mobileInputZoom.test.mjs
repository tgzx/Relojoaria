import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Permanent regression guard, Node-only. Dynamic QA: caderno 68_DEEP_UI_FIELD_MAP.mjs.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(join(root, file), "utf8");
const files = ["index.html", "admin.html", "offline.html", ...readdirSync(join(root, "js"))
  .filter((file) => file.endsWith(".js") && file !== "config.js")
  .map((file) => "js/" + file)];
const textInputTypes = new Set(["text", "search", "email", "password", "number", "tel", "url",
  "date", "time", "datetime-local", "month", "week"]);
const nativeNonTextTypes = new Set(["checkbox", "radio", "file", "range", "color", "button",
  "submit", "reset", "image", "hidden"]);
const elements = [];
for (const file of files) {
  const content = read(file);
  for (const match of content.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)) {
    const tag = match[1].toLowerCase();
    const attributes = match[2];
    const typeAttr = attributes.match(/(?:^|\s)type\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const type = tag === "input" ? (typeAttr?.[1] ?? typeAttr?.[2] ?? typeAttr?.[3] ?? "text").toLowerCase() : tag;
    assert.ok(type === "select" || type === "textarea" || textInputTypes.has(type) || nativeNonTextTypes.has(type),
      "New input type without iOS zoom coverage: " + type + " in " + file);
    elements.push({ file, type, editable: type === "select" || type === "textarea" || textInputTypes.has(type) });
  }
  assert.equal([...content.matchAll(/(?:createElement|createElementNS)\s*\(\s*['"](?:input|select|textarea)['"]\s*\)/g)].length,
    0, "Dynamically constructed controls in " + file + " require runtime inventory update");
}
assert.ok(elements.length >= 148, "Field inventory unexpectedly shrank to " + elements.length + "; verify coverage");
const textTypesPresent = [...new Set(elements.filter((e) => e.editable).map((e) => e.type))];
for (const page of ["index.html", "admin.html"]) {
  const html = read(page);
  assert.match(html, /name="viewport"[^>]+content="width=device-width,\s*initial-scale=1\.0"/i,
    page + ": mobile viewport must remain responsive");
  assert.doesNotMatch(html, /user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\.0)?\b/i,
    page + ": never disable pinch zoom");
}
for (const stylesheet of ["css/styles.css", "css/admin.css"]) {
  const css = read(stylesheet);
  const start = css.lastIndexOf("/* iOS Safari: campos com fonte abaixo de 16px");
  assert.ok(start > 0, stylesheet + ": missing iOS input zoom policy");
  const rule = css.slice(start);
  assert.match(rule, /@media\s*\(hover:\s*none\)\s*and\s*\(pointer:\s*coarse\)/,
    stylesheet + ": touch policy missing");
  assert.match(rule, /font-size:\s*16px\s*;/, stylesheet + ": minimum 16px for inputs missing");
  for (const type of textTypesPresent) {
    const selector = type === "textarea" || type === "select" ? type : 'input[type="' + type + '"]';
    assert.ok(rule.includes(selector), stylesheet + ": " + type + " selector missing");
  }
  if (textTypesPresent.includes("text")) {
    assert.ok(rule.includes("input:not([type])"), stylesheet + ": implicit input type=text must be covered");
  }
  assert.doesNotMatch(rule, /user-scalable\s*=\s*no|touch-action\s*:\s*none/,
    stylesheet + ": do not disable user zoom");
}
console.log("PASS mobile input zoom contract: " + elements.length + " HTML/JS declarations (" +
  elements.filter(e=>e.editable).length + " editable, " +
  elements.filter(e=>!e.editable).length +
  " native non-text), both stylesheets, public+admin viewport, zoom accessible");
