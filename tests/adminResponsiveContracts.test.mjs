import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const admin = readFileSync(join(root, "js", "admin.js"), "utf8");
const css = readFileSync(join(root, "css", "admin.css"), "utf8");

test("alteração de senha não abre o teclado virtual automaticamente", () => {
  const modal = admin.slice(admin.indexOf("function renderPasswordChangeModal()"), admin.indexOf("async function handlePasswordChangeSubmit"));
  assert.doesNotMatch(modal, /input\[name=['"]password['"]\].*\.focus\(/);
  assert.match(modal, /close-password-change.*focus\(\{ preventScroll: true \}\)/);
});

test("tipo do banner é uma escolha restrita e não texto livre", () => {
  assert.match(admin, /<select name="target_type" required>/);
  assert.match(admin, /<option value="hero">Destaque principal<\/option>/);
  assert.doesNotMatch(admin, /<input type="text" name="target_type"/);
  assert.match(admin, /target_type: "hero"/);
});

test("cartões de horários respeitam a largura interna", () => {
  assert.match(css, /\.hours-editor-grid\s*\{[^}]*minmax\(min\(100%, 260px\), 1fr\)/s);
  assert.match(css, /\.hours-time-grid\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/s);
  assert.match(css, /\.hours-editor-shell \.admin-field input\[type="time"\]\s*\{[^}]*max-width: 100%/s);
});

test("cartões de notificações podem quebrar a linha no mobile", () => {
  assert.match(css, /\.notification-bucket__header\s*\{[^}]*flex-wrap: wrap/s);
  assert.match(css, /\.notification-bucket__actions\s*\{[^}]*flex-wrap: wrap/s);
});

test("upload de imagem mantém botão e rótulo alinhados", () => {
  assert.match(css, /\.admin-field input\[type="file"\]::file-selector-button\s*\{[^}]*vertical-align: middle/s);
  assert.match(css, /\.admin-field input\[type="file"\]\s*\{[^}]*overflow: hidden/s);
});
