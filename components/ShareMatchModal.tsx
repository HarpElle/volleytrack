import * as Clipboard from 'expo-clipboard';
import { Check, Copy, Radio, Share2, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Platform,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useAppTheme } from '../contexts/ThemeContext';

interface ShareMatchModalProps {
    visible: boolean;
    onClose: () => void;
    matchCode: string | null;
    isBroadcasting: boolean;
    isStarting: boolean;
    error: string | null;
    onStartShare: () => Promise<string | null>;
    onStopShare: () => Promise<void>;
}

export default function ShareMatchModal({
    visible,
    onClose,
    matchCode,
    isBroadcasting,
    isStarting,
    error,
    onStartShare,
    onStopShare,
}: ShareMatchModalProps) {
    const { colors } = useAppTheme();
    const [copied, setCopied] = useState<'code' | 'link' | null>(null);

    const deepLink = matchCode ? `volleytrack://spectate/${matchCode}` : '';

    const handleCopy = async (text: string, type: 'code' | 'link') => {
        await Clipboard.setStringAsync(text);
        setCopied(type);
        setTimeout(() => setCopied(null), 2000);
    };

    const handleNativeShare = async () => {
        if (!matchCode) return;
        try {
            await Share.share({
                message: `Watch my volleyball match live on VolleyTrack!\n\nMatch Code: ${matchCode}\n\nOpen VolleyTrack and enter the code to watch.`,
            });
        } catch (_) {
            // User cancelled share
        }
    };

    const handleStart = async () => {
        await onStartShare();
    };

    const handleStop = async () => {
        await onStopShare();
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={[styles.overlay, { backgroundColor: colors.bgOverlay }]}>
                <View style={[styles.card, { backgroundColor: colors.bgCard, shadowColor: colors.shadow }]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: colors.text }]}>
                            {isBroadcasting ? 'Sharing Live' : 'Share This Match'}
                        </Text>
                        <TouchableOpacity onPress={onClose} hitSlop={12}>
                            <X size={22} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Error */}
                    {error && (
                        <View style={[styles.errorBanner, { backgroundColor: colors.opponent + '20' }]}>
                            <Text style={[styles.errorText, { color: colors.opponent }]}>{error}</Text>
                        </View>
                    )}

                    {isBroadcasting && matchCode ? (
                        /* Broadcasting Active */
                        <View style={styles.content}>
                            {/* Live indicator */}
                            <View style={styles.liveRow}>
                                <View style={styles.liveDot} />
                                <Text style={[styles.liveText, { color: colors.success }]}>Broadcasting</Text>
                            </View>

                            {/* Match Code */}
                            <View style={styles.section}>
                                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Match Code</Text>
                                <TouchableOpacity
                                    style={[styles.codeContainer, { backgroundColor: colors.bg, borderColor: colors.border }]}
                                    onPress={() => handleCopy(matchCode, 'code')}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.codeText, { color: colors.text }]}>
                                        {matchCode.split('').join(' ')}
                                    </Text>
                                    {copied === 'code' ? (
                                        <Check size={20} color={colors.success} />
                                    ) : (
                                        <Copy size={20} color={colors.textSecondary} />
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* Deep Link */}
                            <View style={styles.section}>
                                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Link</Text>
                                <TouchableOpacity
                                    style={[styles.linkContainer, { backgroundColor: colors.bg, borderColor: colors.border }]}
                                    onPress={() => handleCopy(deepLink, 'link')}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.linkText, { color: colors.primary }]} numberOfLines={1}>
                                        {deepLink}
                                    </Text>
                                    {copied === 'link' ? (
                                        <Check size={18} color={colors.success} />
                                    ) : (
                                        <Copy size={18} color={colors.textSecondary} />
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* QR Code */}
                            <View style={[styles.qrContainer, { backgroundColor: '#ffffff', borderColor: colors.border }]}>
                                <QRCode
                                    value={deepLink}
                                    size={140}
                                    backgroundColor="#ffffff"
                                    color="#000000"
                                />
                            </View>
                            <Text style={[styles.qrHint, { color: colors.textTertiary }]}>
                                Scan to open spectator view
                            </Text>

                            {/* Action Buttons */}
                            <View style={styles.actions}>
                                <TouchableOpacity
                                    style={[styles.shareBtn, { backgroundColor: colors.primary }]}
                                    onPress={handleNativeShare}
                                >
                                    <Share2 size={18} color="#ffffff" style={{ marginRight: 8 }} />
                                    <Text style={styles.shareBtnText}>Share</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.stopBtn, { borderColor: colors.opponent }]}
                                    onPress={handleStop}
                                >
                                    <Text style={[styles.stopBtnText, { color: colors.opponent }]}>Stop Sharing</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={[styles.hint, { color: colors.textTertiary }]}>
                                Spectators open VolleyTrack and enter the code to watch live.
                            </Text>
                        </View>
                    ) : (
                        /* Not Broadcasting */
                        <View style={styles.content}>
                            <View style={[styles.iconContainer, { backgroundColor: colors.primaryLight }]}>
                                <Radio size={32} color={colors.primary} />
                            </View>

                            <Text style={[styles.description, { color: colors.textSecondary }]}>
                                Share a code so parents, fans, and teammates can follow this match in real-time.
                            </Text>

                            <TouchableOpacity
                                style={[styles.startBtn, { backgroundColor: colors.primary }]}
                                onPress={handleStart}
                                disabled={isStarting}
                            >
                                {isStarting ? (
                                    <ActivityIndicator color="#ffffff" size="small" />
                                ) : (
                                    <>
                                        <Radio size={20} color="#ffffff" style={{ marginRight: 8 }} />
                                        <Text style={styles.startBtnText}>Start Sharing</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            <Text style={[styles.hint, { color: colors.textTertiary }]}>
                                Requires an internet connection. Your match continues locally even if connection drops.
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 380,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
    },
    errorBanner: {
        borderRadius: 8,
        padding: 10,
        marginBottom: 12,
    },
    errorText: {
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
    },
    content: {
        alignItems: 'center',
    },
    // Live state
    liveRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    liveDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#4caf50',
        marginRight: 8,
    },
    liveText: {
        fontSize: 14,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    section: {
        width: '100%',
        marginBottom: 16,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    codeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    codeText: {
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: 6,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    linkContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        gap: 8,
    },
    linkText: {
        fontSize: 13,
        fontWeight: '500',
        flex: 1,
    },
    qrContainer: {
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 8,
    },
    qrHint: {
        fontSize: 11,
        marginBottom: 16,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
        marginBottom: 16,
    },
    shareBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 10,
    },
    shareBtnText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
    },
    stopBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
    },
    stopBtnText: {
        fontSize: 15,
        fontWeight: '700',
    },
    // Not broadcasting state
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    description: {
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 24,
    },
    startBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 12,
        width: '100%',
        marginBottom: 16,
    },
    startBtnText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
    hint: {
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 18,
    },
});
