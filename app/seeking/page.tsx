import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import SeekingContent from './SeekingContent';
import type { Zone, SeekingPost } from '@/types';

export const metadata = {
  title: 'Seeking Flatmates - Nestly',
  description: 'Find students seeking roommates or flats near your campus in Dhaka.',
};

export default async function SeekingPage() {
  const supabase = await createClient();

  // Check auth
  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;
  let isAdmin = false;
  if (isLoggedIn) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
    if (profile?.role === 'admin') isAdmin = true;
  }

  // Fetch zones for filter
  const { data: zones } = await supabase.from('zones').select('*').order('zone_name');

  // Fetch seeking posts
  const { data: posts } = await supabase
    .from('seeking_posts')
    .select(`
      *,
      user:profiles!seeking_posts_user_id_fkey(name, gender),
      zone:zones(zone_name)
    `)
    .order('created_at', { ascending: false });

  // Map joined fields
  const formattedPosts: SeekingPost[] = (posts || []).map((p: any) => ({
    ...p,
    user_name: p.user?.name,
    user_gender: p.user?.gender,
    zone: p.zone?.zone_name
  }));

  return (
    <Suspense fallback={<div className="container" style={{ padding: '40px 0', textAlign: 'center' }}>Loading...</div>}>
      <SeekingContent
        posts={formattedPosts}
        zones={(zones as Zone[]) || []}
        isLoggedIn={isLoggedIn}
        isAdmin={isAdmin}
      />
    </Suspense>
  );
}
