import { supabase } from "./supabaseClient.js";
import { buildStorageFileName, normalizeProduct, parseJsonSafe } from "./utils.js";

const PUBLIC_PRODUCT_SELECT = `
  id,
  store_id,
  category_id,
  brand_id,
  name,
  slug,
  sku,
  short_description,
  description,
  price,
  old_price,
  stock_quantity,
  stock_status,
  is_active,
  is_archived,
  is_featured,
  is_new,
  is_best_seller,
  is_promotion,
  allow_whatsapp_cta,
  tags,
  attributes,
  variants,
  sort_order,
  view_count,
  interest_count,
  created_at,
  updated_at,
  category:categories(id,name,slug),
  brand:brands(id,name,slug,logo_url),
  images:product_images(id,image_url,storage_path,alt_text,is_primary,sort_order)
`;

const ADMIN_PRODUCT_SELECT = `
  ${PUBLIC_PRODUCT_SELECT},
  cost_price
`;

function throwIfError(result, fallbackMessage) {
  if (result.error) {
    throw result.error;
  }
  return result.data;
}

function mapProducts(rows = []) {
  return rows.map((row) => normalizeProduct(row));
}

function nowIso() {
  return new Date().toISOString();
}

function parseTags(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sanitizeProductPayload(payload = {}) {
  return {
    store_id: payload.store_id,
    category_id: payload.category_id || null,
    brand_id: payload.brand_id || null,
    name: payload.name,
    slug: payload.slug,
    sku: payload.sku || null,
    short_description: payload.short_description || null,
    description: payload.description || null,
    price: Number(payload.price || 0),
    old_price: payload.old_price === "" || payload.old_price === null ? null : Number(payload.old_price),
    cost_price: payload.cost_price === "" || payload.cost_price === null ? null : Number(payload.cost_price),
    stock_quantity: Number(payload.stock_quantity || 0),
    stock_status: payload.stock_status || "in_stock",
    is_active: Boolean(payload.is_active),
    is_archived: Boolean(payload.is_archived),
    is_featured: Boolean(payload.is_featured),
    is_new: Boolean(payload.is_new),
    is_best_seller: Boolean(payload.is_best_seller),
    is_promotion: Boolean(payload.is_promotion),
    allow_whatsapp_cta: payload.allow_whatsapp_cta !== false,
    tags: parseTags(payload.tags),
    attributes: parseJsonSafe(payload.attributes, payload.attributes || {}),
    variants: parseJsonSafe(payload.variants, payload.variants || []),
    sort_order: Number(payload.sort_order || 0)
  };
}

export async function getStoreBySlug(slug) {
  const result = await supabase
    .from("stores")
    .select("id, owner_id, name, slug, slogan, description, logo_url, is_active, created_at, updated_at")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  return throwIfError(result, "Não foi possível carregar a loja.");
}

export async function getStoreSettings(storeId) {
  const result = await supabase.from("store_settings").select("*").eq("store_id", storeId).single();
  return throwIfError(result, "Não foi possível carregar as configurações da loja.");
}

export async function getPublicHomeData(storeSlug) {
  const store = await getStoreBySlug(storeSlug);

  const [settingsRes, sectionsRes, bannersRes, brandsRes, categoriesRes] = await Promise.all([
    supabase.from("store_settings").select("*").eq("store_id", store.id).single(),
    supabase
      .from("product_sections")
      .select(
        `
          *,
          section_products(
            id,
            sort_order,
            product:products(
              ${PUBLIC_PRODUCT_SELECT}
            )
          )
        `
      )
      .eq("store_id", store.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("sort_order", { foreignTable: "section_products", ascending: true }),
    supabase
      .from("banners")
      .select("*")
      .eq("store_id", store.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("brands")
      .select("*")
      .eq("store_id", store.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("categories")
      .select("*")
      .eq("store_id", store.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
  ]);

  const sections = throwIfError(sectionsRes, "Não foi possível carregar as seções.").map((section) => ({
    ...section,
    products: mapProducts(
      (section.section_products || [])
        .map((entry) => entry.product)
        .filter(Boolean)
        .sort((left, right) => (left.sort_order || 0) - (right.sort_order || 0))
    )
  }));

  const banners = throwIfError(bannersRes, "Não foi possível carregar os banners.").filter((banner) => {
    const now = new Date();
    const startsAt = banner.starts_at ? new Date(banner.starts_at) : null;
    const endsAt = banner.ends_at ? new Date(banner.ends_at) : null;
    if (startsAt && startsAt > now) return false;
    if (endsAt && endsAt < now) return false;
    return true;
  });

  return {
    store,
    settings: throwIfError(settingsRes, "Não foi possível carregar as configurações."),
    sections,
    banners,
    brands: throwIfError(brandsRes, "Não foi possível carregar as marcas."),
    categories: throwIfError(categoriesRes, "Não foi possível carregar as categorias.")
  };
}

export async function getProducts({
  storeId,
  search = "",
  categoryId = "",
  brandId = "",
  flags = {},
  priceMin = "",
  priceMax = "",
  sort = "featured",
  limit = 12,
  offset = 0
}) {
  let query = supabase
    .from("products")
    .select(PUBLIC_PRODUCT_SELECT, { count: "exact" })
    .eq("store_id", storeId)
    .eq("is_active", true)
    .eq("is_archived", false);

  if (categoryId) query = query.eq("category_id", categoryId);
  if (brandId) query = query.eq("brand_id", brandId);
  if (flags?.promotionOnly) query = query.eq("is_promotion", true);
  if (flags?.newOnly) query = query.eq("is_new", true);
  if (Number.isFinite(Number(priceMin)) && priceMin !== "") query = query.gte("price", Number(priceMin));
  if (Number.isFinite(Number(priceMax)) && priceMax !== "") query = query.lte("price", Number(priceMax));

  if (search) {
    query = query.or(
      [
        `name.ilike.%${search}%`,
        `short_description.ilike.%${search}%`,
        `description.ilike.%${search}%`,
        `sku.ilike.%${search}%`
      ].join(",")
    );
  }

  switch (sort) {
    case "recent":
      query = query.order("created_at", { ascending: false });
      break;
    case "price_asc":
      query = query.order("price", { ascending: true });
      break;
    case "price_desc":
      query = query.order("price", { ascending: false });
      break;
    case "best_seller":
      query = query.order("is_best_seller", { ascending: false }).order("interest_count", { ascending: false });
      break;
    case "az":
      query = query.order("name", { ascending: true });
      break;
    case "featured":
    default:
      query = query
        .order("is_featured", { ascending: false })
        .order("is_promotion", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      break;
  }

  const effectiveLimit = search ? Math.max(limit, 48) : limit;
  const result = await query.range(offset, offset + effectiveLimit - 1);
  const rows = mapProducts(throwIfError(result, "Não foi possível carregar os produtos."));
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = normalizedSearch
    ? rows.filter((product) =>
        [
          product.name,
          product.short_description,
          product.description,
          product.brand?.name,
          product.category?.name,
          ...(product.tags || [])
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch)
      )
    : rows;

  return {
    data: filtered.slice(0, limit),
    count: result.count || filtered.length,
    hasMore: offset + filtered.length < (result.count || filtered.length)
  };
}

export async function getProductBySlug(storeId, slug) {
  const result = await supabase
    .from("products")
    .select(PUBLIC_PRODUCT_SELECT)
    .eq("store_id", storeId)
    .eq("slug", slug)
    .eq("is_active", true)
    .eq("is_archived", false)
    .single();

  return normalizeProduct(throwIfError(result, "Não foi possível carregar o produto."));
}

export async function incrementProductView(productId) {
  const result = await supabase.rpc("increment_product_view", { target_product_id: productId });
  throwIfError(result, "Falha ao incrementar visualização.");
}

export async function incrementProductInterest(productId) {
  const result = await supabase.rpc("increment_product_interest", { target_product_id: productId });
  throwIfError(result, "Falha ao registrar interesse.");
}

export async function adminListProducts(storeId, filters = {}) {
  let query = supabase
    .from("products")
    .select(ADMIN_PRODUCT_SELECT, { count: "exact" })
    .eq("store_id", storeId)
    .order("updated_at", { ascending: false });

  if (filters.search) query = query.ilike("name", `%${filters.search}%`);
  if (filters.status === "active") query = query.eq("is_active", true).eq("is_archived", false);
  if (filters.status === "inactive") query = query.eq("is_active", false).eq("is_archived", false);
  if (filters.status === "archived") query = query.eq("is_archived", true);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.brandId) query = query.eq("brand_id", filters.brandId);

  const result = await query;
  return {
    data: mapProducts(throwIfError(result, "Não foi possível listar os produtos.")),
    count: result.count || 0
  };
}

export async function adminCreateProduct(payload) {
  const result = await supabase
    .from("products")
    .insert(sanitizeProductPayload(payload))
    .select(ADMIN_PRODUCT_SELECT)
    .single();

  return normalizeProduct(throwIfError(result, "Não foi possível criar o produto."));
}

export async function adminUpdateProduct(id, payload) {
  const result = await supabase
    .from("products")
    .update(sanitizeProductPayload(payload))
    .eq("id", id)
    .select(ADMIN_PRODUCT_SELECT)
    .single();

  return normalizeProduct(throwIfError(result, "Não foi possível atualizar o produto."));
}

export async function adminArchiveProduct(id) {
  const result = await supabase
    .from("products")
    .update({ is_archived: true, is_active: false, updated_at: nowIso() })
    .eq("id", id);

  throwIfError(result, "Não foi possível arquivar o produto.");
}

export async function adminDeleteProduct(id) {
  const result = await supabase.from("products").delete().eq("id", id);
  throwIfError(result, "Não foi possível excluir o produto.");
}

export async function adminBulkUpdateProducts(ids = [], patch = {}) {
  if (!ids.length) return;
  const result = await supabase.from("products").update(patch).in("id", ids);
  throwIfError(result, "Não foi possível aplicar a ação em massa.");
}

export async function adminUpdateStore(id, payload) {
  const result = await supabase.from("stores").update(payload).eq("id", id).select("*").single();
  return throwIfError(result, "Não foi possível atualizar a loja.");
}

export async function uploadProductImage(file, storeId, productId) {
  const extension = file.name.split(".").pop() || "jpg";
  const path = `stores/${storeId}/products/${productId}/${buildStorageFileName(file.name.replace(/\.[^.]+$/, ""))}.${extension}`;
  const bucket = supabase.storage.from("product-images");

  const uploadResult = await bucket.upload(path, file, {
    upsert: false,
    contentType: file.type
  });

  throwIfError(uploadResult, "Não foi possível enviar a imagem.");

  const publicUrlResult = bucket.getPublicUrl(path);
  return {
    path,
    publicUrl: publicUrlResult.data.publicUrl
  };
}

export async function uploadBannerImage(file, storeId) {
  const extension = file.name.split(".").pop() || "jpg";
  const path = `stores/${storeId}/banners/${buildStorageFileName(file.name.replace(/\.[^.]+$/, ""))}.${extension}`;
  const bucket = supabase.storage.from("product-images");

  const uploadResult = await bucket.upload(path, file, {
    upsert: false,
    contentType: file.type
  });

  throwIfError(uploadResult, "Não foi possível enviar a imagem do banner.");

  const publicUrlResult = bucket.getPublicUrl(path);
  return {
    path,
    publicUrl: publicUrlResult.data.publicUrl
  };
}

export async function createProductImageRecord(payload) {
  const result = await supabase.from("product_images").insert(payload).select("*").single();
  return throwIfError(result, "Não foi possível salvar o registro da imagem.");
}

export async function adminUpdateProductImage(id, payload) {
  const result = await supabase.from("product_images").update(payload).eq("id", id).select("*").single();
  return throwIfError(result, "Não foi possível atualizar a imagem do produto.");
}

export async function adminDeleteProductImage(id) {
  const result = await supabase.from("product_images").delete().eq("id", id);
  throwIfError(result, "Não foi possível excluir a imagem do produto.");
}

export async function adminListSections(storeId) {
  const result = await supabase
    .from("product_sections")
    .select(
      `
        *,
        section_products(
          id,
          product_id,
          sort_order,
          product:products(id,name,slug,price,is_active,is_archived)
        )
      `
    )
    .eq("store_id", storeId)
    .order("sort_order", { ascending: true })
    .order("sort_order", { foreignTable: "section_products", ascending: true });

  return throwIfError(result, "Não foi possível listar as seções.");
}

async function replaceSectionProducts(storeId, sectionId, productIds = []) {
  await supabase.from("section_products").delete().eq("section_id", sectionId);

  if (!productIds.length) return [];

  const payload = productIds.map((productId, index) => ({
    store_id: storeId,
    section_id: sectionId,
    product_id: productId,
    sort_order: index
  }));

  const result = await supabase.from("section_products").insert(payload).select("*");
  return throwIfError(result, "Não foi possível atualizar os produtos da seção.");
}

export async function adminSaveSection(payload) {
  const { selectedProductIds = [], refreshNow = false, ...sectionPayload } = payload;
  const mutation = sectionPayload.id
    ? supabase
        .from("product_sections")
        .update(sectionPayload)
        .eq("id", sectionPayload.id)
        .select("*")
        .single()
    : supabase.from("product_sections").insert(sectionPayload).select("*").single();

  const section = throwIfError(await mutation, "Não foi possível salvar a seção.");

  if (section.selection_mode === "manual") {
    await replaceSectionProducts(section.store_id, section.id, selectedProductIds);
  }

  if (section.selection_mode === "automatic" && refreshNow) {
    await adminRefreshAutomaticSection(section.id);
  }

  return section;
}

export async function adminRefreshAutomaticSection(sectionId) {
  const sectionRes = await supabase.from("product_sections").select("*").eq("id", sectionId).single();
  const section = throwIfError(sectionRes, "Seção não encontrada.");

  if (section.selection_mode !== "automatic") {
    return [];
  }

  let query = supabase
    .from("products")
    .select("id")
    .eq("store_id", section.store_id)
    .eq("is_archived", false)
    .eq("is_active", true);

  const params = section.automatic_params || {};
  const limit = Number(section.max_items || 12);

  switch (section.automatic_rule) {
    case "featured":
      query = query.eq("is_featured", true).order("sort_order", { ascending: true });
      break;
    case "promotion":
      query = query.eq("is_promotion", true).order("updated_at", { ascending: false });
      break;
    case "newest":
      query = query.order("created_at", { ascending: false });
      break;
    case "best_seller":
      query = query.eq("is_best_seller", true).order("interest_count", { ascending: false });
      break;
    case "low_stock":
      query = query.or("stock_status.eq.low_stock,stock_quantity.lte.3").order("stock_quantity", { ascending: true });
      break;
    case "category":
      if (params.category_id) query = query.eq("category_id", params.category_id);
      query = query.order("updated_at", { ascending: false });
      break;
    case "brand":
      if (params.brand_id) query = query.eq("brand_id", params.brand_id);
      query = query.order("updated_at", { ascending: false });
      break;
    case "custom_query":
      if (params.is_promotion) query = query.eq("is_promotion", true);
      if (params.is_featured) query = query.eq("is_featured", true);
      if (params.price_max) query = query.lte("price", Number(params.price_max));
      if (params.price_min) query = query.gte("price", Number(params.price_min));
      query = query.order("updated_at", { ascending: false });
      break;
    default:
      query = query.order("sort_order", { ascending: true });
      break;
  }

  const productsRes = await query.limit(limit);
  const products = throwIfError(productsRes, "Não foi possível atualizar a seção automática.");

  await replaceSectionProducts(
    section.store_id,
    section.id,
    products.map((product) => product.id)
  );

  await supabase
    .from("product_sections")
    .update({ last_refreshed_at: nowIso() })
    .eq("id", section.id);

  await adminCreateAuditLog({
    store_id: section.store_id,
    action: "section.refresh",
    entity_type: "product_sections",
    entity_id: section.id,
    metadata: {
      automatic_rule: section.automatic_rule,
      refreshed_items: products.length
    }
  }).catch(() => {});

  return products;
}

export async function getCurrentUserProfile() {
  const userRes = await supabase.auth.getUser();
  const user = throwIfError(userRes, "Sessão inválida.").user;
  if (!user) return null;

  const profileRes = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return throwIfError(profileRes, "Não foi possível carregar o perfil.");
}

export async function getMyStoreMemberships() {
  const userRes = await supabase.auth.getUser();
  const user = throwIfError(userRes, "Sessão inválida.").user;
  if (!user) return [];

  const membershipsRes = await supabase
    .from("store_members")
    .select(
      `
        id,
        role,
        created_at,
        store:stores(id,name,slug,slogan,description,logo_url,is_active)
      `
    )
    .eq("user_id", user.id);

  return throwIfError(membershipsRes, "Não foi possível carregar as lojas vinculadas.");
}

export async function adminListCategories(storeId) {
  const result = await supabase
    .from("categories")
    .select("*")
    .eq("store_id", storeId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  return throwIfError(result, "Não foi possível listar categorias.");
}

export async function adminSaveCategory(payload) {
  const mutation = payload.id
    ? supabase.from("categories").update(payload).eq("id", payload.id).select("*").single()
    : supabase.from("categories").insert(payload).select("*").single();

  return throwIfError(await mutation, "Não foi possível salvar a categoria.");
}

export async function adminDeleteCategory(id) {
  const result = await supabase.from("categories").delete().eq("id", id);
  throwIfError(result, "Não foi possível excluir a categoria.");
}

export async function adminListBrands(storeId) {
  const result = await supabase
    .from("brands")
    .select("*")
    .eq("store_id", storeId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  return throwIfError(result, "Não foi possível listar marcas.");
}

export async function adminSaveBrand(payload) {
  const mutation = payload.id
    ? supabase.from("brands").update(payload).eq("id", payload.id).select("*").single()
    : supabase.from("brands").insert(payload).select("*").single();

  return throwIfError(await mutation, "Não foi possível salvar a marca.");
}

export async function adminDeleteBrand(id) {
  const result = await supabase.from("brands").delete().eq("id", id);
  throwIfError(result, "Não foi possível excluir a marca.");
}

export async function adminSaveStoreSettings(payload) {
  const result = await supabase
    .from("store_settings")
    .upsert(payload, { onConflict: "store_id" })
    .select("*")
    .single();

  return throwIfError(result, "Não foi possível salvar as configurações da loja.");
}

export async function adminListBanners(storeId) {
  const result = await supabase
    .from("banners")
    .select("*")
    .eq("store_id", storeId)
    .order("sort_order", { ascending: true });

  return throwIfError(result, "Não foi possível listar os banners.");
}

export async function adminSaveBanner(payload) {
  const mutation = payload.id
    ? supabase.from("banners").update(payload).eq("id", payload.id).select("*").single()
    : supabase.from("banners").insert(payload).select("*").single();

  return throwIfError(await mutation, "Não foi possível salvar o banner.");
}

export async function adminDeleteBanner(id) {
  const result = await supabase.from("banners").delete().eq("id", id);
  throwIfError(result, "Não foi possível excluir o banner.");
}

export async function adminListNotifications(storeId) {
  const result = await supabase
    .from("notifications")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  return throwIfError(result, "Não foi possível listar notificações.");
}

export async function adminSaveNotification(payload) {
  const mutation = payload.id
    ? supabase.from("notifications").update(payload).eq("id", payload.id).select("*").single()
    : supabase.from("notifications").insert(payload).select("*").single();

  return throwIfError(await mutation, "Não foi possível salvar a notificação.");
}

export async function adminSendNotification(notificationId) {
  const result = await supabase.functions.invoke("send-push", {
    body: {
      notification_id: notificationId
    }
  });

  if (result.error) {
    throw new Error(await getFunctionErrorMessage(result.error, "Nao foi possivel enviar a notificacao."));
  }

  return result.data;
}

async function getFunctionErrorMessage(error, fallbackMessage) {
  const context = error?.context;

  if (context && typeof context.json === "function") {
    try {
      const payload = await context.json();
      return payload?.error || payload?.message || error.message || fallbackMessage;
    } catch {
      return error.message || fallbackMessage;
    }
  }

  return error?.message || fallbackMessage;
}

export async function adminListPushSubscriptionsSummary(storeId) {
  const result = await supabase
    .from("push_subscriptions")
    .select("id,is_active,created_at", { count: "exact" })
    .eq("store_id", storeId)
    .eq("is_active", true);

  throwIfError(result, "Não foi possível carregar o resumo de inscritos.");
  return {
    count: result.count || 0,
    data: result.data || []
  };
}

export async function adminCreateAuditLog(payload) {
  const result = await supabase.from("audit_logs").insert(payload).select("*").single();
  return throwIfError(result, "Não foi possível registrar auditoria.");
}
