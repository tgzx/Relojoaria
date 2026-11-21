# Guia de qualidade UI/UX — J Gold / VitrineZap

Guia de manutenção da vitrine e do admin. Complementa o caderno operacional `<Documentos>/AI_Planejamento_de_Trabalho/vitrinezap-refinamento-ux-ui-2026-11-21/01_GUIA_UX_UI_JGOLD.md`. Revisado em 21/11/2026 com W3C, MDN, Baymard, Nielsen Norman Group e web.dev.

## Preservar o design existente
- **Não alterar paleta e temas configurados**. Tokens-base claros: preto `#111111`, off-white `#fafaf8` e dourado `#bca98b`. **Tema ativo na produção** (por configuração): fundo preto `#0b0b0b/#080808`, texto `#f5f5f0`, dourado `#d4af37`. Há tema dinâmico; todas as cores novas dependem dos tokens `--color-*` ou `--admin-*`.
- Vitrine minimalista e cantos majoritariamente retos; admin mantém raios moderados e a mesma família de cores. Evitar novas bibliotecas, fontes, gradientes chamativos e componentes desconexos.
- Definir estados hover/foco/disabled/erro com contraste; alvo de toque preferencialmente >=44px, sem sacrificar legibilidade em 320px.

## Componentes de interface
- **Modais/drawers:** `role="dialog"`, `aria-modal`, título acessível; mover foco para dentro na abertura, bloquear interações no fundo, Tab/Shift+Tab circulam dentro, Escape fecha pelo handler correto, devolver foco ao gatilho. Em admin, preservar guardas de descarte de rascunho ao acionar X/ESC.
- **Scroll de modal:** rolagem interna com `min-height:0`, `overflow-y:auto`, `overscroll-behavior:contain`, `100dvh` e `env(safe-area-inset-bottom)` no mobile. Conteúdo e rodapés sempre alcançáveis, fundo travado. Não esconder scrollbar vertical em conteúdo significativo.
- **Select/combobox:** preferir `<select>` nativo e decorar o campo fechado (seta, fundo, borda, estado de foco). O popup do sistema operacional pode continuar com a aparência nativa; isso é intencional para acessibilidade e comportamento mobile. Combobox custom só com contrato completo ARIA e teclado implementado.
- **Scrollbars:** colorir discretamente thumb/track usando tokens do tema e CSS moderno `scrollbar-color/scrollbar-width` com fallback WebKit; preservar `forced-colors`, rolagem touch e setas/teclado.
- **Filtros da vitrine:** exibir chips com critérios aplicados, oferecer remoção por critério, feedback de busca e estado vazio; não alterar catálogo sem confirmação, não disparar requisições duplicadas.
- **Layout:** conferir 1440px, 390px e 320px; nada de overflow horizontal, foco escondido, sticky footer cobrindo formulário, teclados virtuais ou links que abrem vazios. Animações devem respeitar `prefers-reduced-motion`.

## Checklist de QA antes de publicação
1. `git status` / branch/repo e diff revisados; `node --check js/app.js`, `js/admin.js`, `service-worker.js`; testes `tests/*.mjs`; `git diff --check`.
2. Playwright no domínio local e depois em produção: 5 cards, busca/filtros, chips, modal/Escape/foco, 320/390/1440, 0 erros JS e HTTP. Teste acessibilidade sem usar indevidamente ARIA para simulador visual.
3. Comparar tokens de cores renderizados antes/depois (não confiar apenas em `:root` do CSS). Testar modo escuro aplicado pela configuração.
4. Validar SW atualizado, carregamento online/offline/reconexão e cache; manter URLs Supabase, Auth/Storage e recursos do cliente. Não inferir sucesso do admin CRUD sem sessão autenticada autorizada.
5. Publicar na **Cloudflare Pages da conta Hotmail** (`j-gold-relojoaria-oficial`, Wrangler perfil `jgold`) apenas após QA local, depois homologar domínio publicado. Manter site antigo Gmail para contingência até aceite.

## Referências
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [WAI-ARIA Modal Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [WAI-ARIA Combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
- [MDN — `select`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/select)
- [MDN — Scrollbars](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scrollbars_styling)
- [Baymard — Applied Filters](https://baymard.com/research-articles/how-to-design-applied-filters)
- [Nielsen Norman — heurísticas](https://www.nngroup.com/articles/ten-usability-heuristics/)
- [web.dev — Core Web Vitals](https://web.dev/articles/vitals)
