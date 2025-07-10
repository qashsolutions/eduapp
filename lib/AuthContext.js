import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { onAuthChange, auth } from './firebase';
import { getUser } from './db';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export function AuthProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    
    // Wait for router to be ready before setting up auth
    if (!router.isReady) {
      return;
    }
    
    console.log('AuthContext: Setting up auth listener');
    
    const unsubscribe = onAuthChange(async (fbUser) => {
      if (!isMounted.current) return;
      
      console.log('AuthContext: Auth state changed:', fbUser?.uid);
      
      setFirebaseUser(fbUser);
      
      if (!fbUser) {
        setUser(null);
        setLoading(false);
        setAuthChecked(true);
        
        // Only redirect if on protected route and router is ready
        const protectedRoutes = ['/', '/dashboard'];
        if (router.isReady && protectedRoutes.includes(router.pathname)) {
          console.log('AuthContext: No user, redirecting to landing');
          setTimeout(() => {
            if (isMounted.current && router.isReady) {
              router.replace('/landing');
            }
          }, 100);
        }
        return;
      }

      try {
        // Fetch user data from Supabase
        console.log('AuthContext: Fetching user data for:', fbUser.uid);
        const userData = await getUser(fbUser.uid);
        
        if (userData) {
          setUser(userData);
        } else {
          console.log('AuthContext: No user profile found');
          // Don't create profile here - let login handle it
          setUser(null);
        }
      } catch (error) {
        console.error('AuthContext: Error loading user:', error);
        setUser(null);
      } finally {
        setLoading(false);
        setAuthChecked(true);
      }
    });

    return () => {
      isMounted.current = false;
      unsubscribe();
    };
  }, [router.isReady, router.pathname]);

  // Handle route protection
  useEffect(() => {
    if (!authChecked || !router.isReady || !isMounted.current) return;
    
    const publicRoutes = ['/landing', '/login'];
    const isPublicRoute = publicRoutes.includes(router.pathname);
    
    // Redirect authenticated users from login to dashboard
    if (firebaseUser && router.pathname === '/login') {
      console.log('AuthContext: User authenticated, redirecting to dashboard');
      setTimeout(() => {
        if (isMounted.current && router.isReady) {
          router.replace('/');
        }
      }, 100);
    }
    
    // Redirect unauthenticated users from protected routes
    if (!firebaseUser && !isPublicRoute && router.pathname !== '/') {
      console.log('AuthContext: User not authenticated, redirecting to landing');
      setTimeout(() => {
        if (isMounted.current && router.isReady) {
          router.replace('/landing');
        }
      }, 100);
    }
  }, [firebaseUser, authChecked, router.pathname, router.isReady]);

  const value = {
    user,
    firebaseUser,
    loading,
    authChecked,
    isAuthenticated: !!firebaseUser,
    refreshUser: async () => {
      if (firebaseUser) {
        const userData = await getUser(firebaseUser.uid);
        setUser(userData);
      }
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}