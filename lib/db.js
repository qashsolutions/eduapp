import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with singleton pattern
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase;

if (!supabase) {
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
    
    // Create new user with Firebase UID (text format)
    const userData = {
      id: userId, // Firebase UID as text
      email: email,
      role: role,
      grade: grade,
      subscription_status: 'free',
      is_parent: isParent,
      account_type: role === 'student' && !isParent ? 'pending' : 'trial',
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
      math_calculus: 5
    };
    
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
      
      // TODO: Send email to parent for approval
    }
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating user:', error);
    return null;
  }
};

// Question attempts operations
export const logQuestionAttempt = async (studentId, topic, correct, timeSpent, promptsUsed = 0, questionHash = null) => {
  try {
    const { data, error } = await supabase
      .from('question_attempts')
      .insert([{
        student_id: studentId,
        topic: topic,
        correct: correct,
        time_spent: timeSpent,
        prompts_used: promptsUsed,
        question_hash: questionHash
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

// Note: Auth is now handled by Firebase (see firebase.js)
// This file only handles database operations with Supabase