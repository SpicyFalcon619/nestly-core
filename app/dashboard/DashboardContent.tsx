'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle, Clock, XCircle, Building2, ShoppingBag, Search, Heart, List, FileText, Settings, Bell, RefreshCw, MessageCircle, Activity, ThumbsUp, ThumbsDown, MessageSquare, Star, Tag } from 'lucide-react';
import type { DashboardData, Profile } from '@/types';
import { fmt, conditionLabel, conditionColor, statusBadge, propertyTypeLabel } from '@/lib/utils';
import ListingCard from '@/components/ListingCard';
import VerificationModal from '@/components/modals/VerificationModal';
import { useRouter, useSearchParams } from 'next/navigation';
import { markNotificationAsRead, markAllNotificationsAsRead } from '@/app/actions/notifications';
import {
  acceptOffer, rejectOffer, counterOffer, withdrawOffer, acceptCounterOffer,
} from '@/app/actions/offers';
import {
  acceptApplication, rejectApplication,
  updateListingStatus, updateItemStatus, deleteListing,
  acceptSeekResponse, rejectSeekResponse,
} from '@/app/actions/applications';
import { toast } from 'sonner';
import CustomSelect from '@/components/CustomSelect';
import MessageButton from '@/components/MessageButton';

export default function DashboardContent({ data, user }: { data: DashboardData; user: Profile }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'listings');
  const [isVerifModalOpen, setIsVerifModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState<any[]>(data.notifications || []);
  const [offersRecv, setOffersRecv] = useState<any[]>(data.offersRecv);
  const [offersSent, setOffersSent] = useState<any[]>(data.offersSent);
  const [appsRecv, setAppsRecv] = useState<any[]>(data.appsRecv);
  const [seekRespRecv, setSeekRespRecv] = useState<any[]>(data.seekRespRecv || []);
  const [myListings, setMyListings] = useState<any[]>(data.myListings);
  const [myItems, setMyItems] = useState<any[]>(data.myItems);
  const [counterModal, setCounterModal] = useState<{ offerId: number; title: string } | null>(null);
  const [counterPrice, setCounterPrice] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { const tab = searchParams.get('tab'); if (tab) setActiveTab(tab); }, [searchParams]);

  const switchTab = (tab: string) => { setActiveTab(tab); router.push(`/dashboard?tab=${tab}`); };

  const wrap = async (id: number, fn: () => Promise<any>) => {
    setActionLoading(id);
    const res = await fn();
    setActionLoading(null);
    if (res?.error) toast.error(res.error);
    return res;
  };

  const { watched, mySeeking, seekRespSent, hasPreferences, verifStatus } = data;

  const activeOffersCount = offersSent.filter(o => o.status === 'pending' || o.status === 'countered').length +
    offersRecv.filter(o => o.status === 'pending' || o.status === 'countered').length;

  const compatStatus = (user.role === 'student' && hasPreferences)
    ? <><CheckCircle size={16} /> Complete</>
    : 'Setup Required';
  const compatColor = (user.role === 'student' && hasPreferences) ? 'var(--success)' : 'var(--warning)';

  let verifText: React.ReactNode = 'Unverified';
  let verifColor = 'var(--gray)';
  if (verifStatus === 'pending')  { verifText = <><Clock size={16} /> Pending</>;    verifColor = 'var(--warning)'; }
  if (verifStatus === 'approved') { verifText = <><CheckCircle size={16} /> Verified</>; verifColor = 'var(--success)'; }
  if (verifStatus === 'rejected') { verifText = <><XCircle size={16} /> Rejected</>;  verifColor = 'var(--danger)'; }

  const handleMarkRead = async (notifId: number) => {
    setNotifications(prev => prev.map(n => n.notif_id === notifId ? { ...n, is_read: true } : n));
    await markNotificationAsRead(notifId);
  };

  const handleMarkAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await markAllNotificationsAsRead();
  };

  // ── Offer actions ─────────────────────────────────────────────
  const doAcceptOffer = async (offerId: number) => {
    const res = await wrap(offerId, () => acceptOffer(offerId));
    if (res?.success) {
      toast.success('Offer accepted!');
      setOffersRecv(prev => prev.map(o => o.offer_id === offerId ? { ...o, status: 'accepted' } : o));
    }
  };
  const doRejectOffer = async (offerId: number) => {
    const res = await wrap(offerId, () => rejectOffer(offerId));
    if (res?.success) {
      toast.success('Offer rejected.');
      setOffersRecv(prev => prev.map(o => o.offer_id === offerId ? { ...o, status: 'rejected' } : o));
    }
  };
  const doCounterOffer = async () => {
    if (!counterModal) return;
    const price = Number(counterPrice);
    if (!price || price < 1) { toast.error('Enter a valid counter price.'); return; }
    const res = await wrap(counterModal.offerId, () => counterOffer(counterModal.offerId, price));
    if (res?.success) {
      toast.success('Counter-offer sent!');
      setOffersRecv(prev => prev.map(o => o.offer_id === counterModal.offerId ? { ...o, status: 'countered', counter_price: price } : o));
      setCounterModal(null); setCounterPrice('');
    }
  };
  const doWithdrawOffer = async (offerId: number) => {
    if (!confirm('Withdraw this offer?')) return;
    const res = await wrap(offerId, () => withdrawOffer(offerId));
    if (res?.success) {
      toast.success('Offer withdrawn.');
      setOffersSent(prev => prev.map(o => o.offer_id === offerId ? { ...o, status: 'withdrawn' } : o));
    }
  };
  const doAcceptCounter = async (offerId: number) => {
    const res = await wrap(offerId, () => acceptCounterOffer(offerId));
    if (res?.success) {
      toast.success('Counter-offer accepted!');
      setOffersSent(prev => prev.map(o => o.offer_id === offerId ? { ...o, status: 'accepted' } : o));
    }
  };

  // ── Application actions ───────────────────────────────────────
  const doAcceptApp = async (appId: number) => {
    const res = await wrap(appId, () => acceptApplication(appId));
    if (res?.success) {
      toast.success('Application accepted! Applicant notified.');
      setAppsRecv(prev => prev.map(a => a.application_id === appId ? { ...a, status: 'accepted' } : a));
      // Auto-mark the listing as occupied in local state
      if (res.listingId) {
        setMyListings(prev => prev.map(l => (l.listing_id || l.id) === res.listingId ? { ...l, status: 'occupied' } : l));
      }
    }
  };
  const doRejectApp = async (appId: number) => {
    const res = await wrap(appId, () => rejectApplication(appId));
    if (res?.success) {
      toast.success('Application rejected.');
      setAppsRecv(prev => prev.map(a => a.application_id === appId ? { ...a, status: 'rejected' } : a));
    }
  };

  // ── Status changes ────────────────────────────────────────────
  const doUpdateListingStatus = async (listingId: number, status: string) => {
    const res = await wrap(listingId, () => updateListingStatus(listingId, status));
    if (res?.success) {
      toast.success('Listing status updated.');
      setMyListings(prev => prev.map(l => (l.listing_id || l.id) === listingId ? { ...l, status } : l));
    }
  };

  const doDeleteListing = async (listingId: number, title: string) => {
    if (!window.confirm(`Delete "${title}" permanently? This also removes every application, review, and cost record tied to it. This cannot be undone.`)) return;
    const res = await wrap(listingId, () => deleteListing(listingId));
    if (res?.success) {
      toast.success('Listing deleted.');
      setMyListings(prev => prev.filter(l => (l.listing_id || l.id) !== listingId));
    }
  };
  const doUpdateItemStatus = async (itemId: number, status: string) => {
    const res = await wrap(itemId, () => updateItemStatus(itemId, status));
    if (res?.success) {
      toast.success('Item status updated.');
      setMyItems(prev => prev.map(i => (i.item_id || i.id) === itemId ? { ...i, status } : i));
    }
  };

  // ── Seek response actions ─────────────────────────────────────
  const doAcceptSeek = async (responseId: number) => {
    const res = await wrap(responseId, () => acceptSeekResponse(responseId));
    if (res?.success) {
      toast.success('Response accepted! Responder notified.');
      setSeekRespRecv(prev => prev.map(r => r.response_id === responseId ? { ...r, status: 'accepted' } : r));
    }
  };
  const doRejectSeek = async (responseId: number) => {
    const res = await wrap(responseId, () => rejectSeekResponse(responseId));
    if (res?.success) {
      toast.success('Response rejected.');
      setSeekRespRecv(prev => prev.map(r => r.response_id === responseId ? { ...r, status: 'rejected' } : r));
    }
  };

  const statusBadgeEl = (status: string) => <span dangerouslySetInnerHTML={{ __html: statusBadge(status) }} />;
  const isLoading = (id: number) => actionLoading === id;

  return (
    <div className="container">
      <h1 className="page-title">Welcome back, {user.name}</h1>

      {/* ── Stat cards ── */}
      <div className="stats-row">
        {user.role !== 'admin' && (
          <div className="stat-card" onClick={() => { if (verifStatus === 'none' || verifStatus === 'rejected') setIsVerifModalOpen(true); }} style={{ cursor: (verifStatus === 'none' || verifStatus === 'rejected') ? 'pointer' : 'default' }}>
            <div className="stat-label">Verification</div>
            <div className="stat-value" style={{ color: verifColor, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '18px' }}>{verifText}</div>
            {(verifStatus === 'none' || verifStatus === 'rejected') && <div style={{ fontSize: '12px', color: 'var(--gold)', marginTop: '6px', fontWeight: 600 }}>Click to verify</div>}
          </div>
        )}
        <div className="stat-card" onClick={() => switchTab('listings')} style={{ cursor: 'pointer' }}>
          <div className="stat-label">Active Listings</div>
          <div className="stat-value">{myListings.length}</div>
        </div>
        {user.role === 'student' && (
          <div className="stat-card" onClick={() => switchTab('watch')} style={{ cursor: 'pointer' }}>
            <div className="stat-label">Watchlisted</div>
            <div className="stat-value">{watched.length}</div>
          </div>
        )}
        <div className="stat-card" onClick={() => switchTab('offers')} style={{ cursor: 'pointer' }}>
          <div className="stat-label">Active Offers</div>
          <div className="stat-value">{activeOffersCount}</div>
        </div>
        {user.role === 'student' && (
          <div className="stat-card" onClick={() => switchTab('preferences')} style={{ cursor: 'pointer' }}>
            <div className="stat-label">Compatibility</div>
            <div className="stat-value" style={{ color: compatColor, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '18px' }}>{compatStatus}</div>
          </div>
        )}
      </div>

      <div className="dashboard-layout">
        {/* ── Sidebar ── */}
        <div className="dashboard-sidebar card" style={{ padding: '16px' }}>
          <div className="sidebar-section-title" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px', paddingLeft: '14px' }}>Management</div>
          {[
            { id: 'listings',     icon: <Building2 size={16} />,  label: 'My Listings' },
            { id: 'items',        icon: <ShoppingBag size={16} />, label: 'Exchange Items' },
            ...(user.role === 'student' ? [
              { id: 'seeking',    icon: <Search size={16} />,      label: 'Looking For' },
              { id: 'preferences',icon: <Settings size={16} />,    label: 'Preferences' },
            ] : []),
          ].map(({ id, icon, label }) => (
            <div key={id} className={`dashboard-nav-item ${activeTab === id ? 'active' : ''}`} onClick={() => switchTab(id)}>
              {icon} {label}
            </div>
          ))}

          <div className="sidebar-section-title" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px', marginTop: '18px', paddingLeft: '14px' }}>Interactions</div>
          {[
            { id: 'messages',     icon: <MessageCircle size={16} />, label: 'Messages' },
            { id: 'watch',        icon: <Heart size={16} />,       label: 'Watchlist' },
            { id: 'offers',       icon: <List size={16} />,        label: 'Offers' },
            { id: 'applications', icon: <FileText size={16} />,    label: 'Housing Applications' },
            { id: 'activity',     icon: <Activity size={16} />,    label: 'My Activity' },
          ].map(({ id, icon, label }) => (
            <div key={id} className={`dashboard-nav-item ${activeTab === id ? 'active' : ''}`} onClick={() => switchTab(id)}>
              {icon} {label}
            </div>
          ))}

          <div className="sidebar-section-title" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px', marginTop: '18px', paddingLeft: '14px' }}>Account</div>
          <div className={`dashboard-nav-item ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => switchTab('notifications')}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Bell size={16} /> Notifications</span>
              {mounted && notifications.filter(n => !n.is_read).length > 0 && (
                <span style={{ background: 'var(--danger)', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '10px', fontWeight: 700 }}>
                  {notifications.filter(n => !n.is_read).length}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="dashboard-main">

          {/* MESSAGES TAB */}
          {activeTab === 'messages' && (
            <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
              <MessageCircle size={48} style={{ color: 'var(--primary)', opacity: 0.7, marginBottom: 16 }} />
              <h3 style={{ marginTop: 0 }}>Your Messages</h3>
              <p style={{ color: 'var(--ink-muted)', marginBottom: 24 }}>Open the full messaging inbox to view and reply to all conversations.</p>
              <Link href="/messages" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <MessageCircle size={16} /> Open Messages
              </Link>
            </div>
          )}

          {/* LISTINGS TAB */}
          {activeTab === 'listings' && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, color: 'var(--navy)' }}>My Properties</h3>
                <Link href="/listings/new" className="btn btn-primary btn-sm">+ New Listing</Link>
              </div>
              {myListings.length === 0 ? (
                <p style={{ color: 'var(--ink-muted)', textAlign: 'center', padding: '24px 0' }}>No listings yet.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <thead><tr><th>Title</th><th>Zone</th><th>Status</th><th>Total/mo</th><th>Actions</th></tr></thead>
                    <tbody>
                      {myListings.map(l => {
                        const lid = l.listing_id || l.id;
                        return (
                          <tr key={lid}>
                            <td><Link href={`/listings/${lid}`} style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>{l.title}</Link></td>
                            <td>{l.zone || l.zone_id}</td>
                            <td>
                              <CustomSelect
                                value={l.status}
                                onChange={val => doUpdateListingStatus(lid, val)}
                                options={[
                                  { value: 'available',   label: 'Available' },
                                  { value: 'occupied',    label: 'Occupied' },
                                  { value: 'soon_vacant', label: 'Soon Vacant' },
                                ]}
                              />
                            </td>
                            <td>{fmt(l.costs?.total_monthly || 0)}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <Link className="btn btn-primary btn-sm" href={`/listings/${lid}`}>View</Link>
                                <button
                                  className="btn btn-danger btn-sm"
                                  disabled={actionLoading === lid}
                                  onClick={() => doDeleteListing(lid, l.title)}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ITEMS TAB */}
          {activeTab === 'items' && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, color: 'var(--navy)' }}>My Marketplace Items</h3>
                <Link href="/exchange" className="btn btn-primary btn-sm">+ Sell Item</Link>
              </div>
              {myItems.length === 0 ? (
                <p style={{ color: 'var(--ink-muted)', textAlign: 'center', padding: '24px 0' }}>No items listed yet.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <thead><tr><th>Title</th><th>Price</th><th>Condition</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {myItems.map(it => {
                        const iid = it.item_id || it.id;
                        return (
                          <tr key={iid}>
                            <td><Link href={`/exchange/${iid}`} style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>{it.title}</Link></td>
                            <td>{fmt(it.asking_price || 0)}</td>
                            <td><span className={`badge ${conditionColor(it.item_condition)}`}>{conditionLabel(it.item_condition)}</span></td>
                            <td>
                              <CustomSelect
                                value={it.status || 'available'}
                                onChange={val => doUpdateItemStatus(iid, val)}
                                options={[
                                  { value: 'available',  label: 'Available' },
                                  { value: 'sold',       label: 'Sold' },
                                  { value: 'withdrawn',  label: 'Withdrawn' },
                                ]}
                              />
                            </td>
                            <td>
                              <Link className="btn btn-primary btn-sm" href={`/exchange/${iid}`}>View</Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SEEKING TAB */}
          {activeTab === 'seeking' && user.role === 'student' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card">
                <h3 style={{ marginTop: 0, color: 'var(--navy)' }}>My "Looking For" Requests</h3>
                {(!mySeeking || mySeeking.length === 0) ? (
                  <p style={{ color: 'var(--ink-muted)', textAlign: 'center', padding: '24px 0' }}>No requests. <Link href="/seeking">Post one</Link></p>
                ) : (
                  <div className="table-responsive">
                    <table className="table">
                      <thead><tr><th>Zone</th><th>Type</th><th>Budget</th><th>Move-in</th><th>Status</th></tr></thead>
                      <tbody>
                        {mySeeking.map(s => (
                          <tr key={s.post_id || s.id}>
                            <td>{s.zone || s.zone_id}</td>
                            <td>{propertyTypeLabel(s.property_type)}</td>
                            <td>{fmt(s.budget_min)} – {fmt(s.budget_max)}</td>
                            <td>{s.move_in_date || 'Flexible'}</td>
                            <td>{statusBadgeEl(s.status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="card">
                <h3 style={{ marginTop: 0, color: 'var(--navy)' }}>Responses Received</h3>
                {(!seekRespRecv || seekRespRecv.length === 0) ? (
                  <p style={{ color: 'var(--ink-muted)', textAlign: 'center', padding: '12px 0' }}>No responses yet.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table">
                      <thead><tr><th>From</th><th>Message</th><th>Status</th><th>Actions</th></tr></thead>
                      <tbody>
                        {seekRespRecv.map(r => (
                          <tr key={r.response_id}>
                            <td><strong>{r.responder_name}</strong></td>
                            <td style={{ maxWidth: 200, wordBreak: 'break-word' }}>{r.message}</td>
                            <td>{statusBadgeEl(r.status)}</td>
                            <td>
                              {r.status === 'pending' && (
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <button className="btn btn-success btn-sm" onClick={() => doAcceptSeek(r.response_id)} disabled={isLoading(r.response_id)}>Accept</button>
                                  <button className="btn btn-danger btn-sm" onClick={() => doRejectSeek(r.response_id)} disabled={isLoading(r.response_id)}>Reject</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="card">
                <h3 style={{ marginTop: 0, color: 'var(--navy)' }}>Responses Sent</h3>
                {(!seekRespSent || seekRespSent.length === 0) ? (
                  <p style={{ color: 'var(--ink-muted)', textAlign: 'center', padding: '12px 0' }}>None sent.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table">
                      <thead><tr><th>Request</th><th>Landlord</th><th>Your Message</th><th>Status</th></tr></thead>
                      <tbody>
                        {seekRespSent.map(r => (
                          <tr key={r.response_id}>
                            <td>{r.requirements ? r.requirements.substring(0, 40) + '…' : '—'}</td>
                            <td>{r.owner_name || '—'}</td>
                            <td style={{ maxWidth: 200 }}>{r.message}</td>
                            <td>{statusBadgeEl(r.status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PREFERENCES TAB */}
          {activeTab === 'preferences' && user.role === 'student' && (
            <div className="card">
              <h3 style={{ marginTop: 0, color: 'var(--navy)' }}>Compatibility Preferences</h3>
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <p style={{ color: 'var(--ink-muted)', maxWidth: 400, margin: '0 auto 24px' }}>
                  {hasPreferences ? 'Your roommate matching preferences are active.' : 'Set up your preferences to unlock roommate matching.'}
                </p>
                <Link href="/profile" className="btn btn-primary">Manage in Profile</Link>
              </div>
            </div>
          )}

          {/* WATCHLIST TAB */}
          {activeTab === 'watch' && (
            <div className="card">
              <h3 style={{ marginTop: 0, color: 'var(--navy)', marginBottom: '14px' }}>Saved Properties</h3>
              {watched.length === 0 ? (
                <p style={{ color: 'var(--ink-muted)', textAlign: 'center', padding: '24px 0' }}>Empty. <Link href="/listings">Browse listings</Link></p>
              ) : (
                <div className="grid-3">{watched.map(l => <ListingCard key={l.listing_id || l.id} listing={l} />)}</div>
              )}
            </div>
          )}

          {/* OFFERS TAB */}
          {activeTab === 'offers' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card">
                <h3 style={{ marginTop: 0, color: 'var(--navy)' }}>Offers Received</h3>
                {offersRecv.length === 0 ? (
                  <p style={{ color: 'var(--ink-muted)', textAlign: 'center', padding: '12px 0' }}>No offers received.</p>
                ) : (() => {
                  // Group by item_id
                  const byItem = new Map<number, any[]>();
                  offersRecv.forEach(o => {
                    if (!byItem.has(o.item_id)) byItem.set(o.item_id, []);
                    byItem.get(o.item_id)!.push(o);
                  });
                  return Array.from(byItem.entries()).map(([itemId, offers]) => (
                    <div key={itemId} style={{ marginBottom: 20 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                        <Link href={`/exchange/${itemId}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{offers[0].title}</Link>
                        <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--ink-muted)', fontWeight: 400 }}>{offers.length} offer{offers.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="table-responsive">
                        <table className="table">
                          <thead><tr><th>Buyer</th><th>Offer</th><th>Status</th><th>Actions</th></tr></thead>
                          <tbody>
                            {offers.map(o => (
                              <tr key={o.offer_id}>
                                <td>
                                  <div style={{ fontWeight: 500 }}>{o.buyer_name}</div>
                                  {o.message && <div style={{ fontSize: '12px', color: 'var(--ink-muted)', marginTop: 2, fontStyle: 'italic' }}>"{o.message}"</div>}
                                  {o.buyer_id && (
                                    <Link href="/messages" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '12px', color: 'var(--primary)', marginTop: 6, textDecoration: 'none', fontWeight: 500 }}>
                                      <MessageCircle size={12} /> Message
                                    </Link>
                                  )}
                                </td>
                                <td style={{ fontWeight: 600 }}>{fmt(o.counter_price || o.offer_price)}</td>
                                <td>{statusBadgeEl(o.status)}</td>
                                <td>
                                  {o.status === 'pending' && (
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                      <button className="btn btn-success btn-sm" onClick={() => doAcceptOffer(o.offer_id)} disabled={isLoading(o.offer_id)}>Accept</button>
                                      <button className="btn btn-outline btn-sm" onClick={() => { setCounterModal({ offerId: o.offer_id, title: o.title }); setCounterPrice(''); }} disabled={isLoading(o.offer_id)}>Counter</button>
                                      <button className="btn btn-danger btn-sm" onClick={() => doRejectOffer(o.offer_id)} disabled={isLoading(o.offer_id)}>Reject</button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ));
                })()}
              </div>

              <div className="card">
                <h3 style={{ marginTop: 0, color: 'var(--navy)' }}>Offers Sent</h3>
                {offersSent.length === 0 ? (
                  <p style={{ color: 'var(--ink-muted)', textAlign: 'center', padding: '12px 0' }}>No outgoing offers.</p>
                ) : (() => {
                  const byItem = new Map<number, any[]>();
                  offersSent.forEach(o => {
                    if (!byItem.has(o.item_id)) byItem.set(o.item_id, []);
                    byItem.get(o.item_id)!.push(o);
                  });
                  return Array.from(byItem.entries()).map(([itemId, offers]) => (
                    <div key={itemId} style={{ marginBottom: 20 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                        <Link href={`/exchange/${itemId}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{offers[0].title}</Link>
                        <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--ink-muted)', fontWeight: 400 }}>Seller: {offers[0].seller_name}</span>
                      </div>
                      <div className="table-responsive">
                        <table className="table">
                          <thead><tr><th>Your Bid</th><th>Status</th><th>Actions</th></tr></thead>
                          <tbody>
                            {offers.map(o => (
                              <tr key={o.offer_id}>
                                <td style={{ fontWeight: 600 }}>
                                  {fmt(o.offer_price)}
                                  {o.counter_price && <div style={{ fontSize: '12px', color: 'var(--gold)' }}>Counter: {fmt(o.counter_price)}</div>}
                                </td>
                                <td>{statusBadgeEl(o.status)}</td>
                                <td>
                                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                    {o.status === 'countered' && (
                                      <>
                                        <button className="btn btn-success btn-sm" onClick={() => doAcceptCounter(o.offer_id)} disabled={isLoading(o.offer_id)}>Accept Counter</button>
                                        <button className="btn btn-danger btn-sm" onClick={() => doRejectOffer(o.offer_id)} disabled={isLoading(o.offer_id)}>Decline</button>
                                      </>
                                    )}
                                    {o.status === 'pending' && (
                                      <button className="btn btn-outline btn-sm" onClick={() => doWithdrawOffer(o.offer_id)} disabled={isLoading(o.offer_id)}>Withdraw</button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* APPLICATIONS TAB */}
          {activeTab === 'applications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card">
                <h3 style={{ marginTop: 0, color: 'var(--navy)' }}>Applications Received</h3>
                {appsRecv.length === 0 ? (
                  <p style={{ color: 'var(--ink-muted)', textAlign: 'center', padding: '12px 0' }}>No applications received.</p>
                ) : (() => {
                  const byListing = new Map<number, any[]>();
                  appsRecv.forEach(a => {
                    if (!byListing.has(a.listing_id)) byListing.set(a.listing_id, []);
                    byListing.get(a.listing_id)!.push(a);
                  });
                  return Array.from(byListing.entries()).map(([listingId, apps]) => (
                    <div key={listingId} style={{ marginBottom: 20 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                        <Link href={`/listings/${listingId}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{apps[0].listing_title}</Link>
                        <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--ink-muted)', fontWeight: 400 }}>{apps.length} applicant{apps.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="table-responsive">
                        <table className="table">
                          <thead><tr><th>Applicant</th><th>Message</th><th>Status</th><th>Actions</th></tr></thead>
                          <tbody>
                            {apps.map(a => (
                              <tr key={a.application_id}>
                                <td>
                                  <div style={{ fontWeight: 500 }}>{a.applicant_name}</div>
                                  <div style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>{a.applicant_email}</div>
                                  {a.applicant_id && (
                                    <Link href="/messages" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '12px', color: 'var(--primary)', marginTop: 6, textDecoration: 'none', fontWeight: 500 }}>
                                      <MessageCircle size={12} /> Message
                                    </Link>
                                  )}
                                </td>
                                <td>
                                  <div style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.message}>
                                    {a.message || '—'}
                                  </div>
                                </td>
                                <td>{statusBadgeEl(a.status)}</td>
                                <td>
                                  {a.status === 'pending' && (
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                      <button className="btn btn-success btn-sm" onClick={() => doAcceptApp(a.application_id)} disabled={isLoading(a.application_id)}>Accept</button>
                                      <button className="btn btn-danger btn-sm" onClick={() => doRejectApp(a.application_id)} disabled={isLoading(a.application_id)}>Reject</button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ));
                })()}
              </div>

              <div className="card">
                <h3 style={{ marginTop: 0, color: 'var(--navy)' }}>Applications Sent</h3>
                {data.appsSent.length === 0 ? (
                  <p style={{ color: 'var(--ink-muted)', textAlign: 'center', padding: '12px 0' }}>No applications sent.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table">
                      <thead><tr><th>Listing</th><th>Owner</th><th>Status</th><th>Date</th><th></th></tr></thead>
                      <tbody>
                        {data.appsSent.map((a: any) => (
                          <tr key={a.application_id}>
                            <td><Link href={`/listings/${a.listing_id}`} style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>{a.listing_title}</Link></td>
                            <td>{a.owner_name || '—'}</td>
                            <td>{statusBadgeEl(a.status)}</td>
                            <td style={{ fontSize: '13px', color: 'var(--ink-muted)' }}>{a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}</td>
                            <td>
                              {a.owner_id && (
                                <MessageButton
                                  otherUserId={a.owner_id}
                                  listingId={a.listing_id}
                                  label="Message"
                                  className="btn btn-outline btn-sm"
                                />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'activity' && (
            <div className="card">
              <h3 style={{ marginTop: 0, color: 'var(--navy)' }}>My Activity</h3>
              <p style={{ color: 'var(--ink-muted)', fontSize: '14px', marginTop: 0, marginBottom: '20px' }}>
                Everything you&apos;ve commented on, voted on, offered for and reviewed.
              </p>

              {(data.activity?.length ?? 0) === 0 ? (
                <p style={{ color: 'var(--ink-muted)', textAlign: 'center', padding: '32px 0' }}>
                  No activity yet. Comment on a listing or make an offer and it&apos;ll show up here.
                </p>
              ) : (
                <div className="activity-feed">
                  {data.activity!.map(a => {
                    const icon =
                      a.kind === 'comment' ? <MessageSquare size={15} /> :
                      a.kind === 'vote'    ? (a.action.startsWith('Liked') ? <ThumbsUp size={15} /> : <ThumbsDown size={15} />) :
                      a.kind === 'offer'   ? <Tag size={15} /> :
                      a.kind === 'rating'  ? <Star size={15} /> :
                                             <FileText size={15} />;
                    return (
                      <div key={a.id} className="activity-row">
                        <span className="activity-icon">{icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '14px', color: 'var(--ink)' }}>
                            {a.action}{' '}
                            {a.href
                              ? <Link href={a.href} style={{ fontWeight: 600 }}>{a.subject}</Link>
                              : <strong>{a.subject}</strong>}
                          </div>
                          {a.detail && <div className="activity-detail">{a.detail}</div>}
                        </div>
                        <span className="activity-time">{new Date(a.at).toLocaleDateString()}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, color: 'var(--navy)' }}>Notifications</h3>
                {notifications.some(n => !n.is_read) && (
                  <button className="btn btn-outline btn-sm" onClick={handleMarkAllRead} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <RefreshCw size={13} /> Mark all read
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <p style={{ color: 'var(--ink-muted)', textAlign: 'center', padding: '24px 0' }}>No notifications yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {notifications.map(n => (
                    <div
                      key={n.notif_id}
                      onClick={() => { if (!n.is_read) handleMarkRead(n.notif_id); if (n.link) router.push(n.link); }}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 16px', borderRadius: '8px',
                        background: n.is_read ? 'transparent' : 'var(--primary-light, #EEF7F2)',
                        border: `1px solid ${n.is_read ? 'var(--border)' : 'var(--primary)'}`,
                        cursor: n.link ? 'pointer' : 'default',
                        transition: 'background 0.2s',
                      }}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.is_read ? 'transparent' : 'var(--primary)', flexShrink: 0, marginTop: 6 }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: n.is_read ? 400 : 600 }}>{n.message}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--ink-muted)' }}>{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Counter-offer modal ── */}
      {counterModal && (
        <div className="modal-overlay" onClick={() => setCounterModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <h2 style={{ marginTop: 0 }}>Counter Offer</h2>
            <p style={{ color: 'var(--ink-muted)', fontSize: 14 }}>Item: <strong>{counterModal.title}</strong></p>
            <div className="form-group">
              <label>Your Counter Price (৳)</label>
              <input type="number" min="1" value={counterPrice} onChange={e => setCounterPrice(e.target.value)} placeholder="e.g. 1800" />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button className="btn btn-outline btn-block" onClick={() => setCounterModal(null)}>Cancel</button>
              <button className="btn btn-primary btn-block" onClick={doCounterOffer} disabled={isLoading(counterModal.offerId)}>Send Counter</button>
            </div>
          </div>
        </div>
      )}

      <VerificationModal
        isOpen={isVerifModalOpen}
        onClose={() => setIsVerifModalOpen(false)}
        userId={user.id}
        onSuccess={() => { setIsVerifModalOpen(false); router.refresh(); }}
      />
    </div>
  );
}
