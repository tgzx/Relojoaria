import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,dirname,join} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const html=readFileSync(join(root,"index.html"),"utf8");
const admin=readFileSync(join(root,"admin.html"),"utf8");
const css=readFileSync(join(root,"css/styles.css"),"utf8");

test("Crédito público é a última seção do rodapé, sem alterar links comerciais",()=>{
 const start=html.indexOf('<footer class="site-footer">');
 const end=html.indexOf("</footer>",start);
 assert.ok(start>=0&&end>start);
 const footer=html.slice(start,end);
 assert.match(footer,/id="footer-instagram"/);
 assert.match(footer,/id="footer-whatsapp"/);
 assert.match(footer,/class="footer-credit"/);
 assert.ok(footer.indexOf('class="footer-credit"')>footer.indexOf('class="footer-actions"'));
 assert.match(footer,/© 2026 J Gold Relojoaria/);
 assert.match(footer,/Desenvolvido por/);
 assert.match(footer,/<span>@tiagoreira<\/span>/);
 assert.doesNotMatch(admin,/footer-credit|@tiagoreira/);
});

test("Link do Instagram une o ícone e o @ com abertura segura",()=>{
 const anchor=html.match(/<a class="footer-credit__link"[^>]*>[\s\S]*?<\/a>/)?.[0];
 assert.ok(anchor,"link encontrado");
 assert.match(anchor,/href="https:\/\/www\.instagram\.com\/tiagoreira\/"/);
 assert.match(anchor,/target="_blank"/);
 assert.match(anchor,/rel="noopener noreferrer"/);
 assert.match(anchor,/aria-label="Instagram do desenvolvedor @tiagoreira/);
 assert.match(anchor,/<svg[^>]*aria-hidden="true"/);
 assert.match(anchor,/<span>@tiagoreira<\/span>/);
});

test("Assinatura é centralizada, responsiva e tem foco visível",()=>{
 assert.match(css,/\.footer-shell \{[\s\S]*?flex-wrap: wrap/);
 assert.match(css,/\.footer-credit \{[\s\S]*?flex: 1 0 100%/);
 assert.match(css,/\.footer-credit \{[\s\S]*?justify-items: center/);
 assert.match(css,/\.footer-credit__author \{[\s\S]*?justify-content: center/);
 assert.match(css,/\.footer-credit__link:focus-visible \{[\s\S]*?outline: 2px solid currentColor/);
 assert.match(css,/\.footer-shell \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1fr\);/);
 assert.match(html,/\.\/css\/styles\.css\?v=20261122-footer-credit-v2/);
});