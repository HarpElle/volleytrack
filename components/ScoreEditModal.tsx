import { Delete } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';

interface ScoreEditModalProps {
    visible: boolean;
    teamName: string;
    currentScore: number;
    onClose: () => void;
    onSave: (newScore: number) => void;
}

export default function ScoreEditModal({ visible, teamName, currentScore, onClose, onSave }: ScoreEditModalProps) {
    const [tempScore, setTempScore] = useState('');
    const { colors } = useAppTheme();

    useEffect(() => {
        if (visible) {
            setTempScore(currentScore.toString());
        }
    }, [visible, currentScore]);

    const handleNumberPress = (num: string) => {
        if (tempScore === '0') {
            setTempScore(num);
        } else {
            setTempScore(prev => prev + num);
        }
    };

    const handleBackspace = () => {
        setTempScore(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
    };

    const handleClear = () => {
        setTempScore('0');
    };

    const handleSave = () => {
        const score = parseInt(tempScore, 10);
        if (!isNaN(score)) {
            onSave(score);
        }
    };

    const renderKey = (label: string, value?: string, icon?: React.ReactNode) => (
        <TouchableOpacity
            style={[styles.key, { backgroundColor: colors.buttonSecondary }]}
            onPress={() => value ? handleNumberPress(value) : (label === 'C' ? handleClear() : null)}
        >
            {icon ? icon : <Text style={[styles.keyText, { color: colors.text }]}>{label}</Text>}
        </TouchableOpacity>
    );

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={[styles.overlay, { backgroundColor: colors.bgOverlay }]}>
                <View style={[styles.card, { backgroundColor: colors.bgCard, shadowColor: colors.shadow }]}>
                    <Text style={[styles.title, { color: colors.textSecondary }]}>Edit Score</Text>
                    <Text style={[styles.teamName, { color: colors.text }]}>{teamName}</Text>

                    <View style={[styles.display, { backgroundColor: colors.buttonSecondary }]}>
                        <Text style={[styles.displayText, { color: colors.text }]}>{tempScore}</Text>
                    </View>

                    <View style={styles.keypad}>
                        <View style={styles.row}>
                            {renderKey('1', '1')}
                            {renderKey('2', '2')}
                            {renderKey('3', '3')}
                        </View>
                        <View style={styles.row}>
                            {renderKey('4', '4')}
                            {renderKey('5', '5')}
                            {renderKey('6', '6')}
                        </View>
                        <View style={styles.row}>
                            {renderKey('7', '7')}
                            {renderKey('8', '8')}
                            {renderKey('9', '9')}
                        </View>
                        <View style={styles.row}>
                            {renderKey('C')}
                            {renderKey('0', '0')}
                            <TouchableOpacity style={[styles.key, { backgroundColor: colors.buttonSecondary }]} onPress={handleBackspace}>
                                <Delete size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.actions}>
                        <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn, { backgroundColor: colors.buttonSecondary }]} onPress={onClose}>
                            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
                            <Text style={styles.saveText}>Save</Text>
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
        alignItems: 'center',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    teamName: {
        fontSize: 24,
        fontWeight: '800',
        marginBottom: 20,
        textAlign: 'center',
    },
    display: {
        width: '100%',
        paddingVertical: 12,
        borderRadius: 12,
        marginBottom: 20,
        alignItems: 'center',
    },
    displayText: {
        fontSize: 48,
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
    },
    keypad: {
        width: '100%',
        gap: 10,
        marginBottom: 24,
    },
    row: {
        flexDirection: 'row',
        gap: 10,
        justifyContent: 'center',
    },
    key: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    keyText: {
        fontSize: 24,
        fontWeight: '600',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    actionBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelBtn: {},
    saveBtn: {},
    cancelText: {
        fontSize: 16,
        fontWeight: '600',
    },
    saveText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
});
