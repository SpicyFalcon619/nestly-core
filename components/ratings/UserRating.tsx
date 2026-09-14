'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { submitRating } from '@/app/actions/ratings';

interface UserRatingProps {
  targetUserId: string;
  initialRating: number;
  totalRatings: number;
  isLoggedIn: boolean;
  currentUserId?: string;
}

export default function UserRating({ targetUserId, initialRating, totalRatings, isLoggedIn, currentUserId }: UserRatingProps) {
  const [showModal, setShowModal] = useState(false);
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);
  const [review, setReview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [displayRating, setDisplayRating] = useState(initialRating);
  const [displayCount, setDisplayCount] = useState(totalRatings);

  const canRate = isLoggedIn && currentUserId !== targetUserId;

  const doSubmit = async () => {
    if (selected === 0) { toast.error('Please select a star rating.'); return; }
    setIsSubmitting(true);
    const res = await submitRating(targetUserId, selected, review);
    setIsSubmitting(false);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success('Rating submitted!');
      // Optimistic: recalculate average
      const newCount = displayCount + 1;
      const newAvg   = (displayRating * displayCount + selected) / newCount;
      setDisplayRating(Math.round(newAvg * 10) / 10);
      setDisplayCount(newCount);
      setShowModal(false);
      setSelected(0);
      setReview('');
    }
  };

  const stars = hovered || selected;

  return (
    <>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', cursor: canRate ? 'pointer' : 'default' }}
        onClick={() => canRate && setShowModal(true)}
        title={canRate ? 'Click to rate' : undefined}
      >
        <Star size={14} fill="var(--gold)" color="var(--gold)" />
        <span style={{ fontWeight: 600, fontSize: '13px' }}>{displayRating > 0 ? displayRating.toFixed(1) : 'New'}</span>
        <span style={{ color: 'var(--ink-muted)', fontSize: '12px' }}>({displayCount})</span>
        {canRate && <span style={{ fontSize: '12px', color: 'var(--primary)', marginLeft: '6px', textDecoration: 'underline' }}>Rate</span>}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h2 style={{ marginTop: 0 }}>Leave a Rating</h2>
            <form onSubmit={e => { e.preventDefault(); doSubmit(); }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', justifyContent: 'center' }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <Star
                    key={star}
                    size={36}
                    fill={star <= stars ? 'var(--gold)' : 'none'}
                    color={star <= stars ? 'var(--gold)' : 'var(--ink-muted)'}
                    style={{ cursor: 'pointer', transition: 'transform 0.1s' }}
                    onMouseEnter={() => setHovered(star)}
                    onMouseLeave={() => setHovered(0)}
                    onClick={() => setSelected(star)}
                  />
                ))}
              </div>
              {selected > 0 && (
                <p style={{ textAlign: 'center', fontWeight: 600, color: 'var(--primary)', marginTop: 0 }}>
                  {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][selected]}
                </p>
              )}
              <div className="form-group">
                <label>Write a Review (Optional)</label>
                <textarea
                  value={review}
                  onChange={e => setReview(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSubmit(); } }}
                  rows={3}
                  placeholder="How was your experience? (Enter to submit, Shift+Enter for a new line)"
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn btn-outline btn-block" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting || selected === 0} title="Enter to submit">
                  {isSubmitting ? 'Submitting…' : 'Submit Rating'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
