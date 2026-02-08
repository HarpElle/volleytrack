import { useRouter } from 'expo-router';
import { BarChart2, Settings2 } from 'lucide-react-native';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useMatchStore } from '../store/useMatchStore';
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

    const handleEditRules = () => {
        onClose();
        router.push({
            pathname: "/match/setup",
            params: { matchId, mode: 'resume' }
        });
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.card}>
                    <Text style={styles.title}>Match Settings</Text>

                    <View style={styles.actions}>
                        {onViewStats && (
                            <TouchableOpacity style={[styles.btn, styles.statsBtn]} onPress={onViewStats}>
                                <BarChart2 size={20} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={styles.statsBtnText}>View Match Stats</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={[styles.btn, styles.editBtn]} onPress={handleEditRules}>
                            <Settings2 size={20} color="#0066cc" style={{ marginRight: 8 }} />
                            <Text style={styles.editBtnText}>Edit Match Rules / Lineup</Text>
                        </TouchableOpacity>

                        <View style={styles.separator} />

                        <TouchableOpacity style={[styles.btn, styles.endBtn]} onPress={onEndMatch}>
                            <Text style={styles.endBtnText}>End Match</Text>
                        </TouchableOpacity>

                        {onEndSet && (
                            <TouchableOpacity style={[styles.btn, styles.endSetBtn]} onPress={onEndSet}>
                                <Text style={styles.endSetBtnText}>End Set</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={[styles.btn, styles.closeBtn]} onPress={onClose}>
                            <Text style={styles.closeBtnText}>Resume Match</Text>
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
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 340,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: '#333',
        marginBottom: 20,
        textAlign: 'center',
    },
    actions: {
        gap: 12,
    },
    separator: {
        height: 1,
        backgroundColor: '#eee',
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
        backgroundColor: '#e6f0ff',
        borderWidth: 1,
        borderColor: '#0066cc',
    },
    editBtnText: {
        color: '#0066cc',
        fontSize: 16,
        fontWeight: '700',
    },
    endBtn: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#cc0033',
    },
    endBtnText: {
        color: '#cc0033',
        fontSize: 16,
        fontWeight: '700',
    },
    endSetBtn: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#333',
    },
    endSetBtnText: {
        color: '#333',
        fontSize: 16,
        fontWeight: '700',
    },
    closeBtn: {
        backgroundColor: '#333',
    },
    closeBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

