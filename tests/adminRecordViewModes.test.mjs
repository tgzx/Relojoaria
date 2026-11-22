import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname,resolve,join} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const admin=readFileSync(join(root,"js","admin.js"),"utf8");
const css=readFileSync(join(root,"css","admin.css"),"utf8");
const api=readFileSync(join(root,"js","storeApi.js"),"utf8");

test("sticky: altura mobile independe da aba ativa e reduz 25%",()=>{
 assert.match(css,/\.admin-content \{ grid-auto-rows: max-content; \}/);
 assert.match(css,/height: 122px;\s*min-height: 122px;\s*max-height: 122px;/);
 assert.match(css,/grid-template-rows: 58px 44px;/);
 assert.match(css,/padding-bottom: 12px;/);
 assert.match(css,/height: 44px;\s*max-height: 44px;/);
 assert.match(css,/height: 59px;\s*min-height: 59px;\s*max-height: 59px;/);
});
test("todos os módulos de registros usam Cards/Tabela sem persistência remota",()=>{
 for(const tab of ["products","sections","categories","brands","options","appearance","notifications"]){
   assert.ok(admin.includes(tab+':"cards"'),"missing record mode "+tab);
 }
 assert.match(admin,/function renderRecordViewSwitch\(tab\)/);
 assert.match(admin,/type="radio"/);
 assert.match(admin,/data-record-view-radio=/);
 assert.match(admin,/adminState\.recordViews\[tab\] = input\.value/);
 assert.match(admin,/area\.dataset\.recordsMode = input\.value/);
 assert.doesNotMatch(admin.slice(admin.indexOf("function bindRecordViewControls()"),admin.indexOf("function workspaceRow(item)")),/await |supabase|fetch\(/i);
});
test("tabela com seta acionável e menu real Editar / Excluir",()=>{
 assert.match(admin,/function renderRecordActionTrigger\(name, canEdit/);
 assert.match(admin,/data-record-menu-choice="edit"/);
 assert.match(admin,/data-record-menu-choice="delete"/);
 assert.match(admin,/data-record-action-trigger/);
 assert.match(admin,/const target=choice.dataset.recordMenuChoice==="edit"\?edit/);
 assert.match(css,/\.records-display\[data-records-mode="table"\] \.record-action-trigger \{display: grid;\}/);
 const start=css.indexOf("/* Tabela real: Ações rola com todas as demais colunas");
 const end=css.indexOf("/* Na tabela mobile, largura previsível",start);
 assert.ok(start>=0 && end>start,"bloco de tabela encontrado");
 assert.doesNotMatch(css.slice(start,end),/position:\s*sticky|right:\s*0|z-index\s*:/,"Ações não pode ter sticky");
});
test("histórico de notificações não é excluído e exclusão tem filtro de loja",()=>{
 assert.match(api,/export async function adminDeleteNotification\(storeId, notificationId\)/);
 assert.match(api,/\.eq\("store_id", storeId\)\.eq\("id", notificationId\)/);
 assert.match(api,/\.in\("status", \["draft", "scheduled", "failed"\]\)/);
 assert.match(admin,/if \(!canEdit && !canRemove\) return '<span class="record-actions-unavailable">Histórico<\/span>'/);
 assert.match(admin,/window\.confirm\('Excluir a notificação/);
});
test("grupos de opção continuam com a ação de desativar sem perder vínculos",()=>{
 assert.match(admin,/data-disable-option-group/);
 assert.match(admin,/data-disable-option-value/);
 assert.match(admin,/const actionLabel = \/data-disable-option/);
 assert.match(admin,/workspaceUtilityButton\("data-stop-recurrence"/);
});
test("produtos e seções possuem os dois modos e inputs confinados",()=>{
 assert.match(admin,/renderRecordViewSwitch\("sections"\)/);
 assert.match(admin,/renderRecordViewSwitch\("products"\)/);
 assert.match(css,/\.records-display\[data-records-mode="table"\] \.section-records-table \{/);
 assert.match(css,/\.records-display\[data-records-mode="cards"\] \.records-product-list tbody/);
 assert.match(css,/\.admin-content \.admin-field input:not\(\[type="checkbox"\]\)/);
});

test("dirty state: comparar formulário real evita perder alterações sem evento input",()=>{
 assert.match(admin,/function serializeAdminFormSnapshot\(form\)/);
 assert.match(admin,/function hasUnsavedAdminForm\(tab\)/);
 assert.match(admin,/form\.dataset\.initialFormSnapshot = serializeAdminFormSnapshot\(form\)/);
 assert.match(admin,/serializeAdminFormSnapshot\(form\) !== form\.dataset\.initialFormSnapshot/);
 assert.match(admin,/if \(hasUnsavedAdminForm\(adminState\.currentAdminTab\)\)/);
 assert.match(admin,/if \(hasUnsavedAdminForm\("sections"\)/);
});

test("Criar e Cards/Tabela pertencem ao card principal, padrão Seções",()=>{
 const start=admin.indexOf("function renderManagedWorkspace(tab, markup)");
 const end=admin.indexOf("function renderProducts()",start);
 const section=admin.slice(start,end);
 assert.ok(section.includes("workspace-records-container"),"main card");
 assert.ok(section.includes("workspaceActions(tab)"),"create toolbar inside template");
 assert.ok(section.includes("workspace-list-tables"),"record tables inside main card");
 assert.ok(!section.includes('isList ? workspaceActions(tab) : ""'),"no external Create toolbar");
 assert.match(css,/\.workspace-manager \.workspace-records-container \{/);
 assert.match(css,/\.workspace-manager \.workspace-records-container \.workspace-record-table-panel \{/);
 assert.match(css,/\.workspace-manager--options \.workspace-records-container/);
});

test("Objeto tem ajuda ? contextual no canto oposto ao título",()=>{
 for(const tab of ["products","sections","categories","brands","options","appearance","notifications"]){
   assert.match(admin,new RegExp(tab+': ".+Ex\\.:'));
 }
 assert.match(admin,/function renderObjectHelp\(tab\)/);
 assert.match(admin,/admin-object-help-trigger/);
 assert.match(admin,/data-admin-field-help=/);
 assert.match(css,/\.workspace-manager \.workspace-records-heading > \.admin-object-help-trigger/);
 assert.match(css,/grid-column: 2;/);
});
test("Datas e horários não forçam overflow em colunas mobile",()=>{
 assert.match(css,/input:is\(\[type="date"\],\[type="datetime-local"\],\[type="time"\]\)/);
 assert.match(css,/inline-size: 100%/);
 assert.match(css,/\.inline-grid:has\(input:is\(\[type="datetime-local"\],\[type="date"\]\)\)/);
});
test("Barra sticky reserva folga superior e inferior sem botões menores",()=>{
 assert.match(css,/height: 122px;\s*min-height: 122px;\s*max-height: 122px/);
 assert.match(css,/padding: 4px 0 12px/);
 assert.match(css,/grid-template-rows: 58px 44px/);
 assert.match(css,/min-height: 44px/);
});