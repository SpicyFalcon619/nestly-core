'use client';

import { useState, useRef } from 'react';
import { ThumbsUp, ThumbsDown, MessageSquare, Send } from 'lucide-react';
import { addComment, voteComment } from '@/app/actions/comments';
import { toast } from 'sonner';
import { fmtDate, avatarInitials } from '@/lib/utils';
import Link from 'next/link';

interface Comment {
  comment_id: number;
  item_id?: number;
  listing_id?: number;
  user_id: string;
  content: string;
  upvotes: number;
  downvotes: number;
  created_at: string;
  user?: { name: string; profile_pic?: string };
  user_vote?: 1 | -1 | null;
}

interface CommentSectionProps {
  itemId: number;
  initialComments: Comment[];
  isLoggedIn: boolean;
  currentUserId?: string;
  type?: 'item' | 'listing';
}

export default function CommentSection({ itemId, initialComments, isLoggedIn, currentUserId, type = 'item' }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const doSubmit = async (text: string) => {
    if (!text || !isLoggedIn) return;

    setIsSubmitting(true);
    setNewComment('');

    // Optimistic insert
    const optimistic: Comment = {
      comment_id: Date.now(),
      user_id: currentUserId || '',
      content: text,
      upvotes: 0,
      downvotes: 0,
      created_at: new Date().toISOString(),
      user: { name: 'You' },
      user_vote: null,
    };
    setComments(prev => [...prev, optimistic]);

    const res = await addComment(itemId, text, type);
    if (res.error) {
      toast.error(res.error);
      setComments(prev => prev.filter(c => c.comment_id !== optimistic.comment_id));
      setNewComment(text);
    } else {
      // Replace optimistic with real data
      if (res.comment) {
        setComments(prev => prev.map(c =>
          c.comment_id === optimistic.comment_id ? { ...res.comment as Comment, user_vote: null } : c
        ));
      }
    }
    setIsSubmitting(false);
  };

  const handleVote = async (commentId: number, voteType: 1 | -1) => {
    if (!isLoggedIn) { toast.error('You must be logged in to vote.'); return; }

    // Optimistic
    setComments(prev => prev.map(c => {
      if (c.comment_id !== commentId) return c;
      let up = c.upvotes, dn = c.downvotes;
      let newVote: 1 | -1 | null = voteType;
      if (c.user_vote === voteType) {
        newVote = null;
        if (voteType === 1) up--; else dn--;
      } else {
        if (c.user_vote === 1) up--;
        if (c.user_vote === -1) dn--;
        if (voteType === 1) up++; else dn++;
      }
      return { ...c, upvotes: Math.max(0, up), downvotes: Math.max(0, dn), user_vote: newVote };
    }));

    const res = await voteComment(commentId, voteType, itemId, type);
    if (res.error) {
      toast.error(res.error);
      setComments(initialComments); // revert
    }
  };

  return (
    <div className="card" style={{ padding: '32px', marginBottom: '24px' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0, marginBottom: '24px' }}>
        <MessageSquare size={20} /> Comments ({comments.length})
      </h3>

      {isLoggedIn ? (
        <form onSubmit={e => { e.preventDefault(); doSubmit(newComment.trim()); }} style={{ marginBottom: '28px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0, marginTop: 2 }}>
            You
          </div>
          <div style={{ flex: 1 }}>
            <textarea
              ref={textareaRef}
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  doSubmit(newComment.trim());
                }
              }}
              placeholder="Ask a question or leave a comment…"
              style={{ width: '100%', minHeight: '72px', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }}
              disabled={isSubmitting}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--ink-muted)' }}>Enter to send · Shift+Enter for a new line</span>
              <button type="submit" className="btn btn-primary btn-sm" disabled={isSubmitting || !newComment.trim()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Send size={14} /> {isSubmitting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div style={{ padding: '14px', backgroundColor: 'var(--surface-1)', borderRadius: '8px', textAlign: 'center', marginBottom: '28px', fontSize: '14px' }}>
          <Link href="/login" style={{ color: 'var(--primary)', fontWeight: 500 }}>Log in to leave a comment</Link>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {comments.length === 0 ? (
          <p style={{ color: 'var(--ink-muted)', textAlign: 'center', padding: '16px 0' }}>No comments yet. Be the first!</p>
        ) : (
          comments.map(comment => (
            <div key={comment.comment_id} style={{ display: 'flex', gap: '12px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0, overflow: 'hidden' }}>
                {comment.user?.profile_pic
                  ? <img src={comment.user.profile_pic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : avatarInitials(comment.user?.name || 'U')}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>{comment.user?.name || 'Anonymous'}</span>
                  <span style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>{fmtDate(comment.created_at)}</span>
                </div>
                <p style={{ margin: '0 0 10px 0', lineHeight: 1.6, fontSize: '14px' }}>{comment.content}</p>
                <div className="vote-row">
                  <button
                    type="button"
                    className={`vote-btn ${comment.user_vote === 1 ? 'voted-up' : ''}`}
                    onClick={() => handleVote(comment.comment_id, 1)}
                    aria-pressed={comment.user_vote === 1}
                    title={comment.user_vote === 1 ? 'Remove upvote' : 'Upvote'}
                  >
                    <ThumbsUp size={14} fill={comment.user_vote === 1 ? 'currentColor' : 'none'} />
                    <span className="vote-count">{comment.upvotes}</span>
                  </button>
                  <button
                    type="button"
                    className={`vote-btn ${comment.user_vote === -1 ? 'voted-down' : ''}`}
                    onClick={() => handleVote(comment.comment_id, -1)}
                    aria-pressed={comment.user_vote === -1}
                    title={comment.user_vote === -1 ? 'Remove downvote' : 'Downvote'}
                  >
                    <ThumbsDown size={14} fill={comment.user_vote === -1 ? 'currentColor' : 'none'} />
                    <span className="vote-count">{comment.downvotes}</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
