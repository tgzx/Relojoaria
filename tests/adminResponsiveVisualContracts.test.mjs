import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const admin=readFileSync(join(root,"js","admin.js"),"utf8");
const css=readFileSync(join(root,"css","admin.css"),"utf8");
const password=admin.slice(admin.indexOf("function renderPasswordChangeModal()"),admin.indexOf("async function handlePasswordChangeSubmit("));
const sections=admin.slice(admin.indexOf("function renderSectionsManager()"),admin.indexOf("function renderProductOptionsManagerLegacy()"));

test("iOS: primeira abertura da senha não dispara o teclado automaticamente",()=>{
 assert.doesNotMatch(password,/input\[name=['"]password['"]\].*\.focus\(/);
 assert.match(password,/close-password-change.*focus\(\{ preventScroll: true \}\)/);
});
test("banner: target_type é select e persistência tem enum válida",()=>{
 assert.match(admin,/<select name="target_type" required><option value="hero">Destaque principal<\/option><\/select>/);
 assert.match(admin,/target_type: "hero"/);
 assert.doesNotMatch(admin,/<input type="text" name="target_type"/);
});
test("seções: tipo de domínio também é enum e não texto arbitrário",()=>{
 assert.match(sections,/<select name="type" required>/);
 assert.match(admin,/SECTION_TYPE_OPTIONS\.some\(\(option\) => option\.value === formData\.get\("type"\)\)/);
 assert.match(admin,/value: "best_seller"/);
 assert.match(admin,/value: "low_stock"/);
});
test("horários: cards e inputs de time podem encolher sem vazamento",()=>{
 assert.match(css,/\.hours-editor-grid \{ grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, 260px\), 1fr\)\); \}/);
 assert.match(css,/\.hours-time-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); justify-content: stretch; \}/);
 assert.match(css,/\.hours-editor-shell \.admin-field input:is\(\[data-hours-morning-start\]/);
 assert.match(css,/\.hours-editor-shell \.admin-field input:is\([^}]*max-width: 100%/s);
});
test("notificações: agenda por texto numérico não usa picker iOS e preserva scheduled_at",()=>{
 assert.match(css,/\.notification-bucket__header \{ flex-wrap: wrap;/);
 assert.match(css,/\.notification-bucket__actions \{ flex-wrap: wrap;/);
 assert.match(css,/\.notification-schedule-controls,\s*\.admin-date-time-controls \{[\s\S]*?grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, 180px\), 1fr\)\)/);
 assert.match(css,/\.notification-form \.notification-schedule-part > input,\s*#banner-form \.admin-date-time-part > input \{[\s\S]*?min-inline-size: 0/);
 assert.match(admin,/<input type="text" name="scheduled_date"[^>]+inputmode="numeric"/);
 assert.match(admin,/<input type="text" name="scheduled_time"[^>]+inputmode="numeric"/);
 assert.doesNotMatch(admin,/<input type="date" name="scheduled_date"/);
 assert.doesNotMatch(admin,/<input type="time" name="scheduled_time"/);
 assert.match(admin,/<input type="hidden" name="scheduled_at"/);
 assert.match(admin,/function formatScheduleDigits\(value, type\)/);
 assert.match(admin,/function syncNotificationScheduledAt\(form\)/);
 assert.match(admin,/combined\.value = !incomplete && !invalid && date && time/);
 assert.match(admin,/schedule\.incomplete \|\| schedule\.invalid/);
});
test("banner: botão de arquivo alinhado sem exceder o cartão",()=>{
 assert.match(css,/\.admin-field input\[type="file"\]::file-selector-button \{[^}]*vertical-align: middle/s);
 assert.match(css,/#banner-upload-input \{/);
});
test("setas: colunas iguais, centro vertical e ícones SVG, sem glifos tipográficos",()=>{
 assert.match(css,/grid-template-columns: 26px minmax\(0,1fr\) 26px/);
 assert.match(css,/\.admin-tab-overflow-hint svg \{ width: 18px; height: 18px; \}/);
 assert.match(admin,/admin-tab-overflow-hint--left" aria-hidden="true"><svg/);
 assert.match(admin,/admin-tab-overflow-hint--right" aria-hidden="true"><svg/);
});
test("todos os controles editáveis de data e hora no painel usam máscara numérica, nunca o picker nativo",()=>{
 assert.doesNotMatch(admin,/<input\s+type=["'](?:date|time|datetime-local|month|week)["']/);
 for(const name of ["starts_at_date","starts_at_time","ends_at_date","ends_at_time"]) {
  assert.match(admin,new RegExp('name="'+name+'"[^>]*inputmode="numeric"'));
 }
 for(const attribute of ["morning-start","morning-end","afternoon-start","afternoon-end"]) {
  assert.match(admin,new RegExp('<input type="text" inputmode="numeric"[^>]*data-hours-'+attribute));
 }
 assert.match(admin,/function syncAdminDateTimePair\(form, dateName, timeName, combinedName\)/);
 assert.match(admin,/function bindAdminDateTimePairs\(form, pairs\)/);
 assert.match(admin,/function readBusinessHoursTime\(card, selector, dayLabel\)/);
 assert.match(admin,/const validation = syncAdminDateTimePair\(form/);
 assert.match(css,/\.admin-date-time-controls \{/);
 assert.match(css,/#banner-form \.admin-date-time-part > input/);
});
