import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck, User, Bath, Zap, Sofa, MapPin } from 'lucide-react';
import type { Listing } from '@/types';
import { fmt, propertyTypeLabel, statusColor, statusLabel } from '@/lib/utils';
import { compatBand } from '@/lib/compatibility';

export default function ListingCard({ listing }: { listing: Listing }) {
  const placeholderSvg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'><rect width='600' height='400' fill='%23EEF7F2'/><text x='50%' y='50%' font-family='sans-serif' font-size='18' fill='%231A5C45' text-anchor='middle' dominant-baseline='middle'>No Photo</text></svg>";
  const thumbnail = listing.photos && listing.photos.length > 0 ? listing.photos[0] : placeholderSvg;
  const totalRent = listing.costs ? listing.costs.total_monthly : 0;
  const freeRooms = Math.max(0, (listing.total_rooms || 0) - (listing.current_occupancy || 0));

  const genderLabel = listing.gender_pref === 'female'
    ? 'Female only'
    : listing.gender_pref === 'male'
      ? 'Male only'
      : 'Any gender';

  return (
    <div className="listing-card">
      <div className="listing-photo-wrap">
        <Image
          src={thumbnail}
          alt={listing.title}
          className="listing-photo"
          fill
          sizes="(max-width: 560px) 100vw, (max-width: 1100px) 50vw, 25vw"
          // inline SVG placeholders can't go through the optimizer
          unoptimized={thumbnail.startsWith('data:')}
        />
        <div className="listing-photo-badges">
          {listing.is_verified && (
            <span className="badge badge-gold"><ShieldCheck size={12} /> Verified</span>
          )}
          <span className={`badge ${statusColor(listing.status)}`}>{statusLabel(listing.status)}</span>
        </div>

        {/* Flatmate match — only present when both sides have preferences set. */}
        {typeof listing.compatibility === 'number' && (
          <div
            className={`compat-pill compat-${compatBand(listing.compatibility).tone}`}
            title={`${compatBand(listing.compatibility).label} — based on your lifestyle preferences`}
          >
            <span className="compat-dot" />
            {listing.compatibility}% match
          </div>
        )}
      </div>

      <div className="listing-body">
        {/* Zone / type / who listed it are metadata, not status — a quiet meta
            line reads better than three pastel chips, and leaves the photo
            badges (Verified, Availability) as the only things that shout. */}
        <div className="listing-metaline">
          {listing.zone && (
            <>
              <span className="listing-metaline-strong"><MapPin size={12} /> {listing.zone}</span>
              <span aria-hidden="true">·</span>
            </>
          )}
          <span>{propertyTypeLabel(listing.property_type)}</span>
          <span aria-hidden="true">·</span>
          <span>{listing.listing_type === 'peer_listing' ? 'Student listed' : 'Landlord listed'}</span>
        </div>

        <div className="listing-title">{listing.title}</div>

        <div className="price">
          {totalRent > 0 ? fmt(totalRent) : 'Ask'}<span> /month</span>
        </div>

        {/* Key facts row */}
        <div className="listing-meta" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '13px', color: 'var(--ink-muted)', margin: '6px 0' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <User size={12} /> {genderLabel}
          </span>
          <span>·</span>
          <span>
            {freeRooms > 0
              ? <><strong style={{ color: 'var(--primary)' }}>{freeRooms}</strong> room{freeRooms !== 1 ? 's' : ''} free</>
              : <span style={{ color: 'var(--danger, #be3d2f)' }}>Full</span>
            }
          </span>
          <span>·</span>
          <span>{listing.total_rooms} total</span>
        </div>

        {/* Amenities mini-row (only shown when data is available) */}
        {listing.amenities && (
          <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: 'var(--ink-muted)', margin: '6px 0', flexWrap: 'wrap' }}>
            {listing.amenities.attached_bathroom && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="Attached Bathroom">
                <Bath size={11} /> Bathroom
              </span>
            )}
            {listing.amenities.is_furnished && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="Furnished">
                <Sofa size={11} /> Furnished
              </span>
            )}
            {listing.amenities.power_backup && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="Power Backup">
                <Zap size={11} /> Backup
              </span>
            )}
          </div>
        )}

        <div className="listing-footer">
          <Link className="btn btn-primary btn-sm" href={`/listings/${listing.listing_id || listing.id}`}>
            View Details
          </Link>
        </div>
      </div>
    </div>
  );
}
