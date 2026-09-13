'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, MapPin, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import { getCurrentMapTheme, getTileConfig, watchMapTheme } from '@/lib/mapTheme';

// Fix leaflet icon paths in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface MapPickerProps {
  initialLat?: number;
  initialLng?: number;
  onLocationChange: (lat: number, lng: number) => void;
  zonePolygon?: [number, number][];
}

export default function MapPicker({ initialLat = 23.7979, initialLng = 90.4497, onLocationChange, zonePolygon }: MapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const polygonLayer = useRef<L.Polygon | null>(null);
  const tileLayer = useRef<L.TileLayer | null>(null);

  const [latInput, setLatInput] = useState(initialLat.toString());
  const [lngInput, setLngInput] = useState(initialLng.toString());
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;

    if (!leafletMap.current) {
      leafletMap.current = L.map(mapRef.current).setView([initialLat, initialLng], 14);

      const tileConfig = getTileConfig(getCurrentMapTheme());
      tileLayer.current = L.tileLayer(tileConfig.url, {
        maxZoom: 20,
        subdomains: tileConfig.subdomains,
        attribution: tileConfig.attribution
      }).addTo(leafletMap.current);

      marker.current = L.marker([initialLat, initialLng], { draggable: true }).addTo(leafletMap.current);

      marker.current.on('dragend', () => {
        const pos = marker.current?.getLatLng();
        if (pos) {
          updateInputsAndNotify(pos.lat, pos.lng);
        }
      });

      leafletMap.current.on('click', (e: L.LeafletMouseEvent) => {
        updateMarker(e.latlng.lat, e.latlng.lng);
      });
    }

    // Handle zone polygon updates
    if (leafletMap.current) {
      if (polygonLayer.current) {
        leafletMap.current.removeLayer(polygonLayer.current);
      }

      if (zonePolygon && zonePolygon.length > 0) {
        polygonLayer.current = L.polygon(zonePolygon, {
          color: 'var(--primary)',
          fillColor: 'var(--primary)',
          fillOpacity: 0.15,
          weight: 2
        }).addTo(leafletMap.current);

        leafletMap.current.fitBounds(polygonLayer.current.getBounds(), { padding: [20, 20] });
      }
      
      // Invalidate size to prevent grey boxes when rendered inside a modal
      setTimeout(() => {
        leafletMap.current?.invalidateSize();
      }, 100);
      setTimeout(() => {
        leafletMap.current?.invalidateSize();
      }, 500);
    }

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update polygon if it changes after mount
  useEffect(() => {
    if (leafletMap.current && zonePolygon && zonePolygon.length > 0) {
      if (polygonLayer.current) {
        leafletMap.current.removeLayer(polygonLayer.current);
      }
      polygonLayer.current = L.polygon(zonePolygon, {
        color: 'var(--primary)',
        fillColor: 'var(--primary)',
        fillOpacity: 0.15,
        weight: 2
      }).addTo(leafletMap.current);
      leafletMap.current.fitBounds(polygonLayer.current.getBounds(), { padding: [20, 20] });
    }
  }, [zonePolygon]);

  const updateInputsAndNotify = (lat: number, lng: number) => {
    setLatInput(lat.toFixed(6));
    setLngInput(lng.toFixed(6));
    onLocationChange(lat, lng);
  };

  const updateMarker = (lat: number, lng: number) => {
    if (marker.current && leafletMap.current) {
      const newLatLng = new L.LatLng(lat, lng);
      marker.current.setLatLng(newLatLng);
      leafletMap.current.setView(newLatLng, 15);
      updateInputsAndNotify(lat, lng);
    }
  };

  const handleManualCoordinateChange = () => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (!isNaN(lat) && !isNaN(lng)) {
      updateMarker(lat, lng);
    }
  };

  const handleGeolocation = () => {
    if ('geolocation' in navigator) {
      toast.info('Fetching your location...');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          updateMarker(latitude, longitude);
          toast.success('Location found!');
        },
        (error) => {
          toast.error('Unable to retrieve your location. ' + error.message);
        }
      );
    } else {
      toast.error('Geolocation is not supported by your browser.');
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        updateMarker(lat, lng);
      } else {
        toast.error('Location not found. Try a different search term.');
      }
    } catch (error) {
      toast.error('Search failed. Please try again later.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', flex: '1', minWidth: '250px' }}>
          <div style={{ position: 'relative', flex: '1' }}>
            <MapPin size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--gray)' }} />
            <input 
              type="text" 
              placeholder="Search a location..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '8px 8px 8px 32px', borderRadius: '6px', border: '1px solid var(--border)' }}
            />
          </div>
          <button type="submit" className="btn btn-outline btn-sm" disabled={isSearching}>
            {isSearching ? '...' : <Search size={16} />}
          </button>
        </form>

        <button type="button" className="btn btn-outline btn-sm" onClick={handleGeolocation} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Navigation size={16} /> Use My Location
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '12px', color: 'var(--gray)' }}>Latitude</label>
          <input 
            type="number" 
            step="any"
            value={latInput}
            onChange={(e) => setLatInput(e.target.value)}
            onBlur={handleManualCoordinateChange}
            onKeyDown={(e) => e.key === 'Enter' && handleManualCoordinateChange()}
            style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '13px' }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '12px', color: 'var(--gray)' }}>Longitude</label>
          <input 
            type="number" 
            step="any"
            value={lngInput}
            onChange={(e) => setLngInput(e.target.value)}
            onBlur={handleManualCoordinateChange}
            onKeyDown={(e) => e.key === 'Enter' && handleManualCoordinateChange()}
            style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '13px' }}
          />
        </div>
      </div>

      <div ref={mapRef} style={{ width: '100%', height: '300px', borderRadius: '8px', zIndex: 1, border: '1px solid var(--border)' }} />
      <div style={{ fontSize: '12px', color: 'var(--gray)', textAlign: 'right' }}>
        Click or drag the marker to adjust the exact location.
      </div>
    </div>
  );
}
