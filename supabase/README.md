# Tribal Cruize — backend setup (Supabase, Papua New Guinea)

The frontend runs in **demo mode** until these are connected; nothing here is
required to try the app.

> **Payments:** Stripe does **not** support Papua New Guinea (no accounts, no
> Connect payouts), so Tribal Cruize uses **local settlement** — orders are
> placed in-app and paid by bank transfer, Digicel MyCash, or cash on delivery,
> with the vendor confirming receipt in their dashboard. No payment-provider
> account is needed to launch. Replace the placeholder account details in
> [`config.js`](../config.js) (`payments`) with your real BSP/Kina/MyCash
> details.

## 1. Supabase

1. Create a project at https://supabase.com (free tier is enough).
2. Open **SQL Editor** → paste and run [`schema.sql`](schema.sql).
3. **Project Settings → API** → copy the Project URL and anon key into
   [`config.js`](../config.js) (`supabaseUrl`, `supabaseAnonKey`).
4. Storage bucket `product-images` is created by the SQL script (public read).

## 2. Supabase CLI (only if you deploy the edge functions)

```bash
supabase login
supabase link --project-ref <project-ref>
supabase functions deploy image-generate
```

`image-generate` is the only function the current app calls: it proxies AI
image generation server-side (the free image service refuses browser requests
with an `Origin` header). Locally the dev server's `/api/image` does the same
job, so this can wait until you go live.

The `stripe-*` and `connect-onboard` functions in [`functions/`](functions)
are **not used by the app** — they are kept as an optional path if you ever
operate from a Stripe-supported country or a PNG card gateway (Kina Bank IPG /
BSP e-commerce) is added later.

## 3. How orders are settled

| Step | Who | Where |
|---|---|---|
| 1. Shopper checks out | shopper | `shop.html` → order created `pending_payment` with a `TC-XXXXXX` reference |
| 2. Shopper pays | shopper | bank transfer / MyCash / COD using the shown instructions |
| 3. Vendor confirms | vendor | dashboard → Orders → **Mark paid** |
| 4. Space purchase | company | `spaces.html` → storefront `pending_payment` + order |
| 5. Space activation | you | Supabase table editor: set the storefront `status` to `active` |

Space tier prices shown in `config.js` (`spaceTiers[].price`) are the amounts
you charge — keep them in sync with what you expect to receive.

## 4. Going live

1. Put your real payment details in `config.js` → `payments`.
2. Deploy the static files (Netlify / Vercel / any static host) and serve over
   https — the app must not be opened as a `file://` page.
3. Deploy the `image-generate` function so the designer works in production.
4. All amounts are stored in **Kina (PGK)**; the header toggle converts the
   display to USD using `config.js` → `fx` (update that rate occasionally).

## Data flow

| Table | Written by | Read by |
|---|---|---|
| `storefronts` | vendor (dashboard), you (activation) | everyone (active only), owner (own) |
| `products` | vendor (dashboard) | everyone (listed), owner (all) |
| `orders` | shoppers (`pending_payment` only), vendor (mark paid) | vendor (own storefront) |
