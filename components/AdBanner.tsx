import React, { useState } from 'react';
import { Dimensions, StyleSheet, View, type ViewStyle } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { getBannerAdUnitId } from '../constants/monetization';
import { useSubscriptionStore } from '../store/useSubscriptionStore';

interface AdBannerProps {
    style?: ViewStyle;
    /** When true, reserves space even if the ad fails to load (prevents layout shift). Default: false */
    reserveSpace?: boolean;
}

/**
 * Estimated adaptive banner height based on screen width.
 * Google's ANCHORED_ADAPTIVE_BANNER formula:
 *  - width <= 400dp → 50dp
 *  - width <= 720dp → 50-90dp (scales)
 * We use a safe middle estimate.
 */
function getEstimatedBannerHeight(): number {
    const screenWidth = Dimensions.get('window').width;
    if (screenWidth <= 400) return 50;
    if (screenWidth <= 720) return 60;
    return 90;
}

/**
 * Reusable AdMob banner ad component.
 *
 * - Auto-hides for Pro subscribers (no ads shown)
 * - Uses test ad unit IDs in __DEV__ mode (safe for development)
 * - Uses production IDs in release builds
 * - Handles ad load failures gracefully
 * - reserveSpace=true keeps a placeholder to prevent layout shift (use on live match screen)
 */
export function AdBanner({ style, reserveSpace = false }: AdBannerProps) {
    const isPro = useSubscriptionStore((s) => s.isPro);
    const [adFailed, setAdFailed] = useState(false);

    // Pro users never see ads
    if (isPro) return null;

    // If ad failed and we don't need to reserve space, collapse
    if (adFailed && !reserveSpace) return null;

    return (
        <View style={[styles.container, reserveSpace && { minHeight: getEstimatedBannerHeight() }, style]}>
            {!adFailed && (
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
            )}
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
