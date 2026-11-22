# QA de UI administrativa — J Gold (22/11/2026)

## Regra global de aceite

Nenhum campo, botão, texto, etiqueta, seletor, arquivo ou modal pode ultrapassar a área útil do seu componente, horizontal ou verticalmente, em desktop e celular. Verificar alinhamento vertical **e** horizontal, incluindo estados vazios, preenchidos, validações, nomes longos e teclado virtual. Corrigir a causa (grid, flex, dimensões intrínsecas e viewport), sem esconder campos com `overflow: hidden` como paliativo.

Campos com valores pertencentes a um conjunto predefinido devem ser `select`/picklist. Renderizar apenas opções que o sistema suporta, persistir somente valores aceitos e não oferecer texto livre.

## Correções propostas nesta branch

- Modal de alteração de senha: removido o foco automático no input de senha; o foco inicial fica no botão de fechar com `preventScroll`, para não acionar o teclado imediatamente no iOS.
- Horários: cartões passam a dimensionar colunas levando em conta padding e largura efetiva, inclusive para controles nativos `time`.
- Notificações: cabeçalhos e ações dos cartões podem quebrar linha, impedindo competição horizontal em viewports estreitos.
- Banners: `target_type` deixa de ser input livre. O único tipo confirmado no renderer atual é `hero` (Destaque principal). O upload de arquivo ganha estilos para alinhamento de botão/texto.
- Teste estático: `tests/adminResponsiveContracts.test.mjs`.

## Matriz de QA visual obrigatória antes do merge

1. Abrir e fechar duas vezes o modal **Senha** em iPhone Safari: na primeira abertura não mostrar teclado; tocar no input, verificar teclado/viewport; fechar teclado e reabrir o modal, sem faixa branca persistente; validação de foco e rolagem.
2. Abrir modal de **Horários** em 320, 375, 390, 768 e 1440 px; verificar início/fim/retorno/encerramento em cada dia, inclusive pausas e teclado/seletor nativo de hora. Não permitir `scrollWidth > clientWidth + 2` nos cartões.
3. Em **Notificações**, usar textos compridos, URLs longas, muitas recorrentes/agendadas, data e botões de ação. Verificar cabeçalhos, campos, listagem, histórico e modal em todas as larguras acima.
4. Em **Banners**, verificar seletor de tipo, upload sem arquivo, arquivo com nome longo e depois arquivo selecionado; conferir botão e nome alinhados no centro vertical, sem vazamento; salvar e reabrir.
5. Capturar screenshot em cada checkpoint relevante e inspecionar, não considerar apenas teste funcional/DOM como prova de layout. Repetir no mobile real quando possível.
6. Rodar `node --test tests/adminResponsiveContracts.test.mjs` e `node --check js/admin.js`, além da bateria de QA visual. Não publicar enquanto houver falha.

## Agendamento de push — análise, sem alterações nesta rodada

O formulário marca `scheduled`, o workflow `.github/workflows/scheduled-push.yml` chama `process-scheduled-push` a cada cinco minutos, e a função consulta `scheduled_at`/`recurrence_next_at`. Isso é apenas a implementação do fluxo, não comprovação de execução real na J Gold.

Validação pendente na produção `qufuwkgtkblevayhpjsb`: função efetivamente publicada, segredos VAPID e CRON_SECRET válidos, secrets do GitHub apontando ao projeto correto, workflow habilitado/execuções recentes no branch default `main`, evento agendado passando de scheduled para sent e entrega real em cliente inscrito.

Riscos identificados: função faz SELECT e depois envia antes do UPDATE, sem lock/claim transacional — execuções concorrentes podem duplicar notificações. Um agendamento pode falhar se a rotina não estiver ativa; não confundir o toast "Notificação agendada" com entrega confirmada. Não disparar notificações reais nem alterar agendamento sem aprovação.

## Estado da atividade

Alterações isoladas em branch e PR de revisão; não aplicadas automaticamente à produção. PC Controller indisponível nesta sessão (chamadas reais retornaram erro interno), portanto QA visual real, `git status` local, sincronização do vault/caderno e reprodução no aparelho permanecem pendentes.
