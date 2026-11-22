import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname,resolve,join} from "node:path";
import {fileURLToPath} from "node:url";

// Contract guard only. Behavioral regression with 100 mock products:
// <Documents>/AI_Planejamento_de_Trabalho/vitrinezap-qa-ampliado-2026-11-21/98_PRODUCTS_PAGINATION_100_QA.mjs
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const api=readFileSync(join(root,"js/storeApi.js"),"utf8");
const admin=readFileSync(join(root,"js/admin.js"),"utf8");

test("A listagem geral limita cada página a 10 produtos por padrão",()=>{
 assert.match(api,/export async function adminListProducts\(storeId, filters = \{\}, \{ page = 0, pageSize = 10, withCount = true \}/);
 assert.match(api,/const from = current \* size;\s*const result = await query\.range\(from, from \+ size - 1\)/);
 assert.match(api,/\.order\("updated_at", \{ ascending: false \}\)\s*\.order\("id", \{ ascending: true \}\)/);
});

test("Filtros são aplicados no backend e o filtro de seção não depende dos primeiros produtos carregados",()=>{
 const fn=api.slice(api.indexOf("export async function adminListProducts"),api.indexOf("function sanitizeProductOptionGroupPayload"));
 assert.match(fn,/\.eq\("store_id", storeId\)/);
 assert.match(fn,/\.ilike\("name",/);
 for(const type of ["category_id","brand_id","section_products.section_id"])assert.ok(fn.includes(type));
 assert.match(fn,/section_products!inner\(section_id\)/);
});

test("Dashboard usa contadores HEAD para o catálogo inteiro",()=>{
 assert.match(api,/export async function adminGetProductCounts/);
 assert.match(api,/select\("id", \{ count: "exact", head: true \}\)/);
 const view=admin.slice(admin.indexOf("function renderDashboard()"),admin.indexOf("function renderProducts()"));
 assert.match(view,/adminState\.productCounts\.active/);
 assert.match(view,/adminState\.productCounts\.promotions/);
 assert.match(view,/adminState\.productCounts\.lowStock/);
});

test("Seleção é por página, mantém outras páginas e é limpa ao alterar filtros",()=>{
 assert.match(admin,/const togglePageSelection = \(checked\)/);
 assert.match(admin,/new Set\(\[\.\.\.adminState\.selectedProductIds, \.\.\.currentIds\]\)/);
 assert.match(admin,/adminState\.selectedProductIds\.filter\(\(id\) => !currentIds\.has\(id\)\)/);
 assert.match(admin,/adminState\.selectedProductIds = \[\]; \/\/ Novo filtro/);
 assert.match(admin,/id="products-page-previous"/);
 assert.match(admin,/id="products-page-next"/);
 assert.match(admin,/id="select-page-products"/);
});
