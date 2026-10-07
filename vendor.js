/* Tribal Cruize — Vendor Dashboard
 *
 * Email/password auth, storefront profile editing, product CRUD with image
 * uploads, order history, and space status. Works in demo mode (localStorage)
 * and against Supabase when configured.
 */
(function () {
  "use strict";

  const { db, auth, upload, toast, money, esc, config: CFG } = window.TC;
  const $ = (id) => document.getElementById(id);

  let currentUser = null;
  let storefront = null;
  let products = [];
  let authMode = "signin";
  let logoUrl = "";
  let productImageUrl = "";

  /* =================================================================== auth */

  async function showGate() {
    $("signedOut").hidden = false;
    $("dash").hidden = true;
  }

  async function showDash() {
    $("signedOut").hidden = true;
    $("dash").hidden = false;
    await loadStorefront();
    renderAll();
  }

  async function submitAuth(mode) {
    authMode = mode;
    const email = $("dashEmail").value.trim();
    const password = $("dashPassword").value;
    const errBox = $("dashError");
    errBox.hidden = true;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      errBox.textContent = "Enter a valid email address.";
      errBox.hidden = false;
      return;
    }
    if (password.length < 6) {
      errBox.textContent = "Password must be at least 6 characters.";
      errBox.hidden = false;
      return;
    }
    try {
      const res =
        mode === "signin"
          ? await auth.signIn(email, password)
          : await auth.signUp(email, password);
      if (res.error) {
        errBox.textContent = res.error.message;
        errBox.hidden = false;
        return;
      }
      if (res.needsConfirm) {
        errBox.textContent = "Check your inbox to confirm your account, then sign in.";
        errBox.hidden = false;
        authMode = "signin";
        $("dashSignInBtn").textContent = "Sign in";
        $("dashSignUpBtn").textContent = "Create account";
        return;
      }
      currentUser = res.user;
      await showDash();
      toast(`Signed in as ${email}`, "ok");
    } catch (e) {
      errBox.textContent = e.message || "Sign in failed.";
      errBox.hidden = false;
    }
  }

  /* ============================================================= storefront */

  async function loadStorefront() {
    const { data } = await db.list("storefronts", { eq: { owner: currentUser.id } });
    storefront = data[0] || null;
    if (storefront) {
      const { data: prods } = await db.list("products", {
        eq: { storefrontId: storefront.id },
        order: "created_at",
        desc: true,
      });
      products = prods;
    } else {
      products = [];
    }
  }

  async function saveStorefront() {
    const name = $("storeName").value.trim();
    if (!name) {
      toast("Store name is required", "err");
      return;
    }
    const bio = $("storeBio").value.trim();
    const patch = { name, bio, logo: logoUrl };
    let error;
    if (storefront) {
      const res = await db.update("storefronts", patch, { id: storefront.id });
      error = res.error;
      if (!error && res.data) storefront = res.data;
    } else {
      const res = await db.insert("storefronts", Object.assign(patch, {
        owner: currentUser.id,
        tier: "basic",
        status: "pending",
      }));
      error = res.error;
      storefront = res.data;
    }
    if (error) {
      toast("Save failed: " + error.message, "err");
      return;
    }
    renderHeader();
    renderSpace();
    toast("Storefront saved", "ok");
  }

  /* =============================================================== products */

  function openProductForm(product) {
    $("productForm").hidden = false;
    $("productId").value = product ? product.id : "";
    $("productTitle").value = product ? product.title : "";
    $("productPrice").value = product ? (product.price / 100).toFixed(2) : "";
    $("productDesc").value = product ? product.description || "" : "";
    $("productActive").checked = product ? product.active !== false : true;
    productImageUrl = product ? product.image || "" : "";
    const preview = $("productPreview");
    preview.hidden = !productImageUrl;
    if (productImageUrl) preview.src = productImageUrl;
    $("productTitle").focus();
  }

  function closeProductForm() {
    $("productForm").hidden = true;
    $("productForm").reset();
    $("productPreview").hidden = true;
    productImageUrl = "";
  }

  async function saveProduct(e) {
    e.preventDefault();
    const id = $("productId").value;
    const title = $("productTitle").value.trim();
    const price = Math.round(parseFloat($("productPrice").value || "0") * 100);
    if (!title) return toast("Product title is required", "err");
    if (!(price >= 0)) return toast("Enter a valid price", "err");

    const payload = {
      title,
      price,
      description: $("productDesc").value.trim(),
      image: productImageUrl,
      active: $("productActive").checked,
    };

    let error;
    if (id) {
      ({ error } = await db.update("products", payload, { id }));
    } else {
      const res = await db.insert(
        "products",
        Object.assign(payload, { storefrontId: storefront.id })
      );
      error = res.error;
    }
    if (error) {
      toast("Could not save product: " + error.message, "err");
      return;
    }
    closeProductForm();
    await loadStorefront();
    renderProducts();
    toast("Product saved", "ok");
  }

  async function deleteProduct(id) {
    if (!confirm("Delete this product?")) return;
    const { error } = await db.remove("products", { id });
    if (error) return toast("Delete failed: " + error.message, "err");
    await loadStorefront();
    renderProducts();
    toast("Product deleted");
  }

  function renderProducts() {
    const list = $("productList");
    $("productsEmpty").hidden = products.length > 0;
    list.innerHTML = products
      .map(
        (p) =>
          `<div class="product-row">` +
          (p.image
            ? `<img src="${p.image}" alt="" />`
            : `<div style="width:58px;height:58px;border-radius:8px;background:var(--panel)"></div>`) +
          `<div><div class="pr-title">${esc(p.title)}</div>` +
          `<div class="pr-meta">${p.active === false ? "Draft · " : ""}${esc((p.description || "").slice(0, 70))}</div></div>` +
          `<div class="pr-price">${money(p.price)}</div>` +
          `<div class="pr-actions">` +
          `<button class="btn btn-sm" data-edit="${p.id}">Edit</button>` +
          `<button class="btn btn-sm btn-danger" data-del="${p.id}">Delete</button>` +
          `</div></div>`
      )
      .join("");
    list.querySelectorAll("[data-edit]").forEach((b) =>
      b.addEventListener("click", () => {
        const p = products.find((x) => x.id === b.dataset.edit);
        if (p) {
          openProductForm(p);
          $("panel-products").scrollIntoView({ behavior: "smooth", block: "start" });
        }
      })
    );
    list.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", () => deleteProduct(b.dataset.del))
    );
  }

  /* ================================================================= orders */

  async function renderOrders() {
    const box = $("ordersList");
    if (!storefront) {
      $("ordersEmpty").hidden = false;
      box.innerHTML = "";
      return;
    }
    const { data: orders } = await db.list("orders", {
      eq: { storefrontId: storefront.id },
      order: "created_at",
      desc: true,
    });
    $("ordersEmpty").hidden = orders.length > 0;
    box.innerHTML = orders
      .map((o) => {
        const pending = o.status === "pending_payment";
        const method = o.payment_method
          ? (((CFG.payments.methods || []).find((m) => m.id === o.payment_method) || {}).label || o.payment_method)
          : "";
        return (
          `<div class="order-row">` +
          `<div><div>${esc(o.title || (o.kind === "space" ? "Space purchase" : "Order"))}</div>` +
          `<div class="o-meta">${esc(o.buyer_email || "")}` +
          (o.reference ? ` · ref <strong class="order-ref">${esc(o.reference)}</strong>` : "") +
          (method ? ` · ${esc(method)}` : "") +
          ` · ${new Date(o.created_at || Date.now()).toLocaleDateString()}</div></div>` +
          `<div class="o-amount">${money(o.amount)}</div>` +
          (pending
            ? `<button class="btn btn-sm btn-primary" data-mark="${o.id}">Mark paid</button>`
            : `<span class="badge ${o.status === "paid" ? "badge-ok" : "badge-muted"}">${esc(o.status || "pending")}</span>`) +
          `</div>`
        );
      })
      .join("");
    box.querySelectorAll("[data-mark]").forEach((b) =>
      b.addEventListener("click", () => markPaid(b.dataset.mark))
    );
  }

  async function markPaid(id) {
    const { error } = await db.update("orders", { status: "paid" }, { id });
    if (error) return toast("Could not update order: " + error.message, "err");
    toast("Order marked as paid", "ok");
    renderOrders();
  }

  /* ================================================================== space */

  function renderSpace() {
    const box = $("spaceInfo");
    if (!storefront) {
      box.innerHTML = `<div><strong>No space purchased yet.</strong></div><div>Buy a space to go live in the marketplace.</div>`;
      return;
    }
    const active = storefront.status === "active";
    box.innerHTML =
      `<div>Tier: <strong>${esc(storefront.tier || "basic")}</strong></div>` +
      `<div>Status: <strong style="color:${active ? "var(--ok)" : "var(--accent)"}">${esc(storefront.status || "pending")}</strong></div>` +
      `<div>${active ? "Your storefront is live in the shop." : "Your storefront is hidden from the shop until the space is paid for."}</div>`;
  }

  /* ================================================================ header */

  function renderHeader() {
    if (!storefront) {
      $("storeTitle").textContent = "Set up your storefront";
      $("storeBadges").innerHTML = `<span class="badge badge-muted">no space</span>`;
      $("viewStoreLink").hidden = true;
      $("noSpaceHint").hidden = false;
      $("storeName").value = "";
      $("storeBio").value = "";
      logoUrl = "";
      $("logoPreview").hidden = true;
      return;
    }
    $("storeTitle").textContent = storefront.name || "My Storefront";
    const active = storefront.status === "active";
    $("storeBadges").innerHTML =
      `<span class="badge ${active ? "badge-ok" : ""}">${active ? "live" : esc(storefront.status || "pending")}</span>` +
      `<span class="badge badge-muted">${esc(storefront.tier || "basic")} space</span>`;
    $("viewStoreLink").hidden = !active;
    if (active) $("viewStoreLink").href = `shop.html?store=${encodeURIComponent(storefront.id)}`;
    $("noSpaceHint").hidden = true;
    $("storeName").value = storefront.name || "";
    $("storeBio").value = storefront.bio || "";
    logoUrl = storefront.logo || "";
    $("logoPreview").hidden = !logoUrl;
    if (logoUrl) $("logoPreview").src = logoUrl;
  }

  function renderAll() {
    renderHeader();
    renderProducts();
    renderOrders();
    renderSpace();
  }

  /* ================================================================== tabs */

  function wireTabs() {
    $("tabs").querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        $("tabs").querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        ["storefront", "products", "orders", "space"].forEach((name) => {
          $("panel-" + name).hidden = name !== tab.dataset.tab;
        });
        if (tab.dataset.tab === "orders") renderOrders();
      });
    });
  }

  /* ================================================================== wire */

  function wire() {
    $("dashSignInBtn").addEventListener("click", () => submitAuth("signin"));
    $("dashSignUpBtn").addEventListener("click", () => submitAuth("signup"));
    $("dashPassword").addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitAuth(authMode);
    });
    $("dashSignOutBtn").addEventListener("click", async () => {
      await auth.signOut();
      currentUser = null;
      storefront = null;
      showGate();
      toast("Signed out");
    });

    $("saveStoreBtn").addEventListener("click", saveStorefront);

    $("logoInput").addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const path = `logos/${(currentUser && currentUser.id) || "anon"}_${Date.now()}_${file.name}`;
      const { url, error } = await upload("product-images", path, file);
      if (error) return toast("Upload failed: " + error.message, "err");
      logoUrl = url;
      $("logoPreview").src = url;
      $("logoPreview").hidden = false;
      toast("Logo uploaded", "ok");
      e.target.value = "";
    });

    $("newProductBtn").addEventListener("click", () => {
      if (!storefront) {
        toast("Save your storefront details first", "err");
        return;
      }
      openProductForm(null);
    });
    $("cancelProductBtn").addEventListener("click", closeProductForm);
    $("productForm").addEventListener("submit", saveProduct);

    $("productImage").addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const path = `products/${(storefront && storefront.id) || "draft"}/${Date.now()}_${file.name}`;
      const { url, error } = await upload("product-images", path, file);
      if (error) return toast("Upload failed: " + error.message, "err");
      productImageUrl = url;
      $("productPreview").src = url;
      $("productPreview").hidden = false;
      toast("Image uploaded", "ok");
      e.target.value = "";
    });

    wireTabs();
  }

  async function init() {
    wire();
    const { user } = await auth.getUser();
    if (user) {
      currentUser = user;
      await showDash();
    } else {
      showGate();
    }
  }

  init();
})();
