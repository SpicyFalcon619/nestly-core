/**
 * Exports the running app as self-contained static HTML, one file per screen,
 * for import into Figma (html.to.design) or any other design tool.
 *
 *   npm run dev                          # in another terminal
 *   node scripts/export-static-html.mjs  # writes ./figma-export
 *
 * Requires Playwright, which is NOT a dependency of this project:
 *   npm i -D playwright && npx playwright install chromium
 *
 * Each file is standalone: stylesheets are inlined, scripts are stripped, and
 * every image is either a remote https URL or a data: URI — nothing points at
 * localhost, because the design tool rendering the file can't reach it.
 *
 * Screens that need a logged-in role use the demo accounts from
 * scripts/demo-accounts.mjs, so run `node scripts/seed-demo.mjs` first.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const BASE = process.env.EXPORT_BASE_URL || 'http://localhost:3000';
const OUT = resolve(process.env.EXPORT_OUT || 'figma-export');
// SKIP_DESKTOP=1 / SKIP_MOBILE=1 node scripts/export-static-html.mjs — for a
// change that only affects one viewport (a mobile media query, say):
// re-running all 36 desktop screens to verify an 8-screen mobile-only fix is
// pure waste, and vice versa.
const DO_DESKTOP = process.env.SKIP_DESKTOP !== '1';
const DO_MOBILE = process.env.SKIP_MOBILE !== '1';

// 1440x1080 — matches the public screens, which are already imported AND
// wired into the shared Figma prototype. The other screens (student/
// landlord/admin) were imported at 1920x1080 by someone else, but nothing on
// them has been wired yet — so THOSE are what get re-exported and swapped,
// not the finished public ones. Don't change this back to 1920 without
// checking whether the public prototype work is still the thing not to lose.
const DESKTOP = { width: 1440, height: 1080 };
const MOBILE = { width: 390, height: 844 };

const ACCOUNTS = {
  student: { email: 'student@test.com', password: '1234Student' },
  // Only for the two exchange-item screens below: student@test.com (used for
  // every other student screen) owns no marketplace items in the seed data —
  // student2 does — so it's the only account that shows a non-empty state.
  student2: { email: 'student2@test.com', password: '1234Student' },
  landlord: { email: 'landlord@test.com', password: '1234Landlord' },
  admin: { email: 'admin@test.com', password: '1234Admin' },
};

/**
 * role: null means logged out.
 * open: an optional async (page) => {} that puts the screen into a state a URL
 * alone can't reach — an open modal, say.
 */
const SCREENS = [
  // ── Public (logged out) ──
  { role: null, name: 'public-home', path: '/' },
  { role: null, name: 'public-browse-listings', path: '/listings' },
  { role: null, name: 'public-browse-filtered', path: '/listings?zone=5&type=single_room&budget=20000' },
  { role: null, name: 'public-listing-detail', path: '/listings/2' },
  { role: null, name: 'public-exchange', path: '/exchange' },
  { role: null, name: 'public-exchange-item', path: '/exchange/3' },
  { role: null, name: 'public-seeking', path: '/seeking' },
  { role: null, name: 'public-login', path: '/login' },
  { role: null, name: 'public-register', path: '/register' },

  // ── Student ──
  { role: 'student', name: 'student-dashboard', path: '/dashboard' },
  { role: 'student', name: 'student-dashboard-applications', path: '/dashboard?tab=applications' },
  { role: 'student', name: 'student-dashboard-watchlist', path: '/dashboard?tab=watch' },
  { role: 'student', name: 'student-dashboard-offers', path: '/dashboard?tab=offers' },
  { role: 'student', name: 'student-dashboard-activity', path: '/dashboard?tab=activity' },
  { role: 'student', name: 'student-dashboard-seeking', path: '/dashboard?tab=seeking' },
  // Exchange Items tab, captured under student2 — see the ACCOUNTS note above.
  { role: 'student2', name: 'student-dashboard-items', path: '/dashboard?tab=items' },
  // Listing 8 is "Seat free in a three-seat room, Sayed Nagar" — the first row
  // in student@test.com's own "My Properties" table, so this is genuinely
  // where that row's View button leads: owner view (StatusChanger), not Apply.
  { role: 'student', name: 'student-listing-detail-owner', path: '/listings/8' },
  { role: 'student', name: 'student-exchange-item-offer', path: '/exchange/5' },
  // Item 3 ("Study desk with bookshelf, 4ft") is owned by student2 — same
  // reasoning as student-dashboard-items above: owner view (offers list,
  // no Make Offer form), matching what a View click from that tab reaches.
  { role: 'student2', name: 'student-exchange-item-owner', path: '/exchange/3' },
  { role: 'student', name: 'student-profile-preferences', path: '/profile' },
  { role: 'student', name: 'student-notifications', path: '/notifications' },
  { role: 'student', name: 'student-messages', path: '/messages' },
  { role: 'student', name: 'student-public-profile', path: '/profiles/student-test-80b0' },

  // ── Landlord ──
  { role: 'landlord', name: 'landlord-dashboard-listings', path: '/dashboard' },
  { role: 'landlord', name: 'landlord-dashboard-applications', path: '/dashboard?tab=applications' },
  { role: 'landlord', name: 'landlord-listing-detail-owner', path: '/listings/2' },
  {
    role: 'landlord', name: 'landlord-create-listing-modal', path: '/listings?new=1',
    // The modal is client state; ?new=1 opens it, this just waits for it.
    open: async (page) => { await page.waitForSelector('.modal-bg', { timeout: 15000 }); },
  },
  { role: 'landlord', name: 'landlord-bills', path: '/bills' },
  { role: 'landlord', name: 'landlord-profile-house-rules', path: '/profile' },

  // ── Admin ──
  { role: 'admin', name: 'admin-overview', path: '/admin' },
  { role: 'admin', name: 'admin-users-listings', path: '/admin?tab=users' },
  { role: 'admin', name: 'admin-verifications', path: '/admin?tab=verifications' },
  { role: 'admin', name: 'admin-complaints', path: '/admin?tab=complaints' },
  { role: 'admin', name: 'admin-notifications', path: '/admin?tab=notifications' },

  // ── Added after the first import pass — appended here, not sorted back
  // into the sections above, so none of the existing file numbers shift and
  // anything already imported into Figma stays correctly matched. ──

  // The landlord dashboard has an "Exchange Items" tab too (landlords can
  // sell secondhand furniture same as students) — it just never had a screen
  // captured for it before.
  { role: 'landlord', name: 'landlord-dashboard-items', path: '/dashboard?tab=items' },
  // "Bills" (Mess Bill Manager) has no page or dashboard tab that links to
  // it — the only way there in the real app is the avatar dropdown in the
  // top-right of the navbar, which is closed by default, so no earlier
  // screen had a visible "Bills" link to wire a click from. This one opens
  // that dropdown so the link actually exists on a captured screen.
  {
    // Two different menus, not one that just relocates: below 900px the
    // navbar swaps the avatar dropdown for a bottom-sheet opened from the
    // account icon in the floating pill nav — different trigger, different
    // panel. openAccountMenu() (below) picks the right one per viewport.
    role: 'landlord', name: 'landlord-account-menu', path: '/dashboard',
    open: openAccountMenu,
  },

  // Same idea, for the student side — the mobile bottom nav's account icon
  // opens this same sheet, and without a captured screen for it, "Watchlist"
  // and "Bills" have no real source to wire from in the student flow either.
  {
    role: 'student', name: 'student-account-menu', path: '/dashboard',
    open: openAccountMenu,
  },
];

const ALL_SCREEN_NAMES = SCREENS.map(s => s.name);

// Desktop is the full multi-role prototype (all 4 roles) — that one stays
// complete. Mobile is only meant to demonstrate what the app looks like on a
// phone, not a second full prototype, so it's a short, student-only walk:
// browse → a listing → the marketplace → an item → the dashboard → profile.
// No landlord/admin, no auth screens, nowhere near all 36.
const MOBILE_SCREENS = [
  'public-home',
  'public-browse-listings',
  'public-listing-detail',
  'public-seeking',
  'public-exchange',
  'public-exchange-item',
  'student-dashboard',
  'student-dashboard-watchlist',
  'student-dashboard-items',
  'student-listing-detail-owner',
  'student-exchange-item-owner',
  'student-notifications',
  'student-profile-preferences',
  'student-account-menu',
];
const DARK_SCREENS = [];

/** Everything that makes a snapshot reproducible rather than mid-animation. */
const FREEZE_CSS = `
/* Added by scripts/export-static-html.mjs — keeps the capture still. */
*, *::before, *::after {
  animation: none !important;
  transition: none !important;
  caret-color: transparent !important;
}
`;

/**
 * Opens the avatar dropdown (desktop) or the account bottom-sheet (mobile) —
 * shared by landlord-account-menu and student-account-menu. Retries the
 * click a few times: on a cold dev server the very first visit to a route
 * can still be compiling when the earlier fixed wait elapses, so the button
 * exists and looks clickable but the sheet doesn't open on the first try —
 * caught empirically (worked reliably at a 3s wait, was flaky at 1.8s).
 */
async function openAccountMenu(page) {
  const wide = page.viewportSize().width >= 900;
  const [trigger, panel] = wide ? ['#avatarBtn', '#avatarMenu'] : ['.mobile-account-btn', '#mobileAccountSheet'];
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.click(trigger);
    const opened = await page.waitForSelector(panel, { timeout: 4000 }).then(() => true).catch(() => false);
    if (opened) return;
  }
  throw new Error(`Account menu (${panel}) did not open after 3 attempts.`);
}

/**
 * The `.catch(() => {})` here used to swallow a failed login outright — the
 * browser context stayed logged out, and every screen for that role silently
 * captured the login page instead of its real content, with nothing in the
 * output to say so (the run still exits 0). Now it retries once, then throws
 * — a loud failure for one role beats a quiet wrong screenshot for a dozen.
 */
async function login(context, role) {
  const account = ACCOUNTS[role];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const page = await context.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="text"]', account.email);
    await page.fill('input[type="password"]', account.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|admin|\/$/, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const onLoginPage = page.url().includes('/login');
    await page.close();
    if (!onLoginPage) return;
    console.error(`login attempt ${attempt} for ${role} (${account.email}) did not leave /login — retrying`);
  }
  throw new Error(`Could not log in as ${role} (${account.email}) after 2 attempts.`);
}

/** Scrolls the whole page so lazy images decode before we freeze the DOM. */
async function settle(page) {
  await page.evaluate(async () => {
    const step = 600;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 80));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1200);
}

/**
 * Serialises the live DOM into a standalone document:
 * stylesheets inlined, scripts removed, images made portable.
 */
async function serialize(page, freezeCss) {
  return page.evaluate(async (freeze) => {
    // 1. Inline same-origin stylesheets. Remote ones (Google Fonts) are left
    //    as links — the design tool can fetch those itself.
    for (const link of [...document.querySelectorAll('link[rel="stylesheet"]')]) {
      const href = link.href || '';
      if (!href.startsWith(location.origin)) continue;
      try {
        const css = await (await fetch(href)).text();
        const style = document.createElement('style');
        style.textContent = css;
        link.replaceWith(style);
      } catch { /* leave the link; worst case one sheet is missing */ }
    }

    // 2. Images. next/image rewrites everything to /_next/image?url=…, which
    //    only this dev server can serve — unwrap it back to the original.
    const asDataUri = async (url) => {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        if (blob.size > 500_000) return null; // too big to inline sensibly
        return await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch { return null; }
    };

    for (const img of [...document.querySelectorAll('img')]) {
      let src = img.currentSrc || img.src || '';
      const wrapped = src.includes('/_next/image') && src.match(/[?&]url=([^&]+)/);
      if (wrapped) src = decodeURIComponent(wrapped[1]);
      if (src.startsWith('/')) src = location.origin + src;

      // Anything still served by this machine has to travel inside the file.
      if (src.startsWith(location.origin)) {
        const inlined = await asDataUri(src);
        if (inlined) src = inlined;
      }
      img.setAttribute('src', src);
      img.removeAttribute('srcset');
      img.removeAttribute('loading');
      img.removeAttribute('decoding');
    }

    // 3. Strip anything that only makes sense in a live app.
    document.querySelectorAll(
      'script, noscript, template, nextjs-portal, next-route-announcer, [data-nextjs-dialog], iframe'
    ).forEach(node => node.remove());

    // 4. Freeze animations so the capture is deterministic.
    const style = document.createElement('style');
    style.textContent = freeze;
    document.head.appendChild(style);

    return '<!doctype html>\n' + document.documentElement.outerHTML;
  }, freezeCss);
}

async function capture(context, screen, { viewport, theme, dir, index }) {
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  await page.addInitScript(t => {
    try { localStorage.setItem('theme', t); } catch { /* private mode */ }
  }, theme);

  await page.goto(BASE + screen.path, { waitUntil: 'networkidle', timeout: 45000 });
  // A role screen that lands on /login means the session died mid-run (see
  // the login() comment) — catch it here too, not just at sign-in, in case a
  // session expires partway through a long export rather than at the start.
  if (screen.role && page.url().includes('/login')) {
    await page.close();
    throw new Error(`Session for role "${screen.role}" was logged out before capturing "${screen.name}".`);
  }
  await page.waitForTimeout(1800);
  if (screen.open) await screen.open(page);
  await settle(page);

  const html = await serialize(page, FREEZE_CSS);
  const file = join(dir, `${String(index).padStart(2, '0')}-${screen.name}.html`);
  await writeFile(file, html, 'utf8');
  await page.close();
  return { file, bytes: html.length };
}

async function run() {
  const browser = await chromium.launch();
  const contexts = { public: await browser.newContext() };
  for (const role of Object.keys(ACCOUNTS)) {
    contexts[role] = await browser.newContext();
    await login(contexts[role], role);
    console.log(`signed in: ${role}`);
  }

  const desktopDir = join(OUT, 'desktop');
  const mobileDir = join(OUT, 'mobile');
  const darkDir = join(OUT, 'dark');
  for (const dir of [desktopDir, mobileDir, darkDir]) await mkdir(dir, { recursive: true });

  let i = 0;
  for (const screen of SCREENS) {
    i += 1;
    const context = contexts[screen.role ?? 'public'];
    try {
      // `i` still increments for every screen even when desktop is skipped,
      // so a mobile-only run keeps the same file numbers a full run would
      // give it (e.g. mobile's "10-student-dashboard" stays 10, not
      // renumbered to its position among only the mobile subset).
      if (DO_DESKTOP) {
        const { bytes } = await capture(context, screen, {
          viewport: DESKTOP, theme: 'light', dir: desktopDir, index: i,
        });
        console.log(`desktop  ${screen.name}  ${(bytes / 1024).toFixed(0)} KB`);
      }

      if (DO_MOBILE && MOBILE_SCREENS.includes(screen.name)) {
        await capture(context, screen, { viewport: MOBILE, theme: 'light', dir: mobileDir, index: i });
        console.log(`  mobile  ${screen.name}`);
      }
      if (DARK_SCREENS.includes(screen.name)) {
        await capture(context, screen, { viewport: DESKTOP, theme: 'dark', dir: darkDir, index: i });
        console.log(`  dark    ${screen.name}`);
      }
    } catch (err) {
      console.error(`FAILED   ${screen.name}: ${err.message}`);
    }
  }

  await browser.close();
  console.log(`\nWrote ${OUT}`);
}

await run();
