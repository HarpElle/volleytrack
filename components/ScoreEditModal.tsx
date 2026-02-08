import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ScoreEditModalProps {
    visible: boolean;
    teamName: string;
    currentScore: number;
    onClose: () => void;
    onSave: (newScore: number) => void;
}

export default function ScoreEditModal({ visible, teamName, currentScore, onClose, onSave }: ScoreEditModalProps) {
    const [tempScore, setTempScore] = useState('');

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

    const renderKey = (label: string, value?: string, icon?: keyof typeof Ionicons.glyphMap) => (
        <TouchableOpacity
            style={styles.key}
            onPress={() => value ? handleNumberPress(value) : (label === 'C' ? handleClear() : null)}
        >
            {icon ? <Ionicons name={icon} size={24} color="#333" /> : <Text style={styles.keyText}>{label}</Text>}
        </TouchableOpacity>
    );

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.card}>
                    <Text style={styles.title}>Edit Score</Text>
                    <Text style={styles.teamName}>{teamName}</Text>

                    <View style={styles.display}>
                        <Text style={styles.displayText}>{tempScore}</Text>
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
                            <TouchableOpacity style={styles.key} onPress={handleBackspace}>
                                <Ionicons name="backspace-outline" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.actions}>
                        <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={onClose}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, styles.saveBtn]} onPress={handleSave}>
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
        backgroundColor: 'rgba(0,0,0,0.6)',
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
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: '#666',
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    teamName: {
        fontSize: 24,
        fontWeight: '800',
        color: '#333',
        marginBottom: 20,
        textAlign: 'center',
    },
    display: {
        backgroundColor: '#f5f5f5',
        width: '100%',
        paddingVertical: 12,
        borderRadius: 12,
        marginBottom: 20,
        alignItems: 'center',
    },
    displayText: {
        fontSize: 48,
        fontWeight: '800',
        color: '#333',
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
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    keyText: {
        fontSize: 24,
        fontWeight: '600',
        color: '#333',
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
    cancelBtn: {
        backgroundColor: '#f5f5f5',
    },
    saveBtn: {
        backgroundColor: '#0066cc',
    },
    cancelText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
    },
    saveText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
});
