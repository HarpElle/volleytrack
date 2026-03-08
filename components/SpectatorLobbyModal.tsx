import { X } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { Animated, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';
import { SpectatorAvatar } from './spectator/SpectatorAvatar';
import { Player, SpectatorViewer } from '../types';

interface SpectatorLobbyModalProps {
    visible: boolean;
    onClose: () => void;
    viewers: SpectatorViewer[];
    roster: Player[];
    currentViewerId: string;
    onShare?: () => void;
}

export function SpectatorLobbyModal({ visible, onClose, viewers, roster, currentViewerId, onShare }: SpectatorLobbyModalProps) {
    const { colors, radius } = useAppTheme();
    const slideAnim = useRef(new Animated.Value(400)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            setTimeout(() => {
                Animated.parallel([
                    Animated.spring(slideAnim, {
                        toValue: 0,
                        useNativeDriver: true,
                        tension: 80,
                        friction: 12,
                    }),
                    Animated.timing(opacityAnim, {
                        toValue: 1,
                        duration: 150,
                        useNativeDriver: true,
                    }),
                ]).start();
            }, 120);
        } else {
            slideAnim.setValue(400);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    const getCheeringText = (playerIds?: string[]) => {
        if (!playerIds || playerIds.length === 0) return 'Just watching';

        const names = playerIds.map(id => {
            const p = roster.find(r => r.id === id);
            return p ? `#${p.jerseyNumber} ${p.name.split(' ')[0]}` : 'Unknown';
        });

        return `Cheering for ${names.join(', ')}`;
    };

    const renderItem = ({ item }: { item: SpectatorViewer }) => {
        const isMe = item.deviceId === currentViewerId;

        return (
            <View style={[styles.viewerRow, { borderBottomColor: colors.border }]}>
                <SpectatorAvatar
                    name={item.name}
                    size="md"
                    highlight={isMe}
                    highlightColor={colors.primary}
                />
                <View style={styles.viewerInfo}>
                    <Text style={[styles.viewerName, { color: colors.text }]}>
                        {item.name} {isMe && '(You)'}
                    </Text>
                    <Text style={[styles.cheeringText, { color: colors.textSecondary }]}>
                        {getCheeringText(item.cheeringFor)}
                    </Text>
                </View>
                {/* Future: Add High Five button? */}
            </View>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <View style={[styles.overlay, { backgroundColor: colors.bgOverlay }]}>
                <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

                <Animated.View style={[styles.modalContent, { backgroundColor: colors.bgCard, shadowColor: colors.shadow, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, transform: [{ translateY: slideAnim }], opacity: opacityAnim }]}>
                    <View style={[styles.header, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.title, { color: colors.text }]}>Spectator Lobby</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }} accessibilityLabel="Close">
                            <X size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        {viewers.length} {viewers.length === 1 ? 'person' : 'people'} watching right now
                    </Text>

                    <FlatList
                        data={viewers}
                        keyExtractor={item => item.deviceId}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContent}
                        ListFooterComponent={onShare ? (
                            <TouchableOpacity
                                style={[styles.shareCta, { borderColor: colors.border }]}
                                onPress={() => {
                                    onClose();
                                    onShare();
                                }}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.shareCtaText, { color: colors.primary }]}>
                                    👋 Invite more fans to watch
                                </Text>
                            </TouchableOpacity>
                        ) : null}
                    />
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    modalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 40,
        height: '60%', // Takes up 60% of screen
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: -4,
        },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
    },
    closeBtn: {
        position: 'absolute',
        right: 16,
        top: 16,
    },
    subtitle: {
        textAlign: 'center',
        fontSize: 14,
        marginTop: 12,
        marginBottom: 8,
    },
    listContent: {
        padding: 16,
    },
    viewerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: 12,
    },
    /* avatar sizing handled by SpectatorAvatar component */
    viewerInfo: {
        flex: 1,
    },
    viewerName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    cheeringText: {
        fontSize: 13,
    },
    shareCta: {
        marginTop: 16,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
    },
    shareCtaText: {
        fontSize: 15,
        fontWeight: '600',
    },
});
