/**
 * ScoreCorrectionModal — Lets a spectator report the score shown on the
 * scorer's table so the coach can compare it with the app.
 *
 * Simplified flow: spectator enters what the scorer's table shows,
 * optionally adds a note, and sends it to the coach. The button is always
 * enabled (cooldown permitting) so the user doesn't have to figure out
 * "what's different" — the coach sees both scores side-by-side.
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

    // Start with empty fields so the user enters what the table shows
    useEffect(() => {
        if (visible) {
            setMyTeamScore('');
            setOppScore('');
            setNote('');
        }
    }, [visible]);

    const parsedMyTeam = myTeamScore.length > 0 ? parseInt(myTeamScore, 10) : null;
    const parsedOpp = oppScore.length > 0 ? parseInt(oppScore, 10) : null;

    // At least one score field must be filled in
    const hasInput = parsedMyTeam !== null || parsedOpp !== null;

    const cooldownSeconds = Math.ceil(cooldownRemaining / 1000);

    const handleSubmit = () => {
        if (!hasInput || !canSendAlert) return;

        // Fill in current app score for any fields the user left empty
        const suggestedScore: Score = {
            myTeam: parsedMyTeam ?? currentScore.myTeam,
            opponent: parsedOpp ?? currentScore.opponent,
        };

        const messageParts: string[] = [];
        if (note.trim()) messageParts.push(note.trim());

        onSubmit(suggestedScore, messageParts.join(' ') || undefined);
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

                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                            Enter the score shown on the scorer's table and we'll notify the coach.
                        </Text>

                        {/* What the app shows (read-only reference) */}
                        <Text style={[styles.label, { color: colors.textTertiary, marginTop: spacing.sm }]}>
                            App shows: {myTeamName} {currentScore.myTeam} – {currentScore.opponent} {opponentName} (Set {currentSet})
                        </Text>

                        {/* What the scorer's table shows */}
                        <Text style={[styles.label, { color: colors.textSecondary, marginTop: spacing.md }]}>
                            Scorer's table shows:
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
                                            borderColor: myTeamScore.length > 0 ? colors.primary : colors.border,
                                            backgroundColor: myTeamScore.length > 0 ? `${colors.primary}15` : colors.bg,
                                            borderRadius: radius.md,
                                        },
                                    ]}
                                    value={myTeamScore}
                                    onChangeText={setMyTeamScore}
                                    keyboardType="number-pad"
                                    maxLength={3}
                                    placeholder={String(currentScore.myTeam)}
                                    placeholderTextColor={colors.textTertiary}
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
                                            borderColor: oppScore.length > 0 ? colors.primary : colors.border,
                                            backgroundColor: oppScore.length > 0 ? `${colors.primary}15` : colors.bg,
                                            borderRadius: radius.md,
                                        },
                                    ]}
                                    value={oppScore}
                                    onChangeText={setOppScore}
                                    keyboardType="number-pad"
                                    maxLength={3}
                                    placeholder={String(currentScore.opponent)}
                                    placeholderTextColor={colors.textTertiary}
                                    selectTextOnFocus
                                />
                            </View>
                        </View>

                        {/* Optional note */}
                        <TextInput
                            style={[
                                styles.noteInput,
                                {
                                    color: colors.text,
                                    borderColor: colors.border,
                                    backgroundColor: colors.bg,
                                    borderRadius: radius.md,
                                    marginTop: spacing.md,
                                },
                            ]}
                            value={note}
                            onChangeText={setNote}
                            placeholder="Optional note (e.g. ref missed the last point)"
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
                                        backgroundColor: hasInput && canSendAlert ? colors.primary : colors.border,
                                        borderRadius: radius.md,
                                    },
                                ]}
                                onPress={handleSubmit}
                                disabled={!hasInput || !canSendAlert}
                            >
                                <Text style={[styles.submitText, { color: hasInput && canSendAlert ? '#fff' : colors.textTertiary }]}>
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
        marginBottom: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
    },
    subtitle: {
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 8,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 6,
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
