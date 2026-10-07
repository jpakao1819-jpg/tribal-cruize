// Tribal Cruize — Stripe Connect Express onboarding (Supabase Edge Function)
//
// Deploy:  supabase functions deploy connect-onboard
// Secrets: supabase secrets set STRIPE_SECRET_KEY=sk_test_... STRIPE_COUNTRY=US
//
// Called by spaces.html with the signed-in user's JWT. Creates (or reuses) a
// Connect Express account for the vendor and returns the onboarding URL.

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

// @ts-ignore
import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function stripeForm(auth: string): { headers: HeadersInit; body: URLSearchParams } {
  return {
    headers: {
      Authorization: `Bearer ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/, "");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "STRIPE_SECRET_KEY is not configured" }, 500);
    if (!token) return json({ error: "Sign in required" }, 401);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) return json({ error: "Sign in required" }, 401);

    const { origin } = await req.json().catch(() => ({ origin: "" }));
    if (!origin) return json({ error: "Missing origin" }, 400);

    // Make sure the vendor has a storefront row to hang the account id on.
    let { data: store } = await sb
      .from("storefronts")
      .select("id, stripe_account_id")
      .eq("owner", user.id)
      .maybeSingle();

    if (!store) {
      const { data: created, error: createErr } = await sb
        .from("storefronts")
        .insert({
          owner: user.id,
          name: (user.email ?? "My").split("@")[0] + "'s store",
          bio: "",
          logo: "",
          tier: "basic",
          status: "pending",
        })
        .select("id, stripe_account_id")
        .single();
      if (createErr) return json({ error: createErr.message }, 500);
      store = created;
    }

    let accountId = store?.stripe_account_id ?? "";
    if (!accountId) {
      const body = new URLSearchParams();
      body.set("type", "express");
      body.set("email", user.email ?? "");
      body.set("country", Deno.env.get("STRIPE_COUNTRY") ?? "US");
      body.set("capabilities[transfers][requested]", "true");
      const acctRes = await fetch("https://api.stripe.com/v1/accounts", {
        method: "POST",
        ...stripeForm(stripeKey),
        body,
      });
      const acct = await acctRes.json();
      if (!acctRes.ok) {
        return json({ error: acct?.error?.message ?? "Stripe account creation failed" }, 502);
      }
      accountId = acct.id;
      const { error: updErr } = await sb
        .from("storefronts")
        .update({ stripe_account_id: accountId })
        .eq("id", store!.id);
      if (updErr) return json({ error: updErr.message }, 500);
    }

    // Already fully onboarded? -> skip the hosted onboarding entirely.
    const acctInfoRes = await fetch(`https://api.stripe.com/v1/accounts/${accountId}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    });
    const acctInfo = await acctInfoRes.json();
    if (acctInfo.details_submitted && acctInfo.payouts_enabled) {
      return json({ onboarded: true, url: null });
    }

    const linkBody = new URLSearchParams();
    linkBody.set("account", accountId);
    linkBody.set("refresh_url", `${origin}/spaces.html`);
    linkBody.set("return_url", `${origin}/spaces.html?onboard=done`);
    linkBody.set("type", "account_onboarding");
    const linkRes = await fetch("https://api.stripe.com/v1/account_links", {
      method: "POST",
      ...stripeForm(stripeKey),
      body: linkBody,
    });
    const link = await linkRes.json();
    if (!linkRes.ok) {
      return json({ error: link?.error?.message ?? "Could not create onboarding link" }, 502);
    }
    return json({ onboarded: false, url: link.url });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
