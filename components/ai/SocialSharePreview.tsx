import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import { AINarrative, MatchState } from '../../types';

interface SocialSharePreviewProps {
    narrative: AINarrative;
    matchState: MatchState;
    viewShotRef: React.RefObject<ViewShot>;
}

export const SocialSharePreview: React.FC<SocialSharePreviewProps> = ({ narrative, matchState, viewShotRef }) => {
    // Determine winner for "Win" or "Loss" styling
    const myTeamWon = matchState.setsWon.myTeam > matchState.setsWon.opponent;
    const resultText = myTeamWon ? "VICTORY" : "FINAL";

    // Calculate simple stats for the card
    const scoreString = matchState.scores.map(s => `${s.myTeam}-${s.opponent}`).join(" | ");

    return (
        <ViewShot ref={viewShotRef} options={{ format: "jpg", quality: 0.9 }}>
            <View style={styles.container}>
                {/* Background Gradient / Circle Elements */}
                <View style={styles.background}>
                    <View style={styles.circle1} />
                    <View style={styles.circle2} />
                </View>

                <View style={styles.contentOverlay}>
                    {/* Header: Season + App Branding */}
                    <View style={styles.headerRow}>
                        <Text style={styles.seasonText}>2025 SEASON</Text>
                        <Text style={styles.headerBrand}>VOLLEYTRACK AI</Text>
                    </View>

                    {/* Main Scoreboard Area */}
                    <View style={styles.scoreBoard}>
                        <View style={styles.resultBadge}>
                            <Text style={styles.resultText}>{resultText}</Text>
                        </View>

                        <View style={styles.matchupContainer}>
                            {/* MY TEAM */}
                            <View style={styles.teamBlock}>
                                <Text
                                    style={[styles.teamNameMain, myTeamWon ? styles.teamWon : styles.teamNeutral]}
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                >
                                    {matchState.myTeamName}
                                </Text>
                                <Text style={[styles.bigScore, myTeamWon ? styles.scoreWon : styles.scoreNeutral]}>
                                    {matchState.setsWon.myTeam}
                                </Text>
                            </View>

                            <View style={styles.vsContainer}>
                                <Text style={styles.vsText}>VS</Text>
                            </View>

                            {/* OPPONENT - Always Neutral per User Request */}
                            <View style={styles.teamBlock}>
                                <Text
                                    style={[styles.teamNameOpponent, styles.teamNeutral]}
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                >
                                    {matchState.opponentName}
                                </Text>
                                <Text style={[styles.bigScore, styles.scoreNeutral]}>
                                    {matchState.setsWon.opponent}
                                </Text>
                            </View>
                        </View>

                        {/* Set Scores Row */}
                        <View style={styles.setsContainer}>
                            <Text style={styles.setsLabel}>SET SCORES</Text>
                            <Text style={styles.setsValue}>{scoreString}</Text>
                        </View>
                    </View>

                    {/* AI Narrative Snippet */}
                    <View style={styles.narrativeBox}>
                        <Text style={styles.narrativeTitle}>MATCH RECAP</Text>
                        <Text style={styles.narrativeText} numberOfLines={5}>
                            "{narrative.socialSummary}"
                        </Text>
                    </View>
                </View>
            </View>
        </ViewShot>
    );
};

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 32; // Full width minus margins
const CARD_HEIGHT = CARD_WIDTH * 1.25; // 4:5 aspect ratio for social

const styles = StyleSheet.create({
    container: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        backgroundColor: '#111',
        overflow: 'hidden',
        position: 'relative',
        borderRadius: 0, // Zero radius for clean image capture? Or meaningful radius?
    },
    background: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#1E1E2E',
    },
    circle1: {
        position: 'absolute',
        top: -50,
        right: -50,
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: '#8A2BE2',
        opacity: 0.4
    },
    circle2: {
        position: 'absolute',
        bottom: -20,
        left: -80,
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: '#FF007F', // Accent pink
        opacity: 0.3
    },
    contentOverlay: {
        flex: 1,
        padding: 24,
        justifyContent: 'space-between',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        opacity: 0.8
    },
    seasonText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 3,
        textTransform: 'uppercase'
    },
    headerBrand: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
    },
    scoreBoard: {
        marginTop: 0,
        marginBottom: 10,
        flex: 1,
        justifyContent: 'center',
    },
    resultBadge: {
        backgroundColor: '#fff',
        alignSelf: 'center',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 4,
        marginBottom: 40,
        transform: [{ skewX: '-10deg' }]
    },
    resultText: {
        color: '#000',
        fontWeight: '900',
        fontSize: 12,
        letterSpacing: 1,
        textTransform: 'uppercase'
    },
    matchupContainer: {
        flexDirection: 'row', // Side by Side
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 40,
    },
    teamBlock: {
        flex: 1,
        alignItems: 'center',
    },
    teamNameMain: {
        fontSize: 18, // Slightly smaller to fit side-by-side
        fontWeight: '900',
        textAlign: 'center',
        textTransform: 'uppercase',
        marginBottom: 8,
        letterSpacing: 0
    },
    teamNameOpponent: {
        fontSize: 18,
        fontWeight: '900',
        textAlign: 'center',
        textTransform: 'uppercase',
        marginBottom: 8,
        letterSpacing: 0
    },
    teamWon: {
        color: '#fff',
        textShadowColor: 'rgba(138, 43, 226, 0.8)', // Neon glow
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    teamNeutral: {
        color: '#ffffff', // Explicit White for contrast
    },
    vsContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingTop: 30 // visually align with center of mass
    },
    vsText: {
        color: 'rgba(255,255,255,0.2)',
        fontWeight: '900',
        fontSize: 14,
        fontStyle: 'italic'
    },
    bigScore: {
        fontSize: 64,
        fontWeight: '900',
        lineHeight: 64,
        letterSpacing: -2,
    },
    scoreWon: {
        color: '#FFD700', // Gold
    },
    scoreNeutral: {
        color: '#ffffff', // White
    },
    setsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 20,
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    setsLabel: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
        marginRight: 10
    },
    setsValue: {
        color: 'white',
        fontSize: 14,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
        letterSpacing: 2
    },
    narrativeBox: {
        backgroundColor: 'rgba(255,255,255,0.95)',
        padding: 20,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
    },
    narrativeTitle: {
        color: '#8A2BE2',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1,
        marginBottom: 8,
        textTransform: 'uppercase'
    },
    narrativeText: {
        color: '#1a1a1a',
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '600',
    }
});
