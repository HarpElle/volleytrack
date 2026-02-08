import { useRouter } from 'expo-router';
import { Calendar, ChevronRight, Play } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDataStore } from '../store/useDataStore';
import { useMatchStore } from '../store/useMatchStore';
import { MatchRecord } from '../types';

export default function DashboardScreen() {
    const router = useRouter();
    const { seasons, savedMatches, events, touchSeason } = useDataStore();
    const { setSetup } = useMatchStore();

    // Sorting Logic for Matches
    // 1. No Date (Top) -> Sorted by Created ID (desc) - "Upcoming/Drafts"
    // 2. Date but No Time (Next) -> Sorted by Created ID (desc)
    // 3. Date + Time (Next) -> Sorted by DateTime (Ascending - Soonest First)
    // 4. Completed games should be filtered out from "Upcoming" ? User request said "Upcoming Matches" replacing Recent.
    //    Implies filtering out 'Win'/'Loss' if we strictly mean upcoming.
    //    But "Recent Matches" usually implies history. User said "Instead of Recent Matches, I think it would be better to have Upcoming Matches".
    //    So we will filter for 'Scheduled'.

    const normalizedToday = new Date();
    normalizedToday.setHours(0, 0, 0, 0);

    const upcomingMatches = [...savedMatches]
        .filter(m => {
            if (m.result !== 'Scheduled') return false;
            // Hide past matches (allow Today)
            if (m.date && m.date < normalizedToday.getTime()) return false;
            return true;
        })
        .sort((a, b) => {
            const hasDateA = !!a.date;
            const hasDateB = !!b.date;
            const hasTimeA = !!a.time;
            const hasTimeB = !!b.time;

            // Priority 1: No Date (Considered "TBD" or Top of mind draft)
            // Wait, usually No Date means generic. User said: "If there are Matches with no dates, I would put those at the top"
            if (!hasDateA && hasDateB) return -1;
            if (hasDateA && !hasDateB) return 1;
            if (!hasDateA && !hasDateB) return parseInt(b.id) - parseInt(a.id); // Newest created first ? "sorted by when they were created"

            // Priority 2: Date, No Time
            if (!hasTimeA && hasTimeB) return -1;
            if (hasTimeA && !hasTimeB) return 1;
            if (!hasTimeA && !hasTimeB) {
                // "sorted by when they were created". Assuming ID is timestamp.
                return parseInt(b.id) - parseInt(a.id);
            }

            // Priority 3: Date + Time
            // Sort by actual time.
            const dateA = new Date(a.date).setHours(0, 0, 0, 0);
            const dateB = new Date(b.date).setHours(0, 0, 0, 0);

            if (dateA !== dateB) return dateA - dateB;

            // Parse time strings (e.g. "11:30 AM") into minutes for comparison
            const parseTime = (t: string) => {
                if (!t) return -1;
                // Regex to match "HH:MM AM/PM" with any whitespace (including non-breaking)
                const match = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
                if (!match) {
                    // Fallback for 24h or simple format if needed, though we expect AM/PM
                    return -1;
                }

                let [_, h, m, period] = match;
                let hours = parseInt(h, 10);
                const minutes = parseInt(m, 10);

                if (hours === 12) hours = 0;
                if (period.toUpperCase() === 'PM') hours += 12;

                return hours * 60 + minutes;
            };

            const timeA = parseTime(a.time || '');
            const timeB = parseTime(b.time || '');

            return timeA - timeB;
        })
        .slice(0, 5); // Keep list compact? Or show all? User didn't specify limit, but "Recent" had 5. Let's show 5.

    // Sorting Logic for Seasons (MRU)
    const sortedSeasons = [...seasons].sort((a, b) => {
        const lastA = a.lastAccessed || 0;
        const lastB = b.lastAccessed || 0;
        if (lastA !== lastB) return lastB - lastA; // Most recent first
        return b.startDate - a.startDate; // Fallback to start date
    });

    const handleQuickMatch = () => {
        setSetup(
            'My Team',
            'Opponent',
            {
                presetName: '3-Set',
                totalSets: 3,
                sets: [
                    { targetScore: 25, winBy: 2, cap: 100 },
                    { targetScore: 25, winBy: 2, cap: 100 },
                    { targetScore: 15, winBy: 2, cap: 100 },
                ],
                timeoutsPerSet: 2,
                subsPerSet: 15
            },
            undefined,
            undefined
        );
        router.push('/live');
    };

    const handleNewSeason = () => {
        router.push('/season/create');
    };

    const handleMatchSetup = () => {
        router.push('/match/setup');
    };

    const handleSeasonPress = (id: string) => {
        touchSeason(id);
        router.push({ pathname: '/season/[id]', params: { id } });
    };

    const renderMatchItem = (match: MatchRecord) => {
        const date = match.date ? new Date(match.date).toLocaleDateString() : 'Date TBD';
        const time = match.time || '';
        const event = match.eventId ? events.find(e => e.id === match.eventId) : null;

        const handlePress = () => {
            router.push({
                pathname: '/match/setup',
                params: {
                    seasonId: match.seasonId,
                    eventId: match.eventId,
                    matchId: match.id
                }
            });
        };

        const season = match.seasonId ? seasons.find(s => s.id === match.seasonId) : null;
        const myTeamName = season ? season.teamName : 'My Team';

        return (
            <TouchableOpacity
                key={match.id}
                style={styles.matchCard}
                onPress={handlePress}
            >
                <View style={styles.matchLeft}>
                    {event && (
                        <Text style={styles.matchEvent}>{event.name}</Text>
                    )}
                    <Text style={styles.matchOpponent}>{myTeamName} vs {match.opponentName}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                        <Calendar size={12} color="#999" />
                        <Text style={styles.matchDate}>{date}</Text>
                        {time ? <Text style={styles.matchDate}>• {time}</Text> : null}
                        {match.courtNumber ? <Text style={styles.matchDate}>• Ct {match.courtNumber}</Text> : null}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    // Resume Logic
    const { matchId: activeMatchId, history: activeHistory, myTeamName, opponentName, setsWon } = useMatchStore();
    const isMatchActive = activeMatchId && (activeHistory.length > 0 || setsWon.myTeam > 0 || setsWon.opponent > 0);

    const handleResumeMatch = () => {
        router.push('/live');
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.appName}>VolleyTrack</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Resume Active Match - Priority 0 */}
                {isMatchActive && (
                    <TouchableOpacity style={[styles.quickMatchBtn, { backgroundColor: '#22c55e', marginBottom: 16 }]} onPress={handleResumeMatch}>
                        <View style={styles.quickMatchContent}>
                            <Play size={32} color="#fff" fill="#fff" />
                            <View>
                                <Text style={styles.quickMatchTitle}>Resume Match</Text>
                                <Text style={styles.quickMatchSub}>{myTeamName} vs {opponentName}</Text>
                            </View>
                        </View>
                        <ChevronRight size={24} color="rgba(255,255,255,0.6)" />
                    </TouchableOpacity>
                )}

                {/* Hero Action: Quick Match */}
                <TouchableOpacity style={styles.quickMatchBtn} onPress={handleQuickMatch}>
                    <View style={styles.quickMatchContent}>
                        <Play size={32} color="#fff" fill="#fff" />
                        <View>
                            <Text style={styles.quickMatchTitle}>Quick Match</Text>
                            <Text style={styles.quickMatchSub}>Start tracking instantly</Text>
                        </View>
                    </View>
                    <ChevronRight size={24} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>

                {/* Seasons Section (MRU) */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>My Seasons & Teams</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        {seasons.length > 0 && <TouchableOpacity><Text style={styles.seeAll}>See All</Text></TouchableOpacity>}
                        <TouchableOpacity onPress={handleNewSeason}>
                            <Text style={[styles.seeAll, { color: '#0066cc' }]}>+ New</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {seasons.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No active seasons</Text>
                        <TouchableOpacity onPress={handleNewSeason}>
                            <Text style={styles.linkText}>Create your first season</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
                        {sortedSeasons.map(season => (
                            <TouchableOpacity
                                key={season.id}
                                style={styles.seasonCard}
                                onPress={() => handleSeasonPress(season.id)}
                            >
                                <Text style={styles.seasonName}>{season.name}</Text>
                                <Text style={styles.seasonTeam}>{season.teamName}</Text>
                                <Text style={styles.seasonLevel}>{season.level}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}

                {/* Upcoming Matches */}
                <View style={styles.sectionHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Calendar size={20} color="#444" />
                        <Text style={styles.sectionTitle}>Upcoming Matches</Text>
                    </View>
                </View>

                {upcomingMatches.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No upcoming matches</Text>
                        <TouchableOpacity onPress={handleMatchSetup}>
                            <Text style={styles.linkText}>Schedule a match</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.list}>
                        {upcomingMatches.map(match => renderMatchItem(match))}
                    </View>
                )}

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f7fa',
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    appName: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1a1a1a',
        letterSpacing: -0.5,
    },
    content: {
        padding: 20,
    },
    quickMatchBtn: {
        backgroundColor: '#0066cc',
        borderRadius: 16,
        padding: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#0066cc',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
        marginBottom: 24,
    },
    quickMatchContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    quickMatchTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
    },
    quickMatchSub: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        fontWeight: '500',
    },
    actionGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 32,
    },
    actionCard: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 2,
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    actionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#444',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#222',
    },
    seeAll: {
        color: '#0066cc',
        fontWeight: '600',
        fontSize: 14,
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
        marginBottom: 24,
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
    hScroll: {
        marginBottom: 24,
        marginHorizontal: -20,
        paddingHorizontal: 20,
    },
    seasonCard: {
        backgroundColor: '#fff',
        width: 160,
        padding: 16,
        borderRadius: 12,
        marginRight: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        borderLeftWidth: 4,
        borderLeftColor: '#0066cc',
    },
    seasonName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#333',
        marginBottom: 4,
    },
    seasonTeam: {
        fontSize: 13,
        color: '#666',
        fontWeight: '500',
        marginBottom: 2,
    },
    seasonLevel: {
        fontSize: 11,
        color: '#0066cc',
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    list: {
        gap: 12,
    },
    matchCard: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    matchLeft: {
        gap: 4,
    },
    matchEvent: {
        fontSize: 12,
        color: '#666',
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    matchOpponent: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
    },
    matchDate: {
        fontSize: 12,
        color: '#999',
    },
    matchRight: {
        alignItems: 'flex-end',
        gap: 4,
    },
    resultBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    resultText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    matchScore: {
        fontSize: 14,
        fontWeight: '700',
        color: '#444',
    },
});
