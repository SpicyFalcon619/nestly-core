// TypeScript types for all Nestly entities

export type UserRole = 'student' | 'landlord' | 'admin';
export type UserGender = 'male' | 'female' | 'other';
export type UserStatus = 'active' | 'suspended';

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  gender: UserGender;
  phone?: string;
  university_id?: string;
  profile_pic?: string;
  bio?: string;
  is_public?: boolean;
  profile_slug?: string;
  status: UserStatus;
  created_at: string;
}

export interface Conversation {
  id: string;
  participant_a: string;
  participant_b: string;
  listing_id?: number | null;
  item_id?: number | null;
  created_at: string;
  // Joined
  other_user?: { name: string; profile_pic?: string; profile_slug?: string };
  last_message?: Message;
  unread_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  is_read: boolean;
  created_at: string;
  // Joined
  sender?: { name: string; profile_pic?: string };
}

export type PropertyType = 'single_room' | 'shared_room' | 'full_mess' | 'sublet';
export type ListingType = 'full_property' | 'peer_listing';
export type ListingStatus = 'available' | 'occupied' | 'soon_vacant';
export type GenderPref = 'male' | 'female' | 'any';

export interface UtilityCosts {
  cost_id?: number;
  listing_id?: number;
  base_rent: number;
  electricity_amount: number;
  electricity_type: 'individual' | 'shared';
  gas_bill: number;
  water_bill: number;
  internet_cost: number;
  maintenance_fee: number;
  caretaker_fee: number;
  other_fees: number;
  total_monthly: number;
}

export interface ListingAmenities {
  attached_bathroom: boolean;
  attached_kitchen: boolean;
  is_furnished: boolean;
  rooftop_access: boolean;
  parking: boolean;
  power_backup: boolean;
  lift_access: boolean;
}

export interface Review {
  review_id: number;
  listing_id: number;
  reviewer_id: string;
  reviewer_name?: string;
  value_for_money: number;
  listing_accuracy: number;
  landlord_response: number;
  cleanliness: number;
  safety: number;
  composite_score: number;
  comment?: string;
  created_at: string;
}

export interface Listing {
  id: number;
  listing_id?: number;
  user_id: string;
  zone_id: number;
  zone?: string;
  listing_type: ListingType;
  property_type: PropertyType;
  title: string;
  address: string;
  lat: number;
  lng: number;
  gender_pref: GenderPref;
  total_rooms: number;
  current_occupancy: number;
  status: ListingStatus;
  is_verified: boolean;
  description?: string;
  photos?: string[];
  created_at: string;
  updated_at?: string;
  // Joined fields
  owner_name?: string;
  owner_email?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerId?: string;
  costs?: UtilityCosts | null;
  amenities?: ListingAmenities | null;
  reviews?: Review[];
  composite_score?: number;
  compositeScore?: number;
  review_count?: number;
  reviewCount?: number;
  listingType?: string;
  // Preference fields from owner
  sleep?: string;
  diet?: string;
  guest?: string;
  smoking?: number;
  noise?: string;
  cleanliness?: number;
}

export interface Zone {
  zone_id: number;
  id: number;
  zone_name: string;
  name?: string;
  description?: string;
  center_lat: number;
  center_lng: number;
  lat?: number;
  lng?: number;
  radius_km: number;
  polygon?: [number, number][];
}

export interface Item {
  item_id: number;
  seller_id: string;
  zone_id: number;
  listing_id?: number;
  category: string;
  title: string;
  description?: string;
  item_condition: string;
  asking_price: number;
  reason_for_selling?: string;
  photo_url?: string;
  photos?: string[];
  status: 'available' | 'sold' | 'withdrawn';
  created_at: string;
  // Joined
  seller?: string;
  seller_name?: string;
  seller_email?: string;
  seller_phone?: string;
  zone?: string;
}

export interface Offer {
  offer_id: number;
  item_id: number;
  buyer_id: string;
  offer_price: number;
  message?: string;
  status: 'pending' | 'countered' | 'accepted' | 'rejected' | 'withdrawn';
  counter_price?: number;
  created_at: string;
  updated_at: string;
  // Joined
  title?: string;
  buyer_name?: string;
  buyer_email?: string;
  buyer_phone?: string;
  seller_name?: string;
  seller_email?: string;
  seller_phone?: string;
}

export interface Application {
  application_id: number;
  listing_id: number;
  applicant_id: string;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  // Joined
  listing_title?: string;
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string;
  applicant_name?: string;
  applicant_email?: string;
  applicant_phone?: string;
}

export interface SeekingPost {
  post_id: number;
  id?: number;
  user_id: string;
  zone_id: number;
  zone?: string;
  budget_min: number;
  budget_max: number;
  property_type: string;
  preferred_gender: GenderPref;
  move_in_date?: string;
  requirements?: string;
  status: 'active' | 'fulfilled';
  created_at: string;
  // Joined
  user_name?: string;
  user?: string;
  user_gender?: UserGender;
}

export interface SeekingResponse {
  response_id: number;
  post_id: number;
  responder_id: string;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  // Joined
  responder_name?: string;
  responder_email?: string;
  responder_phone?: string;
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string;
  requirements?: string;
}

export interface Notification {
  notif_id: number;
  user_id: string;
  type: string;
  message: string;
  is_read: boolean;
  link?: string;
  created_at: string;
}

export interface BillPayment {
  id: number;
  payment_id?: number;
  bill_id: number;
  resident?: string;
  resident_label?: string;
  resident_user_id?: string;
  status: 'paid' | 'unpaid';
  paid_at?: string;
}

export interface MonthlyBill {
  id: number;
  bill_id?: number;
  listing_id: number;
  month: string;
  bill_month?: string;
  electricity: number;
  gas: number;
  water: number;
  internet: number;
  other: number;
  customFees?: { name: string; amount: number }[];
  total: number;
  perPerson: number;
  payments: BillPayment[];
}

export interface UserPreferences {
  pref_id?: number;
  user_id: string;
  sleep_schedule: string;
  study_hours: number;
  diet: string;
  guest_policy: string;
  smoking_tolerance: boolean;
  preferred_gender: GenderPref;
  cleanliness_score: number;
  noise_tolerance: string;
}

export interface Verification {
  verification_id: number;
  user_id: string;
  nid_type: string;
  document_path: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
}

export interface Complaint {
  complaint_id: number;
  complainant_id: string;
  against_user_id: string;
  listing_id?: number;
  category: string;
  description: string;
  status: string;
  document_path?: string;
  created_at: string;
  // Joined for admin
  userEmail?: string;
  listingTitle?: string;
}

export interface DashboardData {
  myListings: Listing[];
  myItems: Item[];
  watched: Listing[];
  offersSent: Offer[];
  offersRecv: Offer[];
  appsSent: Application[];
  appsRecv: Application[];
  mySeeking: SeekingPost[];
  seekRespSent: SeekingResponse[];
  seekRespRecv: SeekingResponse[];
  hasPreferences: boolean;
  verifStatus: string;
  notifications?: any[];
  activity?: import('@/lib/activity').ActivityItem[];
}

export interface AdminStats {
  totalListings: number;
  totalUsers: number;
  openComplaints: number;
  avgRentByZone: { zone: string; avg: number }[];
  seekingVsListings: { zone: string; seeking: number; listings: number }[];
}
