import { ChevronDown, Pencil } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { FlatList, LayoutChangeEvent, Modal, NativeScrollEvent, NativeSyntheticEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useAppTheme } from '../contexts/ThemeContext';
import { LineupPosition, Player, StatLog } from '../types';
import EditLogEntryModal from './EditLogEntryModal';

interface FullLogModalProps {
    visible: boolean;
    onClose: () => void;
    history: StatLog[];
    roster: Player[];
    lineups?: Record<number, LineupPosition[]>;
    onUpdateLog?: (logId: string, updates: Partial<StatLog>) => void;
}

interface GroupedItem {
    id: string;
    type: 'set_header' | 'admin' | 'rally';
    data?: StatLog;
    items?: StatLog[];
    setNumber?: number;
}

export default function FullLogModal({ visible, onClose, history, roster, lineups, onUpdateLog }: FullLogModalProps) {
    const { colors } = useAppTheme();

    // Animation for Scroll Indicator
    const translateY = useSharedValue(0);
    const opacity = useSharedValue(0);

    // Edit State
    const [editEntry, setEditEntry] = useState<StatLog | null>(null);
    const [activePlayers, setActivePlayers] = useState<string[] | undefined>(undefined);

    useEffect(() => {
        if (editEntry && lineups) {
            // Calculate Active Players logic
            const setNum = editEntry.setNumber;
            const startLineup = lineups[setNum] || [];

            // Start with initial lineup IDs
            const currentIds = new Set<string>();
            startLineup.forEach(p => {
                if (p.playerId) currentIds.add(p.playerId);
            });

            // Replay history for this set up to this timestamp
            const sortedHistory = [...history].sort((a, b) => a.timestamp - b.timestamp);

            sortedHistory.forEach(log => {
                if (log.setNumber === setNum && log.timestamp < editEntry.timestamp) {
                    if (log.type === 'substitution' && log.metadata) {
                        const { subIn, subOut } = log.metadata;
                        if (subOut) currentIds.delete(subOut);
                        if (subIn) currentIds.add(subIn);
                    }
                }
            });

            setActivePlayers(Array.from(currentIds));
        } else {
            setActivePlayers(undefined);
        }
    }, [editEntry, lineups, history]);

    useEffect(() => {
        translateY.value = withRepeat(
            withTiming(6, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, []);

    const animatedChevronStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
        opacity: opacity.value
    }));

    // Scroll State
    const [contentHeight, setContentHeight] = useState(0);
    const [visibleHeight, setVisibleHeight] = useState(0);
    const [scrollY, setScrollY] = useState(0);

    useEffect(() => {
        // Show indicator if content > visible and not at bottom
        const isScrollable = contentHeight > visibleHeight;
        const isAtBottom = scrollY + visibleHeight >= contentHeight - 20; // 20px buffer

        if (isScrollable && !isAtBottom) {
            opacity.value = withTiming(1);
        } else {
            opacity.value = withTiming(0);
        }
    }, [contentHeight, visibleHeight, scrollY]);

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        setScrollY(event.nativeEvent.contentOffset.y);
    };

    const groupedHistory = React.useMemo(() => {
        const groups: GroupedItem[] = [];
        let currentRally: StatLog[] = [];
        let lastSetNumber = -1;

        // Process chronological order then reverse
        const sortedHistory = [...history].sort((a, b) => a.timestamp - b.timestamp);

        const flushRally = () => {
            if (currentRally.length > 0) {
                // Determine if rally ended with a point
                const last = currentRally[currentRally.length - 1];
                groups.push({
                    id: `rally-${last.id}`,
                    type: 'rally',
                    items: [...currentRally],
                    data: last, // Use last item for timestamp/score
                });
                currentRally = [];
            }
        };

        const terminalTypes = ['kill', 'ace', 'serve_error', 'attack_error', 'dig_error', 'receive_0', 'block', 'drop', 'set_error', 'pass_error'];

        sortedHistory.forEach((item) => {
            // Set Headers
            if (item.setNumber !== lastSetNumber) {
                flushRally();
                if (lastSetNumber !== -1) {
                    groups.push({ id: `end-set-${lastSetNumber}`, type: 'set_header', setNumber: lastSetNumber, isEnd: true } as any);
                }
                groups.push({ id: `start-set-${item.setNumber}`, type: 'set_header', setNumber: item.setNumber, isStart: true } as any);
                lastSetNumber = item.setNumber;
            }

            // Admin Events
            if (['substitution', 'timeout', 'rotation'].includes(item.type)) {
                flushRally();
                groups.push({
                    id: item.id,
                    type: 'admin',
                    data: item
                });
            } else {
                // Rally Events
                currentRally.push(item);

                // If this is a terminal event (point scored or error), flush immediate
                if (terminalTypes.includes(item.type)) {
                    flushRally();
                }
            }
        });

        flushRally();

        // Reverse for display (Newest First)
        return groups.reverse();
    }, [history]);

    const renderItem = ({ item }: { item: GroupedItem }) => {
        if (item.type === 'set_header') {
            const isStart = (item as any).isStart;
            return (
                <View style={[styles.setHeader, { backgroundColor: colors.border }]}>
                    <Text style={[styles.setHeaderText, { color: colors.text }]}>
                        {isStart ? `Set ${item.setNumber}` : `End of Set ${item.setNumber}`}
                    </Text>
                </View>
            );
        }

        if (item.type === 'admin' && item.data) {
            const log = item.data;
            let content: React.ReactNode = null;

            if (log.type === 'substitution' && log.metadata) {
                const { subIn, subOut } = log.metadata;
                const pIn = subIn ? roster.find(r => r.id === subIn) : null;
                const pOut = subOut ? roster.find(r => r.id === subOut) : null;
                if (pIn && pOut) {
                    content = <Text style={[styles.adminText, { color: colors.textSecondary }]}>SUBSTITUTION: #{pIn.jerseyNumber} {pIn.name} for #{pOut.jerseyNumber} {pOut.name}</Text>;
                }
            } else if (log.type === 'rotation') {
                content = <Text style={[styles.adminText, { color: colors.textSecondary }]}>ROTATION</Text>;
            } else if (log.type === 'timeout') {
                content = <Text style={[styles.adminText, { color: colors.textSecondary }]}>TIMEOUT taken by {log.team === 'myTeam' ? 'My Team' : 'Opponent'}</Text>;
            }

            return (
                <View style={[styles.logRow, styles.adminRow, { borderBottomColor: colors.border, backgroundColor: colors.bg }]}>
                    <View style={styles.timeContainer}>
                        <Text style={[styles.timestamp, { color: colors.textTertiary }]}>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                    <View style={styles.eventContainer}>{content}</View>
                    <View style={styles.scoreContainer}>
                        <Text style={[styles.scoreText, { color: colors.textSecondary }]}>({log.scoreSnapshot.myTeam}-{log.scoreSnapshot.opponent})</Text>
                    </View>
                </View>
            );
        }

        if (item.type === 'rally' && item.items) {
            const lastLog = item.data!;
            const rallyText: React.ReactNode[] = [];

            item.items.forEach((log, idx) => {
                const isMyTeam = log.team === 'myTeam';
                const type = log.type.replace('_', ' ').toUpperCase();
                let playerLabel = '';
                if (log.playerId) {
                    const p = roster.find(r => r.id === log.playerId);
                    if (p) playerLabel = ` (#${p.jerseyNumber})`;
                }

                // Assist Label
                if (log.assistPlayerId) {
                    const a = roster.find(r => r.id === log.assistPlayerId);
                    // Label as Assist for Kill, Set for others
                    const label = log.type === 'kill' ? 'Asst' : 'Set';
                    if (a) playerLabel += ` [${label}: #${a.jerseyNumber}]`;
                }

                if (idx > 0) rallyText.push(<Text key={`sep-${idx}`} style={{ color: colors.textTertiary }}> {' > '} </Text>);
                rallyText.push(
                    <TouchableOpacity
                        key={log.id}
                        style={styles.actionTouchable}
                        onPress={() => onUpdateLog && setEditEntry(log)}
                        disabled={!onUpdateLog}
                    >
                        <Text style={{ color: isMyTeam ? colors.primary : colors.opponent, fontWeight: 'bold' }}>
                            {type}{playerLabel}
                        </Text>
                        {onUpdateLog && <Pencil size={12} color={colors.textTertiary} style={styles.editIcon} />}
                    </TouchableOpacity>
                );
            });

            // Append Result
            if (['kill', 'ace', 'serve_error', 'attack_error', 'dig_error', 'receive_3', 'receive_0', 'block', 'drop', 'set_error', 'pass_error'].includes(lastLog.type)) {

                const isError = ['serve_error', 'attack_error', 'dig_error', 'receive_0', 'set_error', 'pass_error', 'drop'].includes(lastLog.type);
                // If it's an error, the point goes to the OTHER team
                const isMyPoint = (lastLog.team === 'myTeam' && !isError) || (lastLog.team === 'opponent' && isError);

                rallyText.push(
                    <Text key="res" style={styles.logScore}>
                        {' - POINT '}{isMyPoint ? 'MY TEAM' : 'OPPONENT'}
                    </Text>
                );
            }

            return (
                <View style={[styles.logRow, { borderBottomColor: colors.border }]}>
                    <View style={styles.timeContainer}>
                        <Text style={[styles.timestamp, { color: colors.textTertiary }]}>{new Date(lastLog.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                    <View style={styles.eventContainer}>
                        <View style={styles.rallyContainer}>
                            {rallyText}
                        </View>
                    </View>
                    <View style={styles.scoreContainer}>
                        {(() => {
                            const isMyError = lastLog.team === 'myTeam' && ['serve_error', 'attack_error', 'dig_error', 'receive_0', 'set_error', 'pass_error', 'drop'].includes(lastLog.type);
                            const isOppError = lastLog.team === 'opponent' && ['serve_error', 'attack_error', 'dig_error', 'receive_0', 'set_error', 'pass_error', 'drop'].includes(lastLog.type);

                            let myScore = lastLog.scoreSnapshot.myTeam;
                            let oppScore = lastLog.scoreSnapshot.opponent;

                            // Calculate POST score based on who won the point
                            // ONLY increment if it's a terminal event that resulted in a point
                            // If the rally is still ongoing (e.g. Serve Good), score remains snapshot.
                            const terminalTypes = ['kill', 'ace', 'serve_error', 'attack_error', 'dig_error', 'receive_0', 'block', 'drop', 'set_error', 'pass_error'];

                            if (terminalTypes.includes(lastLog.type)) {
                                if (isMyError) oppScore++;
                                else if (isOppError) myScore++;
                                else if (lastLog.team === 'myTeam') myScore++;
                                else oppScore++;
                            }

                            return <Text style={[styles.logScore, { color: colors.text }]}>({myScore}-{oppScore})</Text>;
                        })()}
                    </View>
                </View>
            );
        }

        return null;
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={[styles.container, { backgroundColor: colors.bgCard }]}>
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.title, { color: colors.text }]}>Match Log</Text>
                </View>

                <FlatList
                    data={groupedHistory}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={<Text style={[styles.empty, { color: colors.textTertiary }]}>No stats recorded yet.</Text>}
                    onLayout={(e: LayoutChangeEvent) => setVisibleHeight(e.nativeEvent.layout.height)}
                    onContentSizeChange={(w, h) => setContentHeight(h)}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                />

                {/* Scroll Indicator */}
                <Animated.View style={[styles.scrollIndicator, animatedChevronStyle]} pointerEvents="none">
                    <Text style={[styles.scrollText, { color: colors.primary }]}>Scroll for more</Text>
                    <ChevronDown size={20} color={colors.primary} />
                </Animated.View>

                {/* Floating Footer */}
                <View style={[styles.footer, { backgroundColor: colors.bgCard, borderTopColor: colors.border }]}>
                    <TouchableOpacity style={[styles.closeMainBtn, { backgroundColor: colors.buttonSecondary }]} onPress={onClose}>
                        <Text style={[styles.closeMainText, { color: colors.text }]}>Close Log</Text>
                    </TouchableOpacity>
                </View>

                {/* Edit Modal */}
                <EditLogEntryModal
                    visible={!!editEntry}
                    onClose={() => setEditEntry(null)}
                    entry={editEntry}
                    roster={roster}
                    activePlayerIds={activePlayers}
                    onSave={(updates) => {
                        if (editEntry && onUpdateLog) {
                            onUpdateLog(editEntry.id, updates);
                        }
                    }}
                />
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    closeBtn: {
        padding: 4,
    },
    listContent: {
        paddingVertical: 16,
        paddingBottom: 120, // Space for footer
    },
    logRow: {
        flexDirection: 'row',
        alignItems: 'flex-start', // Top align for multi-line
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    adminRow: {
    },
    timeContainer: {
        width: 50,
        marginRight: 8,
    },
    timestamp: {
        fontSize: 11,
        textAlign: 'right',
    },
    eventContainer: {
        flex: 1,
        paddingHorizontal: 4,
    },
    rallyContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
    },
    actionTouchable: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    editIcon: {
        marginLeft: 4,
        marginRight: 4,
    },
    logType: {
        fontSize: 14,
        lineHeight: 20,
    },
    adminText: {
        fontSize: 13,
        fontStyle: 'italic',
    },
    scoreContainer: {
        width: 50,
        alignItems: 'flex-end',
        marginLeft: 8,
    },
    scoreText: {
        fontSize: 13,
        fontWeight: '500',
    },
    empty: {
        textAlign: 'center',
        marginTop: 40,
        fontStyle: 'italic',
    },
    setHeader: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        marginTop: 8,
    },
    setHeaderText: {
        fontWeight: 'bold',
        fontSize: 14,
    },
    logScore: {
        fontWeight: 'bold',
    },
    // Footer & Scroll Indicator
    footer: {
        padding: 20,
        paddingBottom: 32, // Safe Area padding mimic
        borderTopWidth: 1,
        // Shadow for "Floating" effect
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 10,
    },
    closeMainBtn: {
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    closeMainText: {
        fontSize: 16,
        fontWeight: '700',
    },
    scrollIndicator: {
        position: 'absolute',
        bottom: 100, // Above footer
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 10,
    },
    scrollText: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    }
});
