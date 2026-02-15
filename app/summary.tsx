import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { ChevronRight, Home, Share2, Sparkles, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';

import { AdBanner } from '../components/AdBanner';
import { MagicSummaryCard } from '../components/ai/MagicSummaryCard';
import { SocialSharePreview } from '../components/ai/SocialSharePreview';
import { PaywallModal } from '../components/PaywallModal';
import StatsModal from '../components/StatsModal';
import { useAppTheme } from '../contexts/ThemeContext';
import { onMatchCompleted } from '../hooks/useRatingPrompt';
import { GeminiService } from '../services/ai/GeminiService';
import { useDataStore } from '../store/useDataStore';
import { useMatchStore } from '../store/useMatchStore';
import { useSubscriptionStore } from '../store/useSubscriptionStore';
// ... imports

// Helper to reconstruct stats from history (moved out to avoid duplication if we want)
function calculateStats(history: any[]) {
    const s = { ace: 0, kill: 0, totalErrors: 0 };
    history.forEach((log) => {
        if (log.type !== 'point_adjust' && log.team === 'myTeam') {
            if (log.type === 'ace') s.ace++;
            if (log.type === 'kill') s.kill++;
            if (['serve_error', 'attack_error', 'dig_error', 'set_error', 'pass_error', 'receive_0'].includes(log.type)) {
                s.totalErrors++;
            }
        }
    });
    return s;
}

export default function SummaryScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ matchId?: string; source?: 'spectator' | 'saved' }>();
    const { colors, spacing, fontSize: themeFontSize, radius } = useAppTheme();
    const { savedSpectatorMatches, savedMatches } = useDataStore();

    // Determine where data comes from (Store or Saved Record)
    const storeState = useMatchStore();

    let data;
    if (params.matchId) {
        const sourceList = params.source === 'spectator' ? savedSpectatorMatches : savedMatches;
        const record = sourceList.find(m => m.id === params.matchId);
        if (record) {
            data = {
                myTeamName: 'My Team', // Spectator records might not have this, default? Or strictly it represents "The team I watched"
                opponentName: record.opponentName,
                setsWon: record.setsWon,
                history: record.history,
                scores: record.scores,
                aiNarrative: record.aiNarrative,
                matchId: record.id,
                activeSeasonId: record.seasonId,
                roster: [], // We might need to fetch roster if available, or empty
                isReadOnly: true,
                // MatchStore has setAINarrative but here we'd need to update the Record
            };
        }
    }

    // Fallback to active store if no param or record not found
    if (!data) {
        data = {
            ...storeState,
            isReadOnly: false,
        };
    }

    const {
        myTeamName, opponentName, setsWon, history, scores,
        activeSeasonId,
        aiNarrative,
        isReadOnly,
        config
    } = data;

    // Actions from Store
    const { resetMatch, setAINarrative: storeSetAINarrative } = storeState;

    const setAINarrative = (n: any) => {
        if (!isReadOnly) storeSetAINarrative(n);
    };

    // Actions (only available if NOT read-only, or adapted)
    // For Read-Only, specific actions like "New Match" return to dashboard
    // "Generate AI" updates the saved record in DataStore?

    // Get Roster for StatsModal
    const { seasons } = useDataStore();
    const activeSeason = seasons.find(s => s.id === activeSeasonId);
    const roster = activeSeason?.roster || [];

    // ... rest of component logic using `data` instead of `useMatchStore()` hooks directly
    // EXCEPT we need to be careful about hooks.
    // The original code destructured useMatchStore() at the top.
    // We can't conditionally call hooks.
    // So `data` logic above is fine if it replaces the destructuring.

    const [showStats, setShowStats] = useState(false);
    const [showPaywall, setShowPaywall] = useState(false);

    // Subscription gating
    const isPro = useSubscriptionStore((s) => s.isPro);
    const canUseAINarrative = useSubscriptionStore((s) => s.canUseAINarrative);
    const incrementAINarratives = useSubscriptionStore((s) => s.incrementAINarratives);
    const getRemainingAINarratives = useSubscriptionStore((s) => s.getRemainingAINarratives);
    const canUseExport = useSubscriptionStore((s) => s.canUseExport);
    const incrementExports = useSubscriptionStore((s) => s.incrementExports);

    // Trigger rating prompt after match completion
    useEffect(() => { onMatchCompleted(); }, []);

    // AI State
    const [isGenerating, setIsGenerating] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const viewShotRef = useRef<ViewShot>(null);

    // Initialize Service
    const geminiService = useMemo(() => new GeminiService(), []);
    // ...

    // Stats calculation
    const stats = useMemo(() => calculateStats(history), [history]);

    // ...


    const handleNewMatch = () => {
        if (!isReadOnly) resetMatch();
        router.navigate('/');
    };

    const handleShare = async () => {
        try {
            const result = setsWon.myTeam > setsWon.opponent ? 'def.' : 'lost to';
            const message = `VolleyTrack Result:\n${myTeamName} ${result} ${opponentName} (${setsWon.myTeam}-${setsWon.opponent})\n\nStats:\nAces: ${stats.ace}\nKills: ${stats.kill}\nErrors: ${stats.totalErrors}`;
            await Share.share({ message });
        } catch (error) {
            console.error(error);
        }
    };

    const handleGenerateAI = async () => {
        // Check subscription / free tier limit
        if (!canUseAINarrative()) {
            setShowPaywall(true);
            return;
        }

        setIsGenerating(true);
        try {
            const result = await geminiService.generateMatchNarratives(
                useMatchStore.getState(),
                history,
                scores,
                roster
            );
            setAINarrative(result);
            setAINarrative(result); // This might fail if setAINarrative comes from storeState but we are in saved mode?

            // If in read-only mode, we need to manually update local state if we want to show it immediately?
            // Actually, we should check `isReadOnly` or `matchId`.

            // Persist to DataStore (always good)
            const targetMatchId = data.matchId || useMatchStore.getState().matchId;
            useDataStore.getState().updateMatchNarrative(targetMatchId, result);

            // If we are in "Saved" mode, we might need to update the `aimNarrative` in `data` to force re-render?
            // Since `data` is derived from `savedSpectatorMatches` which comes from `useDataStore()`, 
            // updating DataStore SHOULD trigger re-render of `savedSpectatorMatches` and thus `data`.

            // Track usage only after successful generation
            incrementAINarratives();
        } catch (e: any) {
            Alert.alert("AI Generation Failed", e.message || "Unknown error");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSocialShare = async () => {
        // Check export limit for free tier
        if (!canUseExport()) {
            setShowPaywall(true);
            return;
        }

        if (!viewShotRef.current) return;
        try {
            const uri = await viewShotRef.current.capture?.();
            if (uri && await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
                // Track usage only after successful share
                incrementExports();
            } else {
                Alert.alert("Sharing not available", "Sharing is not supported on this device/simulator.");
            }
        } catch (e) {
            Alert.alert("Error", "Failed to capture image for sharing.");
            console.error(e);
        }
    };

    const wonMatch = setsWon.myTeam > setsWon.opponent;

    // Create themed styles
    const themedStyles = {
        container: {
            backgroundColor: colors.bg,
        },
        header: {
            color: colors.text,
        },
        card: {
            backgroundColor: colors.bgCard,
            shadowColor: colors.shadow,
        },
        vsText: {
            color: colors.textSecondary,
        },
        winnerScore: {
            color: colors.primary,
        },
        loserScore: {
            color: colors.text,
        },
        dash: {
            color: colors.textTertiary,
        },
        resultText: {
            color: colors.textSecondary,
        },
        sectionTitle: {
            color: colors.text,
        },
        statBox: {
            backgroundColor: colors.bgCard,
        },
        statValue: {
            color: colors.text,
        },
        statLabel: {
            color: colors.textSecondary,
        },
        statSub: {
            color: colors.textTertiary,
        },
        primaryBtn: {
            backgroundColor: colors.buttonPrimary,
        },
        primaryBtnText: {
            color: colors.buttonPrimaryText,
        },
        successBtn: {
            backgroundColor: colors.success,
        },
        secondaryBtn: {
            backgroundColor: colors.bgCard,
            borderColor: colors.border,
        },
        secondaryText: {
            color: colors.text,
        },
        socialBtn: {
            backgroundColor: '#8A2BE2',
            shadowColor: '#8A2BE2',
        },
        socialBtnText: {
            color: '#fff',
        },
        modalContainer: {
            backgroundColor: colors.bg,
        },
        modalHeader: {
            backgroundColor: colors.bgCard,
            borderBottomColor: colors.headerBorder,
        },
        modalTitle: {
            color: colors.text,
        },
        modalFooter: {
            backgroundColor: colors.bgCard,
            borderTopColor: colors.headerBorder,
        },
        helperText: {
            color: colors.textSecondary,
        },
        shareNowBtn: {
            backgroundColor: colors.text,
        },
        shareNowText: {
            color: colors.bg,
        },
        closeIcon: {
            color: colors.text,
        },
    };

    return (
        <SafeAreaView style={[styles.container, themedStyles.container]}>
            <ScrollView contentContainerStyle={styles.content}>

                <Text style={[styles.header, themedStyles.header]}>Match Summary</Text>

                {/* Score Card */}
                <View style={[styles.card, themedStyles.card]}>
                    <Text style={[styles.vsText, themedStyles.vsText]}>{myTeamName} vs {opponentName}</Text>
                    <View style={styles.scoreRow}>
                        <Text style={[styles.bigScore, wonMatch ? themedStyles.winnerScore : themedStyles.loserScore]}>
                            {setsWon.myTeam}
                        </Text>
                        <Text style={[styles.dash, themedStyles.dash]}>-</Text>
                        <Text style={[styles.bigScore, !wonMatch ? themedStyles.winnerScore : themedStyles.loserScore]}>
                            {setsWon.opponent}
                        </Text>
                    </View>
                    <Text style={[styles.resultText, themedStyles.resultText]}>
                        {wonMatch ? 'Victory!' : 'Match Complete'}
                    </Text>
                </View>

                {/* Stats */}
                <Text style={[styles.sectionTitle, themedStyles.sectionTitle]}>My Team Performance</Text>
                <View style={styles.statsGrid}>
                    <StatBox label="Aces" value={stats.ace} colors={themedStyles} styles={styles} />
                    <StatBox label="Kills" value={stats.kill} colors={themedStyles} styles={styles} />
                    <StatBox label="Errors" value={stats.totalErrors} colors={themedStyles} styles={styles} />
                </View>

                {/* AI Magic Section */}
                <Text style={[styles.sectionTitle, themedStyles.sectionTitle]}>AI Analysis</Text>
                <MagicSummaryCard
                    narrative={aiNarrative}
                    onGenerate={handleGenerateAI}
                    isGenerating={isGenerating}
                />

                {aiNarrative && (
                    <TouchableOpacity style={[styles.socialBtn, themedStyles.socialBtn]} onPress={() => setShowShareModal(true)}>
                        <Sparkles color="#fff" size={20} />
                        <Text style={[styles.socialBtnText, themedStyles.socialBtnText]}>Create Social Post</Text>
                    </TouchableOpacity>
                )}


                {/* AI Usage Indicator & Pro CTA (free tier) */}
                {!isPro && (
                    <View style={{ marginBottom: 16 }}>
                        {!aiNarrative && (
                            <Text style={{ fontSize: 12, color: colors.textTertiary, textAlign: 'center', marginBottom: 8 }}>
                                {getRemainingAINarratives() > 0
                                    ? `${getRemainingAINarratives()} free AI ${getRemainingAINarratives() === 1 ? 'narrative' : 'narratives'} remaining`
                                    : 'Free AI narratives used — upgrade for unlimited'}
                            </Text>
                        )}
                        <TouchableOpacity
                            style={[styles.proCta, { backgroundColor: colors.bgCard, borderColor: colors.primary }]}
                            onPress={() => setShowPaywall(true)}
                            activeOpacity={0.7}
                        >
                            <Sparkles size={16} color={colors.primary} />
                            <Text style={[styles.proCtaLabel, { color: colors.primary }]}>
                                Unlock unlimited AI summaries & more
                            </Text>
                            <ChevronRight size={14} color={colors.primary} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Actions */}
                <View style={styles.actionGroup}>
                    <TouchableOpacity style={[styles.actionBtn, themedStyles.primaryBtn]} onPress={handleShare}>
                        <Share2 color={themedStyles.primaryBtnText.color} size={20} />
                        <Text style={[styles.actionText, themedStyles.primaryBtnText]}>Share Text Result</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionBtn, themedStyles.successBtn]}
                        onPress={() => setShowStats(true)}
                    >
                        <Text style={[styles.actionText, { color: '#fff' }]}>View Match Stats</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.actionBtn, styles.secondaryBtn, themedStyles.secondaryBtn]} onPress={handleNewMatch}>
                        <Home color={themedStyles.secondaryText.color} size={20} />
                        <Text style={[styles.actionText, themedStyles.secondaryText]}>Return to Dashboard</Text>
                    </TouchableOpacity>
                </View>

                {/* Reuse StatsModal */}
                <StatsModal
                    visible={showStats}
                    onClose={() => setShowStats(false)}
                    logs={history}
                    roster={roster}
                />

                {/* Social Share Preview Modal */}
                <Modal
                    visible={showShareModal}
                    animationType="slide"
                    presentationStyle="pageSheet"
                    onRequestClose={() => setShowShareModal(false)}
                >
                    <View style={[styles.modalContainer, themedStyles.modalContainer]}>
                        <View style={[styles.modalHeader, themedStyles.modalHeader]}>
                            <Text style={[styles.modalTitle, themedStyles.modalTitle]}>Social Share Preview</Text>
                            <TouchableOpacity onPress={() => setShowShareModal(false)}>
                                <X color={themedStyles.closeIcon.color} size={24} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.previewContainer}>
                            {/* The Capture Area */}
                            {aiNarrative && (
                                <SocialSharePreview
                                    narrative={aiNarrative}
                                    matchState={useMatchStore.getState()}
                                    viewShotRef={viewShotRef as any}
                                />
                            )}
                        </View>

                        <View style={[styles.modalFooter, themedStyles.modalFooter]}>
                            <Text style={[styles.helperText, themedStyles.helperText]}>
                                This image is generated on-device with reliable match data.
                            </Text>
                            <TouchableOpacity style={[styles.shareNowBtn, themedStyles.shareNowBtn]} onPress={handleSocialShare}>
                                <Share2 color={colors.bg} size={20} />
                                <Text style={[styles.shareNowText, { color: colors.bg }]}>Share Image Now</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

            </ScrollView>

            {/* Ad Banner — pinned to bottom edge */}
            <AdBanner />

            {/* Paywall Modal */}
            <PaywallModal
                visible={showPaywall}
                onClose={() => setShowPaywall(false)}
                trigger="ai_narrative"
            />
        </SafeAreaView>
    );
}

function StatBox({ label, value, sub, colors: themedColors, styles: styleSheet }: any) {
    return (
        <View style={[styleSheet.statBox, themedColors.statBox]}>
            <Text style={[styleSheet.statValue, themedColors.statValue]}>{value}</Text>
            <Text style={[styleSheet.statLabel, themedColors.statLabel]}>{label}</Text>
            {sub && <Text style={[styleSheet.statSub, themedColors.statSub]}>{sub}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 24,
        paddingBottom: 40
    },
    header: {
        fontSize: 28,
        fontWeight: '800',
        marginBottom: 24,
        textAlign: 'center',
    },
    card: {
        padding: 24,
        borderRadius: 20,
        alignItems: 'center',
        marginBottom: 32,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    vsText: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 16,
    },
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    bigScore: {
        fontSize: 64,
        fontWeight: '800',
        lineHeight: 72,
    },
    dash: {
        fontSize: 40,
        marginHorizontal: 16,
    },
    resultText: {
        fontSize: 20,
        fontWeight: '700',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
        marginLeft: 4,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 32,
    },
    statBox: {
        width: '31%', // Fits 3
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
    },
    statLabel: {
        fontSize: 12,
        fontWeight: '600',
    },
    statSub: {
        fontSize: 10,
    },
    proCta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 1,
    },
    proCtaLabel: {
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
    },
    actionGroup: {
        marginTop: 12
    },
    actionBtn: {
        borderRadius: 16,
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 16,
    },
    actionText: {
        fontSize: 16,
        fontWeight: '700',
    },
    secondaryBtn: {
        borderWidth: 1,
    },
    // New Styles
    socialBtn: {
        borderRadius: 16,
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 24,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    socialBtnText: {
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
        padding: 20,
        borderBottomWidth: 1,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700'
    },
    previewContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    modalFooter: {
        padding: 24,
        borderTopWidth: 1,
    },
    helperText: {
        textAlign: 'center',
        marginBottom: 16
    },
    shareNowBtn: {
        borderRadius: 16,
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    shareNowText: {
        fontSize: 16,
        fontWeight: '700'
    }
});
