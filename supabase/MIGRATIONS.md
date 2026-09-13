# Migrations e bootstrap Supabase — VitrineZap / Relojoaria

Este diretório contém a base mínima para criar um novo projeto Supabase do zero para outro ambiente/conta, sem copiar dados de teste do QA.

## Decisão de ambiente

- Supabase QA/sandbox interno: `xchqcpnmynwlodbkgmzy` (`VitrineZap`).
- Supabase cliente/produção criado: `qufuwkgtkblevayhpjsb` (`VitrineZap-JGold-Cliente-Prod`).
- O projeto cliente foi criado na região `sa-east-1` (São Paulo) e validado em 2026-09-13.
- Não cadastrar produtos reais do cliente no Supabase QA.
- Não transformar em multitenant real no mesmo banco nesta etapa.
- Ao final da rodada de criação/testes, o diretório local ficou linkado no projeto cliente: `qufuwkgtkblevayhpjsb`.

## Ordem das migrations

As migrations devem rodar nesta ordem:

```text
20260514000000_initial_schema.sql
20260514001000_storage_bucket_product_images.sql
20260515000000_banner_appearance.sql
20260515001000_push_notifications_setup.sql
20260516000000_notification_scheduling.sql
```

### 20260514000000_initial_schema.sql

Baseline inicial do schema público, gerado a partir de `supabase/schema.sql` e validado contra o catálogo remoto do QA em 2026-09-12.

Inclui:

- extensão `pgcrypto`;
- tabelas públicas principais;
- funções/RPCs públicas;
- trigger `auth.users -> public.profiles`;
- triggers de `updated_at`;
- índices principais;
- RLS;
- policies públicas/admin;
- policies de Storage para `storage.objects`.

Não inclui:

- produtos;
- categorias;
- marcas;
- banners;
- usuário real;
- senha;
- tokens;
- secrets;
- dados de teste.

### 20260514001000_storage_bucket_product_images.sql

Garante a existência do bucket público usado pelo app:

```text
product-images
```

O Supabase já fornece o schema/tabelas de Storage. Esta migration apenas cria/atualiza o bucket esperado pelo app.

### 20260515000000_banner_appearance.sql

Migration incremental de aparência dos banners. Mantida idempotente para rodar depois do baseline.

### 20260515001000_push_notifications_setup.sql

Migration incremental de suporte a push notifications. Mantida idempotente para rodar depois do baseline.

### 20260516000000_notification_scheduling.sql

Migration incremental de agendamento/recorrência de notificações. Mantida idempotente para rodar depois do baseline.

## Por que as migrations antigas foram renomeadas

As migrations antigas foram mantidas, mas renomeadas para versões completas e únicas, porque antes existiam duas migrations com a mesma versão `20260515`.

Renomes aplicados:

```text
20260515_banner_appearance.sql -> 20260515000000_banner_appearance.sql
20260515_push_notifications_setup.sql -> 20260515001000_push_notifications_setup.sql
20260516_notification_scheduling.sql -> 20260516000000_notification_scheduling.sql
```

Isso evita ambiguidade no histórico de migrations e permite aplicar tudo em um Supabase novo de forma ordenada.

## Como aplicar em um Supabase novo

Depois de criar e linkar o novo projeto Supabase:

```bash
supabase link --project-ref SEU_PROJECT_REF
supabase migration list --linked
supabase db push --linked --include-all
```

Para conferir antes, use dry-run:

```bash
supabase db push --linked --dry-run --include-all
```

## Validação realizada no projeto cliente

Projeto validado:

```text
Nome: VitrineZap-JGold-Cliente-Prod
Ref: qufuwkgtkblevayhpjsb
Região: sa-east-1
```

Resultado das migrations no cliente:

```text
20260514000000 initial_schema
20260514001000 storage_bucket_product_images
20260515000000 banner_appearance
20260515001000 push_notifications_setup
20260516000000 notification_scheduling
```

Checks estruturais realizados:

```text
public_tables: 16
public_columns: 186
rls_enabled_tables: 16
public_policies: 32
storage_policies: 4
public_functions: 8
public_triggers: 12
auth_triggers: 1
product_images_bucket: 1
migration_history: 5
```

Checks funcionais realizados:

- `supabase db push --linked --dry-run`: banco remoto atualizado / sem migrations pendentes.
- `supabase/verify-setup.sql`: executado com sucesso.
- Acesso público/anon à loja `J-Gold-Relojoaria`: OK.
- Acesso público/anon aos 2 produtos iniciais: OK.
- Imagens públicas no Storage: HTTP 200 / `image/png`.
- Login do admin `admin@admin.com`: OK.
- Membership do admin: `owner` da loja `J-Gold-Relojoaria`.
- Insert anônimo em `products`: bloqueado com 401.
- Smoke transacional com rollback: categoria, marca, produto, imagem, seção, vínculo seção-produto, notificação, carrinho futuro e item de carrinho inseriram corretamente e não deixaram resíduo.
- Trigger de `updated_at`: validado sobrescrevendo valor manual antigo.

Observação: o cliente tem o índice `idx_push_subscriptions_endpoint_active`; isso é esperado, vem da migration `push_notifications_setup` e é uma melhoria em relação ao QA antigo.

## O que precisa ser configurado fora das migrations

As migrations não configuram tudo que é ambiente/projeto. Antes de colocar o cliente em produção, configurar também:

- Edge Function `send-push`;
- Edge Function `process-scheduled-push`;
- secrets das Edge Functions;
- `CRON_SECRET`;
- VAPID public/private keys;
- secrets do GitHub Actions para deploy;
- config pública do frontend (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `STORE_SLUG`, `PUBLIC_VAPID_KEY`);
- WhatsApp real da loja;
- restante dos produtos/imagens reais.

Estado atual das Edge Functions no cliente em 2026-09-13:

```text
send-push: ACTIVE
process-scheduled-push: ACTIVE
```

Secrets customizados pendentes em 2026-09-13:

```text
VAPID_PUBLIC_KEY: ausente
VAPID_PRIVATE_KEY: ausente
VAPID_SUBJECT: ausente
CRON_SECRET: ausente
```

## Dados reais iniciais já cadastrados no cliente

No projeto cliente `qufuwkgtkblevayhpjsb`, foram cadastrados:

```text
Loja: J Gold Relojoaria
Slug: J-Gold-Relojoaria
Categoria: Relógios
Marcas: Casio e Orient
Produtos: 2
Imagens: 2
Usuário admin: admin@admin.com como owner
```

Produtos iniciais:

```text
Casio GA 2100 — R$ 587,00 — 8x sem juros de R$ 73,37
Orient Submariner — R$ 1.098,00 — 10x sem juros de R$ 109,80
```

## Validação esperada depois de aplicar em outro banco novo

Rodar:

```bash
supabase db query --linked --file supabase/verify-setup.sql
```

Critérios mínimos:

- todas as 16 tabelas públicas existem;
- RLS está ativo nas tabelas públicas principais;
- funções críticas existem;
- policies públicas/admin existem;
- bucket `product-images` existe e é público;
- loja real pode ser criada;
- usuário owner/manager consegue acessar o admin;
- vitrine pública carrega pelo `STORE_SLUG` correto;
- `supabase db push --linked --dry-run` retorna banco atualizado após aplicação;
- inserts anônimos em tabelas administrativas continuam bloqueados.

## Importante

O arquivo `seed.sql` é apenas massa demonstrativa/QA. Para produção cliente, usar seed/importação própria com dados reais aprovados, sem reaproveitar dados de teste.

Não versionar nem registrar em caderno/vault:

- senhas;
- service role key;
- anon key completa, exceto em arquivo de config pública quando a estratégia de deploy assim exigir;
- tokens;
- secrets VAPID/cron.

## 20260517000000_product_options_catalog.sql

Adiciona o catálogo gerenciável de características e variações de produto:

- `product_option_groups`: grupos por loja, separados por `attribute` e `variant`;
- `product_option_values`: valores disponíveis por grupo;
- `product_option_selections`: valores selecionados por produto;
- triggers de `updated_at`;
- validações de consistência de loja/grupo/produto/valor;
- RLS/policies seguindo o padrão de `products`, `categories` e `brands`;
- índices por loja, tipo, grupo, status ativo e produto.

A migration mantém `products.attributes` e `products.variants` por compatibilidade. O admin passa a usar o catálogo como caminho principal, mas o payload final ainda preserva JSON compatível para a vitrine e rollback funcional.