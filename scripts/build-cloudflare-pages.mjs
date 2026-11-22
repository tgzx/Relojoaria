import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destination = resolve(process.argv[2] || join(tmpdir(), "vitrinezap-cloudflare-pages"));
const sourceConfig = await readFile(join(root, "js", "config.js"), "utf8");
const expectedProject = "qufuwkgtkblevayhpjsb";
if (!sourceConfig.includes(`https://${expectedProject}.supabase.co`) ||
    !sourceConfig.includes('STORE_SLUG: "J-Gold-Relojoaria"') ||
    /SERVICE_ROLE|SUPABASE_SECRET_KEY|COLE_AQUI/.test(sourceConfig)) {
  throw new Error("Config local publica ausente, invalida ou apontando ao Supabase incorreto.");
}
const publicKey = sourceConfig.match(/SUPABASE_ANON_KEY:\s*"([^"]+)"/)?.[1];
if (!publicKey || publicKey.length < 25) {
  throw new Error("Anon/publishable key publica do Supabase nao configurada.");
}

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const file of ["index.html", "admin.html", "offline.html", "service-worker.js"]) {
  await cp(join(root, file), join(destination, file));
}
for (const folder of ["assets", "css", "js"]) {
  await cp(join(root, folder), join(destination, folder), { recursive: true });
}
const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
manifest.name = "J Gold Relojoaria";
manifest.short_name = "J Gold";
manifest.description = "Catalogo da J Gold Relojoaria com atendimento via WhatsApp.";
await writeFile(join(destination, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");

const headers = [
  "/",
  "  Cache-Control: no-cache",
  "/index.html",
  "  Cache-Control: no-cache",
  "/admin.html",
  "  Cache-Control: no-store",
  "/js/config.js",
  "  Cache-Control: no-store",
  "/js/admin.js",
  "  Cache-Control: no-store",
  "/css/admin.css",
  "  Cache-Control: no-store",
  "/service-worker.js",
  "  Cache-Control: no-cache",
  "/*",
  "  X-Content-Type-Options: nosniff",
  "  Referrer-Policy: strict-origin-when-cross-origin",
  ""
].join("\n");
await writeFile(join(destination, "_headers"), headers, "utf8");
console.log("Cloudflare build pronto:", destination);
console.log("Config publico validado: Supabase cliente e slug J Gold; chave nao exibida.");