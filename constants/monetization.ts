import { Platform } from 'react-native';

// ── Free Tier Limits ────────────────────────────────────────────────────────
export const FREE_AI_NARRATIVE_LIMIT = 3;
export const FREE_EXPORT_LIMIT = 3;
export const FREE_SEASON_LIMIT = 1;
export const FREE_FAN_RECAP_LIMIT = 2;

// ── AdMob Configuration ─────────────────────────────────────────────────────
// Test ad unit IDs — safe for development, will not trigger account suspension
const ADMOB_TEST_BANNER_IOS = 'ca-app-pub-3940256099942544/2934735716';
const ADMOB_TEST_BANNER_ANDROID = 'ca-app-pub-3940256099942544/6300978111';

// Production ad unit IDs
const ADMOB_PROD_BANNER_IOS = 'ca-app-pub-4048915758307061/9820858426';
const ADMOB_PROD_BANNER_ANDROID = 'ca-app-pub-4048915758307061/6863522594';

/**
 * Returns the correct banner ad unit ID based on platform and dev/prod mode.
 * In __DEV__ mode, always uses Google's official test ad IDs to protect
 * the AdMob account from suspension due to repeated test impressions.
 */
export function getBannerAdUnitId(): string {
    if (__DEV__) {
        return Platform.OS === 'ios' ? ADMOB_TEST_BANNER_IOS : ADMOB_TEST_BANNER_ANDROID;
    }
    return Platform.OS === 'ios' ? ADMOB_PROD_BANNER_IOS : ADMOB_PROD_BANNER_ANDROID;
}

// ── RevenueCat Configuration ────────────────────────────────────────────────
// Platform-specific API keys from RevenueCat dashboard
const REVENUECAT_IOS_KEY = 'appl_ePZNxNFIVWTwPIlNAaFKXHNPUxN';

// Future: add Android key when Google Play is set up
// const REVENUECAT_ANDROID_KEY = 'goog_YOUR_ANDROID_KEY';

export function getRevenueCatApiKey(): string {
    // iOS uses the production Apple key; Android will use its own key once configured.
    // For now, both platforms use the iOS key (Android will need its own before Play Store launch).
    if (Platform.OS === 'android') {
        // TODO: Replace with Android-specific key once Google Play is set up
        console.warn('[RevenueCat] Android key not yet configured — using iOS key as fallback');
    }
    return REVENUECAT_IOS_KEY;
}

// ── RevenueCat Entitlement & Offering IDs ───────────────────────────────────
// Project: HarpElle | Entitlement: HarpElle / VolleyTrack Pro
// The entitlement identifier as configured in RevenueCat dashboard
export const ENTITLEMENT_ID = 'HarpElle / VolleyTrack Pro';
export const OFFERING_ID = 'default';

// ── Apple App Store Product IDs ─────────────────────────────────────────────
export const PRODUCT_IDS = {
    monthly: 'pro_monthly',    // Apple ID: 6759176199
    annual: 'pro_annual',      // Apple ID: 6759177179
    lifetime: 'pro_lifetime',  // Apple ID: 6759177245 (non-consumable)
} as const;

// ── Pricing (for display — actual prices come from store/RevenueCat) ────────
export const PRICING = {
    monthly: { price: '$4.99', period: '/month' },
    annual: { price: '$34.99', period: '/year', savings: '42%' },
    lifetime: { price: '$79.99', period: 'one-time' },
} as const;

// ── AsyncStorage Keys ───────────────────────────────────────────────────────
export const DEVICE_UUID_KEY = 'volleytrack-device-uuid';
export const SUBSCRIPTION_STORE_KEY = 'volleytrack-subscription';
