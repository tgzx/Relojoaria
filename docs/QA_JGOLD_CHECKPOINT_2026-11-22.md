# Caderno-espelho de QA — VitrineZap / J Gold Relojoaria — 22/11/2026

> **ATENÇÃO:** registro persistente provisório no repositório, para não perder requisitos.
> Não substitui o caderno local existente em `<Documentos>/AI_Planejamento_de_Trabalho/`.
> PC Controller não respondeu nesta rodada (erro interno em `ps`/diretório);
> tablet/MCP também respondeu 429. Assim que houver acesso, consultar
> `<Documentos>/AI_Memory_Vault/90_SYSTEM/AI_PREINSTRUCTION.md`, índice raiz,
> localizar caderno J Gold existente e fazer **upsert** deste checkpoint lá,
> preservando notas anteriores, sem criar caderno paralelo.

## Contexto e proteção de produção

- Repositório confirmado: `tgzx/Relojoaria`.
- Base de entrega: `delivery/cloudflare-jgold-2026-11-21`.
- Branch isolada para correções: `fix/jgold-modal-overflow-picker-2026-11-22`.
- **Não alterar branch principal/publicada antes de QA visual autenticado.**
- Usuário perdeu prints dos primeiros problemas; print recebido em 22/11
  demonstra setas desalinhadas vertical/horizontalmente das abas no Safari iOS.
- Requisito de qualidade global: **alinhamento horizontal e vertical**, sem
  campos ultrapassando cartões/modais, independentemente de viewport.
- Requisito de modelagem: campo com universo conhecido de valores deve ser **picklist**,
  tanto no componente quanto na validação de salvamento.

## Inventário completo dos pedidos desta rodada

| # | Pedido | Alteração preparada | Aceite ainda necessário |
| --- | --- | --- | --- |
| 1 | Setas do menu mobile alinhadas de verdade; NÃO era sobre sobreposição | Grid de colunas próprias para setas, mais chevrons geométricos em CSS, sem desvio da baseline do caractere | Screenshot iPhone real com abas nas duas pontas e no meio |
| 2 | Tabset de Seções estilo Salesforce; aba inicial Registros com tabela e botão Criar; nova tab só quando criar/editar | `sectionEditorOpen`, `sections-subtabs`, `sections-records-table`, editor condicional; salvar volta a Registros | Fluxo abrir → Criar → Cancelar/Salvar → Editar, no PC/mobile |
| 3 | Cartão Senha na primeira abertura exibe faixa branca/teclado invisível | Removido `.focus()` automático em input password, foco inicial no botão Fechar com `preventScroll` | Safari iPhone primeiro/segundo toque; abrir manualmente teclado, fechar e reabrir |
| 4 | Campos vazando em Horários de funcionamento | Grade responsiva com `minmax(0,1fr)`, cartões `min-width:0`, inputs de hora com `max-width:100%`, ajuste de modal mobile | iPhone 320/375/390/430 px e desktop, todos os dias, turno único/dividido |
| 5 | Campos vazando nas Notificações | Cabeçalho/ações de notificações quebram linha, controles nativos com larguras contraídas, URLs longas com quebra | Conferência de todos os cards, rascunhos, agendadas, recorrentes, datetimes |
| 6 | Revisar agendamento de notificação (sem disparo real) | Inspecionados frontend, Edge Function, cron, execução e logs reais | Resolver pontualidade e confirmar backend de produção em atividade separada |
| 7 | Banner: tipo pré-definido como picklist, não texto aberto | `target_type` do banner agora `<select>` com tipo `hero`, persistência controlada `hero` | Conferir valores reais de produção antes de ampliar opções |
| 8 | Banner: upload desalinhado verticalmente | Correção de altura, alinhamento e `::file-selector-button`, contenção de largura | Safari iPhone / Chrome PC, antes e depois de selecionar imagem |
| 9 | Carregamento admin parecia abaixo do centro no mobile e PC (pedido anterior) | Uso `100dvh` com fallback `100vh` e centralização explícita | Screenshots de loading em viewport mobile e desktop |
| 10 | Evitar repetir QA visual deficiente | Criar testes de regressão CSS/DOM e verificar screenshot/overflow real antes do deploy | Ainda não concluído sem browser autenticado |

## Diagnóstico de agendamento (somente leitura, sem envios)

- Frontend `js/admin.js`: salva `scheduled_at`, `recurrence_rule`, `recurrence_next_at`, `status=scheduled`.
- `.github/workflows/scheduled-push.yml`: cron `*/5 * * * *` (intenção: cada 5 minutos) no branch padrão `main`.
- GitHub Actions real: apenas **4 execuções agendadas nas últimas 24 horas** consultadas em 22/11/2026, com períodos de várias horas sem execução; cron NÃO atende SLA de cinco minutos.
- Última execução inspecionada: 22/11/2026 12:59:26 UTC (09:59 BRT), job `45025093048`, sucesso; resposta da função: `{"ok":true,"processed":0,"results":[]}`.
- Edge Function `process-scheduled-push` está implantada e marcada `ACTIVE` (v7) no projeto Supabase `xchqcpnmynwlodbkgmzy`, mas o projeto aparece como `INACTIVE` na listagem de projetos. Confirmar a efetiva origem de dados em Cloudflare/J Gold antes de intervenção.
- Print do dashboard exibia base de inscritos PUSH = 0; envio agendado sem inscritos não entrega mensagem.
- Processo atual marca `failed` se nenhum destinatário receber; recorrência falha e perde próxima ocorrência em vez de manter/reprogramar; atualização no banco não verifica `error`.
- Concorrência/idempotência: função lista pendentes e envia sem reivindicação transacional/lock; execuções sobrepostas podem duplicar disparos.
- Segurança: autenticação por `CRON_SECRET` está implementada. Não registrar segredos.
- **Não considerar agendamento validado**: sucesso do cron com `processed=0` não prova disparo no horário.
- A análise foi solicitada **sem realizar disparos reais**, e isso foi respeitado.
- Docs externas: GitHub Actions schedule é best-effort; Supabase oferece `pg_cron` + `pg_net` para agendar Edge Functions; qualquer migração exige análise da infraestrutura real e autorização.

## Alterações de código e proteções

- `js/admin.js`: remoção do autofoco no input senha, picklist de Banner e persistência controlada, tabset de Seções, tabela, controle de navegação e retorno ao salvar, picklist `type` para Seções.
- `css/admin.css`: alturas e larguras de controles; time inputs; notificações; upload; layout de Seções; setas geometricamente centralizadas; loading com viewport dinâmico.
- `tests/adminResponsiveContracts.test.mjs`: testes estáticos dos contratos de UI (criados nesta rodada).
- Nada gravado no banco e nada disparado aos assinantes; nenhuma alteração executada no Supabase ou Cloudflare.

## Critérios de QA obrigatórios antes de fechar/deploy

1. Verificar `git status`, confirmar path/repositório/branch e não descartar mudanças externas.
2. Executar sintaxe JS, regressões existentes e novas (`node --check`, `node --test`).
3. Testar tela com **viewport 320, 375, 390, 430, 768, 1024 e 1440 px**, capturar screenshots no iPhone Safari real e Chrome desktop.
4. Medir DOM (elementos visíveis): `scrollWidth > clientWidth` não pode ocorrer nos containers de modal, form, cartão e página, exceto carrossel deliberado.
5. Checar alinhamento por `getBoundingClientRect`: centros geométricos de ambas setas no centro vertical das abas; botões de upload e campos com baseline alinhada.
6. Modal de senha: 1º toque abre sem teclado/faixa; foco deliberado aciona teclado; fechar/reabrir deve funcionar.
7. Horários: todas as linhas/turnos, aplicar/cancelar, teclado time picker do iOS.
8. Notificações: mensagens e URL grande, botões, picklists, datas, histórico, lista vazia e preenchida; **nenhum push real**.
9. Banners: tipo só da lista, upload visual alinhado, imagem opcional, todos os controles dentro do cartão.
10. Seções: lista padrão, Criar abre segunda aba, Editar existente abre editor, Cancelar sem perder salvo, Salvar volta a Registros; não aplicar padrão aos demais objetos ainda (aguardar avaliação do usuário).
11. Centralização do loading no PC e iPhone.
12. Guardar prints e resultados no caderno; só então considerar deploy.

## Checkpoint da atividade

- **Última etapa concluída:** alterações isoladas em branch e análise de código/cron com logs.
- **Estado atual:** correções preparadas; teste estático parcial executado. QA visual autenticado, tela real no iPhone e caderno local **pendentes**.
- **Próxima ação:** executar regressões reais + screenshot e sincronizar espelho com caderno local ao recuperar PC Controller.
- **Bloqueios:** PC Controller falha internamente em todas as chamadas; MCP Android retorna 429; não há sessão de navegador autenticada acessível.
- **Arquivos alterados:** `js/admin.js`, `css/admin.css`, testes e este espelho.
- **Testes executados:** verificações estáticas de contratos CSS/JS; inspeção real de job GitHub e logs; sem teste visual em navegador autenticado.
- **Regra de encerramento:** não declarar "testado visualmente", "deploy feito" ou "agendamento funcionando" enquanto pendências correspondentes existirem.
