import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Loads comments with their author profile attached.
 *
 * Deliberately does NOT use a PostgREST embed (`user:profiles!fk(...)`): the
 * comment tables were created outside of migrations and have no foreign key to
 * `profiles`, so the embed fails the whole query and every comment silently
 * disappears. Authors are fetched in a second query and merged here instead.
 */
export async function fetchCommentsWithAuthors(
  supabase: SupabaseClient,
  table: 'item_comments' | 'listing_comments',
  idColumn: 'item_id' | 'listing_id',
  id: number,
) {
  const { data: comments } = await supabase
    .from(table)
    .select('*')
    .eq(idColumn, id)
    .order('created_at', { ascending: true });

  if (!comments || comments.length === 0) return [];

  const authorIds = [...new Set(comments.map(c => c.user_id).filter(Boolean))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, profile_pic, profile_slug, is_public')
    .in('id', authorIds);

  const byId = new Map((profiles || []).map(p => [p.id, p]));
  return comments.map(c => ({
    ...c,
    user: byId.get(c.user_id) ?? null,
  }));
}

export interface CommentMention {
  id: string;
  name: string;
  /** Public profile slug, or null when the profile isn't public. */
  slug?: string | null;
}

/**
 * True once migration 0007 has been applied. Replies and mentions live in
 * columns that don't exist before it, so the UI has to be able to fall back to
 * a flat comment list.
 *
 * Must be a real GET — a `head: true` request returns `error: null` even for a
 * table or column that doesn't exist (see savedSearchesAvailable).
 */
export async function commentThreadsAvailable(
  supabase: SupabaseClient,
  table: 'item_comments' | 'listing_comments',
): Promise<boolean> {
  const { error } = await supabase.from(table).select('parent_id, mentions').limit(1);
  return !error;
}

/**
 * Who can be @mentioned on this page: everyone already in the thread plus the
 * owner. Deliberately not a search over all profiles — that would turn the
 * comment box into a user directory.
 */
export function mentionablesFrom(
  comments: { user_id: string; user?: { name?: string; profile_slug?: string; is_public?: boolean } | null }[],
  owner?: { id?: string; name?: string; profile_slug?: string | null; is_public?: boolean } | null,
): CommentMention[] {
  const byId = new Map<string, CommentMention>();

  if (owner?.id && owner.name) {
    byId.set(owner.id, {
      id: owner.id,
      name: owner.name,
      slug: owner.is_public === false ? null : owner.profile_slug ?? null,
    });
  }
  for (const c of comments) {
    if (!c.user_id || !c.user?.name || byId.has(c.user_id)) continue;
    byId.set(c.user_id, {
      id: c.user_id,
      name: c.user.name,
      slug: c.user.is_public === false ? null : c.user.profile_slug ?? null,
    });
  }
  return [...byId.values()];
}
