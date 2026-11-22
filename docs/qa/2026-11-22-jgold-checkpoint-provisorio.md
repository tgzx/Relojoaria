# Checkpoint provisório de QA — VitrineZap / J Gold Relojoaria
Data: 2026-11-22

> IMPORTANTE: esta nota fica temporariamente no repositório. **Não substitui o caderno local.**
> Destino correto após reconexão do PC:
> `<Documentos>\AI_Planejamento_de_Trabalho\vitrinezap-qa-ampliado-2026-11-21`
> Seguir `<Documentos>\AI_Memory_Vault\90_SYSTEM\AI_PREINSTRUCTION.md` e `00_INDEX.md`, ler índice do caderno, `115_TABSET_SECOES_E_LOADING_PLANO.md` e handoff antes de sincronizar este checkpoint.

## Última etapa executada
Alterações de código feitas somente na branch GitHub `fix/jgold-modal-overflow-picker-2026-11-22`, partindo de `delivery/cloudflare-jgold-2026-11-21`. **Sem merge, sem deploy, sem alteração em banco, sem push real.**

Arquivos afetados:
- `js/admin.js` — modal de senha abre sem focar input (não dispara teclado virtual prematuramente); botão Fechar recebe foco. Tipo do banner restrito a `hero` por select e valor validado no save. Tabset de Seções: primeira aba Registros com tabela, botão Criar; segunda aba só aparece ao criar/editar; ao salvar volta para Registros; tipo de Seção usa select; estado reinicia no logout.
- `css/admin.css` — setas da navegação em colunas exclusivas ao lado das abas, sem sobreposição; tabela de Seções em layout responsivo; limites de largura em cartões de horários, grade de input de horas adaptativa e contenção de campos, altura do modal em viewport mobile; notificações com quebra de linha no cabeçalho/ações; alinhamento de seletor de upload.
- `tests/adminResponsiveContracts.test.mjs` — contratos estáticos dos ajustes, inclusive tabset, seletor de tipos e setas.

## Pedidos do usuário que devem permanecer em escopo
1. Corrigir seta esquerda/direita na barra de abas mobile (print em Safari de 22/11 mostra as setas sobre as palavras).
2. Seções: aba **Registros** com tabela, botão **Criar**; só mostrar segunda aba de criação/edição depois da ação; validar antes de replicar padrão em outros objetos.
3. Cartão **Senha**: faixa branca/teclado aparece na primeira abertura no Safari iOS; hipótese forte: foco forçado no input de senha dispara teclado e desloca viewport. Validar primeira e segunda abertura no iPhone real.
4. Modal de horários: campos não podem extrapolar bordas; validar múltiplos dias, pausa, orientação mobile/desktop, teclado e scroll.
5. Notificações: inspecionar visualmente campos e botões que extrapolam, incluindo cabeçalho das listas e inputs datetime-local; revisar agendamento sem disparar notificações reais.
6. Banners: tipo predefinido nunca ser texto aberto; upload alinhado vertical/horizontalmente; conferir campos, longas URLs e botões.
7. Regra global de QA: auditar vazamento, alinhamento vertical/horizontal, tipografia, espaços, estados vazios/cheios, toasts, scroll, modais e foco nos viewports 320, 390 e desktop 1440.

## Revisão do agendamento push (somente código, sem disparos)
- Formulário: `saveNotification` salva `status=scheduled` quando houver data ou recorrência; converte `datetime-local` para ISO UTC; para recorrência usa `recurrence_next_at`; apenas passado simples tenta envio imediato.
- Workflow `.github/workflows/scheduled-push.yml`: GitHub Actions programado `*/5 * * * *`, usa secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CRON_SECRET` e invoca `/functions/v1/process-scheduled-push`.
- Edge Function `supabase/functions/process-scheduled-push/index.ts`: exige `x-cron-secret`, consulta notificações vencidas e assinaturas ativas, envia Web Push, atualiza status e próxima data recorrente.
- Riscos/pontos a verificar na conta de PRODUÇÃO Hotmail/ATSM Projects: função publicada; secrets configurados; GitHub Actions executando de fato; registro certo no banco; histórico/erros; comportamento de falhas e reenvio. O projeto de produção conhecido é `qufuwkgtkblevayhpjsb` (nome VitrineZap-JGold-Cliente-Prod). O projeto Supabase antigo `xchqcpnmynwlodbkgmzy` está INACTIVE e não serve para inferir status de produção.
- Limitação do código: não há claim/lease transacional para cada tarefa antes do push; agendadores concorrentes podem duplicar envios. Falhas viram `failed` sem retry automático. GitHub Actions schedule é best effort, não disparo garantido no segundo exato; roda na default branch.

## Testes já executados nesta rodada
- Validação de sintaxe de `js/admin.js` por compilação JS após remover imports ES: **PASS**.
- Renderização isolada de `renderSectionsManager` com mocks: registros sem formulário, criar/editar com formulário, tabela com registro/ações e tipo seletivo: **5/5 PASS**.
- Verificação estática da alteração de senha, do banner, largura de horários, quebra de notificações e upload: **5/5 PASS**.
- Não foi possível executar Playwright sobre o projeto real ou testes integrados em máquina: PC Controller respondeu erro interno mesmo após chamadas de `ps`, `list_directory` e sessão browser; checkout via GitHub no container falhou por DNS indisponível. **Nenhum print novo de QA real.**
- Não houve deploy/alteração de dados de cliente.

## Próxima ação obrigatória (não considerar concluído ainda)
1. Reabrir PC Controller; resolver `[Environment]::GetFolderPath('MyDocuments')`; ler preinstruction e índice do Vault; ler caderno e checkpoint 115. Fazer `git status` e validar raiz do repo antes de tocar no projeto. Mudanças locais do checkpoint 115 podem estar sem commit e NÃO DEVEM ser sobrescritas.
2. Comparar branch de correção remota com arquivos locais (especialmente tabset e setas do checkpoint 115), aplicar apenas o que falta cirurgicamente, mantendo trabalho local mais recente.
3. Executar testes unitários, QA visual com screenshots mobile 320/390 e desktop 1440; em Safari iOS real validar teclado/modal senha (ou pedir evidência após deploy), abrir horários, notificações, banners, tabset; medir `scrollWidth/clientWidth`, focus, `visualViewport` e detectar overflow, sem encobrir campos via overflow:hidden indiscriminado.
4. Registrar evidências e resultados no caderno local; se a bateria passar, publicar no Cloudflare `j-gold-relojoaria-oficial.pages.dev` seguindo procedimento do caderno e conferir o deploy real.
5. Verificar pipeline de agendamento na conta Supabase de produção somente com inspeção de metadados/logs; não disparar push; documentar risco e status sem assumir funcionamento.
6. Revisar `git status`, informar exatamente arquivos alterados, manter produção intacta até QA, só tocar conclusão sonora Windows após execução final bem-sucedida no PC.

## Bloqueios atuais
Acesso ao Windows/PC Controller indisponível por falha interna da ferramenta; não conseguimos ler ou atualizar fisicamente o caderno nem comparar os arquivos locais do checkpoint 115. Sem acesso confirmado à organização Supabase Hotmail da J Gold por conectores, logo pipeline de agendamento ainda **não confirmado**.

## Reorientação explícita do usuário — publicação obrigatória
- **Não confundir código corrigido com site corrigido.** O usuário quer mudanças visíveis em `https://j-gold-relojoaria-oficial.pages.dev/`, não só PR.
- `Cloudflare Pages` está em modo **Direct Upload** e **não publica por push/merge**. Procedimento confirmado em `DEPLOY_CLOUDFLARE.md`: validar projeto e conta Hotmail, gerar pacote com `node scripts/build-cloudflare-pages.mjs`, executar `wrangler pages deploy <pacote> --project-name j-gold-relojoaria-oficial --branch main --profile jgold` com ID de conta correto, sem trocar `js/config.js` de produção.
- **Agendamento de notificações: SOMENTE ANÁLISE.** Não alterar fluxo, cron, Edge Function, banco, secrets nem disparar push nesta tarefa. Correção visual de notificações permanece dentro do escopo.
- Publicação bloqueada nesta conversa: PC Controller foi testado com `ps`, `list_directory`, `browser_list_sessions` e `start_ps`; todas chamadas retornaram `The tool failed internally`. Tablet MCP retornou 429, Browser conectado exige contexto de extensão. Nenhum conector Cloudflare conectado. **Não alegar deploy ou QA online.**
- Quando acesso voltar, ler Vault e caderno local primeiro; checar git status e as alterações locais do checkpoint 115 antes de integrar o patch remoto; publicar e inspecionar UI com print real. Não tocar conta Gmail legada.

## Atualização de execução confirmada — 22/11/2026 10h47 BRT

**Correções mantidas exclusivamente no PR draft #1 / branch isolada.**

- JS: modal Senha abre com foco no botão Fechar (evita teclado automático);
  tabs de Seções Registros e Criar/Editar; tipos do banner controlados;
  tipos de seções agora incluem **best_seller** e **low_stock**, preservando registros já existentes.
- CSS: chevrons geométricos ao final das regras móveis para corrigir
  alinhamento pelo centro real (não pela tipografia); dimensões responsivas de
  Horários, Notificações, upload e Banners; loading com `100dvh`.
- Testes de CI GitHub Actions: run **45029239819 PASS**.
  - Sintaxe JavaScript (admin, app, storeApi): PASS.
  - Contratos `node:test`: **12/12 PASS**.
  - Chromium real com **renderizadores de `js/admin.js`**, dados simulados,
    **34 estados/viewports PASS**, largura **320/375/390/430/768/1440**, zero
    overflow horizontal detectado; eixos verticais de ambos chevrons testados.
  - Capturas: artefato **`jgold-admin-visual-smoke-screenshots`**, 34 imagens PNG,
    inspecionadas em montagens mobile e desktop nesta sessão; nenhuma invasão
    de campos, e tabset, upload, modais e setas visualmente coerentes nos estados simulados.
  - **Limite:** não substitui QA autenticado e Safari iOS físico.
- Análise do agendamento ampliada:
  - GitHub Actions programado a cada 5 min, porém histórico consultado teve
    apenas **4 execuções agendadas nas últimas 24h**. Portanto não há garantia
    de pontualidade para mensagens agendadas.
  - Run `45025093048` em 22/11 às 12:59 UTC, concluído PASS;
    log de função retornou `{"ok":true,"processed":0,"results":[]}`.
  - **Não foi possível verificar qual URL real de Supabase está nos secrets**
    de GitHub Actions. O projeto PROD correto é `qufuwkgtkblevayhpjsb`;
    o projeto antigo inativo `xchqcpnmynwlodbkgmzy` NÃO prova que
    produção esteja inativa. Verificar conta/segredos posteriormente.
  - Não houve disparo real nem alteração do agendador nesta tarefa.
- Caderno local **ainda não tocado** devido falha da conexão. Este arquivo
  é o único checkpoint provisório do repositório; fazer upsert no caderno
  `<Documentos>\AI_Planejamento_de_Trabalho\vitrinezap-qa-ampliado-2026-11-21`,
  a partir do checkpoint 115 após reconciliação do Git local.
- **Cloudflare Pages Direct Upload**: mudanças NÃO estão publicadas.
  Quando PC voltar, comparar branch com changes locais, executar
  `node scripts/build-cloudflare-pages.mjs` e procedimento
  `DEPLOY_CLOUDFLARE.md`, seguido de prints na URL publicada.
