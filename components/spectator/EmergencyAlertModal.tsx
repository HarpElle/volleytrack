/**
 * EmergencyAlertModal — High-urgency modal for spectators to alert the coach
 * to stop play. Includes category chips (Injury, Safety, Wrong Player, Other)
 * and an optional details field so the coach gets immediate context.
 */

import { AlertOctagon, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    Keyboard,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../../contexts/ThemeContext';

type EmergencyCategory = 'injury' | 'safety' | 'wrong_player' | 'other';

interface CategoryOption {
    key: EmergencyCategory;
    emoji: string;
    label: string;
}

const CATEGORIES: CategoryOption[] = [
    { key: 'injury', emoji: '🤕', label: 'Injury' },
    { key: 'safety', emoji: '🩹', label: 'Safety' },
    { key: 'wrong_player', emoji: '📋', label: 'Wrong Player' },
    { key: 'other', emoji: '⚠️', label: 'Other' },
];

const CATEGORY_LABELS: Record<EmergencyCategory, string> = {
    injury: 'INJURY',
    safety: 'SAFETY ISSUE',
    wrong_player: 'WRONG PLAYER IN',
    other: 'EMERGENCY',
};

interface EmergencyAlertModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (message: string) => void;
    canSendAlert: boolean;
    cooldownRemaining: number;
}

export function EmergencyAlertModal({
    visible,
    onClose,
    onSubmit,
    canSendAlert,
    cooldownRemaining,
}: EmergencyAlertModalProps) {
    const { colors, radius, spacing } = useAppTheme();

    const [selectedCategory, setSelectedCategory] = useState<EmergencyCategory | null>(null);
    const [details, setDetails] = useState('');

    // Reset state when modal opens
    useEffect(() => {
        if (visible) {
            setSelectedCategory(null);
            setDetails('');
        }
    }, [visible]);

    const cooldownSeconds = Math.ceil(cooldownRemaining / 1000);

    const handleSubmit = async () => {
        if (!selectedCategory || !canSendAlert) return;

        // Build structured message: "CATEGORY: details" or just "CATEGORY"
        const categoryLabel = CATEGORY_LABELS[selectedCategory];
        const message = details.trim()
            ? `${categoryLabel}: ${details.trim()}`
            : categoryLabel;

        // Strong haptic to reinforce the gravity of this action
        try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } catch (_) {
            // Haptics may not be available on all devices
        }

        onSubmit(message);
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.overlay}>
                    <View style={[styles.modal, { backgroundColor: colors.bgCard, borderRadius: radius.lg }]}>
                        {/* Header */}
                        <View style={styles.header}>
                            <View style={styles.headerLeft}>
                                <AlertOctagon size={22} color={colors.error} />
                                <Text style={[styles.title, { color: colors.error }]}>
                                    EMERGENCY STOP
                                </Text>
                            </View>
                            <TouchableOpacity onPress={onClose} hitSlop={12}>
                                <X size={22} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                            This will immediately alert the coach to stop play.
                        </Text>

                        {/* Category chips */}
                        <Text style={[styles.label, { color: colors.textSecondary }]}>
                            What's happening?
                        </Text>
                        <View style={styles.chipGrid}>
                            {CATEGORIES.map((cat) => {
                                const isSelected = selectedCategory === cat.key;
                                return (
                                    <TouchableOpacity
                                        key={cat.key}
                                        style={[
                                            styles.chip,
                                            {
                                                backgroundColor: isSelected ? `${colors.error}18` : colors.bg,
                                                borderColor: isSelected ? colors.error : colors.border,
                                                borderRadius: radius.md,
                                            },
                                        ]}
                                        onPress={() => setSelectedCategory(cat.key)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.chipEmoji}>{cat.emoji}</Text>
                                        <Text
                                            style={[
                                                styles.chipLabel,
                                                { color: isSelected ? colors.error : colors.text },
                                            ]}
                                        >
                                            {cat.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Details (optional) */}
                        <Text style={[styles.label, { color: colors.textSecondary, marginTop: spacing.md }]}>
                            Details (optional):
                        </Text>
                        <TextInput
                            style={[
                                styles.detailsInput,
                                {
                                    color: colors.text,
                                    borderColor: colors.border,
                                    backgroundColor: colors.bg,
                                    borderRadius: radius.md,
                                },
                            ]}
                            value={details}
                            onChangeText={setDetails}
                            placeholder='e.g. "#7 is limping on back row"'
                            placeholderTextColor={colors.textTertiary}
                            maxLength={100}
                            multiline={false}
                        />

                        {/* Cooldown warning */}
                        {!canSendAlert && cooldownSeconds > 0 && (
                            <Text style={[styles.cooldownText, { color: colors.warning }]}>
                                Wait {cooldownSeconds}s before sending another alert
                            </Text>
                        )}

                        {/* Buttons */}
                        <View style={styles.buttonRow}>
                            <TouchableOpacity
                                style={[styles.cancelBtn, { borderColor: colors.border, borderRadius: radius.md }]}
                                onPress={onClose}
                            >
                                <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.submitBtn,
                                    {
                                        backgroundColor: selectedCategory && canSendAlert ? colors.error : colors.border,
                                        borderRadius: radius.md,
                                    },
                                ]}
                                onPress={handleSubmit}
                                disabled={!selectedCategory || !canSendAlert}
                            >
                                <Text style={[styles.submitText, { color: selectedCategory && canSendAlert ? '#fff' : colors.textTertiary }]}>
                                    SEND ALERT
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Safety note */}
                        <Text style={[styles.safetyNote, { color: colors.textTertiary }]}>
                            Use only for genuine emergencies
                        </Text>
                    </View>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 24,
    },
    modal: {
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    subtitle: {
        fontSize: 14,
        marginBottom: 16,
        lineHeight: 20,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 8,
    },
    chipGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderWidth: 1.5,
        minWidth: '45%',
        flex: 1,
    },
    chipEmoji: {
        fontSize: 18,
    },
    chipLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    detailsInput: {
        fontSize: 14,
        borderWidth: 1,
        padding: 12,
        minHeight: 40,
    },
    cooldownText: {
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 12,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
        borderWidth: 1,
    },
    cancelText: {
        fontSize: 15,
        fontWeight: '600',
    },
    submitBtn: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
    },
    submitText: {
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    safetyNote: {
        fontSize: 11,
        textAlign: 'center',
        marginTop: 12,
    },
});
