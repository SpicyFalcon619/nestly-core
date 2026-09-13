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

## Pending — asked for, not yet done

**A full visual/UI redesign pass** — the site currently "looks generic";
the ask is to renew the look while keeping the emerald/off-white color
theme above. Explicitly asked to see a plan (or a mockup) BEFORE any
component-level CSS gets touched — don't start restyling components
without presenting that first.

## Env vars the app actually reads

Confirmed by grepping the code, not guessed: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-side
only, used for admin actions).

## Git workflow

Ahmad pushes directly to `main` from VS Code's Source Control panel —
default to that here rather than feature branches unless asked; a
branch-first habit carried over from another project broke his usual
flow the first time.
