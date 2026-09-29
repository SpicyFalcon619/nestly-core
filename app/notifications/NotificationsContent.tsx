'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Notification } from '@/types';
import { Bell, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function NotificationsContent({ 
  initialNotifications 
}: { 
  initialNotifications: Notification[];
}) {
  const [notifications, setNotifications] = useState(initialNotifications);

  const handleMarkAsRead = async (notifId: number) => {
    const supabase = createClient();
    await supabase.from('notifications').update({ is_read: true }).eq('notif_id', notifId);
    setNotifications(notifications.map(n => n.notif_id === notifId ? { ...n, is_read: true } : n));
  };

  const handleMarkAllAsRead = async () => {
    const supabase = createClient();
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.notif_id);
    if (unreadIds.length === 0) return;

    await supabase.from('notifications').update({ is_read: true }).in('notif_id', unreadIds);
    setNotifications(notifications.map(n => ({ ...n, is_read: true })));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: 'var(--navy)' }}>
          <Bell size={24} /> 
          Your Notifications
          {unreadCount > 0 && <span className="badge badge-primary">{unreadCount} new</span>}
        </h2>
        {unreadCount > 0 && (
          <button className="btn btn-outline btn-sm" onClick={handleMarkAllAsRead}>
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--gray)' }}>
          <Bell size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
          <h3>You're all caught up!</h3>
          <p>You have no notifications at the moment.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {notifications.map(notif => (
            <div 
              key={notif.notif_id} 
              style={{ 
                padding: '16px', 
                borderRadius: '8px', 
                border: '1px solid var(--border)',
                backgroundColor: notif.is_read ? 'white' : '#f0f9ff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'start',
                gap: '16px'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: notif.is_read ? 400 : 600, color: 'var(--navy)', marginBottom: '8px' }}>
                  {notif.message}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px', color: 'var(--gray)' }}>
                  {/* No locale/timeZone here used to mean "whatever the runtime's
                      default is" — the server (wherever it's hosted) and the
                      visitor's own browser almost never agree, so the server-
                      rendered string and the client's hydration pass produced
                      different text and React threw a hydration mismatch
                      (error #418) — invisible in dev (which shows the full
                      warning instead of failing), but a real, visible crash
                      in the production build. Pinning both makes every
                      render — server or client, wherever either runs —
                      compute the exact same string. */}
                  <span>{new Date(notif.created_at).toLocaleString('en-US', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' })}</span>
                  {notif.link && (
                    <Link href={notif.link} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      View Details →
                    </Link>
                  )}
                </div>
              </div>
              
              {!notif.is_read && (
                <button 
                  className="btn btn-outline btn-sm" 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', fontSize: '12px' }}
                  onClick={() => handleMarkAsRead(notif.notif_id)}
                >
                  <CheckCircle size={14} /> Mark Read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
