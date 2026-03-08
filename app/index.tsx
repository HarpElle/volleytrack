import { useRouter } from 'expo-router';
import { Calendar, ChevronRight, Cloud, CloudOff, Crown, Eye, Flag, Play, RefreshCw, Settings, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, ToastAndroid, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
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
    const { seasons, savedMatches, events, touchSeason, syncStatus, syncWithCloud } = useDataStore();
    const matchStore = useMatchStore();
    const { user } = useAuth();
    const { colors, spacing, fontSize, radius } = useAppTheme();

    const isPro = useSubscriptionStore((s) => s.isPro);
    const canCreateSeason = useSubscriptionStore((s) => s.canCreateSeason);
    const [showPaywall, setShowPaywall] = useState(false);

    // Auto-sync when signed in and app is active
    useAutoSync();

    // H-7: Tappable sync icon with toast/alert feedback
    const handleSyncTap = () => {
        if (syncStatus === 'syncing') return;
        if (syncStatus === 'synced') {
            if (Platform.OS === 'android') {
                ToastAndroid.show('Data synced', ToastAndroid.SHORT);
            } else {
                Alert.alert('Sync Status', 'Your data is synced.');
            }
        } else if (syncStatus === 'error') {
            Alert.alert(
                'Sync Error',
                'Sync failed. Would you like to retry?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Retry', onPress: () => user?.uid && syncWithCloud(user.uid) },
                ]
            );
        }
    };

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

            if (!hasDateA && hasDateB) return -1;
            if (hasDateA && !hasDateB) return 1;
            if (!hasDateA && !hasDateB) return parseInt(b.id) - parseInt(a.id);

            // Priority 2: Date, No Time
            if (!hasTimeA && hasTimeB) return -1;
            if (hasTimeA && !hasTimeB) return 1;
            if (!hasTimeA && !hasTimeB) {
                return parseInt(b.id) - parseInt(a.id);
            }

            // Priority 3: Date + Time
            const dateA = new Date(a.date).setHours(0, 0, 0, 0);
            const dateB = new Date(b.date).setHours(0, 0, 0, 0);

            if (dateA !== dateB) return dateA - dateB;

            const parseTime = (t: string) => {
                if (!t) return -1;
                const match = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
                if (!match) return -1;

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
        .slice(0, 5);

    // Filter Spectator Matches (newest first)
    const { savedSpectatorMatches } = useDataStore();
    const spectatorHistory = [...savedSpectatorMatches]
        .sort((a, b) => (b.date || 0) - (a.date || 0))
        .slice(0, 5);

    // Compute W-L record per season from saved matches
    const seasonRecords = new Map<string, { wins: number; losses: number }>();
    savedMatches.forEach(m => {
        if (!m.seasonId) return;
        if (!seasonRecords.has(m.seasonId)) seasonRecords.set(m.seasonId, { wins: 0, losses: 0 });
        const rec = seasonRecords.get(m.seasonId)!;
        if (m.result === 'Win') rec.wins++;
        else if (m.result === 'Loss') rec.losses++;
    });

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

    const renderMatchItem = (match: MatchRecord, source: 'coach' | 'spectator' = 'coach') => {
        const date = match.date ? new Date(match.date).toLocaleDateString() : 'Date TBD';
        const time = match.time || '';
        const event = match.eventId ? events.find(e => e.id === match.eventId) : null;

        const handlePress = () => {
            if (source === 'spectator') {
                router.push({
                    pathname: '/summary',
                    params: { matchId: match.id, source: 'spectator' }
                });
                return;
            }

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
    const { matchId: activeMatchId, history: activeHistory, myTeamName, opponentName, setsWon, currentSet, scores } = matchStore;
    const isMatchActive = activeMatchId && (activeHistory.length > 0 || setsWon.myTeam > 0 || setsWon.opponent > 0);

    // Build resume metadata string: "Set 2 · 15-12 · Paused 23m ago"
    const resumeMeta = (() => {
        if (!isMatchActive) return '';
        const currentScore = scores[currentSet - 1] || { myTeam: 0, opponent: 0 };
        const parts = [`Set ${currentSet}`, `${currentScore.myTeam}-${currentScore.opponent}`];
        // Time since last action
        if (activeHistory.length > 0) {
            const lastTimestamp = activeHistory[activeHistory.length - 1]?.timestamp;
            if (lastTimestamp) {
                const minutesAgo = Math.floor((Date.now() - lastTimestamp) / 60000);
                if (minutesAgo < 1) parts.push('Just now');
                else if (minutesAgo < 60) parts.push(`Paused ${minutesAgo}m ago`);
                else if (minutesAgo < 1440) parts.push(`Paused ${Math.floor(minutesAgo / 60)}h ago`);
                else parts.push(`Paused ${Math.floor(minutesAgo / 1440)}d ago`);
            }
        }
        return parts.join(' · ');
    })();

    const handleResumeMatch = () => {
        router.push('/live');
    };

    // Swipe-to-reveal actions for Resume Match card
    const SWIPE_ACTION_WIDTH = 160; // 2 buttons × 80px each
    const swipeTranslateX = useSharedValue(0);

    const handleEndMatch = () => {
        swipeTranslateX.value = withSpring(0);
        matchStore.finalizeMatch();
        router.replace('/summary');
    };

    const handleDiscardMatch = () => {
        swipeTranslateX.value = withSpring(0);
        Alert.alert(
            'Discard Match?',
            'This will permanently discard all match data. This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Discard',
                    style: 'destructive',
                    onPress: () => matchStore.resetMatch(),
                },
            ]
        );
    };

    const resumePanGesture = Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-5, 5])
        .onUpdate((e) => {
            // Only allow swiping left (negative translationX), clamp to action width
            swipeTranslateX.value = Math.max(-SWIPE_ACTION_WIDTH, Math.min(0, e.translationX));
        })
        .onEnd((e) => {
            // If swiped past halfway, snap open; otherwise snap closed
            if (swipeTranslateX.value < -SWIPE_ACTION_WIDTH / 2) {
                swipeTranslateX.value = withSpring(-SWIPE_ACTION_WIDTH, { damping: 20, stiffness: 200 });
            } else {
                swipeTranslateX.value = withSpring(0, { damping: 20, stiffness: 200 });
            }
        });

    const resumeCardAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: swipeTranslateX.value }],
    }));

    const resumeActionsAnimatedStyle = useAnimatedStyle(() => ({
        // Actions stay positioned at right edge, revealed as card slides left
        width: -swipeTranslateX.value,
        opacity: swipeTranslateX.value < -5 ? 1 : 0,
    }));

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
                    {user && syncStatus && syncStatus !== 'idle' && (
                        <TouchableOpacity onPress={handleSyncTap} hitSlop={8} disabled={syncStatus === 'syncing'}>
                            {syncStatus === 'syncing'
                                ? <RefreshCw size={18} color={colors.primary} />
                                : syncStatus === 'synced'
                                    ? <Cloud size={18} color={colors.success} />
                                    : <CloudOff size={18} color={colors.error} />
                            }
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => router.push('/settings')} hitSlop={8}>
                        <Settings size={22} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Resume Active Match - Priority 0, swipeable to End or Discard */}
                {isMatchActive && (
                    <View style={{ marginBottom: 16, borderRadius: 16, overflow: 'hidden' }}>
                        <GestureDetector gesture={resumePanGesture}>
                            <Animated.View style={{ flexDirection: 'row' }}>
                                <Animated.View style={[{ flex: 1 }, resumeCardAnimatedStyle]}>
                                    <TouchableOpacity
                                        style={[styles.resumeMatchCard, { backgroundColor: colors.success }]}
                                        onPress={handleResumeMatch}
                                        activeOpacity={0.8}
                                    >
                                        <View style={styles.quickMatchContent}>
                                            <Play size={32} color={colors.buttonPrimaryText} fill={colors.buttonPrimaryText} />
                                            <View>
                                                <Text style={[styles.quickMatchTitle, { color: colors.buttonPrimaryText }]}>Resume Match</Text>
                                                <Text style={[styles.quickMatchSub, { color: colors.buttonPrimaryText }]}>{myTeamName} vs {opponentName}</Text>
                                                {resumeMeta ? (
                                                    <Text style={[styles.resumeMeta, { color: colors.buttonPrimaryText }]}>{resumeMeta}</Text>
                                                ) : null}
                                            </View>
                                        </View>
                                        <ChevronRight size={24} color={`rgba(255,255,255,0.6)`} />
                                    </TouchableOpacity>
                                </Animated.View>
                                <Animated.View style={[styles.swipeActionsRow, { position: 'absolute', right: 0, top: 0, bottom: 0, overflow: 'hidden' }, resumeActionsAnimatedStyle]}>
                                    <TouchableOpacity
                                        style={[styles.swipeAction, { backgroundColor: colors.textSecondary }]}
                                        onPress={handleEndMatch}
                                    >
                                        <Flag size={18} color="#fff" />
                                        <Text style={styles.swipeActionText}>End</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.swipeAction, { backgroundColor: colors.error }]}
                                        onPress={handleDiscardMatch}
                                    >
                                        <Trash2 size={18} color="#fff" />
                                        <Text style={styles.swipeActionText}>Discard</Text>
                                    </TouchableOpacity>
                                </Animated.View>
                            </Animated.View>
                        </GestureDetector>
                    </View>
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

                {/* Secondary Action: Watch Live Match */}
                <TouchableOpacity
                    style={[styles.watchLiveBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                    onPress={() => router.push('/spectate/join')}
                >
                    <Eye size={20} color={colors.primary} />
                    <Text style={[styles.watchLiveText, { color: colors.text }]}>Watch a Live Match</Text>
                    <ChevronRight size={18} color={colors.textTertiary} />
                </TouchableOpacity>

                {/* Seasons Section (MRU) */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, themedStyles.sectionTitle]}>My Seasons & Teams</Text>
                    <TouchableOpacity onPress={handleNewSeason}>
                        <Text style={[styles.seeAll, themedStyles.seeAll]}>+ New</Text>
                    </TouchableOpacity>
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
                                <View style={styles.seasonBottomRow}>
                                    <Text style={[styles.seasonLevel, themedStyles.seasonLevel]}>{season.level}</Text>
                                    {seasonRecords.has(season.id) && (
                                        <Text style={[styles.seasonRecord, { color: colors.textSecondary }]}>
                                            {seasonRecords.get(season.id)!.wins}-{seasonRecords.get(season.id)!.losses}
                                        </Text>
                                    )}
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}

                {/* Pro Upgrade CTA — repositioned below Seasons for better hierarchy */}
                {!isPro && (
                    <TouchableOpacity
                        style={[styles.proCta, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                        onPress={() => setShowPaywall(true)}
                    >
                        <Crown size={20} color={colors.primary} />
                        <View style={styles.proCtaText}>
                            <Text style={[styles.proCtaTitle, { color: colors.text }]}>Unlock VolleyTrack Pro</Text>
                            <Text style={[styles.proCtaSub, { color: colors.textSecondary }]}>Unlimited seasons, AI recaps & more</Text>
                        </View>
                        <ChevronRight size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                )}

                {/* Upcoming Matches */}
                <View style={styles.sectionHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Calendar size={20} color={colors.textSecondary} />
                        <Text style={[styles.sectionTitle, themedStyles.sectionTitle]}>Upcoming Matches</Text>
                    </View>
                    <TouchableOpacity onPress={handleMatchSetup}>
                        <Text style={[styles.seeAll, themedStyles.seeAll]}>+ Schedule</Text>
                    </TouchableOpacity>
                </View>

                {upcomingMatches.length === 0 ? (
                    <View style={[styles.emptyState, themedStyles.emptyState]}>
                        <Text style={[styles.emptyText, themedStyles.emptyText]}>No upcoming matches</Text>
                        <TouchableOpacity onPress={handleMatchSetup}>
                            <Text style={[styles.linkText, themedStyles.linkText]}>Schedule a match</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={[styles.matchListContainer, { backgroundColor: colors.bgCard, borderRadius: 16 }]}>
                        {upcomingMatches.map(match => renderMatchItem(match, 'coach'))}
                    </View>
                )}

                {/* Spectator History */}
                {spectatorHistory.length > 0 && (
                    <>
                        <View style={styles.sectionHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Eye size={20} color={colors.textSecondary} />
                                <Text style={[styles.sectionTitle, themedStyles.sectionTitle]}>Watched Matches</Text>
                            </View>
                        </View>
                        <View style={styles.list}>
                            {spectatorHistory.map(match => renderMatchItem(match, 'spectator'))}
                        </View>
                    </>
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
        marginBottom: 12,
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
        marginBottom: 16,
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
    resumeMatchCard: {
        padding: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    resumeMeta: {
        fontSize: 12,
        fontWeight: '600',
        opacity: 0.85,
        marginTop: 2,
    },
    swipeActionsRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
    },
    swipeAction: {
        width: 80,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 4,
    },
    swipeActionText: {
        color: '#fff',
        fontSize: 12,
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
    seasonBottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    seasonRecord: {
        fontSize: 12,
        fontWeight: '700',
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
    matchListContainer: {
        padding: 16,
        gap: 12,
        marginBottom: 24,
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
