'use client';

import { useState } from 'react';
import { Send, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { submitApplication, withdrawApplication } from '@/app/actions/applications';

interface ApplicationFormProps {
  listingId: number;
  ownerId: string;
  listingTitle: string;
  existingStatus: string | null;
}

const statusConfig: Record<string, { icon: React.ReactNode; label: string; sub: string; color: string; bg: string }> = {
  pending: {
    icon: <Clock size={20} />,
    label: 'Application Sent',
    sub: 'Your application is pending. You\'ll be notified when the landlord responds.',
    color: 'var(--tint-amber-ink)',
    bg: 'var(--tint-amber)',
  },
  accepted: {
    icon: <CheckCircle2 size={20} />,
    label: 'Application Accepted!',
    sub: 'Congratulations! The landlord accepted your application. Contact them to proceed.',
    color: 'var(--tint-green-ink)',
    bg: 'var(--tint-green)',
  },
  rejected: {
    icon: <XCircle size={20} />,
    label: 'Application Declined',
    sub: 'Your previous application was declined. You may apply again below.',
    color: 'var(--danger)',
    bg: 'var(--tint-red)',
  },
};

export default function ApplicationForm({ listingId, ownerId, listingTitle, existingStatus }: ApplicationFormProps) {
  const [status, setStatus] = useState<string | null>(existingStatus);
  const [applying, setApplying] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [message, setMessage] = useState('');

  const handleWithdraw = async () => {
    if (!window.confirm('Withdraw your application? The landlord will be notified, and you can apply again later.')) return;
    setWithdrawing(true);
    const res = await withdrawApplication(listingId);
    setWithdrawing(false);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success('Application withdrawn.');
      setStatus(null);
    }
  };

  // Show status card for pending or accepted — not for rejected (allow re-apply)
  if (status && status !== 'rejected') {
    const cfg = statusConfig[status];
    return (
      <div>
        <div style={{
          padding: '16px',
          borderRadius: '10px',
          background: cfg.bg,
          border: `1.5px solid color-mix(in srgb, ${cfg.color} 30%, transparent)`,
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}>
          <span style={{ color: cfg.color, flexShrink: 0, marginTop: 2 }}>{cfg.icon}</span>
          <div>
            <div style={{ fontWeight: 700, color: cfg.color, marginBottom: 4 }}>{cfg.label}</div>
            <div style={{ fontSize: '13px', color: 'var(--ink-muted)', lineHeight: 1.5 }}>{cfg.sub}</div>
          </div>
        </div>
        {status === 'pending' && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleWithdraw}
            disabled={withdrawing}
            style={{ width: '100%', marginTop: '10px' }}
          >
            {withdrawing ? 'Withdrawing…' : 'Withdraw application'}
          </button>
        )}
      </div>
    );
  }

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setApplying(true);

    const res = await submitApplication(listingId, ownerId, listingTitle, message);

    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success('Application sent! The landlord will be notified.');
      setMessage('');
      setStatus('pending');
    }
    setApplying(false);
  };

  return (
    <form onSubmit={handleApply}>
      {status === 'rejected' && (
        <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--tint-red)', border: '1px solid color-mix(in srgb, var(--danger) 35%, transparent)', fontSize: '13px', color: 'var(--danger)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <XCircle size={14} /> Previous application was declined — you may apply again.
        </div>
      )}
      <textarea
        className="form-control"
        placeholder="Hi, I'm a student interested in renting..."
        style={{ height: '100px', marginBottom: '12px' }}
        value={message}
        onChange={e => setMessage(e.target.value)}
        required
        disabled={applying}
      />
      <button
        type="submit"
        className="btn btn-primary"
        style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }}
        disabled={applying || !message.trim()}
      >
        {applying ? 'Sending…' : <><Send size={16} /> Apply Now</>}
      </button>
    </form>
  );
}
