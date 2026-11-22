import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname,resolve,join} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const admin=readFileSync(join(root,"js","admin.js"),"utf8");
const css=readFileSync(join(root,"css","admin.css"),"utf8");

test("abas horizontais têm indicadores sobrepostos para ambos os sentidos",()=>{
 assert.match(admin,/class="admin-tab-overflow-shell"/);
 assert.match(admin,/admin-tab-overflow-hint--left/);
 assert.match(admin,/admin-tab-overflow-hint--right/);
 assert.match(css,/\.admin-tab-overflow-shell \{\s*position: relative;\s*min-width: 0/);
 assert.match(css,/\.admin-tab-overflow-hint \{\s*display: none;\s*pointer-events: none;/);
});
test("indicadores só aparecem onde há overflow correspondente",()=>{
 const bind=admin.slice(admin.indexOf("function bindMobileTabOverflowHints()"),admin.indexOf("function bindMobileAdminChrome()"));
 assert.match(bind,/maxScroll = Math\.max\(0, strip\.scrollWidth - strip\.clientWidth\)/);
 assert.match(bind,/mobileOverflow = window\.matchMedia\("\(max-width: 759px\)"\)\.matches && maxScroll > 3/);
 assert.match(bind,/can-scroll-left", mobileOverflow && strip\.scrollLeft > 2/);
 assert.match(bind,/can-scroll-right", mobileOverflow && strip\.scrollLeft < maxScroll - 2/);
 assert.match(css,/\.admin-tab-overflow-shell\.can-scroll-left/);
 assert.match(css,/\.admin-tab-overflow-shell\.can-scroll-right/);
});
test("re-render fecha listeners/observers anteriores e preserva navegação",()=>{
 const bind=admin.slice(admin.indexOf("function bindMobileTabOverflowHints()"),admin.indexOf("function bindMobileAdminChrome()"));
 assert.match(bind,/window\.__adminTabsOverflowCleanup\?\.\(\)/);
 assert.match(bind,/new AbortController\(\)/);
 assert.match(bind,/new ResizeObserver\(update\)/);
 assert.match(bind,/controller\.abort\(\)/);
 assert.match(bind,/resizeObserver\?\.disconnect\(\)/);
 assert.match(bind,/scrollLeft = adminState\.mobileTabScrollLeft/);
});
