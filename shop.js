/* Tribal Cruize — Shop
 *
 * Storefront directory, product browsing, cart (localStorage), and checkout by
 * local settlement (bank transfer / Digicel MyCash / cash on delivery): orders
 * are created as `pending_payment` with a generated reference and the shopper
 * gets payment instructions; vendors confirm in their dashboard.
 */
(function () {
  "use strict";

  const { db, toast, money, esc, qs, lsGet, lsSet, config: CFG } = window.TC;
  const $ = (id) => document.getElementById(id);

  /* ================================================================ seeding */

  function placeholder(label, color) {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">` +
      `<rect width="600" height="600" fill="${color}"/>` +
      `<text x="300" y="315" font-family="Arial, sans-serif" font-size="44" font-weight="bold" fill="#14100c" text-anchor="middle">${label}</text>` +
      `</svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  async function seedDemoData() {
    if (!window.TC.demo) return;
    const existing = await db.list("storefronts");
    if (existing.data.length) return;

    const stores = [
      { id: "store_mumu", owner: "demo_brand", name: "Mumu Streetwear", bio: "Loud prints and heavier cotton. Port Moresby's own.", tier: "featured", logo: placeholder("MUMU", "#ff6b35") },
      { id: "store_koki", owner: "demo_brand", name: "Koki Customs", bio: "Hand-finished caps, tees and tote bags.", tier: "basic", logo: placeholder("KOKI", "#c9a227") },
      { id: "store_hanua", owner: "demo_brand", name: "Hanuabada Goods", bio: "Tribal patterns translated into everyday wear.", tier: "premium", logo: placeholder("HANUA", "#7dd87d") },
    ];
    for (const s of stores) {
      await db.insert("storefronts", Object.assign({ status: "active" }, s));
    }

    const products = [
      { storefrontId: "store_mumu", title: "Cruise Crest Tee", price: 4500, description: "Heavyweight tee with the signature tribal crest, screen printed.", image: placeholder("TEE", "#efe7d9") },
      { storefrontId: "store_mumu", title: "Night Ride Hoodie", price: 8900, description: "Oversized hoodie for late cruises. Brushed fleece inside.", image: placeholder("HOODIE", "#2b3a55") },
      { storefrontId: "store_koki", title: "Custom 5-Panel Cap", price: 3500, description: "Five-panel cap with embroidered wave brim.", image: placeholder("CAP", "#c9a227") },
      { storefrontId: "store_koki", title: "Market Tote", price: 2800, description: "Canvas tote built for the market run.", image: placeholder("TOTE", "#e8dcc8") },
      { storefrontId: "store_hanua", title: "Mandala Panel Shirt", price: 6500, description: "Geometric panel shirt woven from a family pattern.", image: placeholder("SHIRT", "#7dd87d") },
      { storefrontId: "store_hanua", title: "Totem Bomber", price: 12000, description: "Bomber jacket with totem sleeve print.", image: placeholder("BOMBER", "#8a3d5b") },
    ];
    for (const p of products) {
      await db.insert("products", Object.assign({ active: true, created_at: new Date().toISOString() }, p));
    }
  }

  /* =================================================================== state */

  const cart = lsGet("cart", []);

  function cartCount() {
    return cart.reduce((n, i) => n + i.qty, 0);
  }
  function cartTotal() {
    return cart.reduce((n, i) => n + i.price * i.qty, 0);
  }
  function saveCart() {
    lsSet("cart", cart);
    renderCart();
  }

  /* =============================================================== directory */

  async function renderDirectory(filter) {
    const grid = $("storeGrid");
    const { data: stores, error } = await db.list("storefronts", { eq: { status: "active" }, order: "created_at", desc: true });
    if (error) {
      toast("Could not load storefronts: " + error.message, "err");
      return;
    }
    const q = (filter || "").toLowerCase();
    const visible = stores.filter(
      (s) => !q || (s.name || "").toLowerCase().includes(q) || (s.bio || "").toLowerCase().includes(q)
    );
    $("storeEmpty").hidden = visible.length > 0;
    grid.innerHTML = visible
      .map(
        (s) =>
          `<article class="card store-card" data-store="${s.id}">` +
          `<img src="${s.logo || placeholder((s.name || "TC").slice(0, 6).toUpperCase(), "#ff6b35")}" alt="${esc(s.name)} logo" />` +
          `<h3>${esc(s.name)}</h3>` +
          `<p>${esc(s.bio || "")}</p>` +
          `<span class="badge ${s.tier === "premium" ? "" : "badge-muted"}">${esc(s.tier || "basic")} space</span>` +
          `</article>`
      )
      .join("");
    grid.querySelectorAll("[data-store]").forEach((card) => {
      card.addEventListener("click", () => {
        location.href = `shop.html?store=${encodeURIComponent(card.dataset.store)}`;
      });
    });
  }

  /* ============================================================= storefront */

  async function renderStorefront(storeId) {
    const { data: stores } = await db.list("storefronts", { eq: { id: storeId } });
    const store = stores[0];
    if (!store) {
      $("storeView").innerHTML = `<div class="empty-state">Storefront not found. <a href="shop.html" style="color:var(--accent)">Back to the shop</a>.</div>`;
      return;
    }
    document.title = `${store.name} | Tribal Cruize Shop`;
    $("storeBanner").innerHTML =
      `<img src="${store.logo || placeholder((store.name || "TC").slice(0, 6).toUpperCase(), "#ff6b35")}" alt="${esc(store.name)}" />` +
      `<div class="banner-text"><span class="badge">${esc(store.tier || "basic")} space</span>` +
      `<h2>${esc(store.name)}</h2><p>${esc(store.bio || "")}</p></div>` +
      `<a class="btn btn-sm" href="shop.html">← All storefronts</a>`;

    const { data: products } = await db.list("products", {
      eq: { storefrontId: storeId, active: true },
      order: "created_at",
      desc: true,
    });
    $("productEmpty").hidden = products.length > 0;
    $("productGrid").innerHTML = products
      .map(
        (p) =>
          `<article class="card product-card" data-product="${p.id}">` +
          `<img src="${p.image || placeholder("ITEM", "#efe7d9")}" alt="${esc(p.title)}" />` +
          `<span class="p-title">${esc(p.title)}</span>` +
          `<span class="p-price">${money(p.price)}</span>` +
          `<span class="p-store">${esc(store.name)}</span>` +
          `</article>`
      )
      .join("");

    $("productGrid").querySelectorAll("[data-product]").forEach((card) => {
      card.addEventListener("click", () => {
        const p = products.find((x) => x.id === card.dataset.product);
        if (p) openProduct(p, store);
      });
    });
  }

  /* ============================================================ product modal */

  let modalProduct = null;
  let modalStore = null;

  function openProduct(p, store) {
    modalProduct = p;
    modalStore = store;
    $("productModalBody").innerHTML =
      `<img src="${p.image || placeholder("ITEM", "#efe7d9")}" alt="${esc(p.title)}" />` +
      `<span class="p-store muted small">${esc(store.name)}</span>` +
      `<h3>${esc(p.title)}</h3>` +
      `<div class="p-price">${money(p.price)}</div>` +
      `<p class="p-desc">${esc(p.description || "No description yet.")}</p>`;
    $("productModal").classList.add("open");
  }

  function closeProduct() {
    $("productModal").classList.remove("open");
    modalProduct = null;
  }

  /* ==================================================================== cart */

  function addToCart(p, store) {
    const found = cart.find((i) => i.productId === p.id);
    if (found) {
      found.qty += 1;
    } else {
      cart.push({
        productId: p.id,
        storefrontId: store.id,
        title: p.title,
        price: p.price,
        image: p.image || placeholder("ITEM", "#efe7d9"),
        storeName: store.name,
        qty: 1,
      });
    }
    saveCart();
    toast(`Added "${p.title}" to cart`, "ok");
  }

  function renderCart() {
    $("cartCount").textContent = cartCount();
    $("cartTotal").textContent = money(cartTotal());
    const box = $("cartItems");
    if (!cart.length) {
      box.innerHTML = `<div class="cart-empty">Your cart is empty.</div>`;
    } else {
      box.innerHTML = cart
        .map(
          (i, idx) =>
            `<div class="cart-item">` +
            `<img src="${i.image}" alt="" />` +
            `<div><div class="ci-title">${esc(i.title)}</div>` +
            `<div class="ci-store">${esc(i.storeName)}</div>` +
            `<div class="qty-row">` +
            `<button data-dec="${idx}" aria-label="Decrease quantity">−</button>` +
            `<span>${i.qty}</span>` +
            `<button data-inc="${idx}" aria-label="Increase quantity">+</button>` +
            `<button class="remove-btn" data-rm="${idx}" aria-label="Remove">✕</button>` +
            `</div></div>` +
            `<div class="ci-right">${money(i.price * i.qty)}</div>` +
            `</div>`
        )
        .join("");
      box.querySelectorAll("[data-inc]").forEach((b) =>
        b.addEventListener("click", () => { cart[b.dataset.inc].qty += 1; saveCart(); })
      );
      box.querySelectorAll("[data-dec]").forEach((b) =>
        b.addEventListener("click", () => {
          const item = cart[b.dataset.dec];
          item.qty -= 1;
          if (item.qty <= 0) cart.splice(Number(b.dataset.dec), 1);
          saveCart();
        })
      );
      box.querySelectorAll("[data-rm]").forEach((b) =>
        b.addEventListener("click", () => { cart.splice(Number(b.dataset.rm), 1); saveCart(); })
      );
    }
    $("checkoutBtn").disabled = !cart.length;
    $("checkoutNote").textContent =
      "Pay by bank transfer, Digicel MyCash or cash on delivery — no card needed.";
  }

  /* =============================================================== checkout */

  let settleRef = "";
  let settleMethod = (CFG.payments.methods[0] || { id: "bank" }).id;

  function instructionsFor(methodId, ref) {
    const p = CFG.payments || {};
    const lines = [];
    if (methodId === "bank") {
      const b = p.bank || {};
      lines.push(["Bank", b.name || ""]);
      lines.push(["Account name", b.accountName || ""]);
      lines.push(["Account number", b.accountNumber || ""]);
      lines.push(["Branch", b.branch || ""]);
      lines.push(["Reference", ref]);
    } else if (methodId === "mycash") {
      const m = p.mycash || {};
      lines.push(["MyCash name", m.name || ""]);
      lines.push(["MyCash number", m.number || ""]);
      lines.push(["Reference", ref]);
    } else if (methodId === "cod") {
      lines.push(["Pay", "cash when your order arrives"]);
      lines.push(["Keep ready", ref]);
    }
    return lines;
  }

  function renderInstructions() {
    const lines = instructionsFor(settleMethod, settleRef);
    const note =
      settleMethod === "cod"
        ? (CFG.payments.referenceNote || "")
        : CFG.payments.referenceNote || "";
    $("payInstructions").innerHTML =
      lines
        .map(
          ([k, v]) =>
            `<div class="pay-line"><span>${window.TC.esc(k)}</span><strong>${window.TC.esc(v)}</strong></div>`
        )
        .join("") +
      (note ? `<div class="small">${window.TC.esc(note)}</div>` : "");
  }

  function renderMethods() {
    const methods = (CFG.payments && CFG.payments.methods) || [];
    $("methodList").innerHTML = methods
      .map(
        (m) =>
          `<label class="method-option ${m.id === settleMethod ? "active" : ""}" data-method="${m.id}">` +
          `<input type="radio" name="payMethod" value="${m.id}" ${m.id === settleMethod ? "checked" : ""} />` +
          `<span>${window.TC.esc(m.label)}</span></label>`
      )
      .join("");
    $("methodList").querySelectorAll("[data-method]").forEach((el) => {
      el.addEventListener("click", () => {
        settleMethod = el.dataset.method;
        renderMethods();
        renderInstructions();
      });
    });
  }

  function openSettlement() {
    settleRef = window.TC.reference();
    $("settleRef").textContent = settleRef;
    $("settleTotal").textContent = money(cartTotal());
    renderMethods();
    renderInstructions();
    $("settleModal").classList.add("open");
  }

  function checkout() {
    const email = ($("checkoutEmail").value || "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast("Enter a valid email for your order", "err");
      $("checkoutEmail").focus();
      return;
    }
    if (!cart.length) return;
    openSettlement();
  }

  async function placeOrder() {
    const email = ($("checkoutEmail").value || "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast("Enter a valid email for your order", "err");
      $("settleModal").classList.remove("open");
      $("checkoutEmail").focus();
      return;
    }
    const btn = $("placeOrderBtn");
    btn.disabled = true;
    try {
      for (const i of cart) {
        const { error } = await db.insert("orders", {
          buyer_email: email,
          storefrontId: i.storefrontId,
          productId: i.productId,
          title: i.title,
          kind: "product",
          qty: i.qty,
          amount: i.price * i.qty,
          currency: "PGK",
          status: "pending_payment",
          reference: settleRef,
          payment_method: settleMethod,
        });
        if (error) throw new Error(error.message);
      }
      const methodLabel =
        ((CFG.payments.methods || []).find((m) => m.id === settleMethod) || {}).label || settleMethod;
      $("settleModal").classList.remove("open");
      cart.splice(0, cart.length);
      saveCart();
      $("cartDrawer").classList.remove("open");
      const lines = instructionsFor(settleMethod, settleRef)
        .map(([k, v]) => `<div class="pay-line"><span>${window.TC.esc(k)}</span><strong>${window.TC.esc(v)}</strong></div>`)
        .join("");
      $("successBanner").innerHTML =
        `<strong>Order placed — reference <span class="order-ref">${settleRef}</span></strong>` +
        `<div class="small" style="margin-top:0.3rem">Pay by ${window.TC.esc(methodLabel.toLowerCase())} using the details below. ` +
        `The vendor confirms your payment and your order moves to paid.</div>` +
        `<div class="pay-instructions" style="margin-top:0.7rem;margin-bottom:0">${lines}</div>`;
      $("successBanner").hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast("Order placed", "ok");
    } catch (err) {
      toast("Could not place order: " + err.message, "err");
    } finally {
      btn.disabled = false;
    }
  }

  /* ==================================================================== init */

  function wire() {
    $("cartBtn").addEventListener("click", () => $("cartDrawer").classList.add("open"));
    $("closeCartBtn").addEventListener("click", () => $("cartDrawer").classList.remove("open"));
    $("checkoutBtn").addEventListener("click", checkout);
    $("closeProductBtn").addEventListener("click", closeProduct);
    $("productModal").addEventListener("click", (e) => {
      if (e.target === $("productModal")) closeProduct();
    });
    $("addToCartBtn").addEventListener("click", () => {
      if (modalProduct && modalStore) {
        addToCart(modalProduct, modalStore);
        closeProduct();
        $("cartDrawer").classList.add("open");
      }
    });
    $("cancelSettleBtn").addEventListener("click", () =>
      $("settleModal").classList.remove("open")
    );
    $("placeOrderBtn").addEventListener("click", placeOrder);
    $("settleModal").addEventListener("click", (e) => {
      if (e.target === $("settleModal")) $("settleModal").classList.remove("open");
    });
    $("storeSearch").addEventListener("input", (e) => renderDirectory(e.target.value));
  }

  async function init() {
    wire();
    renderCart();

    await seedDemoData();

    const storeId = qs("store");
    if (storeId) {
      $("directoryView").hidden = true;
      $("storeView").hidden = false;
      await renderStorefront(storeId);
    } else {
      await renderDirectory("");
    }
  }

  init();
})();
