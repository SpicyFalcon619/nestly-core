'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function PhotoGallery({ photos, title }: { photos: string[]; title: string }) {
  const [active, setActive] = useState(0);

  const go = (dir: number) => setActive(prev => (prev + dir + photos.length) % photos.length);

  return (
    <div style={{ marginBottom: '32px' }}>
      <div className="gallery-main">
        <img src={photos[active]} alt={`${title} — photo ${active + 1} of ${photos.length}`} />
        {photos.length > 1 && (
          <>
            <button type="button" className="gallery-nav gallery-nav-prev" onClick={() => go(-1)} aria-label="Previous photo">
              <ChevronLeft size={18} />
            </button>
            <button type="button" className="gallery-nav gallery-nav-next" onClick={() => go(1)} aria-label="Next photo">
              <ChevronRight size={18} />
            </button>
            <span className="gallery-count">{active + 1} / {photos.length}</span>
          </>
        )}
      </div>

      {photos.length > 1 && (
        <div className="gallery-thumbs">
          {photos.map((photo, i) => (
            <button
              key={photo + i}
              type="button"
              className={`gallery-thumb ${i === active ? 'active' : ''}`}
              onClick={() => setActive(i)}
              aria-label={`View photo ${i + 1}`}
            >
              <img src={photo} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
