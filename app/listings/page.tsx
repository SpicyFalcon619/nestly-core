import { createClient } from '@/lib/supabase/server';
import ListingsClient from './ListingsClient';
import type { Zone, Listing } from '@/types';
import { Suspense } from 'react';
import { canonicalSearch, savedSearchesAvailable } from '@/lib/savedSearch';
import { scoreCompatibility } from '@/lib/compatibility';

export const metadata = {
  title: 'Browse Listings - Nestly',
  description: 'Find your next home near campus in Dhaka.',
};

// Only these may be used as amenity filter columns — the value is interpolated
// into a PostgREST filter path, so it must never come straight from the URL.
const AMENITY_COLUMNS = [
  'attached_bathroom', 'attached_kitchen', 'is_furnished',
  'rooftop_access', 'parking', 'power_backup', 'lift_access',
] as const;

export default async function ListingsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await searchParams;
  const page      = parseInt(params.page   as string || '1');
  // zone is a comma-separated list of ids: e.g. "2,5"
  const zoneIds   = (params.zone ? (params.zone as string).split(',') : [])
    .map(z => parseInt(z)).filter(z => Number.isInteger(z) && z > 0);
  const type      = params.type   as string || '';
  const budget    = parseInt(params.budget as string || '50000');
  const sort      = params.sort   as string || 'newest';
  // Strip characters that are grammar in a PostgREST `or` filter
  const q         = ((params.q as string) || '').replace(/[,()\\"]/g, '').trim();
  // amenities is a comma-separated list: e.g. "attached_bathroom,is_furnished"
  const amenities = (params.amenities ? (params.amenities as string).split(',') : [])
    .filter(a => (AMENITY_COLUMNS as readonly string[]).includes(a));

  const limit  = 10;
  const offset = (page - 1) * limit;

  const supabase = await createClient();

  // Fetch zones for map
  const { data: zones } = await supabase.from('zones').select('*').order('zone_name');

  const budgetActive = !!budget && budget < 50000;
  const costSort = sort === 'cost_asc' || sort === 'cost_desc';

  // Embedded resources are only joined with !inner when they're being filtered on
  // — an unconditional inner join would drop listings that have no costs/amenities row.
  // `columns` lets the map-pin query below reuse the exact same filters with a
  // much smaller payload.
  const filtered = (columns: { base: string; costs: string; amenities: string }) => {
    const select =
      `${columns.base}, zone:zones(zone_name)` +
      `, costs:utility_costs${budgetActive ? '!inner' : ''}(${columns.costs})` +
      `, amenities:listing_amenities${amenities.length > 0 ? '!inner' : ''}(${columns.amenities})`;

    let query = supabase
      .from('listings')
      .select(select, { count: 'exact' })
      .neq('status', 'occupied');

    if (zoneIds.length === 1) query = query.eq('zone_id', zoneIds[0]);
    else if (zoneIds.length > 1) query = query.in('zone_id', zoneIds);
    if (type && type !== 'any') query = query.eq('property_type', type);
    if (q) query = query.or(`title.ilike.%${q}%,address.ilike.%${q}%`);
    if (budgetActive) query = query.lte('costs.total_monthly', budget);
    for (const a of amenities) query = query.eq(`amenities.${a}`, true);
    return query;
  };

  const FULL = { base: '*', costs: '*', amenities: '*' };

  let initialListings: Listing[] = [];
  let totalPages = 1;
  let totalCount = 0;
  let mapPins: Listing[] = [];

  if (costSort) {
    // PostgREST can't order parent rows by an embedded column, so cost sorting has
    // to happen here — which means sorting the whole filtered set, not one page of it.
    const { data } = await filtered(FULL).order('created_at', { ascending: false });
    const all = (data as unknown as Listing[]) || [];
    all.sort((a, b) =>
      sort === 'cost_asc'
        ? (a.costs?.total_monthly || 0) - (b.costs?.total_monthly || 0)
        : (b.costs?.total_monthly || 0) - (a.costs?.total_monthly || 0)
    );
    totalCount = all.length;
    totalPages = Math.max(1, Math.ceil(all.length / limit));
    initialListings = all.slice(offset, offset + limit);
    mapPins = all; // already have every match
  } else {
    const [{ data, count }, { data: pins }] = await Promise.all([
      filtered(FULL).order('created_at', { ascending: false }).range(offset, offset + limit - 1),
      // The map should show every match, not just the ten on this page.
      filtered({ base: 'listing_id, title, lat, lng', costs: 'total_monthly', amenities: 'listing_id' })
        .limit(500),
    ]);
    initialListings = (data as unknown as Listing[]) || [];
    totalCount = count || 0;
    totalPages = count ? Math.max(1, Math.ceil(count / limit)) : 1;
    mapPins = (pins as unknown as Listing[]) || [];
  }

  // zones arrive as { zone_name } objects — flatten so cards can render them
  initialListings = initialListings.map(l => ({
    ...l,
    zone: (l as any).zone?.zone_name ?? undefined,
  }));

  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  let isAdmin = false;
  if (isLoggedIn) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role === 'admin') isAdmin = true;
  }

  // Flatmate compatibility. Needs both sides' preferences, so it's only
  // attached to the cards where the lister has filled theirs in too — a
  // partial score would be worse than none on a page people compare on.
  if (isLoggedIn && initialListings.length > 0) {
    const { data: myPrefs } = await supabase
      .from('user_preferences').select('*').eq('user_id', user!.id).maybeSingle();
    if (myPrefs) {
      const listerIds = [...new Set(initialListings.map(l => l.user_id).filter(Boolean))];
      const { data: listerPrefs } = await supabase
        .from('user_preferences').select('*').in('user_id', listerIds);
      const byUser = new Map((listerPrefs || []).map(pref => [pref.user_id, pref]));
      initialListings = initialListings.map(l => {
        const theirs = l.user_id === user!.id ? null : byUser.get(l.user_id);
        return theirs
          ? { ...l, compatibility: scoreCompatibility(myPrefs, theirs, l.gender_pref).score }
          : l;
      });
    }
  }

  // Saved searches only surface once migration 0006 exists.
  const savedSearch: { enabled: boolean; id: number | null } = {
    enabled: await savedSearchesAvailable(supabase),
    id: null,
  };
  if (savedSearch.enabled && isLoggedIn) {
    const current = canonicalSearch(new URLSearchParams(
      Object.entries(params).filter((e): e is [string, string] => typeof e[1] === 'string')
    ));
    if (current) {
      const { data: existing } = await supabase
        .from('saved_searches').select('id').eq('user_id', user!.id).eq('query', current).maybeSingle();
      savedSearch.id = existing?.id ?? null;
    }
  }

  return (
    <Suspense fallback={<div style={{ padding: '60px', textAlign: 'center' }}>Loading Listings...</div>}>
      <ListingsClient
        initialListings={initialListings}
        zones={(zones || []) as Zone[]}
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
        mapPins={mapPins}
        savedSearch={savedSearch}
        isLoggedIn={isLoggedIn}
        isAdmin={isAdmin}
      />
    </Suspense>
  );
}
