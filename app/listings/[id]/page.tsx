import { createClient } from '@/lib/supabase/server';
import { MapPin, ShieldCheck, Bath, UtensilsCrossed, Sofa, Sunset, Car, Zap, ArrowUpDown, CheckCircle2, XCircle, Users, DoorOpen, CalendarDays, Home, Phone, Mail, Lock, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { fmt, fmtDate, propertyTypeLabel, statusLabel, statusColor, placeholderPhoto, avatarInitials } from '@/lib/utils';
import ApplicationForm from './ApplicationForm';
import WatchlistButton from '@/components/WatchlistButton';
import ReviewsSection from '@/components/ReviewsSection';
import { notFound } from 'next/navigation';
import ListingMap from '@/components/ListingMap';
import PhotoGallery from '@/components/PhotoGallery';
import StatusChanger from '@/components/StatusChanger';
import { fetchCommentsWithAuthors, commentThreadsAvailable, mentionablesFrom } from '@/lib/comments';
import ReportButton from '@/components/ReportButton';
import CommentSection from '@/components/comments/CommentSection';
import UserRating from '@/components/ratings/UserRating';
import Link from 'next/link';
import MessageButton from '@/components/MessageButton';
import ShareButton from '@/components/ShareButton';
import ListingBreadcrumb from '@/components/ListingBreadcrumb';
import CompatibilityCard from '@/components/CompatibilityCard';
import { scoreCompatibility, type CompatResult } from '@/lib/compatibility';
import ListingCard from '@/components/ListingCard';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('listings')
    .select('title, address, photos, costs:utility_costs(total_monthly)')
    .eq('listing_id', parseInt(id))
    .single();

  if (!data) return { title: 'Listing not found - Nestly' };

  const total = (data as any).costs?.total_monthly;
  const description = total
    ? `${fmt(total)}/month all-in — ${data.address}. Every cost itemized upfront on Nestly.`
    : `${data.address}. Every cost itemized upfront on Nestly.`;

  return {
    title: `${data.title} - Nestly`,
    description,
    openGraph: {
      title: data.title,
      description,
      images: data.photos && data.photos.length > 0 ? [data.photos[0]] : [],
    },
  };
}

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  
  const supabase = await createClient();
  
  const { data: listing, error } = await supabase
    .from('listings')
    .select(`
      *,
      zone:zones(zone_name),
      costs:utility_costs(*),
      amenities:listing_amenities(*),
      reviews(*),
      owner:profiles!listings_user_id_fkey(name, email, role, phone, profile_pic, profile_slug)
    `)
    .eq('listing_id', parseInt(id))
    .single();
    
  if (error || !listing) {
    return notFound();
  }

  const owner = (listing as any).owner || {};
  const zoneName = (listing as any).zone?.zone_name || null;
  const photos: string[] = listing.photos && listing.photos.length > 0 ? listing.photos : [placeholderPhoto()];

  const freeRooms = Math.max(0, (listing.total_rooms || 0) - (listing.current_occupancy || 0));
  const genderLabel = listing.gender_pref === 'female'
    ? 'Female only'
    : listing.gender_pref === 'male'
      ? 'Male only'
      : 'Any gender';
  const isOccupied = listing.status === 'occupied';
  // "Listed by — Landlord Listed" reads badly; the fact label already says "by".
  const listedByLabel = listing.listing_type === 'peer_listing' ? 'Fellow student' : 'Landlord';

  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  let isAdmin = false;
  if (isLoggedIn) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role === 'admin') isAdmin = true;
  }

  // Check watchlist status if logged in
  let isWatched = false;
  if (isLoggedIn) {
    const { count } = await supabase
      .from('watchlists')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('listing_id', parseInt(id));
    isWatched = (count || 0) > 0;
  }

  // Check existing application
  let existingApplication: { status: string } | null = null;
  if (isLoggedIn && user?.id !== listing.user_id && !isAdmin) {
    const { data: appData } = await supabase
      .from('applications')
      .select('status')
      .eq('listing_id', parseInt(id))
      .eq('applicant_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    existingApplication = appData;
  }

  // Flatmate compatibility against whoever listed the place. Both sides need a
  // preferences row; with only the lister's, the card becomes the prompt to
  // fill yours in.
  let compat: CompatResult | null = null;
  let compatNeedsMine = false;
  if (isLoggedIn && user!.id !== listing.user_id && !isAdmin) {
    const { data: prefRows } = await supabase
      .from('user_preferences')
      .select('*')
      .in('user_id', [user!.id, listing.user_id]);
    const mine = prefRows?.find(r => r.user_id === user!.id) ?? null;
    const theirs = prefRows?.find(r => r.user_id === listing.user_id) ?? null;
    if (mine && theirs) compat = scoreCompatibility(mine, theirs, listing.gender_pref);
    else if (theirs) compatNeedsMine = true;
  }

  // Fetch comments
  const comments = await fetchCommentsWithAuthors(supabase, 'listing_comments', 'listing_id', parseInt(id));

  let finalComments = comments;
  if (isLoggedIn) {
    const { data: userVotes } = await supabase
      .from('listing_comment_votes')
      .select('comment_id, vote_type')
      .eq('user_id', user.id);
      
    if (userVotes && userVotes.length > 0) {
      finalComments = comments.map(c => {
        const vote = userVotes.find(v => v.comment_id === c.comment_id);
        return vote ? { ...c, user_vote: vote.vote_type } : c;
      });
    }
  }


  // Replies and @mentions need migration 0007; without it comments stay flat.
  const threadsEnabled = await commentThreadsAvailable(supabase, 'listing_comments');
  const mentionable = mentionablesFrom(finalComments as any, { id: listing.user_id, name: owner.name, profile_slug: owner.profile_slug, is_public: owner.is_public });

  // Fetch ratings for the landlord
  let averageRating = 0;
  let totalRatings = 0;
  if (listing.user_id) {
    const { data: ratingsData } = await supabase
      .from('user_ratings')
      .select('rating')
      .eq('target_user_id', listing.user_id);
      
    if (ratingsData && ratingsData.length > 0) {
      totalRatings = ratingsData.length;
      averageRating = ratingsData.reduce((acc: number, curr: any) => acc + curr.rating, 0) / totalRatings;
    }
  }

  // Comparable listings — same zone or same property type. One query feeds both
  // the price comparison and the "similar listings" row.
  const { data: compRows } = await supabase
    .from('listings')
    .select('*, zone:zones(zone_name), costs:utility_costs(*), amenities:listing_amenities(*)')
    .neq('listing_id', parseInt(id))
    .neq('status', 'occupied')
    .or(`zone_id.eq.${listing.zone_id},property_type.eq.${listing.property_type}`)
    .order('created_at', { ascending: false })
    .limit(40);

  const comps: any[] = (compRows || []).map((l: any) => ({ ...l, zone: l.zone?.zone_name ?? undefined }));
  const thisTotal = Number(listing.costs?.total_monthly || 0);
  const totalOf = (l: any) => Number(l.costs?.total_monthly || 0);

  // Price comparison is like-for-like (same property type) — comparing a single
  // room against a six-room mess would be meaningless. Prefer the same zone; fall
  // back to the whole city; show nothing without at least two comparables.
  const MIN_SAMPLE = 2;
  const sameType = comps.filter(l => l.property_type === listing.property_type && totalOf(l) > 0);
  const sameTypeZone = sameType.filter(l => l.zone_id === listing.zone_id);
  const sample = sameTypeZone.length >= MIN_SAMPLE
    ? { rows: sameTypeZone, scope: zoneName || 'this zone' }
    : sameType.length >= MIN_SAMPLE
      ? { rows: sameType, scope: 'Dhaka' }
      : null;

  let priceComparison: { text: string; tone: 'below' | 'above' | 'even'; basis: string } | null = null;
  if (sample && thisTotal > 0) {
    const avg = sample.rows.reduce((s, l) => s + totalOf(l), 0) / sample.rows.length;
    const diff = thisTotal - avg;
    const typeLabel = propertyTypeLabel(listing.property_type).toLowerCase();
    const basis = `Based on ${sample.rows.length} other ${typeLabel} listing${sample.rows.length === 1 ? '' : 's'}`;
    if (Math.abs(diff) / avg < 0.03) {
      priceComparison = { text: `About average for a ${typeLabel} in ${sample.scope}`, tone: 'even', basis };
    } else {
      const amount = fmt(Math.round(Math.abs(diff) / 50) * 50);
      priceComparison = diff < 0
        ? { text: `${amount} below the average ${typeLabel} in ${sample.scope}`, tone: 'below', basis }
        : { text: `${amount} above the average ${typeLabel} in ${sample.scope}`, tone: 'above', basis };
    }
  }

  // Similar listings: rank by shared zone, shared type, and a comparable price.
  const similar = comps
    .map(l => ({
      l,
      score:
        (l.zone_id === listing.zone_id ? 2 : 0) +
        (l.property_type === listing.property_type ? 2 : 0) +
        (thisTotal > 0 && totalOf(l) > 0 && Math.abs(totalOf(l) - thisTotal) / thisTotal <= 0.25 ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(x => x.l);

  return (
    <div className="container" style={{ padding: '40px 5%' }}>
      <div className="detail-layout">

        {/* Left Column: Details */}
        <div style={{ minWidth: 0 }}>
          <ListingBreadcrumb zoneId={listing.zone_id} zoneName={zoneName} title={listing.title} />
          <div style={{ marginBottom: '24px' }}>
            <div className="badges" style={{ marginBottom: '12px' }}>
              {zoneName && <span className="badge badge-navy"><MapPin size={14}/> {zoneName}</span>}
              <span className="badge badge-blue">{propertyTypeLabel(listing.property_type)}</span>
              <span className={`badge ${statusColor(listing.status)}`}>{statusLabel(listing.status)}</span>
              {listing.is_verified && <span className="badge badge-gold"><ShieldCheck size={14}/> Verified</span>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
              <div>
                <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>{listing.title}</h1>
                <p style={{ color: 'var(--ink-muted)' }}>{listing.address}</p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <ShareButton title={listing.title} />
                <WatchlistButton listingId={parseInt(id)} initialIsWatched={isWatched} />
              </div>
            </div>
          </div>

          <PhotoGallery photos={photos} title={listing.title} />

          <div className="fact-grid">
            <div className="fact">
              <span className="fact-label">Open to</span>
              <span className="fact-value"><Users size={15} /> {genderLabel}</span>
            </div>
            <div className="fact">
              <span className="fact-label">Rooms</span>
              <span className="fact-value">
                <DoorOpen size={15} />
                {freeRooms > 0
                  ? `${freeRooms} of ${listing.total_rooms} free`
                  : `Full (${listing.total_rooms})`}
              </span>
            </div>
            <div className="fact">
              <span className="fact-label">Listed by</span>
              <span className="fact-value"><Home size={15} /> {listedByLabel}</span>
            </div>
            <div className="fact">
              <span className="fact-label">{listing.expected_vacate_date ? 'Available from' : 'Posted'}</span>
              <span className="fact-value">
                <CalendarDays size={15} />
                {listing.expected_vacate_date
                  ? fmtDate(listing.expected_vacate_date)
                  : fmtDate(listing.created_at)}
              </span>
            </div>
          </div>

          <div className="card" style={{ padding: '32px', marginBottom: '24px' }}>
            <h3>Description</h3>
            <p style={{ whiteSpace: 'pre-wrap', color: 'var(--ink-mid)' }}>
              {listing.description || 'No description provided.'}
            </p>
          </div>

          <div className="card" style={{ padding: '32px', marginBottom: '24px' }}>
            <h3>Amenities</h3>
            {listing.amenities ? (() => {
              const amenityList = [
                { key: 'attached_bathroom', label: 'Attached Bathroom', icon: <Bath size={16} /> },
                { key: 'attached_kitchen',  label: 'Kitchen',           icon: <UtensilsCrossed size={16} /> },
                { key: 'is_furnished',      label: 'Furnished',         icon: <Sofa size={16} /> },
                { key: 'rooftop_access',    label: 'Rooftop Access',    icon: <Sunset size={16} /> },
                { key: 'parking',           label: 'Parking',           icon: <Car size={16} /> },
                { key: 'power_backup',      label: 'Power Backup',      icon: <Zap size={16} /> },
                { key: 'lift_access',       label: 'Lift / Elevator',   icon: <ArrowUpDown size={16} /> },
              ];
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '16px' }}>
                  {amenityList.map(({ key, label, icon }) => {
                    const has = !!(listing.amenities as any)[key];
                    return (
                      <div
                        key={key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          // Missing amenities are called out in red rather than greyed
                          // out — "this place has no lift" is information worth seeing.
                          background: has ? 'var(--emerald-soft)' : 'var(--tint-red)',
                          color: has ? 'var(--emerald)' : 'var(--danger)',
                          border: `1px solid color-mix(in srgb, ${has ? 'var(--emerald)' : 'var(--danger)'} 22%, transparent)`,
                          fontSize: '14px',
                          fontWeight: 500,
                        }}
                      >
                        <span style={{ display: 'flex', flexShrink: 0 }}>{icon}</span>
                        <span style={{ flex: 1 }}>{label}</span>
                        {has
                          ? <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
                          : <XCircle     size={14} style={{ flexShrink: 0 }} />
                        }
                      </div>
                    );
                  })}
                </div>
              );
            })() : (
              <p style={{ color: 'var(--ink-muted)' }}>Not specified.</p>
            )}
          </div>

          {(listing.lat && listing.lng) ? (
            <ListingMap lat={listing.lat} lng={listing.lng} title={listing.title} />
          ) : (
            <div className="card" style={{ padding: '32px', marginBottom: '24px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><MapPin size={20} /> Location & Map</h3>
              <p style={{ color: 'var(--ink-muted)' }}>Exact map coordinates not available for this listing.</p>
            </div>
          )}

          <ReviewsSection 
            listingId={parseInt(id)} 
            initialReviews={listing.reviews || []} 
            isLoggedIn={isLoggedIn}
            currentUserId={user?.id}
          />

          <div style={{ marginTop: '32px' }}>
            <CommentSection 
              itemId={listing.listing_id}
              initialComments={finalComments as any}
              isLoggedIn={isLoggedIn}
              currentUserId={user?.id}
              type="listing"
              threadsEnabled={threadsEnabled}
              mentionable={mentionable}
            />
          </div>
        </div>

        {/* Right Column: sticky on desktop, inline below 900px (see globals.css) */}
        <div className="right-sticky-col">

            {/* Green card — cost breakdown only */}
            <div className="card bento-emerald" style={{ padding: '32px' }}>
              <h3 style={{ marginBottom: '24px' }}>Cost Breakdown</h3>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span>Base Rent</span>
                <strong>{fmt(listing.costs?.base_rent || 0)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span>Electricity ({listing.costs?.electricity_type})</span>
                <span>{fmt(listing.costs?.electricity_amount || 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span>Gas</span>
                <span>{fmt(listing.costs?.gas_bill || 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span>Water</span>
                <span>{fmt(listing.costs?.water_bill || 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span>Internet</span>
                <span>{fmt(listing.costs?.internet_cost || 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span>Service Charge</span>
                <span>{fmt((listing.costs?.maintenance_fee || 0) + (listing.costs?.caretaker_fee || 0))}</span>
              </div>
              {(listing.costs?.other_fees || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span>Other Fees</span>
                  <span>{fmt(listing.costs?.other_fees || 0)}</span>
                </div>
              )}
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.25)', marginBottom: '20px', paddingBottom: '12px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: 'bold' }}>
                <span>Total Monthly</span>
                <span>{fmt(listing.costs?.total_monthly || 0)}</span>
              </div>

              {priceComparison && (
                <div className={`price-compare price-compare-${priceComparison.tone}`}>
                  {priceComparison.tone === 'below'
                    ? <TrendingDown size={15} />
                    : priceComparison.tone === 'above'
                      ? <TrendingUp size={15} />
                      : <Minus size={15} />}
                  <div>
                    <div className="price-compare-text">{priceComparison.text}</div>
                    <div className="price-compare-basis">{priceComparison.basis}</div>
                  </div>
                </div>
              )}
            </div>

            {(compat || compatNeedsMine) && (
              <CompatibilityCard
                result={compat}
                otherName={owner.name}
                needsMyPreferences={compatNeedsMine}
              />
            )}

            {/* White card — owner info + apply */}
            <div className="card" style={{ padding: '24px' }}>
              <h4 style={{ marginBottom: '14px', marginTop: 0 }}>Listed By</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                {owner.profile_slug ? (
                  <Link href={`/profiles/${owner.profile_slug}`} style={{ flexShrink: 0 }}>
                    {owner.profile_pic ? (
                      <img src={owner.profile_pic} alt={owner.name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>
                        {avatarInitials(owner.name || 'U')}
                      </div>
                    )}
                  </Link>
                ) : (
                  owner.profile_pic ? (
                    <img src={owner.profile_pic} alt={owner.name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                      {avatarInitials(owner.name || 'U')}
                    </div>
                  )
                )}
                <div>
                  {owner.profile_slug ? (
                    <Link href={`/profiles/${owner.profile_slug}`} style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>
                      {owner.name}
                    </Link>
                  ) : (
                    <div style={{ fontWeight: 600 }}>{owner.name}</div>
                  )}
                  {listing.user_id && (
                    <UserRating
                      targetUserId={listing.user_id}
                      initialRating={averageRating}
                      totalRatings={totalRatings}
                      isLoggedIn={isLoggedIn && !isAdmin}
                      currentUserId={user?.id}
                    />
                  )}
                  <div style={{ fontSize: '12px', color: 'var(--ink-muted)', textTransform: 'capitalize', marginTop: '4px' }}>{owner.role}</div>
                </div>
              </div>

              {/* Contact details are private until the landlord accepts — that
                  acceptance is the point at which the two parties actually need
                  to reach each other outside the app. */}
              {(owner.phone || owner.email) && (
                existingApplication?.status === 'accepted' || user?.id === listing.user_id ? (
                  <div style={{ marginBottom: '16px', padding: '14px', background: 'var(--tint-green)', border: '1px solid color-mix(in srgb, var(--emerald) 30%, transparent)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: '8px' }}>
                      Contact details
                    </div>
                    {owner.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', marginBottom: owner.email ? '6px' : 0 }}>
                        <Phone size={14} style={{ color: 'var(--emerald)', flexShrink: 0 }} />
                        <a href={`tel:${owner.phone}`}>{owner.phone}</a>
                      </div>
                    )}
                    {owner.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', wordBreak: 'break-all' }}>
                        <Mail size={14} style={{ color: 'var(--emerald)', flexShrink: 0 }} />
                        <a href={`mailto:${owner.email}`}>{owner.email}</a>
                      </div>
                    )}
                  </div>
                ) : isLoggedIn && !isAdmin ? (
                  <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--ink-muted)' }}>
                    <Lock size={13} style={{ flexShrink: 0 }} />
                    Contact details unlock once your application is accepted.
                  </div>
                ) : null
              )}

              {isLoggedIn ? (
                user?.id === listing.user_id || isAdmin ? (
                  <>
                    <div style={{ padding: '14px', background: 'var(--surface-1)', borderRadius: '8px', textAlign: 'center', color: 'var(--ink-muted)', fontSize: '14px' }}>
                      {isAdmin ? 'Admins cannot apply for listings.' : 'This is your own listing.'}
                    </div>
                    {user?.id === listing.user_id && (
                      <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                        <StatusChanger type="listing" entityId={parseInt(id)} currentStatus={listing.status} />
                      </div>
                    )}
                  </>
                ) : isOccupied ? (
                  <>
                    <div style={{ padding: '14px', background: 'var(--tint-red)', borderRadius: '8px', textAlign: 'center', color: 'var(--danger)', fontSize: '14px', fontWeight: 500 }}>
                      This listing is fully occupied and isn&apos;t accepting applications.
                    </div>
                    <div style={{ marginTop: '10px' }}>
                      <MessageButton
                        otherUserId={listing.user_id}
                        listingId={parseInt(id)}
                        label="Message Landlord"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <ApplicationForm
                      listingId={parseInt(id)}
                      ownerId={listing.user_id}
                      listingTitle={listing.title}
                      existingStatus={existingApplication?.status || null}
                    />
                    <div style={{ marginTop: '10px' }}>
                      <MessageButton
                        otherUserId={listing.user_id}
                        listingId={parseInt(id)}
                        label="Message Landlord"
                      />
                    </div>
                  </>
                )
              ) : (
                <div style={{ padding: '14px', background: 'var(--surface-1)', borderRadius: '8px', textAlign: 'center', color: 'var(--ink-muted)', fontSize: '14px' }}>
                  Please <Link href="/login" style={{ color: 'var(--primary)' }}>log in</Link> to apply.
                </div>
              )}

              {isLoggedIn && user?.id !== listing.user_id && (
                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                  <ReportButton
                    listingId={parseInt(id)}
                    againstUserId={listing.user_id}
                    contextTitle={listing.title}
                  />
                </div>
              )}
            </div>

        </div>

      </div>

      {similar.length > 0 && (
        <section className="section" style={{ borderBottom: 'none', marginTop: '24px' }}>
          <div className="section-head">
            <h2>Similar listings</h2>
            <Link href={`/listings?zone=${listing.zone_id}`}>More in {zoneName || 'this zone'} →</Link>
          </div>
          <div className="grid-3">
            {similar.map(l => <ListingCard key={l.listing_id} listing={l} />)}
          </div>
        </section>
      )}
    </div>
  );
}
