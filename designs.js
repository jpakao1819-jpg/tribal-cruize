(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let records = [];
  const escape = window.TC.esc;
  function render() {
    const query = $("designSearch").value.trim().toLowerCase();
    const sort = $("designSort").value;
    const visible = records.filter((d) => `${d.name || ""} ${d.description || ""} ${d.garment_name || ""}`.toLowerCase().includes(query));
    visible.sort((a, b) => sort === "name" ? String(a.name || "").localeCompare(String(b.name || "")) : (new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)) * (sort === "oldest" ? -1 : 1));
    const grid = $("designGrid");
    if (!visible.length) {
      grid.innerHTML = `<div class="workspace-empty"><span class="empty-mark">✳</span><h2>${records.length ? "No matching designs" : "Your design library is ready"}</h2><p>${records.length ? "Try a different search." : "Start in the 3D Studio and save a design to find it here."}</p><a class="btn btn-primary" href="designer.html">Open the 3D Studio</a></div>`;
      return;
    }
    grid.innerHTML = visible.map((d) => {
      const date = new Date(d.updated_at || d.created_at || Date.now()).toLocaleDateString();
      const preview = d.thumbnail || d.preview || "";
      const art = preview ? `<img src="${escape(preview)}" alt="Preview of ${escape(d.name || "saved design")}" loading="lazy">` : `<div class="workspace-placeholder" aria-hidden="true">${escape((d.name || "TC").slice(0, 2).toUpperCase())}</div>`;
      const garmentId = d.garment_id || d.garmentId || "";
      return `<article class="workspace-card">${art}<div class="workspace-card-body"><span class="micro-label">${escape(d.garment_name || d.category || "Clothing design")}</span><h2>${escape(d.name || "Untitled design")}</h2><p class="muted small">Saved ${escape(date)}</p><div class="workspace-card-actions"><a class="btn btn-sm btn-primary" href="designer.html${garmentId ? "?garment=" + encodeURIComponent(garmentId) : ""}">Open in Studio</a><button class="btn btn-sm" type="button" data-duplicate="${escape(d.id)}">Duplicate</button><button class="btn btn-sm btn-danger" type="button" data-delete="${escape(d.id)}">Delete</button></div></div></article>`;
    }).join("");
    grid.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", async () => {
      if (!confirm("Delete this saved design?")) return;
      const { error } = await window.TC.designs.remove(button.dataset.delete);
      if (error) return window.TC.toast("Could not delete the design: " + error.message, "err");
      records = records.filter((d) => String(d.id) !== button.dataset.delete); render(); window.TC.toast("Design deleted", "ok");
    }));
    grid.querySelectorAll("[data-duplicate]").forEach((button) => button.addEventListener("click", async () => {
      const source = records.find((d) => String(d.id) === button.dataset.duplicate);
      if (!source) return;
      const copy = { ...source, id: undefined, name: (source.name || "Untitled design") + " (copy)", created_at: undefined };
      const { data, error } = await window.TC.designs.create(copy);
      if (error) return window.TC.toast("Could not duplicate the design: " + error.message, "err");
      records.unshift(data); render(); window.TC.toast("Design duplicated", "ok");
    }));
  }
  async function init() {
    $("designSearch").addEventListener("input", render); $("designSort").addEventListener("change", render);
    const { data, error } = await window.TC.designs.list({ order: "created_at", desc: true });
    if (error) { $("designGrid").innerHTML = `<div class="workspace-empty">Could not load designs: ${escape(error.message)}</div>`; return; }
    records = data || []; render();
  }
  init();
})();
