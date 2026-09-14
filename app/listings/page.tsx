import { createClient } from '@/lib/supabase/server';
import ListingsClient from './ListingsClient';
import type { Zone, Listing } from '@/types';
import { Suspense } from 'react';

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
  const zoneId    = params.zone   as string || '';
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
  const select =
    '*, zone:zones(zone_name)' +
    `, costs:utility_costs${budgetActive ? '!inner' : ''}(*)` +
    `, amenities:listing_amenities${amenities.length > 0 ? '!inner' : ''}(*)`;

  let query = supabase
    .from('listings')
    .select(select, { count: 'exact' })
    .neq('status', 'occupied');

  if (zoneId) query = query.eq('zone_id', parseInt(zoneId));
  if (type && type !== 'any') query = query.eq('property_type', type);
  if (q) query = query.or(`title.ilike.%${q}%,address.ilike.%${q}%`);
  if (budgetActive) query = query.lte('costs.total_monthly', budget);
  for (const a of amenities) query = query.eq(`amenities.${a}`, true);

  let initialListings: Listing[] = [];
  let totalPages = 1;
  let totalCount = 0;

  if (costSort) {
    // PostgREST can't order parent rows by an embedded column, so cost sorting has
    // to happen here — which means sorting the whole filtered set, not one page of it.
    const { data } = await query.order('created_at', { ascending: false });
    const all = (data as unknown as Listing[]) || [];
    all.sort((a, b) =>
      sort === 'cost_asc'
        ? (a.costs?.total_monthly || 0) - (b.costs?.total_monthly || 0)
        : (b.costs?.total_monthly || 0) - (a.costs?.total_monthly || 0)
    );
    totalCount = all.length;
    totalPages = Math.max(1, Math.ceil(all.length / limit));
    initialListings = all.slice(offset, offset + limit);
  } else {
    const { data, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    initialListings = (data as unknown as Listing[]) || [];
    totalCount = count || 0;
    totalPages = count ? Math.max(1, Math.ceil(count / limit)) : 1;
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

  return (
    <Suspense fallback={<div style={{ padding: '60px', textAlign: 'center' }}>Loading Listings...</div>}>
      <ListingsClient
        initialListings={initialListings}
        zones={(zones || []) as Zone[]}
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
        isLoggedIn={isLoggedIn}
        isAdmin={isAdmin}
      />
    </Suspense>
  );
}
