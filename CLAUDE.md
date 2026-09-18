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
- ~~Map tiles swapped to a dark provider via `lib/mapTheme.ts`~~ —
  **superseded, that file is deleted.** Dark mode now CSS-filters the
  normal tiles (see "Second pass" below). Don't reintroduce a dark tile
  provider: CartoDB's free tiles watermark "API KEY REQUIRED", and any
  external provider failing leaves the map blank.
- Removed the hero's triple-stacked radial "glow orb" background and
  gave `.bento-icon` a bordered chip treatment instead of a bare icon —
  minor de-cliché pass, not the full redesign below.

## Listings audit + fixes (2026-09-14)

Redesign directions were shown and rejected — **keep the current visual
design**; work moved to correctness and missing functionality. Fixed:

- **`--surface-1` was never defined** but is referenced in ~11 places
  (listing detail, messages, profile, comments, offers, exchange). An
  undefined custom property makes the whole declaration invalid, so all
  of those "inset panel" backgrounds were rendering transparent. Now
  defined in all three theme blocks in `globals.css`.
- **`listings.zone` doesn't exist as a column.** Every other page joins
  `zone:zones(zone_name)`; both listing pages didn't — so cards never
  showed a zone badge and the detail page rendered an empty badge with
  a lone map-pin. Both queries now join it and flatten `{zone_name}` to
  a string (PostgREST returns an object, not a string — flatten it or
  React throws).
- **Browse filters were applied after pagination.** `page.tsx` paged in
  the DB, then filtered budget/amenities and sorted by cost in JS over
  those 10 rows — so filters silently lied and `totalPages` came from
  an unfiltered count. Filters now run in the DB (conditional `!inner`
  joins — never join `!inner` unconditionally or listings lacking a
  costs/amenities row vanish). Cost sorting still can't be done in
  PostgREST (it can't order parent rows by an embedded column), so that
  one path fetches the filtered set and pages in JS.
- **`utility_costs.other_fees` was missing from the cost breakdown**,
  though `CreateListingModal` does collect it — so custom fees were
  charged but hidden, on the page whose whole pitch is "every cost
  itemized".
- **The bills page queried `listing_costs`, a table that doesn't
  exist** (it's `utility_costs`) in two places, so the query errored and
  landlords saw no listings to bill at all. Also `costs` is a to-one
  embed (UNIQUE fk) so it's an object — `costs?.[0]` was wrong too.
- Detail page: added a photo gallery (gallery photos were being uploaded
  and never rendered anywhere — only `photos[0]` was ever shown), a key
  facts strip (gender preference, rooms free/total, listing type, posted
  / available-from — the *card* showed more than the detail page did),
  `generateMetadata` for real per-listing titles and OG tags, an
  occupied-listing guard on the apply form (the server already rejected
  these, the UI didn't), and `.detail-layout` instead of an inline
  `grid-template-columns` that had no mobile breakpoint at all.
- `.bento-emerald` (homepage feature card AND the detail page's cost
  breakdown) filled with the raw accent, which is a light mint in dark
  mode — a glaring slab with white text on it. Now uses its own
  `--panel-emerald-*` tokens: deep emerald in both themes.

**Dark-mode + layout sweep** (same pass — these kept surfacing one at a
time, so they were swept systematically rather than reactively):
- Hardcoded light backgrounds (`'white'`, `'#fff'`, `'#f1f5f9'`) were
  painting glaring white panels in dark mode across the seeking empty
  state, the whole messages pane (6 spots), the notification dropdown,
  the profile email field and the exchange detail page. All now tokens.
  `app/exchange/[id]/page.tsx` also had body copy pinned to `#334155`,
  near-invisible on a dark surface.
- **`padding: '40px 0'` on `.container` was on 7 pages** (admin, bills,
  exchange list + detail, notifications, profile, seeking) — the inline
  style overrides the class's `5%` horizontal padding, so content ran
  edge-to-edge at any viewport ≤1440px and touched the screen edge on
  mobile. The pages that were right used `40px 5%`; all now match.
  Note an inline padding also defeats the `max-width: 560px` container
  rule, since inline styles beat media queries.
- `components/PhotoGallery.tsx` (new) is shared by the listing detail
  and exchange detail pages. The exchange page previously rendered
  thumbnails styled `cursor: pointer` that had no click handler at all
  — it's a server component, so they could never have worked.

**Second pass — the rest of the fixes:**
- **`listings.zone` struck a third time**, in `app/profiles/[slug]/page.tsx`.
  That query selected the nonexistent column, so it *always errored* →
  `listings` was always null → nobody's public profile ever showed their
  listings, and every user hit the "You haven't listed anything yet /
  Create a Listing" empty state. That was the real cause of admins being
  told to create listings; admins now get a plain note instead. The
  homepage query didn't join zones either. **If you write a listings
  query, join `zone:zones(zone_name)` and flatten it.**
- **Dark map**: replaced the swap-in-a-dark-tile-provider approach
  entirely. It was fragile (CartoDB started demanding an API key, Esri
  is another dependency that can be blocked/rate-limited/missing zooms,
  and when it fails the map is simply blank). Dark mode now applies a
  CSS filter to `.leaflet-tile-pane` over the same tiles light mode
  uses, so the map cannot go blank from a provider problem. `lib/mapTheme.ts`
  and all the `MutationObserver` wiring are deleted — including the
  StrictMode effect gotcha documented above, which no longer applies.
- **`PhotoGallery` now has a real lightbox** — click to open, ←/→ keys,
  Escape, thumbnail strip, body-scroll lock. It is **portalled to
  `document.body`**: rendered in place it got trapped under the navbar's
  stacking context because the gallery sits inside sticky/positioned
  parents. Main image is `object-fit: cover` at 4/3 (it was `contain`,
  which letterboxed portrait phone photos into a strip); the lightbox
  shows the full uncropped image.
- **Enter now sends** in comments, reviews and user ratings (all three
  required Ctrl+Enter; messages already sent on Enter). Shift+Enter
  makes a newline.
- Comment votes are proper pill buttons with hit area, hover, active
  state and tabular counts (`.vote-btn` in globals.css) rather than bare
  icons.
- Sleek app-wide scrollbars via `--scrollbar-thumb` tokens; the thumb is
  drawn inside a transparent border with `background-clip: content-box`.
- Notification dropdown used `var(--navy)` for message text — that alias
  points at emerald, which is why every notification rendered green —
  plus a hardcoded `#eee` border and `#f0f9ff` unread background.
  **Note `--navy` is still used as a heading colour in ~20 places across
  admin/bills/dashboard**, so those headings are emerald; left alone as
  it reads as intentional, but it is not.
- **The footer links row didn't wrap**, overflowing to 411px in a 390px
  viewport — that gave *every page* a horizontal scroll on mobile.
- `StatusChanger` and `ComplaintModal` are now wired up: owners get a
  status control on their listing (so `soon_vacant` is reachable and an
  occupied listing can be re-opened), and non-owners get a Report
  button via `components/ReportButton.tsx`.

**Third pass — more broken things found by using the app:**
- **Comments were invisible to everyone.** Both detail pages embedded
  `user:profiles!item_comments_user_id_fkey(...)`, but **the comment
  tables were created by hand in the Supabase dashboard and are in no
  migration**, so they have no FK to `profiles`. PostgREST failed the
  *whole* query → `comments` was always `[]`. The commenter appeared to
  see theirs only because `CommentSection` inserts optimistically into
  local state; it vanished on reload. `lib/comments.ts` now fetches
  authors in a second query and merges, so it no longer depends on a FK
  that doesn't exist. **The comment tables still need to be captured in
  a migration.**
- **`listings.zone` struck a fourth time** in `app/profiles/[slug]/page.tsx`
  — that query always errored, which is why nobody's public profile ever
  listed anything and every user (admins included) got the "You haven't
  listed anything yet / Create a Listing" empty state.
- Sold/withdrawn items leaked onto the landing page: `/exchange` filtered
  status client-side, the homepage didn't filter at all.
- **Messaging was unreadable in dark mode.** `MessagesClient` had three
  module-level constants (`EMERALD`, `EMERALD_SOFT`, `EMERALD_LIGHT`)
  hardcoded to light-mode hex, used 23 times — incoming bubbles were pale
  mint with near-white text. `EMERALD` was used for *both* fills and
  link text, so it was split into `EMERALD` (fill) / `EMERALD_TEXT`.
- **Filled buttons now use `--btn-primary-*`, not the raw accent.** The
  accent is a light mint in dark mode, so every filled button was a
  glaring slab. `.btn-primary`, `.btn-gold`, `.btn-success`, `.avatar`,
  `.step-num`, `.seek-avatar` and the inline avatar fills all use the
  deep emerald that matches `.bento-emerald`. **Don't fill a surface with
  `var(--emerald)` and put white text on it** — use the button tokens.
- The notification bell had no `.icon-btn` styling (bare button) while
  every sibling icon had one. Navbar right side is now grouped:
  activity icons (bell, messages) · divider · theme toggle · avatar,
  with Watchlist and My Activity moved into the avatar dropdown.
- Homepage bento had an empty grid cell; the trust card is now
  `bento-full` with the five review dimensions as chips.

**New:** `PhotoGallery` lightbox (portalled, arrow keys); `lib/activity.ts`
+ a **My Activity** dashboard tab showing comments, votes, offers, ratings
and reviews in one reverse-chronological feed.

**Polish pass:**
- `accent-color` for range sliders was scoped to `.sidebar`, so every
  other price/filter slider fell back to the browser's blue. Now global.
- `ExchangeItemCard` rendered `<span className="badge">{item.zone}</span>`
  unconditionally, so an item with no zone drew an **empty grey badge**.
  Guarded — and the homepage items query now joins zones and the seller
  (it was selecting `*`, so zone and seller name were always missing).
- Footer rendered `© 2026Nestly` — JSX dropped the space around
  `{new Date().getFullYear()}`. Built as one template string instead.
- Navbar auth buttons used full `.btn` padding (≈44px tall) inside a 56px
  pill nav next to 34px icon buttons; `.nav-right .btn` pins them to 36px.

**Undefined-token sweep (do this after adding any `var(--x)`):**
`--surface-1` was not a one-off. A sweep of every `var(--token)` against
`globals.css` found **five more referenced-but-never-defined** tokens —
`--amber`, `--bg-color`, `--ink-dark`, `--radius-md`, `--surface-hover`
(9 call sites across the admin document viewer, verification modal,
SeekCard, exchange detail and dashboard). An undefined custom property
invalidates the whole declaration, so each was silently rendering a
transparent panel, an unstyled colour or `border-radius: 0`. They were
repointed at real tokens rather than defining more aliases. Also deleted
`app/page.module.css` — an unimported `create-next-app` leftover that
was the source of 8 more phantom tokens.

To re-run the check:
```bash
for tok in $(grep -rhoE "var\(--[a-z0-9-]+" app components --include="*.tsx" --include="*.css" \
  | sed 's/var(//' | sort -u); do grep -q -- "$tok:" app/globals.css || echo "UNDEFINED: $tok"; done
```

## Upgrade list progress (2026-09-14)

- **#2 seed data — done.** `scripts/seed-demo.mjs` inserts 3 realistic Dhaka
  listings (with costs + amenities + multi-photo galleries) and
  `--clean` removes them. Needs `SUPABASE_SERVICE_ROLE_KEY`; dev only.
  This finally allowed the listing detail page to be verified in a
  browser — it had been built blind across two sessions.
- **#3 image optimisation — done.** `next/image` on the three hot paths
  (ListingCard, ExchangeItemCard, PhotoGallery main + thumbs) using
  `fill` + `sizes`. Data-URI placeholders pass `unoptimized` (the
  optimizer rejects them), and `.gallery-thumb` needed `position:
  relative` for `fill`. The lightbox stays a plain `<img>` on purpose —
  it exists to show the original. `picsum.photos` added to
  `remotePatterns` for the demo photos.
- **#4 total_monthly drift — migration written, NOT APPLIED.**
  `0005_utility_costs_total_trigger.sql` recomputes the total from its
  parts on every insert/update. Deliberately a **trigger, not a
  GENERATED column**: a generated column rejects any INSERT that
  supplies the value, which would break `CreateListingModal` the instant
  the migration ran. The trigger accepts and overwrites, so migration
  and app deploy in either order.
- **#9 contact reveal — done.** `owner.phone`/`owner.email` were fetched
  and discarded; they now appear once the viewer's application is
  `accepted` (or they own the listing), with a lock note otherwise.
- Overlay badges on listing photos (`VERIFIED`, `SOON VACANT`) used the
  translucent tint backgrounds and were unreadable over a photo. They
  now get a small, near-opaque **white** pill (blurred, pill radius, dark
  per-status ink) in **both** themes — the backdrop there is the photo, not
  the page. The first attempt was a dark scrim, which read as a heavy black
  slab on the card — do not go back to it.
- The detail fact read "Listed by — Landlord Listed"; the value is now
  just "Landlord" / "Fellow student".

- **Listing photos were uneditable.** `EditListingModal` covered title,
  zone, type, address, status, rooms and description but **not photos** —
  upload the wrong image and the only remedy was deleting the listing.
  It now manages photos: add (multi-upload to the same `uiunest` bucket
  path as create), remove, and "make cover" (the first entry in `photos`
  is the thumbnail everywhere, so promoting one to the front *is* the
  cover action).
- Comment authors now link to their public profile, but only when the
  author has a `profile_slug` **and** `is_public !== false` — so private
  profiles (e.g. the admin) render as plain text. `fetchCommentsWithAuthors`
  selects those two extra columns.

- **Card tags reworked.** Listing cards rendered zone / property type /
  listed-by as three pastel `.badge` chips that wrapped to two lines and
  looked washed out in light mode. Those three are *metadata*, not
  status, so they're now one quiet `.listing-metaline`
  (`📍 Shatarkul · Full Mess · Landlord listed`) — which also leaves the
  photo-overlay badges (Verified / availability) as the only loud things
  on the card. Same treatment on `ExchangeItemCard`, except **condition
  stays a chip** since that's the quality signal buyers scan for.
- Missing amenities on the detail page were greyed out at 30% opacity
  and easy to miss; they're now red with an X ("no lift" is information
  worth seeing), present ones green with a check.

- **#6 price comparison — done.** Under the cost breakdown: "৳850 below
  the average single room in Aftabnagar · Based on 3 other…". Like-for-like
  only (same `property_type`); same zone preferred, whole city as fallback,
  hidden below 2 comparables. Seed now has 4 Aftabnagar single rooms so it
  actually renders.
- **#7 similar listings / share / breadcrumb — done.** Similar listings are
  ranked by shared zone, shared type, and price within ±25%, from the *same*
  query as #6. `ShareButton` uses the native share sheet on phones, clipboard
  elsewhere. `ListingBreadcrumb` returns to the exact filtered results via
  `sessionStorage` (`LAST_RESULTS_KEY`, written by `ListingsClient`) —
  **not** `document.referrer`, which client-side navigation never updates.
- **#8 multi-zone + chips + full map — done.** `zone` is now a
  comma-separated list (`.in('zone_id', …)`). Removable chips are built from
  the **URL** (applied filters), not the sidebar draft. The map pins every
  match, not just the current page, via a second lean query that reuses the
  same filters (`filtered(columns)` in `page.tsx`).
- **#10a application withdrawal — done.** `withdrawApplication(listingId)`
  on the listing page and the dashboard's Applications Sent table.
  `application_status` has no `withdrawn` value and applicants have no DELETE
  policy, so the pending row is deleted with the service role — only after
  ownership + pending status are verified through the user's own RLS client,
  and the delete re-asserts both. The landlord is notified.
- **#10b email — done, inactive until configured.** `lib/email.ts` sends via
  Resend's REST API (no SDK) from `createUserNotification`, only for
  high-signal types (applications, offers, verification, saved-search
  matches — not comments/votes). No-op unless `RESEND_API_KEY` +
  `EMAIL_FROM` are set; `NEXT_PUBLIC_SITE_URL` makes links absolute. User
  text is HTML-escaped; 5s timeout so a slow provider can't stall an action.
- **#5 saved searches + alerts — done, needs migration 0006.** Stored as a
  *canonical* query string (`canonicalSearch` in `lib/savedSearch.ts`: fixed
  key order, sorted lists, page/sort/defaults dropped) so equivalent searches
  dedupe. `CreateListingModal` calls `notifySavedSearchMatches` after
  publishing. The matcher `listingMatchesSearch` **must stay in step with the
  filters in `app/listings/page.tsx`** — it was checked against the live page
  on 11 queries and agreed on all. `saved_search_alerts` PK makes alerts
  idempotent; a 30-min window stops the client-callable action re-announcing
  old listings. The UI stays hidden until the table exists.
  - **Gotcha:** `savedSearchesAvailable` must use a real GET. With
    `{ head: true }`, PostgREST's "table not found" error has no body to
    carry, so supabase-js returns `error: null` — even for a table named
    `definitely_not_a_table`. Don't use `head: true` as an existence check.

## Compatibility, comment deletion, avatar removal (2026-09-18)

- **The 8-dimension compatibility score existed only in marketing copy.**
  The homepage promised it, `user_preferences` stored the inputs, and
  `.compat-circle` sat unused in the CSS — nothing ever computed a score.
  `lib/compatibility.ts` now does: eight weighted dimensions (sleep 16,
  cleanliness 16, noise 14, guests 12, smoking 12, diet 12, gender 10,
  study hours 8), each 0–1, summed to 0–100. A shared "flexible" answer
  scores 0.85, not 1 — it means neither side has a constraint, not that
  they want the same thing. The listing's own `gender_pref` overrides the
  lister's personal answer for that dimension, since the house rule is
  what actually applies to a viewer.
- **It compares the viewer to the lister** — deliberately not to the
  current occupants. Who lives where is only visible through
  `applications`, whose RLS restricts SELECT to the applicant and the
  listing owner; surfacing it to browsers would need the service role and
  would leak the person→address link. `user_preferences` is world-readable
  by policy, so the lister comparison needs no privileged read.
- Consequence worth knowing: **only student-listed (peer) listings can
  ever score**, because `ProfileContent` shows the preferences form to
  students only, so a landlord has no preferences row. Landlord listings
  show nothing at all rather than a partial score. `scripts/seed-demo.mjs`
  therefore assigns `peer_listing` rows to a student owner (preferring one
  who has preferences) instead of the landlord — otherwise the feature is
  invisible in demo data, which is exactly how it was reported.
- Surfaces: a `.compat-pill` ("59% match") top-right of the card photo,
  opposite the status badges, and `components/CompatibilityCard.tsx` in
  the listing detail's right column — conic-gradient ring plus a bar per
  dimension with both sides' answers. When the lister has preferences and
  the viewer doesn't, the same card becomes the prompt to fill them in.
- **Own comments can be deleted.** `deleteComment` verifies authorship
  through the user's own client, then checks the affected row count: the
  comment tables were made by hand, so a DELETE their RLS doesn't allow
  returns success with zero rows rather than an error. Only then does it
  fall back to the service role, re-asserting `comment_id` + `user_id`,
  and it clears the vote rows first (no guaranteed ON DELETE CASCADE).
- **Profile pictures can be removed**, not just replaced. `AvatarUpload`
  gained an × opposite the camera badge; it nulls `profiles.profile_pic`
  and then best-effort deletes the storage object, only if the URL parses
  to `avatars/<own id>/…` inside the `uiunest` bucket. The DB row is the
  source of truth, so a storage policy that forbids delete must not turn
  this into a failed removal.
- **Verified with a real login.** A throwaway student account was created
  with the admin API, driven through Playwright (comment post → delete →
  reload, avatar removal → reload, compatibility card and pill in both
  themes), then deleted. That closes the "never clicked through, no test
  account" gap for these four features. The demo row "Two-seat shared
  room near Notun Bazar bus stand" was also re-pointed to the Student Test
  profile, matching what `peer_listing` means.

## Comment threads, mentions, vote counts (2026-09-18, later)

- **Vote counts never persisted.** `voteComment` recomputed the totals and
  wrote them to `listing_comments.upvotes/downvotes` — but the RLS policy on
  those hand-made tables only lets the AUTHOR update their row, so a voter's
  UPDATE matched zero rows and returned **no error**. The vote row itself stuck,
  so after a reload the arrow was still lit while the count read 0. Counts are
  now derived from the votes table on read (`fetchCommentsWithAuthors`, which
  also repairs rows that were already wrong) and written with the service role
  in `voteComment`, which returns the true totals so the optimistic UI can't
  drift either. **A zero-row write is the default failure mode on these
  tables — check the returned rows, never just `error`.**
- **Threaded replies + @mentions** need **migration 0007**, which also finally
  captures the four comment tables in a migration (reproducing the LIVE shape —
  bigint ids, no FK to profiles — rather than an idealised one, so fresh and
  running projects match). Until it's applied `commentThreadsAvailable` returns
  false and comments render flat, exactly as before; nothing breaks.
- Threads are **two levels, deliberately**: replying to a reply attaches to the
  same root and prefills an @mention instead, so threads can't march off the
  right edge. `parent_id` cascades, so deleting a parent takes its replies —
  the confirm dialog says how many.
- Mentions are stored **alongside** the text (`mentions` JSONB of
  `{id, name, slug}`), not parsed out of it: the body keeps "@Name" as plain
  text and the array is what links and notifies. The server re-resolves every
  id against `profiles` and rebuilds the array — the client's copy is never
  trusted — and a private profile stores `slug: null` so it renders unlinked.
  The autocomplete only offers people **already in the thread plus the owner**;
  it is not a search over all users, which would make the comment box a
  directory.
- New notification types `comment_reply` and `comment_mention`. One per
  person per comment — a reply that also mentions you on your own listing
  arrives once, not three times. Neither emails (`EMAIL_SUBJECTS` gates that).
- **Deleting a comment now clears its "X commented on your listing"
  notification**, but only when it was that author's last comment there — a
  notification pointing at a comment that no longer exists is how this was
  reported.
- **Exchange price slider capped at ৳20,000**, and the filter ran at any
  position, so an AC or a laptop could not be shown *at all*. Ceiling is now
  60,000 and the top of the range means "Any" (same pattern as the listings
  budget), which is also the new default.
- `scripts/seed-demo.mjs` also seeds **7 marketplace items** (`--clean`
  removes them), owned by a student — the Exchange had two hand-made rows and
  nothing to look at.
- Demo account for click-testing: **student@test.com / 1234Student**
  ("Student Test 2", has preferences, so compatibility renders against the
  peer listing owned by Student Test).

**Migrations not yet applied (checked 2026-09-18):** 0004 (zone rename),
0005 (total_monthly trigger), 0006 (saved searches), 0007 (comment threads +
mentions).

**Still open:**
- `expected_vacate_date` is displayed but no form collects it.
- ~~The comment tables exist in the live DB but in no migration.~~ Captured
  in 0007 (not yet applied).
- Admin/verification screens and the remaining logged-in flows (photo
  editor, contact reveal, withdrawal, saved-search UI) are still verified
  by typecheck and query-shape checks only. The Playwright + throwaway
  account recipe above is the way to close these too.

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
