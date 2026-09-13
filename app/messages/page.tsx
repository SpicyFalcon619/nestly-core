import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import MessagesClient from './MessagesClient';

export const metadata = { title: 'Messages - Nestly' };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ convo?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { convo: urlConvoId } = await searchParams;

  // Fetch conversations where user is participant_a or participant_b
  const { data: convosA } = await supabase
    .from('conversations')
    .select('id, created_at, listing_id, item_id, participant_b')
    .eq('participant_a', user.id)
    .order('created_at', { ascending: false });

  const { data: convosB } = await supabase
    .from('conversations')
    .select('id, created_at, listing_id, item_id, participant_a')
    .eq('participant_b', user.id)
    .order('created_at', { ascending: false });

  // Collect other-user IDs
  const otherIds = new Set<string>();
  (convosA || []).forEach((c: any) => otherIds.add(c.participant_b));
  (convosB || []).forEach((c: any) => otherIds.add(c.participant_a));

  // Batch-fetch profiles for other users
  let profilesMap: Record<string, any> = {};
  if (otherIds.size > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, profile_pic, profile_slug')
      .in('id', [...otherIds]);
    (profiles || []).forEach((p: any) => { profilesMap[p.id] = p; });
  }

  // Collect listing / item IDs
  const listingIds = new Set<number>();
  const itemIds    = new Set<number>();
  const allRaw = [...(convosA || []), ...(convosB || [])];
  allRaw.forEach((c: any) => {
    if (c.listing_id) listingIds.add(c.listing_id);
    if (c.item_id)    itemIds.add(c.item_id);
  });

  let listingsMap: Record<number, string> = {};
  let itemsMap:    Record<number, string> = {};
  if (listingIds.size > 0) {
    const { data: ls } = await supabase.from('listings').select('listing_id, title').in('listing_id', [...listingIds]);
    (ls || []).forEach((l: any) => { listingsMap[l.listing_id] = l.title; });
  }
  if (itemIds.size > 0) {
    const { data: its } = await supabase.from('items').select('item_id, title').in('item_id', [...itemIds]);
    (its || []).forEach((i: any) => { itemsMap[i.item_id] = i.title; });
  }

  // Merge into unified conversation list
  const allConvos = allRaw
    .map((c: any) => {
      const otherId = c.participant_b || c.participant_a;
      return {
        id: c.id,
        created_at: c.created_at,
        listing_id: c.listing_id ?? null,
        item_id: c.item_id ?? null,
        other_user: profilesMap[otherId] || { id: otherId, name: 'Unknown User' },
        listing_title: c.listing_id ? (listingsMap[c.listing_id] || null) : null,
        item_title:    c.item_id    ? (itemsMap[c.item_id]       || null) : null,
      };
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Fetch last message + unread count per conversation
  const convosWithMeta = await Promise.all(
    allConvos.map(async (c) => {
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('body, created_at, sender_id')
        .eq('conversation_id', c.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { count: unread } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', c.id)
        .eq('is_read', false)
        .neq('sender_id', user.id);

      return { ...c, last_message: lastMsg || null, unread_count: unread || 0 };
    })
  );

  // If URL has a ?convo= that's not in the list, fetch it directly so the chat opens
  let initialConvoId = urlConvoId
    ? (convosWithMeta.some(c => c.id === urlConvoId) ? urlConvoId : urlConvoId)
    : (convosWithMeta[0]?.id || null);

  return (
    <MessagesClient
      conversations={convosWithMeta}
      currentUserId={user.id}
      initialConvoId={initialConvoId}
    />
  );
}
