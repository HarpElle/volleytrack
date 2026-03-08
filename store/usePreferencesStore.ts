import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type RosterSortOrder = 'name' | 'jersey';

interface PreferencesState {
    /** How players are sorted when displayed in roster views (default: 'name') */
    rosterSortBy: RosterSortOrder;

    /** Update the roster sort preference */
    setRosterSortBy: (sortBy: RosterSortOrder) => void;

    /** Toggle the roster sort preference between 'name' and 'jersey' */
    toggleRosterSort: () => void;
}

export const usePreferencesStore = create<PreferencesState>()(
    persist(
        (set) => ({
            rosterSortBy: 'name',

            setRosterSortBy: (sortBy) => set({ rosterSortBy: sortBy }),

            toggleRosterSort: () =>
                set((state) => ({
                    rosterSortBy: state.rosterSortBy === 'name' ? 'jersey' : 'name',
                })),
        }),
        {
            name: 'volleytrack-preferences',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
