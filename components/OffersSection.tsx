'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { fmt, avatarInitials } from '@/lib/utils';
import { acceptOffer, rejectOffer, counterOffer } from '@/app/actions/offers';
import { Gavel, TrendingDown, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';

interface Offer {
  offer_id: number;
  buyer_id: string;
  offer_price: number;
  counter_price?: number;
  message?: string;
  status: string;
  created_at: string;
  buyer?: { name: string; profile_pic?: string };
}

interface OffersSectionProps {
  offers: Offer[];
  isOwner: boolean;
  itemId: number;
}

const statusColors: Record<string, string> = {
  pending:   '#f59e0b',
  countered: '#3b82f6',
  accepted:  '#10b981',
  rejected:  '#ef4444',
  withdrawn: '#9ca3af',
};

export default function OffersSection({ offers: initialOffers, isOwner, itemId }: OffersSectionProps) {
  const [offers, setOffers]       = useState<Offer[]>(initialOffers);
  const [loading, setLoading]     = useState<number | null>(null);
  const [counterOf, setCounterOf] = useState<number | null>(null);
  const [counterVal, setCounterVal] = useState('');

  if (!isOwner && offers.filter(o => o.status !== 'withdrawn').length === 0) return null;

  const withLoad = async (id: number, fn: () => Promise<any>) => {
    setLoading(id);
    const res = await fn();
    setLoading(null);
    if (res?.error) toast.error(res.error);
    return res;
  };

  const doAccept = async (offerId: number) => {
    const res = await withLoad(offerId, () => acceptOffer(offerId));
    if (res?.success) {
      toast.success('Offer accepted!');
      setOffers(prev => prev.map(o => o.offer_id === offerId ? { ...o, status: 'accepted' } : o));
    }
  };

  const doReject = async (offerId: number) => {
    const res = await withLoad(offerId, () => rejectOffer(offerId));
    if (res?.success) {
      toast.success('Offer rejected.');
      setOffers(prev => prev.map(o => o.offer_id === offerId ? { ...o, status: 'rejected' } : o));
    }
  };

  const doCounter = async () => {
    if (!counterOf) return;
    const price = Number(counterVal);
    if (!price || price < 1) { toast.error('Enter a valid counter price.'); return; }
    const res = await withLoad(counterOf, () => counterOffer(counterOf, price));
    if (res?.success) {
      toast.success('Counter-offer sent!');
      setOffers(prev => prev.map(o => o.offer_id === counterOf ? { ...o, status: 'countered', counter_price: price } : o));
      setCounterOf(null); setCounterVal('');
    }
  };

  const visible = offers.filter(o => isOwner || o.status !== 'withdrawn');

  return (
    <div className="card" style={{ padding: '28px', marginTop: '24px' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0, marginBottom: '20px' }}>
        <Gavel size={20} /> Offers ({visible.length})
      </h3>

      {visible.length === 0 ? (
        <p style={{ color: 'var(--ink-muted)', textAlign: 'center', padding: '16px 0' }}>No offers yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {visible.map(o => {
            const initials = avatarInitials(o.buyer?.name || 'U');
            const isActive = loading === o.offer_id;
            return (
              <div
                key={o.offer_id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px',
                  borderRadius: '10px', border: `1px solid ${statusColors[o.status] || 'var(--border)'}22`,
                  background: o.status === 'accepted' ? '#f0fdf4' : 'var(--surface-1)',
                }}
              >
                {/* Avatar */}
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0, overflow: 'hidden' }}>
                  {o.buyer?.profile_pic
                    ? <img src={o.buyer.profile_pic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : initials}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{o.buyer?.name || 'Buyer'}</div>
                  {o.message && <div style={{ fontSize: '12px', color: 'var(--ink-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>"{o.message}"</div>}
                  <div style={{ fontSize: '12px', color: 'var(--ink-muted)', marginTop: 2 }}>{new Date(o.created_at).toLocaleDateString()}</div>
                </div>

                {/* Prices */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '16px' }}>{fmt(o.offer_price)}</div>
                  {o.counter_price && (
                    <div style={{ fontSize: '12px', color: statusColors.countered, fontWeight: 600 }}>
                      Counter: {fmt(o.counter_price)}
                    </div>
                  )}
                </div>

                {/* Status badge */}
                <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: `${statusColors[o.status] || '#9ca3af'}22`, color: statusColors[o.status] || '#9ca3af', flexShrink: 0, textTransform: 'capitalize' }}>
                  {o.status}
                </span>

                {/* Owner actions */}
                {isOwner && o.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button className="btn btn-success btn-sm" onClick={() => doAccept(o.offer_id)} disabled={isActive} title="Accept">
                      <CheckCircle2 size={14} />
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={() => { setCounterOf(o.offer_id); setCounterVal(''); }} disabled={isActive} title="Counter" style={{ display: 'flex', alignItems: 'center' }}>
                      <ChevronRight size={14} />
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => doReject(o.offer_id)} disabled={isActive} title="Reject">
                      <XCircle size={14} />
                    </button>
                  </div>
                )}
                {isOwner && o.status === 'countered' && (
                  <span style={{ fontSize: '12px', color: statusColors.countered }}>Waiting for buyer</span>
                )}
                {o.status === 'accepted' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontWeight: 600, fontSize: '13px', flexShrink: 0 }}>
                    <TrendingDown size={14} /> Deal!
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Counter-offer inline modal */}
      {counterOf !== null && (
        <div style={{ marginTop: '16px', padding: '16px', borderRadius: '10px', background: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <p style={{ margin: '0 0 10px', fontWeight: 600 }}>Enter Counter Price (৳)</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="number" min="1" value={counterVal}
              onChange={e => setCounterVal(e.target.value)}
              placeholder="e.g. 2000"
              style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
            />
            <button className="btn btn-primary btn-sm" onClick={doCounter} disabled={loading === counterOf}>Send</button>
            <button className="btn btn-outline btn-sm" onClick={() => setCounterOf(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
