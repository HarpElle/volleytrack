/**
 * Skeleton / Shimmer Loading Placeholder
 *
 * A lightweight shimmer component that indicates content is loading.
 * Uses react-native-reanimated for smooth shimmer animation.
 *
 * @example
 * <Skeleton width={120} height={16} />
 * <Skeleton width="100%" height={56} borderRadius={radius.lg} />
 * <Skeleton circle size={40} />
 */

import React, { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
    interpolate,
    Easing,
} from 'react-native-reanimated';
import { useAppTheme } from '../contexts/ThemeContext';

interface SkeletonProps {
    /** Width of the skeleton (number or percentage string). Default: '100%' */
    width?: number | `${number}%`;
    /** Height of the skeleton in pixels. Default: 16 */
    height?: number;
    /** Border radius. Defaults to radius.sm (8) */
    borderRadius?: number;
    /** Render as a circle with this diameter */
    circle?: boolean;
    /** Diameter when circle=true. Default: 40 */
    size?: number;
    /** Additional styles */
    style?: ViewStyle;
}

export function Skeleton({
    width = '100%',
    height = 16,
    borderRadius,
    circle = false,
    size = 40,
    style,
}: SkeletonProps) {
    const { colors, radius, isDark } = useAppTheme();
    const shimmer = useSharedValue(0);

    useEffect(() => {
        shimmer.value = withRepeat(
            withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
            -1,
            true,
        );
    }, []);

    const baseColor = isDark ? colors.bgElevated : colors.borderLight;
    const highlightColor = isDark ? colors.border : colors.border;

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: interpolate(shimmer.value, [0, 1], [0.4, 1]),
    }));

    const resolvedWidth = circle ? size : width;
    const resolvedHeight = circle ? size : height;
    const resolvedRadius = circle
        ? size / 2
        : (borderRadius ?? radius.sm);

    return (
        <Animated.View
            style={[
                {
                    width: resolvedWidth,
                    height: resolvedHeight,
                    borderRadius: resolvedRadius,
                    backgroundColor: baseColor,
                },
                animatedStyle,
                style,
            ]}
        />
    );
}

// ─── Preset Skeleton Layouts ────────────────────────────────────────────────

interface SkeletonGroupProps {
    style?: ViewStyle;
}

/** Skeleton for a season card in the horizontal scroll */
export function SkeletonSeasonCard({ style }: SkeletonGroupProps) {
    const { colors, radius } = useAppTheme();
    return (
        <View
            style={[
                {
                    width: 160,
                    padding: 16,
                    borderRadius: radius.md,
                    backgroundColor: colors.bgCard,
                    marginRight: 12,
                    gap: 8,
                },
                style,
            ]}
        >
            <Skeleton width={100} height={14} />
            <Skeleton width={70} height={12} />
            <Skeleton width={50} height={10} />
        </View>
    );
}

/** Skeleton for a match card row */
export function SkeletonMatchCard({ style }: SkeletonGroupProps) {
    const { colors, radius } = useAppTheme();
    return (
        <View
            style={[
                {
                    padding: 16,
                    borderRadius: radius.md,
                    backgroundColor: colors.bgCard,
                    gap: 8,
                },
                style,
            ]}
        >
            <Skeleton width={80} height={10} />
            <Skeleton width="70%" height={16} />
            <Skeleton width={120} height={10} />
        </View>
    );
}

/** Skeleton for the dashboard hero button */
export function SkeletonHeroButton({ style }: SkeletonGroupProps) {
    const { colors, radius } = useAppTheme();
    return (
        <View
            style={[
                {
                    height: 80,
                    borderRadius: radius.lg,
                    backgroundColor: colors.bgCard,
                    padding: 24,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 16,
                },
                style,
            ]}
        >
            <Skeleton circle size={32} />
            <View style={{ gap: 6, flex: 1 }}>
                <Skeleton width={120} height={16} />
                <Skeleton width={160} height={12} />
            </View>
        </View>
    );
}
