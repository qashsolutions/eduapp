-- COMPLETE SUPABASE SQL SETUP SCRIPT
-- Run this entire script in Supabase SQL Editor
-- It creates all tables, indexes, RLS policies, and cleanup functions

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (careful in production!)
DROP TABLE IF EXISTS question_attempts CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =====================================================
-- STEP 1: CREATE USERS TABLE
-- =====================================================
CREATE TABLE users (
  -- Primary fields
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'student' CHECK (role IN ('student', 'teacher')),
  subscription_status TEXT DEFAULT 'free' CHECK (subscription_status IN ('free', 'student', 'teacher')),
  
  -- English Proficiency columns (1-9 scale) - EXACTLY matching our code
  english_comprehension INTEGER DEFAULT 5 CHECK (english_comprehension BETWEEN 1 AND 9),
  english_grammar INTEGER DEFAULT 5 CHECK (english_grammar BETWEEN 1 AND 9),
  english_vocabulary INTEGER DEFAULT 5 CHECK (english_vocabulary BETWEEN 1 AND 9),
  english_sentences INTEGER DEFAULT 5 CHECK (english_sentences BETWEEN 1 AND 9),
  english_synonyms INTEGER DEFAULT 5 CHECK (english_synonyms BETWEEN 1 AND 9),
  english_antonyms INTEGER DEFAULT 5 CHECK (english_antonyms BETWEEN 1 AND 9),
  english_fill_blanks INTEGER DEFAULT 5 CHECK (english_fill_blanks BETWEEN 1 AND 9),
  
  -- Math Proficiency columns (1-9 scale) - EXACTLY matching our code
  math_number_theory INTEGER DEFAULT 5 CHECK (math_number_theory BETWEEN 1 AND 9),
  math_algebra INTEGER DEFAULT 5 CHECK (math_algebra BETWEEN 1 AND 9),
  math_geometry INTEGER DEFAULT 5 CHECK (math_geometry BETWEEN 1 AND 9),
  math_statistics INTEGER DEFAULT 5 CHECK (math_statistics BETWEEN 1 AND 9),
  math_precalculus INTEGER DEFAULT 5 CHECK (math_precalculus BETWEEN 1 AND 9),
  math_calculus INTEGER DEFAULT 5 CHECK (math_calculus BETWEEN 1 AND 9),
  
  -- Timestamps
  last_assessment TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for users table
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_subscription ON users(subscription_status);

-- =====================================================
-- STEP 2: CREATE QUESTION_ATTEMPTS TABLE
-- =====================================================
CREATE TABLE question_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  correct BOOLEAN NOT NULL,
  time_spent INTEGER CHECK (time_spent >= 0), -- seconds
  prompts_used INTEGER DEFAULT 0 CHECK (prompts_used >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for question_attempts table
CREATE INDEX idx_attempts_student_topic ON question_attempts(student_id, topic, created_at DESC);
CREATE INDEX idx_attempts_cleanup ON question_attempts(created_at);

-- =====================================================
-- STEP 3: CREATE AUTO-CLEANUP FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_old_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM question_attempts 
  WHERE created_at < NOW() - INTERVAL '60 days';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 4: ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" 
  ON users FOR SELECT 
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" 
  ON users FOR UPDATE 
  USING (auth.uid() = id);

-- Enable RLS on question_attempts table
ALTER TABLE question_attempts ENABLE ROW LEVEL SECURITY;

-- Users can view their own attempts
CREATE POLICY "Users can view own attempts" 
  ON question_attempts FOR SELECT 
  USING (auth.uid() = student_id);

-- Users can insert their own attempts
CREATE POLICY "Users can insert own attempts" 
  ON question_attempts FOR INSERT 
  WITH CHECK (auth.uid() = student_id);

-- =====================================================
-- STEP 5: CREATE TRIGGER FOR SUPABASE AUTH INTEGRATION
-- =====================================================

-- Function to handle new user creation from Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =====================================================
-- STEP 6: GRANT NECESSARY PERMISSIONS
-- =====================================================

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.question_attempts TO authenticated;

-- Grant permissions to service role (for server-side operations)
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON public.users TO service_role;
GRANT ALL ON public.question_attempts TO service_role;

-- =====================================================
-- STEP 7: CREATE SCHEDULED JOB FOR CLEANUP (Optional)
-- =====================================================
-- Note: This requires pg_cron extension to be enabled in Supabase
-- You can enable it in the Database settings

-- If pg_cron is available, uncomment the following:
-- SELECT cron.schedule(
--   'cleanup-old-attempts',
--   '0 2 * * *', -- Daily at 2 AM
--   'SELECT cleanup_old_attempts();'
-- );

-- =====================================================
-- VERIFICATION QUERIES (Run these to verify setup)
-- =====================================================

-- Check if tables were created successfully
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'question_attempts');

-- Check columns in users table (should show all 13 proficiency columns)
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'users'
ORDER BY ordinal_position;

-- Check RLS policies
SELECT tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================

-- Insert a test user (replace with actual UUID from Supabase Auth)
-- INSERT INTO users (id, email) VALUES 
-- ('123e4567-e89b-12d3-a456-426614174000'::uuid, 'test@example.com');

-- Insert test question attempts
-- INSERT INTO question_attempts (student_id, topic, correct, time_spent, prompts_used) VALUES
-- ('123e4567-e89b-12d3-a456-426614174000'::uuid, 'math_algebra', true, 45, 0),
-- ('123e4567-e89b-12d3-a456-426614174000'::uuid, 'english_grammar', false, 60, 1);