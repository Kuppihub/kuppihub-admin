'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  getRedirectResult,
  signOut as firebaseSignOut 
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

export interface AdminUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAdmin: boolean;
  role: string | null;
  permissions: string[];
  isSuperAdmin: boolean;
}

interface AuthContextType {
  user: AdminUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
  getIdToken: () => Promise<string | null>;
  refreshAdminProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const redirectHandled = useRef(false);

  const fetchAdminProfile = async (firebaseUser: User): Promise<AdminUser | null> => {
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch('/api/admin/me', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const admin = data?.admin;
      if (!admin) return null;

      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        isAdmin: true,
        role: admin.role || null,
        permissions: admin.permissions || [],
        isSuperAdmin: !!admin.isSuperAdmin,
      };
    } catch (error) {
      console.error('[Auth] Failed to fetch admin profile:', error);
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Handle redirect result when returning from Google sign-in
    const handleRedirectResult = async () => {
      if (redirectHandled.current) return;
      redirectHandled.current = true;
      
      try {
        console.log('[Auth] Checking for redirect result...');
        const result = await getRedirectResult(auth);
        if (result) {
          console.log('[Auth] Redirect result received:', result.user.email);
          const adminProfile = await fetchAdminProfile(result.user);
          if (!adminProfile) {
            console.log('[Auth] User is not admin, signing out');
            await firebaseSignOut(auth);
            if (isMounted) {
              setError('Access denied. You are not authorized as an admin.');
              setUser(null);
              setLoading(false);
            }
          }
        } else {
          console.log('[Auth] No redirect result');
        }
      } catch (error) {
        console.error('[Auth] Redirect result error:', error);
        if (isMounted) {
          setError('Failed to sign in. Please try again.');
          setLoading(false);
        }
      }
    };

    handleRedirectResult();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      console.log('[Auth] Auth state changed:', firebaseUser?.email || 'null');
      
      if (firebaseUser) {
        const adminProfile = await fetchAdminProfile(firebaseUser);

        if (!adminProfile) {
          console.log('[Auth] User not admin, signing out');
          await firebaseSignOut(auth);
          if (isMounted) {
            setUser(null);
            setError('Access denied. You are not authorized as an admin.');
          }
        } else {
          console.log('[Auth] User is admin, setting user state');
          if (isMounted) {
            setUser(adminProfile);
            setError(null);
          }
        }
      } else {
        if (isMounted) {
          setUser(null);
        }
      }
      if (isMounted) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      setError(null);
      setLoading(true);
      console.log('[Auth] Starting Google sign-in with popup...');
      const result = await signInWithPopup(auth, googleProvider);
      console.log('[Auth] Sign-in successful:', result.user.email);
      
      const adminProfile = await fetchAdminProfile(result.user);
      if (!adminProfile) {
        console.log('[Auth] User is not admin, signing out');
        await firebaseSignOut(auth);
        setError('Access denied. You are not authorized as an admin.');
        setUser(null);
        setLoading(false);
      }
      // If admin, the onAuthStateChanged listener will handle setting the user
    } catch (error: unknown) {
      console.error('[Auth] Sign in error:', error);
      const firebaseError = error as { code?: string; message?: string };
      if (firebaseError.code === 'auth/popup-closed-by-user') {
        setError('Sign-in was cancelled. Please try again.');
      } else if (firebaseError.code === 'auth/popup-blocked') {
        setError('Popup was blocked. Please allow popups and try again.');
      } else {
        setError(`Failed to sign in: ${firebaseError.message || 'Please try again.'}`);
      }
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setError(null);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const getIdToken = async (): Promise<string | null> => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        return await currentUser.getIdToken();
      }
      return null;
    } catch (error) {
      console.error('Error getting ID token:', error);
      return null;
    }
  };

  const refreshAdminProfile = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const adminProfile = await fetchAdminProfile(currentUser);
    if (adminProfile) {
      setUser(adminProfile);
      setError(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut, error, getIdToken, refreshAdminProfile }}>
      {children}
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
