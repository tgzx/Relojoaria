import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname,resolve,join} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const css=readFileSync(join(root,"css","styles.css"),"utf8");
const html=readFileSync(join(root,"index.html"),"utf8");
const sw=readFileSync(join(root,"service-worker.js"),"utf8");

test("Mobile: faixa de navegação mantém espaços simétricos para chips",()=>{
 const rule=css.match(/@media \(max-width: 759px\) \{([\s\S]*?)(?=\n\})/g)?.find(s=>s.includes(".section-nav-track"))||css;
 assert.match(rule,/\.section-nav\s*\{[^}]*padding:\s*12px 0\s*;/);
 assert.match(rule,/\.section-nav-track\s*\{[^}]*padding:\s*0\s*;/);
 assert.match(html,/styles\.css\?v=20261122-catalog-nav-balance/);
 assert.match(sw,/vitrinezap-static-v5\.25/);
 assert.match(sw,/vitrinezap-html-v6\.21/);
});
