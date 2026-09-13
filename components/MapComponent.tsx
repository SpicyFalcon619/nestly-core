'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MAP_CENTER, MAP_ZOOM } from '@/lib/data';
import type { Zone, Listing } from '@/types';
import { fmt } from '@/lib/utils';
import { getCurrentMapTheme, getTileConfig, watchMapTheme } from '@/lib/mapTheme';

// Fix default Leaflet icon paths (bundler strips the default URLs)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Green pin for listing markers
const listingIcon = new L.Icon({
  iconUrl:       'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize:      [25, 41],
  iconAnchor:    [12, 41],
  popupAnchor:   [1, -34],
  shadowSize:    [41, 41],
});

interface MapComponentProps {
  zones: Zone[];
  listings?: Listing[];
  selectedZoneId?: number;
  onZoneSelect?: (id: number) => void;
  interactive?: boolean;
}

export default function MapComponent({
  zones,
  listings = [],
  selectedZoneId,
  onZoneSelect,
  interactive = true,
}: MapComponentProps) {
  const mapRef         = useRef<L.Map | null>(null);
  const containerRef   = useRef<HTMLDivElement>(null);
  const polygonLayerRef = useRef<L.LayerGroup | null>(null);
  const pinLayerRef    = useRef<L.LayerGroup | null>(null);
  const tileLayerRef   = useRef<L.TileLayer | null>(null);

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current, {
      zoomControl:     interactive,
      dragging:        interactive,
      scrollWheelZoom: interactive ? 'center' : false,
    }).setView(MAP_CENTER, MAP_ZOOM);

    const tileConfig = getTileConfig(getCurrentMapTheme());
    tileLayerRef.current = L.tileLayer(tileConfig.url, {
      maxZoom:    20,
      subdomains: tileConfig.subdomains,
      attribution: tileConfig.attribution,
    }).addTo(mapRef.current);

    polygonLayerRef.current = L.layerGroup().addTo(mapRef.current);
    pinLayerRef.current     = L.layerGroup().addTo(mapRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Swap tiles on theme change. Kept as its own effect (independent of the
  // map-init guard above) so React StrictMode's dev-mode double-invoke
  // doesn't tear down the only observer without a matching re-subscribe.
  useEffect(() => {
    return watchMapTheme((theme) => {
      if (!mapRef.current) return;
      const cfg = getTileConfig(theme);
      if (tileLayerRef.current) mapRef.current.removeLayer(tileLayerRef.current);
      tileLayerRef.current = L.tileLayer(cfg.url, {
        maxZoom: 20,
        subdomains: cfg.subdomains,
        attribution: cfg.attribution,
      }).addTo(mapRef.current);
    });
  }, []);

  // Redraw zone polygons when zones or selection changes
  useEffect(() => {
    const map          = mapRef.current;
    const polygonGroup = polygonLayerRef.current;
    if (!map || !polygonGroup) return;

    polygonGroup.clearLayers();

    const defaultStyle  = { color: '#1a5c45', weight: 2, fillColor: '#1a5c45', fillOpacity: 0.10 };
    const selectedStyle = { color: '#2e7d5a', weight: 3, fillColor: '#2e7d5a', fillOpacity: 0.30 };

    zones.forEach(zone => {
      if (!zone.polygon) return;
      const isSelected = selectedZoneId === zone.id || selectedZoneId === zone.zone_id;
      const polygon    = L.polygon(zone.polygon as [number, number][], isSelected ? selectedStyle : defaultStyle);

      if (interactive) {
        polygon.bindTooltip(`<b>${zone.name || zone.zone_name}</b>`, { direction: 'top', sticky: true });
        polygon.on('mouseover', () => { if (!isSelected) polygon.setStyle({ fillOpacity: 0.20 }); });
        polygon.on('mouseout',  () => { if (!isSelected) polygon.setStyle({ fillOpacity: 0.10 }); });
        polygon.on('click',     () => { if (onZoneSelect) onZoneSelect(zone.id || zone.zone_id); });
      }

      polygon.addTo(polygonGroup);

      if (isSelected) {
        map.fitBounds(polygon.getBounds(), { padding: [20, 20] });
      }
    });
  }, [zones, selectedZoneId, interactive, onZoneSelect]);

  // Redraw listing pins when listings change
  useEffect(() => {
    const pinGroup = pinLayerRef.current;
    if (!pinGroup) return;

    pinGroup.clearLayers();

    listings.forEach(l => {
      const lat = l.lat ?? (l as any).latitude;
      const lng = l.lng ?? (l as any).longitude;
      if (!lat || !lng) return;

      const id    = l.listing_id ?? l.id;
      const rent  = l.costs?.total_monthly ?? 0;
      const popup = `
        <div style="min-width:160px">
          <strong style="font-size:13px">${l.title}</strong><br/>
          ${rent > 0 ? `<span style="color:#1a5c45;font-weight:600">${fmt(rent)}/mo</span>` : ''}<br/>
          <a href="/listings/${id}" style="color:#1a5c45;font-size:12px;text-decoration:underline">
            View Details →
          </a>
        </div>
      `;

      L.marker([lat, lng], { icon: listingIcon })
        .bindPopup(popup)
        .addTo(pinGroup);
    });
  }, [listings]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />;
}
