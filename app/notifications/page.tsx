import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import NotificationsContent from './NotificationsContent';

export const metadata = {
  title: 'Notifications - Nestly',
  description: 'View your recent notifications.',
};

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch notifications
  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="container" style={{ padding: '40px 5%' }}>
      <h1 className="page-title">Notifications</h1>
      <NotificationsContent initialNotifications={notifications || []} />
    </div>
  );
}
