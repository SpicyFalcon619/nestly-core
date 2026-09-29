/**
 * Stages (and re-stages) the exact data the demo-video flows need, on top of
 * whatever scripts/seed-demo.mjs already created. Run it before every take:
 *
 *   node scripts/seed-video.mjs
 *
 * Idempotent and safe to run twice in a row: every fixture below is matched
 * by a stable identifying marker (a listing+applicant pair, an item title, a
 * conversation's participants, …) and its mutable fields — status, is_read,
 * counter_price — are FORCED back to the target value on every run, not just
 * set once on insert. That's what makes this script double as the reset
 * command: filming an "accept application" or "accept offer" take changes
 * real rows (listing -> occupied, item -> sold); running this again puts
 * them back to pending/available without touching anything it doesn't own.
 *
 * Never touches a row it didn't create: every match is by exact title,
 * email, or a specific id pair belonging to the four demo accounts, the same
 * safety property scripts/seed-demo.mjs already relies on. Writes with the
 * service role key against the SAME Supabase project the deployed site
 * uses — this is shared data, not a local sandbox.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = readFileSync(join(root, '.env.local'), 'utf8');
const envVar = (k) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim();

const url = envVar('NEXT_PUBLIC_SUPABASE_URL');
const serviceKey = envVar('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const db = createClient(url, serviceKey);

async function must(label, promise) {
  const { data, error } = await promise;
  if (error) { console.error(`FAILED  ${label}: ${error.message}`); return null; }
  return data;
}

async function main() {
  // ── Resolve the four demo accounts by email — never hardcode ids, the
  //    real ones only exist once demo-accounts.mjs has run. ──
  const { data: profiles } = await db.from('profiles').select('id, name, email')
    .in('email', ['student@test.com', 'student2@test.com', 'landlord@test.com', 'admin@test.com']);
  const byEmail = Object.fromEntries((profiles || []).map(p => [p.email, p]));
  const student = byEmail['student@test.com'];
  const student2 = byEmail['student2@test.com'];
  const landlord = byEmail['landlord@test.com'];
  if (!student || !student2 || !landlord) {
    console.error('Demo accounts missing — run `node scripts/seed-demo.mjs` first.');
    process.exit(1);
  }

  const { data: zones } = await db.from('zones').select('zone_id, zone_name');
  const zoneId = (name) => zones?.find(z => z.zone_name === name)?.zone_id ?? zones?.[0]?.zone_id;

  // ── 1. Applications: one to accept, one to reject ──────────────────────
  // Listings 2 and 7 (both landlord@test.com, both "available") are used
  // here; listing 5 is deliberately left with no application so the live
  // "renter applies" take has a real empty form to fill in.
  const { data: landlordListings } = await db.from('listings')
    .select('listing_id, title').eq('user_id', landlord.id);
  const findListing = (needle) => landlordListings?.find(l => l.title.includes(needle));
  const acceptTarget = findListing('Furnished single room in Aftabnagar');
  const rejectTarget = findListing('Quiet single room for final-year students');

  for (const [target, message] of [
    [acceptTarget, "Hi, I'm very interested in this room — is it still available? I can move in as early as next week."],
    [rejectTarget, "Hi, would love to view this place before the weekend if that works for you."],
  ]) {
    if (!target) { console.error('Could not find a landlord listing to attach an application to.'); continue; }
    const { data: existing } = await db.from('applications')
      .select('application_id').eq('listing_id', target.listing_id).eq('applicant_id', student.id).maybeSingle();
    if (existing) {
      await must(`reset application on "${target.title}"`,
        db.from('applications').update({ status: 'pending' }).eq('application_id', existing.application_id));
      // Filming "accept" also flips the listing to occupied — put it back.
      await db.from('listings').update({ status: 'available' }).eq('listing_id', target.listing_id);
    } else {
      await must(`create application on "${target.title}"`,
        db.from('applications').insert({ listing_id: target.listing_id, applicant_id: student.id, message, status: 'pending' }));
    }
  }

  // Listing 5 ("Single room with balcony, Aftabnagar Block D") is left free
  // on purpose for the LIVE renter-applies take — but filming that take
  // creates a real application, same as it would for a real user. Delete it
  // (not just reset its status, there's nothing to reset back to — it
  // shouldn't exist between takes) so the next take starts from a genuinely
  // empty form again, not a listing that already shows "Application sent".
  const liveApplyTarget = findListing('Single room with balcony');
  if (liveApplyTarget) {
    const { data: stray } = await db.from('applications')
      .select('application_id').eq('listing_id', liveApplyTarget.listing_id).eq('applicant_id', student.id);
    if (stray?.length) {
      await must('clear the live-apply take\'s application on listing 5',
        db.from('applications').delete().eq('listing_id', liveApplyTarget.listing_id).eq('applicant_id', student.id));
    }
    await db.from('listings').update({ status: 'available' }).eq('listing_id', liveApplyTarget.listing_id);
  }
  console.log('applications  ready (2 pending; listing 5 cleared for the next live apply take)');

  // ── 2. Verification: already seeded pending by demo-accounts.mjs — just
  //    force it back to pending in case a take approved it. ──────────────
  const { data: verif } = await db.from('verifications')
    .select('verification_id, status').eq('user_id', student.id).order('verification_id', { ascending: false }).limit(1).maybeSingle();
  if (verif) {
    await must('reset verification to pending', db.from('verifications').update({ status: 'pending' }).eq('verification_id', verif.verification_id));
  } else {
    await must('create pending verification', db.from('verifications').insert({
      user_id: student.id, nid_type: 'National ID', document_path: 'demo://video-verification', status: 'pending',
    }));
  }
  console.log('verification  ready (pending, for admin to approve)');

  // ── 3. Complaint: one open, for admin to resolve. ───────────────────────
  const COMPLAINT_DESC = "The internet cost wasn't mentioned anywhere in the listing — only found out it's billed separately after moving in.";
  const complaintTarget = findListing('Furnished single room in Aftabnagar');
  const { data: existingComplaint } = await db.from('complaints')
    .select('complaint_id').eq('description', COMPLAINT_DESC).maybeSingle();
  if (existingComplaint) {
    await must('reset complaint to submitted', db.from('complaints').update({ status: 'submitted', resolved_at: null }).eq('complaint_id', existingComplaint.complaint_id));
  } else {
    await must('create complaint', db.from('complaints').insert({
      complainant_id: student2.id, against_user_id: landlord.id, listing_id: complaintTarget?.listing_id ?? null,
      category: 'hidden_costs', description: COMPLAINT_DESC, status: 'submitted',
    }));
  }
  console.log('complaint     ready (submitted, for admin to resolve)');

  // ── 4. Seeking posts, so the Demand-vs-Supply chart has a "Seeking" bar
  //    to draw next to "Listings" — zero before this, so every zone's
  //    seeking count was 0 and that series was flat. Posted by student2 so
  //    student@test.com's own "Looking For" tab stays empty for live use. ─
  const SEEKING_MARKER = 'Posted for the demo video — safe to ignore.';
  const seekingFixtures = [
    { zone: 'Aftabnagar', budget_min: 6000, budget_max: 12000, property_type: 'single_room' },
    { zone: 'Sayed Nagar', budget_min: 4000, budget_max: 8000, property_type: 'shared_room' },
    { zone: 'Notun Bazar', budget_min: 5000, budget_max: 9000, property_type: 'any' },
  ];
  const { data: existingSeeking } = await db.from('seeking_posts')
    .select('post_id, zone_id').eq('user_id', student2.id).eq('requirements', SEEKING_MARKER);
  for (const fx of seekingFixtures) {
    const zid = zoneId(fx.zone);
    if ((existingSeeking || []).some(s => s.zone_id === zid)) continue;
    await must(`create seeking post in ${fx.zone}`, db.from('seeking_posts').insert({
      user_id: student2.id, zone_id: zid, budget_min: fx.budget_min, budget_max: fx.budget_max,
      property_type: fx.property_type, requirements: SEEKING_MARKER, status: 'active',
    }));
  }
  console.log('seeking posts ready (3 zones, for the Demand vs Supply chart)');

  // ── 5. Exchange item + a pending offer to counter on camera. ────────────
  const ITEM_TITLE = 'Mini table fan, works great';
  let { data: item } = await db.from('items').select('item_id, status').eq('title', ITEM_TITLE).eq('seller_id', student.id).maybeSingle();
  if (!item) {
    const inserted = await must('create exchange item for student@test.com', db.from('items').insert({
      seller_id: student.id, zone_id: zoneId('Aftabnagar'), category: 'appliances', title: ITEM_TITLE,
      description: 'Barely used table fan, three speeds, moving out so selling cheap.',
      item_condition: 'like_new', asking_price: 800,
      photo_url: 'https://picsum.photos/seed/nestly-video-fan/1200/900',
      photos: ['https://picsum.photos/seed/nestly-video-fan/1200/900'],
      status: 'available',
    }).select('item_id, status').single());
    item = inserted;
  } else if (item.status !== 'available') {
    await must('reset item to available', db.from('items').update({ status: 'available' }).eq('item_id', item.item_id));
  }

  if (item) {
    const { data: existingOffer } = await db.from('offers')
      .select('offer_id').eq('item_id', item.item_id).eq('buyer_id', student2.id).maybeSingle();
    if (existingOffer) {
      await must('reset offer to pending', db.from('offers').update({ status: 'pending', counter_price: null }).eq('offer_id', existingOffer.offer_id));
    } else {
      await must('create pending offer', db.from('offers').insert({
        item_id: item.item_id, buyer_id: student2.id, offer_price: 650,
        message: 'Would you take 650? I can pick up today.', status: 'pending',
      }));
    }
  }
  console.log('exchange item + offer ready (pending, for the seller to counter)');

  // ── 6. A conversation between student@test.com and landlord@test.com. ──
  // Ordering must match getOrCreateConversation() in app/actions/messages.ts
  // (lexicographic by id) or this creates a SECOND conversation instead of
  // the one the app itself would find.
  const [a, b] = student.id < landlord.id ? [student.id, landlord.id] : [landlord.id, student.id];
  let { data: convo } = await db.from('conversations')
    .select('id').eq('participant_a', a).eq('participant_b', b).is('listing_id', null).is('item_id', null).maybeSingle();
  if (!convo) {
    convo = await must('create conversation', db.from('conversations').insert({ participant_a: a, participant_b: b }).select('id').single());
  }
  if (convo) {
    const { data: existingMsgs } = await db.from('messages').select('id').eq('conversation_id', convo.id);
    if (!existingMsgs || existingMsgs.length === 0) {
      await must('seed conversation messages', db.from('messages').insert([
        { conversation_id: convo.id, sender_id: student.id, body: 'Hi! Is the room still available? Could I schedule a visit this weekend?', is_read: true },
        { conversation_id: convo.id, sender_id: landlord.id, body: "Hi! Yes it's still available. Saturday afternoon works on my end — does 4pm suit you?", is_read: false },
      ]));
    } else {
      // Force the last message back to unread so the inbox badge is there
      // for every take, even after someone opened the thread on camera.
      const lastId = existingMsgs[existingMsgs.length - 1]?.id;
      if (lastId) await db.from('messages').update({ is_read: false }).eq('id', lastId);
    }
  }
  console.log('conversation  ready (student <-> landlord, one unread)');

  // ── 7. A couple of unread notifications for the student. Landlord
  //    already has 7 unread from the regular seed — nothing to add there.
  //    Matched by exact message text (stable, and never a real URL like the
  //    `link` column is, so it's safe to use purely as an idempotency key). ─
  const NOTIF_MESSAGES = [
    'Landlord Demo sent you a message.',
    'Your identity verification is being reviewed.',
  ];
  const { data: existingNotifs } = await db.from('notifications')
    .select('notif_id, message').eq('user_id', student.id).in('message', NOTIF_MESSAGES);
  if (!existingNotifs || existingNotifs.length < NOTIF_MESSAGES.length) {
    const have = new Set((existingNotifs || []).map(n => n.message));
    const rows = [];
    if (!have.has(NOTIF_MESSAGES[0])) rows.push({ user_id: student.id, type: 'new_message', message: NOTIF_MESSAGES[0], link: `/messages/${convo?.id ?? ''}`, is_read: false });
    if (!have.has(NOTIF_MESSAGES[1])) rows.push({ user_id: student.id, type: 'verification', message: NOTIF_MESSAGES[1], link: '/profile', is_read: false });
    if (rows.length) await must('seed student notifications', db.from('notifications').insert(rows));
  }
  if (existingNotifs?.length) {
    await db.from('notifications').update({ is_read: false }).eq('user_id', student.id).in('message', NOTIF_MESSAGES);
  }
  console.log('notifications ready (student has unread; landlord already did)');

  // ── 8. Reviews — listing 5 already has one from an earlier session;
  //    add a second so the average looks like more than one opinion. ──────
  const reviewTarget = findListing('Single room with balcony');
  if (reviewTarget) {
    const { data: existingReview } = await db.from('reviews')
      .select('review_id').eq('listing_id', reviewTarget.listing_id).eq('reviewer_id', student2.id).maybeSingle();
    if (!existingReview) {
      await must('add second review', db.from('reviews').insert({
        listing_id: reviewTarget.listing_id, reviewer_id: student2.id,
        value_for_money: 4, listing_accuracy: 4, landlord_response: 5, cleanliness: 4, safety: 5,
        composite_score: 4.4, comment: 'Landlord was quick to respond and the place matched the listing exactly.',
      }));
    }
  }
  console.log('reviews       ready (listing 5 has 2 reviews)');

  console.log('\nDone. Safe to run again before every take.');
}

await main();
