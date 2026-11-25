/**
 * Shared domain types for BharatBite.
 *
 * These mirror the Postgres enums in `supabase/migrations/0001_init_shared.sql`
 * one-for-one. Keep both sides in sync — there is a unit test asserting the
 * catalog of enum values against the migration file.
 */
export const CUISINES = [
    'gujarati',
    'punjabi',
    'rajasthani',
    'maharashtrian',
    'bengali',
    'south_indian',
    'north_indian',
    'kashmiri',
    'bihari',
    'odia',
    'northeastern',
    'street_food',
    'pan_indian',
    'not_regional',
];
export const FOOD_CATEGORIES = [
    'grain_cereal',
    'roti_bread',
    'dal_legume',
    'vegetable_sabzi',
    'paneer_dairy',
    'non_veg_curry',
    'rice_dish',
    'breakfast',
    'snack_street_food',
    'sweet_dessert',
    'beverage',
    'condiment_chutney',
    'salad_raita',
    'soup',
    'egg',
    'fruit',
    'dry_fruit_nut',
    'oil_fat',
    'spice_masala',
    'raw_ingredient',
    'mixed_meal',
];
export const MEAL_TYPES = [
    'breakfast',
    'mid_morning',
    'lunch',
    'evening_snack',
    'dinner',
    'midnight',
];
export const VERIFICATION_STATUSES = [
    'source_verified',
    'calculated_from_recipe',
    'needs_audit',
];
export const ENTITLEMENT_STATUSES = [
    'free',
    'pending',
    'active',
    'past_due',
    'cancelled',
    'expired',
    'refunded',
];
export const LANGUAGES = [
    'en',
    'hi',
    'gu',
    'mr',
    'pa',
    'bn',
    'ta',
    'te',
    'kn',
    'ml',
    'or',
    'as',
    'ur',
];
//# sourceMappingURL=types.js.map