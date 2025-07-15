-- Add column to track answered questions per user
ALTER TABLE users ADD COLUMN IF NOT EXISTS answered_question_hashes TEXT[] DEFAULT '{}';

-- Create GIN index for efficient array searches
CREATE INDEX IF NOT EXISTS idx_users_answered_questions ON users USING GIN(answered_question_hashes);

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'answered_question_hashes';