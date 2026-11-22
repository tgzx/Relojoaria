import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const admin = readFileSync(join(root, "js", "admin.js"), "utf8");
const css = readFileSync(join(root, "css", "admin.css"), "utf8");
const sections = admin.slice(admin.indexOf("function renderSectionsManager() {"), admin.indexOf("function renderProductOptionsManager() {"));
const binder = admin.slice(admin.indexOf("function bindSectionTab() {"), admin.indexOf("function bindCategoryTab() {"));

test("seções abrem em Registros e exibem segunda aba somente na edição", () => {
  assert.match(admin, /sectionEditorOpen:\s*false/);
  assert.match(sections, /class="sections-subtabs"/);
  assert.match(sections, /role="tablist"/);
  assert.match(sections, /data-section-workspace-tab="records"/);
  assert.match(sections, /isEditorOpen\s*\?\s*`<button class="sections-subtab is-active"/);
  assert.match(sections, /data-section-workspace-tab="editor"/);
  assert.match(sections, /isEditorOpen\s*\?\s*editorMarkup\s*:\s*recordsMarkup/);
});

test("Registros oferece tabela e Criar, com edição e atualização", () => {
  assert.match(sections, /class="sections-records-table"/);
  assert.match(sections, /id="new-section-button">Criar/);
  assert.match(sections, /data-edit-section=/);
  assert.match(sections, /data-refresh-section=/);
  assert.match(binder, /adminState\.sectionEditorOpen = true/);
  const save = admin.slice(admin.indexOf("async function saveSection("), admin.indexOf("async function refreshSection("));
  assert.ok(save.includes('notifyStorefrontChanged("section-save");'));
  assert.ok(save.includes("adminState.sectionEditorOpen = false;"));
});

test("tipo de seção usa picklist controlada", () => {
  assert.match(sections, /<select name="type" required>/);
  assert.match(sections, /renderOptions\(SECTION_TYPE_OPTIONS/);
  assert.doesNotMatch(sections, /<input type="text" name="type"/);
});

test("setas têm eixo vertical idêntico, colunas simétricas e sem baseline tipográfica", () => {
  assert.match(css, /grid-template-columns:\s*26px minmax\(0, 1fr\) 26px/);
  assert.match(css, /\.admin-tab-overflow-hint::before\s*\{[^}]*border-right:\s*3px solid currentColor/s);
  assert.match(css, /\.admin-tab-overflow-hint--left::before\s*\{[^}]*rotate\(135deg\)/s);
  assert.match(css, /\.admin-tab-overflow-hint--right::before\s*\{[^}]*rotate\(-45deg\)/s);
  assert.match(css, /\.admin-tab-overflow-hint\s*\{\s*font-size:\s*0;/);
  assert.ok(css.lastIndexOf("/* Chevron geométrico:") > css.lastIndexOf("/* QA 2026-11-22: subtabs"), "arrow override must come after other mobile styles");
});

test("loading usa viewport dinâmico no celular", () => {
  assert.match(css, /\.admin-shell-loading,\s*\.auth-screen,\s*\.access-denied-screen\s*\{[^}]*min-height:\s*100dvh/s);
});
