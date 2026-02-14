import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronDown, ChevronUp, Minus, Plus, Settings2, Trash2, User } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useDataStore } from '../../store/useDataStore';
import { useMatchStore } from '../../store/useMatchStore';
import { LineupPosition, MatchConfig, MatchRecord, Player, SetConfig } from '../../types';

/* 
  Refactored Setup Screen
  - Integrated "Custom Rules" into the main flow (expandable config)
  - Layout optimization
*/

export default function MatchSetupScreen() {
    const router = useRouter();
    const isPad = (Platform as any).isPad;
    const params = useLocalSearchParams<{ seasonId?: string; eventId?: string; matchId?: string; mode?: string }>();
    const { colors, isDark } = useAppTheme();
    const {
        setSetup,
        updateMatchSettings,
        myTeamName: storedMyTeam,
        opponentName: storedOpponent,
        activeSeasonId: storedSeasonId,
        config: storedConfig,
        lineups: storedLineups
    } = useMatchStore();
    const { seasons, saveMatchRecord, savedMatches, events } = useDataStore();

    // Animation for Scroll Indicator
    const translateY = useSharedValue(0);
    useEffect(() => {
        translateY.value = withRepeat(
            withTiming(6, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, []);

    const animatedChevronStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }]
    }));

    // Check if editing
    const existingMatch = params.matchId ? savedMatches.find(m => m.id === params.matchId) : null;
    const activeEvent = params.eventId ? events.find(e => e.id === params.eventId) : null;

    // Resolve Season: Param > Store > null
    const targetSeasonId = params.seasonId || storedSeasonId;
    const activeSeason = targetSeasonId ? seasons.find(s => s.id === targetSeasonId) : null;

    // Derived myTeam name - not editable here to ensure consistency
    const myTeam = activeSeason ? activeSeason.teamName : 'My Team';

    // Initialize State
    const [opponent, setOpponent] = useState(existingMatch?.opponentName || storedOpponent || '');
    const [matchDate, setMatchDate] = useState(
        existingMatch?.date ||
        (activeEvent ? activeEvent.startDate : Date.now())
    );

    // Initialize Time State
    // If existing match, parse the time string back to a Date object (approximate date, correct time)
    // If no existing match, default to 8:00 AM
    const getInitialTime = () => {
        const d = new Date();
        if (existingMatch?.time) {
            const [time, modifier] = existingMatch.time.split(' ');
            if (time) {
                let [hours, minutes] = time.split(':');
                if (hours === '12') hours = '0';
                if (modifier === 'PM') hours = (parseInt(hours, 10) + 12).toString();
                d.setHours(parseInt(hours, 10));
                d.setMinutes(parseInt(minutes, 10));
                return d;
            }
        } else {
            // Default to 8:00 AM
            d.setHours(8);
            d.setMinutes(0);
        }
        return d;
    };

    const [timeDate, setTimeDate] = useState(getInitialTime());
    const [matchTime, setMatchTime] = useState(existingMatch?.time || '8:00 AM');

    // Picker State
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    // Helpers
    const onDateChange = (event: any, selectedDate?: Date) => {
        const currentDate = selectedDate || new Date(matchDate);
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
        }
        setMatchDate(currentDate.getTime());
    };

    const onTimeChange = (event: any, selectedDate?: Date) => {
        const currentDate = selectedDate || timeDate;
        if (Platform.OS === 'android') {
            setShowTimePicker(false);
        }
        setTimeDate(currentDate);
        const timeStr = currentDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        setMatchTime(timeStr);
    };

    // Config State
    // If resume mode, use storedConfig. If existing match, use existingMatch.config.
    const initialConfig = params.mode === 'resume' ? storedConfig : existingMatch?.config;
    const [preset, setPreset] = useState<MatchConfig['presetName']>(initialConfig?.presetName || '3-Set');
    const [totalSets, setTotalSets] = useState(initialConfig?.totalSets || 3);
    const [setsConfig, setSetsConfig] = useState<SetConfig[]>(initialConfig?.sets || [
        { targetScore: 25, winBy: 2, cap: 100 },
        { targetScore: 25, winBy: 2, cap: 100 },
        { targetScore: 15, winBy: 2, cap: 100 },
    ]);

    // Custom Rules State
    const [timeoutsPerSet, setTimeoutsPerSet] = useState(initialConfig?.timeoutsPerSet || 2);
    const [subsPerSet, setSubsPerSet] = useState(initialConfig?.subsPerSet || 15);

    // UI State
    const [isConfigExpanded, setIsConfigExpanded] = useState(false);
    const [activeSetTab, setActiveSetTab] = useState(0);

    // --- LINEUP STATE ---
    // If resume mode, use storedLineups. If existingMatch, use that.
    const initialLineups = params.mode === 'resume' ? (storedLineups || {}) : (existingMatch?.lineups || {});
    const [lineups, setLineups] = useState<Record<number, LineupPosition[]>>(initialLineups);
    // Start at Set 1
    const [activeLineupSet, setActiveLineupSet] = useState(1);

    // Player Picker State
    const [showPlayerPicker, setShowPlayerPicker] = useState(false);
    const [editingSlot, setEditingSlot] = useState<{ pos: number; current: LineupPosition | undefined } | null>(null);

    // Player Picker Sort
    const [pickerSortBy, setPickerSortBy] = useState<'name' | 'jersey'>('name');
    const sortedPickerRoster = useMemo(() => {
        return [...(activeSeason?.roster || [])].sort((a, b) => {
            if (pickerSortBy === 'jersey') {
                const numA = parseInt(a.jerseyNumber, 10);
                const numB = parseInt(b.jerseyNumber, 10);
                if (isNaN(numA)) return 1;
                if (isNaN(numB)) return -1;
                return numA - numB;
            }
            return a.name.localeCompare(b.name);
        });
    }, [activeSeason?.roster, pickerSortBy]);

    // Helper: Initialize a default empty lineup
    const createEmptyLineup = (): LineupPosition[] => {
        return [1, 2, 3, 4, 5, 6].map(p => ({
            position: p as any,
            playerId: null,
            isLibero: false
        }));
    };

    // Helper: Get lineup for active set with CASCADE logic
    // If the requested set is empty, and a previous set exists, copy it.
    const getOrCascadeLineup = (setNum: number): LineupPosition[] => {
        if (lineups[setNum]) return lineups[setNum];

        // Try to find previous set
        if (setNum > 1 && lineups[setNum - 1]) {
            // Deep copy to avoid reference issues
            const prev = lineups[setNum - 1].map(p => ({ ...p }));
            // We don't save strictly yet, just return for render/init
            return prev;
        }

        return createEmptyLineup();
    };

    // Handler: When switching tabs, ensure we initialize/cascade if needed
    const handleLineupTabPress = (setNum: number) => {
        if (!lineups[setNum]) {
            const newLineup = getOrCascadeLineup(setNum);
            setLineups(prev => ({ ...prev, [setNum]: newLineup }));
        }
        setActiveLineupSet(setNum);
    };

    // Ensure Set 1 is initialized on mount if empty
    useEffect(() => {
        if (!lineups[1]) {
            setLineups(prev => ({ ...prev, 1: createEmptyLineup() }));
        }
    }, []);

    // Handler: Open Picker
    const openPlayerPicker = (pos: number) => {
        const currentLineup = lineups[activeLineupSet] || createEmptyLineup();
        const slot = currentLineup.find(p => p.position === pos);
        setEditingSlot({ pos, current: slot });
        setShowPlayerPicker(true);
    };

    // Handler: Select Player
    const handleSelectPlayer = (player: Player | null) => {
        const currentLineup = [...(lineups[activeLineupSet] || createEmptyLineup())];
        const idx = currentLineup.findIndex(p => p.position === editingSlot?.pos);

        if (idx !== -1) {
            currentLineup[idx] = {
                ...currentLineup[idx],
                playerId: player ? player.id : null,
                isLibero: false, // Reset/Ignore
                designatedSubId: null
            };
            setLineups(prev => ({ ...prev, [activeLineupSet]: currentLineup }));
        }
        setShowPlayerPicker(false);
        setEditingSlot(null);
    };

    // Apply Presets
    const applyPreset = (name: MatchConfig['presetName']) => {
        setPreset(name);
        if (name === '3-Set') {
            setTotalSets(3);
            setSetsConfig([
                { targetScore: 25, winBy: 2, cap: 100 },
                { targetScore: 25, winBy: 2, cap: 100 },
                { targetScore: 15, winBy: 2, cap: 100 },
            ]);
        } else if (name === '5-Set') {
            setTotalSets(5);
            setSetsConfig([
                { targetScore: 25, winBy: 2, cap: 100 },
                { targetScore: 25, winBy: 2, cap: 100 },
                { targetScore: 25, winBy: 2, cap: 100 },
                { targetScore: 25, winBy: 2, cap: 100 },
                { targetScore: 15, winBy: 2, cap: 100 },
            ]);
        } else if (name === '2-Set-Seeding') {
            setTotalSets(2);
            setSetsConfig([
                { targetScore: 25, winBy: 2, cap: 27 },
                { targetScore: 25, winBy: 2, cap: 27 },
            ]);
        }
    };

    const updateSetConfig = (index: number, field: keyof SetConfig, value: number) => {
        const newConfigs = [...setsConfig];
        // Ensure cap >= target
        // Ensure valid numbers
        if (value < 0) return;

        newConfigs[index] = { ...newConfigs[index], [field]: value };
        setSetsConfig(newConfigs);
        // If Custom
        setPreset('Custom');
    };

    const activeMatchId = useMatchStore(s => s.matchId);

    // Resume Condition: Explicit mode OR we are editing the currently active match
    const isResume = params.mode === 'resume' || (!!params.matchId && params.matchId === activeMatchId);

    const handleStartMatch = () => {
        const config: MatchConfig = {
            presetName: preset,
            totalSets,
            sets: setsConfig,
            timeoutsPerSet,
            subsPerSet
        };

        if (isResume && params.matchId) {
            // Update settings but don't reset score/history
            updateMatchSettings(params.matchId, myTeam, opponent, config, lineups);
            // Go to live match (replace ensures we don't back into setup)
            router.replace('/live');
        } else {
            // New Match or Overwrite
            setSetup(myTeam, opponent, config, params.seasonId, params.eventId, params.matchId, lineups, activeSeason?.roster || []);
            if (params.seasonId) {
                useDataStore.getState().touchSeason(params.seasonId);
            }
            router.replace('/live');
        }
    };

    const handleScheduleMatch = () => {
        // Create a scheduled match record
        const matchRec: MatchRecord = {
            id: params.matchId || Date.now().toString(), // Use existing ID if editing
            seasonId: params.seasonId,
            eventId: params.eventId,
            opponentName: opponent,
            date: matchDate,
            time: matchTime,
            result: existingMatch?.result || 'Scheduled', // Preserve status if editing
            setsWon: existingMatch?.setsWon || { myTeam: 0, opponent: 0 },
            scores: existingMatch?.scores || [],
            history: existingMatch?.history || [],
            config: {
                presetName: preset,
                totalSets,
                sets: setsConfig,
                timeoutsPerSet,
                subsPerSet
            },
            lineups // Save the lineups
        };
        saveMatchRecord(matchRec);
        if (params.seasonId) {
            useDataStore.getState().touchSeason(params.seasonId);
        }
        router.back();
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bgCard }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>

                    <View style={[styles.headerRow, { backgroundColor: colors.bgCard }]}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn}>
                            <Text style={[styles.cancelBtnText, { color: colors.opponent }]}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>{params.matchId ? 'Edit Match' : 'New Match'}</Text>

                        {/* Reset Button (Only if NOT resuming, or if user explicitly wants to reset active match) */}
                        {isResume ? (
                            <TouchableOpacity onPress={() => {
                                Alert.alert(
                                    "Reset Match?",
                                    "This will clear the current score and history. Are you sure?",
                                    [
                                        { text: "Cancel", style: "cancel" },
                                        {
                                            text: "Reset", style: "destructive", onPress: () => {
                                                useMatchStore.getState().resetMatch();
                                                Alert.alert("Match Reset", "The match has been reset.");
                                                router.replace('/live'); // Go to live fresh
                                            }
                                        }
                                    ]
                                );
                            }}>
                                <Text style={[styles.cancelBtnText, { color: colors.opponent }]}>Reset</Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={{ width: 40 }} />
                        )}
                    </View>

                    {/* Context Info (Header) */}
                    {(activeSeason || activeEvent) && (
                        <View style={styles.contextHeader}>
                            {activeSeason && (
                                <View>
                                    <Text style={[styles.contextLabel, { color: colors.textTertiary }]}>SEASON</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
                                        <Text style={[styles.contextValue, { color: colors.text }]}>{activeSeason.name}</Text>
                                        <Text style={[styles.contextSub, { color: colors.textSecondary }]}>{activeSeason.teamName}</Text>
                                    </View>
                                </View>
                            )}
                            {activeEvent && (
                                <View style={{ marginTop: 12 }}>
                                    <Text style={[styles.contextLabel, { color: colors.textTertiary }]}>EVENT</Text>
                                    <Text style={[styles.contextValue, { color: colors.text }]}>{activeEvent.name}</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Match Details Section */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Match Details</Text>

                        {/* Opponent Input */}
                        <View style={styles.inputRow}>
                            <View style={[styles.inputContainer, { borderBottomColor: colors.border }]}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>Opponent</Text>
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    value={opponent}
                                    onChangeText={setOpponent}
                                    placeholder="Enter Opponent Name"
                                    placeholderTextColor={colors.textTertiary}
                                //                                     autoFocus={!params.matchId}
                                />
                            </View>
                        </View>

                        {/* Metadata (Date, Time) */}
                        <View style={[styles.inputRow, { flexDirection: 'row', gap: 24, marginBottom: 0 }]}>
                            {/* Date Input */}
                            <View style={[styles.inputContainer, { flex: 1, borderBottomColor: colors.border }]}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>Date</Text>
                                {Platform.OS === 'ios' ? (
                                    <DateTimePicker
                                        value={new Date(matchDate)}
                                        mode="date"
                                        display="compact"
                                        onChange={onDateChange}
                                        themeVariant={isDark ? 'dark' : 'light'}
                                        style={{ alignSelf: 'flex-start', marginLeft: -10 }}
                                    />
                                ) : (
                                    <>
                                        <TouchableOpacity
                                            onPress={() => setShowDatePicker(true)}
                                        >
                                            <Text style={[styles.input, { color: colors.text }]}>{new Date(matchDate).toLocaleDateString()}</Text>
                                        </TouchableOpacity>
                                        {showDatePicker && (
                                            <DateTimePicker
                                                value={new Date(matchDate)}
                                                mode="date"
                                                display="default"
                                                onChange={onDateChange}
                                            />
                                        )}
                                    </>
                                )}
                            </View>

                            {/* Time Input */}
                            <View style={[styles.inputContainer, { flex: 1, borderBottomColor: colors.border }]}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>Time</Text>
                                {Platform.OS === 'ios' ? (
                                    <DateTimePicker
                                        value={timeDate}
                                        mode="time"
                                        display="compact"
                                        onChange={onTimeChange}
                                        themeVariant={isDark ? 'dark' : 'light'}
                                        style={{ alignSelf: 'flex-start', marginLeft: -10 }}
                                    />
                                ) : (
                                    <>
                                        <TouchableOpacity
                                            onPress={() => setShowTimePicker(true)}
                                        >
                                            <Text style={[styles.input, !matchTime && { color: colors.textTertiary }, { color: colors.text }]}>
                                                {matchTime || 'Set Time'}
                                            </Text>
                                        </TouchableOpacity>
                                        {showTimePicker && (
                                            <DateTimePicker
                                                value={timeDate}
                                                mode="time"
                                                display="default"
                                                onChange={onTimeChange}
                                            />
                                        )}
                                    </>
                                )}
                            </View>
                        </View>
                    </View>

                    {/* Quick Config */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Match Format</Text>

                        <View style={styles.presetRow}>
                            {(['3-Set', '5-Set', '2-Set-Seeding'] as const).map((p) => (
                                <TouchableOpacity
                                    key={p}
                                    style={[styles.presetBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }, preset === p && { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
                                    onPress={() => applyPreset(p)}
                                >
                                    <Text style={[styles.presetBtnText, { color: colors.textSecondary }, preset === p && { color: colors.primary }]}>
                                        {p === '2-Set-Seeding' ? '2-Set' : p}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={[styles.expandConfigBtn, { marginTop: 16, backgroundColor: colors.bgCard, borderColor: colors.border }]}
                            onPress={() => setIsConfigExpanded(!isConfigExpanded)}
                        >
                            <Settings2 size={18} color={colors.primary} />
                            <Text style={[styles.expandConfigText, { color: colors.textSecondary }]}>
                                {isConfigExpanded ? 'Hide Advanced Rules' : 'Customize Rules & Scoring'}
                            </Text>
                            {isConfigExpanded ? <ChevronUp size={18} color={colors.primary} /> : <ChevronDown size={18} color={colors.primary} />}
                        </TouchableOpacity>

                        {/* Expanded Configuration */}
                        {isConfigExpanded && (
                            <View style={[styles.advancedConfig, { backgroundColor: colors.bgCard, borderTopColor: colors.border, borderBottomColor: colors.border }]}>

                                {/* Global Rules */}
                                <View style={styles.rulesRow}>
                                    <View style={[styles.ruleItem, { borderBottomColor: colors.border }]}>
                                        <Text style={[styles.ruleLabel, { color: colors.text }]}>Timeouts</Text>
                                        <View style={[styles.stepper, { backgroundColor: colors.buttonSecondary }]}>
                                            <TouchableOpacity onPress={() => setTimeoutsPerSet(Math.max(0, timeoutsPerSet - 1))}>
                                                <Minus size={16} color={colors.textSecondary} />
                                            </TouchableOpacity>
                                            <Text style={[styles.stepperValue, { color: colors.text }]}>{timeoutsPerSet}</Text>
                                            <TouchableOpacity onPress={() => setTimeoutsPerSet(timeoutsPerSet + 1)}>
                                                <Plus size={16} color={colors.textSecondary} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    <View style={[styles.ruleItem, { borderBottomColor: colors.border }]}>
                                        <Text style={[styles.ruleLabel, { color: colors.text }]}>Subs</Text>
                                        <View style={[styles.stepper, { backgroundColor: colors.buttonSecondary }]}>
                                            <TouchableOpacity onPress={() => setSubsPerSet(Math.max(0, subsPerSet - 1))}>
                                                <Minus size={16} color={colors.textSecondary} />
                                            </TouchableOpacity>
                                            <Text style={[styles.stepperValue, { color: colors.text }]}>{subsPerSet}</Text>
                                            <TouchableOpacity onPress={() => setSubsPerSet(subsPerSet + 1)}>
                                                <Plus size={16} color={colors.textSecondary} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>

                                {/* Per-Set tabs */}
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
                                    {setsConfig.map((_, idx) => (
                                        <TouchableOpacity
                                            key={idx}
                                            style={[styles.tab, { backgroundColor: colors.bgCard, borderColor: colors.border }, activeSetTab === idx && { backgroundColor: colors.text, borderColor: colors.text }]}
                                            onPress={() => setActiveSetTab(idx)}
                                        >
                                            <Text style={[styles.tabText, { color: colors.textSecondary }, activeSetTab === idx && { color: colors.bg }]}>
                                                Set {idx + 1}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>

                                <View style={[styles.setForm, { backgroundColor: colors.buttonSecondary }]}>
                                    <View style={styles.formRow}>
                                        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Target Score</Text>
                                        <TextInput
                                            style={[styles.numInput, { backgroundColor: colors.bgCard, color: colors.text, borderColor: colors.border }]}
                                            keyboardType="number-pad"
                                            value={setsConfig[activeSetTab].targetScore.toString()}
                                            onChangeText={(t) => updateSetConfig(activeSetTab, 'targetScore', parseInt(t) || 0)}
                                        />
                                    </View>
                                    <View style={styles.formRow}>
                                        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Win By</Text>
                                        <TextInput
                                            style={[styles.numInput, { backgroundColor: colors.bgCard, color: colors.text, borderColor: colors.border }]}
                                            keyboardType="number-pad"
                                            value={setsConfig[activeSetTab].winBy.toString()}
                                            onChangeText={(t) => updateSetConfig(activeSetTab, 'winBy', parseInt(t) || 0)}
                                        />
                                    </View>
                                    <View style={styles.formRow}>
                                        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Cap</Text>
                                        <TextInput
                                            style={[styles.numInput, { backgroundColor: colors.bgCard, color: colors.text, borderColor: colors.border }]}
                                            keyboardType="number-pad"
                                            value={setsConfig[activeSetTab].cap.toString()}
                                            onChangeText={(t) => updateSetConfig(activeSetTab, 'cap', parseInt(t) || 0)}
                                        />
                                    </View>
                                    <Text style={[styles.helperText, { color: colors.textTertiary }]}>Score to win (must win by {setsConfig[activeSetTab].winBy})</Text>
                                </View>

                            </View>
                        )}

                    </View>

                    {/* LINEUP & ROSTER CARD */}
                    {activeSeason && (
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Starting Lineup</Text>

                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
                                {Array.from({ length: totalSets }).map((_, i) => {
                                    const setNum = i + 1;
                                    const isActive = activeLineupSet === setNum;
                                    return (
                                        <TouchableOpacity
                                            key={setNum}
                                            style={[styles.tab, { backgroundColor: colors.bgCard, borderColor: colors.border }, isActive && { backgroundColor: colors.text, borderColor: colors.text }]}
                                            onPress={() => handleLineupTabPress(setNum)}
                                        >
                                            <Text style={[styles.tabText, { color: colors.textSecondary }, isActive && { color: colors.bg }]}>Set {setNum}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>

                            <View style={[styles.courtContainer, { backgroundColor: colors.bgCard, borderColor: colors.border }, isPad && { minHeight: 450, padding: 32 }]}>
                                <View style={[styles.netDivider, isPad && { marginBottom: 16 }]}>
                                    <View style={[styles.netDividerLine, { backgroundColor: colors.textSecondary }]} />
                                    <Text style={[styles.netDividerLabel, { color: colors.textSecondary }]}>NET</Text>
                                    <View style={[styles.netDividerLine, { backgroundColor: colors.textSecondary }]} />
                                </View>

                                <View style={[styles.gridRow, isPad && { marginBottom: 32, marginTop: 32 }]}>
                                    {[4, 3, 2].map(pos => {
                                        const slot = (lineups[activeLineupSet] || []).find(p => p.position === pos);
                                        const player = slot?.playerId ? activeSeason.roster.find(p => p.id === slot.playerId) : null;
                                        return (
                                            <TouchableOpacity
                                                key={pos}
                                                style={[
                                                    styles.gridItem,
                                                    { borderColor: colors.border },
                                                    slot?.isLibero && styles.liberoItem,
                                                    isPad && { width: 140, height: 140 }
                                                ]}
                                                onPress={() => openPlayerPicker(pos)}
                                            >
                                                <Text style={[styles.posLabel, { color: colors.textTertiary }, isPad && { fontSize: 14, top: 8, left: 8 }]}>P{pos}</Text>
                                                {player ? (
                                                    <View style={{ alignItems: 'center' }}>
                                                        <Text style={[
                                                            styles.gridNumber,
                                                            { color: colors.text },
                                                            slot?.isLibero && { color: colors.textInverse },
                                                            isPad && { fontSize: 32 }
                                                        ]}>#{player.jerseyNumber}</Text>
                                                        <Text style={[
                                                            styles.gridName,
                                                            { color: colors.textSecondary },
                                                            slot?.isLibero && { color: colors.textInverse },
                                                            isPad && { fontSize: 14, marginTop: 4 }
                                                        ]} numberOfLines={1}>{player.name}</Text>
                                                        {slot?.isLibero && (
                                                            <View style={[styles.liberoBadge, { backgroundColor: colors.primary }, isPad && { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, bottom: -10 }]}>
                                                                <Text style={[styles.liberoText, { color: colors.textInverse }, isPad && { fontSize: 12 }]}>L</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                ) : (
                                                    <User size={isPad ? 40 : 24} color={colors.textTertiary} />
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                <View style={styles.gridRow}>
                                    {[5, 6, 1].map(pos => {
                                        const slot = (lineups[activeLineupSet] || []).find(p => p.position === pos);
                                        const player = slot?.playerId ? activeSeason.roster.find(p => p.id === slot.playerId) : null;
                                        return (
                                            <TouchableOpacity
                                                key={pos}
                                                style={[
                                                    styles.gridItem,
                                                    { borderColor: colors.border },
                                                    slot?.isLibero && styles.liberoItem,
                                                    isPad && { width: 140, height: 140 }
                                                ]}
                                                onPress={() => openPlayerPicker(pos)}
                                            >
                                                <Text style={[styles.posLabel, { color: colors.textTertiary }, isPad && { fontSize: 14, top: 8, left: 8 }]}>P{pos}</Text>
                                                {player ? (
                                                    <View style={{ alignItems: 'center' }}>
                                                        <Text style={[
                                                            styles.gridNumber,
                                                            { color: colors.text },
                                                            slot?.isLibero && { color: colors.textInverse },
                                                            isPad && { fontSize: 32 }
                                                        ]}>#{player.jerseyNumber}</Text>
                                                        <Text style={[
                                                            styles.gridName,
                                                            { color: colors.textSecondary },
                                                            slot?.isLibero && { color: colors.textInverse },
                                                            isPad && { fontSize: 14, marginTop: 4 }
                                                        ]} numberOfLines={1}>{player.name}</Text>
                                                        {slot?.isLibero && (
                                                            <View style={[styles.liberoBadge, { backgroundColor: colors.primary }, isPad && { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, bottom: -10 }]}>
                                                                <Text style={[styles.liberoText, { color: colors.textInverse }, isPad && { fontSize: 12 }]}>L</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                ) : (
                                                    <User size={isPad ? 40 : 24} color={colors.textTertiary} />
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                            <Text style={[styles.helperText, { color: colors.textTertiary }]}>
                                Set 1 lineup will automatically copy to future sets to save time.
                                You can tap other tabs to customize sets individually.
                            </Text>
                        </View>
                    )}

                </ScrollView>

                {/* Player Picker Modal */}
                <Modal visible={showPlayerPicker} animationType="slide" presentationStyle="pageSheet">
                    <View style={[styles.modalContainer, { backgroundColor: colors.bg }]}>
                        <View style={[styles.modalHeader, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>Select Player for P{editingSlot?.pos}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                                <TouchableOpacity onPress={() => setPickerSortBy(prev => prev === 'name' ? 'jersey' : 'name')}>
                                    <Text style={[styles.sortToggleText, { color: colors.primary }]}>Sort by {pickerSortBy === 'name' ? 'Jersey' : 'Name'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setShowPlayerPicker(false)}>
                                    <Text style={[styles.closeText, { color: colors.primary }]}>Close</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {activeSeason && (
                            <FlatList
                                data={[{ id: 'clear', name: 'Clear Position', jerseyNumber: '', positions: [] } as Player, ...sortedPickerRoster]}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item }: { item: Player }) => {
                                    const isAssigned = Object.values(lineups[activeLineupSet] || {}).some(
                                        s => s.playerId === item.id && s.position !== editingSlot?.pos
                                    );

                                    if (item.id === 'clear') {
                                        return (
                                            <TouchableOpacity
                                                style={[styles.rosterItem, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}
                                                onPress={() => handleSelectPlayer(null)}
                                            >
                                                <Trash2 size={20} color={colors.opponent} />
                                                <Text style={[styles.rosterName, { color: colors.opponent }]}>Clear Position</Text>
                                            </TouchableOpacity>
                                        );
                                    }

                                    return (
                                        <View style={[styles.rosterItem, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }, isAssigned && { opacity: 0.5 }]}>
                                            <TouchableOpacity
                                                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                                                disabled={isAssigned}
                                                onPress={() => {
                                                    // Default selection
                                                    handleSelectPlayer(item);
                                                }}
                                            >
                                                <View style={[styles.jerseyCircle, { backgroundColor: colors.buttonSecondary }]}>
                                                    <Text style={[styles.jerseyText, { color: colors.text }]}>{item.jerseyNumber}</Text>
                                                </View>
                                                <Text style={[styles.rosterName, { color: colors.text }]}>{item.name}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    );
                                }}
                            />
                        )}
                    </View>
                </Modal>



                {/* Scroll Indicator (Visual Hint) */}
                <Animated.View style={[styles.scrollIndicator, animatedChevronStyle]} pointerEvents="none">
                    <ChevronDown size={24} color={colors.primary} />
                    <Text style={{ fontSize: 10, color: colors.primary, marginTop: -4 }}>Scroll</Text>
                </Animated.View>

                <View style={[styles.footer, { backgroundColor: colors.bgCard }]}>
                    {!isResume && (
                        <>
                            <TouchableOpacity style={[styles.startBtn, { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, flex: 1 }]} onPress={handleScheduleMatch}>
                                <Text style={[styles.startBtnText, { color: colors.text }]}>{params.matchId ? 'Update' : 'Schedule'}</Text>
                            </TouchableOpacity>
                            <View style={{ width: 12 }} />
                        </>
                    )}
                    <TouchableOpacity style={[styles.startBtn, { backgroundColor: colors.primary, flex: 2 }]} onPress={handleStartMatch}>
                        <Text style={[styles.startBtnText, { color: '#ffffff' }]}>
                            {isResume ? 'Update & Resume Match' : 'Start Match'}
                        </Text>
                    </TouchableOpacity>
                </View>

            </KeyboardAvoidingView >
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 8,
    },
    cancelBtn: {
        padding: 8,
    },
    cancelBtnText: {
        fontSize: 16,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    // Context & Header
    contextHeader: {
        paddingHorizontal: 20,
        paddingBottom: 24,
        paddingTop: 8,
    },
    contextLabel: {
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginBottom: 6,
        fontWeight: '700',
    },
    contextValue: {
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: -0.5,
    },
    contextSub: {
        fontSize: 15,
        fontWeight: '500',
    },
    // Sections
    section: {
        marginBottom: 32,
        paddingHorizontal: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
    },
    // Form Inputs
    inputRow: {
        marginBottom: 20,
    },
    inputContainer: {
        borderBottomWidth: 1,
        paddingVertical: 8,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    input: {
        fontSize: 18,
        fontWeight: '500',
        paddingVertical: 4,
    },
    // Config & Presets
    presetRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    presetBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
    },
    presetBtnActive: {
    },
    presetBtnText: {
        fontSize: 14,
        fontWeight: '600',
    },
    presetBtnTextActive: {
    },
    expandConfigBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        // Removed margins, handled by JSX marginTop
        borderRadius: 8,
        borderWidth: 1,
    },
    expandConfigText: {
        fontSize: 14,
        fontWeight: '600',
        marginRight: 8,
    },
    advancedConfig: {
        borderTopWidth: 1,
        borderBottomWidth: 1,
        padding: 16,
        marginBottom: 24,
    },
    rulesRow: {
        marginBottom: 16,
    },
    ruleItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
    },
    ruleLabel: {
        fontSize: 15,
    },
    stepper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 8,
        padding: 4,
    },
    stepperValue: {
        fontSize: 16,
        fontWeight: '600',
        marginHorizontal: 12,
        minWidth: 20,
        textAlign: 'center',
    },
    setForm: {
        marginTop: 12,
        padding: 12,
        borderRadius: 8,
    },
    formRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    formLabel: {
        fontSize: 14,
    },
    numInput: {
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 16,
        minWidth: 60,
        textAlign: 'center',
        borderWidth: 1,
    },
    // Lineup / Tabs
    tabsScroll: {
        marginBottom: 16,
        // Removed paddingHorizontal to match section padding
    },
    scrollContent: {
        paddingBottom: 100,
    },
    tab: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 8,
        borderWidth: 1,
    },
    tabActive: {
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
    },
    tabTextActive: {
    },
    // Court Grid
    courtContainer: {
        borderRadius: 8,
        padding: 16,
        marginHorizontal: 16,
        borderWidth: 1,
        minHeight: 300,
        position: 'relative',
    },
    netDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    netDividerLine: {
        flex: 1,
        height: 2,
    },
    netDividerLabel: {
        fontSize: 10,
        fontWeight: '700',
        paddingHorizontal: 8,
    },
    gridRow: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        marginBottom: 16,
        marginTop: 16,
    },
    gridItem: {
        width: 90,
        height: 90,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    liberoItem: {
    },
    posLabel: {
        position: 'absolute',
        top: 4,
        left: 4,
        fontSize: 10,
        fontWeight: '700',
    },
    gridNumber: {
        fontSize: 20,
        fontWeight: '800',
    },
    gridName: {
        fontSize: 10,
        marginTop: 2,
    },
    liberoBadge: {
        position: 'absolute',
        bottom: -6,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    liberoText: {
        fontSize: 8,
        fontWeight: '700',
    },
    helperText: {
        fontSize: 13,
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 16,
        marginHorizontal: 20,
        lineHeight: 18,
    },
    // Footer & Modal
    // Footer & Modal
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 32 : 24,
        // Shadow for "Floating" effect
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 10,
        borderTopWidth: 0,
    },
    scrollIndicator: {
        position: 'absolute',
        bottom: 100, // Above footer
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 20,
        opacity: 0.8,
    },
    startBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    startBtnText: {
        fontSize: 16,
        fontWeight: '700',
    },
    modalContainer: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    closeText: {
        fontSize: 16,
        fontWeight: '600',
    },
    sortToggleText: {
        fontSize: 14,
        fontWeight: '600',
    },
    rosterItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    jerseyCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    jerseyText: {
        fontSize: 16,
        fontWeight: '700',
    },
    rosterName: {
        fontSize: 16,
    },
});


