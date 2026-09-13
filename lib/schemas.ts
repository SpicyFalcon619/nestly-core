import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['student', 'landlord', 'admin']),
  gender: z.enum(['male', 'female', 'other'])
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

export const createListingSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200),
  address: z.string().min(5, 'Address is required'),
  zone_id: z.string().min(1, 'Please select a zone'),
  property_type: z.enum(['single_room', 'shared_room', 'full_mess', 'sublet']),
  listing_type: z.enum(['full_property', 'peer_listing']),
  gender_pref: z.enum(['male', 'female', 'any']),
  total_rooms: z.number().int().min(1, 'Must have at least 1 room'),
  base_rent: z.number().min(500, 'Base rent must be at least 500'),
  description: z.string().optional()
});

export const createItemSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(100),
  category: z.string().min(1, 'Please select a category'),
  item_condition: z.string().min(1, 'Please select a condition'),
  asking_price: z.number().min(0, 'Price cannot be negative'),
  zone_id: z.string().min(1, 'Please select a zone'),
  description: z.string().min(5, 'Please provide a description'),
  listing_id: z.string().optional() // Optional linked flat
});

export const createSeekingSchema = z.object({
  zone_id: z.string().min(1, 'Please select a zone'),
  budget_min: z.number().min(0, 'Budget min cannot be negative'),
  budget_max: z.number().min(1, 'Budget max must be greater than 0'),
  property_type: z.enum(['single_room', 'shared_room', 'full_mess', 'sublet', 'any']),
  preferred_gender: z.enum(['male', 'female', 'any']),
  move_in_date: z.string().optional(),
  requirements: z.string().optional()
}).refine(data => data.budget_max >= data.budget_min, {
  message: "Max budget must be greater than or equal to min budget",
  path: ["budget_max"]
});

export const seekResponseSchema = z.object({
  message: z.string().min(5, 'Message must be at least 5 characters')
});

export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  university_id: z.string().optional()
});

export const updatePreferencesSchema = z.object({
  sleep_schedule: z.enum(['early', 'late', 'flexible'], { message: 'Please select your sleep schedule' }),
  study_hours: z.number().min(0).max(24),
  diet: z.enum(['non_veg', 'vegetarian', 'halal_strict'], { message: 'Please select your dietary habit' }),
  guest_policy: z.enum(['not_allowed', 'restricted', 'allowed'], { message: 'Please select your guest policy' }),
  smoking_tolerance: z.boolean(),
  preferred_gender: z.enum(['male', 'female', 'any'], { message: 'Please select your preferred flatmate gender' }),
  cleanliness_score: z.number().min(1).max(5),
  noise_tolerance: z.enum(['quiet', 'moderate', 'noisy'], { message: 'Please select your noise tolerance' })
});

export const createBillSchema = z.object({
  listing_id: z.string().or(z.number()).optional().nullable(),
  bill_month: z.string().min(1, 'Please provide a month (e.g. June 2024)'),
  electricity: z.number().min(0),
  gas: z.number().min(0),
  water: z.number().min(0),
  internet: z.number().min(0),
  other: z.number().min(0),
  total: z.number().min(0),
  perPerson: z.number().min(0)
});

export const createReviewSchema = z.object({
  listing_id: z.number(),
  value_for_money: z.number().min(1).max(5),
  listing_accuracy: z.number().min(1).max(5),
  landlord_response: z.number().min(1).max(5),
  cleanliness: z.number().min(1).max(5),
  safety: z.number().min(1).max(5),
  comment: z.string().optional()
});
