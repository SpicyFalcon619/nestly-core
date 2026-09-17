'use server';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { sendNotificationEmail, shouldEmail } from '@/lib/email';

// Internal helper to create a notification for all admins
export async function createAdminNotification(type: string, message: string, link: string) {
  try {
    const adminSupabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get all admin users
    const { data: admins } = await adminSupabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin');

    if (!admins || admins.length === 0) return;

    const notifications = admins.map(admin => ({
      user_id: admin.id,
      type,
      message,
      link,
      is_read: false
    }));

    await adminSupabase.from('notifications').insert(notifications);
  } catch (error) {
    console.error("Failed to create admin notification:", error);
  }
}

// Internal helper to create a notification for a specific user
export async function createUserNotification(userId: string, type: string, message: string, link: string) {
  try {
    const adminSupabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await adminSupabase.from('notifications').insert({
      user_id: userId,
      type,
      message,
      link,
      is_read: false
    });

    if (shouldEmail(type)) {
      const { data: recipient } = await adminSupabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single();
      if (recipient?.email) {
        await sendNotificationEmail({ to: recipient.email, type, message, link });
      }
    }
  } catch (error) {
    console.error("Failed to create user notification:", error);
  }
}

// User action to mark a notification as read
export async function markNotificationAsRead(notifId: number) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('notif_id', notifId)
      .eq('user_id', user.id);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// User action to mark all notifications as read
export async function markAllNotificationsAsRead() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
