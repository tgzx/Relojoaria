begin;

insert into public.stores (
  id,
  owner_id,
  name,
  slug,
  slogan,
  description,
  logo_url,
  is_active
) values (
  '11111111-1111-1111-1111-111111111111',
  null,
  'Relojoaria Aurora',
  'minha-loja',
  'Tempo, presente e estilo em uma única vitrine.',
  'Uma vitrine digital pensada para vender relógios, acessórios e presentes com atendimento rápido pelo WhatsApp.',
  'https://placehold.co/400x400/png?text=Aurora',
  true
)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  slogan = excluded.slogan,
  description = excluded.description,
  logo_url = excluded.logo_url,
  is_active = excluded.is_active;

insert into public.store_settings (
  id,
  store_id,
  whatsapp_number,
  whatsapp_default_message,
  instagram_url,
  address,
  business_hours,
  primary_color,
  secondary_color,
  theme_mode,
  intro_mode,
  hero_mode,
  enable_notifications,
  enable_favorites,
  enable_future_cart_flag,
  currency,
  locale
) values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  '5511999999999',
  'Olá! Vim pela vitrine da Relojoaria Aurora e gostaria de atendimento.',
  'https://instagram.com/relojoariaaurora',
  'Rua das Horas, 88 - Centro - São Paulo/SP',
  '{
    "monday":[{"start":"09:00","end":"18:00"}],
    "tuesday":[{"start":"09:00","end":"18:00"}],
    "wednesday":[{"start":"09:00","end":"18:00"}],
    "thursday":[{"start":"09:00","end":"18:00"}],
    "friday":[{"start":"09:00","end":"18:00"}],
    "saturday":[{"start":"09:00","end":"13:00"}],
    "sunday":[]
  }'::jsonb,
  '#111827',
  '#e56b2f',
  'light',
  'logo',
  'banner',
  true,
  true,
  false,
  'BRL',
  'pt-BR'
)
on conflict (store_id) do update set
  whatsapp_number = excluded.whatsapp_number,
  whatsapp_default_message = excluded.whatsapp_default_message,
  instagram_url = excluded.instagram_url,
  address = excluded.address,
  business_hours = excluded.business_hours,
  primary_color = excluded.primary_color,
  secondary_color = excluded.secondary_color,
  theme_mode = excluded.theme_mode,
  intro_mode = excluded.intro_mode,
  hero_mode = excluded.hero_mode,
  enable_notifications = excluded.enable_notifications,
  enable_favorites = excluded.enable_favorites,
  enable_future_cart_flag = excluded.enable_future_cart_flag,
  currency = excluded.currency,
  locale = excluded.locale;

insert into public.categories (id, store_id, name, slug, description, image_url, is_active, sort_order) values
('30000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Relógios Masculinos','relogios-masculinos','Modelos clássicos, casuais e esportivos para o dia a dia.','https://placehold.co/800x600/png?text=Masculinos',true,1),
('30000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Relógios Femininos','relogios-femininos','Peças elegantes e delicadas para diferentes ocasiões.','https://placehold.co/800x600/png?text=Femininos',true,2),
('30000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Smartwatches','smartwatches','Modelos conectados com recursos de saúde e produtividade.','https://placehold.co/800x600/png?text=Smartwatches',true,3),
('30000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','Pulseiras e Acessórios','pulseiras-e-acessorios','Pulseiras extras, carregadores, caixas e kits para presente.','https://placehold.co/800x600/png?text=Acessorios',true,4),
('30000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','Presentes','presentes','Sugestões especiais para aniversários, formaturas e datas marcantes.','https://placehold.co/800x600/png?text=Presentes',true,5)
on conflict (store_id, slug) do update set
  name = excluded.name,
  description = excluded.description,
  image_url = excluded.image_url,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

insert into public.brands (id, store_id, name, slug, logo_url, is_featured, is_active, sort_order) values
('40000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Aurora Time','aurora-time','https://placehold.co/240x120/png?text=Aurora+Time',true,true,1),
('40000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Atlas Chrono','atlas-chrono','https://placehold.co/240x120/png?text=Atlas+Chrono',true,true,2),
('40000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Lumiere','lumiere','https://placehold.co/240x120/png?text=Lumiere',true,true,3),
('40000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','Pulse One','pulse-one','https://placehold.co/240x120/png?text=Pulse+One',true,true,4),
('40000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','Vento','vento','https://placehold.co/240x120/png?text=Vento',false,true,5),
('40000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','Orion Wear','orion-wear','https://placehold.co/240x120/png?text=Orion+Wear',false,true,6)
on conflict (store_id, slug) do update set
  name = excluded.name,
  logo_url = excluded.logo_url,
  is_featured = excluded.is_featured,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

insert into public.products (
  id, store_id, category_id, brand_id, name, slug, sku, short_description, description, price, old_price, cost_price,
  stock_quantity, stock_status, is_active, is_archived, is_featured, is_new, is_best_seller, is_promotion,
  allow_whatsapp_cta, tags, attributes, variants, sort_order
) values
('50000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Aurora Classic Steel 40mm','aurora-classic-steel-40mm','AU-001','Relógio analógico com pulseira em aço escovado.','Modelo clássico com mostrador azul, vidro mineral e resistência para uso diário.',699.90,799.90,320.00,8,'in_stock',true,false,true,false,true,true,true,'{classico,aco,presente}'::text[],'{"material":"Aço","resistencia":"5 ATM","movimento":"Quartzo"}'::jsonb,'[{"name":"Cor","options":["Azul","Preto"]}]'::jsonb,1),
('50000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002','Atlas Explorer Carbon','atlas-explorer-carbon','AT-002','Visual robusto com caixa em fibra e pulseira de silicone.','Perfeito para quem gosta de relógio esportivo com presença no pulso.',859.90,null,410.00,5,'in_stock',true,false,true,true,false,false,true,'{esportivo,aventura,carbono}'::text[],'{"material":"Carbono","resistencia":"10 ATM","movimento":"Quartzo"}'::jsonb,'[{"name":"Tamanho","options":["44mm"]}]'::jsonb,2),
('50000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000003','Lumiere Heritage Gold','lumiere-heritage-gold','LU-003','Acabamento dourado e mostrador minimalista.','Peça elegante com perfil fino, ideal para eventos e presentes especiais.',949.90,1099.90,470.00,2,'low_stock',true,false,true,false,false,true,true,'{elegante,dourado,evento}'::text[],'{"material":"Aço dourado","resistencia":"3 ATM","movimento":"Quartzo"}'::jsonb,'[]'::jsonb,3),
('50000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000005','Vento Urban Mesh','vento-urban-mesh','VE-004','Pulseira mesh confortável com estilo urbano.','Relógio versátil para escritório e compromissos casuais.',529.90,null,250.00,12,'in_stock',true,false,false,false,false,false,true,'{mesh,urbano,casual}'::text[],'{"material":"Aço mesh","resistencia":"3 ATM","movimento":"Quartzo"}'::jsonb,'[]'::jsonb,4),
('50000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000006','Orion Pilot Midnight','orion-pilot-midnight','OR-005','Mostrador escuro com leitura rápida e visual inspirado na aviação.','Uma linha com visual marcante para quem gosta de relógios maiores.',789.90,899.90,360.00,4,'in_stock',true,false,false,true,true,true,true,'{piloto,preto,cronografo}'::text[],'{"material":"Aço","resistencia":"5 ATM","movimento":"Cronógrafo"}'::jsonb,'[{"name":"Cor","options":["Preto","Grafite"]}]'::jsonb,5),
('50000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000003','Lumiere Pearl Rose','lumiere-pearl-rose','LU-006','Relógio feminino com caixa rose e pulseira delicada.','Mostrador claro com detalhes sutis para usar no dia a dia ou em celebrações.',589.90,659.90,280.00,6,'in_stock',true,false,true,true,false,true,true,'{feminino,rose,presente}'::text[],'{"material":"Aço rose","resistencia":"3 ATM","movimento":"Quartzo"}'::jsonb,'[]'::jsonb,6),
('50000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','Aurora Slim Champagne','aurora-slim-champagne','AU-007','Design fino com pulseira ajustável e tom champagne.','Leve, elegante e confortável para uso contínuo.',479.90,null,210.00,7,'in_stock',true,false,false,false,false,false,true,'{slim,champagne,delicado}'::text[],'{"material":"Aço","resistencia":"3 ATM","movimento":"Quartzo"}'::jsonb,'[]'::jsonb,7),
('50000000-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','Atlas Bella Ceramic','atlas-bella-ceramic','AT-008','Acabamento cerâmico branco com visual sofisticado.','Uma peça moderna que combina com looks claros e casuais.',729.90,819.90,330.00,3,'low_stock',true,false,true,false,false,true,true,'{ceramica,branco,sofisticado}'::text[],'{"material":"Cerâmica","resistencia":"5 ATM","movimento":"Quartzo"}'::jsonb,'[]'::jsonb,8),
('50000000-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000005','Vento Soft Leather','vento-soft-leather','VE-009','Pulseira em couro macio com caixa discreta.','Ótima opção de presente com visual clássico e confortável.',399.90,null,180.00,10,'in_stock',true,false,false,false,true,false,true,'{couro,presente,classico}'::text[],'{"material":"Couro","resistencia":"3 ATM","movimento":"Quartzo"}'::jsonb,'[{"name":"Cor","options":["Caramelo","Preto"]}]'::jsonb,9),
('50000000-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000006','Orion Crystal Mini','orion-crystal-mini','OR-010','Caixa pequena com aplicação de cristais no aro.','Brilho discreto para eventos, jantares e presentes especiais.',649.90,739.90,300.00,5,'in_stock',true,false,true,true,false,true,true,'{cristal,mini,eventos}'::text[],'{"material":"Aço","resistencia":"3 ATM","movimento":"Quartzo"}'::jsonb,'[]'::jsonb,10),
('50000000-0000-0000-0000-000000000011','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000004','Pulse One Fit Neo','pulse-one-fit-neo','PO-011','Smartwatch com monitoramento de passos e sono.','Tela vibrante, notificações e bateria para vários dias de uso.',899.90,999.90,430.00,9,'in_stock',true,false,true,true,true,true,true,'{smartwatch,fitness,bluetooth}'::text[],'{"tela":"AMOLED","bateria":"7 dias","conectividade":"Bluetooth"}'::jsonb,'[{"name":"Cor","options":["Preto","Cinza","Rose"]}]'::jsonb,11),
('50000000-0000-0000-0000-000000000012','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000004','Pulse One Urban Call','pulse-one-urban-call','PO-012','Chamadas por Bluetooth e mostradores personalizáveis.','Ideal para quem quer praticidade no trabalho e no treino.',1199.90,null,580.00,7,'in_stock',true,false,true,false,true,false,true,'{smartwatch,chamadas,urbano}'::text[],'{"tela":"LCD","bateria":"5 dias","conectividade":"Bluetooth Calling"}'::jsonb,'[]'::jsonb,12),
('50000000-0000-0000-0000-000000000013','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000006','Orion Active Health','orion-active-health','OR-013','Sensores de frequência, oxigênio e treino guiado.','Linha esportiva com boa autonomia e pulseiras intercambiáveis.',1099.90,1249.90,520.00,3,'low_stock',true,false,true,false,false,true,true,'{saude,esporte,sensores}'::text[],'{"tela":"AMOLED","bateria":"6 dias","conectividade":"Bluetooth"}'::jsonb,'[{"name":"Pulseira","options":["Preta","Azul"]}]'::jsonb,13),
('50000000-0000-0000-0000-000000000014','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000002','Atlas Smart Round','atlas-smart-round','AT-014','Visual analógico com funções inteligentes no mostrador redondo.','Uma opção equilibrada para quem não abre mão do estilo clássico.',1329.90,null,650.00,4,'in_stock',true,false,false,true,false,false,true,'{round,smart,estilo}'::text[],'{"tela":"AMOLED","bateria":"4 dias","conectividade":"Bluetooth"}'::jsonb,'[]'::jsonb,14),
('50000000-0000-0000-0000-000000000015','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000001','Aurora Sync Mini','aurora-sync-mini','AU-015','Smartwatch compacto com foco em leveza e conforto.','Ótimo para quem quer começar a usar relógio inteligente sem exagero no tamanho.',749.90,829.90,360.00,11,'in_stock',true,false,false,false,false,true,true,'{compacto,smart,iniciante}'::text[],'{"tela":"LCD","bateria":"5 dias","conectividade":"Bluetooth"}'::jsonb,'[]'::jsonb,15),
('50000000-0000-0000-0000-000000000016','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000004','Pulseira Silicone Sport 22mm','pulseira-silicone-sport-22mm','AC-016','Pulseira extra confortável para smartwatches de 22mm.','Troca rápida e material resistente ao suor.',99.90,null,28.00,18,'in_stock',true,false,false,false,true,false,true,'{pulseira,acessorio,22mm}'::text[],'{"material":"Silicone","compatibilidade":"22mm"}'::jsonb,'[{"name":"Cor","options":["Preto","Azul","Vermelho"]}]'::jsonb,16),
('50000000-0000-0000-0000-000000000017','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000003','Estojo Premium para Relógio','estojo-premium-para-relogio','AC-017','Estojo rígido com acabamento interno macio.','Protege relógios e valoriza presentes com uma entrega mais elegante.',149.90,179.90,52.00,13,'in_stock',true,false,false,false,false,true,true,'{estojo,presente,protecao}'::text[],'{"material":"PU premium","capacidade":"1 relógio"}'::jsonb,'[]'::jsonb,17),
('50000000-0000-0000-0000-000000000018','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000005','Carregador Magnético Duo','carregador-magnetico-duo','AC-018','Base magnética compacta para relógios conectados.','Organiza a mesa e facilita a rotina de recarga.',189.90,null,74.00,9,'in_stock',true,false,false,true,false,false,true,'{carregador,smartwatch,mesa}'::text[],'{"alimentacao":"USB-C","compatibilidade":"Modelos magnéticos"}'::jsonb,'[]'::jsonb,18),
('50000000-0000-0000-0000-000000000019','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000002','Kit Ajuste de Pulseiras','kit-ajuste-de-pulseiras','AC-019','Conjunto com ferramentas para ajustes simples em casa.','Bom complemento para quem gosta de manter pulseiras sempre confortáveis.',79.90,null,21.00,5,'in_stock',true,false,false,false,false,false,true,'{ferramenta,kit,ajuste}'::text[],'{"itens":"5 peças","uso":"Ajuste simples"}'::jsonb,'[]'::jsonb,19),
('50000000-0000-0000-0000-000000000020','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000006','Pulseira Couro Vintage 20mm','pulseira-couro-vintage-20mm','AC-020','Pulseira extra em couro com aparência envelhecida.','Ideal para renovar relógios clássicos sem trocar a caixa.',129.90,149.90,46.00,4,'low_stock',true,false,false,false,false,true,true,'{couro,20mm,vintage}'::text[],'{"material":"Couro","compatibilidade":"20mm"}'::jsonb,'[{"name":"Cor","options":["Café","Preto"]}]'::jsonb,20),
('50000000-0000-0000-0000-000000000021','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000001','Kit Presente Aurora Couple','kit-presente-aurora-couple','KT-021','Kit com dois relógios coordenados e embalagem especial.','Perfeito para aniversários, casamentos e datas comemorativas.',1299.90,1499.90,620.00,2,'low_stock',true,false,true,false,true,true,true,'{kit,casal,presente}'::text[],'{"conteudo":"2 relógios + estojo","resistencia":"3 ATM"}'::jsonb,'[]'::jsonb,21),
('50000000-0000-0000-0000-000000000022','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000003','Combo Smart Start','combo-smart-start','KT-022','Smartwatch com pulseira extra e carregador compacto.','Entrada forte para quem quer vender ticket médio com praticidade.',1199.90,1359.90,590.00,6,'in_stock',true,false,true,true,false,true,true,'{combo,smartwatch,kit}'::text[],'{"conteudo":"Smartwatch + pulseira + carregador"}'::jsonb,'[]'::jsonb,22),
('50000000-0000-0000-0000-000000000023','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000005','Caixa Presente Luxo','caixa-presente-luxo','PR-023','Caixa para presente com laço e acabamento premium.','Complementa a compra e melhora a percepção de valor do produto.',59.90,null,14.00,15,'in_stock',true,false,false,false,false,false,true,'{presente,caixa,embalagem}'::text[],'{"acabamento":"Premium","uso":"Embalagem"}'::jsonb,'[]'::jsonb,23),
('50000000-0000-0000-0000-000000000024','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000002','Seleção Formatura Atlas','selecao-formatura-atlas','PR-024','Relógio social com estojo e cartão para presente.','Uma solução pronta para presentear sem complicação.',989.90,1129.90,470.00,5,'in_stock',true,false,true,false,false,true,true,'{formatura,presente,social}'::text[],'{"conteudo":"Relógio + estojo + cartão"}'::jsonb,'[]'::jsonb,24),
('50000000-0000-0000-0000-000000000025','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002','Atlas Chrono Blue','atlas-chrono-blue','AT-025','Cronógrafo azul com pulseira em aço escuro.','Modelo de visual marcante para quem prefere presença no pulso.',1199.90,null,580.00,5,'in_stock',true,false,false,true,true,false,true,'{cronografo,azul,aco}'::text[],'{"material":"Aço","resistencia":"10 ATM","movimento":"Cronógrafo"}'::jsonb,'[]'::jsonb,25),
('50000000-0000-0000-0000-000000000026','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','Aurora Mini Milanese','aurora-mini-milanese','AU-026','Pulseira milanesa leve com caixa compacta.','Uma peça confortável para uso contínuo e look refinado.',519.90,589.90,240.00,8,'in_stock',true,false,false,true,false,true,true,'{milanesa,mini,feminino}'::text[],'{"material":"Aço","resistencia":"3 ATM","movimento":"Quartzo"}'::jsonb,'[]'::jsonb,26),
('50000000-0000-0000-0000-000000000027','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000004','Pulse One Kids Safe','pulse-one-kids-safe','PO-027','Relógio inteligente infantil com localização e SOS.','Pensado para rotina da família com usabilidade simples.',799.90,null,370.00,6,'in_stock',true,false,true,true,false,false,true,'{kids,seguranca,gps}'::text[],'{"tela":"LCD","bateria":"3 dias","conectividade":"4G"}'::jsonb,'[{"name":"Cor","options":["Azul","Rosa"]}]'::jsonb,27),
('50000000-0000-0000-0000-000000000028','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000003','Pulseira Milanesa 18mm','pulseira-milanesa-18mm','AC-028','Pulseira metálica extra para relógios de caixa menor.','Ótima para atualizar o visual sem trocar o relógio inteiro.',109.90,null,35.00,7,'in_stock',true,false,false,false,false,false,true,'{milanesa,18mm,acessorio}'::text[],'{"material":"Aço","compatibilidade":"18mm"}'::jsonb,'[{"name":"Cor","options":["Prata","Rose"]}]'::jsonb,28),
('50000000-0000-0000-0000-000000000029','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000006','Kit Presente Orion Executivo','kit-presente-orion-executivo','KT-029','Relógio executivo com caixa premium e pulseira extra.','Um combo que aumenta valor percebido para clientes corporativos.',1399.90,1569.90,670.00,3,'low_stock',true,false,true,false,true,true,true,'{executivo,kit,presente}'::text[],'{"conteudo":"Relógio + caixa + pulseira extra"}'::jsonb,'[]'::jsonb,29),
('50000000-0000-0000-0000-000000000030','11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000005','Vento Day Date Brown','vento-day-date-brown','VE-030','Mostrador marrom com calendário completo.','Boa escolha para quem gosta de cores quentes e visual sofisticado.',639.90,null,290.00,9,'in_stock',true,false,false,false,false,false,true,'{daydate,marrom,classico}'::text[],'{"material":"Aço e couro","resistencia":"5 ATM","movimento":"Quartzo"}'::jsonb,'[]'::jsonb,30)
on conflict (store_id, slug) do update set
  name = excluded.name,
  sku = excluded.sku,
  short_description = excluded.short_description,
  description = excluded.description,
  price = excluded.price,
  old_price = excluded.old_price,
  cost_price = excluded.cost_price,
  stock_quantity = excluded.stock_quantity,
  stock_status = excluded.stock_status,
  is_active = excluded.is_active,
  is_archived = excluded.is_archived,
  is_featured = excluded.is_featured,
  is_new = excluded.is_new,
  is_best_seller = excluded.is_best_seller,
  is_promotion = excluded.is_promotion,
  allow_whatsapp_cta = excluded.allow_whatsapp_cta,
  tags = excluded.tags,
  attributes = excluded.attributes,
  variants = excluded.variants,
  sort_order = excluded.sort_order;

insert into public.product_images (id, store_id, product_id, image_url, storage_path, alt_text, is_primary, sort_order) values
('60000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000001','https://placehold.co/900x900/png?text=Produto+01',null,'Aurora Classic Steel 40mm',true,0),
('60000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000002','https://placehold.co/900x900/png?text=Produto+02',null,'Atlas Explorer Carbon',true,0),
('60000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000003','https://placehold.co/900x900/png?text=Produto+03',null,'Lumiere Heritage Gold',true,0),
('60000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000004','https://placehold.co/900x900/png?text=Produto+04',null,'Vento Urban Mesh',true,0),
('60000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000005','https://placehold.co/900x900/png?text=Produto+05',null,'Orion Pilot Midnight',true,0),
('60000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000006','https://placehold.co/900x900/png?text=Produto+06',null,'Lumiere Pearl Rose',true,0),
('60000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000007','https://placehold.co/900x900/png?text=Produto+07',null,'Aurora Slim Champagne',true,0),
('60000000-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000008','https://placehold.co/900x900/png?text=Produto+08',null,'Atlas Bella Ceramic',true,0),
('60000000-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000009','https://placehold.co/900x900/png?text=Produto+09',null,'Vento Soft Leather',true,0),
('60000000-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000010','https://placehold.co/900x900/png?text=Produto+10',null,'Orion Crystal Mini',true,0),
('60000000-0000-0000-0000-000000000011','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000011','https://placehold.co/900x900/png?text=Produto+11',null,'Pulse One Fit Neo',true,0),
('60000000-0000-0000-0000-000000000012','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000012','https://placehold.co/900x900/png?text=Produto+12',null,'Pulse One Urban Call',true,0),
('60000000-0000-0000-0000-000000000013','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000013','https://placehold.co/900x900/png?text=Produto+13',null,'Orion Active Health',true,0),
('60000000-0000-0000-0000-000000000014','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000014','https://placehold.co/900x900/png?text=Produto+14',null,'Atlas Smart Round',true,0),
('60000000-0000-0000-0000-000000000015','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000015','https://placehold.co/900x900/png?text=Produto+15',null,'Aurora Sync Mini',true,0),
('60000000-0000-0000-0000-000000000016','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000016','https://placehold.co/900x900/png?text=Produto+16',null,'Pulseira Silicone Sport 22mm',true,0),
('60000000-0000-0000-0000-000000000017','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000017','https://placehold.co/900x900/png?text=Produto+17',null,'Estojo Premium para Relógio',true,0),
('60000000-0000-0000-0000-000000000018','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000018','https://placehold.co/900x900/png?text=Produto+18',null,'Carregador Magnético Duo',true,0),
('60000000-0000-0000-0000-000000000019','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000019','https://placehold.co/900x900/png?text=Produto+19',null,'Kit Ajuste de Pulseiras',true,0),
('60000000-0000-0000-0000-000000000020','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000020','https://placehold.co/900x900/png?text=Produto+20',null,'Pulseira Couro Vintage 20mm',true,0),
('60000000-0000-0000-0000-000000000021','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000021','https://placehold.co/900x900/png?text=Produto+21',null,'Kit Presente Aurora Couple',true,0),
('60000000-0000-0000-0000-000000000022','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000022','https://placehold.co/900x900/png?text=Produto+22',null,'Combo Smart Start',true,0),
('60000000-0000-0000-0000-000000000023','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000023','https://placehold.co/900x900/png?text=Produto+23',null,'Caixa Presente Luxo',true,0),
('60000000-0000-0000-0000-000000000024','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000024','https://placehold.co/900x900/png?text=Produto+24',null,'Seleção Formatura Atlas',true,0),
('60000000-0000-0000-0000-000000000025','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000025','https://placehold.co/900x900/png?text=Produto+25',null,'Atlas Chrono Blue',true,0),
('60000000-0000-0000-0000-000000000026','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000026','https://placehold.co/900x900/png?text=Produto+26',null,'Aurora Mini Milanese',true,0),
('60000000-0000-0000-0000-000000000027','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000027','https://placehold.co/900x900/png?text=Produto+27',null,'Pulse One Kids Safe',true,0),
('60000000-0000-0000-0000-000000000028','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000028','https://placehold.co/900x900/png?text=Produto+28',null,'Pulseira Milanesa 18mm',true,0),
('60000000-0000-0000-0000-000000000029','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000029','https://placehold.co/900x900/png?text=Produto+29',null,'Kit Presente Orion Executivo',true,0),
('60000000-0000-0000-0000-000000000030','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000030','https://placehold.co/900x900/png?text=Produto+30',null,'Vento Day Date Brown',true,0)
on conflict (id) do update set
  image_url = excluded.image_url,
  alt_text = excluded.alt_text,
  is_primary = excluded.is_primary,
  sort_order = excluded.sort_order;

insert into public.product_sections (
  id, store_id, title, slug, description, type, is_active, sort_order, selection_mode,
  automatic_rule, automatic_params, max_items, layout, refresh_frequency, last_refreshed_at
) values
('70000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Destaques da loja','destaques','Produtos para chamar atenção logo na primeira visita.','featured',true,1,'automatic','featured','{}'::jsonb,8,'horizontal_carousel','daily',now()),
('70000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Promoções da semana','promocoes','Ofertas pensadas para girar estoque e aumentar conversão.','promotion',true,2,'automatic','promotion','{}'::jsonb,8,'grid','daily',now()),
('70000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Novidades','novidades','O que acabou de entrar e merece destaque imediato.','newest',true,3,'automatic','newest','{}'::jsonb,8,'horizontal_carousel','daily',now()),
('70000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','Mais vendidos','mais-vendidos','Itens de maior saída e interesse na loja.','best_seller',true,4,'automatic','best_seller','{}'::jsonb,8,'horizontal_carousel','weekly',now()),
('70000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','Combos e kits','combos-e-kits','Combinações para aumentar ticket médio com argumento simples.','custom',true,5,'manual',null,'{}'::jsonb,8,'grid','manual',now()),
('70000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','Últimas unidades','ultimas-unidades','Produtos com estoque baixo que pedem ação rápida do cliente.','low_stock',true,6,'automatic','low_stock','{}'::jsonb,8,'horizontal_carousel','daily',now())
on conflict (store_id, slug) do update set
  title = excluded.title,
  description = excluded.description,
  type = excluded.type,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  selection_mode = excluded.selection_mode,
  automatic_rule = excluded.automatic_rule,
  automatic_params = excluded.automatic_params,
  max_items = excluded.max_items,
  layout = excluded.layout,
  refresh_frequency = excluded.refresh_frequency,
  last_refreshed_at = excluded.last_refreshed_at;

insert into public.section_products (id, store_id, section_id, product_id, sort_order) values
('80000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','70000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',1),
('80000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','70000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002',2),
('80000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','70000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000003',3),
('80000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','70000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000001',1),
('80000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','70000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000003',2),
('80000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','70000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000006',3),
('80000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','70000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000011',1),
('80000000-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','70000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000027',2),
('80000000-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111','70000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000001',1),
('80000000-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111111','70000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000011',2),
('80000000-0000-0000-0000-000000000011','11111111-1111-1111-1111-111111111111','70000000-0000-0000-0000-000000000005','50000000-0000-0000-0000-000000000021',1),
('80000000-0000-0000-0000-000000000012','11111111-1111-1111-1111-111111111111','70000000-0000-0000-0000-000000000005','50000000-0000-0000-0000-000000000022',2),
('80000000-0000-0000-0000-000000000013','11111111-1111-1111-1111-111111111111','70000000-0000-0000-0000-000000000005','50000000-0000-0000-0000-000000000029',3),
('80000000-0000-0000-0000-000000000014','11111111-1111-1111-1111-111111111111','70000000-0000-0000-0000-000000000006','50000000-0000-0000-0000-000000000003',1),
('80000000-0000-0000-0000-000000000015','11111111-1111-1111-1111-111111111111','70000000-0000-0000-0000-000000000006','50000000-0000-0000-0000-000000000008',2),
('80000000-0000-0000-0000-000000000016','11111111-1111-1111-1111-111111111111','70000000-0000-0000-0000-000000000006','50000000-0000-0000-0000-000000000013',3),
('80000000-0000-0000-0000-000000000017','11111111-1111-1111-1111-111111111111','70000000-0000-0000-0000-000000000006','50000000-0000-0000-0000-000000000020',4),
('80000000-0000-0000-0000-000000000018','11111111-1111-1111-1111-111111111111','70000000-0000-0000-0000-000000000006','50000000-0000-0000-0000-000000000029',5)
on conflict (section_id, product_id) do update set
  sort_order = excluded.sort_order;

insert into public.banners (
  id, store_id, title, subtitle, image_url, target_url, target_type, is_active, sort_order, starts_at, ends_at
) values
('90000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Coleção clássica em destaque','Relógios elegantes para presentear ou elevar o visual do dia a dia.','https://placehold.co/1600x720/png?text=Banner+Classicos','https://wa.me/5511999999999','hero',true,1,now() - interval '1 day',now() + interval '90 days'),
('90000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Semana de smartwatches','Modelos conectados com preço especial e atendimento direto pelo WhatsApp.','https://placehold.co/1600x720/png?text=Banner+Smartwatches','https://wa.me/5511999999999','hero',true,2,now() - interval '1 day',now() + interval '60 days'),
('90000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Presentes prontos para entrega','Kits e caixas especiais para quem quer vender rápido em datas comemorativas.','https://placehold.co/1600x720/png?text=Banner+Presentes','https://wa.me/5511999999999','hero',true,3,now() - interval '1 day',now() + interval '120 days')
on conflict (id) do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  image_url = excluded.image_url,
  target_url = excluded.target_url,
  target_type = excluded.target_type,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at;

commit;
