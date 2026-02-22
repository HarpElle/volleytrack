import { useLocalSearchParams, useRouter } from 'expo-router';
import { BarChart2, Calendar, ChevronRight, LayoutDashboard, MapPin, Plus, Sparkles, Users } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../../contexts/ThemeContext';
import { MagicSummaryCard } from '../../components/ai/MagicSummaryCard';
import DateRangeFilter from '../../components/DateRangeFilter';
import StatsView from '../../components/stats/StatsView';
import { GeminiService } from '../../services/ai/GeminiService';
import { PaywallModal } from '../../components/PaywallModal';
import { useDataStore } from '../../store/useDataStore';
import { useSubscriptionStore } from '../../store/useSubscriptionStore';
import { StatLog } from '../../types';

export default function SeasonDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { colors } = useAppTheme();
    // Subscribe to specific parts of the store for reactivity
    const seasons = useDataStore((state) => state.seasons);
    const allEvents = useDataStore((state) => state.events);
    const savedMatches = useDataStore((state) => state.savedMatches);
    const updateSeason = useDataStore((state) => state.updateSeason);

    // Local state
    // State
    const [activeTab, setActiveTab] = useState<'overview' | 'stats'>('overview');
    const [sortBy, setSortBy] = useState<'name' | 'jersey'>('name');
    const [showAllEvents, setShowAllEvents] = useState(false);
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showPaywall, setShowPaywall] = useState(false);

    // Subscription gating for AI narratives
    const canUseAINarrative = useSubscriptionStore((s) => s.canUseAINarrative);
    const incrementAINarratives = useSubscriptionStore((s) => s.incrementAINarratives);

    const season = seasons.find(s => s.id === id);

    // Derive events
    const events = allEvents
        .filter(e => e.seasonId === id)
        .sort((a, b) => a.startDate - b.startDate);

    const displayedEvents = showAllEvents ? events : events.slice(0, 3);

    // Sort Roster
    const sortedRoster = useMemo(() => {
        return [...(season?.roster || [])].sort((a, b) => {
            if (sortBy === 'jersey') {
                const numA = parseInt(a.jerseyNumber, 10);
                const numB = parseInt(b.jerseyNumber, 10);
                if (isNaN(numA)) return 1;
                if (isNaN(numB)) return -1;
                return numA - numB;
            }
            return a.name.localeCompare(b.name);
        });
    }, [season?.roster, sortBy]);

    // Aggregate Stats with Date Filter
    const { logs: seasonStats, matchesWon } = useMemo(() => {
        let matches = savedMatches.filter(m => m.seasonId === id);

        if (startDate) {
            matches = matches.filter(m => m.date && m.date >= startDate.getTime());
        }
        if (endDate) {
            // Set end date to end of day
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            matches = matches.filter(m => m.date && m.date <= endOfDay.getTime());
        }

        const allLogs: StatLog[] = matches.flatMap((m, index) => {
            const offset = (index + 1) * 100;
            return (m.history || []).map(l => ({ ...l, setNumber: l.setNumber + offset }));
        });
        const wins = matches.filter(m => m.result === 'Win').length;

        return { logs: allLogs, matchesWon: wins };
    }, [savedMatches, id, startDate, endDate]);

    if (!season) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}><Text>Season not found</Text></View>
            </SafeAreaView>
        );
    }

    const handleAddEvent = () => {
        router.push({ pathname: '/event/manage', params: { seasonId: id } });
    };

    const handleEventPress = (eventId: string) => {
        router.push({ pathname: '/event/[id]', params: { id: eventId } });
    };

    const handleGenerateAI = async () => {
        if (!season) return;
        const seasonMatches = savedMatches.filter(m => m.seasonId === id);

        if (seasonMatches.length === 0) {
            Alert.alert("No Matches", "Play some matches to generate a Season Report!");
            return;
        }

        // Check subscription / free tier limit
        if (!canUseAINarrative()) {
            setShowPaywall(true);
            return;
        }

        setIsGenerating(true);
        try {
            const service = new GeminiService();
            const narrative = await service.generateSeasonRecap(season, seasonMatches, events);
            updateSeason(season.id, { aiNarrative: narrative });

            // Track usage after successful generation
            incrementAINarratives();
        } catch (error) {
            console.error(error);
            Alert.alert("AI Error", "Failed to generate season recap. Check your connection and try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    const renderOverview = () => (
        <>
            {/* AI Magic Section */}
            <View style={{ marginBottom: 24 }}>
                {!season.aiNarrative && !isGenerating ? (
                    <TouchableOpacity
                        style={[styles.magicBtn, { shadowColor: '#8a2be2' }]}
                        onPress={handleGenerateAI}
                    >
                        <Sparkles size={20} color={'#ffffff'} />
                        <Text style={[styles.magicBtnText, { color: '#ffffff' }]}>Generate Season Report</Text>
                    </TouchableOpacity>
                ) : (
                    <MagicSummaryCard
                        narrative={season.aiNarrative}
                        onGenerate={handleGenerateAI}
                        isGenerating={isGenerating}
                    />
                )}
            </View>

            {/* Events Section */}
            <View style={styles.sectionHeader}>
                <View style={styles.titleRow}>
                    <Calendar size={20} color={colors.textSecondary} />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Events</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    {events.length > 3 && (
                        <TouchableOpacity onPress={() => setShowAllEvents(!showAllEvents)}>
                            <Text style={[styles.linkText, { color: colors.primary }]}>{showAllEvents ? 'Show Less' : 'See All'}</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={handleAddEvent}>
                        <Plus size={20} color={'#ffffff'} />
                    </TouchableOpacity>
                </View>
            </View>

            {events.length === 0 ? (
                <View style={[styles.emptyState, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No events scheduled</Text>
                    <TouchableOpacity onPress={handleAddEvent}>
                        <Text style={[styles.linkText, { color: colors.primary }]}>Add your first event</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.list}>
                    {displayedEvents.map(event => (
                        <TouchableOpacity
                            key={event.id}
                            style={[styles.card, { backgroundColor: colors.bgCard }]}
                            onPress={() => handleEventPress(event.id)}
                        >
                            <View style={styles.cardContent}>
                                <Text style={[styles.cardTitle, { color: colors.text }]}>{event.name}</Text>
                                <View style={styles.cardRow}>
                                    <MapPin size={14} color={colors.textTertiary} />
                                    <Text style={[styles.cardSub, { color: colors.textSecondary }]}>{event.location}</Text>
                                </View>
                                <View style={styles.cardRow}>
                                    <Calendar size={14} color={colors.textTertiary} />
                                    <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                                        {new Date(event.startDate).toLocaleDateString()}
                                    </Text>
                                </View>
                            </View>
                            <ChevronRight size={20} color={colors.border} />
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            <View style={[styles.sectionHeader, { marginTop: 32 }]}>
                <View style={styles.titleRow}>
                    <Users size={20} color={colors.textSecondary} />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Roster ({season.roster.length})</Text>
                </View>
                <TouchableOpacity onPress={() => setSortBy(prev => prev === 'name' ? 'jersey' : 'name')}>
                    <Text style={[styles.linkText, { color: colors.primary }]}>Sort by {sortBy === 'name' ? 'Jersey' : 'Name'}</Text>
                </TouchableOpacity>
            </View>

            <View style={[styles.rosterCard, { backgroundColor: colors.bgCard }]}>
                {sortedRoster.map((player, index) => (
                    <View key={player.id} style={[
                        styles.rosterRow,
                        { borderBottomColor: colors.border },
                        index === season.roster.length - 1 && { borderBottomWidth: 0 }
                    ]}>
                        <Text style={[styles.jersey, { color: colors.textTertiary }]}>#{player.jerseyNumber}</Text>
                        <Text style={[styles.playerName, { color: colors.text }]}>{player.name}</Text>
                    </View>
                ))}
                {season.roster.length === 0 && (
                    <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No players added</Text>
                )}
            </View>
        </>
    );

    const renderStats = () => (
        <View>
            <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                onFilterChange={(s, e) => { setStartDate(s); setEndDate(e); }}
            />

            <StatsView
                logs={seasonStats}
                roster={season.roster}
                title="Season Performance"
                matchesWon={matchesWon}
            />
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
            <ScrollView contentContainerStyle={styles.content}>

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <ChevronRight size={24} color={colors.text} style={{ transform: [{ rotate: '180deg' }] }} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.seasonName, { color: colors.text }]}>{season.name}</Text>
                        <Text style={[styles.teamName, { color: colors.textSecondary }]}>{season.teamName} • {season.level}</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => router.push({ pathname: '/season/create', params: { id: season.id } })}
                        style={{ padding: 8 }}
                    >
                        <Text style={{ color: colors.primary, fontWeight: '600' }}>Edit</Text>
                    </TouchableOpacity>
                </View>

                {/* Tabs */}
                <View style={[styles.tabBar, { backgroundColor: colors.bgCard }]}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'overview' && styles.activeTab, activeTab === 'overview' && { backgroundColor: colors.primaryLight }]}
                        onPress={() => setActiveTab('overview')}
                    >
                        <LayoutDashboard size={18} color={activeTab === 'overview' ? colors.primary : colors.textSecondary} />
                        <Text style={[styles.tabText, { color: colors.textSecondary }, activeTab === 'overview' && styles.activeTabText, activeTab === 'overview' && { color: colors.primary }]}>Overview</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'stats' && styles.activeTab, activeTab === 'stats' && { backgroundColor: colors.primaryLight }]}
                        onPress={() => setActiveTab('stats')}
                    >
                        <BarChart2 size={18} color={activeTab === 'stats' ? colors.primary : colors.textSecondary} />
                        <Text style={[styles.tabText, { color: colors.textSecondary }, activeTab === 'stats' && styles.activeTabText, activeTab === 'stats' && { color: colors.primary }]}>Stats</Text>
                    </TouchableOpacity>
                </View>

                {activeTab === 'overview' ? renderOverview() : renderStats()}

            </ScrollView>

            {/* Paywall Modal */}
            <PaywallModal
                visible={showPaywall}
                onClose={() => setShowPaywall(false)}
                trigger="ai_narrative"
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f7fa', // Override with colors.bg in component
    },
    content: {
        padding: 20,
    },
    header: {
        marginBottom: 24,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    backBtn: {
        marginTop: 4,
        paddingRight: 4,
    },
    seasonName: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1a1a1a', // Override with colors.text in component
        marginBottom: 4,
    },
    teamName: {
        fontSize: 16,
        color: '#666', // Override with colors.textSecondary in component
        fontWeight: '500',
    },
    actionRow: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333', // Override with colors.text in component
    },
    addBtn: {
        backgroundColor: '#0066cc', // Override with colors.primary in component
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
        backgroundColor: '#fff', // Override with colors.bgCard in component
        borderRadius: 12,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#ddd', // Override with colors.border in component
    },
    emptyText: {
        color: '#999', // Override with colors.textTertiary in component
        fontSize: 14,
        marginBottom: 4,
    },
    linkText: {
        color: '#0066cc', // Override with colors.primary in component
        fontWeight: '600',
        fontSize: 14,
    },
    list: {
        gap: 12,
    },
    card: {
        backgroundColor: '#fff', // Override with colors.bgCard in component
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 2,
    },
    cardContent: {
        flex: 1,
        gap: 6,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#333', // Override with colors.text in component
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    cardSub: {
        fontSize: 13,
        color: '#666', // Override with colors.textSecondary in component
    },
    rosterCard: {
        backgroundColor: '#fff', // Override with colors.bgCard in component
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 2,
    },
    rosterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5', // Override with colors.border in component
        gap: 12,
    },
    jersey: {
        fontSize: 14,
        fontWeight: '700',
        color: '#999', // Override with colors.textTertiary in component
        width: 30,
    },
    playerName: {
        fontSize: 16,
        color: '#333', // Override with colors.text in component
        fontWeight: '500',
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#fff', // Override with colors.bgCard in component
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
        backgroundColor: '#e6f0ff', // Override with colors.primaryLight in component
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666', // Override with colors.textSecondary in component
    },
    activeTabText: {
        color: '#0066cc', // Override with colors.primary in component
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
