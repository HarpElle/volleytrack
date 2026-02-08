import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { AlignLeft, ChevronRight, Share2, Sparkles, X } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ViewShot from "react-native-view-shot";
import { MagicSummaryCard } from '../../components/ai/MagicSummaryCard';
import { SocialSharePreview } from '../../components/ai/SocialSharePreview';
import FullLogModal from '../../components/FullLogModal';
import StatsModal from '../../components/StatsModal';
import { GeminiService } from '../../services/ai/GeminiService';
import { useDataStore } from '../../store/useDataStore';

export default function MatchDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { savedMatches, seasons, events } = useDataStore();

    const match = savedMatches.find(m => m.id === id);
    const season = match?.seasonId ? seasons.find(s => s.id === match.seasonId) : null;
    const event = match?.eventId ? events.find(e => e.id === match.eventId) : null;
    const roster = season?.roster || [];

    const [showLog, setShowLog] = useState(false);
    const [showStats, setShowStats] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const viewShotRef = useRef<ViewShot>(null);

    const handleGenerateAI = async () => {
        if (!match) return;
        setIsGenerating(true);
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

        } catch (error) {
            console.error(error);
            Alert.alert("AI Error", "Failed to generate analysis. Check your connection or API Key.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSocialShare = async () => {
        if (!viewShotRef.current) return;
        try {
            const uri = await viewShotRef.current.capture?.();
            if (uri && await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
            } else {
                Alert.alert("Sharing not available", "Sharing is not supported on this device/simulator.");
            }
        } catch (e) {
            Alert.alert("Error", "Failed to capture image for sharing.");
            console.error(e);
        }
    };

    if (!match) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <ChevronRight size={24} color="#333" style={{ transform: [{ rotate: '180deg' }] }} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Match not found</Text>
                </View>
            </SafeAreaView>
        );
    }

    const myTeamName = season ? season.teamName : 'My Team';
    const wonMatch = match.setsWon.myTeam > match.setsWon.opponent;

    // Helper to aggregate stats from History
    const stats = useMemo(() => {
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
    }, [match.history]);

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
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <ChevronRight size={24} color="#333" style={{ transform: [{ rotate: '180deg' }] }} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Match Results</Text>
                    <View style={{ width: 24 }} />
                </View>

                {/* Score Card */}
                <View style={styles.card}>
                    {event && <Text style={styles.eventName}>{event.name}</Text>}
                    <Text style={styles.dateText}>
                        {new Date(match.date).toLocaleDateString()}
                        {match.time ? ` • ${match.time}` : ''}
                    </Text>
                    <Text style={styles.vsText}>{myTeamName} vs {match.opponentName}</Text>

                    <View style={styles.scoreRow}>
                        <Text style={[styles.bigScore, wonMatch ? styles.winner : styles.loser]}>
                            {match.setsWon.myTeam}
                        </Text>
                        <Text style={styles.dash}>-</Text>
                        <Text style={[styles.bigScore, !wonMatch ? styles.winner : styles.loser]}>
                            {match.setsWon.opponent}
                        </Text>
                    </View>

                    {/* Set Pills */}
                    <View style={styles.pillRow}>
                        {(match.scores || []).map((setScore, index) => {
                            const weWonSet = setScore.myTeam > setScore.opponent;
                            return (
                                <View key={index} style={[styles.pill, weWonSet ? styles.pillWon : styles.pillLost]}>
                                    <Text style={[styles.pillText, weWonSet ? styles.pillTextWon : styles.pillTextLost]}>
                                        {setScore.myTeam}-{setScore.opponent}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>

                    <Text style={styles.resultText}>
                        {match.result === 'Win' ? 'Victory' : match.result === 'Loss' ? 'Defeat' : match.result}
                    </Text>
                </View>

                {/* Stats */}
                <Text style={styles.sectionTitle}>Performance</Text>
                <View style={styles.statsGrid}>
                    <StatBox label="Aces" value={stats.ace} />
                    <StatBox label="Kills" value={stats.kill} />
                    <StatBox label="Errors" value={stats.totalErrors} />
                </View>

                {/* Actions */}
                <TouchableOpacity style={styles.actionBtn} onPress={() => setShowLog(true)}>
                    <AlignLeft color="#fff" size={20} />
                    <Text style={styles.actionText}>View Full Log</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#4caf50', marginBottom: 24 }]}
                    onPress={() => setShowStats(true)}
                >
                    <AlignLeft color="#fff" size={20} />
                    <Text style={styles.actionText}>View Match Stats</Text>
                </TouchableOpacity>

                {/* AI Magic Section */}
                <Text style={styles.sectionTitle}>AI Analysis</Text>

                {!match.aiNarrative && !isGenerating ? (
                    <TouchableOpacity style={styles.generateCard} onPress={handleGenerateAI}>
                        <View style={styles.sparkleIcon}>
                            <Sparkles size={24} color="#fff" />
                        </View>
                        <Text style={styles.generateTitle}>Generate AI Analysis</Text>
                        <Text style={styles.generateSub}>
                            Get instant tactical insights & social recaps
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <>
                        <MagicSummaryCard
                            narrative={match.aiNarrative}
                            onGenerate={handleGenerateAI}
                            isGenerating={isGenerating}
                        />
                        {match.aiNarrative && (
                            <TouchableOpacity style={styles.socialBtn} onPress={() => setShowShareModal(true)}>
                                <Sparkles color="#fff" size={20} />
                                <Text style={styles.socialBtnText}>Create Social Post</Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}

                <TouchableOpacity style={[styles.actionBtn, styles.secondaryBtn]} onPress={handleShare}>
                    <Share2 color="#333" size={20} />
                    <Text style={[styles.actionText, styles.secondaryText]}>Share Result</Text>
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
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Social Share Preview</Text>
                        <TouchableOpacity onPress={() => setShowShareModal(false)}>
                            <X color="#333" size={24} />
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

                    <View style={styles.modalFooter}>
                        <Text style={styles.helperText}>
                            This image is generated on-device with reliable match data.
                        </Text>
                        <TouchableOpacity style={styles.shareNowBtn} onPress={handleSocialShare}>
                            <Share2 color="#fff" size={20} />
                            <Text style={styles.shareNowText}>Share Image Now</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

function StatBox({ label, value, sub }: any) {
    return (
        <View style={styles.statBox}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
            {sub && <Text style={styles.statSub}>{sub}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    // ... existing styles ...
    container: {
        flex: 1,
        backgroundColor: '#f5f7fa',
    },
    // Add new styles here
    generateCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#EFEFEF',
        borderStyle: 'dashed',
        marginBottom: 24
    },
    sparkleIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#8A2BE2',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12
    },
    generateTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4
    },
    generateSub: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center'
    },
    socialBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#8A2BE2',
        padding: 16,
        borderRadius: 12,
        gap: 8,
        marginTop: 12,
        marginBottom: 24
    },
    socialBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#f5f7fa'
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee'
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
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#eee'
    },
    helperText: {
        textAlign: 'center',
        marginBottom: 16,
        color: '#666',
        fontSize: 12
    },
    shareNowBtn: {
        backgroundColor: '#0066cc',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        gap: 8
    },
    shareNowText: {
        color: '#fff',
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
        color: '#333',
    },
    card: {
        backgroundColor: '#fff',
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
        color: '#0066cc',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    dateText: {
        fontSize: 12,
        color: '#999',
        fontWeight: '600',
        marginBottom: 8,
    },
    vsText: {
        fontSize: 16,
        color: '#333',
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
        color: '#0066cc',
    },
    loser: {
        color: '#333',
    },
    dash: {
        fontSize: 40,
        color: '#ccc',
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
    resultText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#444',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
        marginLeft: 4,
        color: '#333',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 32,
    },
    statBox: {
        width: '31%', // Fits 3 perfectly with gap logic approx
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
        color: '#333',
    },
    statLabel: {
        fontSize: 12,
        color: '#666',
        fontWeight: '600',
    },
    statSub: {
        fontSize: 10,
        color: '#999',
    },
    actionBtn: {
        backgroundColor: '#0066cc',
        borderRadius: 16,
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 16,
    },
    actionText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    analysisBtn: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#0066cc',
        borderStyle: 'dashed',
    },
    analysisText: {
        color: '#0066cc',
    },
    secondaryBtn: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
    },
    secondaryText: {
        color: '#333',
    },
});
