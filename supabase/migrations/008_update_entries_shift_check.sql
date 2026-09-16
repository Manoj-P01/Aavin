-- ============================================================
-- 008_update_entries_shift_check.sql
-- Update entries.shift CHECK constraint to allow 'F' (Full Day)
-- ============================================================

-- Drop old check constraint if exists and add updated constraint including 'F'
ALTER TABLE entries DROP CONSTRAINT IF EXISTS entries_shift_check;
ALTER TABLE entries ADD CONSTRAINT entries_shift_check CHECK (shift IN ('D', 'N', 'F') OR shift IS NULL);
