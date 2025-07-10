import { supabase } from '../../lib/db';

export default async function handler(req, res) {
  console.log('=== SUPABASE CONNECTION TEST ===');
  
  try {
    // Test 1: Check Supabase URL and Anon Key
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('Has Anon Key:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    
    // Test 2: Try to get session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    console.log('Session test:', { 
      hasSession: !!sessionData?.session,
      sessionError: sessionError?.message 
    });
    
    // Test 3: Check if auth is enabled
    const authEnabled = await supabase.auth.getUser().then(() => true).catch(() => false);
    console.log('Auth enabled:', authEnabled);
    
    // Test 4: Try a simple database query
    const { data: dbTest, error: dbError } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    console.log('Database test:', { 
      canQueryDB: !dbError,
      dbError: dbError?.message 
    });
    
    // Test 5: Check auth settings
    const authTest = {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      canGetSession: !sessionError,
      authEnabled: authEnabled,
      canQueryDB: !dbError
    };
    
    res.status(200).json({
      success: true,
      tests: authTest,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}