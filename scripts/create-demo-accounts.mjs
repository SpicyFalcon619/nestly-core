/**
 * Creates (or repairs) the four demo accounts: student, student2, landlord and
 * admin. It does not add any listings or items; for those use seed-demo.mjs.
 *
 *   node scripts/create-demo-accounts.mjs --allow-remote
 *
 * Each account gets a strong random password, saved only in the private,
 * git-ignored file .env.demo-accounts at the project root. Open that file to
 * see the logins. If an account already exists its password is reset to the one
 * in the file, so any older, published password stops working.
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * It writes past all security rules, so it refuses to run against a remote
 * project unless you pass --allow-remote.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { ensureDemoAccounts } from './demo-accounts.mjs';
import { assertSafeTarget, CREDENTIALS_FILE } from './demo-credentials.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = readFileSync(join(root, '.env.local'), 'utf8');
const envVar = (k) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim();

const url = envVar('NEXT_PUBLIC_SUPABASE_URL');
const serviceKey = envVar('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
assertSafeTarget(url);

const db = createClient(url, serviceKey, { auth: { persistSession: false } });
const accounts = await ensureDemoAccounts(db);

console.log(`\n${Object.keys(accounts).length} demo account(s) ready.`);
console.log(`Logins are in: ${CREDENTIALS_FILE}`);
console.log('That file is private and git-ignored. Open it to copy an email and password.');
