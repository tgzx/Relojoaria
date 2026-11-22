import { adminSearchSectionProducts } from "./storeApi.js";
import { escapeHtml } from "./utils.js";

export const MANUAL_SECTION_PAGE_SIZE = 12;

// O Map preserva a seleção inteira, independentemente das páginas carregadas.
let state = null;
let searchTimer = 0;
const e = escapeHtml;

function initialize(section = {}) {
  const key = String(section.id || "__new__");
  if (state?.key === key) return;
  if (searchTimer) window.clearTimeout(searchTimer);
  const selected = new Map();
  for (const item of section.section_products || []) {
    const id = String(item.product_id || "");
    if (!id || selected.has(id)) continue;
    selected.set(id, {
      id,
      name: String(item.product?.name || "Produto selecionado"),
      sku: String(item.product?.sku || "")
    });
  }
  state = {
    key, selected, search: "", page: 0, pageSize: MANUAL_SECTION_PAGE_SIZE,
    rows: [], total: 0, loaded: false, loading: false, error: "", requestSeq: 0
  };
}

function selectedHtml() {
  if (!state.selected.size) return '<p class="manual-products-empty">Nenhum produto selecionado ainda.</p>';
  return [...state.selected.values()].map(product =>
    '<div class="manual-product-selected-row">' +
      '<span class="manual-product-selected-name" title="' + e(product.name) + '">' + e(product.name) + '</span>' +
      '<button type="button" data-unselect-manual-product="' + e(product.id) +
        '" aria-label="Remover ' + e(product.name) + ' da seção">Remover</button>' +
    '</div>'
  ).join("");
}

function resultsHtml() {
  if (state.loading) return '<p class="manual-products-empty" role="status">Buscando produtos…</p>';
  if (state.error) return '<div class="manual-products-error" role="alert">' +
    e(state.error) + ' <button type="button" data-manual-retry>Repetir busca</button></div>';
  if (!state.loaded) return '<p class="manual-products-empty">Abra a seleção para buscar no catálogo.</p>';
  if (!state.rows.length) return '<p class="manual-products-empty">Nenhum produto encontrado. Experimente outro nome.</p>';
  return state.rows.map(product =>
    '<label class="manual-product-result">' +
      '<input type="checkbox" data-manual-product-id="' + e(product.id) + '" ' +
        (state.selected.has(product.id) ? "checked" : "") + ' />' +
      '<span class="manual-product-result-copy">' +
        '<strong title="' + e(product.name) + '">' + e(product.name) + '</strong>' +
        (product.sku ? '<small>' + e(product.sku) + '</small>' : '') +
      '</span>' +
      (product.is_archived ? '<span class="manual-product-status">Arquivado</span>' :
        !product.is_active ? '<span class="manual-product-status">Rascunho</span>' : '') +
    '</label>'
  ).join("");
}

function update() {
  const root = document.querySelector("#section-manual-picker");
  if (!root || !state) return;
  root.querySelector("#manual-products-selected").innerHTML = selectedHtml();
  root.querySelector("#manual-products-results").innerHTML = resultsHtml();
  root.querySelector("#manual-products-selected-count").textContent = String(state.selected.size);
  root.querySelector("#manual-products-selected-hint").textContent = state.selected.size > 3
    ? "Role a lista para conferir todos os produtos escolhidos." : "";
  const pages = Math.max(1, Math.ceil(state.total / state.pageSize));
  const first = state.total ? state.page * state.pageSize + 1 : 0;
  const last = Math.min(state.total, (state.page + 1) * state.pageSize);
  root.querySelector("#manual-products-page-status").textContent = state.loaded && !state.error ?
    first + "–" + last + " de " + state.total + " · Página " + (state.page + 1) + " de " + pages : "";
  root.querySelector("#manual-products-previous").disabled = state.loading || state.page <= 0;
  root.querySelector("#manual-products-next").disabled = state.loading ||
    !state.loaded || (state.page + 1) * state.pageSize >= state.total;
}

async function load(storeId) {
  if (!state || !storeId) return;
  const current = state;
  const seq = ++current.requestSeq;
  current.loading = true;
  current.error = "";
  update();
  try {
    const response = await adminSearchSectionProducts(storeId,
      { search: current.search, page: current.page, pageSize: current.pageSize, withCount: !current.loaded });
    if (state !== current || current.requestSeq !== seq) return;
    current.rows = response.data;
    current.total = response.count ?? current.total;
    current.loaded = true;
  } catch (error) {
    if (state !== current || current.requestSeq !== seq) return;
    current.error = error.message || "Falha ao carregar produtos.";
    current.loaded = false;
    current.rows = [];
    current.total = 0;
  } finally {
    if (state === current && current.requestSeq === seq) {
      current.loading = false;
      update();
    }
  }
}
function clearTimer() {
  if (searchTimer) window.clearTimeout(searchTimer);
  searchTimer = 0;
}

export const manualSectionPicker = {
  reset() {
    clearTimer();
    state = null;
  },
  selectedIds() {
    return state ? [...state.selected.keys()] : [];
  },
  markup(section) {
    initialize(section);
    const manual = section.selection_mode !== "automatic";
    return '<section id="section-manual-picker" class="manual-section-product-picker" ' +
      'aria-label="Produtos manuais da seção" ' + (manual ? '' : 'hidden') + '>' +
      '<div class="manual-section-product-header"><div><strong>Produtos manuais</strong>' +
      '<p>Pesquise no catálogo e marque os itens desta seção.</p></div>' +
      '<span class="manual-product-count"><b id="manual-products-selected-count">' +
        state.selected.size + '</b> na seção</span></div>' +
      '<div class="manual-products-chosen"><div class="manual-products-subhead">Selecionados nesta seção</div>' +
      '<div id="manual-products-selected" class="manual-products-selected-list">' + selectedHtml() + '</div>' +
      '<p id="manual-products-selected-hint" class="manual-products-selected-hint"></p></div>' +
      '<label class="admin-field manual-product-search-label" for="manual-products-query">' +
      '<span>Buscar produto pelo nome</span>' +
      '<input id="manual-products-query" type="search" autocomplete="off" maxlength="100" ' +
        'placeholder="Ex.: Orient Elegance" value="' + e(state.search) + '" /></label>' +
      '<div id="manual-products-results" class="manual-products-results">' +
        resultsHtml() + '</div>' +
      '<div class="manual-products-pager"><button type="button" id="manual-products-previous">Anterior</button>' +
      '<span id="manual-products-page-status" role="status"></span>' +
      '<button type="button" id="manual-products-next">Próxima</button></div></section>';
  },
  bind(storeId, modeInput) {
    const root = document.querySelector("#section-manual-picker");
    if (!root || !state) return;
    const search = root.querySelector("#manual-products-query");
    search.addEventListener("input", () => {
      clearTimer();
      ++state.requestSeq; // Invalida resposta anterior antes do debounce.
      state.search = search.value;
      state.page = 0;
      state.loaded = false; // Novo termo exige nova contagem; mudar página não.
      state.loading = true;
      update();
      searchTimer = window.setTimeout(() => load(storeId), 300);
    });
    root.addEventListener("change", event => {
      const checkbox = event.target.closest("[data-manual-product-id]");
      if (!checkbox || !state) return;
      const product = state.rows.find(item => String(item.id) === checkbox.dataset.manualProductId);
      if (!product) return;
      if (checkbox.checked) state.selected.set(product.id, product);
      else state.selected.delete(product.id);
      update();
      // A lista de resultados é redesenhada; devolver o foco ao mesmo checkbox.
      const next = [...root.querySelectorAll("[data-manual-product-id]")]
        .find(input => input.dataset.manualProductId === product.id);
      next?.focus({ preventScroll: true });
    });
    root.addEventListener("click", event => {
      const remove = event.target.closest("[data-unselect-manual-product]");
      if (remove && state) {
        state.selected.delete(remove.dataset.unselectManualProduct);
        update();
        root.closest("form")?.dispatchEvent(new Event("change", { bubbles: true }));
        root.querySelector("#manual-products-query")?.focus({ preventScroll: true });
        return;
      }
      if (event.target.closest("[data-manual-retry]")) { void load(storeId); return; }
      const delta = event.target.closest("#manual-products-next") ? 1 :
        event.target.closest("#manual-products-previous") ? -1 : 0;
      if (!delta || !state || state.loading) return;
      const page = state.page + delta;
      if (page < 0 || page * state.pageSize >= state.total) return;
      state.page = page;
      void load(storeId);
    });
    modeInput?.addEventListener("change", () => {
      const manual = modeInput.value === "manual";
      root.hidden = !manual;
      root.closest("form")?.querySelectorAll("[data-section-automatic-only]").forEach(node => { node.hidden = manual; });
      if (manual && !state.loaded && !state.loading) void load(storeId);
    });
    root.closest("form")?.querySelectorAll("[data-section-automatic-only]").forEach(node => {
      node.hidden = modeInput?.value !== "automatic";
    });
    update();
    if (modeInput?.value === "manual" && !state.loaded && !state.loading) void load(storeId);
  }
};
