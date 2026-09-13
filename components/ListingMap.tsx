'use client';

import dynamic from 'next/dynamic';

const ListingMapClient = dynamic(() => import('./ListingMapClient'), {
  ssr: false,
  loading: () => <div style={{ height: '350px', width: '100%', background: 'var(--surface-2)', color: 'var(--ink-muted)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading map...</div>
});

interface ListingMapProps {
  lat: number;
  lng: number;
  title: string;
}

export default function ListingMap(props: ListingMapProps) {
  return <ListingMapClient {...props} />;
}
