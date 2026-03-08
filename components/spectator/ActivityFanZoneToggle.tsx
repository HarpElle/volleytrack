/**
 * ActivityFanZoneToggle — Segmented pill control to switch between
 * Recent Activity (play-by-play) and Fan Zone (chat) in the spectator content area.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';

export type ContentTab = 'activity' | 'fan-zone';

interface ActivityFanZoneToggleProps {
    activeTab: ContentTab;
    onTabChange: (tab: ContentTab) => void;
    unreadCount?: number;
}

export function ActivityFanZoneToggle({ activeTab, onTabChange, unreadCount }: ActivityFanZoneToggleProps) {
    const { colors } = useAppTheme();

    return (
        <View style={[styles.container, { backgroundColor: colors.border }]}>
            <TouchableOpacity
                style={[
                    styles.tab,
                    activeTab === 'activity' && { backgroundColor: colors.primary },
                    activeTab !== 'activity' && { backgroundColor: colors.bg },
                ]}
                onPress={() => onTabChange('activity')}
                activeOpacity={0.7}
            >
                <Text
                    style={[
                        styles.tabText,
                        { color: activeTab === 'activity' ? '#fff' : colors.textSecondary },
                    ]}
                >
                    Activity
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[
                    styles.tab,
                    activeTab === 'fan-zone' && { backgroundColor: colors.primary },
                    activeTab !== 'fan-zone' && { backgroundColor: colors.bg },
                ]}
                onPress={() => onTabChange('fan-zone')}
                activeOpacity={0.7}
            >
                <Text
                    style={[
                        styles.tabText,
                        { color: activeTab === 'fan-zone' ? '#fff' : colors.textSecondary },
                    ]}
                >
                    Fan Zone
                </Text>
                {(unreadCount ?? 0) > 0 && (
                    <View style={[styles.badge, { backgroundColor: activeTab === 'fan-zone' ? '#fff' : colors.error }]}>
                        <Text style={[styles.badgeText, { color: activeTab === 'fan-zone' ? colors.primary : '#fff' }]}>
                            {(unreadCount ?? 0) > 9 ? '9+' : unreadCount}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        borderRadius: 10,
        padding: 2,
        marginTop: 16,
        marginBottom: 12,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 7,
        borderRadius: 8,
        gap: 6,
    },
    tabText: {
        fontSize: 13,
        fontWeight: '700',
    },
    badge: {
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        fontSize: 9,
        fontWeight: '700',
    },
});
