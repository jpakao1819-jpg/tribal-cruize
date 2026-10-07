// Tribal Cruize — Stripe webhook fulfilment (Supabase Edge Function)
//
// Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets: supabase secrets set STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=whsec_...
//
// Point a Stripe webhook at:
//   https://<project-ref>.functions.supabase.co/stripe-webhook
// with event: checkout.session.completed
//
// Fulfilment:
//   kind=product  -> insert one order row per item, then create a Stripe
//                    Transfer per vendor storefront (multi-vendor carts).
//   kind=space    -> activate the buyer's storefront, insert a space order row.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function verifySignature(
  secret: string,
  header: string | null,
  payload: string,
): Promise<boolean> {
  if (!header) return false;
  const parts: Record<string, string> = {};
  for (const piece of header.split(",")) {
    const [k, v] = piece.split("=");
    if (k && v) parts[k.trim()] = v;
  }
  const ts = parts.t;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false; // 5 min tolerance

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${ts}.${payload}`),
  );
  const expected = [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return expected === v1;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secret || !stripeKey) return json({ error: "Stripe secrets missing" }, 500);

  const payload = await req.text();
  const ok = await verifySignature(secret, req.headers.get("stripe-signature"), payload);
  if (!ok) return json({ error: "Invalid signature" }, 400);

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(payload);
  } catch {
    return json({ error: "Bad payload" }, 400);
  }

  if (event.type !== "checkout.session.completed") {
    return json({ received: true });
  }

  const session = (event.data as Record<string, unknown>)?.object as Record<string, unknown>;
  const meta = (session.metadata ?? {}) as Record<string, string>;
  const stripeHeaders = {
    Authorization: `Bearer ${stripeKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  // @ts-ignore
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // ------------------------------------------------------------- products
    if (meta.kind === "product") {
      const items = (meta.items ?? "")
        .split(",")
        .filter(Boolean)
        .map((chunk) => {
          const [id, qty] = chunk.split("x");
          return { id, qty: Math.max(1, parseInt(qty ?? "1", 10) || 1) };
        })
        .filter((i) => i.id);
      if (!items.length) return json({ received: true });

      const { data: prods } = await svc
        .from("products")
        .select('id, price, title, "storefrontId"')
        .in("id", items.map((i) => i.id));
      const byId = new Map((prods ?? []).map((p) => [p.id, p]));
      const buyerEmail = (session.customer_details as Record<string, string> | undefined)?.email ?? "";

      const totalsByStore = new Map<string, number>();
      for (const it of items) {
        const p = byId.get(it.id) as Record<string, unknown> | undefined;
        if (!p) continue;
        const amount = Number(p.price) * it.qty;
        await svc.from("orders").insert({
          buyer_email: buyerEmail,
          storefrontId: p.storefrontId,
          productId: p.id,
          title: p.title,
          kind: "product",
          qty: it.qty,
          amount,
          currency: session.currency ?? "usd",
          status: "paid",
          stripe_session: session.id,
        });
        const storeId = String(p.storefrontId ?? "");
        if (storeId) {
          totalsByStore.set(storeId, (totalsByStore.get(storeId) ?? 0) + amount);
        }
      }

      // Pay each vendor with a Transfer from the platform balance.
      for (const [storeId, amount] of totalsByStore) {
        if (amount <= 0) continue;
        const { data: store } = await svc
          .from("storefronts")
          .select("stripe_account_id")
          .eq("id", storeId)
          .maybeSingle();
        if (!store?.stripe_account_id) continue;
        const body = new URLSearchParams();
        body.set("amount", String(amount));
        body.set("currency", session.currency ?? "usd");
        body.set("destination", store.stripe_account_id);
        body.set("transfer_group", String(session.id));
        await fetch("https://api.stripe.com/v1/transfers", {
          method: "POST",
          headers: stripeHeaders,
          body,
        });
      }
      return json({ received: true });
    }

    // ---------------------------------------------------------------- space
    if (meta.kind === "space") {
      const userId = meta.userId;
      const tier = meta.tier ?? "basic";
      const amount = Number(session.amount_total ?? 0);
      const buyerEmail = (session.customer_details as Record<string, string> | undefined)?.email ?? "";
      if (userId) {
        const { data: store } = await svc
          .from("storefronts")
          .select("id")
          .eq("owner", userId)
          .maybeSingle();
        if (store) {
          await svc
            .from("storefronts")
            .update({ status: "active", tier })
            .eq("id", store.id);
        } else {
          await svc.from("storefronts").insert({
            owner: userId,
            name: (buyerEmail || "My").split("@")[0] + "'s store",
            tier,
            status: "active",
          });
        }
        await svc.from("orders").insert({
          buyer_email: buyerEmail,
          kind: "space",
          tier,
          amount,
          currency: session.currency ?? "usd",
          status: "paid",
          stripe_session: session.id,
        });
      }
      return json({ received: true });
    }

    return json({ received: true });
  } catch (err) {
    // Returning 500 makes Stripe retry — surface the failure.
    return json({ error: err instanceof Error ? err.message : "Fulfilment failed" }, 500);
  }
});
