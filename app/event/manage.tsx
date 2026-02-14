import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, MapPin, Save, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useDataStore } from '../../store/useDataStore';
import { Event } from '../../types';

export default function ManageEventScreen() {
    const router = useRouter();
    const { colors } = useAppTheme();
    const { seasonId, id } = useLocalSearchParams<{ seasonId: string, id?: string }>();
    const { addEvent, updateEvent, events, deleteEvent } = useDataStore();

    const existingEvent = id ? events.find(e => e.id === id) : null;
    const isEditing = !!existingEvent;

    // Form State
    const [name, setName] = useState(existingEvent?.name || '');
    const [location, setLocation] = useState(existingEvent?.location || '');

    // Date State
    const [date, setDate] = useState(existingEvent ? new Date(existingEvent.startDate) : new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    const handleSave = () => {
        if (!name.trim()) {
            Alert.alert('Required', 'Event Name is required');
            return;
        }

        if (isEditing && id) {
            updateEvent(id, {
                name: name.trim(),
                location: location.trim(),
                startDate: date.getTime()
            });
        } else {
            if (!seasonId) {
                Alert.alert('Error', 'Missing season ID');
                console.error("Missing Season ID");
                return;
            }
            // Ensure seasonId is a string
            const sId = Array.isArray(seasonId) ? seasonId[0] : seasonId;

            const newEvent: Event = {
                id: Date.now().toString(),
                seasonId: sId,
                name: name.trim(),
                location: location.trim(),
                startDate: date.getTime()
            };
            addEvent(newEvent);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
    };

    const handleDelete = () => {
        if (id) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert(
                "Delete Event",
                "Are you sure you want to delete this event? This action cannot be undone.",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => {
                            deleteEvent(id);
                            router.back();
                        }
                    }
                ]
            );
        }
    };

    const onDateChange = (event: any, selectedDate?: Date) => {
        const currentDate = selectedDate || date;
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
        }
        setDate(currentDate);
    };

    // Helper to format date for display
    const formattedDate = date.toLocaleDateString();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.content}>

                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <X color={colors.text} size={24} />
                        </TouchableOpacity>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>{isEditing ? 'Edit Event' : 'New Event'}</Text>
                        <View style={{ width: 24 }} />
                    </View>

                    <View style={[styles.card, { backgroundColor: colors.bgCard, shadowColor: colors.shadow }]}>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Event Name</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.buttonSecondary, color: colors.text, borderColor: colors.border }]}
                                value={name}
                                onChangeText={setName}
                                placeholder="e.g. Windy City Qualifier"
                                placeholderTextColor={colors.textTertiary}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Location</Text>
                            <View style={[styles.iconInput, { backgroundColor: colors.buttonSecondary, borderColor: colors.border }]}>
                                <MapPin size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
                                <TextInput
                                    style={[{ flex: 1, fontSize: 16, color: colors.text }]}
                                    value={location}
                                    onChangeText={setLocation}
                                    placeholder="e.g. Chicago, IL"
                                    placeholderTextColor={colors.textTertiary}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Start Date</Text>
                            {/* Platform specific date picker logic */}
                            {Platform.OS === 'ios' ? (
                                <View style={{ alignItems: 'flex-start' }}>
                                    <DateTimePicker
                                        value={date}
                                        mode="date"
                                        display="default"
                                        onChange={onDateChange}
                                        style={{ marginLeft: -10 }}
                                    />
                                </View>
                            ) : (
                                <TouchableOpacity
                                    style={[styles.iconInput, { backgroundColor: colors.buttonSecondary, borderColor: colors.border }]}
                                    onPress={() => setShowDatePicker(true)}
                                >
                                    <Calendar size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
                                    <Text style={[{ fontSize: 16, color: colors.text }]}>
                                        {formattedDate}
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {showDatePicker && Platform.OS === 'android' && (
                                <DateTimePicker
                                    value={date}
                                    mode="date"
                                    display="default"
                                    onChange={onDateChange}
                                />
                            )}
                        </View>

                    </View>

                    {isEditing && (
                        <View style={{ gap: 12 }}>
                            <TouchableOpacity style={[styles.deleteBtn, { backgroundColor: colors.bgOverlay }]} onPress={handleDelete}>
                                <Trash2 size={20} color={colors.opponent} />
                                <Text style={[styles.deleteText, { color: colors.opponent }]}>Delete Event</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.deleteBtn, { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.opponent }]}
                                onPress={() => {
                                    Alert.alert(
                                        "Reset Event",
                                        "This will delete ALL match data and stats associated with this event. This cannot be undone.",
                                        [
                                            { text: "Cancel", style: "cancel" },
                                            {
                                                text: "Reset Event Data",
                                                style: "destructive",
                                                onPress: () => {
                                                    const { resetEvent } = useDataStore.getState();
                                                    if (id) {
                                                        resetEvent(id);
                                                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                                        Alert.alert("Success", "Event data has been reset.");
                                                    }
                                                }
                                            }
                                        ]
                                    );
                                }}
                            >
                                <Trash2 size={20} color={colors.opponent} />
                                <Text style={[styles.deleteText, { color: colors.opponent }]}>Reset Event Data</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                </ScrollView>

                <View style={[styles.footer, { backgroundColor: colors.bgCard, borderTopColor: colors.border }]}>
                    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }]} onPress={handleSave}>
                        <Save size={20} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.saveBtnText}>Save Event</Text>
                    </TouchableOpacity>
                </View>

            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 20,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    backBtn: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
    },
    card: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        fontSize: 16,
    },
    iconInput: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    helper: {
        fontSize: 12,
        marginTop: 4,
        marginLeft: 4,
    },
    deleteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        borderRadius: 12,
    },
    deleteText: {
        fontWeight: '600',
        fontSize: 16,
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
    },
    saveBtn: {
        height: 56,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    saveBtnText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
});
