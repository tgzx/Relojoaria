import { escapeHtml } from "./utils.js";

export function renderAddToCartButton(product) {
  return `
    <button
      class="btn btn-secondary"
      type="button"
      data-action="future-add-to-cart"
      data-product-id="${escapeHtml(product.id)}"
    >
      Adicionar ao carrinho
    </button>
  `;
}

export function getFutureCartFeatureState(settings = {}) {
  return Boolean(settings?.enable_future_cart_flag);
}

export function createFutureCartNotice() {
  return "A estrutura para carrinho futuro já está preparada, mas o recurso ainda não foi liberado nesta loja.";
}
