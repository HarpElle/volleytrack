import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../services/firebase/config';

export interface Reaction {
    id: string;
    type: string;
    senderId: string;
    timestamp: number;
}

export function useIncomingReactions(matchCode: string) {
    const [reactions, setReactions] = useState<Reaction[]>([]);

    useEffect(() => {
        if (!matchCode) return;

        if (!db) return;
        const reactionsRef = collection(db, 'liveMatches', matchCode, 'reactions');
        const q = query(reactionsRef, orderBy('timestamp', 'desc'), limit(10));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newReactions: Reaction[] = [];
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    newReactions.push({
                        id: change.doc.id,
                        type: data.type,
                        senderId: data.senderId,
                        timestamp: data.timestamp,
                    });
                }
            });

            if (newReactions.length > 0) {
                // We only care about "added" events for floating animations
                setReactions(prev => [...prev, ...newReactions].slice(-20));
            }
        });

        return () => unsubscribe();
    }, [matchCode]);

    return reactions;
}
