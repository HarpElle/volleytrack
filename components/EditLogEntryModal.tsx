import { Save, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';
import { Player, StatLog } from '../types';

interface EditLogEntryModalProps {
    visible: boolean;
    onClose: () => void;
    entry: StatLog | null;
    roster: Player[];
    activePlayerIds?: string[];
    onSave: (updates: Partial<StatLog>) => void;
}

export default function EditLogEntryModal({ visible, onClose, entry, roster, activePlayerIds, onSave }: EditLogEntryModalProps) {
    const { colors } = useAppTheme();
    const [selectedType, setSelectedType] = useState<string>('');
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const [selectedAssistId, setSelectedAssistId] = useState<string | null>(null);

    useEffect(() => {
        if (entry) {
            setSelectedType(entry.type);
            setSelectedPlayerId(entry.playerId || null);
            setSelectedAssistId(entry.assistPlayerId || null);
        }
    }, [entry]);

    const handleSave = () => {
        if (!entry) return;

        // Construct updates
        const updates: Partial<StatLog> = {};
        if (selectedType !== entry.type) updates.type = selectedType as any;
        if (selectedPlayerId !== entry.playerId) updates.playerId = selectedPlayerId || undefined;
        if (selectedAssistId !== entry.assistPlayerId) updates.assistPlayerId = selectedAssistId || undefined;

        onSave(updates);
        onClose();
    };

    if (!entry) return null;

    const isReceive = entry.type.startsWith('receive_');

    // Group types by Outcome to prevent Score Corruption
    const pointWonTypes = ['kill', 'ace', 'block'];
    const pointLostTypes = ['serve_error', 'attack_error', 'dig_error', 'set_error', 'pass_error', 'receive_0', 'lift', 'net', 'double'];
    const continueTypes = ['serve_good', 'attack_good', 'dig', 'receive_1', 'receive_2', 'receive_3', 'set', 'free_ball'];

    let allowedTypes: string[] = [];

    if (pointWonTypes.includes(entry.type)) {
        allowedTypes = pointWonTypes;
    } else if (pointLostTypes.includes(entry.type)) {
        allowedTypes = pointLostTypes;
    } else if (continueTypes.includes(entry.type)) {
        allowedTypes = continueTypes;
    }

    // Special Case: If it's a specific "Receive" error like receive_0, we might want to just show receive options?
    // Actually, receive_0 IS an error. Switching it to receive_1 changes the score.
    // So receive_0 (Error) <> receive_1 (Good) is UNSAFE.
    // However, receive_1 <> receive_2 <> receive_3 is SAFE (all continue).

    // User requests: "Change assessment for Serve... Attack... Error type"

    // Formatting helper
    const formatType = (t: string) => t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    const canEditType = allowedTypes.length > 0;

    // Assist Logic: Only for Attack types
    // Also allow for Kills if user changed type to Kill
    const canHaveAssist = ['kill', 'attack_error', 'attack_good'].includes(selectedType || entry.type);

    // Player Filtering Logic
    const visibleRoster = activePlayerIds
        ? roster.filter(p => activePlayerIds.includes(p.id))
        : roster;

    // Sort visible roster by jersey number
    const sortedRoster = [...visibleRoster].sort((a, b) => parseInt(a.jerseyNumber) - parseInt(b.jerseyNumber));

    return (
        <Modal visible={visible} animationType="fade" transparent>
            <View style={[styles.overlay, { backgroundColor: colors.bgOverlay }]}>
                <View style={[styles.container, { backgroundColor: colors.bgCard, shadowColor: colors.shadow }]}>
                    <View style={[styles.header, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.title, { color: colors.text }]}>Edit Log Entry</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content}>
                        {/* Event Info */}
                        <View style={styles.infoRow}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Time:</Text>
                            <Text style={[styles.value, { color: colors.text }]}>{new Date(entry.timestamp).toLocaleTimeString()}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Current Action:</Text>
                            <Text style={[styles.value, { color: colors.text }]}>{entry.type.replace('_', ' ').toUpperCase()}</Text>
                        </View>

                        {/* Type Selector */}
                        {canEditType && (
                            <View style={styles.section}>
                                <Text style={[styles.sectionTitle, { color: colors.text }]}>Change Assessment</Text>
                                <View style={styles.typeGrid}>
                                    {allowedTypes.map(type => (
                                        <TouchableOpacity
                                            key={type}
                                            style={[styles.typeOption, { backgroundColor: colors.buttonSecondary, borderColor: colors.border }, selectedType === type && { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
                                            onPress={() => setSelectedType(type)}
                                        >
                                            <Text style={[styles.typeText, { color: colors.textSecondary }, selectedType === type && { color: colors.primary }]}>
                                                {formatType(type)}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Player Selector */}
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Player</Text>
                            <View style={styles.rosterGrid}>
                                <TouchableOpacity
                                    style={[styles.playerOption, selectedPlayerId === null && styles.selectedPlayer]}
                                    onPress={() => setSelectedPlayerId(null)}
                                >
                                    <View style={[styles.avatarPlaceholder, { backgroundColor: colors.buttonSecondary, borderColor: colors.border }]}>
                                        <Text style={[styles.avatarText, { color: colors.textSecondary }]}>-</Text>
                                    </View>
                                    <Text style={[styles.playerName, { color: colors.text }]}>None</Text>
                                </TouchableOpacity>
                                {sortedRoster.map(p => (
                                    <TouchableOpacity
                                        key={p.id}
                                        style={[styles.playerOption, selectedPlayerId === p.id && styles.selectedPlayer]}
                                        onPress={() => setSelectedPlayerId(p.id)}
                                    >
                                        <View style={[styles.avatar, { backgroundColor: colors.buttonSecondary }, selectedPlayerId === p.id && { backgroundColor: colors.primary, borderColor: colors.primaryLight }]}>
                                            <Text style={[styles.avatarText, { color: colors.textSecondary }, selectedPlayerId === p.id && { color: '#ffffff' }]}>
                                                {p.jerseyNumber}
                                            </Text>
                                        </View>
                                        <Text style={[styles.playerName, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Assist Selector */}
                        {canHaveAssist && (
                            <View style={styles.section}>
                                <Text style={[styles.sectionTitle, { color: colors.text }]}>Assist / Setter</Text>
                                <View style={styles.rosterGrid}>
                                    <TouchableOpacity
                                        style={[styles.playerOption, selectedAssistId === null && styles.selectedPlayer]}
                                        onPress={() => setSelectedAssistId(null)}
                                    >
                                        <View style={[styles.avatarPlaceholder, { backgroundColor: colors.buttonSecondary, borderColor: colors.border }]}>
                                            <Text style={[styles.avatarText, { color: colors.textSecondary }]}>-</Text>
                                        </View>
                                        <Text style={[styles.playerName, { color: colors.text }]}>None</Text>
                                    </TouchableOpacity>
                                    {sortedRoster.map(p => (
                                        <TouchableOpacity
                                            key={p.id}
                                            style={[styles.playerOption, selectedAssistId === p.id && styles.selectedPlayer]}
                                            onPress={() => setSelectedAssistId(p.id)}
                                        >
                                            <View style={[styles.avatar, { backgroundColor: colors.buttonSecondary }, selectedAssistId === p.id && { backgroundColor: colors.primary, borderColor: colors.primaryLight }]}>
                                                <Text style={[styles.avatarText, { color: colors.textSecondary }, selectedAssistId === p.id && { color: '#ffffff' }]}>
                                                    {p.jerseyNumber}
                                                </Text>
                                            </View>
                                            <Text style={[styles.playerName, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                    </ScrollView>

                    <View style={[styles.footer, { borderTopColor: colors.border }]}>
                        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
                            <Save size={20} color="#ffffff" />
                            <Text style={[styles.saveText, { color: '#ffffff' }]}>Save Changes</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
    },
    container: {
        borderRadius: 20,
        maxHeight: '80%',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
    },
    closeBtn: {
        padding: 4,
    },
    content: {
        padding: 20,
    },
    infoRow: {
        flexDirection: 'row',
        marginBottom: 12,
        gap: 8,
    },
    label: {
        fontWeight: '600',
        width: 100,
    },
    value: {
        fontWeight: '500',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    typeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    typeOption: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
    },
    selectedType: {
    },
    typeText: {
        fontSize: 13,
        fontWeight: '600',
    },
    selectedTypeText: {
    },
    rosterGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    playerOption: {
        alignItems: 'center',
        width: 60,
    },
    selectedPlayer: {
        // Optional highlight for wrapper
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    selectedAvatar: {
    },
    avatarText: {
        fontSize: 16,
        fontWeight: '700',
    },
    selectedAvatarText: {
    },
    avatarPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
        borderWidth: 1,
        borderStyle: 'dashed',
    },
    playerName: {
        fontSize: 11,
        textAlign: 'center',
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
    },
    saveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    saveText: {
        fontSize: 16,
        fontWeight: '700',
    },
});
