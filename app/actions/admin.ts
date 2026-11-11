'use server';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createUserNotification } from './notifications';

// Helper to get admin client but verify authorization first
async function getAdminSupabase() {
  const authSupabase = await createServerClient();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await authSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    throw new Error("Unauthorized: Admin access required");
  }

  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Identity documents live in a private bucket. Admins open them through a
// short-lived signed link created here, after the same admin check as every
// other action in this file.
export async function adminGetVerificationDocumentUrl(id: number) {
  try {
    const adminSupabase = await getAdminSupabase();
    const { data: verif, error } = await adminSupabase
      .from('verifications')
      .select('document_path')
      .eq('verification_id', id)
      .single();

    if (error || !verif) throw new Error('Verification not found');
    const path: string = verif.document_path;

    // Rows created by the demo seed have no real file.
    if (path.startsWith('demo://')) {
      return { success: false, error: 'This demo account has no document on file.' };
    }

    // Rows created before the private bucket existed hold a full public URL.
    // Until scripts/migrate-verification-docs.mjs has moved them, hand it back.
    if (/^https?:\/\//.test(path)) {
      return { success: true, url: path };
    }

    const { data, error: signError } = await adminSupabase.storage
      .from('verifications')
      .createSignedUrl(path, 300); // valid for 5 minutes

    if (signError || !data) throw new Error(signError?.message || 'Could not create a link to the document');
    return { success: true, url: data.signedUrl };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function adminUpdateVerification(id: number, status: 'approved' | 'rejected') {
  try {
    const adminSupabase = await getAdminSupabase();
    const { data: verif, error } = await adminSupabase
      .from('verifications')
      .update({ status })
      .eq('verification_id', id)
      .select('user_id')
      .single();

    if (error) throw error;

    let message = `Your identity verification has been ${status}.`;
    if (status === 'rejected') {
      message = 'Your account verification request was rejected or revoked. Please review our guidelines and try again.';
    } else if (status === 'approved') {
      message = 'Congratulations! Your account verification has been approved. Your listings will now display a verified badge.';
    }

    // Notify user
    await createUserNotification(
      verif.user_id,
      'verification',
      message,
      '/profile'
    );

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function adminUpdateComplaint(id: number, status: 'resolved' | 'dismissed') {
  try {
    const adminSupabase = await getAdminSupabase();
    const { data: complaint, error } = await adminSupabase
      .from('complaints')
      .update({ status, resolved_at: status === 'resolved' ? new Date().toISOString() : null })
      .eq('complaint_id', id)
      .select('complainant_id')
      .single();

    if (error) throw error;

    // Notify complainant
    await createUserNotification(
      complaint.complainant_id,
      'complaint',
      `Your complaint has been marked as ${status}.`,
      '/dashboard'
    );

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function adminUpdateUserStatus(id: string, status: 'active' | 'suspended') {
  try {
    const adminSupabase = await getAdminSupabase();
    const { error } = await adminSupabase
      .from('profiles')
      .update({ status })
      .eq('id', id);

    if (error) throw error;

    if (status === 'suspended') {
      await createUserNotification(
        id,
        'system',
        'Your account has been suspended by an administrator due to violations of our policies.',
        ''
      );
    } else if (status === 'active') {
      await createUserNotification(
        id,
        'system',
        'Your account has been reactivated. Welcome back!',
        ''
      );
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function adminDeleteListing(id: number) {
  try {
    const adminSupabase = await getAdminSupabase();
    const { error } = await adminSupabase
      .from('listings')
      .delete()
      .eq('listing_id', id);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
