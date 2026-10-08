# Registered clothing system — change log

Adds a full **registered-clothing workflow** to the Clothing Studio (designer.html),
built around an inventory of reusable 3D clothing templates.

## What changed

### New file
- `clothing-library.js` — the engine behind the new designer nav. Clothing Library
  list/grid/rail, `＋ Add Clothing` modal (3 entry paths), photo wizard with per-photo
  criteria validation, registration form + confirmation card, edit/duplicate/archive/
  delete, create-design-from-template, import-3D and create-custom-garment stubs
  wired to the mannequin canvas.

### Rewritten
- `designer.html` — now the **Clothing Studio**. Header gets `＋ Add Clothing` (+ count
  badge). Left rail is now the Clothing Library. Center stage has library gallery + flat
  mockup canvas + 3D mannequin stage + reconstruction-review stage. Right panel is now:
  1 Clothing Library · 2 Review reconstruction · 3 Register New Clothing · 4
  Confirmation · 5 Generate artwork · 6 Garment colors · 7 Placement · 8 Design
  metadata · 9 Edit garment shape. New modals: Add Clothing, Create From Photos wizard,
  registration confirmation, edit garment, import 3D.
- `designer.css` — library cards, thumbnail placeholders, clothing-list rows, photo
  wizard steps, criteria checklist, review items, reconstruct progress, confirmation
  card, working-design stage visibility rules, edit/import modals.
- `supabase/schema.sql` — new `clothing` + `designs` tables with RLS (owner-scoped),
  `garment_3d` as JSONB so geometry/sections/UV/materials/editable-region metadata
  persist across registration.
- `supabase/README.md` — added the clothing-library data-flow notes; Stripe functions
  still marked unused/optional (PNG has no Stripe).

### Extended
- `tc.js` — `tc.clothing` / `tc.designs` demo + live adapters, `slug`, `parseTags`,
  `joinTags`; exposed on `window.TC`.
- `config.js` — `clothingDefaults` (categories, fabrics, tag hints) — non-opinionated
  form dropdowns, not rules.

## Verified (browser, zero console errors)
- Library starts empty; `＋ Add Clothing` opens with 3 paths; photos wizard renders
  instructions + 4 required photo cells + upload grid + review + reconstruct progress +
  register-done step; registration form rejects empty name and accepts valid names;
  confirmation card (Name / Category / 3D Model / Editable regions / Fabric + 3 buttons)
  wired in both in-panel and modal forms; create-design-from-template switches to the
  working-design stage with the garment as the base; View 3D opens mannequin mode with
  the garment's metadata; Edit pre-populates and persists; Archive removes from the
  active grid; Delete removes from library and localStorage.
- The flat mockup + 3D mannequin (from the prior build) remain available as the working
  canvas; the mannequin is the proportional base the registered garment is authored on.
- `node --check` passes on `tc.js`, `designer.js`, `clothing-library.js`.

## One limitation (not a defect)
- The photo **upload** step is real and wired (file input → handler → addPhoto →
  criteria → review → reconstruct → register), but the OS file-picker dialog can't be
  driven by browser automation in this environment, so the *data path* from a real
  selected file wasn't triggered by me. The code path is intact and parses clean; a real
  user picking files exercises it. Reconstruction itself is wired as
  `reconstructFromPhotos()` — a hosted 3D-reconstruction endpoint the app calls; demo
  mode simulates a successful artifact so the whole register→design path is testable now.
  True mesh reconstruction from photos needs a 3D reconstruction service (not solvable
  from a prompt alone), so that endpoint is the integration point to plug in later.

## PNG context already in place
- Kina (PGK) base currency, bank/MyCash/COD settlement, "Made in Papua New Guinea" —
  none of that touched by this pass; the clothing library sits on top of the existing app.
