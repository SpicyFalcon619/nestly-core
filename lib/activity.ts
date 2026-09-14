import type { SupabaseClient } from '@supabase/supabase-js';

export type ActivityKind = 'comment' | 'vote' | 'offer' | 'rating' | 'review' | 'application' | 'watchlist';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  at: string;
  /** What the user did, e.g. "Commented on" */
  action: string;
  /** What they did it to — the item/listing title */
  subject: string;
  /** Optional body: the comment text, offer price, rating value */
  detail?: string;
  href?: string;
}

/** Resolves ids -> titles in one query per table, for labelling activity rows. */
async function titleMap(
  supabase: SupabaseClient,
  table: 'items' | 'listings',
  idCol: 'item_id' | 'listing_id',
  ids: number[],
) {
  if (ids.length === 0) return new Map<number, string>();
  const { data } = await supabase.from(table).select(`${idCol}, title`).in(idCol, ids);
  return new Map<number, string>((data || []).map((r: any) => [r[idCol], r.title]));
}

/**
 * Builds a single reverse-chronological feed of everything a user has done.
 * Each source is fetched independently — a failure in one (or a table that
 * doesn't exist yet) leaves the rest of the feed intact.
 */
export async function fetchUserActivity(supabase: SupabaseClient, userId: string): Promise<ActivityItem[]> {
  const [itemComments, listingComments, itemVotes, offers, ratings, reviews] = await Promise.all([
    supabase.from('item_comments').select('comment_id, item_id, content, created_at').eq('user_id', userId),
    supabase.from('listing_comments').select('comment_id, listing_id, content, created_at').eq('user_id', userId),
    supabase.from('item_comment_votes').select('comment_id, vote_type, created_at').eq('user_id', userId),
    supabase.from('offers').select('offer_id, item_id, offer_price, status, created_at').eq('buyer_id', userId),
    supabase.from('user_ratings').select('rating_id, target_user_id, rating, review, created_at').eq('rater_id', userId),
    supabase.from('reviews').select('review_id, listing_id, composite_score, comment, created_at').eq('reviewer_id', userId),
  ]);

  const itemIds = [
    ...(itemComments.data || []).map(c => c.item_id),
    ...(offers.data || []).map(o => o.item_id),
  ].filter(Boolean);
  const listingIds = [
    ...(listingComments.data || []).map(c => c.listing_id),
    ...(reviews.data || []).map(r => r.listing_id),
  ].filter(Boolean);

  const [items, listings] = await Promise.all([
    titleMap(supabase, 'items', 'item_id', [...new Set(itemIds)]),
    titleMap(supabase, 'listings', 'listing_id', [...new Set(listingIds)]),
  ]);

  // Votes only store a comment_id, so resolve those to the item they belong to.
  const votedCommentIds = [...new Set((itemVotes.data || []).map(v => v.comment_id))];
  const voteTargets = new Map<number, number>();
  if (votedCommentIds.length > 0) {
    const { data } = await supabase.from('item_comments').select('comment_id, item_id').in('comment_id', votedCommentIds);
    (data || []).forEach((c: any) => voteTargets.set(c.comment_id, c.item_id));
    const extraIds = [...new Set((data || []).map((c: any) => c.item_id))].filter(id => !items.has(id));
    if (extraIds.length > 0) {
      const more = await titleMap(supabase, 'items', 'item_id', extraIds as number[]);
      more.forEach((v, k) => items.set(k, v));
    }
  }

  const feed: ActivityItem[] = [];

  (itemComments.data || []).forEach(c => feed.push({
    id: `ic-${c.comment_id}`, kind: 'comment', at: c.created_at,
    action: 'Commented on', subject: items.get(c.item_id) || 'a marketplace item',
    detail: c.content, href: `/exchange/${c.item_id}`,
  }));

  (listingComments.data || []).forEach(c => feed.push({
    id: `lc-${c.comment_id}`, kind: 'comment', at: c.created_at,
    action: 'Commented on', subject: listings.get(c.listing_id) || 'a listing',
    detail: c.content, href: `/listings/${c.listing_id}`,
  }));

  (itemVotes.data || []).forEach(v => {
    const itemId = voteTargets.get(v.comment_id);
    feed.push({
      id: `iv-${v.comment_id}`, kind: 'vote', at: v.created_at,
      action: v.vote_type === 1 ? 'Liked a comment on' : 'Disliked a comment on',
      subject: itemId ? (items.get(itemId) || 'a marketplace item') : 'a marketplace item',
      href: itemId ? `/exchange/${itemId}` : undefined,
    });
  });

  (offers.data || []).forEach(o => feed.push({
    id: `of-${o.offer_id}`, kind: 'offer', at: o.created_at,
    action: 'Made an offer on', subject: items.get(o.item_id) || 'a marketplace item',
    detail: `৳${Number(o.offer_price).toLocaleString('en-BD')} — ${o.status}`,
    href: `/exchange/${o.item_id}`,
  }));

  (ratings.data || []).forEach(r => feed.push({
    id: `ur-${r.rating_id}`, kind: 'rating', at: r.created_at,
    action: 'Rated a user', subject: `${r.rating} out of 5`, detail: r.review || undefined,
  }));

  (reviews.data || []).forEach(r => feed.push({
    id: `rv-${r.review_id}`, kind: 'review', at: r.created_at,
    action: 'Reviewed', subject: listings.get(r.listing_id) || 'a listing',
    detail: r.comment || undefined, href: `/listings/${r.listing_id}`,
  }));

  return feed.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
