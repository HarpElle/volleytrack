import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';

export interface StatOption {
    label: string;
    subLabel?: string;
    value: string; // The stat type to record
    color?: string;
}

interface StatPickerModalProps {
    visible: boolean;
    title: string;
    attribution?: string; // e.g. "To: #45 Harper"
    descriptor?: string; // e.g. "Result: Point for Opponent"
    options: StatOption[];
    onSelect: (value: string) => void;
    onClose: () => void;
}

export default function StatPickerModal({
    visible,
    title,
    attribution,
    descriptor,
    options,
    onSelect,
    onClose,
}: StatPickerModalProps) {
    const { colors } = useAppTheme();

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
        >
            <TouchableOpacity
                style={[styles.overlay, { backgroundColor: colors.bgOverlay }]}
                activeOpacity={1}
                onPress={onClose}
            >
                <View style={[styles.card, { backgroundColor: colors.bgCard, shadowColor: colors.shadow }]}>
                    <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

                    {attribution && (
                        <Text style={[styles.attribution, { color: colors.textSecondary }]}>{attribution}</Text>
                    )}

                    {descriptor && (
                        <View style={[styles.descriptorContainer, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
                            <Text style={[styles.descriptor, { color: colors.warning }]}>{descriptor}</Text>
                        </View>
                    )}

                    <View style={styles.list}>
                        {options.map((option) => (
                            <TouchableOpacity
                                key={option.value}
                                style={[styles.optionBtn, option.color ? { backgroundColor: option.color } : { backgroundColor: colors.buttonSecondary }]}
                                onPress={() => onSelect(option.value)}
                            >
                                <Text style={styles.optionLabel}>{option.label}</Text>
                                {option.subLabel && (
                                    <Text style={styles.optionSub}>{option.subLabel}</Text>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.buttonSecondary }]} onPress={onClose}>
                        <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 10,
        width: '100%',
        maxWidth: 400, // Prevent too wide on tablets
        alignSelf: 'center'
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 8,
    },
    attribution: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 16,
        textAlign: 'center'
    },
    descriptorContainer: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginBottom: 16,
        borderWidth: 1,
    },
    descriptor: {
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center'
    },
    list: {
        width: '100%',
        gap: 12,
        marginBottom: 20,
    },
    optionBtn: {
        width: '100%',
        paddingVertical: 0, // Reset vertical padding
        minHeight: 75, // Match Action buttons
        paddingHorizontal: 20,
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    optionLabel: {
        fontSize: 20,
        fontWeight: '800',
        color: '#fff',
        textShadowColor: 'rgba(0,0,0,0.2)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    optionSub: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.95)',
    },
    cancelBtn: {
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 20,
    },
    cancelText: {
        fontSize: 16,
        fontWeight: '600',
    },
});
