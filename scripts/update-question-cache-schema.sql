-- Add mood column to question_cache table
ALTER TABLE question_cache ADD COLUMN IF NOT EXISTS mood TEXT;

-- Update the lookup index to include mood
DROP INDEX IF EXISTS idx_question_cache_lookup;
CREATE INDEX idx_question_cache_lookup ON question_cache(topic, grade, difficulty, mood);

-- Create index for permanent questions
CREATE INDEX IF NOT EXISTS idx_question_cache_permanent ON question_cache(topic, grade, difficulty, mood)
WHERE expires_at IS NULL;

-- Add question_hash for deduplication
ALTER TABLE question_cache ADD COLUMN IF NOT EXISTS question_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_question_cache_hash ON question_cache(question_hash);

-- Update expires_at default to null for permanent storage
ALTER TABLE question_cache ALTER COLUMN expires_at DROP DEFAULT;