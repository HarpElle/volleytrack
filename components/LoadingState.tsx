/**
 * LoadingState — Full-screen or section-level loading indicator.
 *
 * Wraps ActivityIndicator with consistent styling and optional message.
 *
 * @example
 * <LoadingState />
 * <LoadingState message="Loading match data..." />
 * <LoadingState fullScreen />
 */

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';

interface LoadingStateProps {
    /** Optional loading message */
    message?: string;
    /** Fill the entire screen (flex: 1). Default: false */
    fullScreen?: boolean;
    /** Additional container styles */
    style?: ViewStyle;
    /** Spinner size. Default: 'large' */
    size?: 'small' | 'large';
}

export function LoadingState({
    message,
    fullScreen = false,
    style,
    size = 'large',
}: LoadingStateProps) {
    const { colors } = useAppTheme();

    return (
        <View
            style={[
                styles.container,
                fullScreen && styles.fullScreen,
                { backgroundColor: colors.bg },
                style,
            ]}
        >
            <ActivityIndicator size={size} color={colors.primary} />
            {message ? (
                <Text style={[styles.message, { color: colors.textSecondary }]}>
                    {message}
                </Text>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    fullScreen: {
        flex: 1,
    },
    message: {
        fontSize: 14,
        fontWeight: '500',
    },
});
