/**
 * geminiService.ts
 *
 * Handles streaming AI responses and post-stream Firestore updates.
 *
 * Changes from v1:
 *  - Accepts sessionId parameter to save messages to the correct session sub-collection.
 *  - Replaces all updateDoc calls with setDoc(..., { merge: true }) to prevent
 *    "No document to update" errors if the user doc was recently deleted.
 *  - Delegates history CRUD to firestoreService.ts.
 */

import {
  doc,
  getDoc,
  setDoc,
  increment,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Message, UploadedFile, ERROR_LIMIT_REACHED, ERROR_STORAGE_LIMIT } from '../types';
import {
  saveMessageToFirestore,
  getHistoryTotalBytes,
  MAX_HISTORY_BYTES,
} from './firestoreService';

export const generateResponseStream = async (
  history: Message[],
  currentPrompt: string,
  files: UploadedFile[],
  onChunk: (text: string) => void,
  uid?: string,
  sessionId?: string
): Promise<void> => {
  // --- PRE-FLIGHT: Check chats_left in Firestore (if user is logged in) ---
  if (uid) {
    const userDocRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      const chatsLeft = typeof data.chats_left === 'number' ? data.chats_left : 0;
      if (chatsLeft <= 0) {
        const err = new Error('Chat limit reached');
        (err as any).code = ERROR_LIMIT_REACHED;
        throw err;
      }
    }
  }

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        history,
        currentPrompt,
        files,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Server error: ${response.status}`;

      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error) {
          const innerError =
            typeof errorJson.error === 'string'
              ? errorJson.error
              : JSON.stringify(errorJson.error);
          if (innerError.includes('429') || innerError.includes('Quota exceeded')) {
            errorMessage =
              'Waduh, server lagi rame banget Bestie (Rate Limit). Coba tunggu 10-20 detik terus kirim lagi ya!';
          } else {
            errorMessage = innerError;
          }
        }
      } catch (e) {
        errorMessage = errorText;
      }

      throw new Error(errorMessage);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullAiResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      const chunk = decoder.decode(value, { stream: !done });

      if (chunk) {
        fullAiResponse += chunk;
        onChunk(chunk);
      }

      if (done) break;
    }

    // --- POST-STREAM: Firestore updates (only if user is logged in) ---
    if (uid && fullAiResponse) {
      const userDocRef = doc(db, 'users', uid);

      // 1. Decrement chats_left — use setDoc merge to avoid "No document" error
      await setDoc(
        userDocRef,
        { chats_left: increment(-1) },
        { merge: true }
      );

      // 2. Check storage before saving history
      const currentBytes = await getHistoryTotalBytes(uid);
      const newEntryBytes = currentPrompt.length + fullAiResponse.length;

      if (currentBytes + newEntryBytes > MAX_HISTORY_BYTES) {
        // Storage limit exceeded — throw special error for UI to handle
        const err = new Error('Storage limit exceeded');
        (err as any).code = ERROR_STORAGE_LIMIT;
        throw err;
      }

      // 3. Save user message and AI response to the session sub-collection
      if (sessionId) {
        await saveMessageToFirestore(uid, sessionId, 'user', currentPrompt);
        await saveMessageToFirestore(uid, sessionId, 'model', fullAiResponse);
      }

      // 4. Update total_storage_kb — use setDoc merge
      const addedKb = newEntryBytes / 1024;
      await setDoc(
        userDocRef,
        { total_storage_kb: increment(addedKb) },
        { merge: true }
      );
    }
  } catch (error: any) {
    // Re-throw special error codes without wrapping
    if (error.code === ERROR_LIMIT_REACHED || error.code === ERROR_STORAGE_LIMIT) {
      throw error;
    }
    console.error('Error generating response:', error);
    throw error;
  }
};
