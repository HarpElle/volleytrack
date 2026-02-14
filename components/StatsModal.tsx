import { X } from 'lucide-react-native';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../contexts/ThemeContext';
import { Player, StatLog } from '../types';
import StatsView from './stats/StatsView';

interface StatsModalProps {
    visible: boolean;
    onClose: () => void;
    logs: StatLog[];
    roster: Player[];
}

export default function StatsModal({ visible, onClose, logs, roster }: StatsModalProps) {
    const { colors } = useAppTheme();

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
                <View style={[styles.header, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
                    <Text style={[styles.title, { color: colors.text }]}>Match Statistics</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <X size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {visible && <StatsView logs={logs} roster={roster} title="" />}
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    closeBtn: {
        padding: 4,
    },
});
