import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "css", "admin.css"), "utf8");
const source = readFileSync(join(root, "js", "admin.js"), "utf8")
  .replace(/^import\b[\s\S]*?;\s*$/gm, "")
  .replace(/^\s*initAdmin\(\);\s*$/m, "");
const artifactDir = join(root, "qa-visual-artifacts");
mkdirSync(artifactDir, { recursive: true });

const helpers = [
  "const APP_CONFIG = {};",
  "const manualSectionPicker = { markup: () => '<div class=\"manual-section-product-picker\">Seletor de produtos (mock de QA)</div>', reset: () => {}, bind: () => {} };",
  "const escapeHtml = (v) => String(v ?? '').replace(/[&<>\"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', \"'\": '&#39;' }[c]));",
  "const qs = (s, r=document) => r.querySelector(s);",
  "const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));",
  "const formatDateTime = (s) => String(s || '');",
  "const formatCurrency = (v) => 'R$ ' + String(v || 0);",
  "const STORE_THEME_OPTIONS = [{value: 'light', label: 'Claro'}];",
  "const getStoreThemeLabel = () => 'Claro';",
  "const getPrimaryImage = () => './assets/placeholders/product-placeholder.svg';",
  "const normalizeStoreThemeMode = (s) => s || 'light';",
  "const showToast = () => {};",
  "const slugify = (s) => String(s);",
  "const parseJsonSafe = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };",
  "const setThemeVariables = () => {};"
].join("\n");

const setup = helpers + "\n" + source + "\n" +
  "window.__qa = {state: adminState, renderSectionsManager, renderNotifications, renderAppearanceManager, openPasswordChangeModal, closePasswordChangeModal, openBusinessHoursEditor, closeBusinessHoursEditor};";

const browser = await chromium.launch({ headless: true });
const fixtures = [
  { name: "sections-records", widths: [320, 375, 390, 430, 768, 1440], action: "sections-records" },
  { name: "sections-editor", widths: [320, 390, 1440], action: "sections-editor" },
  { name: "notification-form", widths: [320, 375, 390, 430, 768, 1440], action: "notifications" },
  { name: "banner-form", widths: [320, 375, 390, 430, 768, 1440], action: "banners" },
  { name: "hours-modal", widths: [320, 375, 390, 430, 768, 1440], action: "hours" },
  { name: "password-modal", widths: [320, 390, 1440], action: "password" },
  { name: "tab-arrows", widths: [320, 375, 390, 430], action: "arrows" }
];
const results = [];

try {
  for (const fixture of fixtures) {
    for (const width of fixture.widths) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 1 });
      const html = '<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<style>' + css + '</style></head><body><div id="admin-root"></div>' +
        '<form id="settings-form" hidden><textarea name="business_hours">{"monday":[{"start":"09:00","end":"18:00"}],"tuesday":[{"start":"09:00","end":"12:00"},{"start":"13:00","end":"18:00"}]}</textarea></form></body></html>';
      await page.setContent(html);
      await page.evaluate((code) => new Function(code)(), setup);
      const inspect = await page.evaluate((action) => {
        const state = window.__qa.state;
        state.store = { id: "test-store", name: "J Gold Relojoaria", slug: "j-gold", logo_url: "" };
        state.profile = { id: "test-user" };
        state.session = { user: { email: "qa@example.invalid" } };
        state.settings = { enable_notifications: true, locale: "pt-BR", currency: "BRL" };
        state.pushSummary = { count: 2, data: [] };
        state.sections = [
          { id: "s1", title: "Lançamentos e novidades da vitrine", slug: "novidades", layout: "horizontal_carousel", selection_mode: "manual", type: "custom", is_active: true },
          { id: "s2", title: "Promoções e descontos da semana", slug: "promocoes", layout: "grid", selection_mode: "automatic", type: "promotion", is_active: true }
        ];
        state.notifications = [
          { id: "n1", title: "Novos produtos na J Gold", body: "Confira relógios e descontos desta semana!", target_url: "https://example.com/muito-longo/para-testar-overflow/uma-pagina-com-muitos-parametros?a=1&b=2", status: "scheduled", scheduled_at: new Date().toISOString(), recurrence_rule: null },
          { id: "n2", title: "Novidades recorrentes", body: "Mensagem recorrente de teste", status: "scheduled", recurrence_rule: "daily", recurrence_next_at: new Date().toISOString() }
        ];
        state.banners = [];
        state.editingBanner = null;
        state.editingSection = { title: "", type: "custom", selection_mode: "manual", layout: "grid", is_active: true };
        const adminRoot = document.querySelector("#admin-root");
        if (action === "sections-records" || action === "sections-editor") {
          state.sectionEditorOpen = action === "sections-editor";
          adminRoot.innerHTML = window.__qa.renderSectionsManager();
        } else if (action === "notifications") {
          adminRoot.innerHTML = window.__qa.renderNotifications();
        } else if (action === "banners") {
          adminRoot.innerHTML = window.__qa.renderAppearanceManager();
        } else if (action === "hours") {
          window.__qa.openBusinessHoursEditor();
        } else if (action === "password") {
          window.__qa.openPasswordChangeModal();
        } else if (action === "arrows") {
          adminRoot.innerHTML = '<div class="admin-shell is-mobile-condensed"><main class="admin-main"><section class="admin-content">' +
            '<section class="panel-card bottom-nav"><div class="admin-tab-overflow-shell can-scroll-left can-scroll-right">' +
            '<span class="admin-tab-overflow-hint admin-tab-overflow-hint--left" aria-hidden="true">‹</span>' +
            '<div class="toolbar-actions"><button class="tab-button">Produtos</button><button class="tab-button is-active">Seções</button><button class="tab-button">Categorias</button><button class="tab-button">Marcas</button></div>' +
            '<span class="admin-tab-overflow-hint admin-tab-overflow-hint--right" aria-hidden="true">›</span>' +
            '</div></section></section></main></div>';
        }
        return { action, rendered: adminRoot.innerHTML.length > 0 || document.querySelector(".editor-shell") !== null };
      }, fixture.action);
      assert.ok(inspect.rendered, "HTML não renderizado: " + fixture.name + " " + width);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const detail = await page.evaluate((action) => {
        const candidates = document.querySelectorAll(".panel-card, .hours-day-card, .hours-time-grid, .notification-bucket, .editor-shell, .sections-records-panel");
        const overflow = Array.from(candidates).filter((e) => e.getClientRects().length && e.scrollWidth > e.clientWidth + 2)
          .map((e) => ({ selector: e.className, scrollWidth: e.scrollWidth, clientWidth: e.clientWidth }));
        const inputOverflow = Array.from(document.querySelectorAll(".hours-day-card input[type=time], .notification-form input, #banner-form input, #banner-form select"))
          .filter((e) => e.getClientRects().length).filter((e) => {
            const host = e.closest(".hours-day-card, .panel-card");
            if (!host) return false;
            const a = e.getBoundingClientRect(), b = host.getBoundingClientRect();
            return a.left < b.left - 2 || a.right > b.right + 2;
          }).map((e) => ({ name: e.name || e.type, x: e.getBoundingClientRect().x, width: e.getBoundingClientRect().width }));
        let arrow = null;
        if (action === "arrows") {
          const left = document.querySelector(".admin-tab-overflow-hint--left").getBoundingClientRect();
          const right = document.querySelector(".admin-tab-overflow-hint--right").getBoundingClientRect();
          const button = document.querySelector(".tab-button").getBoundingClientRect();
          const center = (r) => r.top + r.height / 2;
          arrow = { leftDelta: Math.abs(center(left) - center(button)), rightDelta: Math.abs(center(right) - center(button)) };
        }
        return { overflow, inputOverflow, arrow };
      }, fixture.action);
      assert.deepEqual(detail.overflow, [], "container com overflow: " + fixture.name + "/" + width + " " + JSON.stringify(detail.overflow));
      assert.deepEqual(detail.inputOverflow, [], "input ultrapassou cartão: " + fixture.name + "/" + width + " " + JSON.stringify(detail.inputOverflow));
      if (detail.arrow) {
        assert.ok(detail.arrow.leftDelta <= 8 && detail.arrow.rightDelta <= 8, "setas desalinhadas: " + JSON.stringify(detail.arrow));
      }
      await page.screenshot({ path: join(artifactDir, fixture.name + "-" + width + ".png"), fullPage: false });
      results.push({ fixture: fixture.name, width, ...detail });
      await page.close();
    }
  }
} finally {
  await browser.close();
}
console.log("QA visual de componentes reais renderizados: " + results.length + " viewports/estados, zero overflow detectado.");
console.log(JSON.stringify(results.map(({fixture,width,arrow}) => ({fixture,width,arrow})), null, 2));
