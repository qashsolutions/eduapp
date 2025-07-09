import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

export const createUser = async (email, userId) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .insert([{
        id: userId,
        email: email,
        role: 'student',
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
        math_calculus: 5
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating user:', error);
    return null;
  }
};

// Question attempts operations
export const logQuestionAttempt = async (studentId, topic, correct, timeSpent, promptsUsed = 0) => {
  try {
    const { data, error } = await supabase
      .from('question_attempts')
      .insert([{
        student_id: studentId,
        topic: topic,
        correct: correct,
        time_spent: timeSpent,
        prompts_used: promptsUsed
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

// Auth helpers
export const getCurrentUser = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error signing out:', error);
    return false;
  }
};