import { useLocalSearchParams, useRouter } from 'expo-router';
import { BarChart2, Calendar, ChevronLeft, LayoutDashboard, MapPin, Play, Plus, Settings2, Sparkles } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MagicSummaryCard } from '../../components/ai/MagicSummaryCard';
import StatsView from '../../components/stats/StatsView';
import { AIError, GeminiService } from '../../services/ai/GeminiService';
import { useDataStore } from '../../store/useDataStore';
import { useMatchStore } from '../../store/useMatchStore';
import { StatLog } from '../../types';

export default function EventDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const events = useDataStore(state => state.events);
    const seasons = useDataStore(state => state.seasons);
    const savedMatches = useDataStore(state => state.savedMatches);
    const updateEvent = useDataStore(state => state.updateEvent); // Need this to save narrative

    // Memoize the derived matches list to prevent re-calculations and potential render loops
    const matches = useMemo(() => {
        return savedMatches
            .filter(m => m.eventId === id)
            .sort((a, b) => {
                if (a.date !== b.date) return a.date - b.date; // Oldest first
                const timeA = a.time || '';
                const timeB = b.time || '';
                return timeA.localeCompare(timeB);
            });
    }, [savedMatches, id]);

    // Aggregate Stats for Event
    const eventStats = useMemo(() => {
        // Shift set numbers to avoid collision across matches (e.g. Set 1 of Match 1 != Set 1 of Match 2)
        const allLogs: StatLog[] = matches.flatMap((m, index) => {
            const offset = (index + 1) * 100;
            return (m.history || []).map(log => ({
                ...log,
                setNumber: log.setNumber + offset
            }));
        });
        return allLogs;
    }, [matches]);

    // Local State
    const [activeTab, setActiveTab] = useState<'overview' | 'stats'>('overview');
    const [isGenerating, setIsGenerating] = useState(false);
    const [failedPrompt, setFailedPrompt] = useState<string | undefined>(undefined);

    const { setSetup } = useMatchStore();

    const event = events.find(e => e.id === id);
    const season = event ? seasons.find(s => s.id === event.seasonId) : null;

    // Handle Deletion / Missing Event
    useEffect(() => {
        if (!event) {
            router.back();
        }
    }, [event]);

    if (!event) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>Event not found</Text>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Text style={styles.linkText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const handleNewMatch = () => {
        // Navigate to Setup with Season/Event context
        router.push({
            pathname: '/match/setup',
            params: { seasonId: event.seasonId, eventId: event.id }
        });
    };

    const handleEditEvent = () => {
        router.push({ pathname: '/event/manage', params: { seasonId: event.seasonId, id: event.id } });
    };

    const handleGenerateAI = async () => {
        if (!event || !season) return;
        if (matches.length === 0) {
            Alert.alert("No Matches", "Play some matches first to generate a report!");
            return;
        }

        setIsGenerating(true);
        try {
            const service = new GeminiService();
            // Check models silently
            const narrative = await service.generateEventRecap(matches, season, event);

            // Save to store (we need to update the event object with the new narrative)
            // Assuming event object has aiNarrative optional field. If not, we might need to update type.
            // checking types... let's assume updateEvent handles partial updates.
            updateEvent(event.id, { aiNarrative: narrative });

        } catch (error: any) {
            console.error(error);
            if (error instanceof AIError) {
                setFailedPrompt(error.prompt);
                Alert.alert("AI Error", error.message);
            } else {
                Alert.alert("AI Error", "Failed to generate recap. Please try again.");
            }
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <ChevronLeft size={24} color="#1a1a1a" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.eventName}>{event.name}</Text>
                        <View style={styles.metaRow}>
                            <MapPin size={16} color="#666" />
                            <Text style={styles.metaText}>{event.location}</Text>
                        </View>
                        <View style={styles.metaRow}>
                            <Calendar size={16} color="#666" />
                            <Text style={styles.metaText}>
                                {new Date(event.startDate).toLocaleDateString()}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={handleEditEvent} style={styles.actionIconBtn}>
                        <Settings2 size={24} color="#666" />
                    </TouchableOpacity>
                </View>



                {/* Tabs */}
                <View style={styles.tabBar}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
                        onPress={() => setActiveTab('overview')}
                    >
                        <LayoutDashboard size={18} color={activeTab === 'overview' ? '#0066cc' : '#666'} />
                        <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>Overview</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'stats' && styles.activeTab]}
                        onPress={() => setActiveTab('stats')}
                    >
                        <BarChart2 size={18} color={activeTab === 'stats' ? '#0066cc' : '#666'} />
                        <Text style={[styles.tabText, activeTab === 'stats' && styles.activeTabText]}>Event Stats</Text>
                    </TouchableOpacity>
                </View>

                {activeTab === 'overview' ? (
                    <View>
                        {/* Matches Section */}
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Matches</Text>
                            <TouchableOpacity style={styles.addBtn} onPress={handleNewMatch}>
                                <Plus size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        {/* AI Magic Section */}
                        <View style={{ marginBottom: 24 }}>
                            {!event.aiNarrative && !isGenerating ? (
                                <TouchableOpacity
                                    style={styles.magicBtn}
                                    onPress={handleGenerateAI}
                                    disabled={matches.length === 0}
                                >
                                    <Sparkles size={20} color="#fff" />
                                    <Text style={styles.magicBtnText}>Generate Tournament Report</Text>
                                </TouchableOpacity>
                            ) : (
                                <MagicSummaryCard
                                    narrative={event.aiNarrative}
                                    onGenerate={handleGenerateAI}
                                    isGenerating={isGenerating}
                                    failedPrompt={failedPrompt}
                                />
                            )}
                        </View>

                        {matches.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>No matches recorded yet</Text>
                                <TouchableOpacity onPress={handleNewMatch}>
                                    <Text style={styles.linkText}>Start your first match</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.list}>
                                {matches.map(match => (
                                    <TouchableOpacity
                                        key={match.id}
                                        style={styles.matchCard}
                                        onPress={() => {
                                            if (match.result !== 'Scheduled') {
                                                router.push({ pathname: '/match/[id]', params: { id: match.id } });
                                            } else {
                                                // Optional: Open options or setup for scheduled match
                                                // keeping existing specific buttons for now
                                            }
                                        }}
                                    >
                                        <View style={styles.matchContent}>

                                            {/* Match Header: Time/Court */}
                                            <View style={styles.matchHeader}>
                                                <View style={styles.matchMeta}>
                                                    <Calendar size={12} color="#999" />
                                                    <Text style={styles.matchMetaText}>
                                                        {new Date(match.date || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                    </Text>
                                                    {match.time ? (
                                                        <>
                                                            <Text style={styles.metaDivider}>•</Text>
                                                            <Text style={[styles.matchMetaText, { fontWeight: '700', color: '#444' }]}>{match.time}</Text>
                                                        </>
                                                    ) : null}
                                                    {match.courtNumber ? (
                                                        <>
                                                            <Text style={styles.metaDivider}>•</Text>
                                                            <Text style={styles.matchMetaText}>Court {match.courtNumber}</Text>
                                                        </>
                                                    ) : null}
                                                </View>
                                                <Text style={[
                                                    styles.statusBadge,
                                                    { color: match.result === 'Win' ? '#4caf50' : match.result === 'Loss' ? '#f44336' : match.result === 'Scheduled' ? '#0066cc' : '#999' }
                                                ]}>{match.result}</Text>
                                            </View>

                                            <View style={styles.matchRow}>
                                                <Text style={styles.matchOpponent}>vs {match.opponentName}</Text>

                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    <TouchableOpacity
                                                        style={styles.actionIconBtn}
                                                        onPress={() => {
                                                            const isConcluded = match.result === 'Win' || match.result === 'Loss';

                                                            const options: { text: string, style?: "default" | "cancel" | "destructive", onPress?: () => void }[] = [
                                                                { text: "Cancel", style: "cancel" }
                                                            ];

                                                            if (isConcluded) {
                                                                options.push({
                                                                    text: "Reset Match",
                                                                    style: "destructive",
                                                                    onPress: () => {
                                                                        Alert.alert("Confirm Reset", "This will clear all scores and stats for this match. It cannot be undone.", [
                                                                            { text: "Cancel", style: "cancel" },
                                                                            {
                                                                                text: "Reset",
                                                                                style: "destructive",
                                                                                onPress: () => useDataStore.getState().resetMatchRecord(match.id)
                                                                            }
                                                                        ]);
                                                                    }
                                                                });
                                                            } else {
                                                                options.push({
                                                                    text: "Edit Details",
                                                                    onPress: () => router.push({
                                                                        pathname: '/match/setup',
                                                                        params: {
                                                                            seasonId: match.seasonId,
                                                                            eventId: match.eventId,
                                                                            matchId: match.id
                                                                        }
                                                                    })
                                                                });
                                                            }

                                                            options.push({
                                                                text: "Delete Match",
                                                                style: "destructive",
                                                                onPress: () => {
                                                                    Alert.alert("Confirm Delete", "Are you sure you want to delete this match?", [
                                                                        { text: "Cancel", style: "cancel" },
                                                                        { text: "Delete", style: "destructive", onPress: () => useDataStore.getState().deleteMatchRecord(match.id) }
                                                                    ]);
                                                                }
                                                            });

                                                            Alert.alert(
                                                                "Match Options",
                                                                "Choose an action",
                                                                options
                                                            );
                                                        }}
                                                    >
                                                        <Settings2 size={20} color="#666" />
                                                    </TouchableOpacity>

                                                    {match.result === 'Scheduled' ? (
                                                        <TouchableOpacity
                                                            style={styles.playBtn}
                                                            onPress={() => {
                                                                if (match.config) {
                                                                    setSetup(
                                                                        season?.teamName || 'My Team',
                                                                        match.opponentName,
                                                                        match.config,
                                                                        match.seasonId,
                                                                        match.eventId,
                                                                        match.id // Pass the scheduled match ID
                                                                    );
                                                                    router.replace('/live');
                                                                }
                                                            }}
                                                        >
                                                            <Play size={14} color="#fff" fill="#fff" />
                                                            <Text style={styles.playBtnText}>Play</Text>
                                                        </TouchableOpacity>
                                                    ) : (
                                                        <View style={styles.scorePills}>
                                                            {(match.scores || []).map((setScore, index) => {
                                                                const weWon = setScore.myTeam > setScore.opponent;
                                                                return (
                                                                    <View key={index} style={[styles.pill, weWon ? styles.pillWon : styles.pillLost]}>
                                                                        <Text style={[styles.pillText, weWon ? styles.pillTextWon : styles.pillTextLost]}>
                                                                            {setScore.myTeam}-{setScore.opponent}
                                                                        </Text>
                                                                    </View>
                                                                );
                                                            })}
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>
                ) : (
                    <View style={{ minHeight: 400 }}>
                        {/* Pass season roster since Event doesn't store active roster per se, usually matches season roster */}
                        {(() => {
                            const winCount = matches.filter(m => m.result === 'Win').length;
                            return (
                                <StatsView
                                    logs={eventStats}
                                    roster={season?.roster || []}
                                    title="Event Performance"
                                    matchesWon={winCount}
                                />
                            );
                        })()}
                    </View>
                )}

            </ScrollView>
        </SafeAreaView >
    );
}



const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f7fa',
    },
    content: {
        padding: 20,
    },
    header: {
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    backBtn: {
        marginTop: 4,
        paddingRight: 4,
    },
    eventName: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    metaText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    actionRow: {
        flexDirection: 'row',
        marginBottom: 32,
    },
    secondaryBtn: {
        backgroundColor: '#e3f2fd',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    secondaryBtnText: {
        color: '#0066cc',
        fontWeight: '600',
        fontSize: 14,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
    },
    addBtn: {
        backgroundColor: '#0066cc',
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyState: {
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#ddd',
    },
    emptyText: {
        color: '#999',
        fontSize: 14,
        marginBottom: 4,
    },
    linkText: {
        color: '#0066cc',
        fontWeight: '600',
        fontSize: 14,
    },
    list: {
        gap: 12,
    },
    matchCard: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    matchContent: {
        gap: 8,
    },
    matchHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    matchMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    matchMetaText: {
        fontSize: 12,
        color: '#999',
        fontWeight: '500',
    },
    metaDivider: {
        fontSize: 12,
        color: '#ccc',
        marginHorizontal: 2,
    },
    statusBadge: {
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    matchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    matchOpponent: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
    },
    playBtn: {
        backgroundColor: '#0066cc',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    playBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 13,
    },
    scorePills: {
        flexDirection: 'row',
        gap: 4,
    },
    pill: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
    },
    pillWon: {
        backgroundColor: '#e8f5e9',
        borderColor: '#c8e6c9',
    },
    pillLost: {
        backgroundColor: '#ffebee',
        borderColor: '#ffcdd2',
    },
    pillText: {
        fontSize: 14,
        fontWeight: '700',
    },
    pillTextWon: {
        color: '#2e7d32',
    },
    pillTextLost: {
        color: '#c62828',
    },
    actionIconBtn: {
        padding: 6,
        backgroundColor: '#f5f5f5',
        borderRadius: 20,
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        padding: 4,
        borderRadius: 12,
        marginBottom: 24,
        gap: 8,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 8,
    },
    activeTab: {
        backgroundColor: '#e6f0ff',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
    },
    activeTabText: {
        color: '#0066cc',
        fontWeight: '700',
    },
    magicBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#8a2be2',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 25,
        gap: 8,
        shadowColor: '#8a2be2',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    magicBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});
