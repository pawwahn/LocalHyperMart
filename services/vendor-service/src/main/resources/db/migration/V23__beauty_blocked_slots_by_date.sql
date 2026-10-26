ALTER TABLE beauty_profiles
    ADD COLUMN IF NOT EXISTS blocked_slots_by_date TEXT NOT NULL DEFAULT '{}';

COMMENT ON COLUMN beauty_profiles.blocked_slots_by_date IS
    'JSON map of YYYY-MM-DD to comma-separated slot ids (HHmm). Replaces single-day blocked_slot_date for multi-day blocks.';

UPDATE beauty_profiles
SET blocked_slots_by_date =
    ('{"' || to_char(blocked_slot_date, 'YYYY-MM-DD') || '":"' || replace(blocked_slot_ids, '"', '') || '"}')
WHERE blocked_slot_date IS NOT NULL
  AND blocked_slot_ids IS NOT NULL
  AND blocked_slot_ids <> ''
  AND blocked_slots_by_date = '{}';
