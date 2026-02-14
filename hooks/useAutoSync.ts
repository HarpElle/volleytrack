import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from '../services/firebase';
import { useDataStore } from '../store/useDataStore';

/**
 * Automatically syncs data with Firestore when:
 * 1. User is signed in
 * 2. App comes to foreground
 * 3. On initial mount (first load after sign-in)
 *
 * Uses refs to avoid stale closures in event listeners.
 */
export function useAutoSync() {
    const { user } = useAuth();
    const syncWithCloud = useDataStore((s) => s.syncWithCloud);
    const syncStatus = useDataStore((s) => s.syncStatus);

    const lastSynced = useRef(0);
    const MIN_SYNC_INTERVAL = 30_000;

    // Keep latest values in refs so the AppState listener always has fresh data
    const userRef = useRef(user);
    const syncStatusRef = useRef(syncStatus);
    const syncFnRef = useRef(syncWithCloud);

    useEffect(() => { userRef.current = user; }, [user]);
    useEffect(() => { syncStatusRef.current = syncStatus; }, [syncStatus]);
    useEffect(() => { syncFnRef.current = syncWithCloud; }, [syncWithCloud]);

    const doSync = useCallback(() => {
        const currentUser = userRef.current;
        if (!currentUser) return;
        if (syncStatusRef.current === 'syncing') return;
        if (Date.now() - lastSynced.current < MIN_SYNC_INTERVAL) return;

        lastSynced.current = Date.now();
        syncFnRef.current(currentUser.uid);
    }, []); // Stable reference — reads from refs

    // Sync on mount if signed in
    useEffect(() => {
        if (user) {
            // Small delay to let the store hydrate from AsyncStorage first
            const timer = setTimeout(doSync, 1000);
            return () => clearTimeout(timer);
        }
    }, [user?.uid, doSync]);

    // Sync when app returns to foreground
    useEffect(() => {
        const handleAppState = (nextState: AppStateStatus) => {
            if (nextState === 'active') {
                doSync();
            }
        };

        const subscription = AppState.addEventListener('change', handleAppState);
        return () => subscription.remove();
    }, [doSync]);
}
