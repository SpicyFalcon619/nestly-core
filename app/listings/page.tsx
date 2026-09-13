import { createClient } from '@/lib/supabase/server';
import ListingsClient from './ListingsClient';
import type { Zone, Listing } from '@/types';
import { Suspense } from 'react';

export const metadata = {
  title: 'Browse Listings - Nestly',
  description: 'Find your next home near UIU.',
};

export default async function ListingsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await searchParams;
  const page      = parseInt(params.page   as string || '1');
  const zoneId    = params.zone   as string || '';
  const type      = params.type   as string || '';
  const budget    = parseInt(params.budget as string || '50000');
  const sort      = params.sort   as string || 'newest';
  // amenities is a comma-separated list: e.g. "attached_bathroom,is_furnished"
  const amenities = params.amenities ? (params.amenities as string).split(',').filter(Boolean) : [];

  const limit  = 10;
  const offset = (page - 1) * limit;

  const supabase = await createClient();

  // Fetch zones for map
  const { data: zones } = await supabase.from('zones').select('*').order('zone_name');

  // Build listing query — include amenities so the card can show them
  let query = supabase
    .from('listings')
    .select('*, costs:utility_costs(*), amenities:listing_amenities(*)', { count: 'exact' })
    .neq('status', 'occupied');

  if (zoneId) query = query.eq('zone_id', parseInt(zoneId));
  if (type && type !== 'any') query = query.eq('property_type', type);

  // Apply sort on Supabase where possible
  if (sort === 'newest') {
    query = query.order('created_at', { ascending: false });
  } else {
    // Cost-based sorts: fetch newest then sort in JS (Supabase can't sort on nested)
    query = query.order('created_at', { ascending: false });
  }

  const { data, count } = await query.range(offset, offset + limit - 1);

  let initialListings: Listing[] = (data as unknown as Listing[]) || [];

  // Server-side budget filter
  if (budget && budget < 50000) {
    initialListings = initialListings.filter(l => !l.costs || l.costs.total_monthly <= budget);
  }

  // Server-side amenities filter
  if (amenities.length > 0) {
    initialListings = initialListings.filter(l => {
      if (!l.amenities) return false;
      return amenities.every(a => (l.amenities as any)[a] === true);
    });
  }

  // Client-side sort for cost (can't sort nested columns in Supabase easily)
  if (sort === 'cost_asc') {
    initialListings.sort((a, b) => (a.costs?.total_monthly || 0) - (b.costs?.total_monthly || 0));
  } else if (sort === 'cost_desc') {
    initialListings.sort((a, b) => (b.costs?.total_monthly || 0) - (a.costs?.total_monthly || 0));
  }

  const totalPages = count ? Math.ceil(count / limit) : 1;

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
        isLoggedIn={isLoggedIn}
        isAdmin={isAdmin}
      />
    </Suspense>
  );
}
