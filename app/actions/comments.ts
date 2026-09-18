'use server';

import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createUserNotification } from './notifications';
import { commentThreadsAvailable, type CommentMention } from '@/lib/comments';
import { revalidatePath } from 'next/cache';

export async function addComment(
  itemId: number,
  content: string,
  type: 'item' | 'listing' = 'item',
  options: { parentId?: number | null; mentions?: CommentMention[] } = {},
) {
  if (!content.trim()) return { error: 'Comment cannot be empty.' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be logged in to comment.' };

  const table = type === 'item' ? 'item_comments' : 'listing_comments';
  const idCol  = type === 'item' ? 'item_id'     : 'listing_id';
  const link   = type === 'item' ? `/exchange/${itemId}` : `/listings/${itemId}`;

  // Replies and mentions need migration 0007; without it the comment is still
  // posted, just flat.
  const threads = await commentThreadsAvailable(supabase, table);

  // Two levels only: replying to a reply attaches to the same root, so threads
  // can't keep indenting. The parent must belong to this listing/item.
  let parentId: number | null = null;
  let parentAuthorId: string | null = null;
  if (threads && options.parentId) {
    const { data: parent } = await supabase
      .from(table)
      .select(`comment_id, user_id, parent_id, ${idCol}`)
      .eq('comment_id', options.parentId)
      .maybeSingle();
    if (parent && Number((parent as Record<string, unknown>)[idCol]) === Number(itemId)) {
      parentId = (parent.parent_id as number | null) ?? (parent.comment_id as number);
      parentAuthorId = parent.user_id as string;
    }
  }

  // Never trust the mention list the client sends: resolve the ids against
  // profiles and rebuild each row from what the database says.
  let mentions: CommentMention[] = [];
  if (threads && options.mentions?.length) {
    const ids = [...new Set(options.mentions.map(m => m.id))].slice(0, 10);
    const { data: people } = await supabase
      .from('profiles')
      .select('id, name, profile_slug, is_public')
      .in('id', ids);
    mentions = (people || []).map(person => ({
      id: person.id,
      name: person.name,
      slug: person.is_public === false ? null : person.profile_slug,
    }));
  }

  const row: Record<string, unknown> = {
    [idCol]: itemId,
    user_id: user.id,
    content: content.trim(),
  };
  if (threads) {
    row.parent_id = parentId;
    row.mentions = mentions.length ? mentions : null;
  }

  const { data: inserted, error } = await supabase
    .from(table)
    .insert(row)
    .select('*')
    .single();

  if (error) return { error: error.message };

  // Attach profile separately (avoids FK name guessing across different comment tables)
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, profile_pic, profile_slug, is_public')
    .eq('id', user.id)
    .single();

  const commenterName = profile?.name || 'Someone';

  // One notification per person, at most: a reply that also mentions the same
  // person, on their own listing, shouldn't arrive three times.
  const notified = new Set<string>([user.id]);
  const notify = async (recipient: string | null | undefined, notifType: string, message: string) => {
    if (!recipient || notified.has(recipient)) return;
    notified.add(recipient);
    await createUserNotification(recipient, notifType, message, link);
  };

  await notify(parentAuthorId, 'comment_reply', `${commenterName} replied to your comment`);
  for (const m of mentions) {
    await notify(m.id, 'comment_mention', `${commenterName} mentioned you in a comment`);
  }

  if (type === 'listing') {
    const { data: listing } = await supabase.from('listings').select('user_id, title').eq('listing_id', itemId).single();
    if (listing) {
      await notify(listing.user_id, 'new_comment', `${commenterName} commented on your listing "${listing.title}"`);
    }
  } else {
    const { data: item } = await supabase.from('items').select('seller_id, title').eq('item_id', itemId).single();
    if (item) {
      await notify(item.seller_id, 'new_comment', `${commenterName} commented on your item "${item.title}"`);
    }
  }

  revalidatePath(link);
  return {
    success: true,
    comment: { ...inserted, user: profile || { name: 'You', profile_pic: null } },
  };
}

/**
 * Casts, switches or removes a vote, then recounts.
 *
 * The comment row's upvotes/downvotes are denormalised, and the RLS policy on
 * the hand-made comment tables only lets the AUTHOR update their row — so a
 * voter's UPDATE used to affect zero rows and return no error, which is why
 * counts reset to 0 on reload while the vote itself stuck. The counts are now
 * recomputed from the votes table (readable by everyone) and written with the
 * service role, and the true totals are returned so the UI can't drift either.
 */
export async function voteComment(commentId: number, voteType: 1 | -1, itemId: number, type: 'item' | 'listing' = 'item') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be logged in to vote.' };

  const tableVotes    = type === 'item' ? 'item_comment_votes' : 'listing_comment_votes';
  const tableComments = type === 'item' ? 'item_comments'      : 'listing_comments';
  const link          = type === 'item' ? `/exchange/${itemId}` : `/listings/${itemId}`;

  const { data: existingVote } = await supabase
    .from(tableVotes)
    .select('vote_type')
    .eq('comment_id', commentId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingVote) {
    // Clicking the same arrow again clears the vote.
    const { error } = existingVote.vote_type === voteType
      ? await supabase.from(tableVotes).delete().eq('comment_id', commentId).eq('user_id', user.id)
      : await supabase.from(tableVotes).update({ vote_type: voteType }).eq('comment_id', commentId).eq('user_id', user.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from(tableVotes).insert({ comment_id: commentId, user_id: user.id, vote_type: voteType });
    if (error) return { error: error.message };
  }

  const { data: votes } = await supabase
    .from(tableVotes)
    .select('vote_type')
    .eq('comment_id', commentId);

  const upvotes   = (votes || []).filter(v => v.vote_type === 1).length;
  const downvotes = (votes || []).filter(v => v.vote_type === -1).length;

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  await admin.from(tableComments).update({ upvotes, downvotes }).eq('comment_id', commentId);

  revalidatePath(link);
  return { success: true, upvotes, downvotes };
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
