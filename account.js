(function () {
  "use strict";
  const TC = window.TC; const $ = (id) => document.getElementById(id); let user = null;
  function readProfile() { return TC.lsGet("profile", {}); }
  function setMessage(message, kind) { const el = $("accountMessage"); el.textContent = message; el.className = "muted small" + (kind ? " " + kind : ""); }
  function render() {
    const profile = readProfile(); const metadata = (user && user.user_metadata) || {};
    const name = profile.name || metadata.full_name || metadata.name || "Welcome";
    $("profileName").textContent = name;
    $("profileEmail").textContent = user ? user.email || "Signed in" : "Sign in to sync your account across devices.";
    $("profileAvatar").textContent = (name || "TC").slice(0, 2).toUpperCase();
    $("displayName").value = profile.name || metadata.full_name || metadata.name || "";
    $("phone").value = profile.phone || ""; $("location").value = profile.location || "";
    $("signOutBtn").hidden = !user;
  }
  $("saveProfileBtn").addEventListener("click", async () => {
    const profile = { name: $("displayName").value.trim(), phone: $("phone").value.trim(), location: $("location").value.trim() };
    if (user && TC.sb) {
      const { error } = await TC.sb.auth.updateUser({ data: { full_name: profile.name, phone: profile.phone, location: profile.location } });
      if (error) return setMessage("Profile update failed: " + error.message, "err");
    }
    TC.lsSet("profile", profile); render(); setMessage(user ? "Profile saved to your account." : "Profile saved on this browser. Sign in to sync it across devices.", "ok");
  });
  $("googleSignInBtn").addEventListener("click", async () => {
    if (!TC.sb) return setMessage("Google sign-in is not available in demo mode. Configure the Supabase project and Google OAuth provider first.", "err");
    const { error } = await TC.sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.href.split("?")[0] } });
    if (error) setMessage("Google sign-in failed: " + error.message, "err");
  });
  $("signOutBtn").addEventListener("click", async () => { await TC.auth.signOut(); user = null; render(); setMessage("You have signed out."); });
  TC.auth.getUser().then(({ user: current }) => { user = current || null; render(); }).catch(() => render());
})();
