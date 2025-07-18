import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with singleton pattern
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('=== SUPABASE INITIALIZATION ===');
console.log('URL:', supabaseUrl);
console.log('Has Service Key:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log('Has Anon Key:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
console.log('Using key type:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Service Role' : 'Anon');

let supabase;

if (!supabase) {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('CRITICAL: Missing Supabase configuration!');
    console.error('URL present:', !!supabaseUrl);
    console.error('Key present:', !!supabaseServiceKey);
  }
  
  supabase = createClient(supabaseUrl, supabaseServiceKey);
  console.log('Supabase: Client initialized');
}

export { supabase };

// User operations
export const getUser = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
};

export const updateUserProficiency = async (userId, topic, newLevel) => {
  try {
    const updateData = {
      [topic]: newLevel,
      last_assessment: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating proficiency:', error);
    return null;
  }
};

export const createUser = async (email, userId, role = 'student', grade = null, isParent = false, parentInfo = null) => {
  try {
    // First check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (existingUser) {
      return existingUser;
    }
    
    // Create new user with Supabase user ID (text format)
    const userData = {
      id: userId, // Supabase user ID as text
      email: email,
      role: role,
      subscription_status: 'free',
      // All proficiency fields default to 5
      english_comprehension: 5,
      english_grammar: 5,
      english_vocabulary: 5,
      english_sentences: 5,
      english_synonyms: 5,
      english_antonyms: 5,
      english_fill_blanks: 5,
      math_number_theory: 5,
      math_algebra: 5,
      math_geometry: 5,
      math_statistics: 5,
      math_precalculus: 5,
      math_calculus: 5,
      created_at: new Date().toISOString()
    };
    
    // Add optional fields if provided
    if (grade) userData.grade = grade;
    if (parentInfo && parentInfo.parent_id) userData.parent_id = parentInfo.parent_id;
    if (parentInfo && parentInfo.first_name) userData.first_name = parentInfo.first_name;
    if (parentInfo && parentInfo.passcode) userData.passcode = parentInfo.passcode;
    if (role === 'student' && !isParent) {
      userData.account_type = 'pending';
    } else if (role === 'parent' || role === 'teacher') {
      userData.account_type = 'trial';
      userData.trial_started_at = new Date().toISOString();
      userData.trial_expires_at = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    }
    
    const { data, error } = await supabase
      .from('users')
      .insert([userData])
      .select()
      .single();
    
    if (error) throw error;
    
    // If student signup, store parent info for approval process
    if (role === 'student' && parentInfo && !isParent) {
      await supabase
        .from('parent_child_approvals')
        .insert([{
          parent_email: parentInfo.parentEmail,
          child_email: email,
          parent_name: parentInfo.parentName
        }]);
      
      // Send approval email to parent using Supabase
      try {
        // Create a unique approval token
        const approvalToken = Buffer.from(`${parentInfo.parentEmail}:${email}:${Date.now()}`).toString('base64');
        
        // Store the approval token
        await supabase
          .from('parent_child_approvals')
          .update({ approval_token: approvalToken })
          .eq('parent_email', parentInfo.parentEmail)
          .eq('child_email', email);
        
        // Send email via Supabase Auth (magic link)
        // Using Supabase's built-in parent approval flow, 
        // we'll trigger this through our API
        const response = await fetch('/api/send-parent-consent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            childFirstName: parentInfo.childFirstName || 'Student',
            childGrade: grade || 7,
            parentEmail: parentInfo.parentEmail
          })
        });
        
        if (!response.ok) {
          console.error('Failed to send parent approval email');
        }
      } catch (emailError) {
        console.error('Error sending parent approval email:', emailError);
        // Don't fail the signup if email fails
      }
    }
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating user:', error);
    return null;
  }
};

// Question attempts operations
export const logQuestionAttempt = async (studentId, topic, correct, timeSpent, promptsUsed = 0, questionHash = null, sessionId = null, abandoned = false) => {
  try {
    const { data, error } = await supabase
      .from('question_attempts')
      .insert([{
        student_id: studentId,
        topic: topic,
        correct: correct,
        time_spent: timeSpent,
        prompts_used: promptsUsed,
        question_hash: questionHash,
        session_id: sessionId,
        abandoned: abandoned
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error logging attempt:', error);
    return null;
  }
};

export const getRecentAttempts = async (studentId, topic, limit = 10) => {
  try {
    const { data, error } = await supabase
      .from('question_attempts')
      .select('*')
      .eq('student_id', studentId)
      .eq('topic', topic)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching attempts:', error);
    return [];
  }
};

export const getSessionStats = async (studentId) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data, error } = await supabase
      .from('question_attempts')
      .select('topic, correct')
      .eq('student_id', studentId)
      .gte('created_at', today.toISOString());
    
    if (error) throw error;
    
    // Calculate stats
    const stats = {
      totalQuestions: data.length,
      correctAnswers: data.filter(a => a.correct).length,
      topicsAttempted: [...new Set(data.map(a => a.topic))].length
    };
    
    return stats;
  } catch (error) {
    console.error('Error fetching session stats:', error);
    return { totalQuestions: 0, correctAnswers: 0, topicsAttempted: 0 };
  }
};

// Subscription operations
export const updateSubscriptionStatus = async (userId, status) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ subscription_status: status })
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating subscription:', error);
    return null;
  }
};

// Check if question was recently used
export const checkQuestionHash = async (studentId, questionHash) => {
  try {
    const { data, error } = await supabase
      .from('question_attempts')
      .select('id')
      .eq('student_id', studentId)
      .eq('question_hash', questionHash)
      .gte('created_at', new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString())
      .limit(1);
    
    if (error) throw error;
    return data && data.length > 0;
  } catch (error) {
    console.error('Error checking question hash:', error);
    return false;
  }
};

// Cache question for reuse
export const cacheQuestion = async (topic, difficulty, grade, question, aiModel) => {
  try {
    const { data, error } = await supabase
      .from('question_cache')
      .insert({
        topic,
        difficulty,
        grade,
        question,
        ai_model: aiModel
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error caching question:', error);
    return null;
  }
};

// Get cached question
export const getCachedQuestion = async (topic, difficulty, grade) => {
  try {
    const { data, error } = await supabase
      .from('question_cache')
      .select('*')
      .eq('topic', topic)
      .eq('difficulty', difficulty)
      .eq('grade', grade)
      .gte('expires_at', new Date().toISOString())
      .order('usage_count', { ascending: true })
      .limit(1);
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      // Increment usage count
      await supabase
        .from('question_cache')
        .update({ usage_count: data[0].usage_count + 1 })
        .eq('id', data[0].id);
      
      return data[0];
    }
    
    return null;
  } catch (error) {
    console.error('Error getting cached question:', error);
    return null;
  }
};

// Note: Auth is now handled by Supabase Auth
// This file only handles database operations with Supabase