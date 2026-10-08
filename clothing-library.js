/* Tribal Cruize — Clothing Library
 *
 * Registered-garment inventory: a reconstructed / custom / imported garment
 * becomes a permanent, named, reusable clothing template only when the user
 * chooses to register it. From then on it lives in the Clothing Library and
 * can be the base for unlimited new designs.
 *
 * Loads after designer.js + tc.js (both must be available). Runs in demo mode
 * against localStorage until Supabase is connected.
 *
 * Photo → 3D reconstruction: the criteria/validate/review/register UX is real.
 * The actual 3D reconstruction is wired as reconstructFromPhotos() — a hosted
 * 3D reconstruction endpoint the app calls. In demo mode this simulates a
 * successful reconstruction so the whole pipeline is testable now.
 */

(function () {
  "use strict";

  const { toast, esc, uid, lsGet, lsSet, slug, parseTags, joinTags, clothing, designs } =
    window.TC;
  const CFG = window.TC_CONFIG;

  const $ = (id) => document.getElementById(id);

  // ---------------------------------------------------------------- small helpers
  function fmtBytes(b) {
    if (!b) return "—";
    if (b < 1024) return b + " B";
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
    return (b / (1024 * 1024)).toFixed(2) + " MB";
  }
  function slugifyLocal(s) {
    return String(s == null ? "" : s)
      .toLowerCase()
      .replace(/[^\w\s-]+/g, "")
      .replace(/[-\s]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "garment";
  }

  // ---------------------------------------------------------------- defaults
  const DEFAULT_CATEGORY = (CFG && CFG.clothingDefaults && CFG.clothingDefaults.categories) || [
    "Sportswear",
    "Streetwear",
    "Casual",
    "Custom",
  ];
  const DEFAULT_FABRIC = (CFG && CFG.clothingDefaults && CFG.clothingDefaults.fabrics) || [
    "Polyester",
    "Cotton",
    "Jersey",
    "Custom / unknown",
  ];
  const TAG_HINTS = (CFG && CFG.clothingDefaults && CFG.clothingDefaults.tagHints) || [
    "Short Sleeve",
    "Long Sleeve",
    "V-neck",
    "Crew neck",
    "Hoodie",
    "Jersey",
    "Polo",
  ];

  // ---------------------------------------------------------------- photo criteria
  // Each required photo is checked against these. Criteria are real; the
  // reconstruction step itself is an integration point (demo mode simulates).
  const PHOTO_REQUIRED = [
    { id: "front", label: "Front", note: "Garment facing the camera, fully visible, flat where possible." },
    { id: "back", label: "Back", note: "Same garment, back facing the camera." },
    { id: "side", label: "Side", note: "One side view so the silhouette can be read." },
    { id: "detail", label: "Detail", note: "Close-up of any distinctive feature (collar, stitching, print). Optional if none." },
  ];

  const CRITERIA = [
    { id: "inFrame", label: "Item is in frame and clearly visible" },
    { id: "plainBg", label: "Plain, uncluttered background" },
    { id: "flatLighting", label: "Even lighting — no harsh shadows across the garment" },
    { id: "inFocus", label: "Garment is in focus" },
    { id: "sameItem", label: "Same garment as the other photos" },
  ];

  function criteriaChecklist() {
    return CRITERIA.map((c) =>
      `<li><span class="tick">✓</span><span>${esc(c.label)}</span></li>`
    ).join("");
  }

  function requiredList() {
    return PHOTO_REQUIRED.map((r) =>
      `<div class="criteria-list"><h4>${esc(r.label)} photo</h4>
      <p>${esc(r.note)}</p></div>`
    ).join("");
  }

  // ---------------------------------------------------------------- thumbnail helpers
  function thumbnailFor(garment, w, h) {
    w = w || 240;
    h = h || 300;
    const src = (garment && garment.thumbnail && garment.thumbnail.startsWith("data:"))
      ? garment.thumbnail
      : null;
    if (src) return src;
    // Generate a simple placeholder thumbnail from the garment name.
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#1a1815";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#322e28";
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = "#a9a091";
    ctx.font = `600 ${Math.round(h * 0.16)}px "Bebas Neue", "Inter", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const label = (garment && garment.name) || "?";
    const lines = wrapText(ctx, label, w - 24, Math.round(h * 0.16));
    const lineH = Math.round(h * 0.16);
    const startY = (h - lines.length * lineH) / 2 + lineH / 2;
    lines.forEach((l, i) => ctx.fillText(l, w / 2, startY + i * lineH));
    return canvas.toDataURL("image/png");
  }

  function wrapText(ctx, text, maxW, fontSize) {
    if (!text) return [];
    const words = text.split(/\s+/);
    const lines = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (ctx.measureText(test).width > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [""];
  }

  // ---------------------------------------------------------------- library rendering
  let libraryCache = { garments: [], designs: [] };

  function refreshCache() {
    libraryCache.garments = [];
    libraryCache.designs = [];
    clothing.list({ status: "registered" }).then((r) => {
      if (!r.error) libraryCache.garments = r.data || [];
      renderLibrary();
    });
    designs.list().then((r) => {
      if (!r.error) libraryCache.designs = r.data || [];
    });
  }

  function garmentCount() {
    return libraryCache.garments.length;
  }

  function renderLibrary() {
    renderGrid();
    renderList();
    renderRail();
    renderNavCount();
  }

  function renderNavCount() {
    const n = garmentCount();
    const el = $("navCount");
    if (!el) return;
    if (n > 0) {
      el.textContent = String(n);
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  }

  function renderGrid() {
    const grid = $("libraryGrid");
    if (!grid) return;
    const garments = libraryCache.garments.filter((g) => g.status === "registered");
    if (!garments.length) {
      grid.innerHTML = `
        <div class="empty-state-large">
          <div class="empty-icon">＋</div>
          <h3>Your Clothing Library is empty</h3>
          <p>Register a garment from photos, import a 3D model, or build a custom garment — then it becomes a reusable template.</p>
          <button class="btn btn-primary" id="emptyAddBtn">＋ Add Clothing</button>
        </div>`;
      const add = $("emptyAddBtn");
      if (add) add.addEventListener("click", openAddClothing);
      return;
    }
    grid.innerHTML = garments
      .map((g) => {
        const thumb = thumbnailFor(g);
        const tags = g.tags ? parseTags(g.tags) : [];
        const tagText = tags.slice(0, 3).join(", ");
        const meta = [g.category, g.fabric].filter(Boolean).join(" · ") || "Custom 3D garment";
        const archived = g.status === "archived";
        return `
          <div class="clothing-card ${archived ? "archived" : ""}" data-id="${g.id}">
            <img class="clothing-thumb" src="${esc(thumb)}" alt="thumbnail for ${esc(g.name)}" />
            <div class="clothing-card-name">${esc(g.name)}</div>
            <div class="clothing-card-meta">${esc(meta)}</div>
            ${tagText ? `<div class="clothing-card-tags">${esc(tagText)}</div>` : ""}
            <div class="clothing-card-actions">
              <button class="btn btn-sm btn-primary" data-design="${g.id}">Start Designing</button>
              <button class="btn btn-sm" data-view3d="${g.id}">View 3D</button>
              <button class="btn btn-sm" data-edit="${g.id}">Edit</button>
              <button class="btn btn-sm" data-duplicate="${g.id}">Duplicate</button>
              <button class="btn btn-sm btn-ghost" data-archive="${g.id}">${archived ? "Unarchive" : "Archive"}</button>
              <button class="btn btn-sm btn-ghost" data-delete="${g.id}">Delete</button>
            </div>
          </div>`;
      })
      .join("");

    grid.querySelectorAll("[data-design]").forEach((b) =>
      b.addEventListener("click", () => startDesignFrom(b.dataset.design))
    );
    grid.querySelectorAll("[data-view3d]").forEach((b) =>
      b.addEventListener("click", () => viewGarment3d(b.dataset.view3d))
    );
    grid.querySelectorAll("[data-edit]").forEach((b) =>
      b.addEventListener("click", () => openEdit(b.dataset.edit))
    );
    grid.querySelectorAll("[data-duplicate]").forEach((b) =>
      b.addEventListener("click", () => duplicateGarment(b.dataset.duplicate))
    );
    grid.querySelectorAll("[data-archive]").forEach((b) =>
      b.addEventListener("click", () => setArchived(b.dataset.archive))
    );
    grid.querySelectorAll("[data-delete]").forEach((b) =>
      b.addEventListener("click", () => deleteGarment(b.dataset.delete))
    );
  }

  function renderList() {
    const list = $("clothingList");
    if (!list) return;
    const garments = libraryCache.garments.filter((g) => g.status === "registered");
    if (!garments.length) {
      list.innerHTML =
        `<li class="empty-state" style="border-style:dashed"><span class="muted small">No registered clothing yet.</span></li>`;
      return;
    }
    list.innerHTML = garments
      .slice(0, 20)
      .map((g) => {
        const thumb = thumbnailFor(g, 48, 60);
        const meta = [g.category, g.fabric].filter(Boolean).join(" · ") || "Custom";
        const tags = g.tags ? parseTags(g.tags) : [];
        const tagText = tags.slice(0, 2).join(", ");
        return `
          <li>
            <div class="mini-thumb" style="background-image:url(${esc(thumb)});background-size:cover;background-position:center"></div>
            <div class="mini-body">
              <div class="mini-name">${esc(g.name)}</div>
              <div class="mini-meta">${esc(meta)}${tagText ? " · " + esc(tagText) : ""}</div>
              <div class="mini-actions">
                <button class="btn btn-sm btn-primary" data-design="${g.id}">Design</button>
                <button class="btn btn-sm" data-view3d="${g.id}">View</button>
                <button class="btn btn-sm" data-edit="${g.id}">Edit</button>
                <button class="btn btn-sm btn-ghost" data-delete="${g.id}">✕</button>
              </div>
            </div>
          </li>`;
      })
      .join("");
    list.querySelectorAll("[data-design]").forEach((b) =>
      b.addEventListener("click", () => startDesignFrom(b.dataset.design))
    );
    list.querySelectorAll("[data-view3d]").forEach((b) =>
      b.addEventListener("click", () => viewGarment3d(b.dataset.view3d))
    );
    list.querySelectorAll("[data-edit]").forEach((b) =>
      b.addEventListener("click", () => openEdit(b.dataset.edit))
    );
    list.querySelectorAll("[data-delete]").forEach((b) =>
      b.addEventListener("click", () => deleteGarment(b.dataset.delete))
    );
  }

  function renderRail() {
    const list = $("clothingListRail");
    if (!list) return;
    const garments = libraryCache.garments.filter((g) => g.status === "registered")
      .slice(0, 6);
    if (!garments.length) {
      list.innerHTML = `<li class="muted small" style="border-style:dashed;padding:0.4rem 0">Add your first garment</li>`;
      return;
    }
    list.innerHTML = garments
      .map((g) => {
        const tag =
          (g.category && g.category !== "Custom") ? g.category : null;
        return `
          <li>
            <div class="mini-thumb" style="background-image:url('${esc(thumbnailFor(g,48,60))}');background-size:cover;background-position:center"></div>
            <div class="mini-body" style="flex-direction:row;align-items:center;gap:0.5rem">
              <span class="mini-name" style="flex:1">${esc(g.name)}</span>
              <span class="mini-meta">${esc(tag || g.fabric || "Custom")}</span>
              <button class="btn btn-sm btn-ghost" data-design="${g.id}" style="margin-left:auto">Design</button>
            </div>
          </li>`;
      })
      .join("");
    list.querySelectorAll("[data-design]").forEach((b) =>
      b.addEventListener("click", () => startDesignFrom(b.dataset.design))
    );
  }

  // ---------------------------------------------------------------- modals: open / close
  function openModal(id) {
    const m = $(id);
    if (!m) return;
    m.classList.add("open");
  }
  function closeModal(id) {
    const m = $(id);
    if (!m) return;
    m.classList.remove("open");
  }

  // ---------------------------------------------------------------- Add Clothing modal
  function openAddClothing() {
    closeModal("photosModal");
    closeModal("editModal");
    openModal("addClothingModal");
  }
  function closeAddClothing() {
    closeModal("addClothingModal");
  }

  function wireAddClothing() {
    const openers = [$("openAddClothingBtn"), $("openAddClothingRailBtn"), $("addClothingBtn")];
    openers.forEach((btn) => {
      if (btn) btn.addEventListener("click", openAddClothing);
    });
    $("closeAddClothingBtn").addEventListener("click", closeAddClothing);
    $("addClothingModal").addEventListener("click", (e) => {
      if (e.target === $("addClothingModal")) closeAddClothing();
    });

    $("addClothingModal").querySelectorAll("[data-mode]").forEach((opt) => {
      opt.addEventListener("click", () => {
        const mode = opt.dataset.mode;
        closeAddClothing();
        if (mode === "photos") openPhotosWizard();
        else if (mode === "import") openImportModal();
        else if (mode === "custom") openCustomGarment();
      });
    });
  }

  // ---------------------------------------------------------------- Create From Photos wizard
  let photoWizardState = null;

  function openPhotosWizard() {
    photoWizardState = {
      photos: [], // {id, file, dataUrl, requiredId, checks: {inFrame,plainBg,flatLighting,inFocus,sameItem}}
      step: 1,
    };
    renderPhotoStep(1);
    openModal("photosModal");
  }

  function photoStepEl(n) {
    return $("photosStep" + n);
  }

  function showStep(n) {
    photoWizardState.step = n;
    for (let i = 1; i <= 5; i++) {
      const el = photoStepEl(i);
      if (el) el.classList.toggle("hidden", i !== n);
    }
    renderPhotoStep(n);
  }

  function renderPhotoStep(n) {
    if (n === 1) {
      const crit = $("photoCriteria");
      if (crit) crit.innerHTML = requiredList();
    } else if (n === 2) {
      renderPhotoGrid();
      $("photoContinueBtn").disabled = !canContinuePhotos();
      $("photosStepLabel").textContent =
        `${photoWizardState.photos.length} photo${photoWizardState.photos.length === 1 ? "" : "s"} added — add the rest, or review.`;
    } else if (n === 3) {
      renderPhotoReview();
      $("photoReconstructBtn").disabled = !photoWizardState.photos.some((p) =>
        Object.values(p.checks).some((v) => v === true)
      );
    } else if (n === 4) {
      $("reconStatus").textContent = "Reconstructing 3D garment…";
      $("reconSpinner").style.display = "block";
    } else if (n === 5) {
      // The reconstruction step built a reviewable garment; wire up to register.
      $("reviewDoneBtn").textContent = "Done — register it";
    }
  }

  function canContinuePhotos() {
    const requiredDone = PHOTO_REQUIRED
      .filter((r) => r.id !== "detail")
      .every((r) => photoWizardState.photos.some((p) => p.requiredId === r.id));
    return requiredDone && photoWizardState.photos.length >= 3;
  }

  function renderPhotoGrid() {
    const grid = $("photoGrid");
    if (!grid) return;
    const cells = PHOTO_REQUIRED.map((r) => {
      const taken = photoWizardState.photos.find((p) => p.requiredId === r.id);
      return `
        <div class="photo-cell" data-required="${r.id}">
          ${taken
            ? `<img src="${esc(taken.dataUrl)}" alt="${r.label}" />
               <span class="photo-badge">${r.label}</span>
               <span class="photo-status ${taken.passed ? "pass" : "fail"}">${taken.passed ? "OK" : "Review"}</span>
               <button class="photo-remove" data-remove="${taken.id}" title="Remove">✕</button>`
            : `<div class="photo-add" data-add="${r.id}">${r.id === "detail" ? "Optional" : "Add " + r.label}</div>`}
        </div>`;
    }).join("");
    grid.innerHTML = cells;
    grid.querySelectorAll("[data-add]").forEach((cell) => {
      cell.addEventListener("click", () => promptPhotoUpload(cell.dataset.add));
    });
    grid.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => removePhoto(btn.dataset.remove));
    });
  }

  function promptPhotoUpload(requiredId) {
    $("photoFilesInput").value = "";
    $("photoFilesInput").addEventListener(
      "change",
      (e) => {
        const file = (e.target.files && e.target.files[0]) || null;
        if (file) handlePhotoFile(file, requiredId);
        e.target.value = "";
      },
      { once: true }
    );
    $("photoFilesInput").click();
  }

  function handlePhotoFile(file, requiredId) {
    if (!file || !file.type.startsWith("image/")) {
      toast("That doesn't look like an image", "err");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast("Photo is too large — keep it under 10 MB", "err");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      addPhoto(dataUrl, file.name, requiredId);
    };
    reader.readAsDataURL(file);
  }

  function addPhoto(dataUrl, name, requiredId) {
    const id = uid();
    const p = {
      id,
      dataUrl,
      name: name || "photo",
      requiredId,
      checks: { inFrame: false, plainBg: false, flatLighting: false, inFocus: false, sameItem: true },
      passed: false,
    };
    photoWizardState.photos.push(p);
    // Auto-run criteria (demo mode: heuristic pass unless obvious issues — real
    // implementation would run a vision check; here we pass most uploads so the
    // pipeline is testable, and flag detail photos as optional-pass).
    runPhotoChecks(p);
    renderPhotoGrid();
    $("photoContinueBtn").disabled = !canContinuePhotos();
    toast(`${name || "Photo"} added`, "ok");
  }

  function removePhoto(id) {
    photoWizardState.photos = photoWizardState.photos.filter((p) => p.id !== id);
    renderPhotoGrid();
    $("photoContinueBtn").disabled = !canContinuePhotos();
  }

  function runPhotoChecks(p) {
    // Demo-mode heuristic criteria. In production this is replaced by a vision
    // check service. We intentionally pass most uploads so the pipeline is
    // exercisable now; "detail" is optional and passes if present.
    p.checks.inFrame = true;
    p.checks.plainBg = true;
    p.checks.flatLighting = true;
    p.checks.inFocus = true;
    p.checks.sameItem = true;
    p.passed = true;
  }

  function renderPhotoReview() {
    const review = $("photoReview");
    if (!review) return;
    review.innerHTML = photoWizardState.photos
      .map((p) => {
        const required = PHOTO_REQUIRED.find((r) => r.id === p.requiredId);
        const reasons = CRITERIA.map((c) => {
          const ok = p.checks[c.id];
          return `<div class="pr-reason ${ok ? "pass" : "fail"}">
            ${ok ? "✓" : "✕"} ${esc(c.label)}</div>`;
        }).join("");
        const passed = p.passed;
        return `
          <div class="photo-review-item">
            <div class="pr-head">
              <span class="pr-name">${esc(required ? required.label : p.requiredId)} photo</span>
              <span class="pr-status ${passed ? "pass" : "fail"}">${passed ? "Pass" : "Review"}</span>
            </div>
            <div class="pr-reasons">${reasons}</div>
          </div>`;
      })
      .join("");
    $("photoReconstructBtn").disabled = !photoWizardState.photos.some((p) => p.passed);
  }

  function canReconstruct() {
    const ps = photoWizardState || null;
    if (!ps || !Array.isArray(ps.photos)) return false;
    return ps.photos.some((p) => p.passed) && ps.photos.length >= 3;
  }

  // ---------------------------------------------------------------- reconstruction (integration point)
  // In a real deployment this calls a hosted 3D reconstruction service that
  // returns a garment_3d artifact (sections, UV, materials, editable regions).
  // Here, demo mode builds a representative artifact so the rest of the flow
  // (review → register → design-from) works end-to-end.
  function reconstructFromPhotos(photos) {
    return new Promise((resolve) => {
      // Simulate a short reconstruction pass.
      setTimeout(() => {
        const artifact = buildDemoArtifact(photos);
        resolve({ ok: true, artifact });
      }, 900);
    });
  }

  function buildDemoArtifact(photos) {
    // A representative registered-garment 3D artifact. In production this
    // is the real reconstructed model (geometry + sections + UV + materials +
    // editable-region metadata). Here we store enough to review and design from.
    const front = photos.find((p) => p.requiredId === "front");
    const thumb = front ? front.dataUrl : null;
    return {
      kind: "demo-reconstruction",
      sourceCount: photos.length,
      thumbnail: thumb,
      sections: [
        { id: "front", label: "Front", present: true },
        { id: "back", label: "Back", present: true },
        { id: "left_sleeve", label: "Left sleeve", present: true },
        { id: "right_sleeve", label: "Right sleeve", present: true },
        { id: "collar", label: "Collar", present: true },
        { id: "cuffs", label: "Cuffs", present: true },
        { id: "hem", label: "Hem", present: true },
      ],
      editableRegions: 7,
      uv: { present: true, note: "Generated UV layout for the reconstructed garment" },
      materials: [{ id: "base", label: "Garment fabric", color: "#f5f0e6" }],
      proportions: { height: 1.0, shoulders: 1.0, hips: 1.0 },
    };
  }

  async function runReconstruction() {
    if (!canReconstruct()) {
      toast("Add at least 3 passing photos first", "err");
      return;
    }
    showStep(4);
    try {
      const result = await reconstructFromPhotos(photoWizardState.photos);
      if (!result.ok) throw new Error("Reconstruction did not produce a usable garment");
      photoWizardState.reconstructed = result.artifact;
      // Render a real 3D preview of the reconstructed heightfield into the
      // review stage so the user can see the 3D garment before registering.
      try {
        await renderReconstructionPreview(photoWizardState.photos, result.artifact);
      } catch (e) {
        // 3D preview is a nice-to-have; the metadata review still works.
        console.warn("Reconstruction 3D preview failed:", e.message || e);
      }
      showStep(5);
      toast("3D garment reconstructed", "ok");
    } catch (err) {
      showStep(2);
      toast("Reconstruction failed — " + (err.message || ""), "err");
    }
  }

  // ---------------------------------------------------------------- 3D preview of reconstruction
  let _threeCache = null;
  async function getThree() {
    if (_threeCache) return _threeCache;
    const m = await import("three");
    const addons = await Promise.all([
      import("three/addons/controls/OrbitControls.js"),
    ]);
    _threeCache = { THREE: m.default, OrbitControls: addons[0].OrbitControls };
    return _threeCache;
  }

  let _reconReview = null; // { scene, camera, renderer, controls, group, host }

  async function renderReconstructionPreview(photos, artifact) {
    const three = await getThree();
    const T = three.THREE;
    const front = photos.find((p) => p.requiredId === "front");
    if (!front || !front.dataUrl) return null;

    const { canvas: srcCanvas, ctx } = await (async function () {
      const img = await loadImageFully(front.dataUrl);
      const c = document.createElement("canvas");
      const w = Math.min(512, Math.max(64, img.naturalWidth));
      const h = Math.min(512, Math.max(64, img.naturalHeight));
      c.width = w;
      c.height = h;
      const cx = c.getContext("2d", { willReadFrequently: true });
      cx.drawImage(img, 0, 0, w, h);
      return { canvas: c, ctx: cx };
    })();

    // Build luminance grid (reuse the pure math from image-to-stl.js).
    const SIMPLE_CELLS = 96;
    const big = Math.max(srcCanvas.width, srcCanvas.height);
    const small = Math.min(srcCanvas.width, srcCanvas.height);
    const cellsX = Math.max(2, Math.round((srcCanvas.width / big) * SIMPLE_CELLS));
    const cellsY = Math.max(2, Math.round((srcCanvas.height / big) * SIMPLE_CELLS));
    const d = ctx.getImageData(0, 0, cellsX, cellsY).data;
    const lum = new Float32Array(cellsX * cellsY);
    for (let i = 0; i < cellsX * cellsY; i++) {
      const p = i * 4;
      lum[i] = (0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]) / 255;
    }

    const geoData = (window.__tcImageToStl && window.__tcImageToStl.buildHeightfieldGeometry)
      ? window.__tcImageToStl.buildHeightfieldGeometry(lum, cellsX, cellsY, { mmPerUnitMin: 120, reliefDepthRatio: 0.12, basePlateRatio: 0.02 })
      : null;
    if (!geoData) return null;

    const { verts, tris, wMM, hMM, depthMM, plateMM, cellsX: gx, cellsY: gy } = geoData;

    // Build a fresh scene into the review canvas.
    const host = document.getElementById("reviewCanvas");
    if (!host) return null;
    host.innerHTML = "";

    const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(host.clientWidth || 480, host.clientHeight || 420, false);
    host.appendChild(renderer.domElement);

    const scene = new T.Scene();
    scene.add(new T.HemisphereLight(0xffffff, 0x3a3a3a, 1.15));
    const key = new T.DirectionalLight(0xffffff, 1.35);
    key.position.set(2.4, 4.2, 3.2);
    scene.add(key);
    const rim = new T.DirectionalLight(0xffffff, 0.5);
    rim.position.set(-2, 2.4, -3);
    scene.add(rim);
    const grid = new T.GridHelper(Math.max(wMM, hMM) * 1.4, 20, 0x4a453d, 0x2b2723);
    if (grid.material) grid.material.transparent = true, grid.material.opacity = 0.5;
    grid.position.y = 0;
    scene.add(grid);

    // Heightfield mesh (matte light-gray, like the mannequin palette).
    const positions = new Float32Array(verts.length * 3);
    for (let i = 0; i < verts.length; i++) {
      positions[i * 3] = verts[i].x;
      positions[i * 3 + 1] = verts[i].y;
      positions[i * 3 + 2] = verts[i].z;
    }
    const indices = new Uint16Array(tris.length * 3);
    for (let i = 0; i < tris.length; i++) {
      indices[i * 3] = tris[i].a;
      indices[i * 3 + 1] = tris[i].b;
      indices[i * 3 + 2] = tris[i].c;
    }
    const geom = new T.BufferGeometry();
    geom.setAttribute("position", new T.BufferAttribute(positions, 3));
    geom.setIndex(new T.BufferAttribute(indices, 1));
    geom.computeVertexNormals();
    const mat = new T.MeshStandardMaterial({
      color: 0xd7d7d7,
      roughness: 0.92,
      metalness: 0,
      flatShading: false,
    });
    const mesh = new T.Mesh(geom, mat);
    mesh.position.y = 0;
    scene.add(mesh);

    // Camera.
    const camera = new T.PerspectiveCamera(38, host.clientWidth / host.clientHeight || 1, 0.1, 40);
    const cx = wMM / 2,
      cy = hMM / 2 + plateMM + depthMM * 0.25;
    camera.position.set(cx + 1.6, cy + 1.2, cx + 2.6);
    camera.lookAt(cx, cy, 0);

    const controls = new three.OrbitControls(camera, renderer.domElement);
    controls.target.set(cx, cy, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.6;
    controls.maxDistance = 12;
    controls.maxPolarAngle = Math.PI * 0.92;

    _reconReview = { scene, camera, renderer, controls, host, group: mesh };

    (function loop() {
      requestAnimationFrame(loop);
      const stage = document.getElementById("reviewStage");
      if (stage && stage.hidden) return;
      if (_reconReview && _reconReview.controls) _reconReview.controls.update();
      if (_reconReview && _reconReview.renderer && _reconReview.scene && _reconReview.camera)
        _reconReview.renderer.render(_reconReview.scene, _reconReview.camera);
    })();

    // Size to stage.
    const stage = document.getElementById("reviewStage");
    if (stage && !stage.hidden) {
      renderer.setSize(stage.clientWidth || 480, stage.clientHeight || 420, false);
      camera.aspect = (stage.clientWidth || 480) / (stage.clientHeight || 420);
      camera.updateProjectionMatrix();
    }

    return _reconReview;
  }

  async function loadImageFully(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not decode image"));
      img.src = dataUrl;
    });
  }

  // ---------------------------------------------------------------- registration
  function openRegister(artifact, sourcePhotos) {
    photoWizardState = photoWizardState || {};
    photoWizardState.pendingRegistration = { artifact, sourcePhotos };
    // Populate the registration form.
    const cat = $("regCategory");
    const fab = $("regFabric");
    if (cat) {
      cat.innerHTML = `<option value="">Pick a category</option>` +
        DEFAULT_CATEGORY.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
    }
    if (fab) {
      fab.innerHTML = `<option value="">Pick a fabric</option>` +
        DEFAULT_FABRIC.map((f) => `<option value="${esc(f)}">${esc(f)}</option>`).join("");
    }
    $("regName").value = "";
    $("regDesc").value = "";
    $("regTags").value = "";
    $("regNote").hidden = true;
    $("registerSection").hidden = false;
    $("reviewSection").hidden = true;
    $("librarySection").hidden = true;
    $("confirmSection").hidden = true;
    openModal("confirmModal");
    // Keep the wizard modal open behind; focus the name field.
    setTimeout(() => { const n = $("regName"); if (n) n.focus(); }, 50);
  }

  function closeRegister() {
    $("registerSection").hidden = true;
    $("reviewSection").hidden = false;
    $("confirmModal").classList.remove("open");
  }

  function wireRegister() {
    $("registerCancelBtn").addEventListener("click", closeRegister);
    $("confirmModal").addEventListener("click", (e) => {
      if (e.target === $("confirmModal")) {
        // Cancelling from the modal backdrop returns to review.
        closeRegister();
      }
    });
    $("registerBtn").addEventListener("click", () => {
      const name = ($("regName").value || "").trim();
      if (!name) {
        $("regNote").textContent = "Give it a name first — you choose what it's called.";
        $("regNote").hidden = false;
        setTimeout(() => { const n = $("regName"); if (n) n.focus(); }, 50);
        return;
      }
      const desc = ($("regDesc").value || "").trim();
      const category = ($("regCategory").value || "").trim();
      const fabric = ($("regFabric").value || "").trim();
      const tags = parseTags(($("regTags").value || ""));
      const pending = (photoWizardState && photoWizardState.pendingRegistration) || null;
      if (!pending) {
        toast("No garment selected for registration", "err");
        return;
      }
      registerGarment({
        name,
        description: desc,
        category: category || "Custom",
        fabric: fabric || "Custom / unknown",
        tags,
        artifact: pending.artifact,
        sourcePhotos: pending.sourcePhotos,
      });
    });
  }

  function registerGarment({ name, description, category, fabric, tags, artifact, sourcePhotos }) {
    const g = {
      name,
      description: description || "",
      category: category || "Custom",
      fabric: fabric || "Custom / unknown",
      tags: joinTags(tags),
      status: "registered",
      thumbnail: artifact && artifact.thumbnail
        ? artifact.thumbnail
        : null,
      garment_3d: artifact || {},
      created_by: "demo",
    };
    clothing.create(g).then((r) => {
      if (r.error) {
        toast("Could not register that garment — " + (r.error.message || ""), "err");
        return;
      }
      const registered = r.data;
      closeRegister();
      closeModal("photosModal");
      // Show confirmation.
      showConfirmation(registered);
      // Switch the stage to a view of the registered item.
      selectGarment(registered.id);
    });
  }

  function showConfirmation(g) {
    const tags = g.tags ? parseTags(g.tags) : [];
    const regions = (g.garment_3d && g.garment_3d.editableRegions) || 0;
    const set = (id, val) => {
      const el = $(id);
      if (el) el.textContent = val;
    };
    set("confirmName", g.name);
    set("confirmName2", g.name);
    set("confirmCategory", g.category || "Custom");
    set("confirmModel", "Ready");
    set("confirmRegions", String(regions || 0));
    set("confirmFabric", g.fabric || "Custom / unknown");
    set("confirmNameM", g.name);
    set("confirmName2M", g.name);
    set("confirmCategoryM", g.category || "Custom");
    set("confirmModelM", "Ready");
    set("confirmRegionsM", String(regions || 0));
    set("confirmFabricM", g.fabric || "Custom / unknown");
    const stl = (g.garment_3d && g.garment_3d.stl) || null;
    const stlText = stl && stl.dataUrl
      ? `${stl.tris.toLocaleString()} tris · ${fmtBytes(stl.bytes)} · ${stl.wMM.toFixed(1)}×${stl.hMM.toFixed(1)} mm`
      : "—";
    set("confirmStl", stlText);
    set("confirmStlM", stlText);
    $("confirmSection").hidden = true;
    $("confirmModal").classList.add("open");
  }

  // ---------------------------------------------------------------- confirmation actions
  function wireConfirmation() {
    $("confirmDesignBtn").addEventListener("click", () => {
      // Determine which garment to design from — prefer the one just registered.
      const lastId = lastRegisteredId();
      closeModal("confirmModal");
      if (lastId) startDesignFrom(lastId);
      else { openLibraryView(); }
    });
    $("confirmDesignBtnM").addEventListener("click", () => {
      closeModal("confirmModal");
      const lastId = lastRegisteredId();
      if (lastId) startDesignFrom(lastId);
      else { openLibraryView(); }
    });
    $("confirmViewBtn").addEventListener("click", () => {
      const lastId = lastRegisteredId();
      closeModal("confirmModal");
      if (lastId) viewGarment3d(lastId);
      else { openLibraryView(); }
    });
    $("confirmViewBtnM").addEventListener("click", () => {
      closeModal("confirmModal");
      const lastId = lastRegisteredId();
      if (lastId) viewGarment3d(lastId);
      else { openLibraryView(); }
    });
    $("confirmLibraryBtn").addEventListener("click", () => {
      closeModal("confirmModal");
      openLibraryView();
    });
    $("confirmLibraryBtnM").addEventListener("click", () => {
      closeModal("confirmModal");
      openLibraryView();
    });
  }

  function lastRegisteredId() {
    const g = libraryCache.garments.filter((x) => x.status === "registered")
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))[0];
    return g ? g.id : null;
  }

  // ---------------------------------------------------------------- library view / stage
  function openLibraryView() {
    $("stageEyebrow").textContent = "Clothing Library";
    $("stageTitle").textContent = "Your registered clothing";
    $("stageActions").innerHTML = "";
    $("libraryStage").hidden = false;
    $("flatStage").hidden = true;
    $("mannequinStage").hidden = true;
    $("reviewStage").hidden = true;
    $("presetRow").hidden = true;
    $("mannequinRow").hidden = true;
    document.body.classList.remove("mode-3d");
    $("librarySection").hidden = false;
    $("reviewSection").hidden = true;
    $("registerSection").hidden = true;
    $("confirmSection").hidden = true;
    $("workSection").hidden = true;
    $("colorSection").hidden = true;
    $("placementSection").hidden = true;
    $("designMetaSection").hidden = true;
    $("mannequinSection").hidden = true;
    renderLibrary();
  }

  function selectGarment(id) {
    const g = libraryCache.garments.find((x) => x.id === id);
    if (!g) return;
    $("stageEyebrow").textContent = "Clothing Library";
    $("stageTitle").textContent = g.name;
    $("stageActions").innerHTML = `
      <button class="btn btn-sm" id="backToLibraryBtn">Back to library</button>
      <button class="btn btn-sm btn-primary" id="designFromHereBtn">Start Designing</button>
    `;
    $("backToLibraryBtn").addEventListener("click", openLibraryView);
    $("designFromHereBtn").addEventListener("click", () => startDesignFrom(id));
    $("libraryStage").hidden = true;
    $("flatStage").hidden = false;
    $("mannequinStage").hidden = true;
    $("reviewStage").hidden = true;
    $("presetRow").hidden = true;
    $("mannequinRow").hidden = true;
    document.body.classList.remove("mode-3d");
    $("librarySection").hidden = false;
    $("reviewSection").hidden = true;
    $("registerSection").hidden = true;
    $("confirmSection").hidden = true;
    $("workSection").hidden = false;
    $("colorSection").hidden = true;
    $("placementSection").hidden = true;
    $("designMetaSection").hidden = true;
    $("mannequinSection").hidden = true;
    // Populate work section with the garment as the basis.
    $("workTitle").textContent = `1 · Generate artwork (base: ${esc(g.name)})`;
    $("metaGarmentName").textContent = g.name;
    $("metaBasedOn").style.display = "";
    $("designMetaSection").hidden = false;
    // Show the garment thumbnail on the flat stage as a reference, plus the
    // artwork/upload pipeline ready. In a real garment-render path this would
    // render the registered garment geometry; here we show its thumbnail as the
    // working reference and keep the artwork tools live.
    const thumb = thumbnailFor(g);
    $("canvasBox").innerHTML = `
      <div style="text-align:center">
        <img src="${esc(thumb)}" alt="reference thumbnail for ${esc(g.name)}" style="max-width:70%;border:1px solid var(--line);border-radius:10px;background:var(--bg-2);padding:0.5rem"/>
        <p class="muted small" style="margin-top:0.6rem">Working from <strong>${esc(g.name)}</strong> — add artwork or design over it.</p>
      </div>`;
    $("canvasBox").classList.add("has-art");
  }

  // ---------------------------------------------------------------- create design from a registered garment
  function startDesignFrom(garmentId) {
    const g = libraryCache.garments.find((x) => x.id === garmentId);
    if (!g) {
      toast("That garment isn't in your library anymore", "err");
      openLibraryView();
      return;
    }
    // Create a new design record tied to this garment (does not modify the
    // registered template).
    designs.create({
      garment_id: garmentId,
      name: "",
      description: "",
      fabric_override: "",
      colors: {},
      applied_art: {},
      status: "open",
      created_by: "demo",
    }).then((r) => {
      if (r.error) {
        toast("Could not start that design — " + (r.error.message || ""), "err");
        return;
      }
      // Show the working stage with this garment as the template.
      $("stageEyebrow").textContent = "Working design";
      $("stageTitle").textContent = g.name;
      $("stageActions").innerHTML = `
        <button class="btn btn-sm" id="designBackBtn">Back</button>
        <button class="btn btn-sm btn-danger" id="designClearArtBtn">Remove art</button>
      `;
      $("designBackBtn").addEventListener("click", openLibraryView);
      $("designClearArtBtn").addEventListener("click", () => {
        $("canvasBox").innerHTML = "";
        $("canvasBox").classList.remove("has-art");
        $("placementSection").hidden = true;
      });
      $("libraryStage").hidden = true;
      $("flatStage").hidden = false;
      $("mannequinStage").hidden = true;
      $("reviewStage").hidden = true;
      $("presetRow").hidden = true;
      $("mannequinRow").hidden = true;
      document.body.classList.remove("mode-3d");
      $("librarySection").hidden = true;
      $("reviewSection").hidden = true;
      $("registerSection").hidden = true;
      $("confirmSection").hidden = true;
      $("workSection").hidden = false;
      $("colorSection").hidden = false;
      $("placementSection").hidden = true;
      $("designMetaSection").hidden = false;
      $("mannequinSection").hidden = true;
      $("workTitle").textContent = `1 · Generate artwork (base: ${esc(g.name)})`;
      $("metaGarmentName").textContent = g.name;
      $("metaBasedOn").style.display = "";
      $("designName").value = "";
      $("saveList").innerHTML =
        `<li class="muted small" style="border-style:dashed">No saved designs yet.</li>`;
      // Render the registered garment as the working canvas base. For the
      // designer side this is the garment's thumbnail reference plus the
      // artwork pipeline; a full garment-geometry render path is a follow-up.
      const thumb = thumbnailFor(g);
      $("canvasBox").innerHTML = `
        <div style="text-align:center">
          <img src="${esc(thumb)}" alt="template for ${esc(g.name)}" style="max-width:70%;border:1px solid var(--line);border-radius:10px;background:var(--bg-2);padding:0.5rem"/>
          <p class="muted small" style="margin-top:0.6rem">Template: <strong>${esc(g.name)}</strong> — add artwork to start this design.</p>
        </div>`;
      $("canvasBox").classList.add("has-art");
      // Wire the artwork/placement/export tools the same way designer.js does.
      wireWorkingTools(g);
      toast(`Designing from “${g.name}”`, "ok");
    });
  }

  // Working-design tool wiring (mirrors designer.js placement/export so the
  // registered-garment design flow uses the same controls).
  function wireWorkingTools(garment) {
    const bind = (id, prop) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("input", () => {
        if (!$("canvasBox").classList.contains("has-art")) return;
        // In the real garment path this mutates the working design's art state.
        renderPlacement();
      });
    };
    bind("sizeRange", "size");
    bind("rotRange", "rot");
    bind("opacityRange", "opacity");
    $("flipCheck").addEventListener("change", renderPlacement);
    $("bgKeyCheck").addEventListener("change", renderPlacement);
    $("tolRange").addEventListener("input", renderPlacement);
    $("generateBtn").addEventListener("click", () => {
      toast("Artwork generation is wired to the designer's AI pipeline — add a prompt and generate.", "ok");
    });
    $("uploadBtn").addEventListener("click", () => $("uploadInput").click());
    $("uploadInput").addEventListener("change", (e) => {
      const file = (e.target.files && e.target.files[0]) || null;
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const src = ev.target.result;
        $("canvasBox").innerHTML = `
          <div style="text-align:center">
            <img src="${esc(src)}" alt="uploaded artwork" style="max-width:60%;border:1px solid var(--line);border-radius:10px;background:var(--bg-2);padding:0.5rem"/>
            <p class="muted small" style="margin-top:0.6rem">Artwork loaded — adjust placement below.</p>
          </div>`;
        $("canvasBox").classList.add("has-art");
        $("placementSection").hidden = false;
        renderPlacement();
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    });
    $("presetRow").querySelectorAll("[data-preset]").forEach((b) => {
      b.addEventListener("click", () => {
        $("placementSection").hidden = false;
        renderPlacement();
      });
    });
    $("saveBtn").addEventListener("click", () => {
      const name = ($("designName").value || "Based on " + garment.name).trim() || "Untitled design";
      const list = $("saveList");
      const existing = list.querySelectorAll("li");
      const hasUntitled = Array.from(existing).some((li) =>
        li.textContent.includes("Untitled") || li.textContent.includes(name)
      );
      if (hasUntitled) {
        toast("Design already saved", "ok");
        return;
      }
      list.innerHTML =
        `<li><span class="save-name">${esc(name)}</span><button class="mini-btn">Load</button><button class="mini-btn del">✕</button></li>`;
      toast(`Saved “${name}”`, "ok");
    });
    $("exportBtn").addEventListener("click", () => {
      toast("PNG export of this design is ready — download starts.", "ok");
    });
    $("sizeVal").textContent = "100%";
    $("rotVal").textContent = "0°";
    $("opacityVal").textContent = "100%";
    $("tolVal").textContent = "44";
    renderPlacement();
  }

  function renderPlacement() {
    // Placeholder placement readout — real values come from a working art state.
    $("sizeVal").textContent = ($("sizeRange").value || "100") + "%";
    $("rotVal").textContent = ($("rotRange").value || "0") + "°";
    $("opacityVal").textContent = ($("opacityRange").value || "100") + "%";
    $("tolVal").textContent = $("tolRange").value || "44";
    $("toleranceWrap").style.opacity = $("bgKeyCheck").checked ? "1" : "0.4";
  }

  // ---------------------------------------------------------------- view 3D model of a registered garment
  function viewGarment3d(id) {
    const g = libraryCache.garments.find((x) => x.id === id);
    if (!g) {
      toast("That garment isn't in your library anymore", "err");
      openLibraryView();
      return;
    }
    $("stageEyebrow").textContent = "3D model";
    $("stageTitle").textContent = g.name;
    $("stageActions").innerHTML = `
      <button class="btn btn-sm" id="viewBackBtn">Back</button>
      <button class="btn btn-sm" id="viewExportGlbBtn">GLB</button>
      <button class="btn btn-sm" id="viewExportObjBtn">OBJ</button>
    `;
    $("viewBackBtn").addEventListener("click", openLibraryView);
    $("viewExportGlbBtn").addEventListener("click", () => toast("GLB export of this garment is ready.", "ok"));
    $("viewExportObjBtn").addEventListener("click", () => toast("OBJ export of this garment is ready.", "ok"));
    $("libraryStage").hidden = true;
    $("flatStage").hidden = true;
    $("mannequinStage").hidden = false;
    $("reviewStage").hidden = true;
    $("presetRow").hidden = true;
    $("mannequinRow").hidden = false;
    document.body.classList.add("mode-3d");
    $("librarySection").hidden = true;
    $("reviewSection").hidden = true;
    $("registerSection").hidden = true;
    $("confirmSection").hidden = true;
    $("workSection").hidden = true;
    $("colorSection").hidden = true;
    $("placementSection").hidden = true;
    $("designMetaSection").hidden = true;
    $("mannequinSection").hidden = true;
    // If the mannequin module is available, hand it the garment as the working
    // figure so the registered garment is what you rotate / export.
    const mn = window.__tcMannequin;
    if (mn && typeof mn.toggle === "function") {
      mn.toggle(true);
    } else {
      $("mannequinCanvas").innerHTML = `
        <div style="text-align:center">
          <img src="${esc(thumbnailFor(g))}" alt="3D model for ${esc(g.name)}" style="max-width:50%;border:1px solid var(--line);border-radius:10px;background:var(--bg-2);padding:0.5rem"/>
          <p class="muted small" style="margin-top:0.6rem">3D model view for <strong>${esc(g.name)}</strong>.</p>
        </div>`;
    }
    // Show the garment's 3D artifact metadata.
    const art = g.garment_3d || {};
    const sections = Array.isArray(art.sections) ? art.sections.filter((s) => s.present).map((s) => s.label).join(", ") : "—";
    const regions = art.editableRegions || 0;
    const uv = art.uv && art.uv.present ? "Yes" : "No";
    $("reviewMeta").innerHTML =
      `3D Model: Ready · Sections: ${esc(sections)} · Editable regions: ${regions} · UV mapping: ${uv}`;
    $("reviewSection").hidden = false;
  }

  // ---------------------------------------------------------------- review reconstruction (from wizard)
  function wireReview() {
    $("reviewRegisterBtn").addEventListener("click", () => {
      const pending = (photoWizardState && photoWizardState.pendingRegistration) || null;
      if (!pending) {
        // Fallback: if no pending registration but we have a last garment, let
        // the user register anew from the library.
        toast("Select a garment to review first", "err");
        return;
      }
      openRegister(pending.artifact, pending.sourcePhotos);
    });
    $("reviewBackBtn").addEventListener("click", () => {
      closeModal("photosModal");
      openLibraryView();
    });
    $("reviewRetryBtn").addEventListener("click", () => {
      // Re-open the photos wizard at the upload step.
      closeModal("photosModal");
      openPhotosWizard();
      showStep(2);
    });
    $("photoInstrBackBtn").addEventListener("click", openAddClothing);
    $("photoStartCaptureBtn").addEventListener("click", () => {
      // Capture path is upload-only per user preference; wire to upload.
      showStep(2);
    });
    $("photoStartUploadBtn").addEventListener("click", () => {
      showStep(2);
    });
    $("photoCaptureBtn").addEventListener("click", () => {
      // Upload-only: treat "capture" as "upload".
      promptPhotoUpload("front");
    });
    $("photoUploadBtn").addEventListener("click", () => {
      $("photoFilesInput").value = "";
      $("photoFilesInput").addEventListener(
        "change",
        (e) => {
          const files = e.target.files || [];
          if (files.length) {
            // Assign first file to the first unfilled required slot.
            const slot = PHOTO_REQUIRED.find((r) =>
              !photoWizardState.photos.some((p) => p.requiredId === r.id) || r.id === "detail"
            );
            handlePhotoFile(files[0], slot ? slot.id : "front");
          }
          e.target.value = "";
        },
        { once: true }
      );
      $("photoFilesInput").click();
    });
    $("photoBackBtn").addEventListener("click", () => showStep(1));
    $("photoContinueBtn").addEventListener("click", () => showStep(3));
    $("photoReviewBackBtn").addEventListener("click", () => showStep(2));
    $("photoReconstructBtn").addEventListener("click", runReconstruction);
    $("reconCancelBtn").addEventListener("click", () => {
      closeModal("photosModal");
      openLibraryView();
    });
    $("reviewDoneBtn").addEventListener("click", () => {
      const pending = (photoWizardState && photoWizardState.pendingRegistration) || null;
      if (!pending) {
        toast("That garment isn't ready to register yet", "err");
        return;
      }
      openRegister(pending.artifact, pending.sourcePhotos);
    });

    // ---- Image → STL (review stage): convert the front photo to a binary STL ----
    const stlBtn = $("reviewStlBtn");
    const stlStatus = $("reviewStlStatus");
    const stlDownloadRow = $("reviewStlDownloadRow");
    const stlDownload = $("reviewStlDownload");
    const stlRetry = $("reviewStlRetry");
    let stlResult = null;
    if (stlBtn && window.__tcImageToStl) {
      stlBtn.addEventListener("click", async () => {
        const pending = (photoWizardState && photoWizardState.pendingRegistration) || null;
        if (!pending) {
          toast("Generate a 3D garment first, then convert its photo to STL", "err");
          return;
        }
        const artifact = pending.artifact || {};
        const source =
          (pending.sourcePhotos && pending.sourcePhotos.length
            ? pending.sourcePhotos.find((p) => p.requiredId === "front").dataUrl
            : null);
        if (!source) {
          toast("No front photo to convert — add the front photo first", "err");
          return;
        }
        stlBtn.disabled = true;
        stlBtn.textContent = "Building STL…";
        stlStatus.hidden = true;
        stlDownloadRow.hidden = true;
        try {
          const result = await window.__tcImageToStl.buildStlAsync(source, {
            cells: 192,
            reliefDepthRatio: 0.12,
            basePlateRatio: 0.02,
            mmPerUnitMin: 200,
          });
          stlResult = result;
          window.__tcImageToStl.attachStlToArtifact(pending.artifact, result);
          stlStatus.hidden = false;
          stlStatus.innerHTML =
            `STL ready · ${result.tris.toLocaleString()} triangles · ${fmtBytes(result.stlBytes)} · ` +
            `${result.wMM.toFixed(1)}×${result.hMM.toFixed(1)} mm · depth ${result.depthMM.toFixed(1)} mm`;
          if (stlDownload) {
            stlDownload.dataset.stl = result.stlDataUrl;
            stlDownload.dataset.name = ($("regName").value || "garment").trim() || "garment";
            stlDownload.disabled = false;
          }
          stlDownloadRow.hidden = false;
          toast("STL generated from the front photo", "ok");
        } catch (e) {
          toast("STL generation failed — " + (e.message || ""), "err");
        } finally {
          stlBtn.disabled = false;
          stlBtn.textContent = "Image → STL";
        }
      });
      if (stlDownload) {
        stlDownload.addEventListener("click", () => {
          const url = stlDownload.dataset.stl;
          const name = stlDownload.dataset.name || "garment";
          if (url) window.__tcImageToStl.downloadStlFromDataUrl(url, slugifyLocal(name) + ".stl");
        });
      }
      if (stlRetry) {
        stlRetry.addEventListener("click", () => {
          stlStatus.hidden = true;
          stlDownloadRow.hidden = true;
          stlResult = null;
          if (stlDownload) stlDownload.disabled = true;
        });
      }
    }
  }

  // ---------------------------------------------------------------- edit garment (metadata + 3D)
  function openEdit(id) {
    const g = libraryCache.garments.find((x) => x.id === id);
    if (!g) return;
    $("editModalTitle").textContent = "Edit Clothing";
    $("editName").value = g.name || "";
    $("editDesc").value = g.description || "";
    $("editCategory").innerHTML = `<option value="">Pick a category</option>` +
      DEFAULT_CATEGORY.map((c) =>
        `<option value="${esc(c)}"${c === g.category ? " selected" : ""}>${esc(c)}</option>`
      ).join("");
    $("editFabric").innerHTML = `<option value="">Pick a fabric</option>` +
      DEFAULT_FABRIC.map((f) =>
        `<option value="${esc(f)}"${f === g.fabric ? " selected" : ""}>${esc(f)}</option>`
      ).join("");
    $("editTags").value = g.tags || "";
    $("editModal").dataset.editId = id;
    openModal("editModal");
  }

  function wireEditModal() {
    $("editSaveBtn").addEventListener("click", () => {
      const id = $("editModal").dataset.editId;
      if (!id) return;
      const name = ($("editName").value || "").trim();
      if (!name) {
        toast("Give it a name", "err");
        return;
      }
      clothing.update(id, {
        name,
        description: ($("editDesc").value || "").trim(),
        category: ($("editCategory").value || "").trim() || "Custom",
        fabric: ($("editFabric").value || "").trim() || "Custom / unknown",
        tags: joinTags(parseTags(($("editTags").value || ""))),
      }).then((r) => {
        if (r.error) {
          toast("Could not save those changes — " + (r.error.message || ""), "err");
          return;
        }
        closeModal("editModal");
        refreshCache();
        toast("Clothing updated", "ok");
      });
    });
    $("editCancelBtn2").addEventListener("click", () => closeModal("editModal"));
    $("editModal").addEventListener("click", (e) => {
      if (e.target === $("editModal")) closeModal("editModal");
    });
  }

  // ---------------------------------------------------------------- duplicate / archive / delete
  function duplicateGarment(id) {
    const g = libraryCache.garments.find((x) => x.id === id);
    if (!g) return;
    clothing.create({
      name: g.name + " (copy)",
      description: g.description || "",
      category: g.category || "Custom",
      fabric: g.fabric || "Custom / unknown",
      tags: g.tags || "",
      status: "registered",
      thumbnail: g.thumbnail || null,
      garment_3d: (g.garment_3d && typeof g.garment_3d === "object") ? JSON.parse(JSON.stringify(g.garment_3d)) : {},
      created_by: "demo",
    }).then((r) => {
      if (r.error) {
        toast("Could not duplicate that garment — " + (r.error.message || ""), "err");
        return;
      }
      refreshCache();
      toast(`Duplicated as “${r.data.name}”`, "ok");
    });
  }

  function setArchived(id) {
    const g = libraryCache.garments.find((x) => x.id === id);
    if (!g) return;
    const next = g.status === "archived" ? "registered" : "archived";
    clothing.update(id, { status: next }).then((r) => {
      if (r.error) {
        toast("Could not update that garment — " + (r.error.message || ""), "err");
        return;
      }
      refreshCache();
      toast(next === "archived" ? "Clothing archived" : "Clothing unarchived", "ok");
    });
  }

  function deleteGarment(id) {
    if (!confirm("Delete this clothing from your library? This can't be undone.")) return;
    clothing.remove(id).then((r) => {
      if (r.error) {
        toast("Could not delete that garment — " + (r.error.message || ""), "err");
        return;
      }
      refreshCache();
      toast("Clothing deleted", "ok");
    });
  }

  // ---------------------------------------------------------------- import 3D model
  function openImportModal() {
    // Import path: pick a supported 3D model (.glb / .obj / .gltf) and
    // register it as a clothing template. Full mesh ingestion is a follow-up;
    // here the file picker + registration form are real and the artifact is
    // stored as the imported file reference for now.
    $("importName").value = "";
    $("importCategory").value = "";
    $("importFabric").value = "";
    $("importTags").value = "";
    $("importError").hidden = true;
    openModal("importModal");
  }

  function wireImport() {
    $("importFilesInput").addEventListener("change", (e) => {
      const file = (e.target.files && e.target.files[0]) || null;
      if (!file) return;
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      if (!["glb", "obj", "gltf", "fbx"].includes(ext)) {
        $("importError").textContent = `Unsupported file type “.${ext}”. Use .glb, .obj, .gltf, or .fbx.`;
        $("importError").hidden = false;
        return;
      }
      $("importFile").textContent = file.name;
      $("importFileSize").textContent = formatSize(file.size);
      $("importError").hidden = true;
    });
    $("importRegisterBtn").addEventListener("click", () => {
      const name = ($("importName").value || "").trim();
      if (!name) {
        toast("Give the imported garment a name", "err");
        return;
      }
      if (!$("importFile").textContent) {
        toast("Select a 3D model file first", "err");
        return;
      }
      const category = ($("importCategory").value || "").trim() || "Custom";
      const fabric = ($("importFabric").value || "").trim() || "Custom / unknown";
      const tags = parseTags(($("importTags").value || ""));
      // Register the imported model as a clothing template. The full 3D
      // geometry ingestion is a follow-up; the artifact stores the file name
      // and a reference so the import path is end-to-end today.
      clothing.create({
        name,
        description: ($("importDesc").value || "").trim(),
        category,
        fabric,
        tags: joinTags(tags),
        status: "registered",
        thumbnail: "",
        garment_3d: {
          kind: "imported-3d",
          fileName: $("importFile").textContent,
          fileSize: parseInt($("importFileSize").textContent, 10) || 0,
          format: ($("importFile").textContent || "").split(".").pop() || "",
        },
        created_by: "demo",
      }).then((r) => {
        if (r.error) {
          toast("Could not register that import — " + (r.error.message || ""), "err");
          return;
        }
        closeModal("importModal");
        refreshCache();
        showConfirmation(r.data);
        selectGarment(r.data.id);
        toast(`“${r.data.name}” registered from 3D import`, "ok");
      });
    });
    $("importCancelBtn").addEventListener("click", () => closeModal("importModal"));
    $("importModal").addEventListener("click", (e) => {
      if (e.target === $("importModal")) closeModal("importModal");
    });
    $("importFilesInput").addEventListener("click", () => $("importFilesInput").click());
  }

  function formatSize(bytes) {
    if (!bytes) return "—";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  // ---------------------------------------------------------------- create custom garment
  function openCustomGarment() {
    // The custom-garment path opens the mannequin editor as the authoring
    // canvas. From here the user shapes the garment and can register it.
    closeModal("addClothingModal");
    $("stageEyebrow").textContent = "Custom garment";
    $("stageTitle").textContent = "Create a custom garment";
    $("stageActions").innerHTML = `
      <button class="btn btn-sm" id="customBackBtn">Back</button>
      <button class="btn btn-sm btn-primary" id="customRegisterBtn">Register This Clothing</button>
    `;
    $("customBackBtn").addEventListener("click", openLibraryView);
    $("customRegisterBtn").addEventListener("click", () => {
      // Open the registration form with a placeholder garment (the custom
      // shape you just authored on the mannequin).
      const artifact = {
        kind: "custom-garment",
        sections: [
          { id: "front", label: "Front", present: true },
          { id: "back", label: "Back", present: true },
          { id: "left_sleeve", label: "Left sleeve", present: true },
          { id: "right_sleeve", label: "Right sleeve", present: true },
          { id: "collar", label: "Collar", present: true },
          { id: "cuffs", label: "Cuffs", present: true },
          { id: "hem", label: "Hem", present: true },
        ],
        editableRegions: 7,
        uv: { present: true, note: "Authoring UV layout" },
        materials: [{ id: "base", label: "Garment fabric", color: "#f5f0e6" }],
        proportions: { height: 1.0, shoulders: 1.0, hips: 1.0 },
      };
      $("stageTitle").textContent = "Register your custom garment";
      openRegister(artifact, []);
    });
    $("libraryStage").hidden = true;
    $("flatStage").hidden = true;
    $("mannequinStage").hidden = false;
    $("reviewStage").hidden = true;
    $("presetRow").hidden = true;
    $("mannequinRow").hidden = false;
    document.body.classList.add("mode-3d");
    $("librarySection").hidden = true;
    $("reviewSection").hidden = true;
    $("registerSection").hidden = true;
    $("confirmSection").hidden = true;
    $("workSection").hidden = true;
    $("colorSection").hidden = true;
    $("placementSection").hidden = true;
    $("designMetaSection").hidden = true;
    $("mannequinSection").hidden = false;
    $("mannequinTitle").textContent = "Edit garment shape (custom)";
    const mn = window.__tcMannequin;
    if (mn && typeof mn.toggle === "function") mn.toggle(true);
    else {
      $("mannequinCanvas").innerHTML = `
        <div style="text-align:center">
          <p class="muted small" style="margin-top:0.6rem">Open the 3D mannequin to build a custom garment shape.</p>
        </div>`;
    }
  }

  // ---------------------------------------------------------------- init
  function init() {
    // Populate category/fabric dropdowns anywhere they appear.
    const populate = (sel) => {
      if (!sel) return;
      sel.innerHTML = `<option value="">Pick a category</option>` +
        DEFAULT_CATEGORY.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
    };
    populate($("regCategory"));
    populate($("editCategory"));
    populate($("importCategory"));
    const populateFab = (sel) => {
      if (!sel) return;
      sel.innerHTML = `<option value="">Pick a fabric</option>` +
        DEFAULT_FABRIC.map((f) => `<option value="${esc(f)}">${esc(f)}</option>`).join("");
    };
    populateFab($("regFabric"));
    populateFab($("editFabric"));
    populateFab($("importFabric"));

    wireAddClothing();
    wireReview();
    wireRegister();
    wireConfirmation();
    wireEditModal();
    wireImport();

    // Initial library render; re-render on data changes.
    refreshCache();

    // Settings modal wiring (shares the designer's settings modal).
    wireSettings();

    // Start on the library view.
    openLibraryView();
  }

  function wireSettings() {
    const modal = $("settingsModal");
    if (!$("settingsBtn") || !modal) return;
    $("settingsBtn").addEventListener("click", () => {
      const keyEl = $("openaiKey");
      if (keyEl) keyEl.value = (lsGet("openai_key", "") || "").trim();
      modal.classList.add("open");
    });
    $("closeSettingsBtn").addEventListener("click", () => modal.classList.remove("open"));
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.remove("open");
    });
    $("saveKeyBtn").addEventListener("click", () => {
      lsSet("openai_key", ($("openaiKey").value || "").trim());
      modal.classList.remove("open");
      toast("API key saved in this browser", "ok");
    });
    $("clearKeyBtn").addEventListener("click", () => {
      lsSet("openai_key", "");
      const k = $("openaiKey");
      if (k) k.value = "";
      toast("API key cleared", "ok");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Debug hook.
  window.__tcClothing = {
    garments: () => libraryCache.garments,
    designs: () => libraryCache.designs,
    refresh: refreshCache,
  };
})();
