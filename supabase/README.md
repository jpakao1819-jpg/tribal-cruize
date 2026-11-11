# Tribal Cruize — backend setup (Supabase, Papua New Guinea)

The frontend runs in **demo mode** until these are connected; nothing here is
required to try the app.

## Project vision

Tribal Cruize is a complete virtual marketplace and 3D fashion design platform
built for Papua New Guinea and future expansion into international markets.
It brings traditional market culture together with modern digital commerce: a
market village where people can discover local businesses, browse their stalls,
connect with sellers, purchase products, and arrange delivery or collection.

The platform combines a digital marketplace, seller storefronts, customer
accounts and a dedicated 3D fashion design studio. Upgrade the existing app
without unnecessarily rebuilding or removing working functionality.

### Marketplace and seller requirements

- Let individuals and businesses apply for and register a virtual stall,
  including sellers without a formally registered company.
- Collect stall name, owner, description, category, logo, cover image, contact
  details, location/region, products and preferred storefront plan.
- Give every stall a unique owner and dashboard access to manage branding,
  products, inventory, orders, customer purchases, payment confirmation, sales
  summaries and business profile.
- Enforce seller ownership so one seller cannot change another seller's stall.
- Provide dedicated storefronts with branding, owner information, catalog,
  categories, product images/prices/availability, ratings and reviews, contact,
  location and delivery/collection information.
- Support administrator-managed categories and subcategories, including fashion,
  traditional PNG products, arts and crafts, handmade items, food and agriculture,
  electronics, beauty, home and living, footwear, accessories, services and more.
- Retain the existing storefront space tiers and prices in `config.js`. A stall
  that requires payment stays pending until payment is verified and manually
  activated by an authorized administrator. Keep manual activation in the table
  editor unless a secure admin interface is implemented.

### Customer accounts and Google sign-in

Use Supabase Authentication with Google OAuth as the primary sign-in experience.
Users should be able to register, sign in/out, recover account access, maintain
persistent sessions and update their profiles. OAuth authenticates Google
accounts; **never collect or store Gmail passwords**.

Create or retrieve profiles with display name, profile photo, email, contact
number, location, creation date and role. Support customer, seller/stall owner,
clothing designer and administrator roles. A customer can apply to sell using
the same account, and users may hold multiple authorized roles.

### Customer shopping requirements

Support marketplace and stall discovery; product and stall search; category
filters and price sorting; product details, multiple images and size/colour
variations; favourites; cart quantity updates and item removal; checkout; order
history and status tracking; and reviews after purchase. Product records should
support descriptions, price, images, seller/stall, category, stock, variations,
weight/dimensions, delivery/collection details and availability.

### 3D fashion design studio requirements

Keep the fashion studio as a dedicated professional interface, visually
separate from the marketplace but sharing user accounts and saved designs. It
must use a genuine interactive 3D mannequin rather than a flat image, support
rotation, zoom, front/back/side views, garment inspection and preview, and pose
or body-model changes where supported. The responsive studio should let users
create, customize and save designs. Existing registered clothing and design
artifacts should continue preserving garment geometry, sections, front/back
surfaces, sleeves, collar, cuffs, hems, UV mapping and editable-region metadata.

## Design direction and digital market experience

Build Tribal Cruize around the concept of a modern digital Papua New Guinean
market village, blending traditional market culture with modern digital
commerce.

The marketplace homepage should provide a welcoming market-village identity,
visually distinctive virtual stalls, cultural-inspired design elements,
featured local businesses, product discovery, popular products, new arrivals,
marketplace categories and promotional banners. Each seller should have a
recognizable storefront. Keep shopping intuitive: customers can explore stalls,
browse products, compare prices and purchase without unnecessary navigation.
The market-village theme should enrich shopping without making the application
complicated.

Prioritize the modern PNG-identity marketplace interface and individual digital
stalls first. Do **not** make a fully navigable 3D virtual village a launch
requirement. Keep the architecture open to adding an immersive market later
without rebuilding the marketplace. The 3D clothing mannequin, however, must be
a genuine interactive 3D feature. The result should feel like Papua New Guinea's
own modern digital market platform, with the potential to serve international
customers and businesses.

> This repository already includes a PNG-first marketplace, seller dashboard,
> local-settlement checkout, and 3D clothing library foundation. The existing app
> can run in demo mode until the backend and real payment details are connected.

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

The `clothing` and `designs` tables (also created by the SQL script) back the
**registered clothing library** in the designer: a reconstructed garment only
becomes a reusable template after someone explicitly registers it with their own
name, category, fabric and tags. The 3D artifact is stored as JSON in
`clothing.garment_3d` so geometry, sections, front/back surfaces, sleeves,
collar, cuffs, hems, UV mapping and editable-region metadata are preserved.
Space activation is a manual status flip in the table editor until an admin page
exists.

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
2. Configure Supabase Google OAuth and the allowed redirect URLs for your
   deployed site. Never put a Supabase service-role key in frontend code.
3. Deploy the static files (Netlify / Vercel / any static host) and serve over
   HTTPS — the app must not be opened as a `file://` page.
4. Deploy the `image-generate` function so the designer works in production.
5. All amounts are stored in **Kina (PGK)**; the header toggle converts the
   display to USD using `config.js` → `fx` (update that rate occasionally).

## Data flow

| Table | Written by | Read by |
|---|---|---|
| `storefronts` | vendor (dashboard), you (activation) | everyone (active only), owner (own) |
| `products` | vendor (dashboard) | everyone (listed), owner (all) |
| `orders` | shoppers (`pending_payment` only), vendor (mark paid) | vendor (own storefront) |
| `clothing` | designer (registration) | owner (own garments), designs list |
| `designs` | designer (create from a garment) | owner (own designs) |
