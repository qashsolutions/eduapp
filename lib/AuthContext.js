import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from './db';
import { retrieveSessionData, storeSessionData, clearSessionData } from './studentSession';

/**
 * Authentication Context for managing user state across the application
 * Provides centralized auth state management without circular dependencies
 */
const AuthContext = createContext({});

/**
 * Authentication Provider Component
 * Manages user authentication state and provides auth methods to child components
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to wrap
 */
export function AuthProvider({ children }) {
  // User state with cached profile data to prevent repeated DB calls
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userCache, setUserCache] = useState(null);
  const router = useRouter();

  /**
   * Initialize authentication state on component mount
   * Checks for existing session and sets up auth state listener
   */
  useEffect(() => {
    // Check initial session state
    checkSession();

    // Set up auth state change listener for real-time auth updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthChange);

    // Cleanup subscription on unmount to prevent memory leaks
    return () => subscription.unsubscribe();
  }, []);

  /**
   * Check current session and load user profile if authenticated
   * Uses cached data when available to prevent unnecessary DB calls
   */
  const checkSession = async () => {
    try {
      // First check for student session using helper function
      const studentData = retrieveSessionData();
      if (studentData) {
        // Load full student profile from database
        await loadUserProfile(studentData.id);
        return;
      }
      
      // Check regular Supabase auth session for parents/teachers
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Check cache first to avoid redundant DB queries
        if (userCache?.id === session.user.id) {
          setUser(userCache);
        } else {
          await loadUserProfile(session.user.id);
        }
      } else {
        setUser(null);
        setUserCache(null);
      }
    } catch (error) {
      console.error('Session check error:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle authentication state changes
   * Responds to login, logout, and token refresh events
   * @param {string} event - Auth event type
   * @param {Object} session - Current session object
   */
  const handleAuthChange = async (event, session) => {
    // Prevent race conditions by checking current user state
    if (event === 'SIGNED_IN' && session?.user && (!user || user.id !== session.user.id)) {
      await loadUserProfile(session.user.id);
    } else if (event === 'SIGNED_OUT') {
      setUser(null);
      setUserCache(null);
      router.push('/');
    }
  };

  /**
   * Load user profile from database with caching
   * Prevents redundant database calls by caching user data
   * @param {string} userId - User ID to load profile for
   */
  const loadUserProfile = async (userId) => {
    try {
      // Check if this is a student session
      const studentData = retrieveSessionData();
      let profile;
      let error;
      
      if (studentData && studentData.id === userId) {
        // For students, use API endpoint that validates session
        console.log('Loading student profile via API...');
        const response = await fetch('/api/get-student-profile', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Student ${studentData.sessionToken}`
          },
          body: JSON.stringify({ studentId: userId })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load profile');
        }
        
        profile = await response.json();
      } else {
        // Regular users with Supabase Auth
        const result = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();
          
        error = result.error;
        profile = result.data;
      }

      if (error) throw error;

      // Update both user state and cache
      setUser(profile);
      setUserCache(profile);

      // Handle trial expiration for paid subscriptions
      if (profile.subscription_status !== 'free' && profile.trial_expires_at) {
        const trialExpired = new Date(profile.trial_expires_at) < new Date();
        if (trialExpired && !profile.stripe_payment_id) {
          // Update subscription status if trial expired without payment
          await supabase
            .from('users')
            .update({ subscription_status: 'free' })
            .eq('id', userId);
          
          // Update local state to reflect change
          const updatedProfile = { ...profile, subscription_status: 'free' };
          setUser(updatedProfile);
          setUserCache(updatedProfile);
        }
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      // Clear user state on error to prevent stale data
      setUser(null);
      setUserCache(null);
    }
  };

  /**
   * Refresh user profile data
   * Forces a fresh fetch from database, bypassing cache
   */
  const refreshUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await loadUserProfile(session.user.id);
    }
  };

  /**
   * Sign out user and clear all auth state
   * Handles cleanup and navigation
   */
  const signOut = async () => {
    try {
      // Clear student session from all storage
      clearSessionData();
      
      await supabase.auth.signOut();
      // State cleanup handled by onAuthStateChange listener
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  /**
   * Set student session directly without Supabase Auth
   * Used for student login flow
   */
  const setStudentSession = async (studentData) => {
    try {
      setLoading(true);
      
      // Store session data using helper function
      const sessionInfo = {
        ...studentData,
        sessionToken: studentData.sessionToken
      };
      
      // Use localStorage if keepSignedIn is true
      storeSessionData(sessionInfo, studentData.keepSignedIn);
      
      // Load the full student profile from database
      await loadUserProfile(studentData.id);
      
      // Return success
      return { success: true };
    } catch (error) {
      console.error('Error setting student session:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Route protection helper
   * Redirects unauthenticated users to appropriate pages
   */
  useEffect(() => {
    // Skip protection during initial load
    if (loading) return;

    const publicPaths = ['/', '/signup', '/auth/student-login', '/auth/student-signup', '/auth/teacher-auth', '/auth/parent-verify', '/login-old'];
    const isPublicPath = publicPaths.includes(router.pathname);

    // Redirect unauthenticated users trying to access protected routes
    if (!user && !isPublicPath) {
      router.push('/signup');
    }
    
    // Redirect authenticated users from landing page to dashboard
    if (user && router.pathname === '/') {
      router.push('/dashboard');
    }
  }, [user, loading, router.pathname]);

  // Context value with auth state and methods
  const value = {
    user,
    loading,
    signOut,
    refreshUser,
    setStudentSession,
    isAuthenticated: !!user,
    getSession: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Custom hook to use authentication context
 * @returns {Object} Authentication context value
 * @throws {Error} If used outside of AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}