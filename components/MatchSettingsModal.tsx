import { useRouter } from 'expo-router';
import { BarChart2, Settings2 } from 'lucide-react-native';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useMatchStore } from '../store/useMatchStore';
import { useAppTheme } from '../contexts/ThemeContext';
import { MatchConfig } from '../types';

interface MatchSettingsModalProps {
    visible: boolean;
    onClose: () => void;
    config: MatchConfig;
    onEndMatch: () => void;
    onEndSet?: () => void;
    onViewStats?: () => void;
}

export default function MatchSettingsModal({ visible, onClose, onEndMatch, onEndSet, onViewStats }: MatchSettingsModalProps) {
    const router = useRouter();
    const { matchId } = useMatchStore();
    const { colors } = useAppTheme();

    const handleEditRules = () => {
        onClose();
        router.push({
            pathname: "/match/setup",
            params: { matchId, mode: 'resume' }
        });
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={[styles.overlay, { backgroundColor: colors.bgOverlay }]}>
                <View style={[styles.card, { backgroundColor: colors.bgCard, shadowColor: colors.shadow }]}>
                    <Text style={[styles.title, { color: colors.text }]}>Match Settings</Text>

                    <View style={styles.actions}>
                        {onViewStats && (
                            <TouchableOpacity style={[styles.btn, styles.statsBtn]} onPress={onViewStats}>
                                <BarChart2 size={20} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={styles.statsBtnText}>View Match Stats</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={[styles.btn, styles.editBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]} onPress={handleEditRules}>
                            <Settings2 size={20} color={colors.primary} style={{ marginRight: 8 }} />
                            <Text style={[styles.editBtnText, { color: colors.primary }]}>Edit Match Rules / Lineup</Text>
                        </TouchableOpacity>

                        <View style={[styles.separator, { backgroundColor: colors.border }]} />

                        <TouchableOpacity style={[styles.btn, styles.endBtn, { backgroundColor: colors.bgCard, borderColor: colors.opponent }]} onPress={onEndMatch}>
                            <Text style={[styles.endBtnText, { color: colors.opponent }]}>Leave Match</Text>
                        </TouchableOpacity>

                        {onEndSet && (
                            <TouchableOpacity style={[styles.btn, styles.endSetBtn, { backgroundColor: colors.bgCard, borderColor: colors.text }]} onPress={onEndSet}>
                                <Text style={[styles.endSetBtnText, { color: colors.text }]}>End Set</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={[styles.btn, styles.closeBtn, { backgroundColor: colors.text }]} onPress={onClose}>
                            <Text style={[styles.closeBtnText, { color: colors.bg }]}>Resume Match</Text>
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
        alignItems: 'center',
        padding: 20,
    },
    card: {
        borderRadius: 20,
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
    separator: {
        height: 1,
        marginVertical: 8,
    },
    btn: {
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
    },
    statsBtn: {
        backgroundColor: '#4caf50',
    },
    statsBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    editBtn: {
        borderWidth: 1,
    },
    editBtnText: {
        fontSize: 16,
        fontWeight: '700',
    },
    endBtn: {
        borderWidth: 1,
    },
    endBtnText: {
        fontSize: 16,
        fontWeight: '700',
    },
    endSetBtn: {
        borderWidth: 1,
    },
    endSetBtnText: {
        fontSize: 16,
        fontWeight: '700',
    },
    closeBtn: {},
    closeBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

