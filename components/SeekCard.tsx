'use client';

import { useState } from 'react';
import type { SeekingPost } from '@/types';
import { fmt, propertyTypeLabel, fmtDate } from '@/lib/utils';
import { User, Calendar } from 'lucide-react';
import SeekResponseModal from './modals/SeekResponseModal';

interface SeekCardProps {
  post: SeekingPost;
  isLoggedIn: boolean;
}

export default function SeekCard({ post, isLoggedIn }: SeekCardProps) {
  const [responseModalOpen, setResponseModalOpen] = useState(false);

  const genderBadge = post.user_gender === 'female' 
    ? <><User size={14} /> Female Student</> 
    : post.user_gender === 'male' 
      ? <><User size={14} /> Male Student</> 
      : <><User size={14} /> Student</>;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>
            {post.user_name || 'Anonymous User'}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--gray)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {genderBadge}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className="badge badge-navy">{post.zone}</span>
          <div style={{ fontSize: '12px', color: 'var(--gray)', marginTop: '4px' }}>
            Posted {fmtDate(post.created_at)}
          </div>
        </div>
      </div>
      
      <div style={{ padding: '12px', backgroundColor: 'var(--surface-2)', borderRadius: '8px', marginBottom: '16px' }}>
        <div className="grid-2" style={{ gap: '12px' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--gray)' }}>Looking for</div>
            <div style={{ fontWeight: 500 }}>{propertyTypeLabel(post.property_type)}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--gray)' }}>Budget</div>
            <div style={{ fontWeight: 500 }}>{fmt(post.budget_min)} - {fmt(post.budget_max)}</div>
          </div>
          {post.move_in_date && (
            <div style={{ gridColumn: '1/-1' }}>
              <div style={{ fontSize: '12px', color: 'var(--gray)' }}><Calendar size={14} style={{ verticalAlign: 'text-bottom' }}/> Move-in Date</div>
              <div style={{ fontWeight: 500 }}>{fmtDate(post.move_in_date)}</div>
            </div>
          )}
        </div>
      </div>

      {post.requirements && (
        <div style={{ marginBottom: '20px', flexGrow: 1 }}>
          <div style={{ fontSize: '12px', color: 'var(--gray)', marginBottom: '4px' }}>Requirements / Notes</div>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {post.requirements}
          </p>
        </div>
      )}
      
      <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
        <button 
          className="btn btn-primary btn-block" 
          onClick={() => setResponseModalOpen(true)}
        >
          Respond to Post
        </button>
      </div>

      {responseModalOpen && (
        <SeekResponseModal 
          isOpen={responseModalOpen} 
          onClose={() => setResponseModalOpen(false)} 
          postId={post.post_id || post.id!} 
          postUser={post.user_name || 'User'}
        />
      )}
    </div>
  );
}
