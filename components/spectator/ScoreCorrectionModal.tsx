/**
 * ScoreCorrectionModal — Lets a spectator report a score discrepancy
 * by showing the app's current score alongside editable fields for
 * what the score table actually shows.
 *
 * Sends a structured alert with suggestedScore so the coach sees
 * both numbers side-by-side.
 */

import { X } from 'lucide-react-native';
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
import { useAppTheme } from '../../contexts/ThemeContext';
import { Score } from '../../types';

interface ScoreCorrectionModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (suggestedScore: Score, message?: string) => void;
    currentScore: Score;
    myTeamName: string;
    opponentName: string;
    currentSet: number;
    canSendAlert: boolean;
    cooldownRemaining: number;
}

export function ScoreCorrectionModal({
    visible,
    onClose,
    onSubmit,
    currentScore,
    myTeamName,
    opponentName,
    currentSet,
    canSendAlert,
    cooldownRemaining,
}: ScoreCorrectionModalProps) {
    const { colors, radius, spacing } = useAppTheme();

    const [myTeamScore, setMyTeamScore] = useState('');
    const [oppScore, setOppScore] = useState('');
    const [note, setNote] = useState('');

    // Pre-fill with current score when modal opens
    useEffect(() => {
        if (visible) {
            setMyTeamScore(String(currentScore.myTeam));
            setOppScore(String(currentScore.opponent));
            setNote('');
        }
    }, [visible, currentScore.myTeam, currentScore.opponent]);

    const parsedMyTeam = parseInt(myTeamScore, 10) || 0;
    const parsedOpp = parseInt(oppScore, 10) || 0;

    const hasDifference =
        parsedMyTeam !== currentScore.myTeam || parsedOpp !== currentScore.opponent;

    const myTeamChanged = parsedMyTeam !== currentScore.myTeam;
    const oppChanged = parsedOpp !== currentScore.opponent;

    const cooldownSeconds = Math.ceil(cooldownRemaining / 1000);

    const handleSubmit = () => {
        if (!hasDifference || !canSendAlert) return;

        const suggestedScore: Score = {
            myTeam: parsedMyTeam,
            opponent: parsedOpp,
        };
        onSubmit(suggestedScore, note.trim() || undefined);
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.overlay}>
                    <View style={[styles.modal, { backgroundColor: colors.bgCard, borderRadius: radius.lg }]}>
                        {/* Header */}
                        <View style={styles.header}>
                            <Text style={[styles.title, { color: colors.text }]}>
                                Score Doesn't Match?
                            </Text>
                            <TouchableOpacity onPress={onClose} hitSlop={12}>
                                <X size={22} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* What the app shows */}
                        <Text style={[styles.label, { color: colors.textSecondary }]}>
                            What the app shows:
                        </Text>
                        <View style={[styles.scoreRow, { backgroundColor: colors.bg, borderRadius: radius.md }]}>
                            <Text style={[styles.teamLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                                {myTeamName}
                            </Text>
                            <Text style={[styles.appScore, { color: colors.text }]}>
                                {currentScore.myTeam}
                            </Text>
                            <Text style={[styles.dash, { color: colors.textTertiary }]}>—</Text>
                            <Text style={[styles.appScore, { color: colors.text }]}>
                                {currentScore.opponent}
                            </Text>
                            <Text style={[styles.teamLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                                {opponentName}
                            </Text>
                        </View>

                        {/* What the score table shows */}
                        <Text style={[styles.label, { color: colors.textSecondary, marginTop: spacing.md }]}>
                            What the score table shows:
                        </Text>
                        <View style={styles.editRow}>
                            <View style={styles.editGroup}>
                                <Text style={[styles.editTeam, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {myTeamName}
                                </Text>
                                <TextInput
                                    style={[
                                        styles.scoreInput,
                                        {
                                            color: colors.text,
                                            borderColor: myTeamChanged ? colors.primary : colors.border,
                                            backgroundColor: myTeamChanged ? `${colors.primary}15` : colors.bg,
                                            borderRadius: radius.md,
                                        },
                                    ]}
                                    value={myTeamScore}
                                    onChangeText={setMyTeamScore}
                                    keyboardType="number-pad"
                                    maxLength={3}
                                    selectTextOnFocus
                                />
                            </View>

                            <Text style={[styles.dash, { color: colors.textTertiary, marginTop: 24 }]}>—</Text>

                            <View style={styles.editGroup}>
                                <Text style={[styles.editTeam, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {opponentName}
                                </Text>
                                <TextInput
                                    style={[
                                        styles.scoreInput,
                                        {
                                            color: colors.text,
                                            borderColor: oppChanged ? colors.primary : colors.border,
                                            backgroundColor: oppChanged ? `${colors.primary}15` : colors.bg,
                                            borderRadius: radius.md,
                                        },
                                    ]}
                                    value={oppScore}
                                    onChangeText={setOppScore}
                                    keyboardType="number-pad"
                                    maxLength={3}
                                    selectTextOnFocus
                                />
                            </View>
                        </View>

                        <Text style={[styles.hint, { color: colors.textTertiary }]}>
                            Tap the number that's different
                        </Text>

                        {/* Optional note */}
                        <Text style={[styles.label, { color: colors.textSecondary, marginTop: spacing.md }]}>
                            Optional note:
                        </Text>
                        <TextInput
                            style={[
                                styles.noteInput,
                                {
                                    color: colors.text,
                                    borderColor: colors.border,
                                    backgroundColor: colors.bg,
                                    borderRadius: radius.md,
                                },
                            ]}
                            value={note}
                            onChangeText={setNote}
                            placeholder="e.g. Ref missed the last point"
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
                                        backgroundColor: hasDifference && canSendAlert ? colors.primary : colors.border,
                                        borderRadius: radius.md,
                                    },
                                ]}
                                onPress={handleSubmit}
                                disabled={!hasDifference || !canSendAlert}
                            >
                                <Text style={[styles.submitText, { color: hasDifference && canSendAlert ? '#fff' : colors.textTertiary }]}>
                                    Send to Coach
                                </Text>
                            </TouchableOpacity>
                        </View>
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
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 6,
    },
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        gap: 10,
    },
    teamLabel: {
        fontSize: 13,
        fontWeight: '600',
        flex: 1,
        textAlign: 'center',
    },
    appScore: {
        fontSize: 24,
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
        minWidth: 32,
        textAlign: 'center',
    },
    dash: {
        fontSize: 20,
        fontWeight: '600',
    },
    editRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: 12,
    },
    editGroup: {
        alignItems: 'center',
        flex: 1,
    },
    editTeam: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 6,
    },
    scoreInput: {
        fontSize: 28,
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
        textAlign: 'center',
        borderWidth: 2,
        width: 80,
        height: 56,
        padding: 0,
    },
    hint: {
        fontSize: 11,
        textAlign: 'center',
        marginTop: 8,
    },
    noteInput: {
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
        fontWeight: '700',
    },
});
