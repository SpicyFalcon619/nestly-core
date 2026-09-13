import type { Zone } from '@/types';

// Zone data with polygon boundaries for Leaflet map highlighting
export const zones: Zone[] = [
  {
    zone_id: 1, id: 1,
    zone_name: 'Badda Campus Area', name: 'Badda Campus Area',
    description: 'Immediate surroundings of the Badda university campuses',
    center_lat: 23.7979, center_lng: 90.4497, lat: 23.7979, lng: 90.4497,
    radius_km: 1.5,
    polygon: [[23.8010, 90.4460], [23.8010, 90.4550], [23.7940, 90.4550], [23.7940, 90.4460]],
  },
  {
    zone_id: 2, id: 2,
    zone_name: 'Sayed Nagar', name: 'Sayed Nagar',
    description: 'Residential area close to campus',
    center_lat: 23.7950, center_lng: 90.4440, lat: 23.7950, lng: 90.4440,
    radius_km: 2.0,
    polygon: [[23.7970, 90.4410], [23.7970, 90.4470], [23.7910, 90.4470], [23.7910, 90.4410]],
  },
  {
    zone_id: 3, id: 3,
    zone_name: 'Shatarkul', name: 'Shatarkul',
    description: 'Quiet neighbourhood south of campus',
    center_lat: 23.7910, center_lng: 90.4350, lat: 23.7910, lng: 90.4350,
    radius_km: 2.5,
    polygon: [[23.7920, 90.4320], [23.7920, 90.4400], [23.7880, 90.4400], [23.7880, 90.4320]],
  },
  {
    zone_id: 4, id: 4,
    zone_name: 'Nurer Chala', name: 'Nurer Chala',
    description: 'Bustling commercial and residential area',
    center_lat: 23.8050, center_lng: 90.4380, lat: 23.8050, lng: 90.4380,
    radius_km: 2.0,
    polygon: [[23.8070, 90.4350], [23.8070, 90.4420], [23.8020, 90.4420], [23.8020, 90.4350]],
  },
  {
    zone_id: 5, id: 5,
    zone_name: 'Aftabnagar', name: 'Aftabnagar',
    description: 'Planned residential sector',
    center_lat: 23.7660, center_lng: 90.4340, lat: 23.7660, lng: 90.4340,
    radius_km: 3.0,
    polygon: [[23.7710, 90.4300], [23.7710, 90.4450], [23.7620, 90.4450], [23.7620, 90.4300]],
  },
  {
    zone_id: 6, id: 6,
    zone_name: 'Notun Bazar', name: 'Notun Bazar',
    description: 'Major transit and shopping hub',
    center_lat: 23.7970, center_lng: 90.4220, lat: 23.7970, lng: 90.4220,
    radius_km: 2.5,
    polygon: [[23.7990, 90.4190], [23.7990, 90.4260], [23.7940, 90.4260], [23.7940, 90.4190]],
  },
];

export const MAP_CENTER: [number, number] = [23.7805, 90.4200];
export const MAP_ZOOM = 12;

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  single_room: 'Single Room',
  shared_room: 'Shared Room',
  full_mess: 'Full Mess',
  sublet: 'Sub-let',
  any: 'Any',
};

export const ITEM_CATEGORY_LABELS: Record<string, string> = {
  furniture: 'Furniture',
  appliances: 'Appliances',
  electronics: 'Electronics',
  kitchen: 'Kitchen',
  study: 'Study',
  other: 'Other',
};

export const ITEM_CONDITION_LABELS: Record<string, string> = {
  new: 'New',
  like_new: 'Like New',
  good: 'Good',
  fair: 'Fair',
};

export const SLEEP_SCHEDULE_LABELS: Record<string, string> = {
  early: 'Early Bird (before 11pm)',
  late: 'Night Owl (after 12am)',
  flexible: 'Flexible',
};

export const DIET_LABELS: Record<string, string> = {
  vegetarian: 'Vegetarian',
  non_veg: 'Non-Vegetarian',
  halal_strict: 'Strictly Halal',
};

export const GUEST_LABELS: Record<string, string> = {
  allowed: 'Allowed',
  restricted: 'Restricted (weekends only)',
  not_allowed: 'Not Allowed',
};

export const NOISE_LABELS: Record<string, string> = {
  quiet: 'Quiet',
  moderate: 'Moderate',
  noisy: 'Lively is fine',
};
