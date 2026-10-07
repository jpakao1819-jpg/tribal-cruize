/* Tribal Cruize — Sell With Us
 *
 * Purchase flow for company storefront spaces (Papua New Guinea):
 *  - auth gate (Supabase email/password, simulated in demo mode)
 *  - local settlement: bank transfer / Digicel MyCash / cash on delivery with
 *    a generated payment reference; the storefront stays `pending_payment`
 *    until you confirm the payment (Supabase table editor or dashboard).
 *  - demo mode activates the storefront locally so the flow stays testable.
 */
(function () {
  "use strict";

  const { db, auth, toast, money, esc, qs, config: CFG } = window.TC;
  const $ = (id) => document.getElementById(id);

  let currentUser = null;
  let authMode = "signin";
  let pendingTier = null;

  /* ================================================================== tiers */

  function intervalLabel(tier) {
    return tier.interval === "once" ? "one-time payment" : "/ month";
  }

  function renderTiers() {
    const tiers = CFG.spaceTiers || [];
    $("tierGrid").innerHTML = tiers
      .map(
        (t, i) =>
          `<article class="card tier-card ${i === 1 ? "popular" : ""}">` +
          `<p class="tier-name">${esc(t.name)}</p>` +
          `<div class="tier-price">${money(t.price)} <small>${intervalLabel(t)}</small></div>` +
          `<ul class="tier-features">${(t.features || [])
            .map((f) => `<li>${esc(f)}</li>`)
            .join("")}</ul>` +
          `<button class="btn ${i === 1 ? "btn-primary" : ""}" data-tier="${t.id}">Get ${esc(t.name)}</button>` +
          `</article>`
      )
      .join("");
    $("tierGrid").querySelectorAll("[data-tier]").forEach((btn) =>
      btn.addEventListener("click", () => startPurchase(btn.dataset.tier))
    );
    const once = tiers.some((t) => t.interval === "once");
    $("billingNote").textContent = once
      ? "One-time and monthly options — the price shown is what you pay."
      : "Billed monthly. Cancel any time from your dashboard.";
  }

  /* ============================================================ account box */

  async function refreshAccount() {
    const { user } = await auth.getUser();
    currentUser = user || null;
    $("accountBtn").textContent = currentUser ? "Sign out" : "Account";
    await renderMySpace();
  }

  async function renderMySpace() {
    const box = $("mySpace");
    if (!currentUser) {
      box.hidden = true;
      return;
    }
    const { data } = await db.list("storefronts", { eq: { owner: currentUser.id } });
    const store = data[0];
    if (!store) {
      box.hidden = false;
      box.innerHTML =
        `<div class="space-info"><h3>No space yet</h3>` +
        `<p>Signed in as ${esc(currentUser.email)} — pick a tier below to open your storefront.</p></div>` +
        `<a class="btn btn-sm" href="vendor.html">Open dashboard</a>`;
      return;
    }
    const active = store.status === "active";
    const pending = store.status === "pending_payment";
    box.hidden = false;
    box.innerHTML =
      `<div class="space-info"><h3>${esc(store.name || "Your storefront")} · ${esc(store.tier || "basic")} space</h3>` +
      `<p>Status: <strong style="color:${active ? "var(--ok)" : "var(--accent)"}">${esc(store.status || "pending")}</strong>` +
      (active
        ? ""
        : pending
        ? " — waiting for payment confirmation"
        : " — pick a tier to go live") + `</p></div>` +
      `<a class="btn btn-sm ${active ? "btn-primary" : ""}" href="vendor.html">Open dashboard</a>`;
  }

  /* =============================================================== auth flow */

  function setAuthMode(mode) {
    authMode = mode;
    $("authTitle").textContent = mode === "signin" ? "Sign in to continue" : "Create your account";
    $("submitAuthBtn").textContent = mode === "signin" ? "Sign in" : "Sign up";
    $("switchAuthBtn").textContent =
      mode === "signin" ? "Create an account" : "I already have an account";
    $("authError").hidden = true;
  }

  function openAuth() {
    setAuthMode("signin");
    $("authModal").classList.add("open");
  }

  async function submitAuth() {
    const email = $("authEmail").value.trim();
    const password = $("authPassword").value;
    const errBox = $("authError");
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
    const btn = $("submitAuthBtn");
    btn.disabled = true;
    try {
      const res =
        authMode === "signin"
          ? await auth.signIn(email, password)
          : await auth.signUp(email, password);
      if (res.error) {
        errBox.textContent = res.error.message;
        errBox.hidden = false;
        return;
      }
      if (res.needsConfirm) {
        errBox.textContent = "Check your email to confirm your account, then sign in.";
        errBox.hidden = false;
        setAuthMode("signin");
        return;
      }
      $("authModal").classList.remove("open");
      currentUser = res.user;
      await refreshAccount();
      toast(`Signed in as ${email}`, "ok");
      if (pendingTier) {
        const tier = pendingTier;
        pendingTier = null;
        startPurchase(tier);
      }
    } finally {
      btn.disabled = false;
    }
  }

  /* ========================================================= purchase flow */

  async function startPurchase(tierId) {
    const tier = (CFG.spaceTiers || []).find((t) => t.id === tierId);
    if (!tier) return;

    if (!currentUser) {
      pendingTier = tierId;
      openAuth();
      return;
    }

    if (!CFG.supabaseUrl) {
      // Demo mode: activate locally.
      const { data: existing } = await db.list("storefronts", { eq: { owner: currentUser.id } });
      if (existing.length) {
        await db.update("storefronts", { tier: tier.id, status: "active" }, { id: existing[0].id });
      } else {
        await db.insert("storefronts", {
          owner: currentUser.id,
          name: currentUser.email.split("@")[0] + "'s store",
          bio: "",
          logo: "",
          tier: tier.id,
          status: "active",
        });
      }
      await db.insert("orders", {
        buyer_email: currentUser.email,
        amount: tier.price,
        kind: "space",
        tier: tier.id,
        status: "paid",
        currency: "USD",
        stripe_session: "demo_" + Date.now(),
      });
      await renderMySpace();
      $("successBanner").hidden = false;
      window.scrollTo({ top: document.body.scrollHeight / 2, behavior: "smooth" });
      toast("Demo space activated — open your dashboard", "ok");
      return;
    }

    // Live mode: local settlement — create/attach a pending storefront and
    // order, then show the payment instructions (no foreign gateway needed).
    const session = await window.TC.sb.auth.getSession();
    const user = session.data.session.user;
    const email = user.email || "";

    const { data: existing } = await db.list("storefronts", { eq: { owner: user.id } });
    let storeId;
    if (existing.length) {
      await db.update("storefronts", { tier: tier.id, status: "pending_payment" }, { id: existing[0].id });
      storeId = existing[0].id;
    } else {
      const res = await db.insert("storefronts", {
        owner: user.id,
        name: (email.split("@")[0] || "My") + "'s store",
        bio: "",
        logo: "",
        tier: tier.id,
        status: "pending_payment",
      });
      storeId = res.data && res.data.id;
    }

    const ref = window.TC.reference();
    const { error: orderErr } = await db.insert("orders", {
      buyer_email: email,
      storefrontId: storeId,
      kind: "space",
      tier: tier.id,
      amount: tier.price,
      currency: "PGK",
      status: "pending_payment",
      reference: ref,
      payment_method: "",
    });
    if (orderErr) {
      toast("Could not record the order: " + orderErr.message, "err");
      return;
    }
    openSpaceSettlement(tier, ref, email);
    await renderMySpace();
  }

  /* ------------------------------------------------ settlement instructions */

  let spaceSettle = { tier: null, ref: "", method: "bank" };

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
      lines.push(["Pay", "cash when arranged with the Tribal Cruize team"]);
      lines.push(["Keep ready", ref]);
    }
    return lines;
  }

  function renderSpaceMethods() {
    const methods = (CFG.payments && CFG.payments.methods) || [];
    $("spaceMethodList").innerHTML = methods
      .map(
        (m) =>
          `<label class="method-option ${m.id === spaceSettle.method ? "active" : ""}" data-method="${m.id}">` +
          `<input type="radio" name="spaceMethod" value="${m.id}" ${m.id === spaceSettle.method ? "checked" : ""} />` +
          `<span>${esc(m.label)}</span></label>`
      )
      .join("");
    $("spaceMethodList").querySelectorAll("[data-method]").forEach((el) => {
      el.addEventListener("click", () => {
        spaceSettle.method = el.dataset.method;
        renderSpaceMethods();
        renderSpaceInstructions();
      });
    });
  }

  function renderSpaceInstructions() {
    const lines = instructionsFor(spaceSettle.method, spaceSettle.ref);
    $("spaceInstructions").innerHTML =
      lines
        .map(
          ([k, v]) =>
            `<div class="pay-line"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`
        )
        .join("") +
      (CFG.payments.referenceNote
        ? `<div class="small">${esc(CFG.payments.referenceNote)}</div>`
        : "");
  }

  function openSpaceSettlement(tier, ref) {
    spaceSettle = { tier, ref, method: "bank" };
    $("spaceRef").textContent = ref;
    $("spaceTotal").textContent = money(tier.price);
    renderSpaceMethods();
    renderSpaceInstructions();
    $("spaceSettleModal").classList.add("open");
  }

  async function confirmSpaceOrder() {
    if (!spaceSettle.tier || !spaceSettle.ref) return;
    const btn = $("confirmSpaceBtn");
    btn.disabled = true;
    try {
      // Record the chosen method on the order row we already created.
      const { data: mine } = await db.list("orders", {
        eq: { reference: spaceSettle.ref, status: "pending_payment" },
      });
      if (mine[0]) {
        await db.update("orders", { payment_method: spaceSettle.method }, { id: mine[0].id });
      }
      $("spaceSettleModal").classList.remove("open");
      const lines = instructionsFor(spaceSettle.method, spaceSettle.ref)
        .map(([k, v]) => `<div class="pay-line"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`)
        .join("");
      $("successBanner").innerHTML =
        `<strong>Space ordered — reference <span class="order-ref">${spaceSettle.ref}</span></strong>` +
        `<div class="small" style="margin-top:0.3rem">Send the payment using the details below. ` +
        `Once it is confirmed your storefront goes live.</div>` +
        `<div class="pay-instructions" style="margin-top:0.7rem;margin-bottom:0">${lines}</div>`;
      $("successBanner").hidden = false;
      toast("Space order placed", "ok");
      await renderMySpace();
    } finally {
      btn.disabled = false;
    }
  }

  /* =================================================================== wire */

  function wire() {
    $("accountBtn").addEventListener("click", async () => {
      if (currentUser) {
        await auth.signOut();
        currentUser = null;
        await refreshAccount();
        toast("Signed out");
      } else {
        openAuth();
      }
    });
    $("cancelAuthBtn").addEventListener("click", () => {
      pendingTier = null;
      $("authModal").classList.remove("open");
    });
    $("authModal").addEventListener("click", (e) => {
      if (e.target === $("authModal")) $("authModal").classList.remove("open");
    });
    $("switchAuthBtn").addEventListener("click", () =>
      setAuthMode(authMode === "signin" ? "signup" : "signin")
    );
    $("submitAuthBtn").addEventListener("click", submitAuth);
    $("authPassword").addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitAuth();
    });
    $("cancelSpaceSettleBtn").addEventListener("click", () =>
      $("spaceSettleModal").classList.remove("open")
    );
    $("confirmSpaceBtn").addEventListener("click", confirmSpaceOrder);
    $("spaceSettleModal").addEventListener("click", (e) => {
      if (e.target === $("spaceSettleModal")) $("spaceSettleModal").classList.remove("open");
    });
  }

  async function init() {
    renderTiers();
    wire();
    await refreshAccount();
  }

  init();
})();
