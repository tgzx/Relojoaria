import test from "node:test";
import assert from "node:assert/strict";

import { getOrderedProductImages, getPrimaryImage } from "../js/utils.js";

test("principal vem primeiro mesmo com sort_order maior", () => {
  const product = {
    images: [
      { id: "a", image_url: "a.jpg", is_primary: false, sort_order: 0 },
      { id: "b", image_url: "b.jpg", is_primary: true, sort_order: 99 }
    ]
  };

  const ordered = getOrderedProductImages(product);

  assert.equal(ordered[0].id, "b");
  assert.equal(getPrimaryImage(product), "b.jpg");
});

test("ordenacao nao altera o array original", () => {
  const product = {
    images: [
      { id: "b", image_url: "b.jpg", is_primary: true, sort_order: 2 },
      { id: "a", image_url: "a.jpg", is_primary: false, sort_order: 1 }
    ]
  };
  const originalIds = product.images.map((image) => image.id);

  getOrderedProductImages(product);

  assert.deepEqual(product.images.map((image) => image.id), originalIds);
});

test("produto sem imagem usa placeholder", () => {
  assert.equal(getPrimaryImage({ images: [] }), "./assets/placeholders/product-placeholder.svg");
  assert.equal(getPrimaryImage({}), "./assets/placeholders/product-placeholder.svg");
});
