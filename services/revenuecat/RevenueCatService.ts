import Purchases, {
    type CustomerInfo,
    type PurchasesOffering,
    type PurchasesPackage,
    LOG_LEVEL,
} from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import {
    ENTITLEMENT_ID,
    PRODUCT_IDS,
    getRevenueCatApiKey,
} from '../../constants/monetization';
import { useSubscriptionStore, type SubscriptionType } from '../../store/useSubscriptionStore';

let isInitialized = false;

/**
 * Initialize the RevenueCat SDK with the device UUID as the app user ID.
 * Must be called once on app startup, before any subscription queries.
 */
export async function initializeRevenueCat(deviceUUID: string): Promise<void> {
    if (isInitialized) return;

    try {
        // Enable verbose logging in dev for debugging purchase flows
        if (__DEV__) {
            Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
        }

        Purchases.configure({
            apiKey: getRevenueCatApiKey(),
            appUserID: deviceUUID,
        });

        // Listen for subscription changes (renewals, cancellations, upgrades)
        Purchases.addCustomerInfoUpdateListener((info) => {
            updateStoreFromCustomerInfo(info);
        });

        isInitialized = true;

        // Do initial sync
        await syncSubscriptionState();
    } catch (error) {
        console.warn('[RevenueCat] Initialization failed:', error);
        // App continues to work — user just stays on free tier
    }
}

/**
 * Sync the current subscription state from RevenueCat into the Zustand store.
 */
export async function syncSubscriptionState(): Promise<void> {
    try {
        const customerInfo = await Purchases.getCustomerInfo();
        updateStoreFromCustomerInfo(customerInfo);
    } catch (error) {
        console.warn('[RevenueCat] Failed to sync subscription state:', error);
    }
}

/**
 * Parse CustomerInfo and update the subscription store.
 * Matches product identifiers against the known product IDs from App Store Connect.
 */
function updateStoreFromCustomerInfo(info: CustomerInfo): void {
    const entitlement = info.entitlements.active[ENTITLEMENT_ID];
    const store = useSubscriptionStore.getState();

    if (entitlement) {
        // User has an active "VolleyTrack Pro" entitlement
        let subType: SubscriptionType = null;
        const productId = entitlement.productIdentifier;

        // Match against our known App Store product IDs
        if (productId === PRODUCT_IDS.lifetime) {
            subType = 'lifetime';
        } else if (productId === PRODUCT_IDS.annual) {
            subType = 'annual';
        } else if (productId === PRODUCT_IDS.monthly) {
            subType = 'monthly';
        } else {
            // Fallback: try to infer from product ID string
            const lowerProductId = productId.toLowerCase();
            if (lowerProductId.includes('lifetime')) subType = 'lifetime';
            else if (lowerProductId.includes('annual') || lowerProductId.includes('yearly')) subType = 'annual';
            else if (lowerProductId.includes('monthly')) subType = 'monthly';
        }

        store.setProStatus(
            true,
            subType,
            entitlement.expirationDate || null
        );
    } else {
        // No active entitlement — free tier
        store.setProStatus(false, null, null);
    }
}

/**
 * Fetch the available subscription offerings from RevenueCat.
 * Returns the default offering if available, or null.
 */
export async function getOfferings(): Promise<PurchasesOffering | null> {
    try {
        const offerings = await Purchases.getOfferings();
        return offerings.current || null;
    } catch (error) {
        console.warn('[RevenueCat] Failed to fetch offerings:', error);
        return null;
    }
}

/**
 * Purchase a specific package from RevenueCat.
 * Works for both subscriptions (monthly, annual) and non-consumable (lifetime).
 * Returns true if purchase succeeded, false if user cancelled.
 */
export async function purchasePackage(pkg: PurchasesPackage): Promise<boolean> {
    try {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        updateStoreFromCustomerInfo(customerInfo);

        // Check if the entitlement is now active
        return !!customerInfo.entitlements.active[ENTITLEMENT_ID];
    } catch (error: any) {
        if (error.userCancelled) {
            // User cancelled — not an error
            return false;
        }
        console.warn('[RevenueCat] Purchase failed:', error);
        throw error;
    }
}

/**
 * Restore purchases — useful when a user reinstalls or switches device.
 * Returns true if Pro entitlement was restored.
 */
export async function restorePurchases(): Promise<boolean> {
    try {
        const customerInfo = await Purchases.restorePurchases();
        updateStoreFromCustomerInfo(customerInfo);
        return !!customerInfo.entitlements.active[ENTITLEMENT_ID];
    } catch (error) {
        console.warn('[RevenueCat] Restore failed:', error);
        throw error;
    }
}

/**
 * Present the RevenueCat Customer Center.
 * This provides a native UI for users to manage their subscriptions,
 * request cancellations, and access support — all configured from
 * the RevenueCat dashboard.
 *
 * Requires `react-native-purchases-ui` and Customer Center to be
 * configured in the RevenueCat dashboard.
 */
export async function presentCustomerCenter(): Promise<void> {
    try {
        await RevenueCatUI.presentCustomerCenter();
    } catch (error) {
        console.warn('[RevenueCat] Customer Center failed to present:', error);
        throw error;
    }
}
