import { ArrowLeft, X } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';

interface ScreenHeaderProps {
    title: string;
    onBack?: () => void;
    onClose?: () => void;
    rightAction?: React.ReactNode;
}

export function ScreenHeader({ title, onBack, onClose, rightAction }: ScreenHeaderProps) {
    const { colors, spacing, fontSize } = useAppTheme();

    return (
        <View
            style={[
                styles.container,
                {
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.base,
                    backgroundColor: colors.headerBg,
                    borderBottomColor: colors.headerBorder,
                },
            ]}
        >
            {/* Left action */}
            {onBack ? (
                <TouchableOpacity
                    onPress={onBack}
                    style={styles.iconBtn}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityLabel="Go back"
                    accessibilityRole="button"
                >
                    <ArrowLeft size={24} color={colors.text} />
                </TouchableOpacity>
            ) : onClose ? (
                <TouchableOpacity
                    onPress={onClose}
                    style={styles.iconBtn}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityLabel="Close"
                    accessibilityRole="button"
                >
                    <X size={24} color={colors.text} />
                </TouchableOpacity>
            ) : (
                <View style={styles.iconBtn} />
            )}

            {/* Title */}
            <Text
                style={[styles.title, { color: colors.text, fontSize: fontSize.lg }]}
                numberOfLines={1}
            >
                {title}
            </Text>

            {/* Right action */}
            {rightAction ? (
                <View style={styles.iconBtn}>{rightAction}</View>
            ) : (
                <View style={styles.iconBtn} />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
    },
    iconBtn: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        flex: 1,
        fontWeight: '700',
        textAlign: 'center',
    },
});
