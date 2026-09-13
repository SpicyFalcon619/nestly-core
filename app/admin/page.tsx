import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import AdminContent from './AdminContent';
import type { AdminStats, Complaint, Verification, Notification } from '@/types';

export const metadata = {
  title: 'Admin Dashboard - Nestly',
  description: 'Manage users, verifications, and complaints.',
};

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard');
  }

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch Verifications (Bypassing RLS)
  const { data: verificationsRes } = await adminSupabase
    .from('verifications')
    .select('*, user:profiles!verifications_user_id_fkey(name, email)')
    .order('submitted_at', { ascending: false });

  // Fetch Complaints (Bypassing RLS)
  const { data: complaintsRes } = await adminSupabase
    .from('complaints')
    .select('*, complainant:profiles!complaints_complainant_id_fkey(name, email), against:profiles!complaints_against_user_id_fkey(name, email), listing:listings(title)')
    .order('created_at', { ascending: false });

  // Format Verifications
  const verifications: Verification[] = (verificationsRes || []).map((v: any) => ({
    ...v,
    userName: v.user?.name,
    userEmail: v.user?.email
  }));

  // Format Complaints
  const complaints: Complaint[] = (complaintsRes || []).map((c: any) => ({
    ...c,
    complainantName: c.complainant?.name,
    againstName: c.against?.name,
    listingTitle: c.listing?.title
  }));

  // Fetch Stats Data
  const { count: totalListings } = await supabase.from('listings').select('*', { count: 'exact', head: true });
  const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
  const openComplaints = complaints.filter(c => c.status === 'open' || c.status === 'pending').length;

  const { data: listings } = await supabase.from('listings').select('zone_id, costs:utility_costs(base_rent)');
  const { data: seekingPosts } = await supabase.from('seeking_posts').select('zone_id');
  const { data: zones } = await supabase.from('zones').select('zone_id, zone_name');

  // Fetch full listings & users for the new tables
  const { data: allUsers } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  const { data: allListingsData } = await supabase.from('listings').select('*, zone:zones(zone_name), owner:profiles!listings_user_id_fkey(name, email)').order('created_at', { ascending: false });

  // Fetch Notifications
  const { data: notificationsRes } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  const notifications: Notification[] = notificationsRes || [];

  const allListings = (allListingsData || []).map((l: any) => ({
    ...l,
    zone: l.zone?.zone_name,
    ownerName: l.owner?.name,
    ownerEmail: l.owner?.email
  }));

  const avgRentByZone: any[] = [];
  const seekingVsListings: any[] = [];

  if (zones) {
    zones.forEach(z => {
      // Rent avg
      const zoneListings = (listings || []).filter((l: any) => l.zone_id === z.zone_id);
      let totalRent = 0;
      let rentCount = 0;
      zoneListings.forEach((l: any) => {
        if (l.costs?.base_rent) {
          totalRent += Number(l.costs.base_rent);
          rentCount++;
        }
      });
      const avg = rentCount > 0 ? Math.round(totalRent / rentCount) : 0;
      if (avg > 0) {
        avgRentByZone.push({ zone: z.zone_name, avg });
      }

      // Seeking vs Listings
      const seekingCount = (seekingPosts || []).filter((s: any) => s.zone_id === z.zone_id).length;
      if (zoneListings.length > 0 || seekingCount > 0) {
        seekingVsListings.push({
          zone: z.zone_name,
          listings: zoneListings.length,
          seeking: seekingCount
        });
      }
    });
  }

  const stats: AdminStats = {
    totalListings: totalListings || 0,
    totalUsers: totalUsers || 0,
    openComplaints,
    avgRentByZone,
    seekingVsListings
  };

  return (
    <div className="container" style={{ padding: '40px 0' }}>
      <h1 className="page-title">Admin Dashboard</h1>
      <AdminContent 
        stats={stats} 
        initialVerifications={verifications} 
        initialComplaints={complaints} 
        allUsers={allUsers || []}
        allListings={allListings}
        initialNotifications={notifications}
      />
    </div>
  );
}
