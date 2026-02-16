/**
 * SpectatorShareModal — Lets any spectator share the match code with
 * friends and family via QR code, native share sheet, or clipboard.
 *
 * Simplified version of the coach's ShareMatchModal, containing only
 * sharing features (not broadcast controls).
 */

import * as Clipboard from 'expo-clipboard';
import { Copy, Share2, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    Modal,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useAppTheme } from '../../contexts/ThemeContext';

interface SpectatorShareModalProps {
    visible: boolean;
    onClose: () => void;
    matchCode: string;
    teamName: string;
}

export function SpectatorShareModal({
    visible,
    onClose,
    matchCode,
    teamName,
}: SpectatorShareModalProps) {
    const { colors, radius, spacing, isDark } = useAppTheme();
    const [copied, setCopied] = useState(false);

    const deepLink = `volleytrack://spectate/${matchCode}`;

    const shareMessage = `Come watch ${teamName} play live! 🏐\n\nOpen VolleyTrack and enter code: ${matchCode}\n\nOr tap: ${deepLink}`;

    const handleNativeShare = async () => {
        try {
            await Share.share({
                message: shareMessage,
            });
        } catch (_) {
            // User cancelled or share failed silently
        }
    };

    const handleCopyInvite = async () => {
        await Clipboard.setStringAsync(shareMessage);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCopyCode = async () => {
        await Clipboard.setStringAsync(matchCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.overlay}>
                <View style={[styles.modal, { backgroundColor: colors.bgCard, borderRadius: radius.lg }]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: colors.text }]}>
                            Invite More Fans! 🏐
                        </Text>
                        <TouchableOpacity onPress={onClose} hitSlop={12}>
                            <X size={22} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        Share this code so friends and family can watch live:
                    </Text>

                    {/* Match code display */}
                    <TouchableOpacity
                        style={[styles.codeBox, { backgroundColor: colors.bg, borderRadius: radius.md }]}
                        onPress={handleCopyCode}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.codeLabel, { color: colors.textTertiary }]}>Match Code</Text>
                        <View style={styles.codeRow}>
                            <Text style={[styles.codeText, { color: colors.text }]}>
                                {matchCode.split('').join(' ')}
                            </Text>
                            <Copy size={18} color={colors.textTertiary} />
                        </View>
                    </TouchableOpacity>

                    {copied && (
                        <Text style={[styles.copiedText, { color: colors.primary }]}>
                            Copied!
                        </Text>
                    )}

                    {/* QR Code */}
                    <View style={[styles.qrContainer, { backgroundColor: '#ffffff', borderRadius: radius.md }]}>
                        <QRCode
                            value={deepLink}
                            size={160}
                            backgroundColor="#ffffff"
                            color="#000000"
                        />
                    </View>
                    <Text style={[styles.qrHint, { color: colors.textTertiary }]}>
                        Scan to join instantly
                    </Text>

                    {/* Action buttons */}
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: colors.primary, borderRadius: radius.md }]}
                        onPress={handleNativeShare}
                        activeOpacity={0.7}
                    >
                        <Share2 size={18} color="#fff" />
                        <Text style={styles.actionBtnText}>Share with Friends</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.actionBtn,
                            {
                                backgroundColor: 'transparent',
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: radius.md,
                            },
                        ]}
                        onPress={handleCopyInvite}
                        activeOpacity={0.7}
                    >
                        <Copy size={18} color={colors.text} />
                        <Text style={[styles.actionBtnTextSecondary, { color: colors.text }]}>
                            Copy Invite Message
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modal: {
        padding: 24,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
    },
    subtitle: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 16,
    },
    codeBox: {
        padding: 14,
        alignItems: 'center',
    },
    codeLabel: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    codeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    codeText: {
        fontSize: 28,
        fontWeight: '900',
        letterSpacing: 6,
        fontVariant: ['tabular-nums'],
    },
    copiedText: {
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 6,
    },
    qrContainer: {
        alignSelf: 'center',
        padding: 16,
        marginTop: 16,
    },
    qrHint: {
        fontSize: 12,
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 16,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 14,
        marginBottom: 10,
    },
    actionBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    actionBtnTextSecondary: {
        fontSize: 16,
        fontWeight: '600',
    },
});
