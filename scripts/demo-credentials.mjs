/**
 * Local login details for the demo accounts, and a guard for the seed scripts.
 *
 * The demo accounts used to have fixed passwords written into the README and
 * the scripts, so anyone who could read the repository could log in to them,
 * including as an admin. Now each account gets its own random password, kept
 * only in `.env.demo-accounts` at the project root. That file starts with
 * ".env", which .gitignore already excludes, so it is never committed.
 *
 *   - Run `node scripts/create-demo-accounts.mjs --allow-remote` once to create
 *     the accounts and the file, then open the file to see the logins.
 *   - Delete a line from the file to give that account a new password the next
 *     time the script runs.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CREDENTIALS_FILE = join(root, '.env.demo-accounts');

const HEADER = [
  '# Demo account logins for local testing.',
  '# Private: this file is git-ignored. Do not share it or paste it anywhere.',
  '# Created by scripts/demo-credentials.mjs. Delete a *_PASSWORD line to get a',
  '# new random password for that account the next time the script runs.',
  '',
].join('\n');

const newPassword = () => randomBytes(18).toString('base64url'); // 24 characters

function readFile() {
  if (!existsSync(CREDENTIALS_FILE)) return {};
  const values = {};
  for (const line of readFileSync(CREDENTIALS_FILE, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) values[m[1]] = m[2].trim();
  }
  return values;
}

/**
 * Returns { [key]: password } for the given accounts ({ key, email }[]),
 * creating a random password for any that does not have one yet and saving the
 * file. Existing passwords are kept, so the accounts keep working between runs.
 */
export function loadDemoPasswords(accounts) {
  const values = readFile();
  let changed = !existsSync(CREDENTIALS_FILE);
  const passwords = {};

  for (const { key, email } of accounts) {
    const prefix = key.toUpperCase();
    if (values[`${prefix}_EMAIL`] !== email) { values[`${prefix}_EMAIL`] = email; changed = true; }
    if (!values[`${prefix}_PASSWORD`]) { values[`${prefix}_PASSWORD`] = newPassword(); changed = true; }
    passwords[key] = values[`${prefix}_PASSWORD`];
  }

  if (changed) {
    const body = accounts
      .map(({ key }) => `${key.toUpperCase()}_EMAIL=${values[`${key.toUpperCase()}_EMAIL`]}\n${key.toUpperCase()}_PASSWORD=${values[`${key.toUpperCase()}_PASSWORD`]}\n`)
      .join('\n');
    writeFileSync(CREDENTIALS_FILE, `${HEADER}\n${body}`, { encoding: 'utf8', mode: 0o600 });
  }
  return passwords;
}

/** Returns { [key]: { email, password } } from the file; throws if it is missing. */
export function loadDemoLogins(keys) {
  if (!existsSync(CREDENTIALS_FILE)) {
    throw new Error(
      'No demo logins found. Run `node scripts/create-demo-accounts.mjs --allow-remote` first; ' +
      'it creates the accounts and the private file .env.demo-accounts.'
    );
  }
  const values = readFile();
  const logins = {};
  for (const key of keys) {
    const prefix = key.toUpperCase();
    const email = values[`${prefix}_EMAIL`];
    const password = values[`${prefix}_PASSWORD`];
    if (!email || !password) throw new Error(`.env.demo-accounts has no login for "${key}". Re-run create-demo-accounts.mjs.`);
    logins[key] = { email, password };
  }
  return logins;
}

/**
 * The seed scripts write with the service-role key, past every security rule.
 * Refuse to run them against anything but a local Supabase unless the person
 * running them says so explicitly, so a stray command cannot touch live data.
 */
export function assertSafeTarget(supabaseUrl, argv = process.argv, env = process.env) {
  let host = '';
  try { host = new URL(supabaseUrl).hostname; } catch { /* handled below */ }

  const isLocal = ['localhost', '127.0.0.1', '::1', '[::1]', 'host.docker.internal'].includes(host);
  const allowed = argv.includes('--allow-remote') || env.DEMO_ALLOW_REMOTE === '1';
  if (isLocal || allowed) return;

  console.error(
    `Refusing to run: NEXT_PUBLIC_SUPABASE_URL points at a remote project (${host || 'unreadable URL'}).\n` +
    'This script writes past all security rules. If you really mean to run it against that\n' +
    'project, add --allow-remote (or set DEMO_ALLOW_REMOTE=1).'
  );
  process.exit(1);
}
