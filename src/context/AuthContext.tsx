import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { triggerUserSignupNotification } from '../lib/notificationService';

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser && currentUser.email) {
        // Automatically create user doc if it doesn't exist
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            const displayName = currentUser.displayName || currentUser.email.split('@')[0] || 'User';
            await setDoc(userRef, {
              uid: currentUser.uid,
              name: displayName,
              email: currentUser.email,
              photoURL: currentUser.photoURL || '',
              createdAt: serverTimestamp()
            });

            // Trigger Email #1 (Admin Notification) & Email #2 (User Welcome)
            triggerUserSignupNotification({
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: displayName,
              provider: currentUser.providerData?.[0]?.providerId || 'google/password'
            }).catch(e => console.error("Error triggering signup notification:", e));
          }
        } catch (error) {
          console.error("Error creating user document", error);
        }
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
