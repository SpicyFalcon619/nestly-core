import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import ExchangeContent from './ExchangeContent';
import type { Item, Zone } from '@/types';

export default async function ExchangePage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const isLoggedIn = !!userData?.user;

  // Fetch zones for the filter
  const { data: zones } = await supabase.from('zones').select('*').order('zone_name');
  
  // Fetch exchange items
  const { data: items } = await supabase
    .from('items')
    .select(`
      *,
      seller:profiles!items_seller_id_fkey(name),
      zone:zones(zone_name)
    `)
    .order('created_at', { ascending: false });

  // Map joined fields
  const formattedItems: Item[] = (items || []).map((it: any) => ({
    ...it,
    seller_name: it.seller?.name,
    zone: it.zone?.zone_name
  }));

  let isAdmin = false;
  const user = userData?.user;
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role === 'admin') isAdmin = true;
  }

  return (
    <Suspense fallback={<div className="container" style={{ padding: '40px 5%', textAlign: 'center' }}>Loading Exchange...</div>}>
      <ExchangeContent 
        items={formattedItems} 
        zones={(zones as Zone[]) || []} 
        isLoggedIn={isLoggedIn}
        isAdmin={isAdmin}
      />
    </Suspense>
  );
}
