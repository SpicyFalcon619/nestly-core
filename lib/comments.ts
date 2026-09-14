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
