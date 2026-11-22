/*
 * Ajuda contextual dos formulários do painel. Sem dependências e sem alteração
 * dos valores/validação de formulários: decoração idempotente do DOM.
 * Botão de ajuda fica FORA de <label>; o balão fica em portal para não ser
 * cortado por modais roláveis.
 */
const GUIDE = {
  "login-form": {
    email: ["Ex.: joao@loja.com", "Informe o e-mail cadastrado para acessar a administração."],
    password: ["", "Use a senha da sua conta. Para criar outra, escolha 'Esqueci minha senha'."]
  },
  "password-reset-form": {
    email: ["Ex.: joao@loja.com", "Enviaremos um link de redefinição para este e-mail, se estiver cadastrado."]
  },
  "password-update-form": {
    password: ["", "Crie uma senha nova respeitando o mínimo de caracteres indicado."],
    confirmPassword: ["", "Digite novamente a mesma senha para confirmar."]
  },
  "password-change-form": {
    password: ["", "Escolha uma senha exclusiva para sua conta de administração."],
    confirmPassword: ["", "Repita exatamente a senha escolhida."]
  },
  "products-filter-form": {
    search: ["Ex.: Orient Sport", "Filtra os produtos por nome, código ou palavra-chave."],
    status: ["", "Selecione um status para restringir os produtos apresentados."],
    categoryId: ["", "Mostra produtos associados à categoria escolhida."],
    brandId: ["", "Mostra produtos associados à marca escolhida."],
    sectionId: ["", "Filtra os produtos por seção da vitrine."]
  },
  "product-editor-form": {
    name: ["Ex.: Orient Elegance Crono", "Nome público do produto, exibido no card e nos detalhes da vitrine."],
    slug: ["Ex.: orient-elegance-crono", "Identificador da URL do produto. Utilize letras minúsculas e hífens."],
    sku: ["Ex.: ORIENT-ELEGANCE-CRONO", "Código interno que ajuda a identificar o produto no estoque e no atendimento."],
    short_description: ["Ex.: Relógio de aço com mostrador azul", "Resumo curto mostrado no card do produto."],
    description: ["Ex.: Caixa em aço, pulseira metálica e movimento automático", "Apresente características e diferenciais que ajudam o cliente a decidir."],
    price: ["Ex.: 1598.00", "Preço atual de venda em reais. No campo numérico, utilize ponto para centavos quando necessário."],
    old_price: ["Ex.: 1898.00", "Preço anterior, exibido riscado quando preenchido."],
    cost_price: ["Ex.: 900.00", "Valor interno do custo. Não é apresentado ao visitante."],
    stock_quantity: ["Ex.: 5", "Quantidade disponível; combine com o status de estoque."],
    stock_status: ["", "Determina a mensagem de disponibilidade na vitrine."],
    category_id: ["", "Categoria que organiza o produto na vitrine e nos filtros."],
    brand_id: ["", "Marca associada ao produto."],
    tags: ["Ex.: automático, aço, azul", "Separe palavras-chave por vírgulas para facilitar a organização."],
    attributes: ['Ex.: {"material":"aço"}', "Modo avançado: objeto JSON válido com características. Prefira o editor de opções acima."],
    variants: ['Ex.: [{"nome":"Prata"}]', "Modo avançado: lista JSON válida de variações. Prefira o editor de opções acima."],
    sort_order: ["Ex.: 10", "Número usado para organizar a ordem dos produtos."],
    is_active: ["", "Define se o produto fica ativo no catálogo."],
    is_featured: ["", "Destaca o produto na vitrine principal."],
    is_promotion: ["", "Identifica o produto como promoção."],
    is_new: ["", "Exibe o selo de novidade no produto."],
    is_best_seller: ["", "Exibe o selo de mais vendido."],
    allow_whatsapp_cta: ["", "Permite o botão de WhatsApp quando houver número comercial configurado."]
  },
  "section-form": {
    title: ["Ex.: Lançamentos", "Título da seção exibido aos visitantes."],
    slug: ["Ex.: lancamentos", "Identificador estável da seção; use letras minúsculas e hífens."],
    description: ["Ex.: Modelos que acabaram de chegar", "Texto complementar opcional da seção."],
    type: ["Ex.: manual", "Tipo de seção usado para organizar os produtos."],
    sort_order: ["Ex.: 1", "Ordem de exibição da seção na vitrine."],
    selection_mode: ["", "Escolhe como os produtos entram na seção."],
    layout: ["", "Define a disposição visual dos produtos."],
    automatic_rule: ["", "Regra que escolhe produtos automaticamente."],
    refresh_frequency: ["", "Frequência de atualização da seleção automática."],
    max_items: ["Ex.: 8", "Máximo de produtos mostrados nesta seção."],
    automatic_params: ['Ex.: {"limit":8}', "Parâmetros avançados da regra automática em JSON válido."],
    is_active: ["", "Se desligado, a seção não aparece na vitrine."]
  },
  "option-group-form": {
    type: ["", "Característica informa atributos; variação apresenta escolhas do produto."],
    input_type: ["", "Como o usuário informa ou seleciona o valor."],
    name: ["Ex.: Material da pulseira", "Nome apresentado ao cliente na ficha do produto."],
    slug: ["Ex.: material-pulseira", "Identificador técnico do grupo."],
    description: ["Ex.: Escolha a composição da pulseira", "Explicação da finalidade deste grupo de opções."],
    sort_order: ["Ex.: 1", "Posição do grupo na lista."],
    is_active: ["", "Indica se o grupo fica disponível."],
    show_on_product: ["", "Permite exibir o grupo na ficha do produto."],
    allow_custom_value: ["", "Permite digitar um valor não cadastrado."],
    use_as_filter: ["", "Reserva esta opção para uso como filtro no futuro."],
    is_required: ["", "Indica que o grupo deve ser preenchido no cadastro do produto, segundo as regras de opções."]
  },
  "option-value-form": {
    group_id: ["", "Grupo a que este valor pertence."],
    label: ["Ex.: Aço inoxidável", "Texto visível para quem escolhe o valor."],
    value: ["Ex.: aco-inoxidavel", "Código técnico opcional do valor."],
    description: ["Ex.: Pulseira em aço inox", "Informação adicional para este valor."],
    sort_order: ["Ex.: 1", "Posição do valor entre as opções."],
    is_active: ["", "Disponibiliza ou oculta este valor."]
  },
  "category-form": {
    name: ["Ex.: Relógios", "Nome exibido no menu e nos filtros da vitrine."],
    slug: ["Ex.: relogios", "Identificador da categoria, usado em URLs e integrações."],
    description: ["Ex.: Modelos masculinos e femininos", "Explica os tipos de produtos da categoria."],
    image_url: ["Ex.: https://site.com/foto.webp", "URL pública de uma imagem representativa da categoria."],
    sort_order: ["Ex.: 1", "Posição de exibição no catálogo."],
    is_active: ["", "Se desligada, esta categoria deixa de ser oferecida ao público."]
  },
  "brand-form": {
    name: ["Ex.: Orient", "Nome da marca exibido na vitrine."],
    slug: ["Ex.: orient", "Identificador técnico da marca."],
    logo_url: ["Ex.: https://site.com/orient.png", "URL pública da logomarca."],
    sort_order: ["Ex.: 1", "Posição da marca na listagem."],
    is_featured: ["", "Realça a marca nos destaques da vitrine."],
    is_active: ["", "Disponibiliza a marca para seleção."]
  },
  "banner-form": {
    title: ["Ex.: Coleção 2026", "Título do destaque principal da vitrine."],
    subtitle: ["Ex.: Elegância para todos os momentos", "Complemento do título no banner."],
    image_url: ["Ex.: https://site.com/banner.webp", "Imagem pública do banner; confira o enquadramento na prévia."],
    theme_preset: ["", "Aparência visual aplicada a este banner."],
    image_position: ["", "Localiza o ponto de destaque da imagem."],
    image_fit: ["", "Ajusta o preenchimento da imagem no espaço disponível."],
    overlay_strength: ["", "Intensidade da camada escura ou clara sobre a imagem para facilitar leitura."],
    image_brightness: ["", "Ajusta o brilho da imagem do banner."],
    image_contrast: ["", "Ajusta o contraste da imagem do banner."],
    target_url: ["Ex.: https://loja.com/colecao", "Endereço aberto quando o visitante clica no destaque."],
    target_type: ["Ex.: hero", "Categoria técnica do destino do banner."],
    sort_order: ["Ex.: 1", "Posição do banner entre os demais."],
    is_active: ["", "Define se o banner pode aparecer."],
    starts_at: ["", "Agendamento opcional do início da exibição."],
    ends_at: ["", "Agendamento opcional do fim da exibição."]
  },
  "notification-form": {
    title: ["Ex.: Novidades na vitrine", "Título da notificação recebida pelo visitante."],
    body: ["Ex.: Confira os lançamentos da semana", "Mensagem curta que acompanha a notificação."],
    target_url: ["Ex.: https://loja.com/#produtos", "Página aberta quando o cliente toca na notificação."],
    scheduled_at: ["", "Data e horário de envio agendado; deixe vazio se não precisar."],
    recurrence_rule: ["", "Regra de repetição para notificações recorrentes."]
  },
  "settings-form": {
    store_name: ["Ex.: J Gold Relojoaria", "Nome público da loja mostrado no cabeçalho."],
    slug: ["Ex.: j-gold-relojoaria", "Identificador único usado pelo sistema para localizar esta loja."],
    slogan: ["Ex.: Tempo, estilo e elegância", "Frase curta de apresentação da marca."],
    description: ["Ex.: Relojoaria especializada em modelos exclusivos", "Apresentação da loja para visitantes."],
    logo_url: ["Ex.: https://site.com/logo.webp", "Imagem pública da marca usada no cabeçalho."],
    whatsapp_number: ["Ex.: 5586999999999", "Número comercial com DDI 55 e DDD; habilita os botões de atendimento."],
    instagram_url: ["Ex.: https://instagram.com/jgold", "Endereço completo do perfil da loja no Instagram."],
    whatsapp_default_message: ["Ex.: Olá! Gostaria de conhecer os relógios.", "Mensagem pré-preenchida ao iniciar uma conversa no WhatsApp."],
    address: ["Ex.: Centro, Teresina - PI", "Localização ou informações de endereço mostradas ao público."],
    business_hours: ['Ex.: {"segunda":{"closed":false}}', "Horários em JSON: prefira o editor de horários para evitar erros de formato."],
    primary_color: ["", "Cor principal do visual da vitrine, usada nas áreas de maior destaque."],
    secondary_color: ["", "Cor de detalhes, botões e ícones, inclusive os X de fechar."],
    theme_mode: ["", "Define a atmosfera clara/escura da vitrine."],
    intro_mode: ["", "Escolhe a apresentação inicial da vitrine."],
    hero_mode: ["", "Escolhe o destaque principal da página."],
    currency: ["Ex.: BRL", "Código ISO de três letras para a moeda usada nos preços."],
    locale: ["Ex.: pt-BR", "Idioma e formato regional para valores e datas."],
    enable_notifications: ["", "Ativa o recurso de notificações para os visitantes."],
    enable_favorites: ["", "Mostra a opção de favoritar produtos."],
    enable_future_cart_flag: ["", "Flag experimental. O carrinho ainda não finaliza compras; não habilite em produção sem validar."]
  }
};
const FIELD_TYPES_WITHOUT_PLACEHOLDER = new Set([
  "checkbox", "radio", "file", "color", "range", "hidden", "time", "date", "datetime-local",
  "month", "week", "button", "submit"
]);
const wrapCandidates = "label.admin-field";
let currentButton = null;
let helpPanel = null;
let framePending = false;
let serial = 0;

function titleOf(label, field) {
  const span = label.querySelector(":scope > span");
  const labelText = span?.textContent || label.textContent || "";
  return labelText.replace(/\s*\*+\s*$/, "").trim() || field.name || "Campo";
}
function normalizeName(value) {
  return String(value || "").toLocaleLowerCase("pt-BR");
}
function findMetadata(label, field) {
  // HTMLFormElement.id pode ser mascarado por um input name="id" (cadastros com chave oculta).
  // Ler o atributo evita receber o próprio nó em vez da string ID do formulário.
  const form = field.closest("form")?.getAttribute("id") || "";
  const name = field.getAttribute("name") || field.getAttribute("data-hours-morning-start") && "hours-morning-start" ||
    field.getAttribute("data-hours-morning-end") && "hours-morning-end" ||
    field.getAttribute("data-hours-afternoon-start") && "hours-afternoon-start" ||
    field.getAttribute("data-hours-afternoon-end") && "hours-afternoon-end" ||
    field.id || "";
  const match = GUIDE[form]?.[name];
  if (match) return { example: match[0], help: match[1] };
  const title = titleOf(label, field);
  const t = normalizeName(title);
  if (field.type === "time") {
    return { example: "", help: "Selecione o horário neste dia. Use o segundo turno somente se houver pausa." };
  }
  if (field.type === "file") {
    return { example: "", help: "Escolha um arquivo do seu dispositivo. Confira a prévia antes de salvar." };
  }
  if (field.type === "checkbox") {
    return { example: "", help: "Ative ou desative esta opção e salve para aplicar a configuração." };
  }
  if (field.type === "color") {
    return { example: "", help: "Selecione uma cor e observe o resultado na prévia da vitrine." };
  }
  if (field.tagName === "SELECT") {
    return { example: "", help: "Selecione uma das opções disponíveis para " + t + "." };
  }
  if (field.type === "number" || field.type === "range") {
    return { example: field.type === "range" ? "" : "Ex.: 10", help: "Informe o valor numérico correspondente a " + t + "." };
  }
  if (field.type === "url") {
    return { example: "Ex.: https://site.com/exemplo", help: "Informe um endereço completo que comece por https://." };
  }
  if (field.type === "email") {
    return { example: "Ex.: usuario@loja.com", help: "Informe um endereço de e-mail válido." };
  }
  if (field.type === "password") {
    return { example: "", help: "Digite sua senha. O conteúdo não será mostrado na tela." };
  }
  if (field.tagName === "TEXTAREA") {
    return { example: "Ex.: Informações úteis sobre " + t, help: "Descreva " + t + " com clareza para facilitar o entendimento." };
  }
  return { example: "Ex.: " + title, help: "Informe " + t + " conforme a finalidade deste cadastro." };
}
function decorateLabel(label) {
  if (label.dataset.adminHelpReady) return;
  const field = label.querySelector("input:not([type='hidden']), select, textarea");
  if (!field) return;
  label.dataset.adminHelpReady = "true";
  const caption = label.querySelector(":scope > span");
  const title = titleOf(label, field);
  const { example, help } = findMetadata(label, field);
  const required = field.required;

  if (caption && required) {
    const walker = document.createTreeWalker(caption, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const last = nodes.at(-1);
    if (last) last.nodeValue = last.nodeValue.replace(/\s*\*+\s*$/, "");
    const marker = document.createElement("span");
    marker.className = "admin-field-required";
    marker.setAttribute("aria-hidden", "true");
    marker.textContent = " *";
    caption.appendChild(marker);
    const sr = document.createElement("span");
    sr.className = "admin-visually-hidden";
    sr.textContent = " (obrigatório)";
    caption.appendChild(sr);
  }
  if (example && !FIELD_TYPES_WITHOUT_PLACEHOLDER.has(field.type) && !field.hasAttribute("placeholder")) {
    field.placeholder = example;
  }

  const parent = label.parentNode;
  if (!parent) return;
  const wrapper = document.createElement("div");
  wrapper.className = "admin-guided-field" + (label.classList.contains("admin-field--switch") ? " admin-guided-field--switch" : "");
  parent.insertBefore(wrapper, label);
  wrapper.appendChild(label);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "admin-field-help-trigger";
  button.textContent = "i";
  button.setAttribute("aria-label", "Ajuda: " + title);
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", "admin-field-help-popover");
  button.dataset.adminFieldHelp = help;
  wrapper.appendChild(button);
}
function decorateOptionFieldset(fieldset) {
  if (fieldset.dataset.adminHelpReady) return;
  const legend = fieldset.querySelector(":scope > legend");
  if (!legend) return;
  fieldset.dataset.adminHelpReady = "true";
  const text = legend.textContent.trim();
  const required = /\s\*$/.test(text);
  if (required) {
    legend.textContent = text.replace(/\s\*$/, "");
    const star = document.createElement("span");
    star.className = "admin-field-required";
    star.setAttribute("aria-hidden", "true");
    star.textContent = " *";
    legend.appendChild(star);
  }
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "admin-field-help-trigger admin-field-help-trigger--group";
  btn.textContent = "i";
  btn.setAttribute("aria-label", "Ajuda: " + text.replace(/\s\*$/, ""));
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", "admin-field-help-popover");
  btn.dataset.adminFieldHelp = required
    ? "Este grupo foi configurado como obrigatório. Selecione ou informe um valor antes de publicar o produto."
    : "Selecione um dos valores cadastrados ou informe outro valor quando essa opção estiver disponível.";
  fieldset.appendChild(btn);
  fieldset.querySelectorAll("input[data-product-option-custom], select[data-product-option-select]").forEach(input => {
    if (!input.getAttribute("aria-label")) input.setAttribute("aria-label", text.replace(/\s\*$/, ""));
  });
}
function decorate() {
  document.querySelectorAll(wrapCandidates).forEach(decorateLabel);
  document.querySelectorAll("fieldset.product-option-field").forEach(decorateOptionFieldset);
  if (currentButton && !currentButton.isConnected) closeHelp(false);
}
function scheduleDecorate() {
  if (framePending) return;
  framePending = true;
  requestAnimationFrame(() => {
    framePending = false;
    decorate();
  });
}
function getPanel() {
  if (helpPanel) return helpPanel;
  helpPanel = document.createElement("div");
  helpPanel.id = "admin-field-help-popover";
  helpPanel.className = "admin-field-help-popover";
  helpPanel.setAttribute("role", "tooltip");
  helpPanel.hidden = true;
  document.body.appendChild(helpPanel);
  return helpPanel;
}
function closeHelp(returnFocus = false) {
  if (!currentButton) return;
  const old = currentButton;
  old.setAttribute("aria-expanded", "false");
  old.removeAttribute("aria-describedby");
  currentButton = null;
  getPanel().hidden = true;
  if (returnFocus && old.isConnected) old.focus();
}
function positionHelp(button) {
  const panel = getPanel();
  const b = button.getBoundingClientRect();
  const width = Math.min(300, window.innerWidth - 24);
  panel.style.width = width + "px";
  panel.style.left = Math.max(12, Math.min(window.innerWidth - 12 - width, b.right - width)) + "px";
  const height = panel.offsetHeight;
  const below = b.bottom + 8;
  panel.style.top = (below + height <= window.innerHeight - 12
    ? below : Math.max(12, b.top - 8 - height)) + "px";
}
function openHelp(button) {
  if (button === currentButton) {
    closeHelp(true);
    return;
  }
  closeHelp();
  const panel = getPanel();
  panel.textContent = button.dataset.adminFieldHelp || "";
  panel.hidden = false;
  currentButton = button;
  button.setAttribute("aria-expanded", "true");
  button.setAttribute("aria-describedby", panel.id);
  positionHelp(button);
}
function init() {
  if (!document.body) return;
  getPanel();
  const observer = new MutationObserver(records => {
    if (records.some(item => item.addedNodes.length)) scheduleDecorate();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  scheduleDecorate();
  document.addEventListener("click", event => {
    const button = event.target.closest?.(".admin-field-help-trigger");
    if (button) {
      event.preventDefault();
      event.stopPropagation();
      openHelp(button);
    } else if (currentButton) {
      closeHelp();
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && currentButton) {
      event.preventDefault();
      event.stopPropagation();
      closeHelp(true);
    }
  }, true);
  window.addEventListener("resize", () => { if (currentButton) positionHelp(currentButton); });
  window.addEventListener("scroll", () => { if (currentButton) closeHelp(); }, true);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
