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
  // Several comparable single rooms in one zone, so the "vs. zone average"
  // comparison on the detail page has a real sample to work against.
  {
    title: 'Single room with balcony, Aftabnagar Block D',
    zone: 'Aftabnagar',
    address: 'Block D, Road 2, Aftabnagar, Dhaka 1212',
    lat: 23.7668, lng: 90.4356,
    listing_type: 'full_property', property_type: 'single_room',
    gender_pref: 'male', total_rooms: 3, current_occupancy: 2,
    status: 'available', is_verified: false,
    description: 'Corner room with a balcony facing the lake road. Shared kitchen and two bathrooms between three tenants.',
    photos: photo('nestly-aftab-d', 3),
    costs: {
      base_rent: 9000, electricity_amount: 1100, electricity_type: 'individual',
      gas_bill: 450, water_bill: 300, internet_cost: 700,
      maintenance_fee: 500, caretaker_fee: 250, other_fees: 0,
    },
    amenities: {
      attached_bathroom: false, attached_kitchen: true, is_furnished: true,
      rooftop_access: true, parking: false, power_backup: true, lift_access: true,
    },
  },
  {
    title: 'Budget single room near Aftabnagar main gate',
    zone: 'Aftabnagar',
    address: 'Main Gate Road, Aftabnagar, Dhaka 1212',
    lat: 23.7654, lng: 90.4331,
    listing_type: 'peer_listing', property_type: 'single_room',
    gender_pref: 'any', total_rooms: 5, current_occupancy: 4,
    status: 'available', is_verified: false,
    description: 'Cheapest room on this side of Aftabnagar. No frills — a bed, a desk, a fan and a shared bathroom down the hall.',
    photos: photo('nestly-aftab-gate', 2),
    costs: {
      base_rent: 5000, electricity_amount: 700, electricity_type: 'shared',
      gas_bill: 350, water_bill: 200, internet_cost: 450,
      maintenance_fee: 200, caretaker_fee: 150, other_fees: 0,
    },
    amenities: {
      attached_bathroom: false, attached_kitchen: true, is_furnished: false,
      rooftop_access: false, parking: false, power_backup: false, lift_access: false,
    },
  },
  {
    title: 'Quiet single room for final-year students, Aftabnagar',
    zone: 'Aftabnagar',
    address: 'Block B, Road 7, Aftabnagar, Dhaka 1212',
    lat: 23.7673, lng: 90.4318,
    listing_type: 'full_property', property_type: 'single_room',
    gender_pref: 'female', total_rooms: 4, current_occupancy: 2,
    status: 'available', is_verified: true,
    description: 'Strictly quiet building — no music after 10pm. Popular with final-year students during thesis season.',
    photos: photo('nestly-aftab-b', 4),
    costs: {
      base_rent: 11000, electricity_amount: 1300, electricity_type: 'individual',
      gas_bill: 500, water_bill: 350, internet_cost: 800,
      maintenance_fee: 600, caretaker_fee: 300, other_fees: 150,
    },
    amenities: {
      attached_bathroom: true, attached_kitchen: true, is_furnished: true,
      rooftop_access: true, parking: true, power_backup: true, lift_access: true,
    },
  },
];

const TITLES = LISTINGS.map(l => l.title);

// Nestly Exchange demo stock. Sellers are students — the marketplace is
// students passing furniture on to the next batch, not a shop.
const ITEMS = [
  {
    title: 'Study desk with bookshelf, 4ft',
    category: 'furniture', item_condition: 'good', asking_price: 3200,
    zone: 'Aftabnagar',
    description:
      'Solid board desk with a three-shelf unit on top. Used it for two years of CSE assignments; ' +
      'a few pen marks on the surface, nothing structural. Selling because I am moving to a furnished room.',
    reason_for_selling: 'Moving to a furnished room',
    photos: photo('nestly-desk', 3),
  },
  {
    title: 'Single bed frame + mattress',
    category: 'furniture', item_condition: 'fair', asking_price: 4500,
    zone: 'Notun Bazar',
    description:
      'Wooden single bed with a 3-inch foam mattress. Frame is sturdy; the mattress has softened in the middle. ' +
      'Buyer arranges pickup — it comes apart into three pieces and fits in a CNG.',
    reason_for_selling: 'Graduating, leaving Dhaka',
    photos: photo('nestly-bed', 2),
  },
  {
    title: 'Walton 1.5 ton AC, 3 years old',
    category: 'appliances', item_condition: 'good', asking_price: 21000,
    zone: 'Shatarkul',
    description:
      'Cools fast, serviced in April with the receipt to prove it. Remote and mounting bracket included. ' +
      'Uninstalling is on the buyer; I can recommend the technician who services it.',
    reason_for_selling: 'Landlord installed one in the flat',
    photos: photo('nestly-ac', 3),
  },
  {
    title: 'Rice cooker and induction stove set',
    category: 'kitchen', item_condition: 'like_new', asking_price: 2800,
    zone: 'Aftabnagar',
    description:
      'Bought in January, used maybe ten times before the mess started cooking together. ' +
      'Both work perfectly, box and manual for the induction stove included.',
    reason_for_selling: 'Mess cooks together now',
    photos: photo('nestly-kitchen', 2),
  },
  {
    title: 'HP 15s laptop, i5 11th gen, 8GB RAM',
    category: 'electronics', item_condition: 'good', asking_price: 42000,
    zone: 'Badda Campus Area',
    description:
      'Handled four years of coursework — VS Code, browser tabs, the occasional game. ' +
      'Battery holds about three hours now. Charger included, no dents, screen is clean.',
    reason_for_selling: 'Upgraded for final-year project work',
    photos: photo('nestly-laptop', 3),
  },
  {
    title: 'Steel almirah, two doors with lock',
    category: 'furniture', item_condition: 'fair', asking_price: 6500,
    zone: 'Nurer Chala',
    description:
      'Two-door steel almirah with a working lock and a mirror inside one door. ' +
      'Some rust at the base, hidden once it stands against a wall. Heavy — bring two people.',
    reason_for_selling: 'Room came with a built-in wardrobe',
    photos: photo('nestly-almirah', 2),
  },
  {
    title: 'Study lamp and desk organiser',
    category: 'study', item_condition: 'like_new', asking_price: 750,
    zone: 'Notun Bazar',
    description: 'Clip-on LED lamp with three brightness levels plus a small wooden organiser for pens and notes.',
    reason_for_selling: 'Duplicate — got one as a gift',
    photos: photo('nestly-lamp', 2),
  },
];

const ITEM_TITLES = ITEMS.map(i => i.title);


async function clean() {
  const { data: rows } = await db.from('listings').select('listing_id, title').in('title', TITLES);
  if (!rows?.length) return console.log('Nothing to clean — no demo listings found.');
  const ids = rows.map(r => r.listing_id);
  // utility_costs / listing_amenities cascade on listing delete
  const { error } = await db.from('listings').delete().in('listing_id', ids);
  if (error) return console.error('Clean failed:', error.message);
  console.log(`Removed ${ids.length} demo listing(s): ${ids.join(', ')}`);
}

async function cleanItems() {
  const { data: rows } = await db.from('items').select('item_id, title').in('title', ITEM_TITLES);
  if (!rows?.length) return console.log('Nothing to clean — no demo items found.');
  const ids = rows.map(r => r.item_id);
  const { error } = await db.from('items').delete().in('item_id', ids);
  if (error) return console.error('Item clean failed:', error.message);
  console.log(`Removed ${ids.length} demo item(s): ${ids.join(', ')}`);
}

async function seed() {
  const { data: landlord } = await db
    .from('profiles').select('id, name').eq('role', 'landlord').limit(1).maybeSingle();
  if (!landlord) {
    console.error('No landlord profile found — register one first, demo listings need an owner.');
    process.exit(1);
  }

  // A peer listing is a student offering a spare room, so its owner must be a
  // student — that's also the only case where flatmate compatibility can be
  // scored, so prefer a student who has filled in their preferences.
  const { data: students } = await db.from('profiles').select('id, name').eq('role', 'student');
  const { data: prefRows } = await db.from('user_preferences').select('user_id');
  const withPrefs = new Set((prefRows || []).map(r => r.user_id));
  const peerOwner = students?.find(s => withPrefs.has(s.id)) || students?.[0] || landlord;

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
      user_id: l.listing_type === 'peer_listing' ? peerOwner.id : landlord.id,
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
  console.log(`\nOwners: ${landlord.name} (landlord listings), ${peerOwner.name} (peer listings).`);
  await seedItems(peerOwner, zoneId);
  console.log('Remove with: node scripts/seed-demo.mjs --clean');
}

async function seedItems(seller, zoneId) {
  const { data: existing } = await db.from('items').select('title').in('title', ITEM_TITLES);
  const already = new Set((existing || []).map(r => r.title));

  for (const item of ITEMS) {
    if (already.has(item.title)) {
      console.log(`skip   ${item.title.slice(0, 50)}… (exists)`);
      continue;
    }
    const { zone, photos, ...rest } = item;
    const { data: inserted, error } = await db.from('items').insert({
      ...rest,
      seller_id: seller.id,
      zone_id: zoneId(zone),
      status: 'available',
      // photo_url is what older rows use; keep both so either read path works.
      photo_url: photos[0],
      photos,
    }).select('item_id').single();

    if (error) { console.error(`FAILED ${item.title}: ${error.message}`); continue; }
    console.log(`insert item #${inserted.item_id}  ${item.title.slice(0, 44)}…  (৳${item.asking_price.toLocaleString('en-BD')})`);
  }
}

if (process.argv.includes('--clean')) {
  await clean();
  await cleanItems();
} else {
  await seed();
}
