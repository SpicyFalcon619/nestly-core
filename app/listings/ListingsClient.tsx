'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Listing, Zone } from '@/types';
import ListingCard from '@/components/ListingCard';
import MapView from '@/components/MapView';
import CustomSelect from '@/components/CustomSelect';
import CreateListingModal from '@/components/modals/CreateListingModal';
import { LAST_RESULTS_KEY } from '@/components/ListingBreadcrumb';
import { SlidersHorizontal, ChevronDown, MapPin, ChevronLeft, ChevronRight, Search, X, BellPlus, BellRing } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AMENITY_FILTER_LABELS } from '@/lib/data';
import { saveSearch, deleteSavedSearch } from '@/app/actions/savedSearches';

const PROPERTY_TYPES = { single_room: 'Single Room', shared_room: 'Shared Room', full_mess: 'Full Mess', sublet: 'Sub-let' } as const;

const AMENITY_OPTIONS = Object.entries(AMENITY_FILTER_LABELS).map(([key, label]) => ({ key, label }));

const DEFAULT_BUDGET = '50000';

const listParam = (value: string | null) => new Set((value || '').split(',').filter(Boolean));

export default function ListingsClient({
  initialListings,
  mapPins,
  savedSearch,
  zones,
  currentPage,
  totalPages,
  totalCount,
  isLoggedIn,
  isAdmin,
}: {
  initialListings: Listing[];
  mapPins: Listing[];
  savedSearch: { enabled: boolean; id: number | null };
  zones: Zone[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  isLoggedIn: boolean;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Sidebar controls are a draft — they only take effect on "Apply Filters".
  const [zoneIds,     setZoneIds]     = useState<Set<string>>(() => listParam(searchParams.get('zone')));
  const [type,        setType]        = useState(searchParams.get('type')   || '');
  const [budget,      setBudget]      = useState(searchParams.get('budget') || DEFAULT_BUDGET);
  const [sort,        setSort]        = useState(searchParams.get('sort')   || 'newest');
  const [q,           setQ]           = useState(searchParams.get('q')      || '');
  const [amenities,   setAmenities]   = useState<Set<string>>(() => listParam(searchParams.get('amenities')));
  const [mapFocusZone, setMapFocusZone] = useState<number | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [listModalOpen, setListModalOpen] = useState(false);
  const [savingSearch, setSavingSearch] = useState(false);

  // Re-sync the controls when the URL changes underneath us (back/forward, a chip
  // being removed, or a link that carries filters) — otherwise the sidebar shows
  // stale values.
  useEffect(() => {
    setZoneIds(listParam(searchParams.get('zone')));
    setType(searchParams.get('type')     || '');
    setBudget(searchParams.get('budget') || DEFAULT_BUDGET);
    setSort(searchParams.get('sort')     || 'newest');
    setQ(searchParams.get('q')           || '');
    setAmenities(listParam(searchParams.get('amenities')));

    // Lets the listing breadcrumb return to these exact results.
    try {
      const qs = searchParams.toString();
      if (qs) sessionStorage.setItem(LAST_RESULTS_KEY, `?${qs}`);
      else sessionStorage.removeItem(LAST_RESULTS_KEY);
    } catch {
      // storage unavailable
    }
  }, [searchParams]);

  const toggleIn = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) =>
    setter(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const buildQuery = (overrides?: { q?: string }) => {
    const p = new URLSearchParams(searchParams.toString());
    const nextQ = overrides?.q !== undefined ? overrides.q : q;
    if (zoneIds.size > 0) p.set('zone', [...zoneIds].join(',')); else p.delete('zone');
    if (type)    p.set('type',   type);      else p.delete('type');
    if (budget && budget !== DEFAULT_BUDGET) p.set('budget', budget); else p.delete('budget');
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
    setZoneIds(new Set()); setType(''); setBudget(DEFAULT_BUDGET); setSort('newest'); setQ('');
    setAmenities(new Set());
    router.push('/listings');
  };

  const handlePageChange = (newPage: number) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set('page', newPage.toString());
    router.push(`?${p.toString()}`);
  };

  // ── Active-filter chips ──────────────────────────────────────────
  // Built from the URL (what's actually applied), not from the sidebar draft.
  const removeFromUrl = (key: string, value?: string) => {
    const p = new URLSearchParams(searchParams.toString());
    if (value !== undefined) {
      const rest = [...listParam(p.get(key))].filter(v => v !== value);
      if (rest.length) p.set(key, rest.join(',')); else p.delete(key);
    } else {
      p.delete(key);
    }
    p.set('page', '1');
    router.push(`?${p.toString()}`);
  };

  const chips: { label: string; onRemove: () => void }[] = [];
  const appliedQ = searchParams.get('q');
  if (appliedQ) chips.push({ label: `“${appliedQ}”`, onRemove: () => removeFromUrl('q') });
  for (const id of listParam(searchParams.get('zone'))) {
    const zone = zones.find(z => z.zone_id.toString() === id);
    if (zone) chips.push({ label: zone.zone_name, onRemove: () => removeFromUrl('zone', id) });
  }
  const appliedType = searchParams.get('type') as keyof typeof PROPERTY_TYPES | null;
  if (appliedType && PROPERTY_TYPES[appliedType]) {
    chips.push({ label: PROPERTY_TYPES[appliedType], onRemove: () => removeFromUrl('type') });
  }
  const appliedBudget = searchParams.get('budget');
  if (appliedBudget && appliedBudget !== DEFAULT_BUDGET) {
    chips.push({ label: `Up to ৳${parseInt(appliedBudget).toLocaleString()}`, onRemove: () => removeFromUrl('budget') });
  }
  for (const key of listParam(searchParams.get('amenities'))) {
    const opt = AMENITY_OPTIONS.find(a => a.key === key);
    if (opt) chips.push({ label: opt.label, onRemove: () => removeFromUrl('amenities', key) });
  }

  const toggleSavedSearch = async () => {
    setSavingSearch(true);
    const res = savedSearch.id
      ? await deleteSavedSearch(savedSearch.id)
      : await saveSearch(searchParams.toString());
    setSavingSearch(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success(savedSearch.id
      ? 'Saved search removed.'
      : "Search saved — you'll be notified when a new listing matches.");
    router.refresh();
  };

  const focusZoneOnMap = (zoneId: number) => {
    setMapFocusZone(zoneId);
    document.getElementById('map')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const appliedZoneIds = [...listParam(searchParams.get('zone'))];

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
          <h4>Zones</h4>
          <div id="zoneFilters">
            {zones.map(z => (
              <div key={z.zone_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ margin: 0 }}>
                  <input
                    type="checkbox"
                    className="zone"
                    value={z.zone_id}
                    checked={zoneIds.has(z.zone_id.toString())}
                    onChange={() => toggleIn(setZoneIds, z.zone_id.toString())}
                  /> {z.zone_name}
                </label>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ padding: '2px 6px', border: 'none' }}
                  onClick={() => focusZoneOnMap(z.zone_id)}
                  title={`Show ${z.zone_name} on the map`}
                  aria-label={`Show ${z.zone_name} on the map`}
                >
                  <MapPin style={{ width: '14px', height: '14px', color: 'var(--primary)' }} />
                </button>
              </div>
            ))}
          </div>

          <h4>Property Type</h4>
          {(Object.keys(PROPERTY_TYPES) as (keyof typeof PROPERTY_TYPES)[]).map(val => (
            <label key={val}>
              <input type="checkbox" value={val} checked={type === val} onChange={() => setType(type === val ? '' : val)} />{' '}
              {PROPERTY_TYPES[val]}
            </label>
          ))}

          <h4>Max Monthly Cost: <span style={{ color: 'var(--primary)', fontWeight: 600 }}>৳{parseInt(budget).toLocaleString()}</span></h4>
          <input type="range" min="1000" max="50000" step="500" value={budget} onChange={e => setBudget(e.target.value)} />

          <h4>Amenities</h4>
          {AMENITY_OPTIONS.map(({ key, label }) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={amenities.has(key)}
                onChange={() => toggleIn(setAmenities, key)}
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

          <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--gray)', fontSize: '14px' }}>
              {totalCount} listing{totalCount !== 1 ? 's' : ''} found
              {totalPages > 1 && ` — page ${currentPage} of ${totalPages}`}
            </span>
            {savedSearch.enabled && chips.length > 0 && !isAdmin && (
              isLoggedIn ? (
                <button
                  type="button"
                  className={`btn btn-sm ${savedSearch.id ? 'btn-primary' : 'btn-outline'}`}
                  onClick={toggleSavedSearch}
                  disabled={savingSearch}
                  title={savedSearch.id ? 'Stop alerts for this search' : 'Get notified when a new listing matches'}
                >
                  {savedSearch.id ? <BellRing size={15} /> : <BellPlus size={15} />}
                  {savedSearch.id ? 'Alerts on' : 'Save search'}
                </button>
              ) : (
                <Link href="/login" className="btn btn-outline btn-sm"><BellPlus size={15} /> Save search</Link>
              )
            )}
          </div>

          {chips.length > 0 && (
            <div className="filter-chips" aria-label="Active filters">
              {chips.map(chip => (
                <button key={chip.label} type="button" className="filter-chip" onClick={chip.onRemove} aria-label={`Remove filter: ${chip.label}`}>
                  {chip.label}
                  <X size={13} />
                </button>
              ))}
              {chips.length > 1 && (
                <button type="button" className="filter-chip-clear" onClick={resetFilters}>Clear all</button>
              )}
            </div>
          )}

          <div className="grid-2" id="listingsGrid">
            {initialListings.length === 0 ? (
              <p style={{ color: 'var(--gray)', gridColumn: '1/-1', textAlign: 'center', padding: '40px 0' }}>
                No listings match your filters.
                {chips.length > 0 && <> <button type="button" className="link-button" onClick={resetFilters}>Clear filters</button></>}
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

          {/* Map — every matching listing is pinned, not just this page */}
          <div id="map" style={{ marginTop: '40px' }}>
            <MapView
              zones={zones}
              listings={mapPins}
              selectedZoneId={mapFocusZone ?? (appliedZoneIds.length === 1 ? parseInt(appliedZoneIds[0]) : undefined)}
              onZoneSelect={id => toggleIn(setZoneIds, id.toString())}
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
