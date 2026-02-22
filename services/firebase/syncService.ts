/**
 * Firestore Sync Service
 *
 * Offline-first sync layer between local Zustand/AsyncStorage and Firebase Firestore.
 *
 * Schema:
 *   users/{uid}/seasons/{seasonId}   → Season document
 *   users/{uid}/events/{eventId}     → Event document
 *   users/{uid}/matches/{matchId}    → MatchRecord document (includes full history/logs)
 *
 * Strategy:
 *   - Local AsyncStorage is always the source of truth during active use
 *   - Sync pushes local data to Firestore after key actions (match finalize, season CRUD)
 *   - Sync pulls cloud data on app foreground / manual refresh
 *   - Conflict resolution: last-write-wins based on `updatedAt` timestamp
 *   - Firestore offline cache provides automatic offline support
 */

import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    serverTimestamp,
    Timestamp,
    writeBatch,
} from 'firebase/firestore';
import { Event, MatchRecord, Season } from '../../types';
import { logger } from '../../utils/logger';
import { db } from './config';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SyncResult {
    success: boolean;
    seasonsUploaded: number;
    eventsUploaded: number;
    matchesUploaded: number;
    seasonsPulled: number;
    eventsPulled: number;
    matchesPulled: number;
    error?: string;
}

interface CloudDocument {
    updatedAt: Timestamp | null;
    [key: string]: any;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function userCollection(uid: string, subcollection: string) {
    if (!db) throw new Error('Firestore not initialized');
    return collection(db, 'users', uid, subcollection);
}

function userDoc(uid: string, subcollection: string, docId: string) {
    if (!db) throw new Error('Firestore not initialized');
    return doc(db, 'users', uid, subcollection, docId);
}

// Add an updatedAt field for conflict resolution
function withTimestamp<T extends object>(data: T): T & { updatedAt: ReturnType<typeof serverTimestamp> } {
    return { ...data, updatedAt: serverTimestamp() };
}

// ─── Push (Local → Cloud) ────────────────────────────────────────────────────

/**
 * Push all local data to Firestore.
 * Uses batched writes (max 500 ops per batch) for efficiency.
 */
export async function pushToCloud(
    uid: string,
    seasons: Season[],
    events: Event[],
    matches: MatchRecord[]
): Promise<{ success: boolean; error?: string }> {
    try {
        // Firestore batches are limited to 500 operations.
        // Collect all items into a flat list, then batch write directly.
        const BATCH_SIZE = 450;

        const items: Array<{ subcollection: string; id: string; data: object }> = [
            ...seasons.map((s) => ({ subcollection: 'seasons', id: s.id, data: s })),
            ...events.map((e) => ({ subcollection: 'events', id: e.id, data: e })),
            ...matches.map((m) => ({ subcollection: 'matches', id: m.id, data: m })),
        ];

        if (!db) throw new Error('Firestore not initialized');
        let batch = writeBatch(db);
        let count = 0;

        for (const item of items) {
            batch.set(userDoc(uid, item.subcollection, item.id), withTimestamp(item.data));
            count++;

            if (count >= BATCH_SIZE) {
                await batch.commit();
                batch = writeBatch(db);
                count = 0;
            }
        }

        // Commit remaining operations
        if (count > 0) {
            await batch.commit();
        }

        return { success: true };
    } catch (err: any) {
        logger.error('[Sync] Push failed:', err);
        return { success: false, error: err.message || 'Push to cloud failed' };
    }
}

/**
 * Push a single item to Firestore (for incremental sync after individual saves).
 */
export async function pushItem(
    uid: string,
    type: 'season' | 'event' | 'match',
    data: Season | Event | MatchRecord
) {
    try {
        const subcollection = type === 'season' ? 'seasons' : type === 'event' ? 'events' : 'matches';
        if (!db) throw new Error('Firestore not initialized');
        const batch = writeBatch(db);
        batch.set(userDoc(uid, subcollection, data.id), withTimestamp(data));
        await batch.commit();
        return { success: true };
    } catch (err: any) {
        logger.error(`[Sync] Push ${type} failed:`, err);
        return { success: false, error: err.message };
    }
}

/**
 * Delete a single item from Firestore.
 */
export async function deleteCloudItem(
    uid: string,
    type: 'season' | 'event' | 'match',
    id: string
) {
    try {
        const subcollection = type === 'season' ? 'seasons' : type === 'event' ? 'events' : 'matches';
        await deleteDoc(userDoc(uid, subcollection, id));
        return { success: true };
    } catch (err: any) {
        logger.error(`[Sync] Delete ${type} failed:`, err);
        return { success: false, error: err.message };
    }
}

// ─── Pull (Cloud → Local) ────────────────────────────────────────────────────

/**
 * Pull all data from Firestore for a given user.
 * Returns the cloud data; the caller (store) decides how to merge.
 */
export async function pullFromCloud(uid: string): Promise<{
    success: boolean;
    seasons: Season[];
    events: Event[];
    matches: MatchRecord[];
    error?: string;
}> {
    try {
        const [seasonsSnap, eventsSnap, matchesSnap] = await Promise.all([
            getDocs(userCollection(uid, 'seasons')),
            getDocs(userCollection(uid, 'events')),
            getDocs(userCollection(uid, 'matches')),
        ]);

        const seasons: Season[] = [];
        seasonsSnap.forEach((doc) => {
            const data = doc.data();
            delete data.updatedAt; // Strip Firestore metadata
            seasons.push(data as Season);
        });

        const events: Event[] = [];
        eventsSnap.forEach((doc) => {
            const data = doc.data();
            delete data.updatedAt;
            events.push(data as Event);
        });

        const matches: MatchRecord[] = [];
        matchesSnap.forEach((doc) => {
            const data = doc.data();
            delete data.updatedAt;
            matches.push(data as MatchRecord);
        });

        return { success: true, seasons, events, matches };
    } catch (err: any) {
        logger.error('[Sync] Pull failed:', err);
        return { success: false, seasons: [], events: [], matches: [], error: err.message || 'Pull from cloud failed' };
    }
}

// ─── Full Sync (Bidirectional Merge) ─────────────────────────────────────────

/**
 * Full sync: pulls cloud data, merges with local, pushes merged result back.
 *
 * Merge strategy (per item, by ID):
 *   - Item exists locally only → push to cloud
 *   - Item exists in cloud only → pull to local
 *   - Item exists in both → keep the one with more recent data
 *     (for matches: prefer the one with more history entries as a heuristic for "more complete")
 *     (for seasons/events: prefer local since the user just used the app)
 */
export async function fullSync(
    uid: string,
    localSeasons: Season[],
    localEvents: Event[],
    localMatches: MatchRecord[]
): Promise<{
    success: boolean;
    mergedSeasons: Season[];
    mergedEvents: Event[];
    mergedMatches: MatchRecord[];
    error?: string;
}> {
    // 1. Pull cloud data
    const cloud = await pullFromCloud(uid);
    if (!cloud.success) {
        return {
            success: false,
            mergedSeasons: localSeasons,
            mergedEvents: localEvents,
            mergedMatches: localMatches,
            error: cloud.error,
        };
    }

    // 2. Merge
    const mergedSeasons = mergeById(localSeasons, cloud.seasons);
    const mergedEvents = mergeById(localEvents, cloud.events);
    const mergedMatches = mergeMatchRecords(localMatches, cloud.matches);

    // 3. Push merged result back to cloud
    const push = await pushToCloud(uid, mergedSeasons, mergedEvents, mergedMatches);

    return {
        success: push.success,
        mergedSeasons,
        mergedEvents,
        mergedMatches,
        error: push.error,
    };
}

// ─── Merge Helpers ───────────────────────────────────────────────────────────

/**
 * Simple merge by ID: local wins for items that exist in both.
 * Items only in cloud get added. Items only in local stay.
 */
function mergeById<T extends { id: string }>(local: T[], cloud: T[]): T[] {
    const localMap = new Map(local.map((item) => [item.id, item]));
    const merged = [...local]; // Start with all local items

    for (const cloudItem of cloud) {
        if (!localMap.has(cloudItem.id)) {
            // Cloud-only: add to local
            merged.push(cloudItem);
        }
        // If both exist, local wins (user was just using the app)
    }

    return merged;
}

/**
 * Match-specific merge: for items in both, prefer the one with more history entries.
 * This handles the case where a match was played on device A and the data needs to
 * flow to device B.
 */
function mergeMatchRecords(local: MatchRecord[], cloud: MatchRecord[]): MatchRecord[] {
    const localMap = new Map(local.map((m) => [m.id, m]));
    const merged: MatchRecord[] = [];

    // Process local items
    for (const localMatch of local) {
        const cloudMatch = cloud.find((c) => c.id === localMatch.id);
        if (!cloudMatch) {
            merged.push(localMatch);
        } else {
            // Both exist: prefer the one with more complete data
            if ((localMatch.history?.length || 0) >= (cloudMatch.history?.length || 0)) {
                merged.push(localMatch);
            } else {
                merged.push(cloudMatch);
            }
        }
    }

    // Add cloud-only items
    for (const cloudMatch of cloud) {
        if (!localMap.has(cloudMatch.id)) {
            merged.push(cloudMatch);
        }
    }

    return merged;
}
