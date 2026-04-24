import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithEmailAndPassword, signOut as firebaseSignOut, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isVerified: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<User>;
  checkVerification: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true, 
  isAdmin: false,
  isVerified: false,
  signOut: async () => {},
  signInWithGoogle: async () => {},
  checkVerification: async () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);

  // Admin email for RX ELITE
  const ADMIN_EMAIL = 'rxtools1@gmail.com';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      // isVerified is strictly Discord-driven via localStorage
      const discordStatus = localStorage.getItem('discord_verified') === 'true';
      setIsVerified(discordStatus);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signOut = async () => {
    localStorage.removeItem('discord_verified');
    await firebaseSignOut(auth);
    setIsVerified(false);
    setUser(null);
  };

  const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  };

  const checkVerification = async () => {
    setIsVerified(true);
    localStorage.setItem('discord_verified', 'true');
    // If not logged in but verified, we can stay as "Elite Guest"
  };

  const isAdmin = user?.email === ADMIN_EMAIL;
  const effectiveVerified = isVerified || isAdmin;
  
  // Create a serializable version of the user for context to avoid circular reference errors
  const effectiveUser = user ? {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    emailVerified: user.emailVerified
  } : (effectiveVerified ? { 
    uid: 'elite-guest',
    displayName: 'Elite Member', 
    email: 'verified@discord.win',
    photoURL: null,
    emailVerified: true
  } : null);

  return (
    <AuthContext.Provider value={{ 
      user: effectiveUser as any, 
      loading, 
      isAdmin, 
      isVerified: effectiveVerified, 
      signOut, 
      signInWithGoogle, 
      checkVerification 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
