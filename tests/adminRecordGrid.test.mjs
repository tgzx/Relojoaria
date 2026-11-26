import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const css=readFileSync(new URL("../css/admin.css",import.meta.url),"utf8");
test("Record cards reserve empty tracks and respond to usable panel width",()=>{
 const a='.records-display[data-records-mode="cards"] .section-records-table tbody';
 const b='.records-display[data-records-mode="cards"] .records-product-list tbody';
 assert.ok(css.includes(a+','));
 assert.ok(css.includes(b+' {'));
 for(const n of [2,4])assert.ok(css.includes('grid-template-columns: repeat('+n+', minmax(0, 1fr));'));
 assert.ok(css.includes('@container admin-record-grid (min-width: 520px)'));
 assert.ok(css.includes('@container admin-record-grid (min-width: 1000px)'));
 assert.ok(!css.includes('repeat(auto-fit,minmax(min(100%,270px),1fr))'));
 assert.ok(!css.includes('repeat(auto-fit,minmax(min(100%,290px),1fr))'));
});
