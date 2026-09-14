'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, Expand } from 'lucide-react';

export default function PhotoGallery({ photos, title }: { photos: string[]; title: string }) {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  const go = useCallback(
    (dir: number) => setActive(prev => (prev + dir + photos.length) % photos.length),
    [photos.length]
  );

  // Arrow keys navigate whenever the lightbox is open; Escape closes it.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'Escape') setLightbox(false);
    };
    window.addEventListener('keydown', onKey);
    // Don't let the page scroll behind the overlay
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightbox, go]);

  return (
    <div style={{ marginBottom: '32px' }}>
      <div className="gallery-main">
        <img
          src={photos[active]}
          alt={`${title} — photo ${active + 1} of ${photos.length}`}
          onClick={() => setLightbox(true)}
          style={{ cursor: 'zoom-in' }}
        />

        <button
          type="button"
          className="gallery-expand"
          onClick={() => setLightbox(true)}
          aria-label="View full size"
        >
          <Expand size={15} />
        </button>

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
              aria-current={i === active}
            >
              <img src={photo} alt="" />
            </button>
          ))}
        </div>
      )}

      {/* Portalled to <body>: the gallery sits inside sticky/positioned parents,
          so an in-tree overlay gets trapped under the navbar's stacking context. */}
      {lightbox && createPortal(
        <div className="lightbox" onClick={() => setLightbox(false)} role="dialog" aria-modal="true" aria-label={`${title} photos`}>
          <button type="button" className="lightbox-close" onClick={() => setLightbox(false)} aria-label="Close">
            <X size={20} />
          </button>

          <img
            className="lightbox-img"
            src={photos[active]}
            alt={`${title} — photo ${active + 1} of ${photos.length}`}
            onClick={e => e.stopPropagation()}
          />

          {photos.length > 1 && (
            <>
              <button
                type="button"
                className="lightbox-nav lightbox-nav-prev"
                onClick={e => { e.stopPropagation(); go(-1); }}
                aria-label="Previous photo"
              >
                <ChevronLeft size={26} />
              </button>
              <button
                type="button"
                className="lightbox-nav lightbox-nav-next"
                onClick={e => { e.stopPropagation(); go(1); }}
                aria-label="Next photo"
              >
                <ChevronRight size={26} />
              </button>

              <div className="lightbox-strip" onClick={e => e.stopPropagation()}>
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
            </>
          )}

          <span className="lightbox-count">{active + 1} / {photos.length}</span>
        </div>,
        document.body
      )}
    </div>
  );
}
