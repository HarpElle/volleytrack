import { useRouter } from 'expo-router';
import { BarChart2, Play, Settings2 } from 'lucide-react-native';
import { Alert, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useMatchStore } from '../store/useMatchStore';
import { useAppTheme } from '../contexts/ThemeContext';
import { MatchConfig } from '../types';

interface MatchMenuModalProps {
    visible: boolean;
    onClose: () => void;
    config: MatchConfig;
    onEndMatch: () => void;
    onEndSet?: () => void;
    onViewStats?: () => void;
}

export default function MatchMenuModal({ visible, onClose, onEndMatch, onEndSet, onViewStats }: MatchMenuModalProps) {
    const router = useRouter();
    const { matchId } = useMatchStore();
    const { colors, radius } = useAppTheme();

    const handleEditRules = () => {
        onClose();
        router.push({
            pathname: "/match/setup",
            params: { matchId, mode: 'resume' }
        });
    };

    const handleLeaveMatch = () => {
        Alert.alert(
            'Leave Match?',
            'Your match progress is saved. You can resume from the home screen.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Leave', style: 'destructive', onPress: onEndMatch },
            ]
        );
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent={true}
            onRequestClose={onClose}
        >
            <Pressable style={[styles.overlay, { backgroundColor: colors.bgOverlay }]} onPress={onClose}>
                <Pressable style={[styles.card, { backgroundColor: colors.bgCard, shadowColor: colors.shadow, borderRadius: radius.xl }]}>
                    <Text style={[styles.title, { color: colors.text }]}>Match Paused</Text>

                    <View style={styles.actions}>
                        {/* Resume Match — PRIMARY action */}
                        <TouchableOpacity
                            style={[styles.btn, styles.resumeBtn, { backgroundColor: colors.primary, borderRadius: radius.md }]}
                            onPress={onClose}
                            accessibilityLabel="Resume match"
                        >
                            <Play size={20} color={colors.buttonPrimaryText} style={{ marginRight: 8 }} />
                            <Text style={[styles.resumeBtnText, { color: colors.buttonPrimaryText }]}>Resume Match</Text>
                        </TouchableOpacity>

                        {/* Tools row — Stats + Edit Setup side-by-side */}
                        <View style={styles.toolsRow}>
                            {onViewStats && (
                                <TouchableOpacity
                                    style={[styles.btn, styles.toolBtn, { backgroundColor: colors.bgCard, borderColor: colors.border, borderRadius: radius.md }]}
                                    onPress={onViewStats}
                                    accessibilityLabel="View match statistics"
                                >
                                    <BarChart2 size={20} color={colors.text} style={{ marginRight: 8 }} />
                                    <Text style={[styles.toolBtnText, { color: colors.text }]}>Stats</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={[styles.btn, styles.toolBtn, { backgroundColor: colors.bgCard, borderColor: colors.border, borderRadius: radius.md }]}
                                onPress={handleEditRules}
                                accessibilityLabel="Edit match setup"
                            >
                                <Settings2 size={20} color={colors.text} style={{ marginRight: 8 }} />
                                <Text style={[styles.toolBtnText, { color: colors.text }]}>Edit Setup</Text>
                            </TouchableOpacity>
                        </View>

                        {/* End Set — only shown when provided */}
                        {onEndSet && (
                            <TouchableOpacity
                                style={[styles.btn, styles.endSetBtn, { borderColor: colors.border, borderRadius: radius.md }]}
                                onPress={onEndSet}
                                accessibilityLabel="End current set"
                            >
                                <Text style={[styles.endSetBtnText, { color: colors.text }]}>End Set</Text>
                            </TouchableOpacity>
                        )}

                        {/* Visual separator */}
                        <View style={[styles.separator, { borderColor: colors.border }]} />

                        {/* Leave Match — text-only link style, smallest visual weight */}
                        <TouchableOpacity
                            style={styles.leaveBtn}
                            onPress={handleLeaveMatch}
                            accessibilityLabel="Leave match"
                        >
                            <Text style={[styles.leaveBtnText, { color: colors.error }]}>Leave Match</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
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
        padding: 24,
        width: '100%',
        maxWidth: 340,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 20,
        textAlign: 'center',
    },
    actions: {
        gap: 12,
    },
    btn: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
    },
    resumeBtn: {
        height: 56,
        paddingVertical: 14,
    },
    resumeBtnText: {
        fontSize: 17,
        fontWeight: '700',
    },
    toolsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    toolBtn: {
        flex: 1,
        paddingVertical: 14,
        borderWidth: 1,
    },
    toolBtnText: {
        fontSize: 15,
        fontWeight: '600',
    },
    endSetBtn: {
        paddingVertical: 14,
        borderWidth: 1,
    },
    endSetBtnText: {
        fontSize: 16,
        fontWeight: '600',
    },
    separator: {
        borderBottomWidth: 1,
        borderStyle: 'dashed',
        marginVertical: 4,
    },
    leaveBtn: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    leaveBtnText: {
        fontSize: 15,
        fontWeight: '600',
    },
});
