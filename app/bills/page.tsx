import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import BillsContent from './BillsContent';

export const metadata = {
  title: 'Bills Manager - Nestly',
  description: 'Manage your flat bills and payments.',
};

export default async function BillsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, id, name')
    .eq('id', user.id)
    .single();
  if (!profile) redirect('/login');

  // Fetch all listings this user owns or is accepted into
  let myListings: any[] = [];
  if (profile.role === 'landlord') {
    const { data } = await supabase
      .from('listings')
      .select('listing_id, title, address, zone:zones(zone_name), current_occupancy, costs:utility_costs(base_rent)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    myListings = (data || []).map((l: any) => ({
      ...l,
      base_rent: l.costs?.base_rent ?? 0,
      zone_name: l.zone?.zone_name ?? '',
    }));
  } else {
    // Students: listings they are accepted into
    const { data: apps } = await supabase
      .from('applications')
      .select('listing:listings(listing_id, title, address, zone:zones(zone_name), current_occupancy, costs:utility_costs(base_rent))')
      .eq('applicant_id', user.id)
      .eq('status', 'accepted');
    myListings = (apps || [])
      .map((a: any) => a.listing)
      .filter(Boolean)
      .map((l: any) => ({
        ...l,
        base_rent: l.costs?.base_rent ?? 0,
        zone_name: l.zone?.zone_name ?? '',
      }));
  }

  // Fetch all bills visible to this user
  let billsData: any[] = [];
  if (profile.role === 'landlord') {
    const listingIds = myListings.map((l: any) => l.listing_id).filter(Boolean);
    if (listingIds.length > 0) {
      const { data } = await supabase
        .from('monthly_bills')
        .select(`*, listing:listings(title, address), payments:bill_payments(*, resident:profiles!bill_payments_resident_user_id_fkey(id, name))`)
        .in('listing_id', listingIds)
        .order('created_at', { ascending: false });
      billsData = data || [];
    }
  } else {
    // Self-created bills (no listing_id) + bills from their listings
    const listingIds = myListings.map((l: any) => l.listing_id).filter(Boolean);

    const { data: paymentBills } = await supabase
      .from('bill_payments')
      .select(`bill:monthly_bills(*, listing:listings(title, address), payments:bill_payments(*, resident:profiles!bill_payments_resident_user_id_fkey(id, name)))`)
      .eq('resident_user_id', user.id)
      .order('created_at', { ascending: false });

    const seen = new Set<number>();
    (paymentBills || []).forEach((p: any) => {
      if (p.bill) {
        const id = p.bill.bill_id ?? p.bill.id;
        if (!seen.has(id)) { seen.add(id); billsData.push(p.bill); }
      }
    });

    if (listingIds.length > 0) {
      const { data: listingBills } = await supabase
        .from('monthly_bills')
        .select(`*, listing:listings(title, address), payments:bill_payments(*, resident:profiles!bill_payments_resident_user_id_fkey(id, name))`)
        .in('listing_id', listingIds)
        .order('created_at', { ascending: false });
      (listingBills || []).forEach((b: any) => {
        const id = b.bill_id ?? b.id;
        if (!seen.has(id)) { seen.add(id); billsData.push(b); }
      });
    }
  }

  return (
    <div className="container" style={{ padding: '40px 5%' }}>
      <BillsContent
        initialBills={billsData}
        myListings={myListings}
        currentUser={{ id: user.id, name: profile.name, role: profile.role }}
      />
    </div>
  );
}
