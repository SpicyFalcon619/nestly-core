// Shared utility functions

export function fmt(val: number | string): string {
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return '৳' + n.toLocaleString('en-BD');
}

export function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  } catch {
    return iso;
  }
}

export function fmtMonthYear(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

// One shared badge for every status column in the app (applications, offers,
// listings, items, seeking posts, verifications, complaints) — which is
// exactly why it kept going blank: each new caller added its own enum's
// values here piecemeal, but this only ever covered the first two or three
// callers. Every value below is copied straight from the real Postgres enum
// in supabase/migrations/0000_initial_schema.sql, not guessed, so a blank
// badge here now means a genuinely new status, not a missed case.
export function statusBadge(s: string): string {
  if (s === 'pending' || s === 'submitted' || s === 'active') return '<span class="badge badge-amber">Pending</span>';
  if (s === 'under_review') return '<span class="badge badge-amber">Under Review</span>';
  if (s === 'accepted' || s === 'fulfilled' || s === 'approved' || s === 'available' || s === 'resolved') {
    return `<span class="badge badge-success">${s === 'available' ? 'Available' : s === 'resolved' ? 'Resolved' : s === 'approved' ? 'Approved' : 'Accepted'}</span>`;
  }
  if (s === 'rejected') return '<span class="badge badge-danger">Rejected</span>';
  if (s === 'occupied' || s === 'sold') return `<span class="badge badge-danger">${s === 'sold' ? 'Sold' : 'Occupied'}</span>`;
  if (s === 'soon_vacant') return '<span class="badge badge-amber">Soon Vacant</span>';
  if (s === 'countered') return '<span class="badge badge-amber">Countered</span>';
  if (s === 'withdrawn') return '<span class="badge badge-gray">Withdrawn</span>';
  return '';
}


export function calcCompatScore(
  userPrefs: {
    sleep?: string; diet?: string; guest?: string;
    smoking?: number | boolean; noise?: string; cleanliness?: number;
  },
  listing: {
    sleep?: string; diet?: string; guest?: string;
    smoking?: number | boolean; noise?: string; cleanliness?: number;
  }
): number {
  if (!userPrefs || !listing) return 0;
  let score = 0;
  let total = 0;

  const check = (a: unknown, b: unknown) => {
    total++;
    if (a === b) score++;
  };

  if (listing.sleep) check(userPrefs.sleep, listing.sleep);
  if (listing.diet) check(userPrefs.diet, listing.diet);
  if (listing.guest) check(userPrefs.guest, listing.guest);
  if (listing.noise) check(userPrefs.noise, listing.noise);
  if (listing.smoking !== undefined) {
    total++;
    if (Number(userPrefs.smoking) === Number(listing.smoking)) score++;
  }
  if (listing.cleanliness !== undefined && userPrefs.cleanliness !== undefined) {
    total++;
    if (Math.abs(Number(userPrefs.cleanliness) - Number(listing.cleanliness)) <= 1) score++;
  }

  return total > 0 ? Math.round((score / total) * 100) : 0;
}

export function compatColor(pct: number): string {
  if (pct >= 80) return '#1a5c45';
  if (pct >= 60) return '#2a7a5f';
  if (pct >= 40) return '#e6a817';
  return '#be3d2f';
}

export function placeholderPhoto(): string {
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="%23e2e8f0"/><text x="50%" y="50%" font-family="sans-serif" font-size="20" fill="%2394a3b8" text-anchor="middle" dominant-baseline="middle">No Photo Available</text></svg>`;
}

export function listingTypeLabel(type: string): string {
  return type === 'full_property' ? 'Landlord Listed' : 'Student Listed';
}

export function propertyTypeLabel(type: string): string {
  const map: Record<string, string> = {
    single_room: 'Single Room',
    shared_room: 'Shared Room',
    full_mess: 'Full Mess',
    sublet: 'Sub-let',
  };
  return map[type] || type;
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    available: 'Available',
    occupied: 'Occupied',
    soon_vacant: 'Soon Vacant',
  };
  return map[status] || status;
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    available: 'badge-green',
    occupied: 'badge-red',
    soon_vacant: 'badge-blue',
  };
  return map[status] || '';
}

export function conditionLabel(c: string): string {
  const label: Record<string, string> = { new: 'New', like_new: 'Like New', good: 'Good', fair: 'Fair' };
  return label[c] || c;
}

export function conditionColor(c: string): string {
  const m: Record<string, string> = { new: 'badge-green', like_new: 'badge-blue', good: 'badge-amber', fair: 'badge-gray' };
  return m[c] || 'badge-gray';
}

export function avatarInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

/**
 * Generates a unique, URL-safe profile slug from a display name and UUID.
 * Example: ("Ahmad Maruf", "a1b2c3d4-...") → "ahmad-maruf-a1b2"
 * Mirrors the SQL generate_profile_slug() function so they stay in sync.
 */
export function generateProfileSlug(name: string, id: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const suffix = id.replace(/-/g, '').substring(0, 4);
  return `${base}-${suffix}`;
}
