import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase, getUser } from './db';

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
  const [supabaseUser, setSupabaseUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    
    // Wait for router to be ready before setting up auth
    if (!router.isReady) {
      return;
    }
    
    console.log('AuthContext: Setting up Supabase auth listener');
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted.current) return;
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user);
      } else {
        setLoading(false);
        setAuthChecked(true);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted.current) return;
      
      console.log('AuthContext: Auth state changed:', event, session?.user?.id);
      
      setSupabaseUser(session?.user ?? null);
      
      if (!session?.user) {
        setUser(null);
        setLoading(false);
        setAuthChecked(true);
        
        // Only redirect if on protected route and router is ready
        const protectedRoutes = ['/', '/dashboard', '/parent-dashboard'];
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

      // Load user profile when authenticated
      await loadUserProfile(session.user);
    });

    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
    };
  }, [router.isReady, router.pathname]);

  const loadUserProfile = async (authUser) => {
    try {
      console.log('AuthContext: Loading user profile for:', authUser.id);
      
      // First check if user profile exists
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();
        
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }
      
      if (userData) {
        setUser(userData);
        
        // Check if trial needs to be started (first login)
        if (userData.account_type === 'trial' && !userData.trial_started_at) {
          console.log('Starting trial period for user');
          const now = new Date().toISOString();
          const expiresAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
          
          const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update({ 
              trial_started_at: now,
              trial_expires_at: expiresAt 
            })
            .eq('id', authUser.id)
            .select()
            .single();
            
          if (!updateError && updatedUser) {
            setUser(updatedUser);
          }
        }
      } else {
        console.log('AuthContext: No user profile found');
        setUser(null);
      }
    } catch (error) {
      console.error('AuthContext: Error loading user:', error);
      setUser(null);
    } finally {
      setLoading(false);
      setAuthChecked(true);
    }
  };

  // Handle route protection
  useEffect(() => {
    if (!authChecked || !router.isReady || !isMounted.current) return;
    
    const publicRoutes = ['/landing', '/login', '/parent-verify'];
    const isPublicRoute = publicRoutes.includes(router.pathname);
    
    // Redirect authenticated users from login to dashboard
    if (supabaseUser && router.pathname === '/login') {
      console.log('AuthContext: User authenticated, redirecting to dashboard');
      setTimeout(() => {
        if (isMounted.current && router.isReady) {
          router.replace(user?.role === 'parent' ? '/parent-dashboard' : '/');
        }
      }, 100);
    }
    
    // Redirect unauthenticated users from protected routes
    if (!supabaseUser && !isPublicRoute && router.pathname !== '/') {
      console.log('AuthContext: User not authenticated, redirecting to landing');
      setTimeout(() => {
        if (isMounted.current && router.isReady) {
          router.replace('/landing');
        }
      }, 100);
    }
  }, [supabaseUser, authChecked, router.pathname, router.isReady, user]);

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      return { user: data.user, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { user: null, error: error.message };
    }
  };

  const signUp = async (email, password, metadata = {}) => {
    console.log('=== SIGNUP ATTEMPT ===');
    console.log('Email:', email);
    console.log('Password length:', password?.length);
    console.log('Metadata:', metadata);
    console.log('Supabase URL:', supabase.supabaseUrl);
    
    try {
      console.log('Calling supabase.auth.signUp...');
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      });
      
      console.log('Signup response:', { 
        data: data,
        error: error,
        errorType: error?.constructor?.name,
        errorStatus: error?.status,
        errorCode: error?.code
      });
      
      if (error) {
        console.error('Supabase signup error details:', {
          message: error.message,
          status: error.status,
          code: error.code,
          name: error.name,
          stack: error.stack
        });
        throw error;
      }
      
      console.log('Signup successful, user:', data.user?.id);
      return { user: data.user, error: null };
    } catch (error) {
      console.error('=== SIGNUP ERROR CAUGHT ===');
      console.error('Error type:', error.constructor.name);
      console.error('Error details:', error);
      return { user: null, error: error.message || error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const getSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  };

  const value = {
    user,
    supabaseUser,
    loading,
    authChecked,
    isAuthenticated: !!supabaseUser,
    signIn,
    signUp,
    signOut,
    getSession,
    refreshUser: async () => {
      if (supabaseUser) {
        await loadUserProfile(supabaseUser);
      }
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}