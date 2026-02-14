import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';

interface ComparisonChartProps {
    label: string;
    actual: number;
    target: number;
    formatValue?: (val: number) => string;
    higherIsBetter?: boolean;
    maxValue?: number; // Optional scaling max
}

export default function ComparisonChart({
    label,
    actual,
    target,
    formatValue = (v) => v.toFixed(3),
    higherIsBetter = true,
    maxValue
}: ComparisonChartProps) {
    const { colors } = useAppTheme();

    // Determine Scale
    // Max scale should be at least slightly higher than max(actual, target)
    const derivedMax = maxValue || Math.max(actual, target, 0.1) * 1.2;

    const actualPct = Math.min(Math.max((actual / derivedMax) * 100, 0), 100);
    const targetPct = Math.min(Math.max((target / derivedMax) * 100, 0), 100);

    // Color Logic
    let barColor = '#4caf50'; // Green
    if (higherIsBetter) {
        if (actual < target * 0.9) barColor = '#f44336'; // Red (>10% below)
        else if (actual < target) barColor = '#ff9800'; // Orange (Close)
    } else {
        // Lower is better (e.g. Error Rate)
        if (actual > target * 1.1) barColor = '#f44336';
        else if (actual > target) barColor = '#ff9800';
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.header}>
                <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
                <View style={styles.values}>
                    <Text style={[styles.actualValue, { color: barColor }]}>
                        {formatValue(actual)}
                    </Text>
                    <Text style={[styles.targetValue, { color: colors.textTertiary }]}>
                        / {formatValue(target)}
                    </Text>
                </View>
            </View>

            <View style={styles.chartArea}>
                {/* Background Track */}
                <View style={[styles.track, { backgroundColor: colors.buttonSecondary }]} />

                {/* Actual Bar */}
                <View style={[styles.bar, { width: `${actualPct}%`, backgroundColor: barColor }]} />

                {/* Target Marker */}
                <View style={[styles.targetLine, { left: `${targetPct}%`, backgroundColor: colors.text }]} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
        alignItems: 'center',
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
    },
    values: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    actualValue: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    targetValue: {
        fontSize: 14,
        marginLeft: 4,
    },
    chartArea: {
        height: 24,
        justifyContent: 'center',
    },
    track: {
        position: 'absolute',
        width: '100%',
        height: 8,
        borderRadius: 4,
    },
    bar: {
        position: 'absolute',
        height: 8,
        borderRadius: 4,
    },
    targetLine: {
        position: 'absolute',
        width: 2,
        height: 20, // Taller than bar
        top: 2, // Centered vertically relative to 24px height?
        // 24 height. Bar is 8. Target line 20.
        // Track top: (24-8)/2 = 8.
        // Target top: (24-20)/2 = 2.
    }
});
