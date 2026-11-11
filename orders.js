(function () {
  "use strict";
  const TC = window.TC; const $ = (id) => document.getElementById(id); let orders = []; let filter = "all";
  const escape = TC.esc;
  function render() {
    const rows = orders.filter((o) => filter === "all" || o.status === filter);
    const root = $("ordersList");
    if (!rows.length) { root.innerHTML = `<div class="workspace-empty"><span class="empty-mark">↗</span><h2>${orders.length ? "No orders in this view" : "No orders yet"}</h2><p>${orders.length ? "Choose another order filter." : "Your purchases from local market stalls will appear here."}</p><a class="btn btn-primary" href="shop.html">Visit the market</a></div>`; return; }
    root.innerHTML = rows.map((o) => {
      const status = o.status || "pending_payment"; const ref = o.reference || "Reference not available";
      const date = new Date(o.created_at || Date.now()).toLocaleDateString();
      const paid = status === "paid";
      return `<article class="order-card"><div class="order-card-top"><div><span class="micro-label">${escape(o.kind === "space" ? "Stall plan" : "Market order")}</span><h2>${escape(o.title || (o.kind === "space" ? "Storefront space" : "Tribal Cruize order"))}</h2></div><span class="badge ${paid ? "badge-ok" : "badge-muted"}">${escape(status.replaceAll("_", " "))}</span></div><div class="order-card-meta"><span>Reference <strong class="order-ref">${escape(ref)}</strong></span><span>${escape(date)}</span><span>${escape(o.payment_method || "Payment method pending")}</span><strong>${TC.money(o.amount)}</strong></div><p class="muted small">${paid ? "Payment verified. Contact the stall for delivery or collection updates." : "Payment has not been verified yet. Keep your reference and wait for confirmation from the seller."}</p></article>`;
    }).join("");
  }
  async function init() {
    document.querySelectorAll("[data-status]").forEach((b) => b.addEventListener("click", () => { filter = b.dataset.status; document.querySelectorAll("[data-status]").forEach((x) => x.classList.toggle("active", x === b)); render(); }));
    const { user } = await TC.auth.getUser();
    const { data, error } = await TC.db.list("orders", { order: "created_at", desc: true });
    if (error) { $("ordersList").innerHTML = `<div class="workspace-empty">Could not load orders: ${escape(error.message)}</div>`; return; }
    orders = (data || []).filter((o) => TC.demo ? (!user || !o.buyer_email || o.buyer_email === user.email) : true);
    render();
  }
  init();
})();
