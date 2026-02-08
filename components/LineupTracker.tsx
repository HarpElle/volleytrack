import { User } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useHaptics } from '../hooks/useHaptic';
import { LineupPosition, Player } from '../types';

interface LineupTrackerProps {
    rotation: LineupPosition[]; // Current 6 players
    roster: Player[]; // Full roster for resolving names
    onSubstitute: (position: number) => void;
    onSelectPlayer: (playerId: string) => void;
    selectedPlayerIds?: string[];
    highlightPosition?: number | null; // Slot to pulse
}

// Sub-component for Animation Isolation to prevent re-rendering entire grid
const PlayerCard = ({ pos, player, isLibero, isSelected, selectionIndex, borderColor, borderWidth, onSelect, onSub, haptics, shouldPulse }: any) => {
    const isPad = (Platform as any).isPad;
    const scale = useSharedValue(1);
    const bg = useSharedValue(isLibero ? '#333' : '#fff');

    // Pulse Effect
    useEffect(() => {
        if (shouldPulse) {
            bg.value = withSequence(
                withTiming('#ffeb3b', { duration: 2000 }), // Yellow Highlight (Longer per feedback)
                withTiming(isLibero ? '#333' : '#fff', { duration: 1000 })
            );
            scale.value = withSequence(
                withTiming(1.1, { duration: 200 }),
                withTiming(1, { duration: 200 }),
                withTiming(1.05, { duration: 200 }),
                withTiming(1, { duration: 500 })
            );
        } else {
            // Reset if logic changes away
            bg.value = withTiming(isLibero ? '#333' : '#fff', { duration: 300 });
        }
    }, [shouldPulse, isLibero]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            backgroundColor: bg.value,
            transform: [{ scale: scale.value }]
        };
    });

    return (
        <Animated.View style={[{ flex: 1 }, animatedStyle]}>
            <TouchableOpacity
                style={[
                    styles.gridItem,
                    { borderColor, borderWidth, width: '100%', backgroundColor: 'transparent' },
                    isPad && { minHeight: 120, padding: 12 }
                ]}
                onPress={() => {
                    if (player) {
                        onSelect(player.id);
                        haptics('selection');
                    } else {
                        onSub(pos);
                        haptics('medium');
                    }
                }}
                onLongPress={() => onSub(pos)}
                delayLongPress={300}
            >
                <Text style={styles.posLabel}>P{pos}</Text>
                {isSelected && (
                    <View style={styles.selectionBadge}>
                        <Text style={styles.selectionBadgeText}>{selectionIndex! + 1}</Text>
                    </View>
                )}
                {player ? (
                    <View style={{ alignItems: 'center' }}>
                        <Text style={[styles.gridNumber, isLibero && { color: '#fff' }, isPad && { fontSize: 24 }]}>#{player.jerseyNumber}</Text>
                        <Text style={[styles.gridName, isLibero && { color: '#fff' }, isPad && { fontSize: 16 }]} numberOfLines={1}>{player.name}</Text>
                    </View>
                ) : (
                    <User size={isPad ? 32 : 20} color="#ccc" />
                )}
            </TouchableOpacity>
        </Animated.View>
    );
}

export default function LineupTracker({ rotation, roster, onSubstitute, onSelectPlayer, selectedPlayerIds = [], highlightPosition }: Omit<LineupTrackerProps, 'onRotate' | 'onRotateBack'>) {
    const haptics = useHaptics();
    if (!rotation || rotation.length === 0) return null;

    const getPlayer = (pos: number) => {
        const slot = rotation.find(p => p.position === pos);
        if (!slot || !slot.playerId) return null;
        return roster.find(p => p.id === slot.playerId);
    };

    const renderPosition = (pos: number) => {
        const player = getPlayer(pos);
        const slot = rotation.find(p => p.position === pos);
        const isLibero = slot?.isLibero;

        const selectionIndex = player ? selectedPlayerIds?.indexOf(player.id) : -1;
        const isSelected = selectionIndex !== undefined && selectionIndex !== -1;

        const borderColor = isSelected ? '#ffcc00' : (isLibero ? '#333' : '#eee');
        const borderWidth = isSelected ? 3 : 1;

        const shouldPulse = highlightPosition === pos;

        return (
            <PlayerCard
                key={pos}
                pos={pos}
                player={player}
                isLibero={isLibero}
                isSelected={isSelected}
                selectionIndex={selectionIndex}
                borderColor={borderColor}
                borderWidth={borderWidth}
                onSelect={onSelectPlayer}
                onSub={onSubstitute}
                haptics={haptics}
                shouldPulse={shouldPulse}
            />
        );
    };

    return (
        <View style={styles.court}>
            <View style={styles.netLine} />
            {/* Front Row: 4, 3, 2 */}
            <View style={styles.row}>
                {[4, 3, 2].map(renderPosition)}
            </View>
            {/* Back Row: 5, 6, 1 */}
            <View style={styles.row}>
                {[5, 6, 1].map(renderPosition)}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    centerContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    court: {
        backgroundColor: '#f9f9f9',
        borderRadius: 8,
        padding: 8,
        position: 'relative',
        overflow: 'hidden',
    },
    netLine: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 4,
        backgroundColor: '#ccc',
        zIndex: 10,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 8,
    },
    gridItem: {
        // Flex 1 handled by Animated Parent
        backgroundColor: '#fff', // Default but overridden
        borderRadius: 8,
        padding: 6,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#eee',
        minHeight: 75,
        justifyContent: 'center'
    },
    liberoItem: {
        backgroundColor: '#333',
        borderColor: '#333',
    },
    posLabel: {
        position: 'absolute',
        top: 2,
        left: 4,
        fontSize: 10,
        color: '#ccc',
        fontWeight: '700',
    },
    gridNumber: {
        fontSize: 14,
        fontWeight: '800',
        color: '#333',
    },
    gridName: {
        fontSize: 10,
        color: '#666',
    },
    selectionBadge: {
        position: 'absolute',
        top: -6,
        right: -6,
        backgroundColor: '#ffcc00',
        width: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        borderWidth: 1,
        borderColor: '#fff'
    },
    selectionBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#333'
    }
});
