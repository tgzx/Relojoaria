# Entrega técnica — J Gold Relojoaria / VitrineZap
Data de fechamento técnico: 2026-11-21

## Situação
- Vitrine em produção na conta Hotmail: https://j-gold-relojoaria-oficial.pages.dev/
- Admin na conta Hotmail: https://j-gold-relojoaria-oficial.pages.dev/admin.html
- Plataforma: Cloudflare Pages (Direct Upload), projeto atual `j-gold-relojoaria-oficial` na conta Hotmail (`db26fe2768772e99d642058374ea4559`).
- Contingência ainda acessível: projeto antigo `j-gold-relojoaria` na conta Gmail (`https://j-gold-relojoaria.pages.dev/`).
- Banco/Auth/Storage/Edge Functions: Supabase `qufuwkgtkblevayhpjsb`, região `sa-east-1`, **transferido oficialmente para a organização `ATSM Projects` (conta Hotmail) em 21/11/2026**. A URL e as chaves do projeto foram preservadas; não houve cópia para o projeto novo vazio.
- Legado GitHub Pages: https://tgzx.github.io/Relojoaria/ (também mantido até aceite; não apagar automaticamente).
- Branch de entrega: `delivery/cloudflare-jgold-2026-11-21`.
- Alterações SQL não exigem novo deploy do frontend. **A branch Git não publica automaticamente no Pages**.

## Escopo homologado
- Loja pública com cinco produtos, imagens, busca/filtros/modais e resposta em 1440/390/320 px. QA completo aprovado antes da auditoria SQL; não foi repetido desnecessariamente.
- Testes automatizados anteriores: dataCache 10/10, productImages 3/3 e publicProductPresentation 3/3.
- Sem erros de JS ou HTTP nos percursos QA. Preflight CORS Supabase respondeu HTTP 200; configuração pública recebe `Cache-Control: no-store`.
- PWA offline real (Playwright Edge 390x844): carregamento inicial, reload com service worker controlando, 5 cards com rede desligada após aquecimento, banner offline exibido, reload online posterior com 5 cards e banner removido; 0 pageErrors. Evidência no caderno `qa-pwa-offline-results.json`.
- Admin anônimo: HTTP 200, login com campos e-mail/senha presente, sem pageErrors. **CRUD autenticado NÃO foi validado nesta rodada por ausência de sessão/credencial autorizada.**
- Pós-migrações SQL: vitrine HTTP 200 e 5 produtos; console/rede limpos; testes SQL da função storage_store_uuid para path válido/inválido aprovaram.
- Não houve remoção/edição de produtos, apagamento de dados, troca de domínio/ownership, nem novo deploy do site nesta retomada.

## Segurança — banco de produção
Migrados com rollback manual versionado:
1. `supabase/migrations/20261121160436_restrict_internal_auth_trigger_execution.sql`
   - Revogou `EXECUTE` de `handle_new_user()` para PUBLIC, anon e authenticated.
   - Manteve serviço `supabase_auth_admin` com `EXECUTE`, além do acesso de serviço existente; trigger `on_auth_user_created` preservado.
   - Checado em `pg_proc/has_function_privilege`; aviso de função privilegiada anônima caiu de 6 para 5.
   - Rollback: `supabase/rollbacks/20261121160436_restrict_internal_auth_trigger_execution.rollback.sql`.
2. `supabase/migrations/20261121160727_pin_public_invoker_function_search_paths.sql`
   - Fixou `search_path` vazio para `set_updated_at`, `storage_store_uuid`, `validate_product_option_value_store` e `validate_product_option_selection_store`.
   - São funções `SECURITY INVOKER` com tabelas qualificadas e built-ins PG; não altera corpo nem RLS.
   - Supabase Advisor: quatro avisos `function_search_path_mutable` zerados.
   - Rollback: `supabase/rollbacks/20261121160727_pin_public_invoker_function_search_paths.rollback.sql`.

**Riscos residuais conhecidos (não bloquear sem migração funcional/testes):**
- Cinco RPCs `SECURITY DEFINER` continuam executáveis por `anon` e `authenticated`: `increment_product_view`, `increment_product_interest`, `is_store_member`, `public_upsert_push_subscription`, `public_deactivate_push_subscription`.
- Os contadores são intencionalmente públicos, limitados a produtos ativos, mas podem receber chamadas automatizadas ilimitadas (métrica passível de manipulação e consumo de writes). Evitar expor contadores como indicador antifraude. Rate limit no backend é melhoria futura proporcional a volume real, não foi improvisado.
- `is_store_member` usa `auth.uid()` e participa de muitas políticas RLS: revogar sem alterar policies quebraria leitura/admin. O helper não retorna dados de membresia; `anon` sem identidade recebe falso.
- As funções push anônimas servem inscrição/retirada sem login e aceitam dados fornecidos pelo cliente. Podem sofrer spam/escritas, então observar uso/quota; hardening com validação/rate-limit e autorização por endpoint exigiria desenho e testes específicos.
- Senhas vazadas: Supabase Advisor ainda informa `auth_leaked_password_protection` desativado. Habilitar na configuração Auth do projeto quando a titularidade/operador confirmar, sem manipular credenciais nesta entrega.
- 0 push subscriptions no banco na auditoria. Config pública contém chave VAPID, porém envio fim a fim e cron não foram homologados nesta rodada. Não prometer push funcional ao cliente sem teste autorizado.

## Custo, limites e eficiência
- Banco no dia do QA: 13.462.675 bytes (~13 MB); 5 objetos no Storage, 736.655 bytes (~0,74 MB); 5 produtos ativos.
- Referências de limites Free **condicionadas ao plano efetivo da conta**: Cloudflare Pages Free até 20.000 arquivos por site e 500 builds/mês; Supabase Free 500 MB banco, 50.000 MAU e egress incluído em faixas cached/uncached. O Free pode pausar projetos após ~7 dias de pouco uso; não garantir disponibilidade contínua sem monitoramento/plano apropriado.
- App mantém cache local com 5 minutos de frescor, até 24 h de fallback stale e service worker para assets/HTML. Evitar recarregamento massivo, consultas duplicadas e mudança de stack sem dados que justifiquem.
- Percurso anterior de QA (incluindo busca, filtros e modal), por viewport: 13 requests estáticos, 15 Supabase, 14 outros. Não tratar como carga inicial isolada, nem extrapolar custo mensal.
- Observabilidade sugerida: acompanhar quota egress/DB/Auth, mensagens de pausa, contadores de writes das RPCs, erros no navegador e disponibilidade do site.

Fontes públicas consultadas em 2026-11-21:
- https://developers.cloudflare.com/pages/platform/limits/
- https://supabase.com/pricing
- https://supabase.com/docs/guides/platform/free-project-pausing
- https://supabase.com/docs/guides/storage/serving/bandwidth

## Operação, publicação e rollback
- Para nova versão do frontend, seguir `DEPLOY_CLOUDFLARE.md`; requer credencial Cloudflare válida no ambiente, config local publicável e `node scripts/build-cloudflare-pages.mjs`, depois Wrangler Direct Upload. **Nota histórica:** na rodada anterior (auditoria do Supabase) não houve novo deploy; em 21/11/2026, a vitrine foi republicada no projeto Hotmail `j-gold-relojoaria-oficial`. O projeto Gmail foi preservado.
- Rollback Cloudflare: usar um deployment anterior retido no Dashboard Pages. Não depende de restaurar banco.
- Rollback SQL apenas se realmente necessário e após análise de efeitos: executar o arquivo `.rollback.sql` correspondente e revalidar permissões, criação de usuário, loja pública e admin; não descartar dados existentes. `handle_new_user()` deve continuar acessível ao serviço Auth em qualquer estado.
- Não commitar `js/config.js` (arquivo local com chave publicável) ou credenciais, tokens, secrets, estados de sessão; não armazenar cookies no Vault.
- Não remover GitHub Pages antigo nem apagar dados reais sem aceite.

## Dependências externas para aceite final
1. **WhatsApp comercial:** `store_settings.whatsapp_number` está vazio. O site tem fallback seguro e não cria CTA/link quebrado, mas o canal de venda não está operacional. João Antônio deve confirmar o número empresarial correto; **não usar contato pessoal inferido**.
2. **Admin:** precisa de login autorizado pelo titular para smoke CRUD reversível (produto, imagens, configurações) em dados controlados. Sem sessão disponível nesta rodada, não foi tentado.
3. **Titularidade:** assegurar controle do cliente sobre Cloudflare, Supabase, domínio e contas responsáveis pelo billing/recuperação. Se não houver transferência direta de projeto Pages, coordenar reimplantação em conta do cliente com DNS/domínio/rollback.
4. **Dados comerciais:** cliente deve confirmar produtos, estoque, preços, textos, imagens e WhatsApp antes do aceite de negócio.
5. **Push opcional:** somente após decisão comercial e teste real de permissão/assinatura/envio/desativação/cron. Não é pré-requisito para vitrine pública.

## Critério de conclusão
**Fechamento técnico do escopo executável nesta rodada: concluído.** A entrega final/comercial depende unicamente de confirmações, credenciais/sessões e ações dos responsáveis listadas acima. Não acionar Pulso GPT sem nova pendência técnica segura e necessária.

## Migração de conta Cloudflare concluída — 21/11/2026

- **Nova produção:** https://j-gold-relojoaria-oficial.pages.dev/ — Cloudflare Pages `j-gold-relojoaria-oficial`, conta Hotmail (`db26fe2768772e99d642058374ea4559`), Direct Upload branch `main`.
- **Deployment validado:** `c1ac2d76.j-gold-relojoaria-oficial.pages.dev`; 22 arquivos publicados + `_headers`. O alias principal foi homologado HTTP 200.
- **Legado de contingência:** https://j-gold-relojoaria.pages.dev/ (conta Gmail) segue vivo e funcional. A Cloudflare não permite renomear o subdomínio Pages antigo. A transição **exige divulgar a nova URL**; não redirecionamos/excluímos o projeto Gmail sem aceite. GitHub Pages legado também preservado.
- Projeto/estrutura Supabase `qufuwkgtkblevayhpjsb` preservados, sem migração de dados nem CRUD administrativo; imagens remotas mantidas e cache por origem independente. A navegação de QA pode incrementar os contadores públicos de visualização/interesse existentes. Nenhum recurso Cloudflare Workers/D1 foi necessário no J Gold.
- QA novo domínio: Edge/Playwright 1440×1000, 390×844 e 320×568: 5 produtos, zero scroll horizontal, busca Casio, filtros, detalhe/ESC e fallback seguro de WhatsApp PASS; 0 erros JS/HTTP. Admin público HTTP 200 com formulário e-mail/senha, **CRUD autenticado não testado** por ausência de sessão.
- QA PWA: service worker ativo, 5 produtos após reload offline com banner offline; reconexão recupera catálogo e esconde banner. PASS. `js/config.js` HTTP 200 com `Cache-Control: no-store`; manifest 200; OPTIONS CORS Supabase 200 para a nova origem.
- Comparação byte a byte: **12/12** assets críticos idênticos entre URLs antiga/nova (HTML, CSS, JS, manifest e SW; validação via SHA-256 sem expor conteúdo da configuração); **5/5 imagens** carregaram após scroll (lazy loading esperado). Evidências no caderno local `qa-hotmail-live-results.json`, `qa-hotmail-offline-results.json`, `qa-hotmail-compare-results.json`.
- CLI Wrangler: perfil `jgold` apontando ao Hotmail apenas no repo Relojoaria; fallback `default` continua na conta Gmail/Lobby Game Fest. `pages project list` confirmado em ambas. Smoke das duas URLs antigas de J Gold e Lobby HTTP 200.
- Rollback: link antigo da conta Gmail permanece ativo; em caso de problema no novo deployment, pode-se voltar a informar o link antigo ou reimplantar em Hotmail usando o mesmo bundle. Não apagar nenhum projeto sem aceite do cliente.
- Pendências de negócio: WhatsApp empresarial de João Antônio, teste CRUD admin autenticado e controle final de contas/convites. Conta Hotmail ainda pertence ao desenvolvedor; não equivale a transferência de propriedade para João.


## Transferência oficial Supabase para Hotmail — 21/11/2026
- **Status:** CONCLUÍDA; o projeto original `VitrineZap-JGold-Cliente-Prod` (ref `qufuwkgtkblevayhpjsb`) foi movido da organização Vercel-managed `tgzx's projects` para a organização **ATSM Projects**, id `tulgvupuujkxdcenqdcr`, proprietária `tiago.z.x@hotmail.com` (Owner). O antigo `tiago.z.x.g@gmail.com` permanece como **Developer** na ATSM Projects para manutenção. Nunca transferir todos os projetos da Vercel, só o J Gold.
- **Verificação de titularidade:** em sessão Supabase da conta Gmail, orgs antes: ATSM 1 projeto e origem 4; após transferência: ATSM **2** e origem **3**. Projeto J Gold acessível em `https://supabase.com/dashboard/project/qufuwkgtkblevayhpjsb` sob o título `ATSM Projects`, com API URL original `https://qufuwkgtkblevayhpjsb.supabase.co`.
- **Dados e dependências preservados:** comparação via SQL de 19 tabelas públicas e `storage.objects` (20 conjuntos) registrou **20/20 contagens idênticas e 19/20 checksums idênticos** antes/depois. A tabela `products` manteve cinco registros, mas seu checksum mudou; provável efeito de métricas de visualização durante QA, **sem confirmação campo a campo**. Storage continua com cinco objetos, cinco produtos/imagens, um perfil/loja, usuário Auth antigo por transferência in-place. As Edge Functions originais `send-push` e `process-scheduled-push` continuam listadas no destino (2 funções).
- **QA pós-transferência da Cloudflare:** produção `https://j-gold-relojoaria-oficial.pages.dev/`, viewports 1440/390/320, cinco produtos, imagens, busca Casio, filtros, modal/ESC, sem overflow horizontal, sem page errors nem bad responses. CORS Supabase HTTP 200, manifest HTTP 200, config `no-store`. Service worker com cinco cards offline após warm e reconexão validada. Login/admin anônimo HTTP 200; **CRUD autenticado não testado** por ausência de login autorizado da loja. WhatsApp empresarial segue vazio com fallback seguro.
- **Aviso Vercel:** o Supabase informou que a transferência desvincula o recurso associado a um projeto Vercel, o que pode exigir reconexão se esse recurso ainda for consumido pela Vercel. **Não desinstalamos a integração Marketplace geral** e os outros três projetos Supabase continuam na organização antiga. A hospedagem de produção está na Cloudflare e não depende da conexão Vercel removida. O conector Supabase do ChatGPT continuou restrito à organização antiga e perdeu acesso a esse ref; para gerenciar via conector será necessário reautorizar a organização ATSM Projects. A conta Gmail no Dashboard continua como Developer da ATSM.
- **Destino contém projeto adicional vazio:** `tiago.z.x@hotmail.com's Project`, criado anteriormente, é independente e ocupa uma das duas vagas Free; **não foi apagado**. Não usar suas credenciais/URL no J Gold. Eventual exclusão exige decisão explícita.
- **Segurança:** senha PostgreSQL do projeto vazio foi divulgada pelo usuário nesta conversa; não foi armazenada nem utilizada; deve ser rotacionada no Dashboard. Não salvar secrets, cookies nem tokens no Git/caderno.
- **Rollback:** não se trata de restore/cópia de banco; reversão de organização exigiria nova transferência oficial entre organizações e verificação de requisitos. Manter snapshot de contagens/checksums e histórico de migrations. Não apagar produção Cloudflare antiga sem aceite.
- **Evidências locais:** `<Documentos>\AI_Planejamento_de_Trabalho\vitrinezap-entrega-cloudflare-2026-11-21\08_PLANO_TRANSFERENCIA_SUPABASE_HOTMAIL.md`, `09_CHECKSUM_PRE_TRANSFERENCIA.json`, `09_CHECKSUM_POS_TRANSFERENCIA.json`, `qa-hotmail-live-results.json`, `qa-hotmail-offline-results.json`.
