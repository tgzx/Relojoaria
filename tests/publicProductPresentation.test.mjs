import assert from "node:assert/strict";
import { getPublicProductDescription, getPublicProductAttributes } from "../js/utils.js";

assert.equal(
  getPublicProductDescription({
    name: "Orient Field Automatic",
    short_description: "Orient Field Automatic",
    description: "Orient Field Automatic cadastrado a partir das informações enviadas pelo cliente. Valor: R$ 1.798,00."
  }),
  "Orient Field Automatic"
);
assert.equal(
  getPublicProductDescription({ description: "Movimento automático e caixa de aço.", short_description: "Relógio" }),
  "Movimento automático e caixa de aço."
);
assert.deepEqual(
  getPublicProductAttributes({ origem: "cadastro inicial cliente", fonte: "WhatsApp João Antônio", parcelamento: "8x sem juros" }),
  [["parcelamento", "8x sem juros"]]
);
console.log("PASS 3/3 public product presentation checks");
