import { BlurView } from 'expo-blur';
import { User, X } from 'lucide-react-native';
import React from 'react';
import { FlatList, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';
import { Player, SpectatorViewer } from '../types';

interface SpectatorLobbyModalProps {
    visible: boolean;
    onClose: () => void;
    viewers: SpectatorViewer[];
    roster: Player[];
    currentViewerId: string;
}

export function SpectatorLobbyModal({ visible, onClose, viewers, roster, currentViewerId }: SpectatorLobbyModalProps) {
    const { colors, isDark } = useAppTheme();

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
                <View style={[styles.avatar, { backgroundColor: isMe ? colors.primary : colors.border }]}>
                    <User size={20} color={isMe ? '#fff' : colors.textSecondary} />
                </View>
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
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                {Platform.OS === 'ios' && (
                    <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                )}

                <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

                <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
                    <View style={[styles.header, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.title, { color: colors.text }]}>Spectator Lobby</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
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
                    />
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
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
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
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
});
