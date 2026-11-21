# J Gold Relojoaria — deploy Cloudflare Pages

## Arquitetura em produção
- Site estático ATUAL (conta Hotmail): https://j-gold-relojoaria-oficial.pages.dev/
- Site antigo (conta Gmail, rollback): https://j-gold-relojoaria.pages.dev/
- Cloudflare Pages ATUAL: projeto `j-gold-relojoaria-oficial` na conta Hotmail (`db26fe2768772e99d642058374ea4559`), produção branch `main` (Direct Upload).
- Legado: projeto `j-gold-relojoaria` na conta Gmail (`9a0369b8b9a402a79cf3dfe0d6ef03da`), mantido como fallback. Não apagar sem aceite.
- Dados/Auth/Storage/Edge Functions: Supabase projeto `qufuwkgtkblevayhpjsb`, **já transferido oficialmente para a organização `ATSM Projects` na conta Hotmail**, mantendo o ref, a URL da API e as chaves. Não replicar o banco nem substituir essa referência pelo projeto vazio criado no Hotmail.
- Site GitHub Pages anterior: https://tgzx.github.io/Relojoaria/ (mantido para rollback até transferência).
- Nenhum projeto Cloudflare do Lobby Game Fest deve ser alterado.

## Criar pacote de publicação
1. Tenha Node.js e acesso Cloudflare autenticado com Wrangler.
2. Configure `js/config.js` localmente a partir de `js/config.example.js`, usando **somente chaves publicáveis/anon**, nunca `service_role` ou secrets.
3. Confira `SUPABASE_URL = https://qufuwkgtkblevayhpjsb.supabase.co`, `STORE_SLUG = J-Gold-Relojoaria` e `APP_NAME = J Gold Relojoaria`.
4. Na raiz do repo execute `node scripts/build-cloudflare-pages.mjs` (build fica no diretório temporário do usuário, fora do Git e sem publicar .git/.github/migrations).
5. Use o perfil Wrangler `jgold`, vinculado à pasta Relojoaria, e confira `wrangler whoami` (deve apontar para `tiago.z.x@hotmail.com`). Execute `wrangler pages deploy "<caminho-temp>/vitrinezap-cloudflare-pages" --project-name j-gold-relojoaria-oficial --branch main --profile jgold` com `CLOUDFLARE_ACCOUNT_ID=db26fe2768772e99d642058374ea4559` definido apenas para esse processo. A CLI informa a URL do deployment. **Não publicar na conta Gmail por engano.**
6. Verifique `/index.html`, `/admin.html`, `/manifest.json`, `/js/config.js` (sem expor a chave em logs), 5 produtos, console/rede, CORS, modal, busca e WhatsApp.

## Proteções e rollback
- A configuração é gerada no pacote a partir do arquivo local ignorado pelo Git. Não enviar senhas/tokens nem compartilhar prints do `config.js` com chave.
- Arquivos públicos vão para Cloudflare; banco permanece no Supabase J Gold.
- `_headers` publicado define `no-store` para config/admin, `no-cache` para SW/HTML e headers de proteção básicos.
- O projeto Pages usa upload manual: alterações na branch Git **não publicam automaticamente**.
- Para rollback, usar deployment anterior no painel Cloudflare Pages. O GitHub Pages antigo permanece público enquanto o novo domínio não tiver sido entregue/homologado.
- Não alterar ownership, DNS, domínio personalizado nem remover o projeto antigo sem confirmar acesso do cliente.

## Pendências comerciais/operacionais
- **WhatsApp está vazio no Supabase do cliente.** Não adicionar telefone pessoal encontrado em contatos sem confirmar com João Antônio. Site deve evitar link morto `href="#"` e exibir aviso enquanto faltar configuração.
- Confirmar preços/estoque/parcelamento/descrições com o cliente.
- Testar login administrativo real com sessão autorizada; testes do formulário público não validam criação/edição autenticada.
- Confirmar se haverá notificações push (0 assinantes nesta auditoria); não afirmar push pronto sem VAPID/cron homologados.
- Entregar a João Antônio acesso administrativo e operação sob conta dele; credenciais e transferência de Cloudflare/Supabase exigem ato seguro do titular.

## QA local
```powershell
node tests/dataCache.test.mjs
node tests/productImages.test.mjs
node tests/publicProductPresentation.test.mjs
node --check js/app.js
node --check js/admin.js
node --check js/utils.js
node --check service-worker.js
git diff --check
```


## Fechamento de auditoria de segurança e PWA — 2026-11-21
- Para o relatório de entrega, limites, rollback e dependências externas, consultar `ENTREGA_J_GOLD.md`.
- Migrações já aplicadas no Supabase cliente (histórico remoto verificado):
  - `20261121160436_restrict_internal_auth_trigger_execution`;
  - `20261121160727_pin_public_invoker_function_search_paths`.
- Rollbacks manuais correspondentes em `supabase/rollbacks/`.
- Supabase Advisor: aviso anônimo SECURITY DEFINER 6→5; avisos mutáveis de search_path 4→0. RPCs remanescentes são contratos de vitrine/push/RLS, com riscos e melhorias explicitados no relatório.
- PWA offline validada com Playwright após cache aquecido: 5 produtos offline, banner de rede, reconexão, 0 pageErrors. Evidência no caderno operacional.
- A migração SQL não exige publicar uma nova versão Cloudflare Pages. Não houve deploy nesta rodada.
- Admin autenticado e WhatsApp empresarial continuam dependentes do titular; não inventar credenciais ou número.


## Migrado para conta Hotmail — 21/11/2026
Deploy principal validado em https://j-gold-relojoaria-oficial.pages.dev/ com 5 produtos, responsive QA, PWA offline, CORS e admin shell. Projeto antigo Gmail mantido apenas para contingência. Para manutenção, executar sempre Wrangler na pasta deste repo com perfil `jgold`; checar conta com `whoami` e ID `db26fe2768772e99d642058374ea4559` antes de publicar. O perfil `default` continua dedicado à conta Gmail do Lobby Game Fest. Não versionar `js/config.js`. Detalhes e evidências em `ENTREGA_J_GOLD.md` e caderno local.


## Supabase movido para ATSM Projects (21/11/2026)
A organização dona do backend foi alterada por transferência oficial: `ATSM Projects` (Hotmail, org `tulgvupuujkxdcenqdcr`). **A referência de projeto continua `qufuwkgtkblevayhpjsb`**, sem alteração no `js/config.js` ou novo deploy Pages. A conta Gmail tem papel Developer na ATSM. Vercel Marketplace deixou de vincular este recurso Supabase; não desinstalar a integração de todo o time, pois existem outros projetos. O conector Supabase da conta ChatGPT antiga pode precisar de nova autorização para a ATSM. Consulte `ENTREGA_J_GOLD.md` e o caderno para QA e integridade de dados.
