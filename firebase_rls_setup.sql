-- RLS Policies for Firebase Auth Integration
-- Run this in Supabase SQL Editor

-- STEP 1: Enable RLS on both tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_attempts ENABLE ROW LEVEL SECURITY;

-- STEP 2: Create service role policies for API access
-- Since we're using Firebase Auth, we'll rely on application-level security
-- The API will use the service role to access data after verifying Firebase token

-- For users table
CREATE POLICY "Enable read access for authenticated requests" ON users
  FOR SELECT
  USING (true);  -- We'll filter by ID in the application

CREATE POLICY "Enable insert for authenticated requests" ON users
  FOR INSERT
  WITH CHECK (true);  -- Application ensures correct user creation

CREATE POLICY "Enable update for authenticated requests" ON users
  FOR UPDATE
  USING (true);  -- Application ensures users can only update their own profile

-- For question_attempts table
CREATE POLICY "Enable read access for authenticated requests" ON question_attempts
  FOR SELECT
  USING (true);  -- Application filters by student_id

CREATE POLICY "Enable insert for authenticated requests" ON question_attempts
  FOR INSERT
  WITH CHECK (true);  -- Application ensures correct student_id

-- STEP 3: Create a more secure approach using custom claims (optional, for future)
-- You could create a function that verifies Firebase tokens and sets a local role
-- For now, we're using application-level security with the service role

-- Note: In production, you might want to:
-- 1. Create a PostgreSQL function to verify Firebase JWTs
-- 2. Use that function in RLS policies
-- 3. Or use Supabase Edge Functions to proxy requests with proper auth