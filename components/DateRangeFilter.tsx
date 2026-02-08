import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar as CalendarIcon, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface DateRangeFilterProps {
    startDate: Date | null;
    endDate: Date | null;
    onFilterChange: (start: Date | null, end: Date | null) => void;
}

export default function DateRangeFilter({ startDate, endDate, onFilterChange }: DateRangeFilterProps) {
    const [showPicker, setShowPicker] = useState<'start' | 'end' | null>(null);
    const [tempDate, setTempDate] = useState(new Date());

    const handleDateChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowPicker(null); // Close immediately on Android
        }

        if (selectedDate) {
            if (showPicker === 'start') {
                onFilterChange(selectedDate, endDate);
            } else if (showPicker === 'end') {
                onFilterChange(startDate, selectedDate);
            }
        }
    };

    const clearFilter = () => {
        onFilterChange(null, null);
    };

    const formatDate = (date: Date | null) => {
        if (!date) return 'Select Date';
        return date.toLocaleDateString();
    };

    return (
        <View style={styles.container}>
            <View style={styles.row}>
                <CalendarIcon size={16} color="#666" />
                <Text style={styles.label}>Filter by Date:</Text>
            </View>

            <View style={styles.controls}>
                <TouchableOpacity
                    style={styles.dateBtn}
                    onPress={() => setShowPicker('start')}
                >
                    <Text style={[styles.dateText, !startDate && styles.placeholder]}>
                        {startDate ? formatDate(startDate) : 'Start'}
                    </Text>
                </TouchableOpacity>

                <Text style={styles.to}>-</Text>

                <TouchableOpacity
                    style={styles.dateBtn}
                    onPress={() => setShowPicker('end')}
                >
                    <Text style={[styles.dateText, !endDate && styles.placeholder]}>
                        {endDate ? formatDate(endDate) : 'End'}
                    </Text>
                </TouchableOpacity>

                {(startDate || endDate) && (
                    <TouchableOpacity onPress={clearFilter} style={styles.clearBtn}>
                        <X size={16} color="#999" />
                    </TouchableOpacity>
                )}
            </View>

            {/* DateTimePicker Logic */}
            {showPicker && (
                Platform.OS === 'ios' ? (
                    <Modal transparent animationType="fade">
                        <View style={styles.modalOverlay}>
                            <View style={styles.pickerContainer}>
                                <View style={styles.pickerHeader}>
                                    <Text style={styles.pickerTitle}>
                                        Select {showPicker === 'start' ? 'Start' : 'End'} Date
                                    </Text>
                                    <TouchableOpacity onPress={() => setShowPicker(null)}>
                                        <Text style={styles.doneBtn}>Done</Text>
                                    </TouchableOpacity>
                                </View>
                                <DateTimePicker
                                    value={showPicker === 'start' ? (startDate || new Date()) : (endDate || new Date())}
                                    mode="date"
                                    display="spinner"
                                    onChange={handleDateChange}
                                    style={{ height: 120 }}
                                />
                            </View>
                        </View>
                    </Modal>
                ) : (
                    <DateTimePicker
                        value={showPicker === 'start' ? (startDate || new Date()) : (endDate || new Date())}
                        mode="date"
                        display="default"
                        onChange={handleDateChange}
                    />
                )
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 12,
        marginBottom: 16,
        gap: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        color: '#666',
        textTransform: 'uppercase',
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dateBtn: {
        flex: 1,
        backgroundColor: '#f5f7fa',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#eee',
    },
    dateText: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
        textAlign: 'center',
    },
    placeholder: {
        color: '#999',
    },
    to: {
        color: '#ccc',
        fontWeight: '700',
    },
    clearBtn: {
        padding: 4,
        backgroundColor: '#f5f5f5',
        borderRadius: 12,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    pickerContainer: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 20,
    },
    pickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    pickerTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    doneBtn: {
        color: '#0066cc',
        fontWeight: '700',
        fontSize: 16,
    },
});
