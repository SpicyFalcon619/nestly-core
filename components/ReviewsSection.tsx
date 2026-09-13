'use client';

import { useState } from 'react';
import { Star, Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { createReviewSchema } from '@/lib/schemas';
import type { Review } from '@/types';

export default function ReviewsSection({ 
  listingId, 
  initialReviews,
  isLoggedIn,
  currentUserId
}: { 
  listingId: number; 
  initialReviews: Review[];
  isLoggedIn: boolean;
  currentUserId?: string;
}) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
  const [scores, setScores] = useState({
    value_for_money: 5,
    listing_accuracy: 5,
    landlord_response: 5,
    cleanliness: 5,
    safety: 5
  });
  const [comment, setComment] = useState('');

  const hasReviewed = reviews.some(r => r.reviewer_id === currentUserId);

  const doSubmit = async () => {
    setLoading(true);

    const validation = createReviewSchema.safeParse({
      listing_id: listingId,
      ...scores,
      comment
    });

    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    
    // In SQL trigger calculate composite, here we can pre-calculate for UI update
    const composite = (scores.value_for_money + scores.listing_accuracy + scores.landlord_response + scores.cleanliness + scores.safety) / 5;

    const { data, error } = await supabase
      .from('reviews')
      .insert({
        ...validation.data,
        composite_score: composite,
        reviewer_id: currentUserId
      })
      .select('*')
      .single();

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Review posted!');
      const { data: profile } = await supabase
        .from('profiles').select('name').eq('id', currentUserId!).single();
      setReviews([{ ...data, reviewer_name: profile?.name || 'You' }, ...reviews]);
      setShowForm(false);
    }
    
    setLoading(false);
  };

  const renderStars = (score: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star 
          key={i} 
          size={16} 
          fill={i <= Math.round(score) ? '#eab308' : 'none'} 
          color={i <= Math.round(score) ? '#eab308' : 'var(--gray)'} 
        />
      );
    }
    return <div style={{ display: 'flex', gap: '2px' }}>{stars}</div>;
  };

  const renderScoreSelect = (label: string, field: keyof typeof scores) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
      <label>{label}</label>
      <div style={{ display: 'flex', gap: '4px' }}>
        {[1, 2, 3, 4, 5].map(num => (
          <button 
            key={num} 
            type="button"
            onClick={() => setScores({ ...scores, [field]: num })}
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer',
              padding: 0
            }}
          >
            <Star 
              size={20} 
              fill={num <= scores[field] ? '#eab308' : 'none'} 
              color={num <= scores[field] ? '#eab308' : 'var(--gray)'} 
            />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="card" style={{ marginTop: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ margin: 0 }}>Reviews & Ratings</h3>
        {isLoggedIn && !hasReviewed && !showForm && (
          <button className="btn btn-outline btn-sm" onClick={() => setShowForm(true)}>
            Write a Review
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={e => { e.preventDefault(); doSubmit(); }} style={{ background: 'var(--surface-2)', padding: '20px', borderRadius: '8px', marginBottom: '32px', border: '1px solid var(--border)' }}>
          <h4 style={{ marginTop: 0 }}>Rate your experience</h4>
          <div className="grid-2" style={{ gap: '16px 32px', marginBottom: '16px' }}>
            <div>
              {renderScoreSelect('Value for Money', 'value_for_money')}
              {renderScoreSelect('Listing Accuracy', 'listing_accuracy')}
              {renderScoreSelect('Landlord Response', 'landlord_response')}
            </div>
            <div>
              {renderScoreSelect('Cleanliness', 'cleanliness')}
              {renderScoreSelect('Safety & Security', 'safety')}
            </div>
          </div>
          
          <div className="form-group">
            <label>Review Comment (Optional)</label>
            <textarea
              rows={3}
              value={comment}
              onChange={e => setComment(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); doSubmit(); } }}
              placeholder="Share details of your experience… (Ctrl+Enter to submit)"
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Send size={16} /> Post Review
            </button>
          </div>
        </form>
      )}

      {reviews.length === 0 ? (
        <p style={{ color: 'var(--gray)', textAlign: 'center', padding: '24px 0' }}>No reviews yet. Be the first to review!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {reviews.map(review => (
            <div key={review.review_id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ fontWeight: 600 }}>{(review as any).reviewer_name || review.reviewer_name || 'Anonymous'}</div>
                <div style={{ fontSize: '13px', color: 'var(--gray)' }}>{new Date(review.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                {renderStars(review.composite_score)}
                <span style={{ fontWeight: 600, fontSize: '14px' }}>{Number(review.composite_score).toFixed(1)}</span>
              </div>
              {review.comment && (
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--ink-mid)' }}>{review.comment}</p>
              )}
              
              <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '12px', color: 'var(--gray)' }}>
                <span>Value: {review.value_for_money}</span>
                <span>Accuracy: {review.listing_accuracy}</span>
                <span>Response: {review.landlord_response}</span>
                <span>Cleanliness: {review.cleanliness}</span>
                <span>Safety: {review.safety}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
