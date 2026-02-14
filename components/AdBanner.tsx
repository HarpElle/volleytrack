import React, { useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { getBannerAdUnitId } from '../constants/monetization';
import { useSubscriptionStore } from '../store/useSubscriptionStore';

interface AdBannerProps {
    style?: ViewStyle;
}

/**
 * Reusable AdMob banner ad component.
 *
 * - Auto-hides for Pro subscribers (no ads shown)
 * - Uses test ad unit IDs in __DEV__ mode (safe for development)
 * - Uses production IDs in release builds
 * - Handles ad load failures gracefully (renders nothing)
 * - Fixed-height container prevents layout shift during load
 */
export function AdBanner({ style }: AdBannerProps) {
    const isPro = useSubscriptionStore((s) => s.isPro);
    const [adFailed, setAdFailed] = useState(false);

    // Pro users never see ads
    if (isPro) return null;

    // If ad failed to load, don't show empty space
    if (adFailed) return null;

    return (
        <View style={[styles.container, style]}>
            <BannerAd
                unitId={getBannerAdUnitId()}
                size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
                onAdFailedToLoad={(error) => {
                    console.log('[AdBanner] Ad failed to load:', error.message);
                    setAdFailed(true);
                }}
                onAdLoaded={() => {
                    setAdFailed(false);
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
});
