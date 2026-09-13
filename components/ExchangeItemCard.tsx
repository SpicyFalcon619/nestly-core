import Link from 'next/link';
import { Link as LinkIcon } from 'lucide-react';
import { fmt, conditionLabel, conditionColor, placeholderPhoto } from '@/lib/utils';
import type { Item } from '@/types';

export default function ExchangeItemCard({ item, isLoggedIn }: { item: Item; isLoggedIn: boolean }) {
  const placeholderSvg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'><rect width='600' height='400' fill='%23EEF7F2'/><text x='50%' y='50%' font-family='sans-serif' font-size='18' fill='%231A5C45' text-anchor='middle' dominant-baseline='middle'>No Photo</text></svg>";
  const thumbnail = item.photos && item.photos.length > 0 ? item.photos[0] : (item.photo_url || placeholderSvg);

  return (
    <div className="listing-card">
      <div className="listing-photo-wrap">
        <img className="listing-photo" src={thumbnail} alt={item.title} loading="lazy" />
      </div>
      <div className="listing-body">
        <div className="badges">
          <span className="badge badge-navy">{item.category}</span>
          <span className={`badge ${conditionColor(item.item_condition)}`}>{conditionLabel(item.item_condition)}</span>
          <span className="badge badge-gray">{item.zone}</span>
          {item.listing_id && (
            <span className="badge badge-gold">
              <LinkIcon style={{ width: '15px', height: '15px' }} /> Linked Flat
            </span>
          )}
        </div>
        <div className="listing-title">{item.title}</div>
        <div className="price">{fmt(item.asking_price)}</div>
        <div style={{ fontSize: '12px', color: 'var(--gray)' }}>
          Seller: {item.seller_name || 'Anonymous'}
        </div>
        <div className="listing-footer" style={{ gap: '8px' }}>
          {isLoggedIn && (
            <Link className="btn btn-outline btn-sm" href={`/exchange/${item.item_id}`}>Make Offer</Link>
          )}
          <Link className="btn btn-primary btn-sm" href={`/exchange/${item.item_id}`}>View</Link>
        </div>
      </div>
    </div>
  );
}
