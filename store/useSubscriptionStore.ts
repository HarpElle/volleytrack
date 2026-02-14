import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
    DEVICE_UUID_KEY,
    FREE_AI_NARRATIVE_LIMIT,
    FREE_EXPORT_LIMIT,
    FREE_FAN_RECAP_LIMIT,
    FREE_SEASON_LIMIT,
    SUBSCRIPTION_STORE_KEY,
} from '../constants/monetization';

export type SubscriptionType = 'monthly' | 'annual' | 'lifetime' | null;

interface SubscriptionState {
    // Device identity (persisted independently in AsyncStorage too, for RevenueCat init)
    deviceUUID: string | null;

    // Subscription status
    isPro: boolean;
    subscriptionType: SubscriptionType;
    expiresAt: string | null;

    // Free tier usage counters (tied to device install, NOT email)
    aiNarrativesUsed: number;
    exportsUsed: number;
    fanRecapsUsed: number;

    // Actions
    initializeDevice: () => Promise<string>;
    setProStatus: (isPro: boolean, type?: SubscriptionType, expires?: string | null) => void;
    incrementAINarratives: () => void;
    incrementExports: () => void;
    incrementFanRecaps: () => void;
    canUseAINarrative: () => boolean;
    canUseExport: () => boolean;
    canUseFanRecap: () => boolean;
    canCreateSeason: (currentSeasonCount: number) => boolean;
    getRemainingAINarratives: () => number;
    getRemainingExports: () => number;
    getRemainingFanRecaps: () => number;
}

export const useSubscriptionStore = create<SubscriptionState>()(
    persist(
        (set, get) => ({
            deviceUUID: null,
            isPro: false,
            subscriptionType: null,
            expiresAt: null,
            aiNarrativesUsed: 0,
            exportsUsed: 0,
            fanRecapsUsed: 0,

            /**
             * Initialize or retrieve the device UUID.
             * This is the anchor for free-tier usage tracking and RevenueCat identity.
             * Stored in both Zustand (for quick access) and AsyncStorage (for RevenueCat init before hydration).
             */
            initializeDevice: async () => {
                // Check if we already have it in state (Zustand hydrated)
                const existing = get().deviceUUID;
                if (existing) return existing;

                // Check AsyncStorage directly (may beat Zustand hydration)
                const stored = await AsyncStorage.getItem(DEVICE_UUID_KEY);
                if (stored) {
                    set({ deviceUUID: stored });
                    return stored;
                }

                // First launch — generate new UUID
                const newUUID = Crypto.randomUUID();
                await AsyncStorage.setItem(DEVICE_UUID_KEY, newUUID);
                set({ deviceUUID: newUUID });
                return newUUID;
            },

            setProStatus: (isPro, type = null, expires = null) => {
                set({ isPro, subscriptionType: type, expiresAt: expires });
            },

            incrementAINarratives: () => {
                set((state) => ({ aiNarrativesUsed: state.aiNarrativesUsed + 1 }));
            },

            incrementExports: () => {
                set((state) => ({ exportsUsed: state.exportsUsed + 1 }));
            },

            incrementFanRecaps: () => {
                set((state) => ({ fanRecapsUsed: state.fanRecapsUsed + 1 }));
            },

            canUseAINarrative: () => {
                const { isPro, aiNarrativesUsed } = get();
                return isPro || aiNarrativesUsed < FREE_AI_NARRATIVE_LIMIT;
            },

            canUseExport: () => {
                const { isPro, exportsUsed } = get();
                return isPro || exportsUsed < FREE_EXPORT_LIMIT;
            },

            canUseFanRecap: () => {
                const { isPro, fanRecapsUsed } = get();
                return isPro || fanRecapsUsed < FREE_FAN_RECAP_LIMIT;
            },

            canCreateSeason: (currentSeasonCount: number) => {
                const { isPro } = get();
                return isPro || currentSeasonCount < FREE_SEASON_LIMIT;
            },

            getRemainingAINarratives: () => {
                const { isPro, aiNarrativesUsed } = get();
                if (isPro) return Infinity;
                return Math.max(0, FREE_AI_NARRATIVE_LIMIT - aiNarrativesUsed);
            },

            getRemainingExports: () => {
                const { isPro, exportsUsed } = get();
                if (isPro) return Infinity;
                return Math.max(0, FREE_EXPORT_LIMIT - exportsUsed);
            },

            getRemainingFanRecaps: () => {
                const { isPro, fanRecapsUsed } = get();
                if (isPro) return Infinity;
                return Math.max(0, FREE_FAN_RECAP_LIMIT - fanRecapsUsed);
            },
        }),
        {
            name: SUBSCRIPTION_STORE_KEY,
            storage: createJSONStorage(() => AsyncStorage),
            // Only persist these specific fields (not actions)
            partialize: (state) => ({
                deviceUUID: state.deviceUUID,
                isPro: state.isPro,
                subscriptionType: state.subscriptionType,
                expiresAt: state.expiresAt,
                aiNarrativesUsed: state.aiNarrativesUsed,
                exportsUsed: state.exportsUsed,
                fanRecapsUsed: state.fanRecapsUsed,
            }),
        }
    )
);
