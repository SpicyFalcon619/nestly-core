import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ProfileContent from './ProfileContent';

export const metadata = {
  title: 'My Profile - Nestly',
  description: 'Manage your profile and roommate preferences.',
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  // Fetch preferences
  let preferences = null;
  if (profile.role === 'student') {
    const { data: prefsData } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();
    preferences = prefsData;
  }

  // Fetch verifications
  let verifStatus = 'none';
  const { data: verifData } = await supabase
    .from('verifications')
    .select('status')
    .eq('user_id', user.id)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .single();
    
  if (verifData) {
    verifStatus = verifData.status;
  }

  return (
    <div className="container" style={{ padding: '40px 5%' }}>
      <h1 className="page-title">My Profile</h1>
      <ProfileContent 
        initialProfile={profile} 
        initialPreferences={preferences} 
        initialVerifStatus={verifStatus}
      />
    </div>
  );
}
