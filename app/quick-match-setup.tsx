import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight, Play, Plus, Trash2, Users } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../contexts/ThemeContext';
import { useDataStore } from '../store/useDataStore';
import { useMatchStore } from '../store/useMatchStore';
import { LineupPosition, MatchConfig, Player } from '../types';

export default function QuickMatchSetup() {
    const router = useRouter();
    const { colors, spacing, radius } = useAppTheme();
    const { seasons } = useDataStore();
    const { setSetup } = useMatchStore();

    // Team names
    const [myTeamName, setMyTeamName] = useState('My Team');
    const [opponentName, setOpponentName] = useState('Opponent');

    // Players
    const [players, setPlayers] = useState<Player[]>([]);
    const [playerInput, setPlayerInput] = useState('');
    const [bulkInput, setBulkInput] = useState('');
    const [bulkMode, setBulkMode] = useState(false);
    const [showRoster, setShowRoster] = useState(false);

    // Match format
    const [totalSets, setTotalSets] = useState<3 | 5>(3);

    const config: MatchConfig = totalSets === 3
        ? {
            presetName: '3-Set',
            totalSets: 3,
            sets: [
                { targetScore: 25, winBy: 2, cap: 100 },
                { targetScore: 25, winBy: 2, cap: 100 },
                { targetScore: 15, winBy: 2, cap: 100 },
            ],
            timeoutsPerSet: 2,
            subsPerSet: 15,
        }
        : {
            presetName: '5-Set',
            totalSets: 5,
            sets: [
                { targetScore: 25, winBy: 2, cap: 100 },
                { targetScore: 25, winBy: 2, cap: 100 },
                { targetScore: 25, winBy: 2, cap: 100 },
                { targetScore: 25, winBy: 2, cap: 100 },
                { targetScore: 15, winBy: 2, cap: 100 },
            ],
            timeoutsPerSet: 2,
            subsPerSet: 15,
        };

    const parsePlayerInput = (text: string): { jerseyNumber: string; name: string } | null => {
        const trimmed = text.trim();
        if (!trimmed) return null;

        // Try "# Name" format (e.g., "7 Sarah", "12 Maria Jones")
        const match = trimmed.match(/^(\d+)\s+(.+)$/);
        if (match) {
            return { jerseyNumber: match[1], name: match[2].trim() };
        }

        // Try just a number (e.g., "7")
        if (/^\d+$/.test(trimmed)) {
            return { jerseyNumber: trimmed, name: '' };
        }

        // Try just a name
        return { jerseyNumber: String(players.length + 1), name: trimmed };
    };

    const addPlayer = () => {
        const parsed = parsePlayerInput(playerInput);
        if (!parsed) return;

        // Check for duplicate jersey number
        if (players.some(p => p.jerseyNumber === parsed.jerseyNumber)) {
            Alert.alert('Duplicate', `Jersey #${parsed.jerseyNumber} is already on the roster.`);
            return;
        }

        const newPlayer: Player = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            jerseyNumber: parsed.jerseyNumber,
            name: parsed.name,
            positions: [],
        };

        setPlayers(prev => [...prev, newPlayer]);
        setPlayerInput('');
    };

    // Batch add: parse multiple lines into players
    const addPlayersFromText = (text: string) => {
        const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) return;

        const newPlayers: Player[] = [];
        const existingNumbers = new Set(players.map(p => p.jerseyNumber));

        let autoNumber = players.length + 1;
        lines.forEach(line => {
            const parsed = parsePlayerInput(line);
            if (!parsed) return;

            // Auto-increment jersey if "just a name" produced a duplicate
            let jersey = parsed.jerseyNumber;
            while (existingNumbers.has(jersey) || newPlayers.some(p => p.jerseyNumber === jersey)) {
                jersey = String(autoNumber++);
            }

            newPlayers.push({
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                jerseyNumber: jersey,
                name: parsed.name,
                positions: [],
            });
        });

        if (newPlayers.length > 0) {
            setPlayers(prev => [...prev, ...newPlayers]);
            setBulkInput('');
            setBulkMode(false);
        }
    };

    // Detect paste with newlines in single-line input → auto-batch
    const handlePlayerInputChange = (text: string) => {
        if (text.includes('\n')) {
            addPlayersFromText(text);
        } else {
            setPlayerInput(text);
        }
    };

    const removePlayer = (id: string) => {
        setPlayers(prev => prev.filter(p => p.id !== id));
    };

    const importFromSeason = (seasonId: string) => {
        const season = seasons.find(s => s.id === seasonId);
        if (!season) return;

        setPlayers(season.roster || []);
        if (season.teamName) setMyTeamName(season.teamName);
        setShowRoster(true);
    };

    const handleStartMatch = () => {
        // Create empty lineup positions — players assign themselves in the match UI
        const emptyLineup: LineupPosition[] = ([1, 2, 3, 4, 5, 6] as const).map(pos => ({
            position: pos,
            playerId: null,
            isLibero: false,
        }));

        const lineups: Record<number, LineupPosition[]> = {};
        for (let i = 1; i <= config.totalSets; i++) {
            lineups[i] = emptyLineup;
        }

        setSetup(
            myTeamName,
            opponentName,
            config,
            undefined, // No season
            undefined, // No event
            undefined, // Auto-generate match ID
            lineups,
            players.length > 0 ? players : undefined
        );

        router.push('/live');
    };

    const handleJustPlay = () => {
        setSetup(myTeamName, opponentName, config);
        router.push('/live');
    };

    // Seasons that have rosters
    const seasonsWithRosters = seasons.filter(s => s.roster && s.roster.length > 0);

    // Memoized theme-dependent styles for render stability
    const themedStyles = useMemo(() => StyleSheet.create({
        container: { backgroundColor: colors.bg },
        header: { backgroundColor: colors.headerBg, borderBottomColor: colors.headerBorder },
        headerTitle: { color: colors.text },
        input: { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text },
        label: { color: colors.text },
        card: { backgroundColor: colors.bgCard, borderColor: colors.border },
        startBtn: { backgroundColor: colors.buttonPrimary },
        startBtnText: { color: colors.buttonPrimaryText },
    }), [colors]);

    return (
        <SafeAreaView style={[styles.container, themedStyles.container]}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {/* Header */}
                <View style={[styles.header, themedStyles.header]}>
                    <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }} hitSlop={8}>
                        <ArrowLeft size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, themedStyles.headerTitle]}>Quick Match</Text>
                    <View style={{ width: 50 }} />
                </View>

                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Just Score Button */}
                    <TouchableOpacity
                        style={[styles.justPlayBtn, { backgroundColor: colors.buttonPrimary }]}
                        onPress={handleJustPlay}
                        activeOpacity={0.8}
                    >
                        <View style={styles.justPlayContent}>
                            <Play size={24} color={colors.buttonPrimaryText} fill={colors.buttonPrimaryText} />
                            <View>
                                <Text style={[styles.justPlayTitle, { color: colors.buttonPrimaryText }]}>Just Score</Text>
                                <Text style={[styles.justPlaySub, { color: colors.buttonPrimaryText, opacity: 0.8 }]}>
                                    No lineup, track score only
                                </Text>
                            </View>
                        </View>
                        <ChevronRight size={20} color={colors.buttonPrimaryText} style={{ opacity: 0.6 }} />
                    </TouchableOpacity>

                    {/* Divider */}
                    <View style={styles.dividerRow}>
                        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                        <Text style={[styles.dividerText, { color: colors.textTertiary }]}>or set up a lineup</Text>
                        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                    </View>

                    {/* Team Names */}
                    <View style={[styles.section, { backgroundColor: colors.bgCard }]}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Teams</Text>
                        <View style={styles.teamNameRow}>
                            <View style={styles.teamNameCol}>
                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Your Team</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                                    value={myTeamName}
                                    onChangeText={setMyTeamName}
                                    placeholder="My Team"
                                    placeholderTextColor={colors.placeholder}
                                />
                            </View>
                            <Text style={[styles.vsText, { color: colors.textTertiary }]}>vs</Text>
                            <View style={styles.teamNameCol}>
                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Opponent</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                                    value={opponentName}
                                    onChangeText={setOpponentName}
                                    placeholder="Opponent"
                                    placeholderTextColor={colors.placeholder}
                                />
                            </View>
                        </View>
                    </View>

                    {/* Match Format */}
                    <View style={[styles.section, { backgroundColor: colors.bgCard }]}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Match Format</Text>
                        <View style={styles.formatRow}>
                            <TouchableOpacity
                                style={[
                                    styles.formatOption,
                                    { borderColor: colors.border, borderWidth: 1 },
                                    totalSets === 3 && { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primaryLight },
                                ]}
                                onPress={() => setTotalSets(3)}
                            >
                                <Text style={[
                                    styles.formatText,
                                    { color: colors.textSecondary },
                                    totalSets === 3 && { color: colors.primary, fontWeight: '700' },
                                ]}>Best of 3</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.formatOption,
                                    { borderColor: colors.border, borderWidth: 1 },
                                    totalSets === 5 && { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primaryLight },
                                ]}
                                onPress={() => setTotalSets(5)}
                            >
                                <Text style={[
                                    styles.formatText,
                                    { color: colors.textSecondary },
                                    totalSets === 5 && { color: colors.primary, fontWeight: '700' },
                                ]}>Best of 5</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Players Section */}
                    <View style={[styles.section, { backgroundColor: colors.bgCard }]}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Players</Text>
                        <Text style={[styles.sectionHint, { color: colors.textTertiary }]}>
                            Add at least 6 players to enable rotation tracking
                        </Text>

                        {/* Import from existing team */}
                        {seasonsWithRosters.length > 0 && players.length === 0 && (
                            <View style={{ marginBottom: 16 }}>
                                <Text style={[styles.importLabel, { color: colors.textSecondary }]}>Import from team</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, paddingHorizontal: 16 }}>
                                    {seasonsWithRosters.map(season => (
                                        <TouchableOpacity
                                            key={season.id}
                                            style={[styles.importChip, { backgroundColor: colors.bg, borderColor: colors.border }]}
                                            onPress={() => importFromSeason(season.id)}
                                        >
                                            <Users size={14} color={colors.primary} />
                                            <Text style={[styles.importChipText, { color: colors.text }]}>
                                                {season.teamName}
                                            </Text>
                                            <Text style={[styles.importChipCount, { color: colors.textTertiary }]}>
                                                ({season.roster.length})
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {/* Bulk mode toggle */}
                        <TouchableOpacity
                            onPress={() => setBulkMode(!bulkMode)}
                            style={{ marginBottom: 8 }}
                        >
                            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.link }}>
                                {bulkMode ? 'Switch to single entry' : 'Bulk Add (paste a roster)'}
                            </Text>
                        </TouchableOpacity>

                        {bulkMode ? (
                            /* Bulk add: multi-line TextInput */
                            <View style={{ gap: 10 }}>
                                <TextInput
                                    style={[styles.addInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, minHeight: 120, textAlignVertical: 'top' }]}
                                    value={bulkInput}
                                    onChangeText={setBulkInput}
                                    placeholder={"One player per line:\n7 Sarah\n12 Maria\n3 Jen"}
                                    placeholderTextColor={colors.placeholder}
                                    multiline
                                    autoCapitalize="words"
                                />
                                <TouchableOpacity
                                    style={[styles.addBtn, { backgroundColor: colors.primary, width: '100%', height: 44, borderRadius: 8, flexDirection: 'row', gap: 8 }]}
                                    onPress={() => addPlayersFromText(bulkInput)}
                                    disabled={!bulkInput.trim()}
                                >
                                    <Plus size={18} color="#ffffff" />
                                    <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>Add All</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                        /* Quick add input (single-line, with paste detection) */
                        <View style={styles.addRow}>
                            <TextInput
                                style={[styles.addInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                                value={playerInput}
                                onChangeText={handlePlayerInputChange}
                                placeholder="# Name (e.g., 7 Sarah)"
                                placeholderTextColor={colors.placeholder}
                                onSubmitEditing={addPlayer}
                                returnKeyType="done"
                                autoCapitalize="words"
                            />
                            <TouchableOpacity
                                style={[styles.addBtn, { backgroundColor: colors.primary }]}
                                onPress={addPlayer}
                                disabled={!playerInput.trim()}
                            >
                                <Plus size={20} color="#ffffff" />
                            </TouchableOpacity>
                        </View>
                        )}

                        {/* Player list */}
                        {players.length > 0 && (
                            <View style={styles.playerList}>
                                {players.map((player, idx) => (
                                    <View
                                        key={player.id}
                                        style={[
                                            styles.playerItem,
                                            { borderBottomColor: colors.divider },
                                            idx < 6 && { opacity: 1 },
                                            idx >= 6 && { opacity: 0.6 },
                                        ]}
                                    >
                                        <View style={styles.playerLeft}>
                                            {idx < 6 && (
                                                <View style={[styles.positionBadge, { backgroundColor: colors.primaryLight }]}>
                                                    <Text style={[styles.positionText, { color: colors.primary }]}>P{idx + 1}</Text>
                                                </View>
                                            )}
                                            <Text style={[styles.playerNumber, { color: colors.primary }]}>
                                                #{player.jerseyNumber}
                                            </Text>
                                            <Text style={[styles.playerName, { color: colors.text }]}>
                                                {player.name || '(no name)'}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => removePlayer(player.id)}
                                            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                                            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            <Trash2 size={16} color={colors.textTertiary} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                {players.length > 0 && players.length < 6 && (
                                    <Text style={[styles.playerCountHint, { color: colors.warning }]}>
                                        {6 - players.length} more player{6 - players.length !== 1 ? 's' : ''} needed for lineup tracking
                                    </Text>
                                )}
                                {players.length >= 6 && (
                                    <Text style={[styles.playerCountHint, { color: colors.success }]}>
                                        Assign players to positions in the match
                                    </Text>
                                )}
                            </View>
                        )}
                    </View>

                    {/* Start Match (with roster) */}
                    {players.length > 0 && (
                        <TouchableOpacity
                            style={[styles.startBtn, { backgroundColor: colors.buttonPrimary }]}
                            onPress={handleStartMatch}
                            activeOpacity={0.8}
                        >
                            <Play size={22} color={colors.buttonPrimaryText} fill={colors.buttonPrimaryText} />
                            <Text style={[styles.startBtnText, { color: colors.buttonPrimaryText }]}>
                                Start Match{players.length >= 6 ? ' with Lineup' : ''}
                            </Text>
                        </TouchableOpacity>
                    )}

                    <View style={{ height: 40 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
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
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    content: {
        padding: 20,
    },
    justPlayBtn: {
        borderRadius: 16,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    justPlayContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    justPlayTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    justPlaySub: {
        fontSize: 13,
        fontWeight: '500',
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
        gap: 12,
    },
    dividerLine: {
        flex: 1,
        height: 1,
    },
    dividerText: {
        fontSize: 13,
        fontWeight: '500',
    },
    section: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    sectionHint: {
        fontSize: 13,
        fontWeight: '400',
        marginBottom: 16,
    },
    teamNameRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
        marginTop: 8,
    },
    teamNameCol: {
        flex: 1,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    input: {
        borderWidth: 1,
        borderRadius: 8, // radius.sm — standardized
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        fontWeight: '600',
    },
    vsText: {
        fontSize: 14,
        fontWeight: '600',
        paddingBottom: 14,
    },
    formatRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    formatOption: {
        flex: 1,
        borderRadius: 8, // radius.sm — standardized
        paddingVertical: 12,
        alignItems: 'center',
    },
    formatText: {
        fontSize: 15,
        fontWeight: '600',
    },
    importLabel: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    importChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 8, // radius.sm — standardized
        borderWidth: 1,
        marginRight: 10,
    },
    importChipText: {
        fontSize: 14,
        fontWeight: '600',
    },
    importChipCount: {
        fontSize: 12,
        fontWeight: '500',
    },
    addRow: {
        flexDirection: 'row',
        gap: 10,
    },
    addInput: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 8, // radius.sm — standardized
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
    },
    addBtn: {
        width: 48,
        height: 48,
        borderRadius: 8, // radius.sm — standardized
        alignItems: 'center',
        justifyContent: 'center',
    },
    playerList: {
        marginTop: 16,
    },
    playerItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    playerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    positionBadge: {
        width: 28,
        height: 20,
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    positionText: {
        fontSize: 11,
        fontWeight: '700',
    },
    playerNumber: {
        fontSize: 15,
        fontWeight: '700',
        minWidth: 32,
    },
    playerName: {
        fontSize: 15,
        fontWeight: '500',
    },
    playerCountHint: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 10,
        textAlign: 'center',
    },
    startBtn: {
        borderRadius: 16, // radius.lg — standardized
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    startBtnText: {
        fontSize: 18,
        fontWeight: '700',
    },
});
