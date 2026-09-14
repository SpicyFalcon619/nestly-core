/**
 * Seeds a handful of demo listings so the app isn't empty in development.
 *
 *   node scripts/seed-demo.mjs          insert (skips ones that already exist)
 *   node scripts/seed-demo.mjs --clean  remove them again
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local — it writes past RLS, so
 * this is a development tool only. Demo rows are identified by their exact
 * titles, so --clean never touches anything a real user created.
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

const photo = (seed, n) =>
  Array.from({ length: n }, (_, i) => `https://picsum.photos/seed/${seed}-${i + 1}/1200/900`);

const LISTINGS = [
  {
    title: 'Furnished single room in Aftabnagar, all bills included',
    zone: 'Aftabnagar',
    address: 'Block C, Road 5, Aftabnagar, Dhaka 1212',
    lat: 23.7661, lng: 90.4342,
    listing_type: 'full_property', property_type: 'single_room',
    gender_pref: 'male', total_rooms: 4, current_occupancy: 3,
    status: 'available', is_verified: true,
    description:
      'A furnished single room in a four-room flat, currently shared with three other university students. ' +
      'Attached bathroom, shared kitchen, and a rooftop everyone uses in the evenings.\n\n' +
      'The building has a standby generator, so load-shedding is not an issue during exams. ' +
      'Rent is due on the 5th of each month and every utility is billed separately — nothing is bundled or hidden.',
    photos: photo('nestly-aftabnagar', 4),
    costs: {
      base_rent: 7500, electricity_amount: 900, electricity_type: 'individual',
      gas_bill: 450, water_bill: 300, internet_cost: 600,
      maintenance_fee: 400, caretaker_fee: 250, other_fees: 200,
    },
    amenities: {
      attached_bathroom: true, attached_kitchen: true, is_furnished: true,
      rooftop_access: true, parking: false, power_backup: true, lift_access: false,
    },
  },
  {
    title: 'Two-seat shared room near Notun Bazar bus stand',
    zone: 'Notun Bazar',
    address: 'House 14, Road 3, Notun Bazar, Dhaka 1212',
    lat: 23.7972, lng: 90.4225,
    listing_type: 'peer_listing', property_type: 'shared_room',
    gender_pref: 'female', total_rooms: 3, current_occupancy: 1,
    status: 'available', is_verified: false,
    description:
      'One seat free in a two-seat room, five minutes on foot from the Notun Bazar bus stand. ' +
      'Suits someone who commutes and wants to keep costs down.\n\n' +
      'Quiet building, mostly working women and students. No guests after 10pm.',
    photos: photo('nestly-notunbazar', 3),
    costs: {
      base_rent: 5200, electricity_amount: 650, electricity_type: 'shared',
      gas_bill: 400, water_bill: 250, internet_cost: 500,
      maintenance_fee: 300, caretaker_fee: 200, other_fees: 0,
    },
    amenities: {
      attached_bathroom: false, attached_kitchen: true, is_furnished: false,
      rooftop_access: true, parking: false, power_backup: false, lift_access: true,
    },
  },
  {
    title: 'Full mess flat in Shatarkul — available from next month',
    zone: 'Shatarkul',
    address: 'Shatarkul Main Road, Badda, Dhaka 1212',
    lat: 23.7914, lng: 90.4352,
    listing_type: 'full_property', property_type: 'full_mess',
    gender_pref: 'any', total_rooms: 6, current_occupancy: 6,
    status: 'soon_vacant', is_verified: true,
    expected_vacate_date: new Date(Date.now() + 32 * 864e5).toISOString().slice(0, 10),
    description:
      'Entire six-room mess flat, currently occupied and vacating at the end of next month. ' +
      'Best suited to a group taking the whole floor together.\n\n' +
      'Lift, parking space for two bikes, and a caretaker who handles the shared bills.',
    photos: photo('nestly-shatarkul', 5),
    costs: {
      base_rent: 26000, electricity_amount: 3200, electricity_type: 'shared',
      gas_bill: 1400, water_bill: 900, internet_cost: 1200,
      maintenance_fee: 1500, caretaker_fee: 1000, other_fees: 600,
    },
    amenities: {
      attached_bathroom: true, attached_kitchen: true, is_furnished: false,
      rooftop_access: true, parking: true, power_backup: true, lift_access: true,
    },
  },
];

const TITLES = LISTINGS.map(l => l.title);

async function clean() {
  const { data: rows } = await db.from('listings').select('listing_id, title').in('title', TITLES);
  if (!rows?.length) return console.log('Nothing to clean — no demo listings found.');
  const ids = rows.map(r => r.listing_id);
  // utility_costs / listing_amenities cascade on listing delete
  const { error } = await db.from('listings').delete().in('listing_id', ids);
  if (error) return console.error('Clean failed:', error.message);
  console.log(`Removed ${ids.length} demo listing(s): ${ids.join(', ')}`);
}

async function seed() {
  const { data: landlord } = await db
    .from('profiles').select('id, name').eq('role', 'landlord').limit(1).maybeSingle();
  if (!landlord) {
    console.error('No landlord profile found — register one first, demo listings need an owner.');
    process.exit(1);
  }

  const { data: zones } = await db.from('zones').select('zone_id, zone_name');
  const zoneId = (name) => zones?.find(z => z.zone_name === name)?.zone_id ?? zones?.[0]?.zone_id;

  const { data: existing } = await db.from('listings').select('title').in('title', TITLES);
  const already = new Set((existing || []).map(r => r.title));

  for (const l of LISTINGS) {
    if (already.has(l.title)) {
      console.log(`skip   ${l.title.slice(0, 50)}… (exists)`);
      continue;
    }
    const { zone, costs, amenities, ...listing } = l;
    const { data: inserted, error } = await db.from('listings').insert({
      ...listing,
      user_id: landlord.id,
      zone_id: zoneId(zone),
    }).select('listing_id').single();

    if (error) { console.error(`FAILED ${l.title}: ${error.message}`); continue; }

    const total =
      costs.base_rent + costs.electricity_amount + costs.gas_bill + costs.water_bill +
      costs.internet_cost + costs.maintenance_fee + costs.caretaker_fee + costs.other_fees;

    const [c, a] = await Promise.all([
      db.from('utility_costs').insert({ listing_id: inserted.listing_id, ...costs, total_monthly: total }),
      db.from('listing_amenities').insert({ listing_id: inserted.listing_id, ...amenities }),
    ]);
    if (c.error) console.error(`  costs failed: ${c.error.message}`);
    if (a.error) console.error(`  amenities failed: ${a.error.message}`);

    console.log(`insert #${inserted.listing_id}  ${l.title.slice(0, 50)}…  (৳${total.toLocaleString('en-BD')}/mo)`);
  }
  console.log(`\nOwner: ${landlord.name}. Remove with: node scripts/seed-demo.mjs --clean`);
}

await (process.argv.includes('--clean') ? clean() : seed());
