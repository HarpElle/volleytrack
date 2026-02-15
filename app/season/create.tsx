import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Pencil, Plus, Trash2, Users } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useDataStore } from '../../store/useDataStore';
import { Player, Season } from '../../types';

export default function CreateSeasonScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { addSeason, updateSeason, seasons } = useDataStore();
    const { colors } = useAppTheme();

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
    const [sortBy, setSortBy] = useState<'name' | 'jersey'>('name');

    const sortedPlayers = useMemo(() => {
        return [...players].sort((a, b) => {
            if (sortBy === 'jersey') {
                const numA = parseInt(a.jerseyNumber || '', 10);
                const numB = parseInt(b.jerseyNumber || '', 10);
                if (isNaN(numA)) return 1;
                if (isNaN(numB)) return -1;
                return numA - numB;
            }
            return (a.name || '').localeCompare(b.name || '');
        });
    }, [players, sortBy]);

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
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.content}>

                    <Text style={[styles.headerTitle, { color: colors.text }]}>{isEditing ? 'Edit Season' : 'New Season'}</Text>

                    <View style={[styles.card, { backgroundColor: colors.bgCard }]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Season Name</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.buttonSecondary, borderColor: colors.border, color: colors.text }]}
                            value={name}
                            onChangeText={setName}
                            placeholder="e.g. 2024-2025 Club"
                            placeholderTextColor={colors.textTertiary}
                        />

                        <Text style={[styles.label, { color: colors.textSecondary }]}>Team Name</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.buttonSecondary, borderColor: colors.border, color: colors.text }]}
                            value={teamName}
                            onChangeText={setTeamName}
                            placeholder="e.g. 15U National"
                            placeholderTextColor={colors.textTertiary}
                        />

                        <Text style={[styles.label, { color: colors.textSecondary }]}>Level / League</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.buttonSecondary, borderColor: colors.border, color: colors.text }]}
                            value={level}
                            onChangeText={setLevel}
                            placeholder="e.g. Open"
                            placeholderTextColor={colors.textTertiary}
                        />
                    </View>

                    <View style={[styles.sectionHeader, { justifyContent: 'space-between' }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Users size={20} color={colors.textSecondary} />
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>{isEditing ? 'Manage Roster' : 'Initial Roster'}</Text>
                        </View>
                        {players.length > 1 && (
                            <TouchableOpacity onPress={() => setSortBy(prev => prev === 'name' ? 'jersey' : 'name')}>
                                <Text style={[styles.sortToggleText, { color: colors.primary }]}>Sort by {sortBy === 'name' ? 'Jersey' : 'Name'}</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={[styles.card, { backgroundColor: colors.bgCard }]}>
                        <View style={styles.addPlayerRow}>
                            <TextInput
                                style={[styles.input, { flex: 2, marginBottom: 0, backgroundColor: colors.buttonSecondary, borderColor: colors.border, color: colors.text }]}
                                value={newPlayerName}
                                onChangeText={setNewPlayerName}
                                placeholder="Player Name"
                                placeholderTextColor={colors.textTertiary}
                            />
                            <TextInput
                                style={[styles.input, { flex: 1, marginBottom: 0, marginHorizontal: 8, backgroundColor: colors.buttonSecondary, borderColor: colors.border, color: colors.text }]}
                                value={newPlayerNumber}
                                onChangeText={setNewPlayerNumber}
                                placeholder="#"
                                keyboardType="number-pad"
                                placeholderTextColor={colors.textTertiary}
                            />
                            <TouchableOpacity
                                style={[styles.addBtn, { backgroundColor: colors.primary }, editingPlayerId ? { backgroundColor: '#4CAF50' } : {}]}
                                onPress={handleAddOrUpdatePlayer}
                            >
                                {editingPlayerId ? <Check size={24} color={'#ffffff'} /> : <Plus size={24} color={'#ffffff'} />}
                            </TouchableOpacity>
                        </View>

                        {players.length > 0 && (
                            <View style={[styles.rosterList, { borderTopColor: colors.border }]}>
                                {sortedPlayers.map((p) => (
                                    <View key={p.id} style={[styles.playerItem, { borderBottomColor: colors.border }, editingPlayerId === p.id && { backgroundColor: colors.primaryLight }]}>
                                        <TouchableOpacity
                                            style={[styles.playerInfo, { flex: 1 }]}
                                            onPress={() => handleEditPlayer(p)}
                                        >
                                            <Text style={[styles.playerNumber, { color: colors.textTertiary }]}>#{p.jerseyNumber || '-'}</Text>
                                            <Text style={[styles.playerName, { color: colors.text }, editingPlayerId === p.id && { color: colors.primary, fontWeight: 'bold' }]}>
                                                {p.name}
                                            </Text>
                                        </TouchableOpacity>

                                        <View style={{ flexDirection: 'row', gap: 12 }}>
                                            <TouchableOpacity onPress={() => handleEditPlayer(p)}>
                                                <Pencil size={18} color={colors.textSecondary} />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => removePlayer(p.id!)}>
                                                <Trash2 size={18} color={colors.opponent} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>

                    {isEditing && (
                        <TouchableOpacity
                            style={[styles.deleteActionBtn, { borderColor: colors.opponent || '#ff4444' }]}
                            onPress={() => {
                                Alert.alert(
                                    "Delete Season",
                                    "Are you sure you want to delete this season? This action cannot be undone.",
                                    [
                                        { text: "Cancel", style: "cancel" },
                                        {
                                            text: "Delete",
                                            style: "destructive",
                                            onPress: () => {
                                                const { deleteSeason } = useDataStore.getState();
                                                deleteSeason(id);
                                                router.dismissAll();
                                                router.replace('/');
                                            }
                                        }
                                    ]
                                );
                            }}
                        >
                            <Trash2 size={20} color={colors.opponent || '#ff4444'} />
                            <Text style={[styles.deleteActionText, { color: colors.opponent || '#ff4444' }]}>Delete Season</Text>
                        </TouchableOpacity>
                    )}
                </ScrollView>

                <View style={[styles.footer, { flexDirection: 'row', gap: 12, backgroundColor: colors.bgCard, borderTopColor: colors.border }]}>
                    <TouchableOpacity
                        style={[styles.createBtn, { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, flex: 1 }]}
                        onPress={() => router.back()}
                    >
                        <Text style={[styles.createBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.primary, flex: 2 }]} onPress={handleSaveSeason}>
                        <Text style={[styles.createBtnText, { color: '#ffffff' }]}>{isEditing ? 'Update Season' : 'Create Season'}</Text>
                    </TouchableOpacity>
                </View>

            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f7fa', // Override with colors.bg in component
    },
    content: {
        padding: 20,
        paddingBottom: 100,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1a1a1a', // Override with colors.text in component
        marginBottom: 24,
    },
    card: {
        backgroundColor: '#fff', // Override with colors.bgCard in component
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
        color: '#666', // Override with colors.textSecondary in component
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#f9f9f9', // Override with colors.buttonSecondary in component
        borderWidth: 1,
        borderColor: '#eee', // Override with colors.border in component
        borderRadius: 10,
        padding: 12,
        fontSize: 16,
        color: '#333', // Override with colors.text in component
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
        color: '#333', // Override with colors.text in component
    },
    sortToggleText: {
        fontSize: 14,
        fontWeight: '600',
    },
    addPlayerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    addBtn: {
        backgroundColor: '#0066cc', // Override with colors.primary in component
        width: 44,
        height: 44,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rosterList: {
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0', // Override with colors.border in component
        paddingTop: 8,
    },
    playerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f9f9f9', // Override with colors.border in component
    },
    playerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    playerNumber: {
        fontSize: 14,
        fontWeight: '700',
        color: '#999', // Override with colors.textTertiary in component
        width: 30,
    },
    playerName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333', // Override with colors.text in component
    },
    footer: {
        padding: 20,
        backgroundColor: '#fff', // Override with colors.bgCard in component
        borderTopWidth: 1,
        borderTopColor: '#eee', // Override with colors.border in component
    },
    createBtn: {
        backgroundColor: '#0066cc', // Override with colors.primary in component
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#0066cc', // Override with colors.primary in component
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    createBtnText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff', // Override with colors.bgCard in component
    },
    deleteActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginTop: 24,
        gap: 8,
        backgroundColor: 'transparent'
    },
    deleteActionText: {
        fontSize: 16,
        fontWeight: '700',
    }
});
