import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, ChevronRight, MapPin, Plus, Sparkles, Users } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MagicSummaryCard } from '../../components/ai/MagicSummaryCard';
import DateRangeFilter from '../../components/DateRangeFilter';
import StatsView from '../../components/stats/StatsView';
import { GeminiService } from '../../services/ai/GeminiService';
import { useDataStore } from '../../store/useDataStore';
import { StatLog } from '../../types';

export default function SeasonDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
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

        setIsGenerating(true);
        try {
            const service = new GeminiService();
            const narrative = await service.generateSeasonRecap(season, seasonMatches, events);
            updateSeason(season.id, { aiNarrative: narrative });
        } catch (error) {
            console.error(error);
            Alert.alert("AI Error", "Failed to generate season recap.");
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
                        style={styles.magicBtn}
                        onPress={handleGenerateAI}
                    >
                        <Sparkles size={20} color="#fff" />
                        <Text style={styles.magicBtnText}>Generate Season Report</Text>
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
                    <Calendar size={20} color="#444" />
                    <Text style={styles.sectionTitle}>Events</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    {events.length > 3 && (
                        <TouchableOpacity onPress={() => setShowAllEvents(!showAllEvents)}>
                            <Text style={styles.linkText}>{showAllEvents ? 'Show Less' : 'See All'}</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.addBtn} onPress={handleAddEvent}>
                        <Plus size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>

            {events.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No events scheduled</Text>
                    <TouchableOpacity onPress={handleAddEvent}>
                        <Text style={styles.linkText}>Add your first event</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.list}>
                    {displayedEvents.map(event => (
                        <TouchableOpacity
                            key={event.id}
                            style={styles.card}
                            onPress={() => handleEventPress(event.id)}
                        >
                            <View style={styles.cardContent}>
                                <Text style={styles.cardTitle}>{event.name}</Text>
                                <View style={styles.cardRow}>
                                    <MapPin size={14} color="#999" />
                                    <Text style={styles.cardSub}>{event.location}</Text>
                                </View>
                                <View style={styles.cardRow}>
                                    <Calendar size={14} color="#999" />
                                    <Text style={styles.cardSub}>
                                        {new Date(event.startDate).toLocaleDateString()}
                                    </Text>
                                </View>
                            </View>
                            <ChevronRight size={20} color="#ccc" />
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            <View style={[styles.sectionHeader, { marginTop: 32 }]}>
                <View style={styles.titleRow}>
                    <Users size={20} color="#444" />
                    <Text style={styles.sectionTitle}>Roster ({season.roster.length})</Text>
                </View>
                <TouchableOpacity onPress={() => setSortBy(prev => prev === 'name' ? 'jersey' : 'name')}>
                    <Text style={styles.linkText}>Sort by {sortBy === 'name' ? 'Jersey' : 'Name'}</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.rosterCard}>
                {sortedRoster.map((player, index) => (
                    <View key={player.id} style={[
                        styles.rosterRow,
                        index === season.roster.length - 1 && { borderBottomWidth: 0 }
                    ]}>
                        <Text style={styles.jersey}>#{player.jerseyNumber}</Text>
                        <Text style={styles.playerName}>{player.name}</Text>
                    </View>
                ))}
                {season.roster.length === 0 && (
                    <Text style={styles.emptyText}>No players added</Text>
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
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <ChevronRight size={24} color="#1a1a1a" style={{ transform: [{ rotate: '180deg' }] }} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.seasonName}>{season.name}</Text>
                        <Text style={styles.teamName}>{season.teamName} • {season.level}</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => router.push({ pathname: '/season/create', params: { id: season.id } })}
                        style={{ padding: 8 }}
                    >
                        <Text style={{ color: '#0066cc', fontWeight: '600' }}>Edit</Text>
                    </TouchableOpacity>
                </View>

                {/* Tabs */}
                <View style={styles.tabBar}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
                        onPress={() => setActiveTab('overview')}
                    >
                        <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>Overview</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'stats' && styles.activeTab]}
                        onPress={() => setActiveTab('stats')}
                    >
                        <Text style={[styles.tabText, activeTab === 'stats' && styles.activeTabText]}>Stats</Text>
                    </TouchableOpacity>
                </View>

                {activeTab === 'overview' ? renderOverview() : renderStats()}

            </ScrollView>
        </SafeAreaView>
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
        color: '#1a1a1a',
        marginBottom: 4,
    },
    teamName: {
        fontSize: 16,
        color: '#666',
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
    card: {
        backgroundColor: '#fff',
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
        color: '#333',
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    cardSub: {
        fontSize: 13,
        color: '#666',
    },
    rosterCard: {
        backgroundColor: '#fff',
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
        borderBottomColor: '#f5f5f5',
        gap: 12,
    },
    jersey: {
        fontSize: 14,
        fontWeight: '700',
        color: '#999',
        width: 30,
    },
    playerName: {
        fontSize: 16,
        color: '#333',
        fontWeight: '500',
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
