import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar as CalendarIcon, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';

interface DateRangeFilterProps {
    startDate: Date | null;
    endDate: Date | null;
    onFilterChange: (start: Date | null, end: Date | null) => void;
}

export default function DateRangeFilter({ startDate, endDate, onFilterChange }: DateRangeFilterProps) {
    const { colors } = useAppTheme();
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
        <View style={[styles.container, { backgroundColor: colors.bgCard }]}>
            <View style={styles.row}>
                <CalendarIcon size={16} color={colors.textSecondary} />
                <Text style={[styles.label, { color: colors.textSecondary }]}>Filter by Date:</Text>
            </View>

            <View style={styles.controls}>
                <TouchableOpacity
                    style={[styles.dateBtn, { backgroundColor: colors.bg, borderColor: colors.border }]}
                    onPress={() => setShowPicker('start')}
                >
                    <Text style={[styles.dateText, { color: colors.text }, !startDate && { color: colors.textTertiary }]}>
                        {startDate ? formatDate(startDate) : 'Start'}
                    </Text>
                </TouchableOpacity>

                <Text style={[styles.to, { color: colors.textTertiary }]}>-</Text>

                <TouchableOpacity
                    style={[styles.dateBtn, { backgroundColor: colors.bg, borderColor: colors.border }]}
                    onPress={() => setShowPicker('end')}
                >
                    <Text style={[styles.dateText, { color: colors.text }, !endDate && { color: colors.textTertiary }]}>
                        {endDate ? formatDate(endDate) : 'End'}
                    </Text>
                </TouchableOpacity>

                {(startDate || endDate) && (
                    <TouchableOpacity onPress={clearFilter} style={[styles.clearBtn, { backgroundColor: colors.buttonSecondary }]}>
                        <X size={16} color={colors.textTertiary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* DateTimePicker Logic */}
            {showPicker && (
                Platform.OS === 'ios' ? (
                    <Modal transparent animationType="fade">
                        <View style={[styles.modalOverlay, { backgroundColor: colors.bgOverlay }]}>
                            <View style={[styles.pickerContainer, { backgroundColor: colors.bgCard }]}>
                                <View style={[styles.pickerHeader, { borderBottomColor: colors.border }]}>
                                    <Text style={[styles.pickerTitle, { color: colors.text }]}>
                                        Select {showPicker === 'start' ? 'Start' : 'End'} Date
                                    </Text>
                                    <TouchableOpacity onPress={() => setShowPicker(null)}>
                                        <Text style={[styles.doneBtn, { color: colors.primary }]}>Done</Text>
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
        textTransform: 'uppercase',
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dateBtn: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
    },
    dateText: {
        fontSize: 14,
        fontWeight: '500',
        textAlign: 'center',
    },
    to: {
        fontWeight: '700',
    },
    clearBtn: {
        padding: 4,
        borderRadius: 12,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    pickerContainer: {
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
    },
    pickerTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    doneBtn: {
        fontWeight: '700',
        fontSize: 16,
    },
});
