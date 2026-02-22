import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { AlignLeft, ChevronRight, Share2, Sparkles, X } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ViewShot from "react-native-view-shot";
import { useAppTheme } from '../../contexts/ThemeContext';
import { MagicSummaryCard } from '../../components/ai/MagicSummaryCard';
import { SocialSharePreview } from '../../components/ai/SocialSharePreview';
import FullLogModal from '../../components/FullLogModal';
import StatsModal from '../../components/StatsModal';
import { AIError, GeminiService } from '../../services/ai/GeminiService';
import { useDataStore } from '../../store/useDataStore';
import { useSubscriptionStore } from '../../store/useSubscriptionStore';
import { PaywallModal } from '../../components/PaywallModal';

export default function MatchDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { colors } = useAppTheme();
    const { savedMatches, seasons, events } = useDataStore();

    const match = savedMatches.find(m => m.id === id);
    const season = match?.seasonId ? seasons.find(s => s.id === match.seasonId) : null;
    const event = match?.eventId ? events.find(e => e.id === match.eventId) : null;
    const roster = season?.roster || [];

    const [showLog, setShowLog] = useState(false);
    const [showStats, setShowStats] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [failedPrompt, setFailedPrompt] = useState<string | undefined>(undefined);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showPaywall, setShowPaywall] = useState(false);
    const [paywallTrigger, setPaywallTrigger] = useState<'export' | 'ai_narrative'>('export');
    const viewShotRef = useRef<ViewShot>(null);

    // Subscription gating for exports
    const canUseExport = useSubscriptionStore((s) => s.canUseExport);
    const incrementExports = useSubscriptionStore((s) => s.incrementExports);

    // Subscription gating for AI narratives
    const canUseAINarrative = useSubscriptionStore((s) => s.canUseAINarrative);
    const incrementAINarratives = useSubscriptionStore((s) => s.incrementAINarratives);

    const handleGenerateAI = async () => {
        if (!match) return;

        // Check subscription / free tier limit
        if (!canUseAINarrative()) {
            setPaywallTrigger('ai_narrative');
            setShowPaywall(true);
            return;
        }

        setIsGenerating(true);
        setFailedPrompt(undefined);
        try {
            const service = new GeminiService();
            const mockState = {
                ...match,
                myTeamName,
                opponentName: match.opponentName,
                setsWon: match.setsWon
            };

            const narrative = await service.generateMatchNarratives(
                mockState as any,
                match.history || [],
                match.scores || [],
                roster,
                {
                    eventName: event?.name,
                    date: new Date(match.date).toLocaleDateString(),
                    location: event?.location
                }
            );

            // Save to DataStore
            const updatedMatch = { ...match, aiNarrative: narrative };
            useDataStore.getState().saveMatchRecord(updatedMatch);

            // Track usage after successful generation
            incrementAINarratives();

        } catch (error: any) {
            console.error(error);
            if (error instanceof AIError) {
                setFailedPrompt(error.prompt);
                Alert.alert("AI Error", error.message);
            } else {
                Alert.alert("AI Error", "Failed to generate analysis. Check your connection and try again.");
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSocialShare = async () => {
        // Check export limit for free tier
        if (!canUseExport()) {
            setPaywallTrigger('export');
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

    const myTeamName = match ? (season ? season.teamName : 'My Team') : '';
    const wonMatch = match ? match.setsWon.myTeam > match.setsWon.opponent : false;

    // Helper to aggregate stats from History — hooks must be called unconditionally
    const stats = useMemo(() => {
        if (!match) return { ace: 0, kill: 0, totalErrors: 0 };
        const s = {
            ace: 0,
            kill: 0,
            totalErrors: 0
        };

        if (match.history) {
            match.history.forEach((log) => {
                if (log.type !== 'point_adjust' && log.team === 'myTeam') {
                    if (log.type === 'ace') s.ace++;
                    if (log.type === 'kill') s.kill++;
                    if (['serve_error', 'attack_error', 'dig_error', 'set_error', 'pass_error', 'receive_0'].includes(log.type)) {
                        s.totalErrors++;
                    }
                }
            });
        }
        return s;
    }, [match?.history]);

    if (!match) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <ChevronRight size={24} color={colors.text} style={{ transform: [{ rotate: '180deg' }] }} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Match not found</Text>
                </View>
            </SafeAreaView>
        );
    }

    const handleShare = async () => {
        try {
            const result = match.setsWon.myTeam > match.setsWon.opponent ? 'def.' : 'lost to';
            const message = `VolleyTrack Result:\n${myTeamName} ${result} ${match.opponentName} (${match.setsWon.myTeam}-${match.setsWon.opponent})\nEvent: ${event?.name || 'Match'}`;
            await Share.share({ message });
        } catch (error) {
            console.error(error);
        }
    };

    const handleAnalysisPlaceholder = () => {
        Alert.alert("Coming Soon", "Full Summary & Analysis features are currently in development.");
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
            <ScrollView contentContainerStyle={styles.content}>

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <ChevronRight size={24} color={colors.text} style={{ transform: [{ rotate: '180deg' }] }} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Match Results</Text>
                    <View style={{ width: 24 }} />
                </View>

                {/* Score Card */}
                <View style={[styles.card, { backgroundColor: colors.bgCard }]}>
                    {event && <Text style={[styles.eventName, { color: colors.primary }]}>{event.name}</Text>}
                    <Text style={[styles.dateText, { color: colors.textTertiary }]}>
                        {new Date(match.date).toLocaleDateString()}
                        {match.time ? ` • ${match.time}` : ''}
                    </Text>
                    <Text style={[styles.vsText, { color: colors.text }]}>{myTeamName} vs {match.opponentName}</Text>

                    <View style={styles.scoreRow}>
                        <Text style={[styles.bigScore, wonMatch ? { color: colors.primary } : { color: colors.text }]}>
                            {match.setsWon.myTeam}
                        </Text>
                        <Text style={[styles.dash, { color: colors.border }]}>-</Text>
                        <Text style={[styles.bigScore, !wonMatch ? { color: colors.primary } : { color: colors.text }]}>
                            {match.setsWon.opponent}
                        </Text>
                    </View>

                    {/* Set Pills */}
                    <View style={styles.pillRow}>
                        {(match.scores || []).map((setScore, index) => {
                            const weWonSet = setScore.myTeam > setScore.opponent;
                            return (
                                <View key={index} style={[styles.pill, weWonSet ? { backgroundColor: colors.successLight, borderColor: colors.success } : { backgroundColor: colors.errorLight, borderColor: colors.error }]}>
                                    <Text style={[styles.pillText, weWonSet ? { color: colors.success } : { color: colors.error }]}>
                                        {setScore.myTeam}-{setScore.opponent}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>

                    <Text style={[styles.resultText, { color: colors.textSecondary }]}>
                        {match.result === 'Win' ? 'Victory' : match.result === 'Loss' ? 'Defeat' : match.result}
                    </Text>
                </View>

                {/* Stats */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Performance</Text>
                <View style={styles.statsGrid}>
                    <StatBox label="Aces" value={stats.ace} colors={colors} />
                    <StatBox label="Kills" value={stats.kill} colors={colors} />
                    <StatBox label="Errors" value={stats.totalErrors} colors={colors} />
                </View>

                {/* Actions */}
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => setShowLog(true)}>
                    <AlignLeft color={'#ffffff'} size={20} />
                    <Text style={[styles.actionText, { color: '#ffffff' }]}>View Full Log</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.success, marginBottom: 24 }]}
                    onPress={() => setShowStats(true)}
                >
                    <AlignLeft color={'#ffffff'} size={20} />
                    <Text style={[styles.actionText, { color: '#ffffff' }]}>View Match Stats</Text>
                </TouchableOpacity>

                {/* AI Magic Section */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>AI Analysis</Text>

                {!match.aiNarrative && !isGenerating ? (
                    <TouchableOpacity style={[styles.generateCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]} onPress={handleGenerateAI}>
                        <View style={[styles.sparkleIcon, { backgroundColor: '#8A2BE2' }]}>
                            <Sparkles size={24} color={'#ffffff'} />
                        </View>
                        <Text style={[styles.generateTitle, { color: colors.text }]}>Generate AI Analysis</Text>
                        <Text style={[styles.generateSub, { color: colors.textSecondary }]}>
                            Get instant tactical insights & social recaps
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <>
                        <MagicSummaryCard
                            narrative={match.aiNarrative}
                            onGenerate={handleGenerateAI}
                            isGenerating={isGenerating}
                            failedPrompt={failedPrompt}
                        />
                        {match.aiNarrative && (
                            <TouchableOpacity style={[styles.socialBtn, { backgroundColor: '#8A2BE2' }]} onPress={() => setShowShareModal(true)}>
                                <Sparkles color={'#ffffff'} size={20} />
                                <Text style={[styles.socialBtnText, { color: '#ffffff' }]}>Create Social Post</Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}

                <TouchableOpacity style={[styles.actionBtn, styles.secondaryBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]} onPress={handleShare}>
                    <Share2 color={colors.text} size={20} />
                    <Text style={[styles.actionText, styles.secondaryText, { color: colors.text }]}>Share Result</Text>
                </TouchableOpacity>

            </ScrollView>

            <FullLogModal
                visible={showLog}
                onClose={() => setShowLog(false)}
                history={match.history || []}
                roster={roster}
                lineups={match.lineups}
                onUpdateLog={(logId, updates) => useDataStore.getState().updateLogEntry(id as string, logId, updates)}
            />

            <StatsModal
                visible={showStats}
                onClose={() => setShowStats(false)}
                logs={match.history || []}
                roster={roster}
            />

            {/* Social Share Preview Modal */}
            <Modal
                visible={showShareModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowShareModal(false)}
            >
                <View style={[styles.modalContainer, { backgroundColor: colors.bg }]}>
                    <View style={[styles.modalHeader, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Social Share Preview</Text>
                        <TouchableOpacity onPress={() => setShowShareModal(false)}>
                            <X color={colors.text} size={24} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.previewContainer}>
                        {/* The Capture Area */}
                        {match.aiNarrative && (
                            <SocialSharePreview
                                narrative={match.aiNarrative}
                                matchState={{
                                    ...match,
                                    myTeamName: myTeamName // Use resolve name from season
                                } as any}
                                viewShotRef={viewShotRef as any}
                            />
                        )}
                    </View>

                    <View style={[styles.modalFooter, { backgroundColor: colors.bgCard, borderTopColor: colors.border }]}>
                        <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                            This image is generated on-device with reliable match data.
                        </Text>
                        <TouchableOpacity style={[styles.shareNowBtn, { backgroundColor: colors.primary }]} onPress={handleSocialShare}>
                            <Share2 color={'#ffffff'} size={20} />
                            <Text style={[styles.shareNowText, { color: '#ffffff' }]}>Share Image Now</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Paywall Modal */}
            <PaywallModal
                visible={showPaywall}
                onClose={() => setShowPaywall(false)}
                trigger={paywallTrigger}
            />
        </SafeAreaView>
    );
}

function StatBox({ label, value, sub, colors }: any) {
    return (
        <View style={[styles.statBox, { backgroundColor: colors.bgCard }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
            {sub && <Text style={[styles.statSub, { color: colors.textTertiary }]}>{sub}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    // ... existing styles ...
    container: {
        flex: 1,
    },
    // Add new styles here
    generateCard: {
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderStyle: 'dashed',
        marginBottom: 24
    },
    sparkleIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12
    },
    generateTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4
    },
    generateSub: {
        fontSize: 14,
        textAlign: 'center'
    },
    socialBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        gap: 8,
        marginTop: 12,
        marginBottom: 24
    },
    socialBtnText: {
        fontWeight: 'bold',
        fontSize: 16
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
        fontWeight: 'bold'
    },
    previewContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
    },
    modalFooter: {
        padding: 24,
        borderTopWidth: 1,
    },
    helperText: {
        textAlign: 'center',
        marginBottom: 16,
        fontSize: 12
    },
    shareNowBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        gap: 8
    },
    shareNowText: {
        fontWeight: 'bold',
        fontSize: 16
    },
    content: {
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    backBtn: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    card: {
        padding: 24,
        borderRadius: 20,
        alignItems: 'center',
        marginBottom: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
    },
    eventName: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    dateText: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 8,
    },
    vsText: {
        fontSize: 16,
        fontWeight: '700',
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
    winner: {
    },
    loser: {
    },
    dash: {
        fontSize: 40,
        marginHorizontal: 16,
    },
    pillRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 20,
    },
    pill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
    },
    pillWon: {
    },
    pillLost: {
    },
    pillText: {
        fontSize: 14,
        fontWeight: '700',
    },
    pillTextWon: {
    },
    pillTextLost: {
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
        width: '31%', // Fits 3 perfectly with gap logic approx
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
    analysisBtn: {
        borderWidth: 1,
        borderStyle: 'dashed',
    },
    analysisText: {
    },
    secondaryBtn: {
        borderWidth: 1,
    },
    secondaryText: {
    },
});
