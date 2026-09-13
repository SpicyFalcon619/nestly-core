'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { Profile, UserPreferences } from '@/types';
import { updateProfileSchema, updatePreferencesSchema } from '@/lib/schemas';
import { User, Settings, ShieldCheck, Globe, Lock, ExternalLink, Copy } from 'lucide-react';
import Link from 'next/link';
import CustomSelect from '@/components/CustomSelect';
import VerificationModal from '@/components/modals/VerificationModal';
import AvatarUpload from '@/components/AvatarUpload';
import { useRouter } from 'next/navigation';

export default function ProfileContent({
  initialProfile,
  initialPreferences,
  initialVerifStatus
}: {
  initialProfile: Profile;
  initialPreferences: UserPreferences | null;
  initialVerifStatus: string;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [prefs, setPrefs] = useState<UserPreferences | null>(initialPreferences);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPrefs, setLoadingPrefs] = useState(false);
  const [isVerifModalOpen, setIsVerifModalOpen] = useState(false);

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    name: initialProfile.name,
    phone: initialProfile.phone || '',
    university_id: initialProfile.university_id || '',
    bio: initialProfile.bio || '',
    is_public: initialProfile.is_public !== false, // default true
  });

  // Prefs Form State
  const [prefsForm, setPrefsForm] = useState({
    sleep_schedule: initialPreferences?.sleep_schedule || '',
    study_hours: initialPreferences?.study_hours || 2,
    diet: initialPreferences?.diet || '',
    guest_policy: initialPreferences?.guest_policy || '',
    smoking_tolerance: initialPreferences ? initialPreferences.smoking_tolerance : true,
    preferred_gender: initialPreferences?.preferred_gender || '',
    cleanliness_score: initialPreferences?.cleanliness_score || 3,
    noise_tolerance: initialPreferences?.noise_tolerance || ''
  });

  const profileUrl = profile.profile_slug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/profiles/${profile.profile_slug}`
    : null;

  const copyProfileLink = () => {
    if (!profileUrl) return;
    navigator.clipboard.writeText(profileUrl);
    toast.success('Profile link copied!');
  };

  const handleProfileSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoadingProfile(true);

    const validation = updateProfileSchema.safeParse(profileForm);
    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      setLoadingProfile(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update({
        name: validation.data.name,
        phone: validation.data.phone || null,
        university_id: validation.data.university_id || null,
        bio: profileForm.bio || null,
        is_public: profileForm.is_public,
      })
      .eq('id', profile.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Profile updated successfully!');
      setProfile({ ...profile, ...validation.data, bio: profileForm.bio, is_public: profileForm.is_public });
    }
    setLoadingProfile(false);
  };

  const handlePrefsSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoadingPrefs(true);

    const validation = updatePreferencesSchema.safeParse({
      ...prefsForm,
      study_hours: Number(prefsForm.study_hours),
      cleanliness_score: Number(prefsForm.cleanliness_score)
    });

    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      setLoadingPrefs(false);
      return;
    }

    const supabase = createClient();

    if (prefs?.pref_id) {
      const { error } = await supabase
        .from('user_preferences')
        .update(validation.data)
        .eq('pref_id', prefs.pref_id);

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Preferences updated!');
        setPrefs({ ...prefs, ...validation.data });
      }
    } else {
      const { data: newPrefs, error } = await supabase
        .from('user_preferences')
        .insert({ user_id: profile.id, ...validation.data })
        .select()
        .single();

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Preferences created!');
        setPrefs(newPrefs);
      }
    }
    setLoadingPrefs(false);
  };

  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      {/* Left Column: Basic Profile */}
      <div>
        {/* ── Profile Picture & Public Link ── */}
        <div className="card" style={{ padding: '32px', marginBottom: '24px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0, color: 'var(--navy)' }}>
            <User size={24} /> Profile Picture
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            <AvatarUpload
              userId={profile.id}
              name={profile.name}
              currentUrl={profile.profile_pic}
              onUpload={(url) => setProfile({ ...profile, profile_pic: url })}
              size={96}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>{profile.name}</div>
              <div style={{ fontSize: '13px', color: 'var(--ink-muted)', marginBottom: '12px' }}>
                Click the avatar to upload a new photo (max 2 MB).
              </div>
              {profile.profile_slug && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <Link
                    href={`/profiles/${profile.profile_slug}`}
                    className="btn btn-outline btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <ExternalLink size={13} /> View Public Profile
                  </Link>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={copyProfileLink}
                  >
                    <Copy size={13} /> Copy Link
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Basic Information ── */}
        <div className="card" style={{ padding: '32px', marginBottom: '24px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0, color: 'var(--navy)' }}>
            <User size={24} /> Basic Information
          </h2>

          <form onSubmit={handleProfileSubmit}>
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                value={profileForm.name}
                onChange={e => setProfileForm({...profileForm, name: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label>Email Address</label>
              <input type="email" value={profile.email} disabled style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }} />
              <div style={{ fontSize: '12px', color: 'var(--gray)', marginTop: '4px' }}>Email cannot be changed.</div>
            </div>

            <div className="form-group">
              <label>Bio <span style={{ fontWeight: 400, color: 'var(--ink-muted)' }}>(optional)</span></label>
              <textarea
                rows={3}
                value={profileForm.bio}
                onChange={e => setProfileForm({...profileForm, bio: e.target.value})}
                placeholder="Tell others a little about yourself..."
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label>Phone Number (Optional)</label>
                <input
                  type="text"
                  value={profileForm.phone}
                  onChange={e => setProfileForm({...profileForm, phone: e.target.value})}
                  placeholder="01XXXXXXXXX"
                />
              </div>

              <div className="form-group">
                <label>University ID (Optional)</label>
                <input
                  type="text"
                  value={profileForm.university_id}
                  onChange={e => setProfileForm({...profileForm, university_id: e.target.value})}
                  placeholder="01123XXXX"
                />
              </div>
            </div>

            {/* Privacy Toggle */}
            <div className="form-group">
              <label>Profile Visibility</label>
              <div style={{
                display: 'flex',
                gap: '12px',
                marginTop: '8px',
                padding: '16px',
                background: 'var(--surface-1)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
              }}>
                <button
                  type="button"
                  onClick={() => setProfileForm({...profileForm, is_public: true})}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: 'var(--radius)',
                    border: profileForm.is_public ? '2px solid var(--primary)' : '2px solid transparent',
                    background: profileForm.is_public ? 'var(--primary-light, #EEF7F2)' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    color: profileForm.is_public ? 'var(--primary)' : 'var(--ink-muted)',
                    fontWeight: profileForm.is_public ? 600 : 400,
                  }}
                >
                  <Globe size={20} />
                  <span style={{ fontSize: '13px' }}>Public</span>
                  <span style={{ fontSize: '11px', fontWeight: 400, opacity: 0.8 }}>Anyone can view</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProfileForm({...profileForm, is_public: false})}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: 'var(--radius)',
                    border: !profileForm.is_public ? '2px solid var(--ink-mid)' : '2px solid transparent',
                    background: !profileForm.is_public ? 'var(--surface-2, #f1f5f9)' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    color: !profileForm.is_public ? 'var(--ink-mid)' : 'var(--ink-muted)',
                    fontWeight: !profileForm.is_public ? 600 : 400,
                  }}
                >
                  <Lock size={20} />
                  <span style={{ fontSize: '13px' }}>Private</span>
                  <span style={{ fontSize: '11px', fontWeight: 400, opacity: 0.8 }}>Only you can see</span>
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loadingProfile}>
              {loadingProfile ? 'Saving...' : 'Save Profile Details'}
            </button>
          </form>

          {profile.role === 'admin' ? (
            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0, color: 'var(--navy)' }}>
                <ShieldCheck size={20} color="var(--navy)" /> System Administrator
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--gray)' }}>
                Your account has full administrative privileges. You have access to the Admin Panel to manage users, listings, and system settings.
              </p>
              <Link href="/admin" className="btn btn-primary btn-block" style={{ textAlign: 'center', display: 'block', marginTop: '16px' }}>
                Go to Admin Panel
              </Link>
            </div>
          ) : (
            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0 }}>
                <ShieldCheck size={20} color={
                  initialVerifStatus === 'approved' ? "var(--success)" :
                  initialVerifStatus === 'pending' ? "var(--warning)" :
                  initialVerifStatus === 'rejected' ? "var(--danger)" : "var(--gray)"
                } /> Verification
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--gray)' }}>
                Verifying your identity helps build trust within the Nestly community.
              </p>

              <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontWeight: 'bold' }}>
                  Status: <span style={{
                    color: initialVerifStatus === 'approved' ? 'var(--success)' :
                           initialVerifStatus === 'pending' ? 'var(--warning)' :
                           initialVerifStatus === 'rejected' ? 'var(--danger)' : 'var(--gray)'
                  }}>
                    {initialVerifStatus.charAt(0).toUpperCase() + initialVerifStatus.slice(1)}
                  </span>
                </div>

                {(initialVerifStatus === 'none' || initialVerifStatus === 'rejected') && (
                  <button className="btn btn-outline" style={{ marginLeft: 'auto' }} onClick={() => setIsVerifModalOpen(true)}>
                    Submit ID Document
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Roommate Preferences (Students Only) */}
      {profile.role === 'student' && (
        <div className="card" style={{ padding: '32px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0, color: 'var(--navy)' }}>
            <Settings size={24} /> Roommate Preferences
          </h2>
          <p style={{ color: 'var(--gray)', fontSize: '14px', marginBottom: '24px' }}>
            Fill this out to get a Compatibility Score with other students and listings!
          </p>

          <form onSubmit={handlePrefsSubmit}>
            <div className="grid-2">
              <div className="form-group">
                <label>Sleep Schedule</label>
                <CustomSelect
                  value={prefsForm.sleep_schedule}
                  onChange={(v) => setPrefsForm({...prefsForm, sleep_schedule: v})}
                  options={[
                    { value: '', label: 'Select Schedule...' },
                    { value: 'flexible', label: 'Flexible / Varies' },
                    { value: 'early', label: 'Early Bird (Sleep early, wake early)' },
                    { value: 'late', label: 'Night Owl (Sleep late, wake late)' }
                  ]}
                />
              </div>
              <div className="form-group">
                <label>Dietary Habit</label>
                <CustomSelect
                  value={prefsForm.diet}
                  onChange={(v) => setPrefsForm({...prefsForm, diet: v})}
                  options={[
                    { value: '', label: 'Select Diet...' },
                    { value: 'non_veg', label: 'No specific restrictions / Non-Veg' },
                    { value: 'vegetarian', label: 'Vegetarian' },
                    { value: 'halal_strict', label: 'Strict Halal / Religious restrictions' }
                  ]}
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label>Guest Policy</label>
                <CustomSelect
                  value={prefsForm.guest_policy}
                  onChange={(v) => setPrefsForm({...prefsForm, guest_policy: v})}
                  options={[
                    { value: '', label: 'Select Policy...' },
                    { value: 'allowed', label: 'Flexible (Frequent guests fine)' },
                    { value: 'restricted', label: 'Restricted (Weekends Only)' },
                    { value: 'not_allowed', label: 'Not Allowed' }
                  ]}
                />
              </div>
              <div className="form-group">
                <label>Noise Tolerance</label>
                <CustomSelect
                  value={prefsForm.noise_tolerance}
                  onChange={(v) => setPrefsForm({...prefsForm, noise_tolerance: v})}
                  options={[
                    { value: '', label: 'Select Tolerance...' },
                    { value: 'moderate', label: 'Moderate (Normal activity fine)' },
                    { value: 'quiet', label: 'Quiet (Need pin-drop silence)' },
                    { value: 'noisy', label: 'Lively (Music, chatting is fine)' }
                  ]}
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label>Flatmate Gender Pref.</label>
                <CustomSelect
                  value={prefsForm.preferred_gender}
                  onChange={(v) => setPrefsForm({...prefsForm, preferred_gender: v as any})}
                  options={[
                    { value: '', label: 'Select Gender...' },
                    { value: 'any', label: 'Any Gender' },
                    { value: 'male', label: 'Male Only' },
                    { value: 'female', label: 'Female Only' }
                  ]}
                />
              </div>
              <div className="form-group">
                <label>Daily Study Hours (Avg)</label>
                <input
                  type="number"
                  value={prefsForm.study_hours}
                  onChange={e => setPrefsForm({...prefsForm, study_hours: Number(e.target.value)})}
                  min="0" max="24"
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label>Cleanliness Priority (1-5)</label>
                <input
                  type="range"
                  value={prefsForm.cleanliness_score}
                  onChange={e => setPrefsForm({...prefsForm, cleanliness_score: Number(e.target.value)})}
                  min="1" max="5" step="1"
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--gray)', marginTop: '4px' }}>
                  <span>Not strict</span>
                  <span>{prefsForm.cleanliness_score}/5</span>
                  <span>Very strict</span>
                </div>
              </div>
              <div className="form-group">
                <label>Smoking Tolerance</label>
                <div style={{ marginTop: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'normal' }}>
                    <input
                      type="checkbox"
                      checked={prefsForm.smoking_tolerance}
                      onChange={e => setPrefsForm({...prefsForm, smoking_tolerance: e.target.checked})}
                      style={{ width: '18px', height: '18px' }}
                    />
                    I tolerate smoking in the flat
                  </label>
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-gold btn-block" disabled={loadingPrefs} style={{ marginTop: '16px' }}>
              {loadingPrefs ? 'Saving...' : 'Save Preferences'}
            </button>
          </form>
        </div>
      )}

      <VerificationModal
        isOpen={isVerifModalOpen}
        onClose={() => setIsVerifModalOpen(false)}
        userId={profile.id}
        onSuccess={() => {
          setIsVerifModalOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
