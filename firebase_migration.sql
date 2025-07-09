-- Update users table to accept Firebase UIDs (string format instead of UUID)
-- Run this in Supabase SQL Editor

-- STEP 1: Drop all RLS policies first
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can view own attempts" ON question_attempts;
DROP POLICY IF EXISTS "Users can insert own attempts" ON question_attempts;

-- STEP 2: Drop the foreign key constraint
ALTER TABLE question_attempts 
DROP CONSTRAINT IF EXISTS question_attempts_student_id_fkey;

-- STEP 3: Alter column types from UUID to TEXT
ALTER TABLE users 
ALTER COLUMN id TYPE TEXT USING id::TEXT;

ALTER TABLE question_attempts 
ALTER COLUMN student_id TYPE TEXT USING student_id::TEXT;

-- Also update the id column in question_attempts to TEXT (for consistency)
ALTER TABLE question_attempts 
ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- STEP 4: Re-add the foreign key constraint
ALTER TABLE question_attempts 
ADD CONSTRAINT question_attempts_student_id_fkey 
FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;

-- STEP 5: Recreate RLS policies (these will work with Firebase Auth)
-- For now, we'll create simple policies that allow users to manage their own data
-- Note: Since we're using Firebase Auth, auth.uid() won't work anymore
-- We'll need to pass the Firebase UID from the application

-- Re-enable RLS after running this script
-- Then create new policies based on your needs