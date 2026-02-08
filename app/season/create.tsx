import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Pencil, Plus, Trash2, Users } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDataStore } from '../../store/useDataStore';
import { Player, Season } from '../../types';

export default function CreateSeasonScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { addSeason, updateSeason, seasons } = useDataStore();

    // Check if editing
    const existingSeason = id ? seasons.find(s => s.id === id) : null;
    const isEditing = !!existingSeason;

    // Form Stats
    const [name, setName] = useState(existingSeason?.name || '');
    const [teamName, setTeamName] = useState(existingSeason?.teamName || '');
    const [level, setLevel] = useState(existingSeason?.level || '');

    // Roster State
    const [players, setPlayers] = useState<Partial<Player>[]>(existingSeason?.roster || []);
    const [newPlayerName, setNewPlayerName] = useState('');
    const [newPlayerNumber, setNewPlayerNumber] = useState('');
    const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);

    const handleAddOrUpdatePlayer = () => {
        if (!newPlayerName.trim()) return;

        if (editingPlayerId) {
            // Update existing player
            setPlayers(players.map(p =>
                p.id === editingPlayerId
                    ? { ...p, name: newPlayerName.trim(), jerseyNumber: newPlayerNumber.trim() }
                    : p
            ));
            setEditingPlayerId(null);
        } else {
            // Add new player
            const player: Partial<Player> = {
                id: Date.now().toString() + Math.random(),
                name: newPlayerName.trim(),
                jerseyNumber: newPlayerNumber.trim(),
                positions: []
            };
            setPlayers([...players, player]);
        }

        setNewPlayerName('');
        setNewPlayerNumber('');
        setEditingPlayerId(null); // Reset
    };

    const handleEditPlayer = (player: Partial<Player>) => {
        if (player.id) {
            setEditingPlayerId(player.id);
            setNewPlayerName(player.name || '');
            setNewPlayerNumber(player.jerseyNumber || '');
        }
    };

    const removePlayer = (id: string) => {
        setPlayers(players.filter(p => p.id !== id));
        if (editingPlayerId === id) {
            setEditingPlayerId(null);
            setNewPlayerName('');
            setNewPlayerNumber('');
        }
    };

    const handleSaveSeason = () => {
        if (!name.trim() || !teamName.trim()) {
            Alert.alert('Required', 'Please enter Season Name and Team Name');
            return;
        }

        if (isEditing && existingSeason) {
            updateSeason(existingSeason.id, {
                name: name.trim(),
                teamName: teamName.trim(),
                level: level.trim() || 'General',
                roster: players as Player[]
            });
        } else {
            const newSeason: Season = {
                id: Date.now().toString(),
                name: name.trim(),
                teamName: teamName.trim(),
                level: level.trim() || 'General',
                startDate: Date.now(),
                roster: players as Player[] // Cast partials to full players (id is set)
            };
            addSeason(newSeason);
        }

        router.back();
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.content}>

                    <Text style={styles.headerTitle}>{isEditing ? 'Edit Season' : 'New Season'}</Text>

                    <View style={styles.card}>
                        <Text style={styles.label}>Season Name</Text>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="e.g. 2024-2025 Club"
                            placeholderTextColor="#999"
                        />

                        <Text style={styles.label}>Team Name</Text>
                        <TextInput
                            style={styles.input}
                            value={teamName}
                            onChangeText={setTeamName}
                            placeholder="e.g. 15U National"
                            placeholderTextColor="#999"
                        />

                        <Text style={styles.label}>Level / League</Text>
                        <TextInput
                            style={styles.input}
                            value={level}
                            onChangeText={setLevel}
                            placeholder="e.g. Open"
                            placeholderTextColor="#999"
                        />
                    </View>

                    <View style={styles.sectionHeader}>
                        <Users size={20} color="#444" />
                        <Text style={styles.sectionTitle}>{isEditing ? 'Manage Roster' : 'Initial Roster'}</Text>
                    </View>

                    <View style={styles.card}>
                        <View style={styles.addPlayerRow}>
                            <TextInput
                                style={[styles.input, { flex: 2, marginBottom: 0 }]}
                                value={newPlayerName}
                                onChangeText={setNewPlayerName}
                                placeholder="Player Name"
                                placeholderTextColor="#999"
                            />
                            <TextInput
                                style={[styles.input, { flex: 1, marginBottom: 0, marginHorizontal: 8 }]}
                                value={newPlayerNumber}
                                onChangeText={setNewPlayerNumber}
                                placeholder="#"
                                keyboardType="number-pad"
                                placeholderTextColor="#999"
                            />
                            <TouchableOpacity
                                style={[styles.addBtn, editingPlayerId ? { backgroundColor: '#4CAF50' } : {}]}
                                onPress={handleAddOrUpdatePlayer}
                            >
                                {editingPlayerId ? <Check size={24} color="#fff" /> : <Plus size={24} color="#fff" />}
                            </TouchableOpacity>
                        </View>

                        {players.length > 0 && (
                            <View style={styles.rosterList}>
                                {players.map((p) => (
                                    <View key={p.id} style={[styles.playerItem, editingPlayerId === p.id && { backgroundColor: '#f0f9ff' }]}>
                                        <TouchableOpacity
                                            style={[styles.playerInfo, { flex: 1 }]}
                                            onPress={() => handleEditPlayer(p)}
                                        >
                                            <Text style={styles.playerNumber}>#{p.jerseyNumber || '-'}</Text>
                                            <Text style={[styles.playerName, editingPlayerId === p.id && { color: '#0066cc', fontWeight: 'bold' }]}>
                                                {p.name}
                                            </Text>
                                        </TouchableOpacity>

                                        <View style={{ flexDirection: 'row', gap: 12 }}>
                                            <TouchableOpacity onPress={() => handleEditPlayer(p)}>
                                                <Pencil size={18} color="#666" />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => removePlayer(p.id!)}>
                                                <Trash2 size={18} color="#ff4444" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>

                </ScrollView>

                <View style={[styles.footer, { flexDirection: 'row', gap: 12 }]}>
                    <TouchableOpacity
                        style={[styles.createBtn, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', flex: 1 }]}
                        onPress={() => router.back()}
                    >
                        <Text style={[styles.createBtnText, { color: '#666' }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.createBtn, { flex: 2 }]} onPress={handleSaveSeason}>
                        <Text style={styles.createBtnText}>{isEditing ? 'Update Season' : 'Create Season'}</Text>
                    </TouchableOpacity>
                </View>

            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f7fa',
    },
    content: {
        padding: 20,
        paddingBottom: 100,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1a1a1a',
        marginBottom: 24,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#f9f9f9',
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 10,
        padding: 12,
        fontSize: 16,
        color: '#333',
        marginBottom: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
    },
    addPlayerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    addBtn: {
        backgroundColor: '#0066cc',
        width: 44,
        height: 44,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rosterList: {
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        paddingTop: 8,
    },
    playerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f9f9f9',
    },
    playerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    playerNumber: {
        fontSize: 14,
        fontWeight: '700',
        color: '#999',
        width: 30,
    },
    playerName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    footer: {
        padding: 20,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    createBtn: {
        backgroundColor: '#0066cc',
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#0066cc',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    createBtnText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
});
