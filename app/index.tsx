import { useRouter } from 'expo-router';
import { Calendar, ChevronRight, Cloud, CloudOff, Crown, Eye, Play, RefreshCw, Settings, Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdBanner } from '../components/AdBanner';
import { PaywallModal } from '../components/PaywallModal';
import { useAppTheme } from '../contexts/ThemeContext';
import { useAutoSync } from '../hooks/useAutoSync';
import { useAuth } from '../services/firebase';
import { cleanupStaleBroadcasts } from '../services/firebase/liveMatchService';
import { useDataStore } from '../store/useDataStore';
import { useMatchStore } from '../store/useMatchStore';
import { useSubscriptionStore } from '../store/useSubscriptionStore';
import { MatchRecord } from '../types';

export default function DashboardScreen() {
    const router = useRouter();
    const { seasons, savedMatches, events, touchSeason, syncStatus } = useDataStore();
    const matchStore = useMatchStore();
    const { user } = useAuth();
    const { colors, spacing, fontSize, radius } = useAppTheme();

    const isPro = useSubscriptionStore((s) => s.isPro);
    const canCreateSeason = useSubscriptionStore((s) => s.canCreateSeason);
    const [showPaywall, setShowPaywall] = useState(false);

    // Auto-sync when signed in and app is active
    useAutoSync();

    // Clean up any stale broadcasts left by this coach (e.g. force-quit mid-broadcast)
    useEffect(() => {
        if (user?.uid) {
            cleanupStaleBroadcasts(user.uid);
        }
    }, [user?.uid]);

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
        router.push('/quick-match-setup');
    };

    const handleNewSeason = () => {
        if (!canCreateSeason(seasons.length)) {
            setShowPaywall(true);
            return;
        }
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

        const themedMatchStyles = {
            matchEvent: {
                color: colors.textSecondary,
            },
            matchOpponent: {
                color: colors.text,
            },
            matchDate: {
                color: colors.textTertiary,
            },
        };

        return (
            <TouchableOpacity
                key={match.id}
                style={[styles.matchCard, { backgroundColor: colors.bgCard }]}
                onPress={handlePress}
            >
                <View style={styles.matchLeft}>
                    {event && (
                        <Text style={[styles.matchEvent, themedMatchStyles.matchEvent]}>{event.name}</Text>
                    )}
                    <Text style={[styles.matchOpponent, themedMatchStyles.matchOpponent]}>{myTeamName} vs {match.opponentName}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                        <Calendar size={12} color={colors.textTertiary} />
                        <Text style={[styles.matchDate, themedMatchStyles.matchDate]}>{date}</Text>
                        {time ? <Text style={[styles.matchDate, themedMatchStyles.matchDate]}>• {time}</Text> : null}
                        {match.courtNumber ? <Text style={[styles.matchDate, themedMatchStyles.matchDate]}>• Ct {match.courtNumber}</Text> : null}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    // Resume Logic
    const { matchId: activeMatchId, history: activeHistory, myTeamName, opponentName, setsWon } = matchStore;
    const isMatchActive = activeMatchId && (activeHistory.length > 0 || setsWon.myTeam > 0 || setsWon.opponent > 0);

    const handleResumeMatch = () => {
        router.push('/live');
    };

    const themedStyles = {
        container: {
            backgroundColor: colors.bg,
        },
        header: {
            backgroundColor: colors.bgCard,
            borderBottomColor: colors.headerBorder,
        },
        appName: {
            color: colors.text,
        },
        quickMatchBtn: {
            backgroundColor: colors.buttonPrimary,
            shadowColor: colors.primary,
        },
        quickMatchTitle: {
            color: colors.buttonPrimaryText,
        },
        quickMatchSub: {
            color: colors.buttonPrimaryText,
        },
        resumeBtn: {
            backgroundColor: colors.success,
        },
        sectionTitle: {
            color: colors.text,
        },
        seeAll: {
            color: colors.link,
        },
        emptyState: {
            backgroundColor: colors.bgCard,
            borderColor: colors.border,
        },
        emptyText: {
            color: colors.textTertiary,
        },
        linkText: {
            color: colors.link,
        },
        seasonCard: {
            backgroundColor: colors.bgCard,
            borderLeftColor: colors.primary,
        },
        seasonName: {
            color: colors.text,
        },
        seasonTeam: {
            color: colors.textSecondary,
        },
        seasonLevel: {
            color: colors.primary,
        },
    };

    return (
        <SafeAreaView style={[styles.container, themedStyles.container]}>
            <View style={[styles.header, themedStyles.header]}>
                <Text style={[styles.appName, themedStyles.appName]}>VolleyTrack</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    {user && (
                        syncStatus === 'syncing'
                            ? <RefreshCw size={18} color={colors.primary} />
                            : syncStatus === 'synced'
                                ? <Cloud size={18} color={colors.success} />
                                : syncStatus === 'error'
                                    ? <CloudOff size={18} color={colors.error} />
                                    : null
                    )}
                    <TouchableOpacity onPress={() => router.push('/settings')} hitSlop={8}>
                        <Settings size={22} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Resume Active Match - Priority 0 */}
                {isMatchActive && (
                    <TouchableOpacity style={[styles.quickMatchBtn, themedStyles.resumeBtn, { marginBottom: 16 }]} onPress={handleResumeMatch}>
                        <View style={styles.quickMatchContent}>
                            <Play size={32} color={colors.buttonPrimaryText} fill={colors.buttonPrimaryText} />
                            <View>
                                <Text style={[styles.quickMatchTitle, { color: colors.buttonPrimaryText }]}>Resume Match</Text>
                                <Text style={[styles.quickMatchSub, { color: colors.buttonPrimaryText }]}>{myTeamName} vs {opponentName}</Text>
                            </View>
                        </View>
                        <ChevronRight size={24} color={`rgba(255,255,255,0.6)`} />
                    </TouchableOpacity>
                )}

                {/* Hero Action: Quick Match */}
                <TouchableOpacity style={[styles.quickMatchBtn, themedStyles.quickMatchBtn]} onPress={handleQuickMatch}>
                    <View style={styles.quickMatchContent}>
                        <Play size={32} color={colors.buttonPrimaryText} fill={colors.buttonPrimaryText} />
                        <View>
                            <Text style={[styles.quickMatchTitle, themedStyles.quickMatchTitle]}>Quick Match</Text>
                            <Text style={[styles.quickMatchSub, themedStyles.quickMatchSub]}>Score only or full lineup</Text>
                        </View>
                    </View>
                    <ChevronRight size={24} color={`rgba(255,255,255,0.6)`} />
                </TouchableOpacity>

                {/* Watch Live Match */}
                <TouchableOpacity
                    style={[styles.watchLiveBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                    onPress={() => router.push('/spectate/join')}
                >
                    <Eye size={20} color={colors.primary} />
                    <Text style={[styles.watchLiveText, { color: colors.text }]}>Watch a Live Match</Text>
                    <ChevronRight size={18} color={colors.textTertiary} />
                </TouchableOpacity>

                {/* Feature Tour */}
                <TouchableOpacity
                    style={[styles.watchLiveBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                    // @ts-ignore - Route exists but types not yet generated
                    onPress={() => router.push('/tour')}
                >
                    <Crown size={20} color={colors.primary} />
                    <Text style={[styles.watchLiveText, { color: colors.text }]}>Feature Tour: See what you can do</Text>
                    <ChevronRight size={18} color={colors.textTertiary} />
                </TouchableOpacity>

                {/* Pro Upgrade CTA — shown only for free users */}
                {!isPro && (
                    <TouchableOpacity
                        style={[styles.proCta, { backgroundColor: colors.bgCard, borderColor: colors.primary }]}
                        onPress={() => setShowPaywall(true)}
                        activeOpacity={0.7}
                    >
                        <Sparkles size={18} color={colors.primary} />
                        <View style={styles.proCtaText}>
                            <Text style={[styles.proCtaTitle, { color: colors.text }]}>Upgrade to Pro</Text>
                            <Text style={[styles.proCtaSub, { color: colors.textSecondary }]}>
                                Ad-free, unlimited AI summaries, seasons & exports
                            </Text>
                        </View>
                        <ChevronRight size={16} color={colors.primary} />
                    </TouchableOpacity>
                )}

                {/* Seasons Section (MRU) */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, themedStyles.sectionTitle]}>My Seasons & Teams</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        {seasons.length > 0 && <TouchableOpacity><Text style={[styles.seeAll, themedStyles.seeAll]}>See All</Text></TouchableOpacity>}
                        <TouchableOpacity onPress={handleNewSeason}>
                            <Text style={[styles.seeAll, themedStyles.seeAll]}>+ New</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {seasons.length === 0 ? (
                    <View style={[styles.emptyState, themedStyles.emptyState]}>
                        <Text style={[styles.emptyText, themedStyles.emptyText]}>No active seasons</Text>
                        <TouchableOpacity onPress={handleNewSeason}>
                            <Text style={[styles.linkText, themedStyles.linkText]}>Create your first season</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
                        {sortedSeasons.map(season => (
                            <TouchableOpacity
                                key={season.id}
                                style={[styles.seasonCard, themedStyles.seasonCard]}
                                onPress={() => handleSeasonPress(season.id)}
                            >
                                <Text style={[styles.seasonName, themedStyles.seasonName]}>{season.name}</Text>
                                <Text style={[styles.seasonTeam, themedStyles.seasonTeam]}>{season.teamName}</Text>
                                <Text style={[styles.seasonLevel, themedStyles.seasonLevel]}>{season.level}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}

                {/* Upcoming Matches */}
                <View style={styles.sectionHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Calendar size={20} color={colors.textSecondary} />
                        <Text style={[styles.sectionTitle, themedStyles.sectionTitle]}>Upcoming Matches</Text>
                    </View>
                </View>

                {upcomingMatches.length === 0 ? (
                    <View style={[styles.emptyState, themedStyles.emptyState]}>
                        <Text style={[styles.emptyText, themedStyles.emptyText]}>No upcoming matches</Text>
                        <TouchableOpacity onPress={handleMatchSetup}>
                            <Text style={[styles.linkText, themedStyles.linkText]}>Schedule a match</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.list}>
                        {upcomingMatches.map(match => renderMatchItem(match))}
                    </View>
                )}

            </ScrollView>

            {/* Ad Banner — pinned to bottom edge */}
            <AdBanner />

            {/* Paywall Modal */}
            <PaywallModal
                visible={showPaywall}
                onClose={() => setShowPaywall(false)}
                trigger="season"
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    appName: {
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    content: {
        padding: 20,
    },
    watchLiveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 24,
    },
    watchLiveText: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
    },
    quickMatchBtn: {
        borderRadius: 16,
        padding: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
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
        fontSize: 20,
        fontWeight: '700',
    },
    quickMatchSub: {
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
    },
    seeAll: {
        fontWeight: '600',
        fontSize: 14,
    },
    emptyState: {
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        borderStyle: 'dashed',
        borderWidth: 1,
        marginBottom: 24,
    },
    emptyText: {
        fontSize: 14,
        marginBottom: 4,
    },
    linkText: {
        fontWeight: '600',
        fontSize: 14,
    },
    hScroll: {
        marginBottom: 24,
        marginHorizontal: -20,
        paddingHorizontal: 20,
    },
    seasonCard: {
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
    },
    seasonName: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    seasonTeam: {
        fontSize: 13,
        fontWeight: '500',
        marginBottom: 2,
    },
    seasonLevel: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    proCta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 24,
    },
    proCtaText: {
        flex: 1,
    },
    proCtaTitle: {
        fontSize: 15,
        fontWeight: '700',
    },
    proCtaSub: {
        fontSize: 12,
        marginTop: 2,
    },
    list: {
        gap: 12,
    },
    matchCard: {
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
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    matchOpponent: {
        fontSize: 18,
        fontWeight: '700',
    },
    matchDate: {
        fontSize: 12,
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
    },
});
