/**
 * Moves identity-verification documents out of the PUBLIC 'uiunest' bucket
 * into the PRIVATE 'verifications' bucket (created by migration 0009).
 *
 *   node scripts/migrate-verification-docs.mjs
 *       Dry run (the default). Reports what it would move. Changes nothing.
 *
 *   node scripts/migrate-verification-docs.mjs --apply
 *       Copies each document to the private bucket, checks the copy is the
 *       same size, then points the database row at the new path. The public
 *       copy is left in place.
 *
 *   node scripts/migrate-verification-docs.mjs --apply --delete-originals
 *       As above, and then deletes the public copy once its private copy has
 *       been verified. Run this only after you have opened a few migrated
 *       documents from the admin screen and confirmed they display.
 *
 * Also handles documents that were uploaded but never got a database row
 * ("orphans"): they are copied to the private bucket and, with
 * --delete-originals, removed from the public one.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * It writes past RLS, so run it from your own machine only. It never prints
 * keys or document URLs.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const apply = process.argv.includes('--apply');
const deleteOriginals = process.argv.includes('--delete-originals');
if (deleteOriginals && !apply) {
  console.error('--delete-originals only makes sense together with --apply.');
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = readFileSync(join(root, '.env.local'), 'utf8');
const envVar = (k) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim();

const url = envVar('NEXT_PUBLIC_SUPABASE_URL');
const serviceKey = envVar('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });
const PUBLIC_BUCKET = 'uiunest';
const PRIVATE_BUCKET = 'verifications';
const LEGACY_URL = new RegExp(`/storage/v1/object/public/${PUBLIC_BUCKET}/(.+)$`);

const MIME_BY_EXT = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf',
};

// Refuse to run if the private bucket is missing or, worse, public.
const { data: bucket, error: bucketError } = await db.storage.getBucket(PRIVATE_BUCKET);
if (bucketError || !bucket) {
  console.error(`The '${PRIVATE_BUCKET}' bucket does not exist. Apply migration 0009 first.`);
  process.exit(1);
}
if (bucket.public) {
  console.error(`The '${PRIVATE_BUCKET}' bucket is marked public. Make it private before moving documents into it.`);
  process.exit(1);
}

// 1. Rows that still point at a public URL.
const { data: rows, error: rowsError } = await db
  .from('verifications')
  .select('verification_id, document_path');
if (rowsError) {
  console.error('Could not read verifications:', rowsError.message);
  process.exit(1);
}

const legacyRows = [];
for (const r of rows) {
  const m = typeof r.document_path === 'string' && r.document_path.match(LEGACY_URL);
  if (m) legacyRows.push({ id: r.verification_id, path: decodeURIComponent(m[1]) });
}
const referenced = new Set(legacyRows.map((r) => r.path));

// 2. Files sitting in <user>/verifications/ in the public bucket with no row ("orphans").
async function listAll(prefix) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(PUBLIC_BUCKET).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`Could not list '${prefix || '/'}': ${error.message}`);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

const orphans = [];
for (const entry of await listAll('')) {
  if (entry.id) continue; // a file at the top level, not a user folder
  for (const f of await listAll(`${entry.name}/verifications`)) {
    if (!f.id) continue;
    const path = `${entry.name}/verifications/${f.name}`;
    if (!referenced.has(path)) orphans.push({ id: null, path });
  }
}

console.log(`Documents referenced by a database row (public URL): ${legacyRows.length}`);
console.log(`Documents with no database row (orphans):            ${orphans.length}`);
console.log(`Mode: ${apply ? (deleteOriginals ? 'APPLY + DELETE ORIGINALS' : 'APPLY (originals kept)') : 'DRY RUN (nothing will change)'}`);

if (!apply) {
  console.log('\nRe-run with --apply to copy them to the private bucket.');
  process.exit(0);
}

// 3. Move one document: copy, verify, repoint, optionally delete the original.
async function moveOne({ id, path }) {
  const { data: blob, error: dlError } = await db.storage.from(PUBLIC_BUCKET).download(path);
  if (dlError || !blob) throw new Error(`download failed: ${dlError?.message}`);
  if (blob.size === 0) throw new Error('file is empty');

  const ext = path.split('.').pop().toLowerCase();
  const contentType = MIME_BY_EXT[ext] || blob.type || 'application/octet-stream';
  const bytes = Buffer.from(await blob.arrayBuffer());

  const { error: upError } = await db.storage.from(PRIVATE_BUCKET).upload(path, bytes, { contentType, upsert: false });
  // "already exists" is fine on a re-run, as long as the copy checks out below.
  if (upError && !/exists|duplicate/i.test(upError.message)) throw new Error(`upload failed: ${upError.message}`);

  const { data: copy, error: verifyError } = await db.storage.from(PRIVATE_BUCKET).download(path);
  if (verifyError || !copy || copy.size !== blob.size) throw new Error('copy could not be verified; original left untouched');

  if (id !== null) {
    const { error: updError } = await db
      .from('verifications')
      .update({ document_path: path })
      .eq('verification_id', id);
    if (updError) throw new Error(`database update failed: ${updError.message}`);
  }

  if (deleteOriginals) {
    const { error: rmError } = await db.storage.from(PUBLIC_BUCKET).remove([path]);
    if (rmError) throw new Error(`copied, but could not delete the public original: ${rmError.message}`);
  }
}

let moved = 0;
const failures = [];
for (const item of [...legacyRows, ...orphans]) {
  const label = item.id !== null ? `row #${item.id}` : 'orphan';
  try {
    await moveOne(item);
    moved += 1;
    console.log(`  ok    ${label}`);
  } catch (e) {
    failures.push(label);
    console.error(`  FAIL  ${label}: ${e.message}`);
  }
}

console.log(`\nMoved ${moved} of ${legacyRows.length + orphans.length}. Failures: ${failures.length}.`);
if (!deleteOriginals && moved > 0) {
  console.log('The public copies are still in place. After checking a few documents in the admin screen, re-run with --apply --delete-originals.');
}
process.exit(failures.length ? 1 : 0);
