(function () {
  "use strict";
  const TC = window.TC; const $ = (id) => document.getElementById(id); const key = "tc_messages_demo";
  let threads = []; let selected = "";
  function load() { try { threads = JSON.parse(localStorage.getItem(key) || "[]"); } catch (_) { threads = []; } }
  function save() { try { localStorage.setItem(key, JSON.stringify(threads)); } catch (_) { TC.toast("Could not save this message on this device", "err"); } }
  function renderThreads() {
    const root = $("conversationList");
    if (!threads.length) { root.innerHTML = '<p class="muted small">No conversations yet. Message history will appear here.</p>'; return; }
    root.innerHTML = threads.map((t) => `<button class="conversation ${t.id === selected ? "selected" : ""}" data-thread="${TC.esc(t.id)}"><span class="chat-avatar">${TC.esc((t.name || "TC").slice(0,2).toUpperCase())}</span><span><strong>${TC.esc(t.name)}</strong><small>${TC.esc((t.messages[t.messages.length - 1] || {}).text || "Start a conversation")}</small></span></button>`).join("");
    root.querySelectorAll("[data-thread]").forEach((b) => b.addEventListener("click", () => { selected = b.dataset.thread; renderThreads(); renderMessages(); }));
  }
  function renderMessages() {
    const thread = threads.find((t) => t.id === selected); if (!thread) return;
    $("chatTitle").textContent = thread.name; $("chatSubtitle").textContent = "Local demo conversation";
    $("chatMessages").innerHTML = thread.messages.map((m) => `<div class="chat-bubble ${m.mine ? "mine" : "theirs"}"><p>${TC.esc(m.text)}</p><time>${TC.esc(new Date(m.time).toLocaleString())}</time></div>`).join("");
    $("chatMessages").scrollTop = $("chatMessages").scrollHeight;
  }
  $("messageForm").addEventListener("submit", (event) => {
    event.preventDefault(); const text = $("messageInput").value.trim(); if (!text) return;
    if (!selected) { const thread = { id: "community", name: "Tribal Cruize Market", messages: [] }; threads.push(thread); selected = thread.id; }
    const thread = threads.find((t) => t.id === selected); thread.messages.push({ text, time: Date.now(), mine: true });
    $("messageInput").value = ""; save(); renderThreads(); renderMessages();
  });
  load(); renderThreads();
})();
