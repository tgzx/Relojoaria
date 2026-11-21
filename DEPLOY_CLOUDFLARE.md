# J Gold Relojoaria — deploy Cloudflare Pages

## Arquitetura em produção
- Site estático: https://j-gold-relojoaria.pages.dev/
- Cloudflare Pages project: `j-gold-relojoaria`, produção branch: `main` (Direct Upload).
- Dados/Auth/Storage: Supabase projeto `qufuwkgtkblevayhpjsb` (cliente), **não migrar banco**.
- Site GitHub Pages anterior: https://tgzx.github.io/Relojoaria/ (mantido para rollback até transferência).
- Nenhum projeto Cloudflare do Lobby Game Fest deve ser alterado.

## Criar pacote de publicação
1. Tenha Node.js e acesso Cloudflare autenticado com Wrangler.
2. Configure `js/config.js` localmente a partir de `js/config.example.js`, usando **somente chaves publicáveis/anon**, nunca `service_role` ou secrets.
3. Confira `SUPABASE_URL = https://qufuwkgtkblevayhpjsb.supabase.co`, `STORE_SLUG = J-Gold-Relojoaria` e `APP_NAME = J Gold Relojoaria`.
4. Na raiz do repo execute `node scripts/build-cloudflare-pages.mjs` (build fica no diretório temporário do usuário, fora do Git e sem publicar .git/.github/migrations).
5. Execute `wrangler pages deploy "<caminho-temp>/vitrinezap-cloudflare-pages" --project-name j-gold-relojoaria --branch main`. A CLI informa o endereço de deployment e o aliases pages.dev.
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
