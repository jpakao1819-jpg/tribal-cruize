/* Tribal Cruize — shared runtime (config, storage adapter, auth, helpers).
 *
 * Runs against Supabase when configured, otherwise falls back to DEMO MODE
 * backed by localStorage so every screen works before accounts exist.
 */
(function () {
  "use strict";

  const CFG = (window.TC_CONFIG = window.TC_CONFIG || {});
  const LS_PREFIX = "tc_v" + (CFG.storageVersion || 1) + "_";

  // ---------------------------------------------------------------- supabase
  const hasBackend =
    Boolean(CFG.supabaseUrl) &&
    Boolean(CFG.supabaseAnonKey) &&
    typeof window.supabase !== "undefined";

  const sb = hasBackend
    ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey)
    : null;

  // ------------------------------------------------------------ local helpers
  function lsGet(key, fallback) {
    try {
      const raw = localStorage.getItem(LS_PREFIX + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function lsSet(key, value) {
    try {
      localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      toast("Storage full — could not save.", "err");
      return false;
    }
  }

  function uid() {
    return (crypto.randomUUID && crypto.randomUUID()) ||
      "id_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // -------------------------------------------------------------- UI helpers
  let toastTimer = null;
  function toast(msg, kind) {
    let el = document.getElementById("tcToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "tcToast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = "";
    if (kind) el.classList.add(kind);
    requestAnimationFrame(() => el.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
  }

  // Amounts are always stored in PGK cents (Papua New Guinea Kina is the
  // base currency). The display currency can be switched to USD in the header.
  function currency() {
    return lsGet("currency", CFG.currency || "PGK");
  }

  function setCurrency(code) {
    lsSet("currency", code);
    location.reload();
  }

  function money(cents) {
    const total = cents || 0;
    const cur = currency();
    let value = total;
    if (cur !== (CFG.currency || "PGK")) {
      const rate = (CFG.fx && CFG.fx[cur]) || 1;
      value = Math.round(total * rate);
    }
    if (cur === "PGK") {
      const num = (value / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/, " ");
      return "K" + num;
    }
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: cur,
      }).format(value / 100);
    } catch (e) {
      return (value / 100).toFixed(2) + " " + cur;
    }
  }

  // Human-friendly payment reference, e.g. "TC-8F3K2A".
  function reference() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 6; i++) {
      s += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return "TC-" + s;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }

  // --------------------------------------------------------------- demo mode
  // Same async API as the Supabase adapter so pages can branch once.
  const demoTables = {
    list(table) {
      return lsGet("t_" + table, []);
    },
    save(table, rows) {
      lsSet("t_" + table, rows);
    },
  };

  function demoFilter(rows, match) {
    if (!match) return rows;
    return rows.filter((r) =>
      Object.keys(match).every((k) => r[k] === match[k])
    );
  }

  // ---------------------------------------------------------- data adapter
  const db = {
    demo: !sb,

    async list(table, opts) {
      opts = opts || {};
      if (!sb) {
        let rows = demoFilter(demoTables.list(table), opts.eq);
        if (opts.order) {
          rows = rows.slice().sort((a, b) => {
            const av = a[opts.order], bv = b[opts.order];
            if (av === bv) return 0;
            return (av > bv ? 1 : -1) * (opts.desc ? -1 : 1);
          });
        }
        return { data: rows, error: null };
      }
      let q = sb.from(table).select(opts.select || "*");
      if (opts.eq) {
        Object.keys(opts.eq).forEach((k) => (q = q.eq(k, opts.eq[k])));
      }
      if (opts.order) q = q.order(opts.order, { ascending: !opts.desc });
      if (opts.limit) q = q.limit(opts.limit);
      const { data, error } = await q;
      return { data: data || [], error };
    },

    async insert(table, row) {
      if (!sb) {
        const rows = demoTables.list(table);
        const full = Object.assign({ id: uid(), created_at: new Date().toISOString() }, row);
        rows.push(full);
        demoTables.save(table, rows);
        return { data: full, error: null };
      }
      const { data, error } = await sb.from(table).insert(row).select().single();
      return { data, error };
    },

    async update(table, patch, match) {
      if (!sb) {
        const rows = demoTables.list(table);
        let changed = null;
        rows.forEach((r) => {
          if (Object.keys(match).every((k) => r[k] === match[k])) {
            Object.assign(r, patch);
            changed = r;
          }
        });
        demoTables.save(table, rows);
        return { data: changed, error: changed ? null : { message: "not found" } };
      }
      let q = sb.from(table).update(patch);
      Object.keys(match).forEach((k) => (q = q.eq(k, match[k])));
      const { data, error } = await q.select();
      return { data: (data && data[0]) || null, error };
    },

    async remove(table, match) {
      if (!sb) {
        const rows = demoTables.list(table);
        demoTables.save(
          table,
          rows.filter((r) => !Object.keys(match).every((k) => r[k] === match[k]))
        );
        return { error: null };
      }
      let q = sb.from(table).delete();
      Object.keys(match).forEach((k) => (q = q.eq(k, match[k])));
      const { error } = await q;
      return { error };
    },
  };

  // ------------------------------------------------------------------- auth
  const auth = {
    async getUser() {
      if (!sb) return { user: lsGet("demo_user", null), error: null };
      const { data, error } = await sb.auth.getUser();
      return { user: data && data.user, error };
    },

    async signIn(email, password) {
      if (!sb) {
        const user = { id: "demo_" + email, email };
        lsSet("demo_user", user);
        return { user, error: null };
      }
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      return { user: data && data.user, error };
    },

    async signUp(email, password) {
      if (!sb) {
        const user = { id: "demo_" + email, email };
        lsSet("demo_user", user);
        return { user, error: null };
      }
      const { data, error } = await sb.auth.signUp({ email, password });
      if (!error && data && data.session === null) {
        return { user: data.user, needsConfirm: true, error: null };
      }
      return { user: data && data.user, error };
    },

    async signOut() {
      if (!sb) {
        localStorage.removeItem(LS_PREFIX + "demo_user");
        return { error: null };
      }
      const { error } = await sb.auth.signOut();
      return { error };
    },
  };

  // ---------------------------------------------------------------- uploads
  async function upload(bucket, path, file) {
    if (!sb) {
      // Demo mode: store the file as a data URL and hand it straight back.
      const dataUrl = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(file);
      });
      return { url: dataUrl, error: null };
    }
    const { error } = await sb.storage
      .from(bucket)
      .upload(path, file, { upsert: true });
    if (error) return { url: null, error };
    const { data } = sb.storage.from(bucket).getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  }

  // --------------------------------------------------------- page chrome
  function chrome() {
    // Mobile nav
    const toggle = document.querySelector(".menu-toggle");
    const links = document.getElementById("navLinks");
    if (toggle && links) {
      toggle.addEventListener("click", () => {
        const open = links.classList.toggle("open");
        toggle.setAttribute("aria-expanded", String(open));
      });
    }
    // Footer year
    document.querySelectorAll("[data-year]").forEach((el) => {
      el.textContent = new Date().getFullYear();
    });
    // Demo banner
    if (!sb && CFG.supabaseUrl === "") {
      const b = document.createElement("div");
      b.className = "demo-banner";
      b.textContent =
        "Demo mode — backend not connected yet. Data lives in this browser only. See supabase/ to go live.";
      document.body.prepend(b);
    }
    // Currency toggle (PGK <-> USD), injected so every page gets it.
    const nav = document.getElementById("navLinks");
    if (nav && CFG.currencyToggle && CFG.fx && Object.keys(CFG.fx).length > 1) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.className = "button btn-sm";
      btn.id = "tcCurrencyBtn";
      btn.textContent = currency();
      btn.title = "Switch display currency (prices are set in Kina)";
      btn.addEventListener("click", () =>
        setCurrency(currency() === "PGK" ? "USD" : "PGK")
      );
      li.appendChild(btn);
      nav.appendChild(li);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", chrome);
  } else {
    chrome();
  }

  window.TC = {
    config: CFG,
    sb,
    demo: !sb,
    db,
    auth,
    upload,
    toast,
    money,
    currency,
    setCurrency,
    reference,
    esc,
    qs,
    lsGet,
    lsSet,
    uid,
  };
})();
