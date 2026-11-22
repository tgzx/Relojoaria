import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join,dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const admin=readFileSync(join(root,"js/admin.js"),"utf8");
const css=readFileSync(join(root,"css/admin.css"),"utf8");
const publicCss=readFileSync(join(root,"css/styles.css"),"utf8");
const adminHtml=readFileSync(join(root,"admin.html"),"utf8");
const publicHtml=readFileSync(join(root,"index.html"),"utf8");

test("Tablet conserva topbar estável, com sticky offset adaptado à altura real",()=>{
 const s=admin.slice(admin.indexOf("function bindMobileAdminChrome()"),admin.indexOf("function scrollAdminMainToTop()"));
 assert.match(s,/shell\.classList\.toggle\("is-mobile-condensed", isPhone\)/);
 assert.match(s,/getBoundingClientRect\(\)\.height/);
 assert.match(s,/new ResizeObserver\(update\)/);
 assert.doesNotMatch(s,/window\.scrollY > 96/);
 assert.match(css,/top: var\(--admin-tab-sticky-top, var\(--admin-header-height\)\)/);
});

test("Setas de navegação surgem por overflow real até 1119px e são botões clicáveis",()=>{
 const s=admin.slice(admin.indexOf("function bindMobileTabOverflowHints()"),admin.indexOf("function bindMobileAdminChrome()"));
 assert.match(s,/max-width: 1119px/);
 assert.match(s,/strip\.scrollWidth - strip\.clientWidth/);
 assert.match(s,/strip\.scrollBy\(/);
 assert.match(s,/tabIndex = enabled \? 0 : -1/);
 assert.match(admin,/aria-label="Ver próximas abas"/);
 assert.match(admin,/aria-label="Ver abas anteriores"/);
 assert.match(css,/grid-template-columns: 28px minmax\(0, 1fr\) 28px/);
});

test("Cards de Produtos têm recuo no tablet sem afetar modo Tabela",()=>{
 assert.match(css,/records-display\[data-records-mode="cards"\] \.records-product-list \.table-scroll/);
 assert.match(css,/padding-inline: clamp\(16px, 2vw, 24px\)/);
 assert.doesNotMatch(css,/records-display\[data-records-mode="table"\] \.records-product-list \.table-scroll\s*\{[^}]*padding-inline: clamp/);
});

test("Editor inline usa conteúdo de altura natural e ações após o corpo",()=>{
 assert.match(css,/\.workspace-inline-product \.product-editor-inline \{\s*height: auto;/);
 assert.match(css,/grid-template-rows: auto auto auto/);
 assert.match(css,/\.workspace-inline-product \.editor-footer \{[\s\S]*?position: relative/);
});

test("Scroll lateral é isolado do principal nos limites da sidebar",()=>{
 assert.match(css,/\.admin-sidebar \{[\s\S]*?overflow-y: auto/);
 assert.match(admin,/function bindIndependentSidebarScroll\(\)/);
 assert.match(admin,/if \(max < 1 \|\| atTop \|\| atBottom\) event\.preventDefault\(\)/);
 assert.match(admin,/bindIndependentSidebarScroll\(\);/);
});

test("Rodapé mantém celular e separa extremos no tablet; PWA fica centralizado",()=>{
 assert.match(publicCss,/@media \(min-width: 760px\) \{\s*\.footer-credit \{/);
 assert.match(publicCss,/justify-content: space-between/);
 assert.match(publicCss,/@media \(min-width: 760px\) \{\s*\.install-prompt/);
 assert.match(publicCss,/\.install-prompt__card \{\s*width: min\(420px, 100%\)/);
 assert.match(adminHtml,/admin\.css\?v=20261122-password-scroll-short/);
 assert.match(adminHtml,/admin\.js\?v=20261122-tablet-ui-final/);
 assert.match(publicHtml,/styles\.css\?v=20261122-tablet-ui-final/);
});

test("Editor de produto distribui cinco ações uniformemente no tablet sem afetar mobile",()=>{
 assert.match(css,/\.workspace-inline-product \.editor-footer-actions \{[\s\S]*?grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
 assert.match(css,/\.workspace-inline-product \.editor-footer-actions \.btn \{[\s\S]*?min-height: 48px/);
 assert.match(css,/\.workspace-inline-product #editor-cancel-button \{[\s\S]*?border-color: var\(--admin-border\)/);
 assert.match(css,/@media \(max-width: 759px\) \{[\s\S]*?\.workspace-inline-product \.editor-footer-actions \{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});
