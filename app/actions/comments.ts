'use server';

import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createUserNotification } from './notifications';
import { revalidatePath } from 'next/cache';

export async function addComment(itemId: number, content: string, type: 'item' | 'listing' = 'item') {
  if (!content.trim()) return { error: 'Comment cannot be empty.' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be logged in to comment.' };

  const table = type === 'item' ? 'item_comments' : 'listing_comments';
  const idCol  = type === 'item' ? 'item_id'     : 'listing_id';

  const { data: inserted, error } = await supabase
    .from(table)
    .insert({ [idCol]: itemId, user_id: user.id, content: content.trim() })
    .select('*')
    .single();

  if (error) return { error: error.message };

  // Attach profile separately (avoids FK name guessing across different comment tables)
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, profile_pic')
    .eq('id', user.id)
    .single();

  // Notify the owner/seller
  const { data: commenter } = await supabase.from('profiles').select('name').eq('id', user.id).single();
  const commenterName = commenter?.name || 'Someone';

  if (type === 'listing') {
    const { data: listing } = await supabase.from('listings').select('user_id, title').eq('listing_id', itemId).single();
    if (listing && listing.user_id !== user.id) {
      await createUserNotification(
        listing.user_id,
        'new_comment',
        `${commenterName} commented on your listing "${listing.title}"`,
        `/listings/${itemId}`
      );
    }
  } else {
    const { data: item } = await supabase.from('items').select('seller_id, title').eq('item_id', itemId).single();
    if (item && item.seller_id !== user.id) {
      await createUserNotification(
        item.seller_id,
        'new_comment',
        `${commenterName} commented on your item "${item.title}"`,
        `/exchange/${itemId}`
      );
    }
  }

  revalidatePath(type === 'item' ? `/exchange/${itemId}` : `/listings/${itemId}`);
  return { success: true, comment: { ...inserted, user: profile || { name: 'You', profile_pic: null } } };
}

export async function voteComment(commentId: number, voteType: 1 | -1, itemId: number, type: 'item' | 'listing' = 'item') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be logged in to vote.' };

  const tableVotes    = type === 'item' ? 'item_comment_votes'    : 'listing_comment_votes';
  const tableComments = type === 'item' ? 'item_comments'         : 'listing_comments';

  const { data: existingVote } = await supabase
    .from(tableVotes)
    .select('vote_type')
    .eq('comment_id', commentId)
    .eq('user_id', user.id)
    .maybeSingle();

  const { data: current } = await supabase.from(tableComments).select('upvotes, downvotes').eq('comment_id', commentId).single();
  let up = current?.upvotes || 0;
  let dn = current?.downvotes || 0;

  if (existingVote) {
    if (existingVote.vote_type === voteType) {
      await supabase.from(tableVotes).delete().eq('comment_id', commentId).eq('user_id', user.id);
      if (voteType === 1) up--; else dn--;
    } else {
      await supabase.from(tableVotes).update({ vote_type: voteType }).eq('comment_id', commentId).eq('user_id', user.id);
      if (voteType === 1) { up++; dn--; } else { dn++; up--; }
    }
  } else {
    const { error } = await supabase.from(tableVotes).insert({ comment_id: commentId, user_id: user.id, vote_type: voteType });
    if (error) return { error: error.message };
    if (voteType === 1) up++; else dn++;
  }

  await supabase.from(tableComments).update({ upvotes: Math.max(0, up), downvotes: Math.max(0, dn) }).eq('comment_id', commentId);

  revalidatePath(type === 'item' ? `/exchange/${itemId}` : `/listings/${itemId}`);
  return { success: true, upvotes: Math.max(0, up), downvotes: Math.max(0, dn) };
}

/**
 * Deletes one of your own comments.
 *
 * The comment tables were created by hand (see lib/comments.ts) so their RLS
 * policies can't be assumed: a DELETE the policy doesn't allow succeeds with
 * zero rows affected rather than erroring. Ownership is therefore verified
 * first, the row count is checked, and only then does it fall back to the
 * service role — which re-asserts the same author check in its own filter.
 */
export async function deleteComment(commentId: number, itemId: number, type: 'item' | 'listing' = 'item') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be logged in.' };

  const table      = type === 'item' ? 'item_comments'      : 'listing_comments';
  const votesTable = type === 'item' ? 'item_comment_votes' : 'listing_comment_votes';
  const idCol      = type === 'item' ? 'item_id'            : 'listing_id';
  const link       = type === 'item' ? `/exchange/${itemId}` : `/listings/${itemId}`;

  const { data: comment } = await supabase
    .from(table)
    .select('comment_id, user_id')
    .eq('comment_id', commentId)
    .maybeSingle();

  if (!comment) return { error: 'Comment not found.' };
  if (comment.user_id !== user.id) return { error: 'You can only delete your own comments.' };

  const { data: deleted, error } = await supabase
    .from(table)
    .delete()
    .eq('comment_id', commentId)
    .eq('user_id', user.id)
    .select('comment_id');

  if (error) return { error: error.message };

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  if (!deleted || deleted.length === 0) {
    // No DELETE policy for the author — do it with the service role instead,
    // still scoped to this comment and this author.
    // Votes first: the hand-made tables have no guaranteed ON DELETE CASCADE.
    await admin.from(votesTable).delete().eq('comment_id', commentId);
    const { error: adminError } = await admin
      .from(table)
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', user.id);
    if (adminError) return { error: adminError.message };
  }

  // "X commented on your listing" would otherwise survive the comment and send
  // the owner to a page with nothing on it. Only cleared when this was the
  // author's last comment there, so their other comments keep their notice.
  const { data: remaining } = await supabase
    .from(table)
    .select('comment_id')
    .eq(idCol, itemId)
    .eq('user_id', user.id)
    .limit(1);

  if (!remaining || remaining.length === 0) {
    const { data: me } = await supabase.from('profiles').select('name').eq('id', user.id).maybeSingle();
    const ownerId = type === 'listing'
      ? (await supabase.from('listings').select('user_id').eq('listing_id', itemId).maybeSingle()).data?.user_id
      : (await supabase.from('items').select('seller_id').eq('item_id', itemId).maybeSingle()).data?.seller_id;

    if (ownerId && me?.name) {
      // % and _ are wildcards in ilike — a name containing one must not widen
      // the match beyond this author.
      const prefix = me.name.replace(/[%_\\]/g, (m: string) => '\\' + m);
      await admin
        .from('notifications')
        .delete()
        .eq('user_id', ownerId)
        .eq('type', 'new_comment')
        .eq('link', link)
        .ilike('message', `${prefix} commented%`);
    }
  }

  revalidatePath(link);
  return { success: true };
}
