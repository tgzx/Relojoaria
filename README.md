# VitrineZap PWA

Vitrine digital em HTML, CSS e JavaScript puros, com Supabase no backend, PWA instalável, área administrativa mobile-first e integração com WhatsApp para pequenos negócios.

## Visão geral

O `VitrineZap PWA` foi pensado para lojas locais, vendedores autônomos, relojoarias, hamburguerias, cosméticos, roupas, eletrônicos e operações pequenas que precisam:

- Expor produtos em uma vitrine bonita e rápida.
- Facilitar busca e navegação por seções.
- Direcionar o cliente para o WhatsApp com mensagem pronta.
- Gerenciar catálogo, home, banners e notificações pelo celular.
- Ficar preparado para evoluir depois para carrinho, checkout e pedidos.

## Funcionalidades

### Cliente

- Home pública com hero configurável.
- Splash/intro configurável por banco.
- Chips de navegação sticky por seção.
- Busca e filtros.
- Cards de produto com badges.
- Modal de detalhes com galeria, atributos e variações simples.
- CTA para WhatsApp com mensagem pronta.
- Favoritos locais via `localStorage`.
- PWA instalável.
- Push notifications como melhoria progressiva.
- Offline básico com cache de assets e fallback.

### Admin

- Login com Supabase Auth.
- Validação de acesso por `store_members`.
- Dashboard com visão geral.
- CRUD de produtos com editor em etapas.
- Upload de imagens para Supabase Storage.
- CRUD de seções com modo manual e automático.
- CRUD de categorias e marcas.
- Gestão de banners.
- Configuração da loja e aparência.
- Criação e envio de notificações push.
- Pré-visualização do site.

### Preparado para o futuro

- Tabelas `future_carts` e `future_cart_items`.
- Flag `enable_future_cart_flag`.
- Estrutura de `variants` em produto.
- Separação entre interesse/WhatsApp e carrinho futuro.

## Estrutura de pastas

```text
/
├── index.html
├── admin.html
├── offline.html
├── manifest.json
├── service-worker.js
├── css/
│   ├── styles.css
│   └── admin.css
├── js/
│   ├── config.js
│   ├── supabaseClient.js
│   ├── storeApi.js
│   ├── app.js
│   ├── admin.js
│   ├── pwa.js
│   ├── push.js
│   ├── utils.js
│   └── cartFuture.js
├── assets/
│   ├── icons/
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   └── placeholders/
│       └── product-placeholder.svg
└── supabase/
    ├── schema.sql
    ├── seed.sql
    └── edge-functions/
        └── send-push/
            └── index.ts
```

## Arquitetura resumida

- `index.html` e `app.js`: experiência pública.
- `admin.html` e `admin.js`: painel de gestão.
- `storeApi.js`: camada de acesso ao Supabase.
- `utils.js`: formatação, storage local, WhatsApp e helpers.
- `pwa.js` + `service-worker.js`: instalação, cache e push.
- `schema.sql`: estrutura completa do banco com RLS.
- `seed.sql`: loja demo com categorias, marcas, produtos e seções.

## 1. Criar conta e projeto no Supabase

1. Acesse o Supabase.
2. Clique em `New Project`.
3. Escolha nome, senha segura do banco e região.
4. Aguarde a criação do projeto.

## 2. Copiar credenciais públicas

1. No projeto, vá em `Project Settings`.
2. Abra `API`.
3. Copie:
   - `Project URL`
   - `anon public key`
4. Abra [js/config.js](/c:/Users/tiago/OneDrive/Documentos/Relojoaria/js/config.js) e cole:

```js
export const APP_CONFIG = {
  SUPABASE_URL: "COLE_AQUI_SUA_SUPABASE_URL",
  SUPABASE_ANON_KEY: "COLE_AQUI_SUA_SUPABASE_ANON_KEY",
  STORE_SLUG: "minha-loja",
  PUBLIC_VAPID_KEY: "COLE_AQUI_SUA_PUBLIC_VAPID_KEY",
  APP_NAME: "VitrineZap"
};
```

## 3. Criar tabelas e políticas

1. No Supabase, abra `SQL Editor`.
2. Clique em `New Query`.
3. Cole o conteúdo de [schema.sql](/c:/Users/tiago/OneDrive/Documentos/Relojoaria/supabase/schema.sql).
4. Clique em `Run`.

Esse arquivo cria:

- Tabelas principais.
- Índices.
- Triggers de `updated_at`.
- Funções auxiliares.
- RLS.
- Policies.
- Policies de `storage.objects`.

## 4. Inserir dados iniciais

1. Ainda no `SQL Editor`, crie uma nova query.
2. Cole o conteúdo de [seed.sql](/c:/Users/tiago/OneDrive/Documentos/Relojoaria/supabase/seed.sql).
3. Clique em `Run`.

O seed cria:

- 1 loja.
- Configurações da loja.
- 5 categorias.
- 6 marcas.
- 30 produtos fictícios.
- 6 seções.
- 3 banners.

## 5. Criar bucket de imagens

1. No Supabase, abra `Storage`.
2. Clique em `New bucket`.
3. Nomeie como `product-images`.
4. Pode usar bucket público ou manter leitura pública por policy.
5. As policies SQL do projeto já consideram esse bucket.

Estrutura usada nos uploads:

- `stores/{storeId}/products/{productId}/{timestamp}-{arquivo}`
- `stores/{storeId}/banners/{timestamp}-{arquivo}`

## 6. Configurar Auth e criar primeiro gerente

1. Vá em `Authentication`.
2. Habilite `Email / Password`.
3. Em `Users`, clique em `Add user`.
4. Crie o email e senha do gerente.
5. Copie o `user id`.

O trigger do `schema.sql` cria o `profile` automaticamente ao cadastrar o usuário.

Agora vincule o usuário à loja.

### Exemplo SQL para definir owner ou manager

```sql
insert into public.store_members (store_id, user_id, role)
values (
  '11111111-1111-1111-1111-111111111111',
  'COLE_AQUI_O_USER_ID',
  'owner'
)
on conflict (store_id, user_id) do update set role = excluded.role;

update public.stores
set owner_id = 'COLE_AQUI_O_USER_ID'
where id = '11111111-1111-1111-1111-111111111111';
```

## 7. Configurar notificações push

### Gerar VAPID keys

Você pode gerar com qualquer ferramenta compatível com Web Push. Depois:

- Cole a chave pública em `js/config.js` no campo `PUBLIC_VAPID_KEY`.
- Guarde a privada para a Edge Function.

### Configurar secrets da Edge Function

Defina estes secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

Exemplo de `VAPID_SUBJECT`:

- `mailto:contato@sualoja.com`

### Deploy da Edge Function

1. Instale a Supabase CLI, se necessário.
2. Faça login.
3. Linke o projeto.
4. Faça deploy:

```bash
supabase functions deploy send-push
```

## 8. Rodar localmente

Não abra com `file://`.

Use um servidor local, por exemplo:

```bash
python -m http.server 5500
```

Depois abra:

- `http://localhost:5500/index.html`
- `http://localhost:5500/admin.html`

## 9. Testar a vitrine pública

Confira:

- Carregamento da home.
- Hero configurável.
- Seções.
- Busca.
- Filtros.
- Modal do produto.
- Favoritos.
- CTA do WhatsApp.

## 10. Testar o painel admin

Confira:

- Login.
- Dashboard.
- Cadastro e edição de produto.
- Upload de imagem.
- Gestão de seções.
- Gestão de categorias e marcas.
- Banners.
- Configurações da loja.
- Prévia do site.

## 11. Testar o PWA

1. Rode em `localhost` ou `HTTPS`.
2. Abra DevTools.
3. Vá em `Application`.
4. Verifique:
   - `Manifest`
   - `Service Workers`
   - Instalação do app

## 12. Testar notificações

1. Configure as VAPID keys.
2. Faça deploy da Edge Function.
3. Abra a vitrine pública.
4. Clique em `Receber novidades`.
5. Aceite a permissão do navegador.
6. No admin, crie uma notificação.
7. Clique em enviar.

## 13. Publicar gratuitamente

### Frontend estático

Você pode publicar em:

- GitHub Pages
- Netlify
- Vercel

### Backend

- Supabase

### Importante

- Produção precisa de `HTTPS` para PWA e push funcionarem corretamente.
- O frontend usa apenas `anon key`.
- Nunca exponha `service_role key` no navegador.

## 14. Limitações do plano gratuito

Monitore:

- Uso do banco.
- Bandwidth.
- Storage.
- Edge Functions.
- Quantidade de notificações.

Boas práticas:

- Otimize imagens antes do upload.
- Evite spam de push.
- Reaproveite seções automáticas.
- Faça limpeza periódica de assets antigos.

## 15. Como trocar os dados da loja

Você pode trocar os dados de duas formas:

1. Pelo painel `admin.html`.
2. Diretamente no Supabase:
   - `stores`
   - `store_settings`
   - `categories`
   - `brands`
   - `products`
   - `banners`
   - `product_sections`

Se quiser mudar qual loja o frontend carrega, altere `STORE_SLUG` em [config.js](/c:/Users/tiago/OneDrive/Documentos/Relojoaria/js/config.js).

## 16. Pontos prontos para carrinho futuro

- Arquivo [cartFuture.js](/c:/Users/tiago/OneDrive/Documentos/Relojoaria/js/cartFuture.js).
- Flag `enable_future_cart_flag`.
- Tabelas `future_carts` e `future_cart_items`.
- Campo `variants` em `products`.
- Separação entre CTA de WhatsApp e ação futura de carrinho.

## 17. Próximas melhorias

- Carrinho real.
- Checkout.
- Pedidos.
- Histórico de pedidos.
- Login do cliente.
- Cupons.
- Frete e retirada.
- Avaliações.
- Relatórios.
- Integração com pagamento.
- Integração com logística.

## Observações importantes

- O frontend nunca usa `service_role`.
- O acesso administrativo é protegido por Auth + RLS.
- A leitura pública enxerga apenas dados ativos/publicados.
- O seed usa dados fictícios e seguros para demonstração.
