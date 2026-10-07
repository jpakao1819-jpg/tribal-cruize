/* Tribal Cruize — app configuration (Papua New Guinea).
 *
 * Leave supabaseUrl / supabaseAnonKey empty to run the app in DEMO MODE:
 * everything works locally (browser storage) without a backend.
 * Fill them in to go live. Payments use local settlement (bank transfer,
 * Digicel MyCash, cash on delivery) — see payments below; Stripe is not
 * available for PNG-based businesses, so no Stripe keys are required.
 */
window.TC_CONFIG = {
  brand: "Tribal Cruize",

  // --- Papua New Guinea ---------------------------------------------------
  // Primary display currency: Kina (all prices stored in PGK cents).
  // The header toggle lets visitors switch to USD (converted with the rate
  // below — update it occasionally, it is intentionally manual).
  currency: "PGK",
  currencyToggle: true,
  fx: { PGK: 1, USD: 0.26 }, // USD cents = PGK cents * fx.USD
  country: "PG",
  city: "Port Moresby",

  // --- Payments (local settlement — no foreign gateway needed) ------------
  // Shoppers order in-app and pay by bank transfer, Digicel MyCash, or cash
  // on delivery; vendors confirm receipt in their dashboard. Replace the
  // placeholder details below with your real account details.
  // `spaceTiers[].priceId` below is unused legacy (was for Stripe); leave empty.
  payments: {
    methods: [
      { id: "bank", label: "Bank transfer (BSP / Kina Bank)" },
      { id: "mycash", label: "Digicel MyCash" },
      { id: "cod", label: "Cash on delivery" },
    ],
    bank: {
      name: "Bank South Pacific (BSP)",
      accountName: "Tribal Cruize Ltd",
      accountNumber: "1000 0000",
      branch: "Port Moresby",
    },
    mycash: { name: "Tribal Cruize", number: "+675 0000 0000" },
    referenceNote:
      "Use your order reference as the payment description, then the vendor confirms it.",
  },

  // --- Supabase (Project Settings -> API) --------------------------------
  supabaseUrl: "",
  supabaseAnonKey: "",

  // --- Stripe -------------------------------------------------------------
  // Publishable key (pk_test_... / pk_live_...). Secret key lives ONLY in the
  // Supabase Edge Functions, never here.
  stripePublishableKey: "",

  // Space tiers sold on spaces.html. `priceId` must be a Stripe Price id from
  // your Stripe dashboard (used by the edge functions via SPACE_PRICES secret).
  // "interval": "month" = subscription, "once" = one-time payment.
  spaceTiers: [
    {
      id: "basic",
      name: "Basic Space",
      price: 1900, // cents
      interval: "month",
      priceId: "",
      features: [
        "Your own storefront page",
        "Up to 10 products",
        "Listed in the marketplace directory",
        "Vendor dashboard access",
      ],
    },
    {
      id: "featured",
      name: "Featured Space",
      price: 4900,
      interval: "month",
      priceId: "",
      features: [
        "Everything in Basic",
        "Up to 50 products",
        "Featured placement in the shop",
        "Highlighted storefront banner",
      ],
    },
    {
      id: "premium",
      name: "Premium Space",
      price: 9900,
      interval: "month",
      priceId: "",
      features: [
        "Everything in Featured",
        "Unlimited products",
        "Homepage spotlight slot",
        "Priority support",
      ],
    },
  ],

  // Bump this to invalidate old saved carts/designs after a schema change.
  storageVersion: 1,
};
