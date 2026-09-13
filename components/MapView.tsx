'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Zone, Listing } from '@/types';

const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '100%', width: '100%', background: 'var(--surface-2)', color: 'var(--ink-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      Loading map...
    </div>
  ),
});

interface MapViewProps {
  zones: Zone[];
  listings?: Listing[];
  selectedZoneId?: number;
  onZoneSelect?: (id: number) => void;
  interactive?: boolean;
}

export default function MapView(props: MapViewProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div style={{ height: '100%', width: '100%', background: 'var(--surface-2)' }} />;

  return <MapComponent {...props} />;
}
