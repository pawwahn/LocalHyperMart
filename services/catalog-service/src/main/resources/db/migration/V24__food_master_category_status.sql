-- V22 seeded the system food bucket with PAUSED, which is not a valid CatalogItemStatus (ACTIVE/INACTIVE).
UPDATE categories
SET status = 'INACTIVE'
WHERE id = 'f0c00000-0000-4000-8000-000000000099'::uuid
   OR status = 'PAUSED';