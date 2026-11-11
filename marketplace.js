/* Home page discovery: real active marketplace content, not hard-coded sample listings. */
(function () {
  "use strict";
  const TC = window.TC;
  if (!TC) return;
  const $ = (id) => document.getElementById(id);
  const esc = TC.esc;
  const fallback = (name) => `<div class="product-placeholder" aria-hidden="true">${esc((name || "TC").slice(0, 2).toUpperCase())}</div>`;

  async function renderStalls() {
    const root = $("featuredStalls");
    if (!root) return;
    try {
      const { data, error } = await TC.db.list("storefronts", { eq: { status: "active" }, order: "created_at", desc: true, limit: 3 });
      if (error) throw error;
      if (!data.length) {
        root.innerHTML = '<div class="market-empty">The market is getting ready for its first stalls. <a href="spaces.html">Open a stall and be among the first.</a></div>';
        return;
      }
      root.innerHTML = data.slice(0, 3).map((store) => {
        const initial = esc((store.name || "TC").slice(0, 2).toUpperCase());
        const avatar = store.logo
          ? `<img class="stall-avatar" src="${esc(store.logo)}" alt="${esc(store.name || "Stall")} logo" loading="lazy" />`
          : `<div class="stall-avatar stall-avatar-fallback" aria-hidden="true">${initial}</div>`;
        return `<article class="market-card">${avatar}<span class="mini-badge">${esc(store.tier || "Community")} stall</span><h3>${esc(store.name || "Local stall")}</h3><p>${esc(store.bio || "Discover something made and shared by our local community.")}</p><a class="text-link" href="shop.html?store=${encodeURIComponent(store.id)}">Visit this stall <span aria-hidden="true">↗</span></a></article>`;
      }).join("");
    } catch (error) {
      root.innerHTML = '<div class="market-empty">Stalls could not load right now. <a href="shop.html">Visit the market directory.</a></div>';
      console.error("Could not load featured stalls", error);
    }
  }

  async function renderProducts() {
    const root = $("featuredProducts");
    if (!root) return;
    try {
      const [{ data: products, error: productError }, { data: stores, error: storeError }] = await Promise.all([
        TC.db.list("products", { eq: { active: true }, order: "created_at", desc: true, limit: 6 }),
        TC.db.list("storefronts", { eq: { status: "active" } }),
      ]);
      if (productError) throw productError;
      if (storeError) throw storeError;
      const storeById = new Map(stores.map((store) => [String(store.id), store]));
      const visible = products.filter((product) => storeById.has(String(product.storefrontId))).slice(0, 3);
      if (!visible.length) {
        root.innerHTML = '<div class="market-empty">New finds will show up here as local stalls add products. <a href="shop.html">Browse the market.</a></div>';
        return;
      }
      root.innerHTML = visible.map((product) => {
        const store = storeById.get(String(product.storefrontId));
        const art = product.image
          ? `<img src="${esc(product.image)}" alt="${esc(product.title || "Market product")}" loading="lazy" />`
          : fallback(product.title);
        return `<article class="product-tile">${art}<div class="product-copy"><span class="micro-label">${esc(product.category || "From the market")}</span><h3>${esc(product.title || "Market find")}</h3><p>${esc((product.description || "A new find from a local Tribal Cruize stall.").slice(0, 95))}</p><div class="product-price">${TC.money(product.price)}</div><div class="product-store">From ${esc(store.name || "a local stall")}</div></div></article>`;
      }).join("");
    } catch (error) {
      root.innerHTML = '<div class="market-empty">Products could not load right now. <a href="shop.html">Browse the market.</a></div>';
      console.error("Could not load featured products", error);
    }
  }

  renderStalls();
  renderProducts();
})();
