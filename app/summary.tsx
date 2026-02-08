import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing'; // Import Sharing
import { Home, Share2, Sparkles, X } from 'lucide-react-native'; // Added Sparkles, X
import { useMemo, useRef, useState } from 'react'; // Added useRef
import { Alert, Modal, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native'; // Added Modal, Alert
import { SafeAreaView } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot'; // Import ViewShot
import { MagicSummaryCard } from '../components/ai/MagicSummaryCard'; // Import Card
import { SocialSharePreview } from '../components/ai/SocialSharePreview'; // Import Preview
import StatsModal from '../components/StatsModal';
import { GeminiService } from '../services/ai/GeminiService'; // Import Service
import { useDataStore } from '../store/useDataStore';
import { useMatchStore } from '../store/useMatchStore';

export default function SummaryScreen() {
    const router = useRouter();
    const {
        myTeamName, opponentName, setsWon, history, config, scores, // Added scores
        resetMatch,
        activeSeasonId,
        aiNarrative, setAINarrative, // Added AI state
        setsWon: finalSetsWon, // rename for clarity if needed, but setsWon is fine
    } = useMatchStore();

    // Get Roster for StatsModal
    const { seasons } = useDataStore();
    const activeSeason = seasons.find(s => s.id === activeSeasonId);
    const roster = activeSeason?.roster || [];

    const [showStats, setShowStats] = useState(false);

    // AI State
    const [isGenerating, setIsGenerating] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const viewShotRef = useRef<ViewShot>(null);

    // Initialize Service (memoized to keep instance stable)
    // In production, might want this in a broader context or hook
    const geminiService = useMemo(() => new GeminiService(), []);

    // Helper to aggregate stats
    const stats = useMemo(() => {
        const s = {
            ace: 0,
            kill: 0,
            totalErrors: 0
        };

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
    }, [history]);

    const handleNewMatch = () => {
        resetMatch();
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
        setIsGenerating(true);
        try {
            // Check for API Key (Simple check)
            // In a real app, prompts user to enter key if missing
            const result = await geminiService.generateMatchNarratives(
                useMatchStore.getState(),
                history,
                scores
            );
            setAINarrative(result);
        } catch (e: any) {
            Alert.alert("AI Generation Failed", e.message || "Unknown error");
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

    const wonMatch = setsWon.myTeam > setsWon.opponent;

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>

                <Text style={styles.header}>Match Summary</Text>

                {/* Score Card */}
                <View style={styles.card}>
                    <Text style={styles.vsText}>{myTeamName} vs {opponentName}</Text>
                    <View style={styles.scoreRow}>
                        <Text style={[styles.bigScore, wonMatch ? styles.winner : styles.loser]}>
                            {setsWon.myTeam}
                        </Text>
                        <Text style={styles.dash}>-</Text>
                        <Text style={[styles.bigScore, !wonMatch ? styles.winner : styles.loser]}>
                            {setsWon.opponent}
                        </Text>
                    </View>
                    <Text style={styles.resultText}>
                        {wonMatch ? 'Victory!' : 'Match Complete'}
                    </Text>
                </View>

                {/* Stats */}
                <Text style={styles.sectionTitle}>My Team Performance</Text>
                <View style={styles.statsGrid}>
                    <StatBox label="Aces" value={stats.ace} />
                    <StatBox label="Kills" value={stats.kill} />
                    <StatBox label="Errors" value={stats.totalErrors} />
                </View>

                {/* AI Magic Section */}
                <Text style={styles.sectionTitle}>AI Analysis</Text>
                <MagicSummaryCard
                    narrative={aiNarrative}
                    onGenerate={handleGenerateAI}
                    isGenerating={isGenerating}
                />

                {aiNarrative && (
                    <TouchableOpacity style={styles.socialBtn} onPress={() => setShowShareModal(true)}>
                        <Sparkles color="#fff" size={20} />
                        <Text style={styles.socialBtnText}>Create Social Post</Text>
                    </TouchableOpacity>
                )}


                {/* Actions */}
                <View style={styles.actionGroup}>
                    <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
                        <Share2 color="#fff" size={20} />
                        <Text style={styles.actionText}>Share Text Result</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: '#4caf50' }]}
                        onPress={() => setShowStats(true)}
                    >
                        <Text style={styles.actionText}>View Match Stats</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.actionBtn, styles.secondaryBtn]} onPress={handleNewMatch}>
                        <Home color="#333" size={20} />
                        <Text style={[styles.actionText, styles.secondaryText]}>Return to Dashboard</Text>
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
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Social Share Preview</Text>
                            <TouchableOpacity onPress={() => setShowShareModal(false)}>
                                <X color="#333" size={24} />
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

            </ScrollView>
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
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    content: {
        padding: 24,
        paddingBottom: 40
    },
    header: {
        fontSize: 28,
        fontWeight: '800',
        marginBottom: 24,
        color: '#333',
        textAlign: 'center',
    },
    card: {
        backgroundColor: '#fff',
        padding: 24,
        borderRadius: 20,
        alignItems: 'center',
        marginBottom: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    vsText: {
        fontSize: 16,
        color: '#666',
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
        width: '31%', // Fits 3
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
    actionGroup: {
        marginTop: 12
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
    secondaryBtn: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
    },
    secondaryText: {
        color: '#333',
    },
    // New Styles
    socialBtn: {
        backgroundColor: '#8A2BE2',
        borderRadius: 16,
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 24,
        shadowColor: '#8A2BE2',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    socialBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#f0f0f0'
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee'
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
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#eee'
    },
    helperText: {
        textAlign: 'center',
        color: '#666',
        marginBottom: 16
    },
    shareNowBtn: {
        backgroundColor: '#000',
        borderRadius: 16,
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    shareNowText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700'
    }
});
