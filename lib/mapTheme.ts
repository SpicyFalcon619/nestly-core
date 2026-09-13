export type MapTheme = 'light' | 'dark';

export interface TileConfig {
  url: string;
  attribution: string;
  subdomains: string[];
}

export function getTileConfig(theme: MapTheme): TileConfig {
  if (theme === 'dark') {
    return {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
      subdomains: [],
    };
  }
  return {
    url: 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
  };
}

export function getCurrentMapTheme(): MapTheme {
  if (typeof document === 'undefined') return 'light';
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'dark' || attr === 'light') return attr;
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Calls `cb` whenever the effective theme changes (explicit toggle or OS preference).
export function watchMapTheme(cb: (theme: MapTheme) => void): () => void {
  const observer = new MutationObserver(() => cb(getCurrentMapTheme()));
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const mediaHandler = () => cb(getCurrentMapTheme());
  media.addEventListener('change', mediaHandler);

  return () => {
    observer.disconnect();
    media.removeEventListener('change', mediaHandler);
  };
}
