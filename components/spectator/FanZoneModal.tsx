/**
 * FanZoneModal — Spectator-to-spectator chat modal.
 *
 * Bottom-sheet style with real-time messages, quick-send chips,
 * and auto-generated celebration messages for big plays.
 * Follows the "bleacher talk" design — short bursts, not long convos.
 */

import { MessageCircle, Send, X } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import {
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';
import { QUICK_REACTIONS } from '../../hooks/useFanZoneChat';
import { SpectatorChatMessage } from '../../types';

interface FanZoneModalProps {
    visible: boolean;
    onClose: () => void;
    messages: SpectatorChatMessage[];
    viewerCount: number;
    canSend: boolean;
    currentDeviceId: string;
    onSendMessage: (text: string) => Promise<boolean>;
    onSendQuickReaction: (key: string) => Promise<boolean>;
}

/** Relative time display: "just now", "1m ago", etc. */
function relativeTime(timestamp: number): string {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 10) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
}

export function FanZoneModal({
    visible,
    onClose,
    messages,
    viewerCount,
    canSend,
    currentDeviceId,
    onSendMessage,
    onSendQuickReaction,
}: FanZoneModalProps) {
    const { colors, radius, spacing } = useAppTheme();
    const [inputText, setInputText] = useState('');
    const flatListRef = useRef<FlatList>(null);

    const handleSend = async () => {
        const text = inputText.trim();
        if (!text) return;
        const success = await onSendMessage(text);
        if (success) {
            setInputText('');
            Keyboard.dismiss();
        }
    };

    const renderMessage = ({ item }: { item: SpectatorChatMessage }) => {
        const isMine = item.senderDeviceId === currentDeviceId;
        const isCelebration = item.type === 'celebration';

        if (isCelebration) {
            return (
                <View style={[styles.celebrationRow, { backgroundColor: `${colors.warning}15`, borderRadius: radius.md }]}>
                    <Text style={[styles.celebrationText, { color: colors.warning }]}>{item.text}</Text>
                </View>
            );
        }

        return (
            <View style={[styles.messageRow, isMine && styles.messageRowMine]}>
                <View
                    style={[
                        styles.messageBubble,
                        {
                            backgroundColor: isMine ? `${colors.primary}15` : colors.bg,
                            borderRadius: radius.md,
                        },
                    ]}
                >
                    <Text style={[styles.senderName, { color: isMine ? colors.primary : colors.textSecondary }]}>
                        {item.senderName}
                    </Text>
                    <Text style={[styles.messageText, { color: colors.text }]}>{item.text}</Text>
                    <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
                        {relativeTime(item.timestamp)}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <KeyboardAvoidingView
                style={styles.overlay}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {/* Tap backdrop to close */}
                <TouchableOpacity style={styles.backdropArea} activeOpacity={1} onPress={onClose} />

                <View style={[styles.sheet, { backgroundColor: colors.bgCard, borderRadius: radius.lg }]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <MessageCircle size={18} color={colors.primary} />
                            <Text style={[styles.headerTitle, { color: colors.text }]}>Fan Zone</Text>
                            <Text style={[styles.viewerBadge, { color: colors.textTertiary }]}>
                                {viewerCount} {viewerCount === 1 ? 'fan' : 'fans'}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} hitSlop={12}>
                            <X size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Message list */}
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={(item) => item.id}
                        renderItem={renderMessage}
                        style={styles.messageList}
                        contentContainerStyle={styles.messageListContent}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Text style={[styles.emptyEmoji]}>🏐</Text>
                                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                                    No messages yet — be the first to cheer!
                                </Text>
                            </View>
                        }
                    />

                    {/* Quick-send chips */}
                    <View style={[styles.quickRow, { borderTopColor: colors.border }]}>
                        {QUICK_REACTIONS.map((r) => (
                            <TouchableOpacity
                                key={r.key}
                                style={[
                                    styles.quickChip,
                                    {
                                        backgroundColor: colors.bg,
                                        borderRadius: radius.sm,
                                        opacity: canSend ? 1 : 0.5,
                                    },
                                ]}
                                onPress={() => onSendQuickReaction(r.key)}
                                disabled={!canSend}
                                activeOpacity={0.6}
                            >
                                <Text style={styles.quickEmoji}>{r.emoji}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Input row */}
                    <View style={[styles.inputRow, { borderTopColor: colors.border }]}>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    color: colors.text,
                                    backgroundColor: colors.bg,
                                    borderRadius: radius.md,
                                },
                            ]}
                            value={inputText}
                            onChangeText={setInputText}
                            placeholder="Say something..."
                            placeholderTextColor={colors.textTertiary}
                            maxLength={200}
                            returnKeyType="send"
                            onSubmitEditing={handleSend}
                        />
                        <TouchableOpacity
                            style={[
                                styles.sendBtn,
                                {
                                    backgroundColor: inputText.trim() && canSend ? colors.primary : colors.border,
                                    borderRadius: radius.md,
                                },
                            ]}
                            onPress={handleSend}
                            disabled={!inputText.trim() || !canSend}
                            activeOpacity={0.7}
                        >
                            <Send size={18} color={inputText.trim() && canSend ? '#fff' : colors.textTertiary} />
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdropArea: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sheet: {
        maxHeight: '70%',
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
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '800',
    },
    viewerBadge: {
        fontSize: 12,
        fontWeight: '600',
    },
    messageList: {
        flex: 1,
        minHeight: 150,
    },
    messageListContent: {
        padding: 16,
        paddingTop: 0,
    },
    messageRow: {
        marginBottom: 8,
        alignItems: 'flex-start',
    },
    messageRowMine: {
        alignItems: 'flex-end',
    },
    messageBubble: {
        padding: 10,
        maxWidth: '85%',
    },
    senderName: {
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 2,
    },
    messageText: {
        fontSize: 14,
        lineHeight: 20,
    },
    timestamp: {
        fontSize: 10,
        marginTop: 4,
        alignSelf: 'flex-end',
    },
    celebrationRow: {
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 14,
        marginVertical: 6,
    },
    celebrationText: {
        fontSize: 15,
        fontWeight: '700',
        textAlign: 'center',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 32,
        gap: 8,
    },
    emptyEmoji: {
        fontSize: 32,
    },
    emptyText: {
        fontSize: 14,
        textAlign: 'center',
    },
    quickRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    quickChip: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        alignItems: 'center',
    },
    quickEmoji: {
        fontSize: 18,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    input: {
        flex: 1,
        fontSize: 15,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    sendBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
