/* Tribal Cruize — app configuration (Papua New Guinea).
 * Demo mode works without a backend; use only Supabase's public anon key here.
 */
window.TC_CONFIG = {
  brand: "Tribal Cruize",
  currency: "PGK",
  currencyToggle: true,
  fx: { PGK: 1, USD: 0.26 },
  country: "PG",
  city: "Port Moresby",
  payments: {
    methods: [
      { id: "bank", label: "Bank transfer (BSP / Kina Bank)" },
      { id: "mycash", label: "Digicel MyCash" },
      { id: "cod", label: "Cash on delivery" },
    ],
    bank: { name: "Bank South Pacific (BSP)", accountName: "Tribal Cruize Ltd", accountNumber: "1000 0000", branch: "Port Moresby" },
    mycash: { name: "Tribal Cruize", number: "+675 0000 0000" },
    referenceNote: "Use your order reference as the payment description, then the vendor confirms it.",
  },
  supabaseUrl: "",
  supabaseAnonKey: "",
  stripePublishableKey: "",
  spaceTiers: [
    { id: "basic", name: "Basic Space", price: 1900, interval: "month", priceId: "", features: ["Your own storefront page", "Up to 10 products", "Listed in the marketplace directory", "Vendor dashboard access"] },
    { id: "featured", name: "Featured Space", price: 4900, interval: "month", priceId: "", features: ["Everything in Basic", "Up to 50 products", "Featured placement in the shop", "Highlighted storefront banner"] },
    { id: "premium", name: "Premium Space", price: 9900, interval: "month", priceId: "", features: ["Everything in Featured", "Unlimited products", "Homepage spotlight slot", "Priority support"] },
  ],
  storageVersion: 1,
  clothingDefaults: {
    categories: ["Sportswear", "Streetwear", "Formal / Workwear", "School Uniform", "Traditional / Cultural", "Activewear", "Casual", "Custom"],
    fabrics: ["Polyester", "Cotton", "Cotton blend", "Jersey", "Denim", "Wool", "Tech / performance", "Satin", "Custom / unknown"],
    tagHints: ["Short Sleeve", "Long Sleeve", "V-neck", "Crew neck", "Hoodie", "Polo", "Jersey", "Pants", "Shorts", "Cap", "Tote"],
  },
};

// Common account/navigation shell is loaded on every app page. It does not
// contain credentials and safely waits for the shared TC runtime to initialize.
(function () {
  var script = document.createElement("script");
  script.src = "app-shell.js";
  script.defer = true;
  document.head.appendChild(script);
})();
