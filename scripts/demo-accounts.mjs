/**
 * Demo accounts — one per role, so every screen in the app can be seen without
 * touching a real account.
 *
 * Used by seed-demo.mjs. Creating auth users needs the service role key, so
 * this is a development tool only. Accounts are matched by email: running it
 * twice updates the existing account instead of failing or duplicating.
 *
 * `seed-demo.mjs --clean` deliberately does NOT delete these accounts — they
 * accumulate comments, offers and messages that are worth keeping between
 * runs, and deleting an auth user takes all of it with them.
 */

export const DEMO_ACCOUNTS = [
  {
    key: 'student',
    email: 'student@test.com',
    password: '1234Student',
    name: 'Student Test 2',
    role: 'student',
    gender: 'male',
    phone: '+8801711000101',
    bio: 'Demo student account. Final-year CSE, looking for a quiet single room near campus.',
    // Both students get preferences, or the compatibility score has nothing to
    // compare against — that was the reason it looked "missing" entirely.
    prefs: {
      sleep_schedule: 'late', study_hours: 4, diet: 'non_veg',
      guest_policy: 'restricted', smoking_tolerance: false,
      preferred_gender: 'any', cleanliness_score: 4, noise_tolerance: 'moderate',
    },
  },
  {
    key: 'student2',
    email: 'student2@test.com',
    password: '1234Student',
    name: 'Nusrat Demo',
    role: 'student',
    gender: 'female',
    phone: '+8801711000102',
    bio: 'Demo student account. Second-year, shares a flat in Notun Bazar and lists the spare seat.',
    prefs: {
      sleep_schedule: 'early', study_hours: 6, diet: 'vegetarian',
      guest_policy: 'not_allowed', smoking_tolerance: false,
      preferred_gender: 'female', cleanliness_score: 5, noise_tolerance: 'quiet',
    },
  },
  {
    key: 'landlord',
    email: 'landlord@test.com',
    password: '1234Landlord',
    name: 'Landlord Demo',
    role: 'landlord',
    gender: 'male',
    phone: '+8801711000103',
    bio: 'Demo landlord account. Rents out rooms in Aftabnagar and Shatarkul.',
  },
  {
    key: 'admin',
    email: 'admin@test.com',
    password: '1234Admin',
    name: 'Admin Demo',
    role: 'admin',
    gender: 'male',
    phone: '+8801711000104',
    bio: 'Demo administrator account.',
    // Admins moderate; they shouldn't show up in the public profile directory.
    isPublic: false,
  },
];

const slugify = (name, id) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + id.slice(0, 4);

/**
 * Creates (or updates) every demo account and returns them keyed by `key`.
 * The profiles row itself is made by the on_auth_user_created trigger; the
 * fields below it doesn't set are filled in here.
 */
export async function ensureDemoAccounts(db) {
  const out = {};

  for (const account of DEMO_ACCOUNTS) {
    let id = null;

    const { data: created, error } = await db.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: { name: account.name, role: account.role, gender: account.gender },
    });

    if (created?.user?.id) {
      id = created.user.id;
      console.log('account  ' + account.email + '  created');
    } else {
      // Already exists — find it and keep the password in step with the docs.
      const { data: existing } = await db
        .from('profiles').select('id').eq('email', account.email).maybeSingle();
      id = existing?.id ?? null;
      if (!id) {
        console.error('FAILED ' + account.email + ': ' + (error?.message ?? 'not found'));
        continue;
      }
      await db.auth.admin.updateUserById(id, { password: account.password, email_confirm: true });
      console.log('account  ' + account.email + '  exists (password reset to the documented one)');
    }

    await db.from('profiles').update({
      name: account.name,
      role: account.role,
      gender: account.gender,
      phone: account.phone,
      bio: account.bio,
      is_public: account.isPublic !== false,
      profile_slug: slugify(account.name, id),
    }).eq('id', id);

    if (account.prefs) {
      await db.from('user_preferences')
        .upsert({ user_id: id, ...account.prefs }, { onConflict: 'user_id' });
    }

    out[account.key] = { id, name: account.name, email: account.email };
  }

  return out;
}

/**
 * Re-points demo rows that already exist at the demo account that should own
 * them. Without this, rows seeded earlier keep whichever real account was
 * picked at the time, and "demo data" stays mixed in with someone's own.
 */
export async function reownDemoRows(db, table, userColumn, titles, ownerId) {
  if (!titles.length || !ownerId) return;
  const { data, error } = await db
    .from(table)
    .update({ [userColumn]: ownerId })
    .in('title', titles)
    .neq(userColumn, ownerId)
    .select('title');

  if (error) return console.error('Re-own failed on ' + table + ': ' + error.message);
  if (data?.length) console.log('reown  ' + data.length + ' ' + table + ' row(s) -> demo owner');
}
