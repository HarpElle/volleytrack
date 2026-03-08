/**
 * EmptyState — Reusable empty / zero-data state component.
 *
 * Shows an icon, title, optional description, and optional CTA button.
 * Consistent styling across all screens.
 *
 * @example
 * <EmptyState
 *   icon={Calendar}
 *   title="No upcoming matches"
 *   description="Schedule your first match to get started"
 *   actionLabel="Schedule a Match"
 *   onAction={() => router.push('/match/setup')}
 * />
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useAppTheme } from '../contexts/ThemeContext';

interface EmptyStateProps {
    /** Lucide icon component to display */
    icon: LucideIcon;
    /** Primary message */
    title: string;
    /** Secondary descriptive text */
    description?: string;
    /** CTA button label */
    actionLabel?: string;
    /** CTA button handler */
    onAction?: () => void;
    /** Additional container styles */
    style?: ViewStyle;
    /** Icon size. Default: 32 */
    iconSize?: number;
}

export function EmptyState({
    icon: Icon,
    title,
    description,
    actionLabel,
    onAction,
    style,
    iconSize = 32,
}: EmptyStateProps) {
    const { colors, radius, spacing, fontSize } = useAppTheme();

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                },
                style,
            ]}
        >
            <View
                style={[
                    styles.iconCircle,
                    { backgroundColor: colors.primaryLight },
                ]}
            >
                <Icon size={iconSize} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            {description ? (
                <Text style={[styles.description, { color: colors.textTertiary }]}>
                    {description}
                </Text>
            ) : null}
            {actionLabel && onAction ? (
                <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.primaryLight }]}
                    onPress={onAction}
                >
                    <Text style={[styles.actionText, { color: colors.primary }]}>
                        {actionLabel}
                    </Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderStyle: 'dashed',
        borderWidth: 1,
        gap: 8,
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
        textAlign: 'center',
    },
    description: {
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 18,
    },
    actionBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        marginTop: 4,
    },
    actionText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
