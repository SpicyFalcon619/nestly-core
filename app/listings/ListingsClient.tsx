'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Listing, Zone } from '@/types';
import ListingCard from '@/components/ListingCard';
import MapView from '@/components/MapView';
import CustomSelect from '@/components/CustomSelect';
import CreateListingModal from '@/components/modals/CreateListingModal';
import { SlidersHorizontal, ChevronDown, MapPin, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';

export default function ListingsClient({
  initialListings,
  zones,
  currentPage,
  totalPages,
  totalCount,
  isLoggedIn,
  isAdmin,
}: {
  initialListings: Listing[];
  zones: Zone[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  isLoggedIn: boolean;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [zoneId,      setZoneId]      = useState(searchParams.get('zone')      || '');
  const [type,        setType]        = useState(searchParams.get('type')       || '');
  const [budget,      setBudget]      = useState(searchParams.get('budget')     || '50000');
  const [sort,        setSort]        = useState(searchParams.get('sort')       || 'newest');
  const [q,           setQ]           = useState(searchParams.get('q')          || '');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [listModalOpen, setListModalOpen] = useState(false);

  // Amenities — stored as a Set for easy toggling
  const initAmenities = (): Set<string> => {
    const raw = searchParams.get('amenities');
    return raw ? new Set(raw.split(',').filter(Boolean)) : new Set();
  };
  const [amenities, setAmenities] = useState<Set<string>>(initAmenities);

  // Re-sync the controls when the URL changes underneath us (back/forward, or a
  // link that carries filters) — otherwise the sidebar shows stale values.
  useEffect(() => {
    setZoneId(searchParams.get('zone')   || '');
    setType(searchParams.get('type')     || '');
    setBudget(searchParams.get('budget') || '50000');
    setSort(searchParams.get('sort')     || 'newest');
    setQ(searchParams.get('q')           || '');
    const raw = searchParams.get('amenities');
    setAmenities(raw ? new Set(raw.split(',').filter(Boolean)) : new Set());
  }, [searchParams]);

  const toggleAmenity = (key: string) => {
    setAmenities(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const buildQuery = (overrides?: { q?: string }) => {
    const p = new URLSearchParams(searchParams.toString());
    const nextQ = overrides?.q !== undefined ? overrides.q : q;
    if (zoneId)  p.set('zone',   zoneId);   else p.delete('zone');
    if (type)    p.set('type',   type);      else p.delete('type');
    if (budget && budget !== '50000') p.set('budget', budget); else p.delete('budget');
    if (sort && sort !== 'newest')    p.set('sort',   sort);   else p.delete('sort');
    if (nextQ.trim()) p.set('q', nextQ.trim()); else p.delete('q');
    if (amenities.size > 0) p.set('amenities', [...amenities].join(',')); else p.delete('amenities');
    p.set('page', '1');
    return p;
  };

  const applyFilters = () => router.push(`?${buildQuery().toString()}`);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`?${buildQuery().toString()}`);
  };

  const clearSearch = () => {
    setQ('');
    router.push(`?${buildQuery({ q: '' }).toString()}`);
  };

  const resetFilters = () => {
    setZoneId(''); setType(''); setBudget('50000'); setSort('newest'); setQ('');
    setAmenities(new Set());
    router.push('/listings');
  };

  const handlePageChange = (newPage: number) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set('page', newPage.toString());
    router.push(`?${p.toString()}`);
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Browse Listings</h1>
        {isLoggedIn && !isAdmin && (
          <button className="btn btn-primary" onClick={() => setListModalOpen(true)}>+ Create Listing</button>
        )}
      </div>

      <div className="listings-layout">
        <button
          className={`mobile-filter-btn ${sidebarOpen ? 'active' : ''}`}
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-expanded={sidebarOpen}
        >
          <SlidersHorizontal style={{ width: '16px', height: '16px' }} />
          <span>Filters &amp; Sort</span>
          <ChevronDown className="filter-chevron" style={{ width: '16px', height: '16px', marginLeft: 'auto', transition: 'transform 0.3s ease', transform: sidebarOpen ? 'rotate(180deg)' : 'none' }} />
        </button>

        <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
          <h4>Zone</h4>
          <div id="zoneFilters">
            {zones.map(z => (
              <div key={z.zone_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ margin: 0 }}>
                  <input
                    type="checkbox"
                    className="zone"
                    value={z.zone_id}
                    checked={zoneId === z.zone_id.toString()}
                    onChange={() => setZoneId(zoneId === z.zone_id.toString() ? '' : z.zone_id.toString())}
                  /> {z.zone_name}
                </label>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ padding: '2px 6px', border: 'none' }}
                  onClick={() => setZoneId(z.zone_id.toString())}
                  title="Show on Map"
                >
                  <MapPin style={{ width: '14px', height: '14px', color: 'var(--primary)' }} />
                </button>
              </div>
            ))}
          </div>

          <h4>Property Type</h4>
          {(['single_room', 'shared_room', 'full_mess', 'sublet'] as const).map(val => (
            <label key={val}>
              <input type="checkbox" value={val} checked={type === val} onChange={() => setType(type === val ? '' : val)} />{' '}
              {{ single_room: 'Single Room', shared_room: 'Shared Room', full_mess: 'Full Mess', sublet: 'Sub-let' }[val]}
            </label>
          ))}

          <h4>Max Monthly Cost: <span style={{ color: 'var(--primary)', fontWeight: 600 }}>৳{parseInt(budget).toLocaleString()}</span></h4>
          <input type="range" min="1000" max="50000" step="500" value={budget} onChange={e => setBudget(e.target.value)} />

          <h4>Amenities</h4>
          {[
            { key: 'attached_bathroom', label: 'Attached Bathroom' },
            { key: 'attached_kitchen',  label: 'Kitchen' },
            { key: 'is_furnished',      label: 'Furnished' },
            { key: 'rooftop_access',    label: 'Rooftop' },
            { key: 'parking',           label: 'Parking' },
            { key: 'power_backup',      label: 'Power Backup' },
            { key: 'lift_access',       label: 'Lift' },
          ].map(({ key, label }) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={amenities.has(key)}
                onChange={() => toggleAmenity(key)}
              /> {label}
            </label>
          ))}

          <h4>Sort By</h4>
          <CustomSelect
            name="sort"
            value={sort}
            onChange={val => setSort(val)}
            options={[
              { value: 'newest',    label: 'Newest' },
              { value: 'cost_asc',  label: 'Total Cost ↑' },
              { value: 'cost_desc', label: 'Total Cost ↓' },
            ]}
          />

          <div style={{ marginTop: '18px', display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary btn-sm" onClick={applyFilters}>Apply Filters</button>
            <button className="btn btn-outline btn-sm" onClick={resetFilters}>Reset</button>
          </div>
        </aside>

        <main>
          <form onSubmit={submitSearch} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-muted)', pointerEvents: 'none' }} />
              <input
                type="search"
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search by title or address…"
                aria-label="Search listings"
                style={{ paddingLeft: '40px', paddingRight: q ? '40px' : '14px' }}
              />
              {q && (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Clear search"
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', display: 'flex', padding: 4 }}
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <button type="submit" className="btn btn-primary">Search</button>
          </form>

          <div style={{ marginBottom: '12px', color: 'var(--gray)', fontSize: '14px' }}>
            {totalCount} listing{totalCount !== 1 ? 's' : ''} found
            {totalPages > 1 && ` — page ${currentPage} of ${totalPages}`}
          </div>

          <div className="grid-2" id="listingsGrid">
            {initialListings.length === 0 ? (
              <p style={{ color: 'var(--gray)', gridColumn: '1/-1', textAlign: 'center', padding: '40px 0' }}>
                No listings match your filters.
              </p>
            ) : (
              initialListings.map(l => <ListingCard key={l.listing_id || l.id} listing={l} />)
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '32px', alignItems: 'center' }}>
              <button className="btn btn-outline btn-sm" disabled={currentPage <= 1} onClick={() => handlePageChange(currentPage - 1)}>
                <ChevronLeft size={16} /> Prev
              </button>
              <span style={{ fontSize: '14px', fontWeight: 500 }}>Page {currentPage} of {totalPages}</span>
              <button className="btn btn-outline btn-sm" disabled={currentPage >= totalPages} onClick={() => handlePageChange(currentPage + 1)}>
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Map — passes listings so individual pins are shown */}
          <div id="map" style={{ marginTop: '40px' }}>
            <MapView
              zones={zones}
              listings={initialListings}
              selectedZoneId={zoneId ? parseInt(zoneId) : undefined}
              onZoneSelect={id => setZoneId(id.toString())}
            />
          </div>
        </main>
      </div>

      <CreateListingModal
        isOpen={listModalOpen}
        onClose={() => setListModalOpen(false)}
        onSuccess={() => setListModalOpen(false)}
      />
    </div>
  );
}
