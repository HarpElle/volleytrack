import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
        >
            <TouchableOpacity
                style={styles.overlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <View style={styles.card}>
                    <Text style={styles.title}>{title}</Text>

                    {attribution && (
                        <Text style={styles.attribution}>{attribution}</Text>
                    )}

                    {descriptor && (
                        <View style={styles.descriptorContainer}>
                            <Text style={styles.descriptor}>{descriptor}</Text>
                        </View>
                    )}

                    <View style={styles.list}>
                        {options.map((option) => (
                            <TouchableOpacity
                                key={option.value}
                                style={[styles.optionBtn, option.color ? { backgroundColor: option.color } : undefined]}
                                onPress={() => onSelect(option.value)}
                            >
                                <Text style={styles.optionLabel}>{option.label}</Text>
                                {option.subLabel && (
                                    <Text style={styles.optionSub}>{option.subLabel}</Text>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
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
    card: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        shadowColor: '#000',
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
        color: '#333',
        marginBottom: 8,
    },
    attribution: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        marginBottom: 16,
        textAlign: 'center'
    },
    descriptorContainer: {
        backgroundColor: '#fff3e0',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#ffe0b2'
    },
    descriptor: {
        fontSize: 13,
        color: '#e65100', // Warning Orange
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
        backgroundColor: '#eee',
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
        backgroundColor: '#f5f5f5',
    },
    cancelText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
    },
});
