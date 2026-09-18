import type { UserPreferences } from '@/types';

/**
 * Flatmate compatibility — the "8-dimension score" the marketing copy promises.
 *
 * Both sides are `user_preferences` rows (see migration 0000). A listing's own
 * `gender_pref` overrides the lister's personal preference for that one
 * dimension, since the household rule is what actually applies to a viewer.
 *
 * Every dimension returns 0–1 and carries its own weight; the headline score is
 * their weighted sum, 0–100. Dimensions are never silently dropped — a missing
 * preferences row means no score at all rather than a partial one, so a number
 * on screen always compares two complete profiles.
 */

export interface CompatDimension {
  key: string;
  label: string;
  /** 0–1 */
  score: number;
  /** What each side answered, already humanised. */
  mine: string;
  theirs: string;
}

export interface CompatResult {
  /** 0–100 */
  score: number;
  dimensions: CompatDimension[];
}

const SLEEP: Record<string, string> = {
  early: 'Early bird',
  late: 'Night owl',
  flexible: 'Flexible',
};
const DIET: Record<string, string> = {
  vegetarian: 'Vegetarian',
  non_veg: 'No restrictions',
  halal_strict: 'Strict halal',
};
const GUESTS: Record<string, string> = {
  allowed: 'Guests welcome',
  restricted: 'Weekends only',
  not_allowed: 'No guests',
};
const NOISE: Record<string, string> = {
  quiet: 'Needs quiet',
  moderate: 'Moderate',
  noisy: 'Lively',
};
const GENDER: Record<string, string> = {
  male: 'Male only',
  female: 'Female only',
  any: 'Any gender',
};

const label = (map: Record<string, string>, v: string | undefined) => map[v ?? ''] ?? '—';

/** Ordered scales: neighbours are a near-match, opposite ends are a clash. */
function scaleScore(order: string[], a: string, b: string): number {
  const i = order.indexOf(a), j = order.indexOf(b);
  if (i < 0 || j < 0) return 0.5;
  const gap = Math.abs(i - j);
  return gap === 0 ? 1 : gap === 1 ? 0.55 : 0.15;
}

export function scoreCompatibility(
  mine: UserPreferences,
  theirs: UserPreferences,
  /** The listing's household rule, when the score is about a listing. */
  listingGenderPref?: string,
): CompatResult {
  const theirGender = listingGenderPref ?? theirs.preferred_gender;

  // A shared "flexible" answer shouldn't read as a perfect match — it means
  // neither side has a constraint, not that they want the same thing.
  const sleepScore =
    mine.sleep_schedule === theirs.sleep_schedule
      ? (mine.sleep_schedule === 'flexible' ? 0.85 : 1)
      : (mine.sleep_schedule === 'flexible' || theirs.sleep_schedule === 'flexible' ? 0.75 : 0.2);

  const genderScore =
    mine.preferred_gender === theirGender
      ? 1
      : (mine.preferred_gender === 'any' || theirGender === 'any' ? 0.8 : 0.1);

  const dietScore =
    mine.diet === theirs.diet
      ? 1
      // Someone with a strict diet living with an unrestricted kitchen is the
      // friction point; two different restrictions bother each other less.
      : (mine.diet === 'non_veg' || theirs.diet === 'non_veg' ? 0.4 : 0.6);

  const cleanGap = Math.abs((mine.cleanliness_score ?? 3) - (theirs.cleanliness_score ?? 3));
  const studyGap = Math.abs((mine.study_hours ?? 0) - (theirs.study_hours ?? 0));

  const dims: (CompatDimension & { weight: number })[] = [
    {
      key: 'sleep_schedule', label: 'Sleep schedule', weight: 16, score: sleepScore,
      mine: label(SLEEP, mine.sleep_schedule), theirs: label(SLEEP, theirs.sleep_schedule),
    },
    {
      key: 'cleanliness', label: 'Cleanliness', weight: 16,
      score: 1 - Math.min(cleanGap, 4) / 4,
      mine: `${mine.cleanliness_score ?? 3}/5`, theirs: `${theirs.cleanliness_score ?? 3}/5`,
    },
    {
      key: 'noise_tolerance', label: 'Noise tolerance', weight: 14,
      score: scaleScore(['quiet', 'moderate', 'noisy'], mine.noise_tolerance, theirs.noise_tolerance),
      mine: label(NOISE, mine.noise_tolerance), theirs: label(NOISE, theirs.noise_tolerance),
    },
    {
      key: 'guest_policy', label: 'Guests', weight: 12,
      score: scaleScore(['not_allowed', 'restricted', 'allowed'], mine.guest_policy, theirs.guest_policy),
      mine: label(GUESTS, mine.guest_policy), theirs: label(GUESTS, theirs.guest_policy),
    },
    {
      key: 'smoking_tolerance', label: 'Smoking', weight: 12,
      score: mine.smoking_tolerance === theirs.smoking_tolerance ? 1 : 0.25,
      mine: mine.smoking_tolerance ? 'Tolerant' : 'No smoking',
      theirs: theirs.smoking_tolerance ? 'Tolerant' : 'No smoking',
    },
    {
      key: 'diet', label: 'Diet', weight: 12, score: dietScore,
      mine: label(DIET, mine.diet), theirs: label(DIET, theirs.diet),
    },
    {
      key: 'preferred_gender', label: 'Gender preference', weight: 10, score: genderScore,
      mine: label(GENDER, mine.preferred_gender), theirs: label(GENDER, theirGender),
    },
    {
      key: 'study_hours', label: 'Study hours', weight: 8,
      score: 1 - Math.min(studyGap, 8) / 8,
      mine: `${mine.study_hours ?? 0}h/day`, theirs: `${theirs.study_hours ?? 0}h/day`,
    },
  ];

  const totalWeight = dims.reduce((s, d) => s + d.weight, 0);
  const score = Math.round(dims.reduce((s, d) => s + d.weight * d.score, 0) / totalWeight * 100);

  return {
    score,
    dimensions: dims.map(({ weight: _weight, ...d }) => d),
  };
}

/** Bands used for both the colour and the wording, so they can't disagree. */
export function compatBand(score: number): { label: string; tone: 'high' | 'mid' | 'low'; color: string } {
  if (score >= 75) return { label: 'Strong match', tone: 'high', color: 'var(--success)' };
  if (score >= 50) return { label: 'Fair match', tone: 'mid', color: 'var(--gold)' };
  return { label: 'Weak match', tone: 'low', color: 'var(--danger)' };
}
