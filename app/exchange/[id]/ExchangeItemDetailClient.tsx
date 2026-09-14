'use client';

import { useState } from 'react';
import Link from 'next/link';
import OfferModal from '@/components/modals/OfferModal';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

interface ExchangeItemDetailClientProps {
  itemId: number;
  itemTitle: string;
  sellerId: string;
  isLoggedIn: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  status: string;
  askingPrice: number;
}

export default function ExchangeItemDetailClient({
  itemId,
  itemTitle,
  sellerId,
  isLoggedIn,
  isOwner,
  isAdmin,
  status,
  askingPrice,
}: ExchangeItemDetailClientProps) {
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [loading, _setLoading] = useState(false);
  const [localStatus, setLocalStatus] = useState(status);

  const handleMarkSold = async () => {
    if (!confirm('Mark this item as sold?')) return;
    const supabase = createClient();
    const { error } = await supabase.from('items').update({ status: 'sold' }).eq('item_id', itemId);
    if (error) { toast.error(error.message); } else { toast.success('Marked as sold.'); setLocalStatus('sold'); }
  };

  const handleWithdraw = async () => {
    if (!confirm('Withdraw this item?')) return;
    const supabase = createClient();
    const { error } = await supabase.from('items').update({ status: 'withdrawn' }).eq('item_id', itemId);
    if (error) { toast.error(error.message); } else { toast.success('Item withdrawn.'); setLocalStatus('withdrawn'); }
  };

  const handleAdminRemove = async () => {
    if (!confirm('Remove this item as admin?')) return;
    const supabase = createClient();
    const { error } = await supabase.from('items').update({ status: 'withdrawn' }).eq('item_id', itemId);
    if (error) { toast.error(error.message); } else { toast.success('Item removed.'); setLocalStatus('withdrawn'); }
  };

  const handleRelist = async () => {
    const supabase = createClient();
    const { error } = await supabase.from('items').update({ status: 'available' }).eq('item_id', itemId);
    if (error) { toast.error(error.message); } else { toast.success('Item is live again!'); setLocalStatus('available'); }
  };

  if (localStatus !== 'available') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ padding: '16px', backgroundColor: 'var(--surface-2)', borderRadius: '8px', textAlign: 'center', fontWeight: 500 }}>
          This item is currently <strong>{localStatus}</strong>.
        </div>
        {isOwner && (localStatus === 'sold' || localStatus === 'withdrawn') && (
          <button className="btn btn-outline btn-block" onClick={handleRelist} disabled={loading}>
            Re-list This Item
          </button>
        )}
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ padding: '12px 16px', background: 'var(--surface-1)', borderRadius: '8px', fontSize: '13px', color: 'var(--ink-muted)', textAlign: 'center' }}>
          You are viewing this item as an admin.
        </div>
        <button
          className="btn btn-outline btn-block"
          style={{ borderColor: 'var(--danger, #be3d2f)', color: 'var(--danger, #be3d2f)' }}
          onClick={handleAdminRemove}
          disabled={loading}
        >
          Admin: Remove This Item
        </button>
      </div>
    );
  }

  if (isOwner) {
    return (
      <div style={{ display: 'flex', gap: '12px' }}>
        <button className="btn btn-primary btn-block" onClick={handleMarkSold} disabled={loading}>Mark as Sold</button>
        <button className="btn btn-outline btn-block" onClick={handleWithdraw} disabled={loading}>Withdraw Item</button>
      </div>
    );
  }

  if (isLoggedIn) {
    return (
      <>
        <button className="btn btn-primary btn-block" onClick={() => setOfferModalOpen(true)}>
          Make an Offer
        </button>
        <OfferModal
          isOpen={offerModalOpen}
          onClose={() => setOfferModalOpen(false)}
          itemId={itemId}
          itemTitle={itemTitle}
          sellerId={sellerId}
          askingPrice={askingPrice}
        />
      </>
    );
  }

  return (
    <Link href="/login" className="btn btn-primary btn-block" style={{ textAlign: 'center', textDecoration: 'none' }}>
      Log in to Make an Offer
    </Link>
  );
}
