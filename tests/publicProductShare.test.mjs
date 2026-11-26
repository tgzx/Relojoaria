import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const app=readFileSync(new URL("../js/app.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../css/styles.css",import.meta.url),"utf8");
test("card and modal share a single commercial CTA and an accessible share button",()=>{
 assert.equal((app.match(/\$\{renderProductActions\(product\)\}/g)||[]).length,2);
 assert.match(app,/data-action="share-product"/);
 assert.match(app,/aria-label="Compartilhar produto"/);
 assert.doesNotMatch(app,/data-action="whatsapp-product"/);
 assert.match(app,/product\.allow_whatsapp_cta !== false/);
 assert.match(app,/incrementProductInterest\(product\.id\)/);
 assert.match(app,/currentModalProduct\?\.id === productId/);
});
test("deep links survive scroll navigation and are decoded on opening",()=>{
 assert.match(app,/encodeURIComponent\(product\.slug\)/);
 assert.match(app,/decodeURIComponent\(targetId\.slice/);
 assert.match(app,/addEventListener\("hashchange"/);
 assert.match(app,/if \(!window\.location\.hash\.startsWith\("#produto-"\)\) window\.history\.replaceState/);
 assert.match(app,/navigator\.share\(data\)/);
 assert.match(app,/navigator\.clipboard\.writeText\(url\)/);
 assert.match(app,/error\?\.name === "AbortError"/);
});
test("commercial CTA retains a contrasting white surface and share has a dedicated touch target",()=>{
 assert.match(css,/\.product-contact-actions\s*\{[^}]*minmax\(0, 1fr\) 44px/);
 assert.match(css,/\.product-contact-actions \.product-interest-button\s*\{[^}]*background: #fff; color: #111/);
 assert.match(css,/\.product-contact-actions \.btn\s*\{[^}]*min-height: 44px/);
});
 test("versioned public assets are precached using exact HTML URLs",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const sw=readFileSync(new URL("../service-worker.js",import.meta.url),"utf8");
 for(const asset of ["css/styles.css","js/app.js"]){const url=[...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(m=>m[1]).find(u=>u.includes(asset));assert.ok(url);assert.ok(sw.includes(JSON.stringify(url)),url);}
 });
