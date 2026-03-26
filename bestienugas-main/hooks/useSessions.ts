/**
 * useSessions.ts
 *
 * Real-time hook that listens to users/{uid}/sessions using Firestore onSnapshot.
 * Returns a sorted list of sessions (newest first) and a loading flag.
 */

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Session } from '../types';

interface UseSessionsReturn {
  sessions: Session[];
  loading: boolean;
}

export const useSessions = (uid: string | null): UseSessionsReturn => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // No user — clear sessions and bail
    if (!uid) {
      setSessions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const sessionsRef = collection(db, 'users', uid, 'sessions');
    const q = query(sessionsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loaded: Session[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const ts =
            data.createdAt instanceof Timestamp
              ? data.createdAt.toMillis()
              : Date.now();
          return {
            id: docSnap.id,
            title: data.title ?? 'Untitled Chat',
            createdAt: ts,
            files: Array.isArray(data.files) ? data.files : [],
          };
        });
        setSessions(loaded);
        setLoading(false);
      },
      (error) => {
        console.error('useSessions onSnapshot error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  return { sessions, loading };
};
