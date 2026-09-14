'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useSearchParams, useRouter } from 'next/navigation';
import type { AdminStats, Complaint, Verification, Notification } from '@/types';
import { ShieldAlert, UserCheck, TrendingUp, Home, Users } from 'lucide-react';
import { statusBadge } from '@/lib/utils';
import RentChart from './RentChart';
import DemandChart from './DemandChart';
import { adminUpdateVerification, adminUpdateComplaint, adminUpdateUserStatus, adminDeleteListing } from '@/app/actions/admin';
import { markNotificationAsRead } from '@/app/actions/notifications';
import DocumentViewerModal from '@/components/modals/DocumentViewerModal';

export default function AdminContent({ 
  stats, 
  initialVerifications, 
  initialComplaints,
  allUsers,
  allListings,
  initialNotifications
}: { 
  stats: AdminStats;
  initialVerifications: Verification[];
  initialComplaints: Complaint[];
  allUsers: any[];
  allListings: any[];
  initialNotifications?: Notification[];
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
  const [verifications, setVerifications] = useState(initialVerifications);
  const [complaints, setComplaints] = useState(initialComplaints);
  const [notifications, setNotifications] = useState(initialNotifications || []);
  const [usersList, setUsersList] = useState(allUsers);
  const [listingsList, setListingsList] = useState(allListings);

  // Sync tab state with URL changes and handle mounting
  useEffect(() => {
    setMounted(true);
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  // Helper to change tab and update URL
  const changeTab = (tab: string) => {
    setActiveTab(tab);
    router.push(`/admin?tab=${tab}`);
  };

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerType, setViewerType] = useState<string>('Document');

  const openDocument = (url: string, type: string) => {
    setViewerUrl(url);
    setViewerType(type);
    setViewerOpen(true);
  };

  const handleMarkRead = async (notifId: number) => {
    const result = await markNotificationAsRead(notifId);
    if (!result.success) {
      toast.error(result.error || 'Failed to mark as read');
    } else {
      setNotifications(notifications.map(n => n.notif_id === notifId ? { ...n, is_read: true } : n));
    }
  };

  const handleVerifAction = async (id: number, status: 'approved' | 'rejected') => {
    const result = await adminUpdateVerification(id, status);
    if (!result.success) {
      toast.error(result.error || 'Action failed');
    } else {
      toast.success(`Verification ${status}`);
      setVerifications(verifications.map(v => v.verification_id === id ? { ...v, status } : v));
    }
  };

  const handleComplaintAction = async (id: number, status: 'resolved' | 'dismissed') => {
    const result = await adminUpdateComplaint(id, status);
    if (!result.success) {
      toast.error(result.error || 'Action failed');
    } else {
      toast.success(`Complaint ${status}`);
      setComplaints(complaints.map(c => c.complaint_id === id ? { ...c, status } : c));
    }
  };

  const setUserStatus = async (id: string, status: 'active' | 'suspended') => {
    const result = await adminUpdateUserStatus(id, status);
    if (!result.success) {
      toast.error(result.error || 'Failed to update user');
    } else {
      toast.success(`User marked as ${status}`);
      setUsersList(usersList.map(u => u.id === id ? { ...u, status } : u));
    }
  };

  const deleteListing = async (id: number) => {
    if (!confirm('Are you sure you want to delete this listing?')) return;
    const result = await adminDeleteListing(id);
    if (!result.success) {
      toast.error(result.error || 'Failed to delete listing');
    } else {
      toast.success('Listing deleted');
      setListingsList(listingsList.filter(l => l.listing_id !== id));
    }
  };

  return (
    <div>
      <div className="tabs" style={{ marginBottom: '24px' }}>
        <div className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => changeTab('overview')}>Overview</div>
        <div className={`tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => changeTab('users')}>Users & Listings</div>
        <div className={`tab ${activeTab === 'verifications' ? 'active' : ''}`} onClick={() => changeTab('verifications')}>ID Verifications</div>
        <div className={`tab ${activeTab === 'complaints' ? 'active' : ''}`} onClick={() => changeTab('complaints')}>Complaints</div>
        <div className={`tab ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => changeTab('notifications')}>
          Notifications
          {notifications.filter(n => !n.is_read).length > 0 && (
            <span style={{ background: 'var(--danger)', color: 'white', fontSize: '10px', padding: '2px 6px', borderRadius: '10px', marginLeft: '6px' }}>
              {notifications.filter(n => !n.is_read).length}
            </span>
          )}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div id="tab-overview">
          <div className="grid-4" style={{ marginBottom: '24px' }}>
            <div className="stat-card">
              <div className="stat-label">Total Listings</div>
              <div className="stat-value">{stats.totalListings}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Users</div>
              <div className="stat-value">{stats.totalUsers || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Open Complaints</div>
              <div className="stat-value" style={{ color: stats.openComplaints > 0 ? 'var(--danger)' : 'var(--emerald)' }}>{stats.openComplaints}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Pending Verifications</div>
              <div className="stat-value">{verifications.filter(v => v.status === 'pending').length}</div>
            </div>
          </div>

          <div className="grid-2" style={{ marginBottom: '24px' }}>
            <div className="card">
              <h3 style={{ marginTop: 0, color: 'var(--navy)' }}>Average Rent by Zone</h3>
              {stats.avgRentByZone.length === 0 ? <p className="text-gray">Not enough data.</p> : (
                <RentChart data={stats.avgRentByZone} />
              )}
            </div>

            <div className="card">
              <h3 style={{ marginTop: 0, color: 'var(--navy)' }}>Demand vs Supply</h3>
              {stats.seekingVsListings.length === 0 ? <p className="text-gray">Not enough data.</p> : (
                <DemandChart data={stats.seekingVsListings} />
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div id="tab-users">
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 style={{ marginTop: 0, color: 'var(--navy)' }}>Manage All Users</h3>
            <div className="table-responsive">
              <table className="table">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {usersList.map(u => (
                    <tr key={u.id}>
                      <td><strong>{u.name}</strong></td>
                      <td>{u.email}</td>
                      <td><span className={`badge badge-${u.role === 'admin' ? 'navy' : u.role === 'landlord' ? 'gold' : 'blue'}`}>{u.role}</span></td>
                      <td>
                        {u.status === 'suspended' ? <span className="badge badge-red">Suspended</span> : <span className="badge badge-green">Active</span>}
                      </td>
                      <td>
                        {u.status === 'suspended' 
                          ? <button className="btn btn-success btn-sm" onClick={() => setUserStatus(u.id, 'active')}>Activate</button>
                          : <button className="btn btn-outline btn-sm" onClick={() => setUserStatus(u.id, 'suspended')}>Suspend</button>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0, color: 'var(--navy)' }}>Manage All Listings</h3>
            <div className="table-responsive">
              <table className="table">
                <thead><tr><th>ID</th><th>Title</th><th>Zone</th><th>Owner</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {listingsList.map(l => (
                    <tr key={l.listing_id}>
                      <td>{l.listing_id}</td>
                      <td><a href={`/listings/${l.listing_id}`} style={{ color: 'var(--navy)', fontWeight: 600 }}>{l.title}</a></td>
                      <td>{l.zone}</td>
                      <td>{l.ownerName || l.ownerEmail?.split('@')[0] || 'Unknown'}</td>
                      <td><span dangerouslySetInnerHTML={{ __html: statusBadge(l.status) }} /></td>
                      <td><button className="btn btn-danger btn-sm" onClick={() => deleteListing(l.listing_id)}>Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'verifications' && (
        <div className="card" id="tab-verifications">
          <h2 style={{ marginTop: 0, color: 'var(--navy)' }}>Identity Verifications</h2>
          {verifications.length === 0 ? (
            <p className="text-gray text-center" style={{ padding: '24px 0' }}>No verifications found.</p>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead><tr><th>User</th><th>Document Type</th><th>Date</th><th>Status</th><th>Document</th><th>Actions</th></tr></thead>
                <tbody>
                  {verifications.map(v => (
                    <tr key={v.verification_id}>
                      <td>
                        <strong>{(v as any).userName || 'User'}</strong><br />
                        <span style={{ fontSize: '12px', color: 'var(--gray)' }}>{(v as any).userEmail}</span>
                      </td>
                      <td>{v.nid_type}</td>
                      <td>{mounted ? new Date(v.submitted_at).toLocaleDateString() : ''}</td>
                      <td><span dangerouslySetInnerHTML={{ __html: statusBadge(v.status) }} /></td>
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={() => openDocument(v.document_path, v.nid_type)}>
                          View Document
                        </button>
                      </td>
                      <td>
                        {v.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-success btn-sm" onClick={() => handleVerifAction(v.verification_id, 'approved')}>Approve</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleVerifAction(v.verification_id, 'rejected')}>Reject</button>
                          </div>
                        ) : v.status === 'approved' ? (
                          <button className="btn btn-danger btn-sm" onClick={() => handleVerifAction(v.verification_id, 'rejected')}>Revoke</button>
                        ) : (
                          <span style={{ fontSize: '13px', color: 'var(--gray)', textTransform: 'capitalize' }}>{v.status}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          <DocumentViewerModal 
            isOpen={viewerOpen} 
            onClose={() => setViewerOpen(false)} 
            documentUrl={viewerUrl} 
            documentType={viewerType} 
          />
        </div>
      )}

      {activeTab === 'complaints' && (
        <div className="card" id="tab-complaints">
          <h2 style={{ marginTop: 0, color: 'var(--navy)' }}>Complaints & Reports</h2>
          {complaints.length === 0 ? (
            <p className="text-gray text-center" style={{ padding: '24px 0' }}>No complaints found.</p>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead><tr><th>Reporter</th><th>Against</th><th>Category</th><th>Description</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {complaints.map(c => (
                    <tr key={c.complaint_id}>
                      <td><strong>{(c as any).complainantName || 'User'}</strong></td>
                      <td>
                        <strong>{(c as any).againstName || 'User'}</strong>
                        {(c as any).listingTitle && <div style={{ fontSize: '12px', color: 'var(--gray)' }}>Re: {(c as any).listingTitle}</div>}
                      </td>
                      <td>{c.category}</td>
                      <td style={{ maxWidth: '250px' }}>{c.description}</td>
                      <td><span dangerouslySetInnerHTML={{ __html: statusBadge(c.status) }} /></td>
                      <td>
                        {(c.status === 'pending' || c.status === 'open') ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            <button className="btn btn-success btn-sm" onClick={() => handleComplaintAction(c.complaint_id, 'resolved')}>Resolve</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleComplaintAction(c.complaint_id, 'dismissed')}>Dismiss</button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '13px', color: 'var(--gray)' }}>Processed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="card" id="tab-notifications">
          <h2 style={{ marginTop: 0, color: 'var(--navy)' }}>System Notifications</h2>
          {notifications.length === 0 ? (
            <p className="text-gray text-center" style={{ padding: '24px 0' }}>You have no notifications.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {notifications.map(n => {
                let badgeColor = 'var(--gray)';
                if (n.type === 'verification') badgeColor = 'var(--warning)';
                if (n.type === 'complaint') badgeColor = 'var(--danger)';
                if (n.type === 'listing') badgeColor = 'var(--success)';

                return (
                  <div key={n.notif_id} style={{ 
                    padding: '16px', 
                    borderRadius: 'var(--radius)', 
                    border: '1px solid var(--border)',
                    backgroundColor: n.is_read ? 'transparent' : 'var(--emerald-soft)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ 
                          backgroundColor: badgeColor, 
                          color: 'white', 
                          fontSize: '11px', 
                          padding: '2px 8px', 
                          borderRadius: '12px',
                          textTransform: 'uppercase',
                          fontWeight: 600
                        }}>
                          {n.type}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--gray)' }}>
                          {mounted ? new Date(n.created_at).toLocaleString() : ''}
                        </span>
                      </div>
                      <p style={{ margin: '8px 0 0 0', fontWeight: n.is_read ? 400 : 600 }}>{n.message}</p>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      {n.link && (
                        <a href={n.link} className="btn btn-outline btn-sm" onClick={() => handleMarkRead(n.notif_id)}>View Details</a>
                      )}
                      {!n.is_read && (
                        <button className="btn btn-primary btn-sm" onClick={() => handleMarkRead(n.notif_id)}>Mark Read</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
