/* Tribal Cruize — Design Studio
 *
 * Garment templates (hand-authored SVG), AI artwork generation (free keyless
 * service by default, optional OpenAI key), drag/scale/rotate placement with
 * background keying, PNG export, and localStorage project saves.
 */
(function () {
  "use strict";

  const { toast, money, esc, uid, lsGet, lsSet } = window.TC;

  /* ======================================================== garment templates */

  const PALETTE = [
    "#0e0d0b", "#f5f0e6", "#ff6b35", "#c9a227",
    "#2f6f4f", "#2b3a55", "#8a3d5b", "#6b4a2f",
  ];

  const GARMENTS = [
    {
      id: "tshirt",
      name: "T-Shirt",
      viewBox: "0 0 600 640",
      parts: [
        { id: "body", label: "Body", def: "#efe7d9" },
        { id: "trim", label: "Collar & trim", def: "#1b1a17" },
      ],
      print: { x: 175, y: 205, w: 250, h: 300 },
      paths: [
        { part: "body", clip: true, d: "M200 92 L136 118 L62 214 L134 268 L172 226 L172 556 Q300 584 428 556 L428 226 L466 268 L538 214 L464 118 L400 92 Q368 140 300 140 Q232 140 200 92 Z" },
        { part: "trim", d: "M196 88 Q232 142 300 142 Q368 142 404 88 L418 96 Q374 156 300 156 Q226 156 182 96 Z" },
        { part: "trim", d: "M172 538 Q300 566 428 538 L428 556 Q300 584 172 556 Z" },
        { part: "trim", d: "M62 214 L134 268 L139 251 L67 197 Z" },
        { part: "trim", d: "M538 214 L466 268 L461 251 L533 197 Z" },
      ],
    },
    {
      id: "hoodie",
      name: "Hoodie",
      viewBox: "0 0 600 640",
      parts: [
        { id: "body", label: "Body", def: "#2f6f4f" },
        { id: "hood", label: "Hood", def: "#286043" },
        { id: "pocket", label: "Pocket", def: "#286043" },
        { id: "trim", label: "Cuffs & strings", def: "#15140f" },
      ],
      print: { x: 190, y: 258, w: 220, h: 172 },
      paths: [
        { part: "body", clip: true, d: "M196 122 L120 154 L66 260 L142 308 L176 264 L176 566 Q300 594 424 566 L424 264 L458 308 L534 260 L480 154 L404 122 Q366 172 300 172 Q234 172 196 122 Z" },
        { part: "hood", d: "M196 122 Q300 54 404 122 Q424 194 398 232 Q350 268 300 268 Q250 268 202 232 Q176 194 196 122 Z" },
        { part: "pocket", d: "M214 436 L386 436 L404 530 L196 530 Z" },
        { part: "trim", d: "M176 546 Q300 576 424 546 L424 566 Q300 594 176 566 Z" },
        { part: "trim", d: "M66 260 L142 308 L128 330 L52 282 Z" },
        { part: "trim", d: "M534 260 L458 308 L472 330 L548 282 Z" },
        { part: "trim", stroke: true, sw: 7, d: "M278 240 L270 316" },
        { part: "trim", stroke: true, sw: 7, d: "M322 240 L330 316" },
      ],
    },
    {
      id: "cap",
      name: "Cap",
      viewBox: "0 0 600 640",
      parts: [
        { id: "crown", label: "Crown", def: "#15140f" },
        { id: "brim", label: "Brim", def: "#ff6b35" },
        { id: "trim", label: "Seams & button", def: "#f5f0e6" },
      ],
      print: { x: 178, y: 200, w: 244, h: 148 },
      paths: [
        { part: "crown", clip: true, d: "M132 356 A168 168 0 0 1 468 356 Z" },
        { part: "trim", stroke: true, sw: 3, d: "M300 190 L300 356" },
        { part: "trim", stroke: true, sw: 3, d: "M300 190 L192 356" },
        { part: "trim", stroke: true, sw: 3, d: "M300 190 L408 356" },
        { part: "trim", d: "M286 186 A14 14 0 1 1 314 186 A14 14 0 1 1 286 186 Z" },
        { part: "brim", d: "M108 352 Q300 326 492 352 Q544 388 514 424 Q430 466 300 466 Q170 466 86 424 Q56 388 108 352 Z" },
      ],
    },
    {
      id: "tote",
      name: "Tote Bag",
      viewBox: "0 0 600 640",
      parts: [
        { id: "body", label: "Bag", def: "#e8dcc8" },
        { id: "trim", label: "Top band", def: "#6b4a2f" },
        { id: "handles", label: "Handles", def: "#6b4a2f" },
      ],
      print: { x: 178, y: 248, w: 244, h: 288 },
      paths: [
        { part: "body", clip: true, d: "M166 198 L434 198 L444 566 L156 566 Z" },
        { part: "trim", d: "M165 198 L435 198 L436 226 L164 226 Z" },
        { part: "handles", stroke: true, sw: 20, d: "M232 202 C232 96 368 96 368 202" },
      ],
    },
    {
      id: "outfit",
      name: "Full Outfit",
      viewBox: "0 0 600 700",
      parts: [
        { id: "skin", label: "Skin", def: "#b57a4e" },
        { id: "top", label: "Top", def: "#f5f0e6" },
        { id: "pants", label: "Pants", def: "#2b3a55" },
        { id: "shoes", label: "Shoes", def: "#15140f" },
      ],
      print: { x: 236, y: 206, w: 128, h: 174 },
      paths: [
        { part: "skin", d: "M266 84 A34 34 0 1 1 334 84 A34 34 0 1 1 266 84 Z" },
        { part: "skin", d: "M286 110 L314 110 L314 154 L286 154 Z" },
        { part: "top", clip: true, d: "M242 150 L186 174 L156 300 L200 314 L214 252 L214 398 Q300 416 386 398 L386 252 L400 314 L444 300 L414 174 L358 150 Q334 180 300 180 Q266 180 242 150 Z" },
        { part: "pants", d: "M216 394 Q300 424 384 394 L384 638 L322 638 L300 470 L278 638 L216 638 Z" },
        { part: "shoes", d: "M206 634 L286 634 L288 668 Q246 682 200 668 Z" },
        { part: "shoes", d: "M314 634 L394 634 L400 668 Q354 682 312 668 Z" },
      ],
    },
  ];

  const STYLE_SUFFIX = {
    Tribal: "bold tribal tattoo art, tribal cruise style",
    Streetwear: "streetwear graphic tee artwork, urban graffiti energy",
    Geometric: "sacred geometry pattern, symmetrical mandala",
    Animal: "fierce animal portrait illustration",
    Skull: "edgy skull illustration, tattoo flash style",
  };

  /* ==================================================================== state */

  let state = {
    garment: "tshirt",
    colors: {},
    art: null, // {orig, src, size, x, y, rot, opacity, flip, natW, natH, keyOn, tol}
    style: "Tribal",
    name: "",
  };

  const $ = (id) => document.getElementById(id);
  const canvasBox = $("canvasBox");

  function garment() {
    return GARMENTS.find((g) => g.id === state.garment) || GARMENTS[0];
  }

  function colorsFor(g) {
    if (!state.colors[g.id]) {
      state.colors[g.id] = {};
      g.parts.forEach((p) => (state.colors[g.id][p.id] = p.def));
    }
    return state.colors[g.id];
  }

  function vbParts(g) {
    return g.viewBox.split(/\s+/).map(Number); // [0,0,w,h]
  }

  function artSize(g) {
    // art width as a fraction of the printable width
    const a = state.art;
    const w = g.print.w * a.size;
    const h = w * (a.natH / a.natW);
    return { w, h };
  }

  /* ================================================================== render */

  function pathMarkup(p, color) {
    const c = color || "#888";
    if (p.stroke) {
      return `<path d="${p.d}" fill="none" stroke="${c}" stroke-width="${p.sw || 8}" stroke-linecap="round"/>`;
    }
    return `<path d="${p.d}" fill="${c}"/>`;
  }

  function artMarkup() {
    const a = state.art;
    if (!a) return "";
    const g = garment();
    const { w, h } = artSize(g);
    const t = `translate(${a.x} ${a.y}) rotate(${a.rot}) scale(${a.flip ? -1 : 1} 1)`;
    return (
      `<g transform="${t}">` +
      `<image href="${a.src}" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" opacity="${a.opacity}" preserveAspectRatio="xMidYMid meet"/>` +
      `</g>`
    );
  }

  function svgMarkup(opts) {
    opts = opts || {};
    const g = garment();
    const colors = colorsFor(g);
    const shapes = g.paths.map((p) => pathMarkup(p, colors[p.part])).join("");
    const clipPaths = g.paths
      .filter((p) => p.clip)
      .map((p) => `<path d="${p.d}"/>`)
      .join("");
    const art = opts.noArt ? "" : artMarkup();
    const artGroup = art
      ? `<g clip-path="url(#tcGC)"><g clip-path="url(#tcPC)">${art}</g></g>`
      : "";
    return (
      `<svg viewBox="${g.viewBox}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${g.name} mockup">` +
      `<defs>` +
      `<clipPath id="tcGC">${clipPaths}</clipPath>` +
      `<clipPath id="tcPC"><rect x="${g.print.x}" y="${g.print.y}" width="${g.print.w}" height="${g.print.h}"/></clipPath>` +
      `</defs>` +
      shapes +
      artGroup +
      `</svg>`
    );
  }

  function renderCanvas() {
    canvasBox.innerHTML = svgMarkup();
    canvasBox.classList.toggle("has-art", Boolean(state.art));
    $("garmentTitle").textContent = garment().name;
    $("placementSection").hidden = !state.art;
    $("clearArtBtn").disabled = !state.art;
    $("undoBtn").disabled = !state.art;
  }

  function renderRail() {
    const rail = $("toolRail");
    rail.innerHTML = GARMENTS.map((g) => {
      const colors = colorsFor(g);
      const mini = g.paths
        .filter((p) => !p.stroke)
        .map((p) => pathMarkup(p, colors[p.part]))
        .join("");
      return (
        `<button class="garment-btn ${g.id === state.garment ? "active" : ""}" data-garment="${g.id}">` +
        `<svg viewBox="${g.viewBox}">${mini}</svg><span>${g.name}</span></button>`
      );
    }).join("");
    rail.querySelectorAll(".garment-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.garment = btn.dataset.garment;
        const g = garment();
        if (state.art) {
          state.art.x = g.print.x + g.print.w / 2;
          state.art.y = g.print.y + g.print.h / 2;
        }
        renderAll();
      });
    });
  }

  function renderColors() {
    const g = garment();
    const colors = colorsFor(g);
    $("colorControls").innerHTML =
      g.parts
        .map(
          (p) =>
            `<div class="color-row" data-part="${p.id}">` +
            `<span>${p.label}</span>` +
            `<input type="color" value="${colors[p.id]}" data-color="${p.id}" />` +
            `</div>` +
            `<div class="swatches" data-for="${p.id}">` +
            PALETTE.map(
              (c) => `<button class="swatch" style="background:${c}" data-swatch="${c}" data-target="${p.id}" title="${c}"></button>`
            ).join("") +
            `</div>`
        )
        .join("");

    $("colorControls").querySelectorAll("input[type=color]").forEach((inp) => {
      inp.addEventListener("input", () => {
        colorsFor(g)[inp.dataset.color] = inp.value;
        renderCanvas();
        renderRail();
      });
    });
    $("colorControls").querySelectorAll(".swatch").forEach((sw) => {
      sw.addEventListener("click", () => {
        colorsFor(g)[sw.dataset.target] = sw.dataset.swatch;
        renderColors();
        renderCanvas();
        renderRail();
      });
    });
  }

  function renderPlacement() {
    const a = state.art;
    if (!a) return;
    $("sizeRange").value = a.size;
    $("rotRange").value = a.rot;
    $("opacityRange").value = a.opacity;
    $("flipCheck").checked = a.flip;
    $("bgKeyCheck").checked = a.keyOn;
    $("tolRange").value = a.tol;
    $("sizeVal").textContent = Math.round(a.size * 100) + "%";
    $("rotVal").textContent = a.rot + "°";
    $("opacityVal").textContent = Math.round(a.opacity * 100) + "%";
    $("tolVal").textContent = a.tol;
    $("toleranceWrap").style.opacity = a.keyOn ? "1" : "0.4";
  }

  function renderSaves() {
    const saves = lsGet("designs", []);
    const list = $("saveList");
    if (!saves.length) {
      list.innerHTML = `<li class="muted small" style="border-style:dashed">No saved designs yet.</li>`;
      return;
    }
    list.innerHTML = saves
      .sort((a, b) => b.updated - a.updated)
      .map(
        (s) =>
          `<li><span class="save-name">${esc(s.name)}</span>` +
          `<button class="mini-btn" data-load="${s.id}">Load</button>` +
          `<button class="mini-btn del" data-del="${s.id}">✕</button></li>`
      )
      .join("");
    list.querySelectorAll("[data-load]").forEach((b) =>
      b.addEventListener("click", () => loadDesign(b.dataset.load))
    );
    list.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", () => deleteDesign(b.dataset.del))
    );
  }

  function renderAll() {
    renderRail();
    renderColors();
    renderCanvas();
    renderPlacement();
  }

  /* ================================================================== canvas */

  let drag = null;

  function pointerToVB(e) {
    const svg = canvasBox.querySelector("svg");
    const r = svg.getBoundingClientRect();
    const [, , vw, vh] = vbParts(garment());
    return {
      x: ((e.clientX - r.left) / r.width) * vw,
      y: ((e.clientY - r.top) / r.height) * vh,
    };
  }

  canvasBox.addEventListener("pointerdown", (e) => {
    if (!state.art) return;
    const p = pointerToVB(e);
    drag = { dx: state.art.x - p.x, dy: state.art.y - p.y };
    canvasBox.classList.add("dragging");
    canvasBox.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  canvasBox.addEventListener("pointermove", (e) => {
    if (!drag || !state.art) return;
    const p = pointerToVB(e);
    const g = garment();
    const a = state.art;
    a.x = clamp(p.x + drag.dx, g.print.x, g.print.x + g.print.w);
    a.y = clamp(p.y + drag.dy, g.print.y, g.print.y + g.print.h);
    renderCanvas();
  });
  ["pointerup", "pointercancel"].forEach((ev) =>
    canvasBox.addEventListener(ev, () => {
      drag = null;
      canvasBox.classList.remove("dragging");
    })
  );

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  /* ============================================= artwork: generate / upload */

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not load image"));
      img.src = src;
    });
  }

  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }

  async function downscale(dataUrl, max) {
    try {
      const img = await loadImage(dataUrl);
      if (img.naturalWidth <= max && img.naturalHeight <= max) return dataUrl;
      const ratio = Math.min(max / img.naturalWidth, max / img.naturalHeight);
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * ratio);
      c.height = Math.round(img.naturalHeight * ratio);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL("image/png");
    } catch (e) {
      return dataUrl;
    }
  }

  /* The image service blocks cross-origin browser requests (Origin header ->
   * "Missing Turnstile token"), so browser-direct calls only work as a last
   * resort. Preferred routes, in order:
   *   1. user's own OpenAI key
   *   2. configured Supabase edge function (image-generate) — production
   *   3. local dev-server proxy (/api/image) — this repo's dev server
   *   4. direct call — may be refused by the service
   */
  function isLocalHost() {
    return ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  }

  async function fetchImage(url) {
    const res = await fetch(url);
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !type.startsWith("image/")) {
      throw new Error(
        res.status === 402 || res.status === 429
          ? "Free image quota reached (HTTP " + res.status + ")"
          : `Image service error (HTTP ${res.status})`
      );
    }
    return blobToDataURL(await res.blob());
  }

  function proxyGenerate(prompt) {
    return fetchImage(
      `/api/image?prompt=${encodeURIComponent(prompt)}&w=1024&h=1024`
    );
  }

  async function edgeGenerate(prompt) {
    const cfg = window.TC.config;
    const session = window.TC.sb && (await window.TC.sb.auth.getSession());
    const token =
      (session && session.data && session.data.session && session.data.session.access_token) ||
      cfg.supabaseAnonKey;
    const res = await fetch(`${cfg.supabaseUrl}/functions/v1/image-generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: cfg.supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || `Backend image error (HTTP ${res.status})`);
    }
    return blobToDataURL(await res.blob());
  }

  async function pollinationsGenerate(prompt) {
    const seed = Math.floor(Math.random() * 1e9);
    return fetchImage(
      "https://image.pollinations.ai/prompt/" +
        encodeURIComponent(prompt) +
        `?width=1024&height=1024&nologo=true&seed=${seed}`
    );
  }

  async function withRetry(fn, prompt, tries) {
    let lastErr = null;
    for (let i = 0; i < tries; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1200 * i));
      try {
        return await fn(prompt);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  }

  async function generateArt(prompt) {
    const providers = [];
    if (getOpenAIKey()) providers.push({ fn: openaiGenerate, tries: 1 });
    if (window.TC.config.supabaseUrl) providers.push({ fn: edgeGenerate, tries: 2 });
    if (isLocalHost()) providers.push({ fn: proxyGenerate, tries: 3 });
    providers.push({ fn: pollinationsGenerate, tries: 3 });

    let lastErr = null;
    for (const p of providers) {
      try {
        return await withRetry(p.fn, prompt, p.tries);
      } catch (e) {
        lastErr = e;
      }
    }
    throw new Error(
      (lastErr && lastErr.message ? lastErr.message + " " : "") +
        "The image service is unavailable right now — try again shortly, or add an " +
        "OpenAI API key in Settings for reliable generations."
    );
  }

  async function openaiGenerate(prompt) {
    const key = getOpenAIKey();
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
        output_format: "png",
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((json.error && json.error.message) || `OpenAI error (HTTP ${res.status})`);
    }
    const b64 = json.data && json.data[0] && json.data[0].b64_json;
    if (!b64) throw new Error("OpenAI returned no image");
    return "data:image/png;base64," + b64;
  }

  function buildPrompt() {
    const base = ($("promptInput").value || "").trim() || "a tribal cruising eagle";
    return `${base}, ${STYLE_SUFFIX[state.style] || ""}, high contrast, flat graphic design, centered composition, isolated on plain white background, no text, no watermark`;
  }

  async function generate() {
    const btn = $("generateBtn");
    const errBox = $("genError");
    errBox.hidden = true;
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = "Generating…";
    try {
      const prompt = buildPrompt();
      const raw = await generateArt(prompt);
      await setArt(await downscale(raw, 1024));
      toast("Design generated", "ok");
    } catch (err) {
      errBox.textContent =
        (err && err.message) || "Generation failed — try again or upload an image.";
      errBox.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  async function setArt(dataUrl) {
    const img = await loadImage(dataUrl);
    const g = garment();
    state.art = {
      orig: dataUrl,
      src: dataUrl,
      size: 0.75,
      x: g.print.x + g.print.w / 2,
      y: g.print.y + g.print.h / 2,
      rot: 0,
      opacity: 1,
      flip: false,
      natW: img.naturalWidth || 1024,
      natH: img.naturalHeight || 1024,
      keyOn: true,
      tol: 44,
    };
    await refreshKeyedArt();
    renderCanvas();
    renderPlacement();
  }

  /* ------------------------------------------------- background keying (cutout) */

  let keyToken = 0;
  async function refreshKeyedArt() {
    const a = state.art;
    if (!a) return;
    if (!a.keyOn) {
      a.src = a.orig;
      renderCanvas();
      return;
    }
    const token = ++keyToken;
    try {
      const keyed = await keyOut(a.orig, a.tol);
      if (token !== keyToken || !state.art) return;
      a.src = keyed;
      renderCanvas();
    } catch (e) {
      a.src = a.orig;
    }
  }

  async function keyOut(dataUrl, tol) {
    const img = await loadImage(dataUrl);
    const max = 1024;
    const ratio = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * ratio);
    c.height = Math.round(img.naturalHeight * ratio);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const imageData = ctx.getImageData(0, 0, c.width, c.height);
    const d = imageData.data;
    const W = c.width, H = c.height;

    // Background reference = average of the four corners.
    const corners = [0, (W - 1) * 4, (H - 1) * W * 4, ((H - 1) * W + W - 1) * 4];
    let br = 0, bg = 0, bb = 0;
    corners.forEach((i) => { br += d[i]; bg += d[i + 1]; bb += d[i + 2]; });
    br /= 4; bg /= 4; bb /= 4;

    const limit = tol * 2.2; // euclidean distance threshold
    const visited = new Uint8Array(W * H);
    const stack = [];
    for (let x = 0; x < W; x++) { stack.push(x); stack.push((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { stack.push(y * W); stack.push(y * W + W - 1); }

    while (stack.length) {
      const px = stack.pop();
      if (visited[px]) continue;
      visited[px] = 1;
      const i = px * 4;
      const dr = d[i] - br, dg = d[i + 1] - bg, db = d[i + 2] - bb;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist > limit) continue;
      d[i + 3] = 0;
      const x = px % W, y = (px / W) | 0;
      if (x > 0) stack.push(px - 1);
      if (x < W - 1) stack.push(px + 1);
      if (y > 0) stack.push(px - W);
      if (y < H - 1) stack.push(px + W);
    }
    ctx.putImageData(imageData, 0, 0);
    return c.toDataURL("image/png");
  }

  /* ================================================================== export */

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function exportPNG() {
    const btn = $("exportBtn");
    btn.disabled = true;
    try {
      const g = garment();
      const [,, vw, vh] = vbParts(g);
      const scale = Math.min(2400 / Math.max(vw, vh), 4);
      const c = document.createElement("canvas");
      c.width = Math.round(vw * scale);
      c.height = Math.round(vh * scale);
      const ctx = c.getContext("2d");

      // 1. garment base (no artwork)
      const svgStr = svgMarkup({ noArt: true });
      const svgUrl = URL.createObjectURL(new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" }));
      const base = await loadImage(svgUrl);
      ctx.drawImage(base, 0, 0, c.width, c.height);
      URL.revokeObjectURL(svgUrl);

      // 2. artwork composited with canvas transforms (never taints the canvas)
      if (state.art) {
        const a = state.art;
        const art = await loadImage(a.src);
        const { w, h } = artSize(g);
        ctx.save();
        ctx.translate(a.x * scale, a.y * scale);
        ctx.rotate((a.rot * Math.PI) / 180);
        ctx.scale(a.flip ? -1 : 1, 1);
        ctx.globalAlpha = a.opacity;
        ctx.drawImage(art, (-w / 2) * scale, (-h / 2) * scale, w * scale, h * scale);
        ctx.restore();
      }

      const blob = await new Promise((resolve) => c.toBlob(resolve, "image/png"));
      const name =
        ($("designName").value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") ||
        "design";
      downloadBlob(blob, `tribal-cruize-${g.id}-${name}.png`);
      toast("PNG downloaded", "ok");
      return blob;
    } catch (e) {
      toast("Export failed: " + (e.message || e), "err");
    } finally {
      btn.disabled = false;
    }
  }

  /* =================================================================== saves */

  function saveDesign() {
    const name = ($("designName").value || "").trim() || "Untitled design";
    const saves = lsGet("designs", []);
    const record = {
      id: uid(),
      name,
      garment: state.garment,
      colors: JSON.parse(JSON.stringify(state.colors)),
      art: state.art
        ? {
            orig: state.art.orig,
            size: state.art.size,
            x: state.art.x,
            y: state.art.y,
            rot: state.art.rot,
            opacity: state.art.opacity,
            flip: state.art.flip,
            natW: state.art.natW,
            natH: state.art.natH,
            keyOn: state.art.keyOn,
            tol: state.art.tol,
          }
        : null,
      updated: Date.now(),
    };
    saves.push(record);
    if (lsSet("designs", saves)) {
      state.name = name;
      renderSaves();
      toast(`Saved "${name}"`, "ok");
    }
  }

  async function loadDesign(id) {
    const saves = lsGet("designs", []);
    const s = saves.find((x) => x.id === id);
    if (!s) return;
    state.garment = s.garment;
    state.colors = s.colors || {};
    state.art = s.art ? Object.assign({}, s.art, { src: s.art.orig }) : null;
    $("designName").value = s.name;
    renderAll();
    await refreshKeyedArt();
    renderPlacement();
    toast(`Loaded "${s.name}"`, "ok");
  }

  function deleteDesign(id) {
    const saves = lsGet("designs", []).filter((x) => x.id !== id);
    lsSet("designs", saves);
    renderSaves();
    toast("Design deleted");
  }

  /* ================================================================ settings */

  function getOpenAIKey() {
    return (lsGet("openai_key", "") || "").trim();
  }

  function wireSettings() {
    const modal = $("settingsModal");
    $("settingsBtn").addEventListener("click", () => {
      $("openaiKey").value = getOpenAIKey();
      modal.classList.add("open");
    });
    $("closeSettingsBtn").addEventListener("click", () => modal.classList.remove("open"));
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.remove("open");
    });
    $("saveKeyBtn").addEventListener("click", () => {
      lsSet("openai_key", $("openaiKey").value.trim());
      modal.classList.remove("open");
      toast("API key saved in this browser", "ok");
    });
    $("clearKeyBtn").addEventListener("click", () => {
      lsSet("openai_key", "");
      $("openaiKey").value = "";
      toast("API key cleared");
    });
  }

  /* =================================================================== wire */

  function wire() {
    // generation
    $("generateBtn").addEventListener("click", generate);
    $("promptInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
    });
    $("styleChips").querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        state.style = chip.dataset.style;
        $("styleChips").querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
      });
    });

    // upload
    $("uploadBtn").addEventListener("click", () => $("uploadInput").click());
    $("uploadInput").addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const dataUrl = await blobToDataURL(file);
        await setArt(await downscale(dataUrl, 1024));
        toast("Image loaded", "ok");
      } catch (err) {
        toast("Could not read that image", "err");
      }
      e.target.value = "";
    });

    // placement controls
    const bindRange = (id, prop, fmt, after) => {
      $(id).addEventListener("input", () => {
        if (!state.art) return;
        state.art[prop] = parseFloat($(id).value);
        renderPlacement();
        renderCanvas();
        if (after) after();
      });
    };
    bindRange("sizeRange", "size");
    bindRange("rotRange", "rot");
    bindRange("opacityRange", "opacity");

    $("flipCheck").addEventListener("change", () => {
      if (!state.art) return;
      state.art.flip = $("flipCheck").checked;
      renderCanvas();
    });

    let keyDebounce = null;
    $("bgKeyCheck").addEventListener("change", () => {
      if (!state.art) return;
      state.art.keyOn = $("bgKeyCheck").checked;
      renderPlacement();
      refreshKeyedArt();
    });
    $("tolRange").addEventListener("input", () => {
      if (!state.art) return;
      state.art.tol = parseInt($("tolRange").value, 10);
      renderPlacement();
      clearTimeout(keyDebounce);
      keyDebounce = setTimeout(refreshKeyedArt, 220);
    });

    // presets
    $("presetRow").querySelectorAll("[data-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!state.art) return;
        const g = garment();
        const a = state.art;
        const p = btn.dataset.preset;
        if (p === "left") {
          a.x = g.print.x + g.print.w * 0.3;
          a.y = g.print.y + g.print.h * 0.3;
          a.size = 0.32;
        } else if (p === "center") {
          a.x = g.print.x + g.print.w / 2;
          a.y = g.print.y + g.print.h * 0.45;
          a.size = 0.7;
        } else {
          a.x = g.print.x + g.print.w / 2;
          a.y = g.print.y + g.print.h / 2;
          a.size = 0.98;
        }
        renderPlacement();
        renderCanvas();
      });
    });

    // toolbar
    $("undoBtn").addEventListener("click", () => {
      if (!state.art) return;
      const g = garment();
      const a = state.art;
      a.x = g.print.x + g.print.w / 2;
      a.y = g.print.y + g.print.h / 2;
      a.size = 0.75;
      a.rot = 0;
      a.opacity = 1;
      a.flip = false;
      renderPlacement();
      renderCanvas();
    });
    $("clearArtBtn").addEventListener("click", () => {
      state.art = null;
      renderCanvas();
      renderPlacement();
    });

    // save / export
    $("saveBtn").addEventListener("click", saveDesign);
    $("exportBtn").addEventListener("click", exportPNG);

    wireSettings();
  }

  /* =================================================================== init */

  renderAll();
  renderSaves();
  wire();

  // Test/debug hook (used by automated verification).
  window.__tcDesign = {
    exportPNG,
    generate,
    state: () => state,
    colors: () => state.colors,
    garment,
  };
})();
