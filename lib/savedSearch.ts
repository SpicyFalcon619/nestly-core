import type { SupabaseClient } from '@supabase/supabase-js';
import { AMENITY_FILTER_LABELS, PROPERTY_TYPE_LABELS } from '@/lib/data';

// The /listings params that define *what* is being searched for. page and sort
// are deliberately excluded — they change how results are shown, not which.
const SEARCH_KEYS = ['q', 'zone', 'type', 'budget', 'amenities'] as const;
const LIST_KEYS = new Set(['zone', 'amenities']);
export const NO_BUDGET_LIMIT = 50000;

// Mirrors the sanitisation in app/listings/page.tsx.
const cleanQuery = (q: string) => q.replace(/[,()\\"]/g, '').trim();

/**
 * Normalises a /listings query so equivalent searches produce the same string:
 * fixed key order, sorted + de-duplicated list values, and defaults dropped.
 * This string is what's stored, what's compared for "already saved", and what's
 * appended to /listings? to re-run the search.
 */
export function canonicalSearch(input: string | URLSearchParams): string {
  const src = typeof input === 'string' ? new URLSearchParams(input.replace(/^\?/, '')) : input;
  const out = new URLSearchParams();
  for (const key of SEARCH_KEYS) {
    const raw = src.get(key);
    if (!raw) continue;
    let value = key === 'q' ? cleanQuery(raw) : raw.trim();
    if (LIST_KEYS.has(key)) {
      value = [...new Set(value.split(',').map(v => v.trim()).filter(Boolean))].sort().join(',');
    }
    if (key === 'budget' && !(Number(value) > 0 && Number(value) < NO_BUDGET_LIMIT)) continue;
    if (key === 'type' && value === 'any') continue;
    if (value) out.set(key, value);
  }
  return out.toString();
}

export function describeSearch(query: string, zones: { zone_id: number; zone_name: string }[]): string {
  const p = new URLSearchParams(query);
  const parts: string[] = [];
  const q = p.get('q');
  if (q) parts.push(`“${q}”`);
  const zoneIds = (p.get('zone') || '').split(',').filter(Boolean);
  const zoneNames = zoneIds.map(id => zones.find(z => String(z.zone_id) === id)?.zone_name).filter(Boolean);
  if (zoneNames.length) parts.push(zoneNames.join(' / '));
  const type = p.get('type');
  if (type) parts.push(PROPERTY_TYPE_LABELS[type] || type);
  const budget = Number(p.get('budget'));
  if (budget) parts.push(`up to ৳${budget.toLocaleString('en-BD')}`);
  const amenities = (p.get('amenities') || '').split(',').filter(Boolean);
  if (amenities.length) parts.push(amenities.map(a => AMENITY_FILTER_LABELS[a] || a).join(', '));
  return (parts.join(' · ') || 'All listings').slice(0, 200);
}

export interface MatchableListing {
  zone_id: number;
  property_type: string;
  status: string;
  title: string;
  address: string;
  costs?: { total_monthly?: number | string | null } | null;
  amenities?: Record<string, unknown> | null;
}

/** Same semantics as the filters in app/listings/page.tsx — keep the two in step. */
export function listingMatchesSearch(listing: MatchableListing, query: string): boolean {
  const p = new URLSearchParams(query);
  if (listing.status === 'occupied') return false;

  const zones = p.get('zone');
  if (zones && !zones.split(',').includes(String(listing.zone_id))) return false;

  const type = p.get('type');
  if (type && type !== listing.property_type) return false;

  const budget = Number(p.get('budget'));
  if (budget > 0 && budget < NO_BUDGET_LIMIT) {
    // The page inner-joins costs when budget-filtering, so a listing with no
    // cost row never matches a budget search.
    const total = Number(listing.costs?.total_monthly);
    if (!total || total > budget) return false;
  }

  const amenities = p.get('amenities');
  if (amenities) {
    for (const a of amenities.split(',')) {
      if (listing.amenities?.[a] !== true) return false;
    }
  }

  const q = p.get('q');
  if (q && !`${listing.title} ${listing.address}`.toLowerCase().includes(q.toLowerCase())) return false;

  return true;
}

/**
 * True once migration 0006 has been applied. Lets the feature ship before the
 * table exists: until then the UI simply doesn't offer it.
 */
export async function savedSearchesAvailable(supabase: SupabaseClient): Promise<boolean> {
  // Must be a real GET. A `head: true` request has no response body, so for a
  // table that doesn't exist PostgREST's error never reaches supabase-js — it
  // reports `error: null` and this would wrongly return true.
  const { error } = await supabase.from('saved_searches').select('id').limit(1);
  return !error;
}
