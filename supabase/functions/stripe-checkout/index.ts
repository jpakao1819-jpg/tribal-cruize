// Tribal Cruize — Checkout session creation (Supabase Edge Function)
//
// Deploy:  supabase functions deploy stripe-checkout
// Secrets: supabase secrets set STRIPE_SECRET_KEY=... SPACE_PRICES='{"basic":"price_...","featured":"price_...","premium":"price_..."}'
//          (put one-time space prices in SPACE_PRICES_ONETIME with the same JSON shape)
//
// POST { type: "product", items: [{productId, qty}], email, origin }   (guest or signed in)
// POST { type: "space", tierId, email, origin }                        (signed in required)
// -> { url }  redirect the browser to Stripe-hosted checkout.

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

type Item = { productId: string; qty: number };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "STRIPE_SECRET_KEY is not configured" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const payload = await req.json().catch(() => ({}));
    const { type, origin } = payload;
    if (!origin) return json({ error: "Missing origin" }, 400);

    const { createClient } = await import(
      // @ts-ignore
      "https://esm.sh/@supabase/supabase-js@2"
    );
    // Service role: guests have no RLS read access to product prices.
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const form = new URLSearchParams();
    const headers = {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };

    let mode = "payment";
    let userId = "";

    // ------------------------------------------------------------- products
    if (type === "product") {
      const items: Item[] = Array.isArray(payload.items) ? payload.items : [];
      if (!items.length) return json({ error: "Cart is empty" }, 400);
      if (items.length > 30) return json({ error: "Too many cart items" }, 400);
      for (const it of items) {
        if (!it.productId || !Number.isInteger(it.qty) || it.qty < 1 || it.qty > 99) {
          return json({ error: "Invalid cart item" }, 400);
        }
      }

      const ids = items.map((i) => i.productId);
      const { data: prods, error } = await svc
        .from("products")
        .select('id, price, title, "storefrontId"')
        .in("id", ids)
        .eq("active", true);
      if (error) return json({ error: error.message }, 500);

      const byId = new Map((prods ?? []).map((p) => [p.id, p]));
      if (byId.size !== new Set(ids).size) {
        return json({ error: "One or more products are no longer available" }, 400);
      }

      items.forEach((it, i) => {
        const p: Record<string, unknown> = byId.get(it.productId)!;
        form.set(`line_items[${i}][quantity]`, String(it.qty));
        form.set(`line_items[${i}][price_data][currency]`, "usd");
        form.set(`line_items[${i}][price_data][unit_amount]`, String(p.price));
        form.set(
          `line_items[${i}][price_data][product_data][name]`,
          String(p.title).slice(0, 180),
        );
      });

      form.set(
        "metadata[items]",
        items.map((i) => `${i.productId}x${i.qty}`).join(","),
      );
      form.set("metadata[kind]", "product");
      if (payload.email) form.set("customer_email", String(payload.email).slice(0, 200));
      form.set("success_url", `${origin}/shop.html?checkout=success`);
      form.set("cancel_url", `${origin}/shop.html?cart=cancel`);
    }

    // ---------------------------------------------------------------- space
    else if (type === "space") {
      const token = authHeader.replace(/^Bearer\s+/, "");
      if (!token) return json({ error: "Sign in required" }, 401);
      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: userData } = await sb.auth.getUser(token);
      const user = userData?.user;
      if (!user) return json({ error: "Sign in required" }, 401);
      userId = user.id;

      const tierId = String(payload.tierId ?? "");
      if (!tierId) return json({ error: "Missing tierId" }, 400);

      let prices: Record<string, string> = {};
      let oneTime: Record<string, string> = {};
      try { prices = JSON.parse(Deno.env.get("SPACE_PRICES") ?? "{}"); } catch { /* empty */ }
      try { oneTime = JSON.parse(Deno.env.get("SPACE_PRICES_ONETIME") ?? "{}"); } catch { /* empty */ }

      if (oneTime[tierId]) {
        // One-time space purchase: an existing Stripe Price id (amount > 0).
        form.set("line_items[0][price]", oneTime[tierId]);
        form.set("line_items[0][quantity]", "1");
        mode = "payment";
      } else if (prices[tierId]) {
        // Recurring space rental: a Stripe Subscription Price id.
        form.set("line_items[0][price]", prices[tierId]);
        form.set("line_items[0][quantity]", "1");
        mode = "subscription";
      } else {
        return json({ error: `Space tier "${tierId}" has no price configured on the server` }, 400);
      }

      form.set("metadata[kind]", "space");
      form.set("metadata[tier]", tierId);
      form.set("metadata[userId]", userId);
      if (user.email) form.set("customer_email", user.email);
      form.set("success_url", `${origin}/spaces.html?checkout=success`);
      form.set("cancel_url", `${origin}/spaces.html`);
    } else {
      return json({ error: "Unknown checkout type" }, 400);
    }

    form.set("mode", mode);
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers,
      body: form,
    });
    const session = await res.json();
    if (!res.ok) {
      return json({ error: session?.error?.message ?? "Stripe error" }, 502);
    }
    return json({ url: session.url });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
