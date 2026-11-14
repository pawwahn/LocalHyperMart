ALTER TABLE diagnostics_branches
    ADD COLUMN IF NOT EXISTS blocked_slots_by_date TEXT NOT NULL DEFAULT '{}';
