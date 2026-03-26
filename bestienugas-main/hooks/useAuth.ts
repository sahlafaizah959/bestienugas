import { useState, useEffect } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase';
import { UserProfile } from '../types';

interface UseAuthReturn {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuth = (): UseAuthReturn => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (!user) {
        setUserProfile(null);
        setLoading(false);
        return;
      }

      // Once we have a user, set up a real-time listener on their Firestore doc
      const userDocRef = doc(db, 'users', user.uid);

      // Ensure the user document exists (first login initialization)
      const userSnap = await getDoc(userDocRef);
      if (!userSnap.exists()) {
        await setDoc(userDocRef, {
          email: user.email ?? '',
          chats_left: 5,
          total_storage_kb: 0,
          created_at: serverTimestamp(),
        });
      }

      // Real-time listener for chats_left updates
      const unsubscribeSnapshot = onSnapshot(userDocRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setUserProfile({
            email: data.email ?? '',
            chats_left: typeof data.chats_left === 'number' ? data.chats_left : 5,
            total_storage_kb: typeof data.total_storage_kb === 'number' ? data.total_storage_kb : 0,
          });
        }
        setLoading(false);
      });

      // Return cleanup for snapshot listener — stored in a ref-like pattern
      // We attach it to the auth unsubscribe cleanup below
      return () => unsubscribeSnapshot();
    });

    return () => unsubscribeAuth();
  }, []);

  const signInWithGoogle = async (): Promise<void> => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      // Ignore popup-closed-by-user errors
      if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
        console.error('Google sign-in error:', error);
        throw error;
      }
    }
  };

  const signOut = async (): Promise<void> => {
    await firebaseSignOut(auth);
    setUserProfile(null);
  };

  return { currentUser, userProfile, loading, signInWithGoogle, signOut };
};
