'use client';

import { useState } from 'react';
import { Flag } from 'lucide-react';
import { toast } from 'sonner';
import ComplaintModal from './modals/ComplaintModal';

export default function ReportButton({
  listingId,
  againstUserId,
  contextTitle,
}: {
  listingId?: number;
  againstUserId?: string;
  contextTitle: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0',
          color: 'var(--ink-muted)', fontSize: '13px', fontWeight: 500, fontFamily: 'inherit',
        }}
      >
        <Flag size={14} /> Report this listing
      </button>

      <ComplaintModal
        isOpen={open}
        onClose={() => setOpen(false)}
        listingId={listingId}
        againstUserId={againstUserId}
        contextTitle={contextTitle}
        onSuccess={() => {
          setOpen(false);
          toast.success('Report submitted. An administrator will review it.');
        }}
      />
    </>
  );
}
