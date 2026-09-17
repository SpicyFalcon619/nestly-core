import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchUserActivity } from '@/lib/activity';
import { savedSearchesAvailable } from '@/lib/savedSearch';
import DashboardContent from './DashboardContent';
import type { Profile, DashboardData, Listing, Item, Offer, Application, SeekingPost, SeekingResponse } from '@/types';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userData.user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  if (profile.role === 'admin') {
    redirect('/admin');
  }

  const userId = userData.user.id;

  // Fetch all dashboard data concurrently
  const [
    { data: myListings },
    { data: myItems },
    { data: watched },
    { data: offersSent },
    { data: offersRecv },
    { data: appsSent },
    { data: appsRecv },
    { data: mySeeking },
    { data: seekRespSent },
    { data: seekRespRecv },
    { data: hasPreferences },
    { data: verifStatus },
    { data: userNotifications }
  ] = await Promise.all([
    supabase.from('listings').select('*, costs:utility_costs(*)').eq('user_id', userId),
    supabase.from('items').select('*').eq('seller_id', userId),
    supabase.from('watchlists').select('listing:listings(*, costs:utility_costs(*))').eq('user_id', userId),
    supabase.from('offers').select('*, item:items(title), seller:profiles!offers_item_seller_id_fkey(name, email)').eq('buyer_id', userId),
    supabase.from('offers').select('*, item:items(title), buyer:profiles!offers_buyer_id_fkey(name, email)').eq('item.seller_id', userId), // Actually need to join to get items where seller is me
    supabase.from('applications').select('*, listing:listings(title, user_id, owner_name:profiles!listings_user_id_fkey(name))').eq('applicant_id', userId),
    supabase.from('applications').select('*, applicant:profiles!applications_applicant_id_fkey(name, email), listing:listings!inner(user_id, title)').eq('listing.user_id', userId),
    supabase.from('seeking_posts').select('*').eq('user_id', userId),
    supabase.from('seeking_responses').select('*, owner:profiles!seeking_responses_post_owner_id_fkey(name, email)').eq('responder_id', userId),
    supabase.from('seeking_responses').select('*, responder:profiles!seeking_responses_responder_id_fkey(name, email), post:seeking_posts!inner(user_id)').eq('post.user_id', userId),
    supabase.from('user_preferences').select('pref_id').eq('user_id', userId).maybeSingle(),
    supabase.from('verifications').select('status').eq('user_id', userId).order('submitted_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  ]);

  // Offers received needs a different query or mapping since supabase doesn't support complex joins in a single query easily like that.
  // Actually, we can fetch items where seller_id is me, and then offers for those items.
  const { data: myItemsWithOffers } = await supabase
    .from('items')
    .select(`
      item_id,
      title,
      offers(
        offer_id,
        item_id,
        buyer_id,
        offer_price,
        counter_price,
        status,
        buyer:profiles!offers_buyer_id_fkey(name, email)
      )
    `)
    .eq('seller_id', userId);

  let flatOffersRecv: any[] = [];
  if (myItemsWithOffers) {
    myItemsWithOffers.forEach((item: any) => {
      if (item.offers && item.offers.length > 0) {
        item.offers.forEach((o: any) => {
          flatOffersRecv.push({
            ...o,
            title: item.title,
            buyer_name: o.buyer?.name,
            buyer_email: o.buyer?.email
          });
        });
      }
    });
  }

  const activity = await fetchUserActivity(supabase, userId);

  // Saved searches exist only once migration 0006 is applied.
  const savedSearchesEnabled = await savedSearchesAvailable(supabase);
  const { data: savedSearches } = savedSearchesEnabled
    ? await supabase.from('saved_searches').select('id, query, label, created_at').eq('user_id', userId).order('created_at', { ascending: false })
    : { data: [] };

  const dashData: DashboardData = {
    myListings: (myListings || []) as Listing[],
    myItems: (myItems || []) as Item[],
    watched: (watched?.map(w => w.listing).filter(Boolean) || []) as unknown as Listing[],
    offersSent: (offersSent || []).map((o: any) => ({
      ...o,
      title: o.item?.title,
      seller_name: o.seller?.name,
      seller_email: o.seller?.email
    })) as Offer[],
    offersRecv: flatOffersRecv as Offer[],
    appsSent: (appsSent || []).map((a: any) => ({
      ...a,
      listing_title: a.listing?.title,
      owner_name: a.listing?.owner_name?.name,
      owner_id: a.listing?.user_id,
    })) as Application[],
    appsRecv: (appsRecv || []).map((a: any) => ({
      ...a,
      listing_title: a.listing?.title,
      applicant_name: a.applicant?.name,
      applicant_email: a.applicant?.email
    })) as Application[],
    mySeeking: (mySeeking || []) as SeekingPost[],
    seekRespSent: (seekRespSent || []).map((r: any) => ({
      ...r,
      owner_name: r.owner?.name,
      owner_email: r.owner?.email
    })) as SeekingResponse[],
    seekRespRecv: (seekRespRecv || []).map((r: any) => ({
      ...r,
      responder_name: r.responder?.name,
      responder_email: r.responder?.email
    })) as SeekingResponse[],
    hasPreferences: !!hasPreferences,
    activity,
    verifStatus: verifStatus?.status || 'none',
    savedSearchesEnabled,
    savedSearches: savedSearches || [],
    notifications: userNotifications || []
  };

  return <DashboardContent data={dashData} user={profile as Profile} />;
}
