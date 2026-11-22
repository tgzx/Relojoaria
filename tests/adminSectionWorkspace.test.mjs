import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const admin=readFileSync(join(root,"js/admin.js"),"utf8");
const css=readFileSync(join(root,"css/admin.css"),"utf8");
test("Seções só mostra formulário na aba Criar/Editar",()=>{
 const f=admin.slice(admin.indexOf("function renderSectionsManager()"),admin.indexOf("function renderProductOptionsManager()"));
 assert.match(f,/sectionView === "list"/);
 assert.match(f,/section-workspace-tabs/);
 assert.match(f,/sectionView === "form"/);
 assert.match(f,/id="section-records-panel"/);
 assert.match(f,/id="section-editor-panel"/);
 assert.match(f,/Nenhuma seção cadastrada ainda/);
 assert.match(f,/class="section-records-table"/);
 assert.match(f,/data-edit-section/);
 assert.match(f,/id="new-section-button"/);
});
test("Mudança de abas não descarta formulário dirty sem confirmação",()=>{
 const f=admin.slice(admin.indexOf("function bindSectionTab()"),admin.indexOf("function bindCategoryTab()"));
 assert.match(f,/window\.confirm\("Descartar as alterações não salvas desta seção\?"\)/);
 assert.match(f,/adminState\.sectionView = targetView/);
 assert.match(f,/adminState\.sectionView = "form"/);
 assert.match(f,/role='tab'/);
});
test("Sucesso retorna à lista, falha de gravação preserva formulário",()=>{
 const f=admin.slice(admin.indexOf("async function saveSection(event)"),admin.indexOf("async function refreshSection("));
 assert.match(f,/catch \(error\) \{[\s\S]+return; \/\/ Preservar o formulário/);
 assert.match(f,/adminState\.sectionView = "list"/);
 assert.ok(f.indexOf("clearAdminFormDirty")>f.indexOf("await adminSaveSection"));
});
test("Loader centralizado na viewport dinâmica e lista responsiva",()=>{
 assert.match(css,/\.admin-shell-loading \{\s*min-height: 100dvh;\s*height: 100dvh;\s*display: grid;\s*place-items: center/);
 assert.match(css,/\.section-workspace-tabs \{/);
 assert.match(css,/\.section-records-table thead \{ display: none; \}/);
 assert.match(css,/\.section-records-empty \{/);
});
