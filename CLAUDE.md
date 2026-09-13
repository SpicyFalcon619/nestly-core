@AGENTS.md

# Nestly (formerly UIUNest) — project context

Web platform for shared student/bachelor housing near UIU plus a second-hand
marketplace ("Nestly Exchange"). Next.js 16 (App Router) + React 19 +
TypeScript + Supabase (Postgres, Auth, Realtime, Storage). Server Actions
instead of a separate API layer. See README.md for the full feature list
and setup steps.

## Recent work (2026-09-13)

Rebranded UIUNest → Nestly across the whole codebase. Two things worth
knowing before touching this again:

- The Supabase **storage bucket is still literally named `uiunest`**
  (app/actions/upload.ts, components/AvatarUpload.tsx,
  components/modals/CreateListingModal.tsx). Left untouched on purpose —
  every already-uploaded photo/avatar has that bucket name baked into its
  public URL, so renaming it breaks every existing image without a data
  migration. Don't "finish the rebrand" by touching this without planning
  that migration first.
- The navbar/login/register logo used to be two separate JSX spans
  (`UIU` + `Nest`), which is why a plain-text search for "UIUNest" missed
  it on the first pass. It's now `Nest` (ink) + `ly` (emerald, `.logo-ly`
  class). Check for other split-span brand text before assuming a text
  search caught everything.

Also fixed in the same pass:
- `ExchangeItemCard` was missing the `.listing-photo-wrap` container every
  other card uses, so marketplace thumbnails rendered at full intrinsic
  size instead of the fixed 16:10 crop.
- Landing page's "Latest listings" query had no status filter, so occupied
  listings that `/listings` correctly hides could still show up on `/`.
  Both queries now filter `.neq('status', 'occupied')`.
- Added `deleteListing()` (app/actions/applications.ts) plus a Delete
  button on the dashboard's listings table. Checked first: every FK
  referencing `listings` already has `ON DELETE CASCADE`, so a real
  delete is safe.
- Added a real favicon — bold white "N" on brand emerald (#1A5C45),
  rounded-square ground — at `app/icon.png` (512px, what modern browsers
  use) and `app/favicon.ico` (multi-res legacy fallback). Generated with
  PIL using Segoe UI Bold as a local stand-in for Plus Jakarta Sans (not
  installed as a system font in that environment).

## Design tokens (already locked — don't reinvent)

From `app/globals.css`, the real current palette:
- Primary: emerald `#1A5C45` (dark `#134233`, mid `#2E7D5A`, soft tint `#E8F5EE`)
- Background `#F7F8F9`, surface (cards) `#FFFFFF`
- Text: ink `#1E293B`, ink-mid `#475569`, ink-muted `#94A3B8`
- Headings: Plus Jakarta Sans (700–800). Body: Inter.
- Radius: 10px base, 18–24px on cards, full/100px on pills.

## Rebrand + dark theme + map dark skin (2026-09-13, later same day)

Dropped the UIU-only scope entirely — Nestly is now framed as "any
private university student around Dhaka," per explicit ask. Also did a
lighter de-cliché visual pass and added a real light/dark theme
switcher. Things worth knowing before touching this again:

- **`registerSchema` no longer restricts student emails** to
  `@uiu.ac.bd` (the `.superRefine` check in `lib/schemas.ts` was
  deleted). Deliberately did NOT add a university picker/whitelist —
  any email works for any role. If a "which university" concept gets
  requested later, that's new scope, not a revert of this.
- **The "UIU Campus Area" zone rename needs a migration applied.**
  Renamed to "Badda Campus Area" (same real Badda coordinates) in
  `lib/data.ts`, `components/HeroSearchForm.tsx`, and the
  `0000_initial_schema.sql` seed — but the **live Supabase DB already
  has the old row** from when 0000 first ran, and migrations don't
  retroactively re-run. `supabase/migrations/0004_rename_uiu_zone.sql`
  does the actual `UPDATE zones SET zone_name = ...` — it must be
  applied (SQL Editor or CLI) for the running app to show the new name;
  until then the DB-backed zone list (listings sidebar) still shows the
  old name even though the hardcoded fallback in `lib/data.ts` doesn't.
- **`--gold` is now a real gold/amber (`#D6A419` light / `#F2C94C`
  dark)**, not an alias for emerald-mid like before. It was being used
  for star ratings, which were rendering as green stars — now genuinely
  gold. Also used for "click to verify" hints and the exchange
  counter-offer accent. Don't repoint it back to emerald.
- **Dark theme is a real second palette**, not a filter/invert:
  `:root[data-theme="dark"]` in `app/globals.css`, plus a
  `@media (prefers-color-scheme: dark)` fallback for users who haven't
  explicitly chosen. `components/ThemeToggle.tsx` flips the attribute
  and persists to `localStorage['theme']`; `app/layout.tsx` has an
  inline anti-flash script (same pattern as the existing `is-landlord`
  script) that applies the stored choice before paint. Badge tints,
  glass-navbar backgrounds, and the hero/auth gradient wash all moved
  behind CSS vars (`--tint-*`, `--glass*`, `--hero-tint-*`) specifically
  so dark mode wouldn't wash them out — if you add a new light-only
  hardcoded color anywhere, it WILL look wrong in dark mode, there's no
  automatic correction.
- **Map tiles are theme-reactive** via `lib/mapTheme.ts`. Light mode
  still uses the pre-existing keyless raw Google XYZ tile trick (already
  a bit ToS-grey-area, not new). Dark mode uses Esri's free
  `World_Dark_Gray_Base` tiles — tried CartoDB's `dark_all` first, but
  their free anonymous tiles now show an "API KEY REQUIRED" watermark,
  so don't reach for that. Wired into `MapComponent.tsx`,
  `ListingMapClient.tsx`, `MapPicker.tsx` via a `MutationObserver` on
  `data-theme` (`watchMapTheme`).
  - **Gotcha**: `MapComponent.tsx`'s map-init `useEffect` has no cleanup
    (the `mapRef` guard is never reset), so it's not idempotent under
    React StrictMode's dev-only double-invoke. Any new effect that
    returns a real cleanup function needs to live in its OWN separate
    `useEffect`, not be added into that one — otherwise StrictMode's
    mount→cleanup→mount dance disconnects it (e.g. a `MutationObserver`)
    with no matching re-subscribe, and it silently never fires again.
    `ListingMapClient.tsx` and `MapPicker.tsx` don't have this problem
    since their init effects already fully tear down and null the map
    ref on cleanup.
- Removed the hero's triple-stacked radial "glow orb" background and
  gave `.bento-icon` a bordered chip treatment instead of a bare icon —
  minor de-cliché pass, not the full redesign below.

## Pending — asked for, not yet done

**A full visual/UI redesign pass** is still open. Today's session did a
lighter refresh (dark theme, one de-clichéd hero/icon pass, a real gold
accent) but not a ground-up redesign. If a heavier pass gets requested,
still show a plan/mockup before touching component-level CSS.

## Env vars the app actually reads

Confirmed by grepping the code, not guessed: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-side
only, used for admin actions).

## Git workflow

Ahmad pushes directly to `main` from VS Code's Source Control panel —
default to that here rather than feature branches unless asked; a
branch-first habit carried over from another project broke his usual
flow the first time.
