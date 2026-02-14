import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Event, MatchRecord, Season } from '../types';
import { fullSync, pushItem, deleteCloudItem } from '../services/firebase/syncService';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

interface DataState {
    seasons: Season[];
    events: Event[];
    savedMatches: MatchRecord[];

    // Sync state
    syncStatus: SyncStatus;
    lastSyncedAt: number | null;
    syncError: string | null;

    // Actions
    addSeason: (season: Season) => void;
    updateSeason: (id: string, updates: Partial<Season>) => void;
    deleteSeason: (id: string) => void;

    addEvent: (event: Event) => void;
    updateEvent: (id: string, updates: Partial<Event>) => void;
    deleteEvent: (id: string) => void;

    saveMatchRecord: (match: MatchRecord) => void;
    updateLogEntry: (matchId: string, logId: string, updates: Partial<import('../types').StatLog>) => void;

    resetEvent: (eventId: string) => void;
    deleteMatchRecord: (matchId: string) => void;
    resetMatchRecord: (matchId: string) => void;

    // Sync actions
    syncWithCloud: (uid: string) => Promise<void>;
    pushItemToCloud: (uid: string, type: 'season' | 'event' | 'match', data: Season | Event | MatchRecord) => Promise<void>;
    deleteItemFromCloud: (uid: string, type: 'season' | 'event' | 'match', id: string) => Promise<void>;

    // Helpers
    touchSeason: (id: string) => void;
    getAdHocMatches: () => MatchRecord[];
    getSeasonEvents: (seasonId: string) => Event[];
    getEventMatches: (eventId: string) => MatchRecord[];
}

export const useDataStore = create<DataState>()(
    persist(
        (set, get) => ({
            seasons: [],
            events: [],
            savedMatches: [],
            syncStatus: 'idle' as SyncStatus,
            lastSyncedAt: null,
            syncError: null,

            addSeason: (season) => set((state) => ({ seasons: [...state.seasons, { ...season, lastAccessed: Date.now() }] })),
            updateSeason: (id, updates) => set((state) => ({
                seasons: state.seasons.map((s) => (s.id === id ? { ...s, ...updates, lastAccessed: Date.now() } : s))
            })),
            touchSeason: (id) => set((state) => ({
                seasons: state.seasons.map((s) => (s.id === id ? { ...s, lastAccessed: Date.now() } : s))
            })),
            deleteSeason: (id) => set((state) => ({
                seasons: state.seasons.filter((s) => s.id !== id),
            })),

            addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
            updateEvent: (id, updates) => set((state) => ({
                events: state.events.map((e) => (e.id === id ? { ...e, ...updates } : e))
            })),
            deleteEvent: (id) => set((state) => ({
                events: state.events.filter((e) => e.id !== id)
            })),

            saveMatchRecord: (match) => set((state) => {
                const exists = state.savedMatches.find(m => m.id === match.id);
                if (exists) {
                    return {
                        savedMatches: state.savedMatches.map(m => m.id === match.id ? match : m)
                    };
                }
                return { savedMatches: [...state.savedMatches, match] };
            }),

            updateLogEntry: (matchId, logId, updates) => set((state) => ({
                savedMatches: state.savedMatches.map(match => {
                    if (match.id !== matchId) return match;
                    return {
                        ...match,
                        history: match.history.map(log => log.id === logId ? { ...log, ...updates } : log)
                    };
                })
            })),

            deleteMatchRecord: (id) => set((state) => ({
                savedMatches: state.savedMatches.filter((m) => m.id !== id)
            })),

            resetEvent: (id) => set((state) => ({
                savedMatches: state.savedMatches.filter((m) => m.eventId !== id)
            })),

            resetMatchRecord: (id) => set((state) => ({
                savedMatches: state.savedMatches.map((m) => {
                    if (m.id !== id) return m;
                    // Reset to initial state but keep setup info
                    return {
                        ...m,
                        result: 'Scheduled',
                        scores: [{ myTeam: 0, opponent: 0 }],
                        setsWon: { myTeam: 0, opponent: 0 },
                        history: [],
                        // Keep dates, config, lineups, opponent, etc.
                    };
                })
            })),

            // ── Sync Actions ──────────────────────────────────────────────────

            syncWithCloud: async (uid: string) => {
                set({ syncStatus: 'syncing', syncError: null });
                try {
                    const { seasons, events, savedMatches } = get();
                    const result = await fullSync(uid, seasons, events, savedMatches);

                    if (result.success) {
                        set({
                            seasons: result.mergedSeasons,
                            events: result.mergedEvents,
                            savedMatches: result.mergedMatches,
                            syncStatus: 'synced',
                            lastSyncedAt: Date.now(),
                            syncError: null,
                        });
                    } else {
                        set({ syncStatus: 'error', syncError: result.error || 'Sync failed' });
                    }
                } catch (err: any) {
                    set({ syncStatus: 'error', syncError: err.message || 'Sync failed' });
                }
            },

            pushItemToCloud: async (uid: string, type, data) => {
                try {
                    await pushItem(uid, type, data);
                } catch (err) {
                    // Silent fail for incremental pushes — full sync will catch up
                    console.warn('[Sync] Incremental push failed:', err);
                }
            },

            deleteItemFromCloud: async (uid: string, type, id) => {
                try {
                    await deleteCloudItem(uid, type, id);
                } catch (err) {
                    console.warn('[Sync] Cloud delete failed:', err);
                }
            },

            // ── Helpers ──────────────────────────────────────────────────────

            getAdHocMatches: () => {
                return get().savedMatches.filter((m) => !m.seasonId && !m.eventId);
            },
            getSeasonEvents: (seasonId) => {
                return get().events.filter((e) => e.seasonId === seasonId).sort((a, b) => b.startDate - a.startDate);
            },
            getEventMatches: (eventId) => {
                return get().savedMatches
                    .filter((m) => m.eventId === eventId)
                    .sort((a, b) => {
                        // Sort by Date (ascending)
                        if (a.date !== b.date) return a.date - b.date;
                        // If same date, sort by Time
                        const timeA = a.time || '';
                        const timeB = b.time || '';
                        return timeA.localeCompare(timeB);
                    });
            }
        }),
        {
            name: 'volleytrack-data',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
