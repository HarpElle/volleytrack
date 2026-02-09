import * as Clipboard from 'expo-clipboard';
import { BarChart2, Bug, Copy, Sparkles, Users } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AINarrative } from '../../types';

interface MagicSummaryCardProps {
    narrative?: AINarrative;
    onGenerate: () => void;
    isGenerating: boolean;
    failedPrompt?: string;
}

export const MagicSummaryCard: React.FC<MagicSummaryCardProps> = ({ narrative, onGenerate, isGenerating, failedPrompt }) => {
    const [activeTab, setActiveTab] = useState<'coach' | 'social'>('coach');

    const handleCopy = async () => {
        const text = activeTab === 'coach' ? narrative?.coachSummary : narrative?.socialSummary;
        if (text) {
            await Clipboard.setStringAsync(text);
        }
    };

    const handleCopyDebug = async () => {
        if (failedPrompt) {
            await Clipboard.setStringAsync(failedPrompt);
        }
    };

    if (!narrative && !isGenerating) {
        return (
            <View style={styles.container}>
                <View style={styles.promoContent}>
                    <Sparkles size={32} color="#8A2BE2" />
                    <Text style={styles.promoTitle}>AI Match Insights</Text>
                    <Text style={styles.promoText}>
                        Generate instant tactical analysis and exciting game recaps.
                    </Text>

                    {failedPrompt && (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>Generation failed. Help us debug?</Text>
                            <TouchableOpacity style={styles.debugButton} onPress={handleCopyDebug}>
                                <Bug size={16} color="#d32f2f" />
                                <Text style={styles.debugButtonText}>Copy Debug Info</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <TouchableOpacity style={styles.generateButton} onPress={onGenerate}>
                        <Text style={styles.generateButtonText}>Generate Magic ✨</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.tabs}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'coach' && styles.activeTab]}
                        onPress={() => setActiveTab('coach')}
                    >
                        <BarChart2 size={16} color={activeTab === 'coach' ? '#fff' : '#666'} />
                        <Text style={[styles.tabText, activeTab === 'coach' && styles.activeTabText]}>Analyst Report</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'social' && styles.activeTab]}
                        onPress={() => setActiveTab('social')}
                    >
                        <Users size={16} color={activeTab === 'social' ? '#fff' : '#666'} />
                        <Text style={[styles.tabText, activeTab === 'social' && styles.activeTabText]}>Fan Recap</Text>
                    </TouchableOpacity>
                </View>
                {isGenerating ? (
                    <ActivityIndicator size="small" color="#8A2BE2" />
                ) : (
                    <TouchableOpacity style={styles.actionButton} onPress={handleCopy}>
                        <Copy size={20} color="#666" />
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView style={styles.contentScroll} nestedScrollEnabled>
                {isGenerating ? (
                    <Text style={styles.loadingText}>Analyzing match data... identifying key plays...</Text>
                ) : (
                    <Text style={styles.summaryText}>
                        {activeTab === 'coach' ? narrative?.coachSummary : narrative?.socialSummary}
                    </Text>
                )}
            </ScrollView>

            {!isGenerating && (
                <View style={styles.footer}>
                    {narrative && (
                        <TouchableOpacity onPress={onGenerate} style={styles.regenerateLink}>
                            <Text style={styles.regenerateText}>Regenerate</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginVertical: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#EFEFEF'
    },
    promoContent: {
        alignItems: 'center',
        padding: 16,
    },
    promoTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 12,
        marginBottom: 8,
        color: '#1a1a1a'
    },
    promoText: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20
    },
    generateButton: {
        backgroundColor: '#8A2BE2',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 24,
        shadowColor: '#8A2BE2',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    generateButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
    },
    tabs: {
        flexDirection: 'row',
        backgroundColor: '#F5F5F5',
        borderRadius: 20,
        padding: 4,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        gap: 6
    },
    activeTab: {
        backgroundColor: '#8A2BE2',
    },
    tabText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#666'
    },
    activeTabText: {
        color: '#fff'
    },
    actionButton: {
        padding: 4
    },
    contentScroll: {
        maxHeight: 300,
    },
    loadingText: {
        fontStyle: 'italic',
        color: '#888',
        textAlign: 'center',
        padding: 20
    },
    summaryText: {
        fontSize: 15,
        lineHeight: 24,
        color: '#333'
    },
    footer: {
        marginTop: 12,
        alignItems: 'flex-end'
    },
    regenerateLink: {
        padding: 4
    },
    regenerateText: {
        fontSize: 12,
        color: '#666',
        textDecorationLine: 'underline'
    },
    errorContainer: {
        alignItems: 'center',
        marginVertical: 12,
        padding: 8,
        backgroundColor: '#fee',
        borderRadius: 8,
        width: '100%'
    },
    errorText: {
        fontSize: 14,
        color: '#d32f2f',
        marginBottom: 8,
        textAlign: 'center'
    },
    debugButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#d32f2f',
        gap: 6
    },
    debugButtonText: {
        fontSize: 12,
        color: '#d32f2f',
        fontWeight: '600'
    }
});
