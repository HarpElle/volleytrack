/**
 * App Store Rating Prompt
 *
 * Triggers the native review dialog after the user has completed
 * a certain number of matches (default: 3). Only prompts once per
 * "cooldown" period to avoid being annoying.
 *
 * Uses expo-store-review which shows the native iOS/Android review dialog.
 * Apple limits how many times the dialog is shown per year, so
 * redundant calls are harmless — the OS handles rate-limiting.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { useEffect } from 'react';

const MATCHES_KEY = 'volleytrack-completed-matches';
const LAST_PROMPT_KEY = 'volleytrack-last-rating-prompt';

const MATCHES_THRESHOLD = 3;       // Prompt after 3rd completed match
const COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000; // 90 days between prompts

/**
 * Call this after a match is finalized. It increments the counter
 * and triggers the review dialog if conditions are met.
 */
export async function onMatchCompleted(): Promise<void> {
    try {
        // Increment completed match count
        const raw = await AsyncStorage.getItem(MATCHES_KEY);
        const count = (parseInt(raw || '0', 10) || 0) + 1;
        await AsyncStorage.setItem(MATCHES_KEY, String(count));

        // Check threshold
        if (count < MATCHES_THRESHOLD) return;

        // Check cooldown
        const lastPrompt = await AsyncStorage.getItem(LAST_PROMPT_KEY);
        if (lastPrompt) {
            const elapsed = Date.now() - parseInt(lastPrompt, 10);
            if (elapsed < COOLDOWN_MS) return;
        }

        // Check availability (not all environments support it)
        const available = await StoreReview.isAvailableAsync();
        if (!available) return;

        // Show the review dialog
        await StoreReview.requestReview();
        await AsyncStorage.setItem(LAST_PROMPT_KEY, String(Date.now()));
    } catch (err) {
        // Silently fail — rating prompts should never interrupt the UX
        console.log('[Rating] Failed to show review prompt:', err);
    }
}
