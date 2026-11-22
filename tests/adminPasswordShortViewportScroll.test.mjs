import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname,resolve,join} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const css=readFileSync(join(root,"css","admin.css"),"utf8");
const html=readFileSync(join(root,"admin.html"),"utf8");

test("Modal Alterar senha permite scroll interno quando teclado ou viewport reduzem altura",()=>{
  assert.match(css,/\.admin-modal-shell\s*\{[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\) auto/s);
  const block=css.match(/\.password-change-shell \.panel-form\s*\{([^}]+)\}/)?.[1];
  assert.ok(block,"Regra específica de rolagem do formulário de senha presente");
  assert.match(block,/min-height:\s*0/);
  assert.match(block,/overflow-y:\s*auto/);
  assert.match(block,/overscroll-behavior:\s*contain/);
  assert.match(html,/admin\.css\?v=20261122-password-scroll-short/,"CSS com versão nova para invalidar cache");
});
