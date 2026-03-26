/**
 * firestoreService.ts
 *
 * All Firestore session CRUD operations for the DestiNugas chat history system.
 *
 * Data schema:
 *   users/{uid}                                  — user profile (chats_left, total_storage_kb)
 *   users/{uid}/sessions/{sessionId}             — session metadata (title, createdAt, files[])
 *   users/{uid}/sessions/{sessionId}/messages/{messageId} — individual messages
 *
 * CRITICAL RULES:
 *  - Never save PDF Base64 data to Firestore. Only FileMetadata (id + name).
 *  - Always use setDoc(..., { merge: true }) on user doc to survive doc-deletion edge cases.
 *  - clearAllHistory uses writeBatch for atomic multi-delete.
 */

import {
  doc,
  collection,
  addDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { FileMetadata, Session, SessionMessage } from '../types';

export const MAX_HISTORY_BYTES = 3 * 1024 * 1024; // 3 MB

// ---------------------------------------------------------------------------
// Session CRUD
// ---------------------------------------------------------------------------

/**
 * Creates a new session document under users/{uid}/sessions/{sessionId}.
 * Returns the generated sessionId.
 */
export const createNewSession = async (
  uid: string,
  title: string,
  files: FileMetadata[]
): Promise<string> => {
  const sessionsRef = collection(db, 'users', uid, 'sessions');
  const newSessionRef = await addDoc(sessionsRef, {
    title: title.substring(0, 80), // cap title length
    createdAt: serverTimestamp(),
    files, // only { id, name } — NO Base64
  });
  return newSessionRef.id;
};

/**
 * Saves a single message to users/{uid}/sessions/{sessionId}/messages.
 */
export const saveMessageToFirestore = async (
  uid: string,
  sessionId: string,
  role: 'user' | 'model',
  text: string
): Promise<void> => {
  const messagesRef = collection(db, 'users', uid, 'sessions', sessionId, 'messages');
  await addDoc(messagesRef, {
    role,
    text,
    timestamp: serverTimestamp(),
  });
};

/**
 * Loads all messages for a session, ordered by timestamp ascending.
 */
export const loadMessagesFromSession = async (
  uid: string,
  sessionId: string
): Promise<SessionMessage[]> => {
  const messagesRef = collection(db, 'users', uid, 'sessions', sessionId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'asc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    const ts = data.timestamp instanceof Timestamp ? data.timestamp.toMillis() : Date.now();
    return {
      id: docSnap.id,
      role: data.role as 'user' | 'model',
      text: data.text ?? '',
      timestamp: ts,
    };
  });
};

/**
 * Deletes a session and all its messages sub-collection.
 * Firestore does NOT auto-delete sub-collections, so we delete messages first.
 */
export const deleteSession = async (uid: string, sessionId: string): Promise<void> => {
  const messagesRef = collection(db, 'users', uid, 'sessions', sessionId, 'messages');
  const messagesSnap = await getDocs(messagesRef);

  const batch = writeBatch(db);
  messagesSnap.docs.forEach((msgDoc) => batch.delete(msgDoc.ref));

  const sessionRef = doc(db, 'users', uid, 'sessions', sessionId);
  batch.delete(sessionRef);

  await batch.commit();
};

/**
 * Deletes ALL sessions (and their messages) for a user using writeBatch.
 * Firestore batch limit is 500 ops; we chunk if needed.
 */
export const clearAllHistory = async (uid: string): Promise<void> => {
  const sessionsRef = collection(db, 'users', uid, 'sessions');
  const sessionsSnap = await getDocs(sessionsRef);

  // Collect all refs to delete: messages first, then session docs
  const allRefs: ReturnType<typeof doc>[] = [];

  for (const sessionDoc of sessionsSnap.docs) {
    const messagesRef = collection(db, 'users', uid, 'sessions', sessionDoc.id, 'messages');
    const messagesSnap = await getDocs(messagesRef);
    messagesSnap.docs.forEach((msgDoc) => allRefs.push(msgDoc.ref));
    allRefs.push(sessionDoc.ref);
  }

  // Commit in chunks of 500 (Firestore batch limit)
  const CHUNK_SIZE = 500;
  for (let i = 0; i < allRefs.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    allRefs.slice(i, i + CHUNK_SIZE).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
};

// ---------------------------------------------------------------------------
// Storage accounting
// ---------------------------------------------------------------------------

/**
 * Calculates total bytes used across ALL sessions' messages for a user.
 * Used to enforce the MAX_HISTORY_BYTES (3MB) limit.
 */
export const getHistoryTotalBytes = async (uid: string): Promise<number> => {
  const sessionsRef = collection(db, 'users', uid, 'sessions');
  const sessionsSnap = await getDocs(sessionsRef);

  let totalBytes = 0;
  for (const sessionDoc of sessionsSnap.docs) {
    const messagesRef = collection(db, 'users', uid, 'sessions', sessionDoc.id, 'messages');
    const messagesSnap = await getDocs(messagesRef);
    messagesSnap.forEach((msgDoc) => {
      totalBytes += JSON.stringify(msgDoc.data()).length;
    });
  }
  return totalBytes;
};

// Re-export Session type for convenience
export type { Session, SessionMessage, FileMetadata };
