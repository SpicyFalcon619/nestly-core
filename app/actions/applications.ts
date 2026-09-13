'use server';

import { createClient } from '@/lib/supabase/server';
import { createUserNotification } from './notifications';
import { revalidatePath } from 'next/cache';

export async function submitApplication(listingId: number, ownerId: string, listingTitle: string, message: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  // Check the listing is currently available before allowing a new application
  const { data: listing } = await supabase
    .from('listings')
    .select('status')
    .eq('listing_id', listingId)
    .single();

  if (!listing || listing.status === 'occupied') {
    return { error: 'This listing is no longer available.' };
  }

  // Block duplicate pending applications only (accepted/rejected from a previous occupancy don't count)
  const { data: existing } = await supabase
    .from('applications')
    .select('application_id')
    .eq('listing_id', listingId)
    .eq('applicant_id', user.id)
    .in('status', ['pending'])
    .maybeSingle();

  if (existing) return { error: 'You already have a pending application for this listing.' };

  const { error } = await supabase.from('applications').insert({
    listing_id: listingId,
    applicant_id: user.id,
    message: message.trim(),
    status: 'pending',
  });

  if (error) return { error: error.message };

  const { data: applicantProfile } = await supabase.from('profiles').select('name').eq('id', user.id).single();
  const applicantName = applicantProfile?.name || 'Someone';

  await createUserNotification(
    ownerId,
    'new_application',
    `${applicantName} applied to your listing "${listingTitle}". Review in dashboard.`,
    `/dashboard?tab=applications`
  );

  revalidatePath(`/listings/${listingId}`);
  return { success: true };
}

export async function acceptApplication(applicationId: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: app } = await supabase
    .from('applications')
    .select('*, listing:listings!inner(title, user_id, listing_id)')
    .eq('application_id', applicationId)
    .single();

  if (!app) return { error: 'Not found' };
  if ((app.listing as any).user_id !== user.id) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('applications')
    .update({ status: 'accepted' })
    .eq('application_id', applicationId);

  if (error) return { error: error.message };

  // Auto-mark the listing as occupied
  const listingId = (app.listing as any).listing_id;
  await supabase.from('listings').update({ status: 'occupied' }).eq('listing_id', listingId);

  await createUserNotification(
    app.applicant_id,
    'application_accepted',
    `Your application for "${(app.listing as any).title}" was accepted! Contact the landlord to arrange moving in.`,
    `/dashboard?tab=applications`
  );

  revalidatePath('/dashboard');
  revalidatePath(`/listings/${listingId}`);
  return { success: true, listingId };
}

export async function rejectApplication(applicationId: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: app } = await supabase
    .from('applications')
    .select('*, listing:listings!inner(title, user_id, listing_id)')
    .eq('application_id', applicationId)
    .single();

  if (!app) return { error: 'Not found' };
  if ((app.listing as any).user_id !== user.id) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('applications')
    .update({ status: 'rejected' })
    .eq('application_id', applicationId);

  if (error) return { error: error.message };

  await createUserNotification(
    app.applicant_id,
    'application_rejected',
    `Your application for "${(app.listing as any).title}" was not successful this time.`,
    `/dashboard?tab=applications`
  );

  revalidatePath('/dashboard');
  return { success: true };
}

export async function updateListingStatus(listingId: number, status: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: listing } = await supabase.from('listings').select('user_id').eq('listing_id', listingId).single();
  if (!listing || listing.user_id !== user.id) return { error: 'Unauthorized' };

  const { error } = await supabase.from('listings').update({ status }).eq('listing_id', listingId);
  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  revalidatePath(`/listings/${listingId}`);
  return { success: true };
}

export async function deleteListing(listingId: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: listing } = await supabase.from('listings').select('user_id').eq('listing_id', listingId).single();
  if (!listing || listing.user_id !== user.id) return { error: 'Unauthorized' };

  const { error } = await supabase.from('listings').delete().eq('listing_id', listingId);
  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  revalidatePath('/listings');
  revalidatePath('/');
  return { success: true };
}

export async function updateItemStatus(itemId: number, status: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: item } = await supabase.from('items').select('seller_id').eq('item_id', itemId).single();
  if (!item || item.seller_id !== user.id) return { error: 'Unauthorized' };

  const { error } = await supabase.from('items').update({ status }).eq('item_id', itemId);
  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  revalidatePath(`/exchange/${itemId}`);
  return { success: true };
}

export async function acceptSeekResponse(responseId: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: resp } = await supabase
    .from('seeking_responses')
    .select('*, post:seeking_posts!inner(user_id, requirements), responder:profiles!seeking_responses_responder_id_fkey(name)')
    .eq('response_id', responseId)
    .single();

  if (!resp || (resp.post as any).user_id !== user.id) return { error: 'Unauthorized' };

  const { error } = await supabase.from('seeking_responses').update({ status: 'accepted' }).eq('response_id', responseId);
  if (error) return { error: error.message };

  await createUserNotification(
    resp.responder_id,
    'seek_response_accepted',
    `Your response to a housing request was accepted! Check the seeking board for details.`,
    `/seeking`
  );

  revalidatePath('/dashboard');
  return { success: true };
}

export async function rejectSeekResponse(responseId: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: resp } = await supabase
    .from('seeking_responses')
    .select('*, post:seeking_posts!inner(user_id)')
    .eq('response_id', responseId)
    .single();

  if (!resp || (resp.post as any).user_id !== user.id) return { error: 'Unauthorized' };

  const { error } = await supabase.from('seeking_responses').update({ status: 'rejected' }).eq('response_id', responseId);
  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  return { success: true };
}
