import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, Lock, MapPin, Star, Calendar, Package, Home } from 'lucide-react';
import { fmtDate, fmt, avatarInitials, placeholderPhoto } from '@/lib/utils';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, bio')
    .eq('profile_slug', slug)
    .single();

  return {
    title: profile ? `${profile.name} — Nestly` : 'User Profile — Nestly',
    description: profile?.bio ?? `View this user's profile on Nestly.`,
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  // Who is viewing?
  const { data: { user: viewer } } = await supabase.auth.getUser();

  // Fetch the target profile
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, name, role, profile_pic, bio, is_public, profile_slug, created_at')
    .eq('profile_slug', slug)
    .single();

  if (error || !profile) return notFound();

  const isOwnProfile = viewer?.id === profile.id;

  // Respect privacy setting — non-owners see a private page
  if (!profile.is_public && !isOwnProfile) {
    return (
      <div className="container" style={{ padding: '80px 5%', textAlign: 'center' }}>
        <Lock size={48} color="var(--ink-muted)" style={{ margin: '0 auto 24px' }} />
        <h2 style={{ marginBottom: '8px' }}>This profile is private</h2>
        <p style={{ color: 'var(--ink-muted)' }}>
          {profile.name} has chosen to keep their profile hidden.
        </p>
        <Link href="/listings" className="btn btn-primary" style={{ marginTop: '24px', display: 'inline-block' }}>
          Browse Listings
        </Link>
      </div>
    );
  }

  // Fetch their average rating
  const { data: ratingsData } = await supabase
    .from('user_ratings')
    .select('rating')
    .eq('target_user_id', profile.id);

  const totalRatings = ratingsData?.length ?? 0;
  const avgRating = totalRatings > 0
    ? ratingsData!.reduce((sum, r) => sum + r.rating, 0) / totalRatings
    : 0;

  // Fetch their active listings (up to 6)
  const { data: listings } = await supabase
    .from('listings')
    .select('listing_id, title, photos, zone, status, costs:utility_costs(total_monthly)')
    .eq('user_id', profile.id)
    .eq('status', 'available')
    .limit(6);

  // Fetch their active exchange items (up to 6)
  const { data: items } = await supabase
    .from('items')
    .select('item_id, title, photo_url, asking_price, category, item_condition')
    .eq('seller_id', profile.id)
    .eq('status', 'available')
    .limit(6);

  const roleLabel: Record<string, string> = {
    student: 'Student',
    landlord: 'Landlord / Mess Owner',
    admin: 'Administrator',
  };

  const starCount = Math.round(avgRating);

  return (
    <div className="container" style={{ padding: '48px 5%' }}>

      {/* ── Profile Hero ───────────────────────────────── */}
      <div className="card" style={{ padding: '40px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '32px', flexWrap: 'wrap' }}>

          {/* Avatar */}
          <div style={{ flexShrink: 0 }}>
            {profile.profile_pic ? (
              <img
                src={profile.profile_pic}
                alt={profile.name}
                style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', border: '4px solid var(--border)' }}
              />
            ) : (
              <div style={{
                width: 120, height: 120, borderRadius: '50%',
                background: 'var(--emerald)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 40, fontWeight: 700, border: '4px solid var(--border)',
              }}>
                {avatarInitials(profile.name)}
              </div>
            )}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <h1 style={{ margin: 0, fontSize: '28px' }}>{profile.name}</h1>
              {profile.role === 'admin' && (
                <span className="badge badge-gold"><ShieldCheck size={13} /> Admin</span>
              )}
            </div>

            <div style={{ color: 'var(--ink-muted)', fontSize: '14px', marginBottom: '12px' }}>
              {roleLabel[profile.role] ?? profile.role}
              &nbsp;·&nbsp;
              <Calendar size={13} style={{ verticalAlign: 'middle' }} />
              &nbsp;Member since {fmtDate(profile.created_at)}
            </div>

            {/* Star rating */}
            {totalRatings > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                {[1,2,3,4,5].map(s => (
                  <Star
                    key={s}
                    size={18}
                    fill={s <= starCount ? 'var(--gold)' : 'none'}
                    color={s <= starCount ? 'var(--gold)' : 'var(--border)'}
                  />
                ))}
                <span style={{ fontSize: '14px', color: 'var(--ink-muted)' }}>
                  {avgRating.toFixed(1)} ({totalRatings} {totalRatings === 1 ? 'rating' : 'ratings'})
                </span>
              </div>
            )}

            {/* Bio */}
            {profile.bio && (
              <p style={{ color: 'var(--ink-mid)', lineHeight: 1.6, marginBottom: '16px', whiteSpace: 'pre-wrap' }}>
                {profile.bio}
              </p>
            )}

            {/* Quick stats */}
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              {(listings?.length ?? 0) > 0 && (
                <span style={{ fontSize: '14px', color: 'var(--ink-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Home size={14} /> {listings!.length} active listing{listings!.length !== 1 ? 's' : ''}
                </span>
              )}
              {(items?.length ?? 0) > 0 && (
                <span style={{ fontSize: '14px', color: 'var(--ink-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Package size={14} /> {items!.length} item{items!.length !== 1 ? 's' : ''} for sale
                </span>
              )}
            </div>
          </div>

          {/* Own-profile edit shortcut */}
          {isOwnProfile && (
            <Link href="/profile" className="btn btn-outline btn-sm" style={{ flexShrink: 0 }}>
              Edit Profile
            </Link>
          )}
        </div>
      </div>

      {/* ── Active Listings ────────────────────────────── */}
      {(listings?.length ?? 0) > 0 && (
        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ marginBottom: '20px', fontSize: '20px' }}>
            <Home size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
            Active Listings
          </h2>
          <div className="grid-2">
            {listings!.map(l => {
              const thumb = l.photos?.[0] ?? placeholderPhoto();
              const rent = (l.costs as any)?.total_monthly ?? 0;
              return (
                <div key={l.listing_id} className="listing-card">
                  <div className="listing-photo-wrap">
                    <img src={thumb} alt={l.title} className="listing-photo" loading="lazy" />
                  </div>
                  <div className="listing-body">
                    <div className="badges">
                      <span className="badge badge-navy">
                        <MapPin size={12} /> {l.zone}
                      </span>
                    </div>
                    <div className="listing-title">{l.title}</div>
                    <div className="price">{rent > 0 ? fmt(rent) : 'Ask'}<span> /month</span></div>
                    <div className="listing-footer">
                      <Link className="btn btn-primary btn-sm" href={`/listings/${l.listing_id}`}>
                        View Details
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Exchange Items ─────────────────────────────── */}
      {(items?.length ?? 0) > 0 && (
        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ marginBottom: '20px', fontSize: '20px' }}>
            <Package size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
            Items for Sale
          </h2>
          <div className="grid-2">
            {items!.map(item => {
              const placeholderSvg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='200'><rect width='300' height='200' fill='%23EEF7F2'/><text x='50%' y='50%' font-family='sans-serif' font-size='14' fill='%231A5C45' text-anchor='middle' dominant-baseline='middle'>No Photo</text></svg>";
              const thumb = item.photo_url ?? placeholderSvg;
              return (
                <div key={item.item_id} className="listing-card">
                  <div className="listing-photo-wrap">
                    <img src={thumb} alt={item.title} className="listing-photo" loading="lazy" />
                  </div>
                  <div className="listing-body">
                    <div className="badges">
                      <span className="badge badge-blue">{item.category}</span>
                    </div>
                    <div className="listing-title">{item.title}</div>
                    <div className="price">{fmt(item.asking_price)}</div>
                    <div className="listing-footer">
                      <Link className="btn btn-primary btn-sm" href={`/exchange/${item.item_id}`}>
                        View Item
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty state — own profile with nothing listed */}
      {isOwnProfile && (listings?.length ?? 0) === 0 && (items?.length ?? 0) === 0 && (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-muted)' }}>
          <p style={{ marginBottom: '16px' }}>You haven&apos;t listed anything yet.</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/listings" className="btn btn-primary btn-sm">Create a Listing</Link>
            <Link href="/exchange" className="btn btn-outline btn-sm">Sell an Item</Link>
          </div>
        </div>
      )}

    </div>
  );
}
