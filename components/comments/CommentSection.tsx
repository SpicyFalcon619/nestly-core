'use client';

import { useState, useRef, useMemo } from 'react';
import { ThumbsUp, ThumbsDown, MessageSquare, Send, Trash2, CornerDownRight } from 'lucide-react';
import { addComment, voteComment, deleteComment } from '@/app/actions/comments';
import { toast } from 'sonner';
import { fmtDate, avatarInitials } from '@/lib/utils';
import type { CommentMention } from '@/lib/comments';
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
  parent_id?: number | null;
  mentions?: CommentMention[] | null;
  user?: { name: string; profile_pic?: string; profile_slug?: string; is_public?: boolean };
  user_vote?: 1 | -1 | null;
}

interface CommentSectionProps {
  itemId: number;
  initialComments: Comment[];
  isLoggedIn: boolean;
  currentUserId?: string;
  type?: 'item' | 'listing';
  /** False until migration 0007 exists — replies and mentions stay hidden. */
  threadsEnabled?: boolean;
  /** People already in the thread, plus the owner. */
  mentionable?: CommentMention[];
}

/** Renders "@Name" inside a comment as a link to that profile. */
function renderBody(text: string, mentions?: CommentMention[] | null) {
  if (!mentions || mentions.length === 0) return text;

  // Longest name first, so "@Ayesha Rahman" wins over "@Ayesha".
  const byLength = [...mentions].sort((a, b) => b.name.length - a.name.length);
  const out: React.ReactNode[] = [];
  let rest = text;
  let key = 0;

  while (rest.length > 0) {
    let hit: { at: number; mention: CommentMention } | null = null;
    for (const mention of byLength) {
      const at = rest.indexOf(`@${mention.name}`);
      if (at >= 0 && (!hit || at < hit.at)) hit = { at, mention };
    }
    if (!hit) { out.push(rest); break; }

    if (hit.at > 0) out.push(rest.slice(0, hit.at));
    out.push(
      hit.mention.slug
        ? <Link key={key++} href={`/profiles/${hit.mention.slug}`} className="mention">@{hit.mention.name}</Link>
        : <span key={key++} className="mention">@{hit.mention.name}</span>
    );
    rest = rest.slice(hit.at + hit.mention.name.length + 1);
  }
  return out;
}

interface ComposerProps {
  placeholder: string;
  submitLabel: string;
  busy: boolean;
  autoFocus?: boolean;
  initialText?: string;
  initialMentions?: CommentMention[];
  mentionable: CommentMention[];
  onSubmit: (text: string, mentions: CommentMention[]) => void;
  onCancel?: () => void;
}

function Composer({
  placeholder, submitLabel, busy, autoFocus, initialText = '',
  initialMentions = [], mentionable, onSubmit, onCancel,
}: ComposerProps) {
  const [text, setText] = useState(initialText);
  const [tagged, setTagged] = useState<CommentMention[]>(initialMentions);
  // The "@word" being typed at the caret, or null when there isn't one.
  const [token, setToken] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);

  const suggestions = useMemo(() => {
    if (token === null || mentionable.length === 0) return [];
    const q = token.toLowerCase();
    return mentionable.filter(m => m.name.toLowerCase().includes(q)).slice(0, 5);
  }, [token, mentionable]);

  const readToken = (el: HTMLTextAreaElement) => {
    const upToCaret = el.value.slice(0, el.selectionStart ?? el.value.length);
    // An @ that starts a word, followed by at most a first name and a surname.
    const m = upToCaret.match(/(?:^|\s)@([\p{L}\p{N} ._-]{0,24})$/u);
    setToken(m ? m[1] : null);
    setHighlight(0);
  };

  const choose = (mention: CommentMention) => {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(/@[\p{L}\p{N} ._-]{0,24}$/u, '');
    const next = `${before}@${mention.name} ${text.slice(caret)}`;
    setText(next);
    setTagged(prev => prev.some(p => p.id === mention.id) ? prev : [...prev, mention]);
    setToken(null);
    requestAnimationFrame(() => {
      el.focus();
      const pos = before.length + mention.name.length + 2;
      el.setSelectionRange(pos, pos);
    });
  };

  const send = () => {
    const body = text.trim();
    if (!body) return;
    // Only keep mentions still present in the text.
    onSubmit(body, tagged.filter(m => body.includes(`@${m.name}`)));
    setText('');
    setTagged([]);
    setToken(null);
  };

  return (
    <div className="comment-composer">
      {/* The popup is anchored to this wrapper, not the whole composer, so it
          opens directly under the textarea whatever height it's resized to. */}
      <div className="comment-composer-field">
      <textarea
        ref={ref}
        value={text}
        autoFocus={autoFocus}
        onChange={e => { setText(e.target.value); readToken(e.target); }}
        onClick={e => readToken(e.currentTarget)}
        onBlur={() => setTimeout(() => setToken(null), 120)}
        onKeyDown={e => {
          if (suggestions.length > 0) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => (h + 1) % suggestions.length); return; }
            if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlight(h => (h - 1 + suggestions.length) % suggestions.length); return; }
            if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); choose(suggestions[highlight]); return; }
            if (e.key === 'Escape')    { e.preventDefault(); setToken(null); return; }
          }
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
          if (e.key === 'Escape' && onCancel) onCancel();
        }}
        placeholder={placeholder}
        disabled={busy}
      />

      {suggestions.length > 0 && (
        <ul className="mention-pop">
          {suggestions.map((m, i) => (
            <li key={m.id}>
              <button
                type="button"
                className={i === highlight ? 'active' : ''}
                onMouseDown={e => { e.preventDefault(); choose(m); }}
                onMouseEnter={() => setHighlight(i)}
              >
                <span className="mention-pop-avatar">{avatarInitials(m.name)}</span>
                {m.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      </div>

      <div className="comment-composer-foot">
        <span className="comment-hint">
          Enter to send · Shift+Enter for a new line{mentionable.length > 0 ? ' · @ to tag someone' : ''}
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          {onCancel && (
            <button type="button" className="btn btn-outline btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
          )}
          <button type="button" className="btn btn-primary btn-sm" onClick={send} disabled={busy || !text.trim()}>
            <Send size={14} /> {busy ? 'Posting…' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CommentSection({
  itemId, initialComments, isLoggedIn, currentUserId, type = 'item',
  threadsEnabled = false, mentionable = [],
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Everyone in the thread can be tagged, not just those the server knew about
  // when the page rendered. Without migration 0007 the mentions column doesn't
  // exist, so tagging would silently post plain text and notify nobody — don't
  // offer it at all in that case.
  const taggable = useMemo(() => {
    if (!threadsEnabled) return [];
    const byId = new Map(mentionable.map(m => [m.id, m]));
    for (const c of comments) {
      if (c.user_id && c.user?.name && !byId.has(c.user_id)) {
        byId.set(c.user_id, {
          id: c.user_id,
          name: c.user.name,
          slug: c.user.is_public === false ? null : c.user.profile_slug ?? null,
        });
      }
    }
    byId.delete(currentUserId ?? '');
    return [...byId.values()];
  }, [threadsEnabled, mentionable, comments, currentUserId]);

  const roots = comments.filter(c => !c.parent_id);
  const repliesOf = (id: number) =>
    comments.filter(c => c.parent_id === id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const doSubmit = async (text: string, mentions: CommentMention[], parentId: number | null) => {
    if (!text || !isLoggedIn) return;
    setIsSubmitting(true);

    const optimistic: Comment = {
      comment_id: Date.now(),
      user_id: currentUserId || '',
      content: text,
      upvotes: 0,
      downvotes: 0,
      created_at: new Date().toISOString(),
      parent_id: parentId,
      mentions,
      user: { name: 'You' },
      user_vote: null,
    };
    setComments(prev => [...prev, optimistic]);
    setReplyTo(null);

    const res = await addComment(itemId, text, type, { parentId, mentions });
    if (res.error) {
      toast.error(res.error);
      setComments(prev => prev.filter(c => c.comment_id !== optimistic.comment_id));
    } else if (res.comment) {
      setComments(prev => prev.map(c =>
        c.comment_id === optimistic.comment_id ? { ...res.comment as Comment, user_vote: null } : c
      ));
    }
    setIsSubmitting(false);
  };

  const handleVote = async (commentId: number, voteType: 1 | -1) => {
    if (!isLoggedIn) { toast.error('You must be logged in to vote.'); return; }

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
    } else if (typeof res.upvotes === 'number') {
      // Server recount wins — the optimistic guess can't see other people's votes.
      setComments(prev => prev.map(c =>
        c.comment_id === commentId ? { ...c, upvotes: res.upvotes!, downvotes: res.downvotes! } : c
      ));
    }
  };

  const handleDelete = async (commentId: number) => {
    // parent_id cascades in the database, so the replies go with it — say so.
    const replies = repliesOf(commentId).length;
    const warning = replies > 0
      ? `Delete this comment and its ${replies} repl${replies === 1 ? 'y' : 'ies'}? This cannot be undone.`
      : 'Delete this comment? This cannot be undone.';
    if (!window.confirm(warning)) return;

    const snapshot = comments;
    setDeletingId(commentId);
    setComments(prev => prev.filter(c => c.comment_id !== commentId && c.parent_id !== commentId));

    const res = await deleteComment(commentId, itemId, type);
    if (res.error) {
      toast.error(res.error);
      setComments(snapshot); // put it back
    } else {
      toast.success('Comment deleted.');
    }
    setDeletingId(null);
  };

  const renderComment = (comment: Comment, isReply: boolean) => {
    const slug = comment.user?.profile_slug;
    const linkable = !!slug && comment.user?.is_public !== false;
    const avatar = (
      <div className={`comment-avatar${isReply ? ' comment-avatar-sm' : ''}`}>
        {comment.user?.profile_pic
          ? <img src={comment.user.profile_pic} alt="" />
          : avatarInitials(comment.user?.name || 'U')}
      </div>
    );
    const replyingToSomeoneElse = isReply && !!comment.user?.name && comment.user_id !== currentUserId;

    return (
      <div className="comment-row" key={comment.comment_id}>
        {linkable ? <Link href={`/profiles/${slug}`} style={{ flexShrink: 0 }}>{avatar}</Link> : avatar}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="comment-head">
            {linkable ? (
              <Link href={`/profiles/${slug}`} className="comment-author">{comment.user?.name}</Link>
            ) : (
              <span className="comment-author">{comment.user?.name || 'Anonymous'}</span>
            )}
            <span className="comment-date">{fmtDate(comment.created_at)}</span>
          </div>

          <p className="comment-body">{renderBody(comment.content, comment.mentions)}</p>

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

            {threadsEnabled && isLoggedIn && (
              <button
                type="button"
                className="vote-btn"
                onClick={() => setReplyTo(replyTo === comment.comment_id ? null : comment.comment_id)}
              >
                <CornerDownRight size={14} />
                <span className="vote-count">Reply</span>
              </button>
            )}

            {currentUserId && comment.user_id === currentUserId && (
              <button
                type="button"
                className="vote-btn vote-btn-danger"
                onClick={() => handleDelete(comment.comment_id)}
                disabled={deletingId === comment.comment_id}
                title="Delete comment"
              >
                <Trash2 size={14} />
                <span className="vote-count">Delete</span>
              </button>
            )}
          </div>

          {replyTo === comment.comment_id && (
            <div className="comment-reply-box">
              <Composer
                placeholder={`Reply to ${comment.user?.name || 'this comment'}…`}
                submitLabel="Reply"
                busy={isSubmitting}
                autoFocus
                // A reply to a reply keeps the same root, so name who it answers.
                initialText={replyingToSomeoneElse ? `@${comment.user!.name} ` : ''}
                initialMentions={
                  replyingToSomeoneElse
                    ? [{
                        id: comment.user_id,
                        name: comment.user!.name,
                        slug: comment.user!.is_public === false ? null : comment.user!.profile_slug ?? null,
                      }]
                    : []
                }
                mentionable={taggable}
                onSubmit={(text, mentions) => doSubmit(text, mentions, comment.comment_id)}
                onCancel={() => setReplyTo(null)}
              />
            </div>
          )}

          {!isReply && repliesOf(comment.comment_id).length > 0 && (
            <div className="comment-replies">
              {repliesOf(comment.comment_id).map(reply => renderComment(reply, true))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="card" style={{ padding: '32px', marginBottom: '24px' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0, marginBottom: '24px' }}>
        <MessageSquare size={20} /> Comments ({comments.length})
      </h3>

      {isLoggedIn ? (
        <div style={{ marginBottom: '28px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <div className="comment-avatar comment-avatar-you">You</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Composer
              placeholder="Ask a question or leave a comment…"
              submitLabel="Post"
              busy={isSubmitting}
              mentionable={taggable}
              onSubmit={(text, mentions) => doSubmit(text, mentions, null)}
            />
          </div>
        </div>
      ) : (
        <div style={{ padding: '14px', backgroundColor: 'var(--surface-1)', borderRadius: '8px', textAlign: 'center', marginBottom: '28px', fontSize: '14px' }}>
          <Link href="/login" style={{ color: 'var(--primary)', fontWeight: 500 }}>Log in to leave a comment</Link>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {roots.length === 0 ? (
          <p style={{ color: 'var(--ink-muted)', textAlign: 'center', padding: '16px 0' }}>No comments yet. Be the first!</p>
        ) : (
          roots.map(c => renderComment(c, false))
        )}
      </div>
    </div>
  );
}
