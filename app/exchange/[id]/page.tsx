import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { fmt, conditionLabel, conditionColor, fmtDate, avatarInitials } from '@/lib/utils';
import { Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';
import ExchangeItemDetailClient from './ExchangeItemDetailClient';
import CommentSection from '@/components/comments/CommentSection';
import UserRating from '@/components/ratings/UserRating';
import OffersSection from '@/components/OffersSection';
import MessageButton from '@/components/MessageButton';
import PhotoGallery from '@/components/PhotoGallery';
import { fetchCommentsWithAuthors, commentThreadsAvailable, mentionablesFrom } from '@/lib/comments';

export default async function ExchangeItemDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch the item with joined tables
  const { data: item } = await supabase
    .from('items')
    .select(`
      *,
      seller:profiles!items_seller_id_fkey(name, email, phone, university_id, created_at, profile_pic, profile_slug),
      zone:zones(zone_name),
      listing:listings(title, listing_id)
    `)
    .eq('item_id', parseInt(id))
    .eq('item_id', parseInt(id))
    .single();

  if (!item) {
    notFound();
  }

  const commentsData = await fetchCommentsWithAuthors(supabase, 'item_comments', 'item_id', parseInt(id));

  // Fetch offers — owner sees all, buyer sees their own, others see accepted + pending counts only
  const { data: offersData } = await supabase
    .from('offers')
    .select('*, buyer:profiles!offers_buyer_id_fkey(name, profile_pic)')
    .eq('item_id', parseInt(id))
    .order('created_at', { ascending: false });
  const allOffers = offersData || [];

  const comments = commentsData || [];

  // Determine if the current user is logged in and if they are the seller
  const { data: { user } } = await supabase.auth.getUser();
  const isOwner = user?.id === item.seller_id;
  const isLoggedIn = !!user;

  let isAdmin = false;
  if (isLoggedIn) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role === 'admin') isAdmin = true;
  }

  // If logged in, fetch user's votes to pass down
  let finalComments = comments;
  if (isLoggedIn) {
    const { data: userVotes } = await supabase
      .from('item_comment_votes')
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
  const threadsEnabled = await commentThreadsAvailable(supabase, 'item_comments');
  const mentionable = mentionablesFrom(finalComments as any, { id: item.seller_id, name: item.seller?.name, profile_slug: item.seller?.profile_slug, is_public: item.seller?.is_public });

  // Fetch target user's ratings to calculate average
  let averageRating = 0;
  let totalRatings = 0;
  if (item.seller_id) {
    const { data: ratingsData } = await supabase
      .from('user_ratings')
      .select('rating')
      .eq('target_user_id', item.seller_id);
      
    if (ratingsData && ratingsData.length > 0) {
      totalRatings = ratingsData.length;
      averageRating = ratingsData.reduce((acc: number, curr: any) => acc + curr.rating, 0) / totalRatings;
    }
  }

  const placeholderSvg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'><rect width='600' height='400' fill='%23EEF7F2'/><text x='50%' y='50%' font-family='sans-serif' font-size='18' fill='%231A5C45' text-anchor='middle' dominant-baseline='middle'>No Photo</text></svg>";
  const galleryPhotos: string[] = item.photos && item.photos.length > 0
    ? item.photos
    : [item.photo_url || placeholderSvg];

  return (
    <div className="container" style={{ padding: '40px 5%' }}>
      <Link href="/exchange" style={{ display: 'inline-block', marginBottom: '20px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
        ← Back to Exchange
      </Link>

      <div className="grid-2" style={{ alignItems: 'start', gap: '32px' }}>
        {/* Left Col: Photos */}
        <div style={{ position: 'sticky', top: '24px' }}>
          <PhotoGallery photos={galleryPhotos} title={item.title} />
        </div>

        {/* Right Col: Details */}
        <div>
          <div className="badges" style={{ marginBottom: '16px' }}>
            <span className="badge badge-navy">{item.category}</span>
            <span className={`badge ${conditionColor(item.item_condition)}`}>{conditionLabel(item.item_condition)}</span>
            <span className="badge badge-gray">{item.zone?.zone_name}</span>
          </div>
          
          <h1 style={{ margin: '0 0 16px 0', fontSize: '32px' }}>{item.title}</h1>
          <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--primary)', marginBottom: '24px' }}>
            {fmt(item.asking_price)}
          </div>

          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Seller Information</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Avatar — links to public profile when slug is available */}
              {item.seller?.profile_slug ? (
                <Link href={`/profiles/${item.seller.profile_slug}`} style={{ flexShrink: 0 }}>
                  {item.seller?.profile_pic ? (
                    <img src={item.seller.profile_pic} alt={item.seller.name} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
                  ) : (
                    <div style={{ width: 52, height: 52, borderRadius: '50%', backgroundColor: 'var(--btn-primary-bg)', color: 'var(--btn-primary-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 20 }}>
                      {avatarInitials(item.seller?.name || 'U')}
                    </div>
                  )}
                </Link>
              ) : (
                item.seller?.profile_pic ? (
                  <img src={item.seller.profile_pic} alt={item.seller.name} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 52, height: 52, borderRadius: '50%', backgroundColor: 'var(--btn-primary-bg)', color: 'var(--btn-primary-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 20, flexShrink: 0 }}>
                    {avatarInitials(item.seller?.name || 'U')}
                  </div>
                )
              )}
              <div>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {item.seller?.profile_slug ? (
                    <Link href={`/profiles/${item.seller.profile_slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                      {item.seller?.name || 'Anonymous User'}
                    </Link>
                  ) : (
                    item.seller?.name || 'Anonymous User'
                  )}
                </div>
                {item.seller_id && (
                  <UserRating
                    targetUserId={item.seller_id}
                    initialRating={averageRating}
                    totalRatings={totalRatings}
                    isLoggedIn={isLoggedIn && !isAdmin}
                    currentUserId={user?.id}
                  />
                )}
                <div style={{ fontSize: '14px', color: 'var(--gray)', marginTop: '4px' }}>
                  Student · Member since {fmtDate(item.seller?.created_at || item.created_at)}
                </div>
              </div>
            </div>
            
            {/* Show contact info only to logged in users */}
            {isLoggedIn ? (
              <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--surface-2)', borderRadius: '8px' }}>
                <div style={{ fontSize: '14px', marginBottom: '4px' }}><strong>Email:</strong> {item.seller?.email}</div>
                <div style={{ fontSize: '14px' }}><strong>Phone:</strong> {item.seller?.phone || 'Not provided'}</div>
              </div>
            ) : (
              <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--surface-2)', borderRadius: '8px', textAlign: 'center', fontSize: '14px' }}>
                <Link href="/login" style={{ color: 'var(--primary)' }}>Log in to view contact details</Link>
              </div>
            )}
          </div>

          {item.listing && (
            <div className="card" style={{ marginBottom: '24px', borderLeft: '4px solid var(--gold)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <LinkIcon size={18} color="var(--gold)" />
                <h3 style={{ margin: 0 }}>Linked to a Room/Flat</h3>
              </div>
              <p style={{ margin: '0 0 12px 0', fontSize: '14px' }}>This item is being sold by the current tenant of this listing, usually meaning it stays in the room if you move in.</p>
              <Link href={`/listings/${item.listing.listing_id}`} className="btn btn-outline btn-sm">
                View Linked Listing
              </Link>
            </div>
          )}

          <div className="card">
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Description</h3>
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: 'var(--ink-mid)' }}>{item.description}</p>
          </div>

          {/* Message seller button — shown to logged-in non-owners */}
          {isLoggedIn && !isOwner && !isAdmin && (
            <div style={{ marginTop: '16px' }}>
              <MessageButton
                otherUserId={item.seller_id}
                itemId={item.item_id}
                label="Message Seller"
              />
            </div>
          )}

          <div style={{ marginTop: '24px' }}>
            <ExchangeItemDetailClient
              itemId={item.item_id}
              itemTitle={item.title}
              sellerId={item.seller_id}
              isLoggedIn={isLoggedIn}
              isOwner={isOwner}
              isAdmin={isAdmin}
              status={item.status}
              askingPrice={item.asking_price}
            />
          </div>

          {/* Offers / bidding panel — visible to owner (all) or logged-in users (accepted only) */}
          {(isOwner || isLoggedIn) && (
            <OffersSection
              offers={isOwner ? allOffers as any : allOffers.filter((o: any) => o.buyer_id === user?.id) as any}
              isOwner={isOwner}
              itemId={item.item_id}
            />
          )}

          <div style={{ marginTop: '32px' }}>
            <CommentSection
              itemId={item.item_id}
              initialComments={finalComments as any}
              isLoggedIn={isLoggedIn}
              currentUserId={user?.id}
              threadsEnabled={threadsEnabled}
              mentionable={mentionable}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
