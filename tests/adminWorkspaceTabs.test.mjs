import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname,resolve,join } from "node:path";
import { fileURLToPath } from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const admin=readFileSync(join(root,"js","admin.js"),"utf8");
const api=readFileSync(join(root,"js","storeApi.js"),"utf8");
const css=readFileSync(join(root,"css","admin.css"),"utf8");

test("Seções: ação Excluir na tabela, confirmação, filtro por loja e cascata por FK",()=>{
 assert.match(admin,/data-delete-section=/);
 assert.match(admin,/async function removeSection\(sectionId\)/);
 assert.match(admin,/window\.confirm\('Excluir a seção/);
 assert.match(admin,/await adminDeleteSection\(adminState\.store\.id, sectionId\)/);
 assert.match(admin,/notifyStorefrontChanged\("section-delete"\)/);
 assert.match(api,/export async function adminDeleteSection\(storeId, sectionId\)/);
 assert.match(api,/from\("product_sections"\)[\s\S]*?\.delete\(\)\.eq\("store_id", storeId\)\.eq\("id", sectionId\)\.select\("id"\)/);
});
test("Telas com CRUD compartilham tabs com Registros por padrão",()=>{
 for(const tab of ["products","categories","brands","options","appearance","notifications"]){
  assert.match(admin,new RegExp(tab+': "list"'));
 }
 assert.match(admin,/function renderManagedWorkspace\(tab, markup\)/);
 assert.match(admin,/workspaceTabs\(tab\)/);
 assert.match(admin,/workspaceView\(tab\)/);
 assert.match(admin,/data-workspace-create=/);
 assert.match(admin,/data-workspace-tab="list"/);
 assert.match(admin,/data-workspace-back=/);
 assert.match(admin,/data-workspace-kind=/);
});
test("Cada edição abre somente a segunda aba, e os saves retornam a registros",()=>{
 for(const tab of ["categories","brands","options","appearance","notifications"]){
  assert.ok(admin.includes("adminState.workspaceViews."+tab+' = "form"') ||
    (tab==="options" && admin.includes('adminState.workspaceViews.options = "group"')&&admin.includes('adminState.workspaceViews.options = "value"')),
    "edit route "+tab);
  assert.ok(admin.includes('adminState.workspaceViews.'+tab+' = "list"'),"save route "+tab);
 }
 assert.match(admin,/function setWorkspaceView\(tab,view,\{reset=true\}=\{\}\)/);
 assert.match(admin,/function canDiscardWorkspace\(tab\)/);
});
test("Produto mantém cinco etapas, mas fica no painel inline e não em modal fixo",()=>{
 assert.match(admin,/id="product-workspace-editor-root"/);
 assert.match(admin,/inlineProductEditor \? "region" : "dialog"/);
 assert.match(admin,/adminState.workspaceViews.products = "form"/);
 assert.match(admin,/adminState.workspaceViews.products = "list"/);
 assert.match(css,/\.workspace-inline-product \.product-editor-inline \{/);
 assert.match(css,/max-height: none/);
});
test("A tabela mantém status corretos e ações seguras em Notificações",()=>{
 assert.match(admin,/statusLabel:getNotificationStatusLabel\(x\.status\)/);
 assert.match(admin,/statusClass:getNotificationStatusClass\(x\.status\)/);
 assert.match(admin,/\["draft","scheduled","failed"\]\.includes\(x\.status\)/);
 assert.match(admin,/data-send-notification/);
});
test("CSS evita vazamento na tabela e editor, sem esconder dados de formulários",()=>{
 assert.match(css,/\.workspace-manager > \.workspace-content \{/);
 assert.match(css,/grid-template-columns: minmax\(0,1fr\)/);
 assert.match(css,/\.workspace-record-table-panel \.section-records-table td \{/);
 assert.match(css,/overflow-wrap: anywhere/);
});
