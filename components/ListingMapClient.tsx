'use client';

import { useEffect, useRef, useState } from 'react';
import { Navigation, MapPin, Compass, Clock } from 'lucide-react';
import { toast } from 'sonner';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getCurrentMapTheme, getTileConfig, watchMapTheme } from '@/lib/mapTheme';

// Fix Leaflet default icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const userIcon = new L.Icon({
  iconUrl:     'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl:   'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize:    [25, 41],
  iconAnchor:  [12, 41],
  popupAnchor: [1, -34],
  shadowSize:  [41, 41],
});

interface ListingMapProps {
  lat: number;
  lng: number;
  title: string;
}

export default function ListingMapClient({ lat, lng, title }: ListingMapProps) {
  const mapRef       = useRef<HTMLDivElement>(null);
  const leafletMap   = useRef<L.Map | null>(null);
  const userMarker   = useRef<L.Marker | null>(null);
  const routeLine    = useRef<L.Polyline | null>(null);
  const tileLayer    = useRef<L.TileLayer | null>(null);

  const [distanceKm,  setDistanceKm]  = useState<number | null>(null);
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [isLocating,  setIsLocating]  = useState(false);

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    leafletMap.current = L.map(mapRef.current).setView([lat, lng], 15);

    const tileConfig = getTileConfig(getCurrentMapTheme());
    tileLayer.current = L.tileLayer(tileConfig.url, {
      maxZoom:    20,
      subdomains: tileConfig.subdomains,
      attribution: tileConfig.attribution,
    }).addTo(leafletMap.current);

    L.marker([lat, lng])
      .addTo(leafletMap.current)
      .bindPopup(`<b>${title}</b>`)
      .openPopup();

    setTimeout(() => leafletMap.current?.invalidateSize(), 400);

    const stopWatching = watchMapTheme((theme) => {
      if (!leafletMap.current) return;
      const cfg = getTileConfig(theme);
      if (tileLayer.current) leafletMap.current.removeLayer(tileLayer.current);
      tileLayer.current = L.tileLayer(cfg.url, {
        maxZoom: 20,
        subdomains: cfg.subdomains,
        attribution: cfg.attribution,
      }).addTo(leafletMap.current);
    });

    return () => {
      stopWatching();
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, [lat, lng, title]);

  const handleCalculateDistance = async () => {
    if (!('geolocation' in navigator)) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    toast.info('Finding your location…');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: uLat, longitude: uLng } = pos.coords;

        if (leafletMap.current) {
          // Remove previous route & user marker
          if (userMarker.current)  leafletMap.current.removeLayer(userMarker.current);
          if (routeLine.current)   leafletMap.current.removeLayer(routeLine.current);

          userMarker.current = L.marker([uLat, uLng], { icon: userIcon })
            .addTo(leafletMap.current)
            .bindPopup('Your Location')
            .openPopup();

          // Attempt to fetch a real road route from OSRM
          try {
            const url = `https://router.project-osrm.org/route/v1/driving/${uLng},${uLat};${lng},${lat}?geometries=geojson&overview=full`;
            const res  = await fetch(url);
            const data = await res.json();

            if (data.code === 'Ok' && data.routes?.length > 0) {
              const route = data.routes[0];
              // OSRM returns [lng, lat] pairs — flip to [lat, lng] for Leaflet
              const coords: [number, number][] = route.geometry.coordinates.map(
                ([lng, lt]: number[]) => [lt, lng] as [number, number]
              );
              routeLine.current = L.polyline(coords, {
                color:   '#1a5c45',
                weight:  4,
                opacity: 0.85,
              }).addTo(leafletMap.current);

              setDistanceKm(route.distance / 1000);
              setDurationMin(Math.round(route.duration / 60));
            } else {
              throw new Error('No route found');
            }
          } catch {
            // Fallback: dashed straight line
            routeLine.current = L.polyline([[uLat, uLng], [lat, lng]], {
              color:     '#1a5c45',
              weight:    3,
              dashArray: '6, 10',
            }).addTo(leafletMap.current);

            // Haversine straight-line distance
            const R    = 6371;
            const dLat = (lat - uLat) * Math.PI / 180;
            const dLon = (lng - uLng) * Math.PI / 180;
            const a    = Math.sin(dLat/2)**2 +
                         Math.cos(uLat * Math.PI/180) * Math.cos(lat * Math.PI/180) * Math.sin(dLon/2)**2;
            setDistanceKm(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
            setDurationMin(null);
          }

          // Fit map to show both user and listing
          leafletMap.current.fitBounds(
            L.latLngBounds([uLat, uLng], [lat, lng]),
            { padding: [50, 50] }
          );
        }

        setIsLocating(false);
      },
      (err) => {
        toast.error('Could not get your location: ' + err.message);
        setIsLocating(false);
      }
    );
  };

  const handleGetDirections = () => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  return (
    <div className="card" style={{ padding: '32px', marginBottom: '24px' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0 }}>
        <MapPin size={20} /> Location &amp; Map
      </h3>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleGetDirections}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Navigation size={15} /> Get Directions
        </button>
        <button
          className="btn btn-outline btn-sm"
          onClick={handleCalculateDistance}
          disabled={isLocating}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Compass size={15} /> {isLocating ? 'Locating…' : 'Distance from Me'}
        </button>

        {distanceKm !== null && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '6px 12px',
            background: 'var(--primary-light, #EEF7F2)',
            borderRadius: '6px',
            fontWeight: 500,
            color: 'var(--primary)',
            fontSize: '13px',
          }}>
            <MapPin size={13} /> {distanceKm.toFixed(1)} km away
            {durationMin !== null && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
                <Clock size={13} /> ~{durationMin} min drive
              </span>
            )}
          </div>
        )}
      </div>

      <div
        ref={mapRef}
        style={{ width: '100%', height: '360px', borderRadius: '12px', zIndex: 1, border: '1px solid var(--border)' }}
      />
    </div>
  );
}
