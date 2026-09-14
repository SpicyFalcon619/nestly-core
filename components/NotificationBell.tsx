'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Bell, Check } from 'lucide-react';
import { markNotificationAsRead, markAllNotificationsAsRead } from '@/app/actions/notifications';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);
  const supabase = createClient();
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifs = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (data) {
      setNotifications(data);
      setUnread(data.filter(n => !n.is_read).length);
    }
  };

  useEffect(() => {
    setMounted(true);
    let channel: any;
    let isMounted = true;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isMounted) return;

      await fetchNotifs();
      if (!isMounted) return;

      // Use a unique channel name to prevent Strict Mode collisions
      const channelName = `realtime_notifications_${user.id}_${Math.random().toString(36).substring(7)}`;
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          (payload) => {
            if (isMounted) fetchNotifs();
          }
        )
        .subscribe();
    };

    init();
    
    // Fallback polling just in case realtime drops
    const interval = setInterval(fetchNotifs, 60000);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpen = () => {
    setOpen(!open);
  };

  const handleMarkAllAsRead = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await markAllNotificationsAsRead();
    fetchNotifs();
  };

  const handleMarkAsRead = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    await markNotificationAsRead(id);
    fetchNotifs();
  };

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        className="icon-btn"
        onClick={handleOpen}
        title="Notifications"
        aria-label="Notifications"
        style={{ position: 'relative' }}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: 'var(--danger)', color: '#fff',
            fontSize: 10, fontWeight: 700, lineHeight: 1.6,
            minWidth: 17, height: 17, borderRadius: '10px', padding: '0 4px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--surface)',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 10px)', right: 0,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
          width: 320, zIndex: 1000,
          display: 'flex', flexDirection: 'column',
          padding: '16px'
        }}>
          <div style={{ fontWeight: 600, color: 'var(--ink)', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '8px' }}>
            Notifications
          </div>

          <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: '8px', fontSize: 13, color: 'var(--ink-mid)' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '10px 0', textAlign: 'center' }}>
                No notifications
              </div>
            ) : (
              notifications.map((n) => (
                <div key={n.notif_id} style={{
                  padding: '10px',
                  borderBottom: '1px solid var(--border)',
                  background: n.is_read ? 'transparent' : 'var(--emerald-soft)',
                  borderRadius: '6px',
                  marginBottom: '2px'
                }}>
                  <div style={{
                    fontWeight: n.is_read ? 'normal' : 'bold',
                    color: 'var(--ink)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '8px'
                  }}>
                    {n.link ? (
                      <Link 
                        href={n.link.replace('.html', '').startsWith('/') ? n.link.replace('.html', '') : `/${n.link.replace('.html', '')}`} 
                        onClick={() => setOpen(false)}
                        style={{ textDecoration: 'none', color: 'inherit', flex: 1 }}
                      >
                        {n.message}
                      </Link>
                    ) : (
                      <span style={{ flex: 1 }}>{n.message}</span>
                    )}

                    {!n.is_read && (
                      <button 
                        className="btn btn-outline btn-sm" 
                        style={{ padding: '2px 6px', border: 'none', background: 'transparent' }}
                        onClick={(e) => handleMarkAsRead(e, n.notif_id)}
                        title="Mark as read"
                      >
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 4 }}>
                    {mounted ? new Date(n.created_at).toLocaleString() : ''}
                  </div>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <button 
              className="btn btn-outline btn-block btn-sm" 
              onClick={handleMarkAllAsRead}
            >
              Mark all as read
            </button>
          )}
        </div>
      )}
    </div>
  );
}
