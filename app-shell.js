/* Shared Tribal Cruize navigation, account menu and notification popover. */
(function () {
  "use strict";
  function boot() {
    const TC = window.TC;
    const nav = document.getElementById("navLinks");
    if (!TC || !nav || nav.dataset.tcShell === "ready") return;
    nav.dataset.tcShell = "ready";
    const links = [
      ["Market", "shop.html"],
      ["3D Studio", "designer.html"],
      ["My Designs", "designs.html"],
      ["My Stall", "vendor.html"],
      ["Orders", "orders.html"],
      ["Messages", "messages.html"],
    ];
    const here = location.pathname.split("/").pop() || "tribal-cruize.html";
    links.forEach(([label, href]) => {
      if (Array.from(nav.querySelectorAll("a")).some((a) => a.getAttribute("href") === href)) return;
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = href;
      a.textContent = label;
      if ((href === "shop.html" && here === "shop.html") || (href === "designer.html" && here === "designer.html") || (href === here)) {
        a.classList.add("active");
        a.setAttribute("aria-current", "page");
      }
      li.appendChild(a);
      nav.appendChild(li);
    });

    const tools = document.createElement("li");
    tools.className = "tc-shell-tools";
    tools.innerHTML = '<button class="button btn-sm tc-icon-button" type="button" aria-label="Notifications" aria-expanded="false" data-notification-toggle>♧<span class="tc-notification-dot" hidden></span></button><div class="tc-popover tc-notification-popover" data-notification-panel hidden><strong>Notifications</strong><p class="muted small">Order and message updates will appear here.</p><a class="text-link" href="orders.html">View orders →</a></div><a class="tc-account-link" href="account.html" data-account-link>Account</a>';
    nav.appendChild(tools);

    const toggle = tools.querySelector("[data-notification-toggle]");
    const panel = tools.querySelector("[data-notification-panel]");
    toggle.addEventListener("click", () => {
      const open = panel.hidden;
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", (event) => {
      if (!tools.contains(event.target)) {
        panel.hidden = true;
        toggle.setAttribute("aria-expanded", "false");
      }
    });
    TC.auth.getUser().then(({ user }) => {
      if (!user) return;
      const account = tools.querySelector("[data-account-link]");
      const name = user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name);
      account.textContent = name || user.email || "My account";
      account.setAttribute("aria-label", "Account: " + (user.email || name || "signed in"));
    }).catch(() => {});

    if (!document.getElementById("tcAppShellStyles")) {
      const style = document.createElement("link");
      style.id = "tcAppShellStyles";
      style.rel = "stylesheet";
      style.href = "app-shell.css";
      document.head.appendChild(style);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
