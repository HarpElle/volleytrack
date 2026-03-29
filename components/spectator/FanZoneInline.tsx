/**
 * FanZoneInline — Inline spectator chat component (non-modal).
 *
 * Extracted from FanZoneModal for embedding directly in the content area.
 * Shows messages, quick-send chips, and text input.
 */

import { Send } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import {
    FlatList,
    Keyboard,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';
import { QUICK_REACTIONS } from '../../hooks/useFanZoneChat';
import { SpectatorChatMessage } from '../../types';
import { SpectatorAvatar } from './SpectatorAvatar';

interface FanZoneInlineProps {
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

export function FanZoneInline({
    messages,
    viewerCount,
    canSend,
    currentDeviceId,
    onSendMessage,
    onSendQuickReaction,
}: FanZoneInlineProps) {
    const { colors, radius } = useAppTheme();
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
                {!isMine && (
                    <View style={styles.avatarWrap}>
                        <SpectatorAvatar name={item.senderName} size="sm" />
                    </View>
                )}
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
        <View style={[styles.container, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            {/* Message list */}
            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                style={styles.messageList}
                contentContainerStyle={styles.messageListContent}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyEmoji}>🏐</Text>
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
                    // @ts-ignore — prop available in RN 0.72+
                    automaticallyAdjustKeyboardInsets
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
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
        marginBottom: 8,
    },
    messageList: {
        maxHeight: 280,
        minHeight: 120,
    },
    messageListContent: {
        padding: 12,
    },
    messageRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginBottom: 8,
    },
    messageRowMine: {
        flexDirection: 'row-reverse',
    },
    avatarWrap: {
        marginRight: 6,
        marginBottom: 2,
    },
    messageBubble: {
        padding: 10,
        maxWidth: '78%',
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
        paddingVertical: 24,
        gap: 8,
    },
    emptyEmoji: {
        fontSize: 28,
    },
    emptyText: {
        fontSize: 14,
        textAlign: 'center',
    },
    quickRow: {
        flexDirection: 'row',
        paddingHorizontal: 12,
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
        paddingHorizontal: 10,
        paddingVertical: 8,
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
