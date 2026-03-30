-- One-time migration for existing databases:
-- Convert annotation.created_by / annotation.updated_by from INTEGER FK to VARCHAR(255).

BEGIN;

ALTER TABLE public.annotation
    DROP CONSTRAINT IF EXISTS annotation_created_by_fkey,
    DROP CONSTRAINT IF EXISTS annotation_updated_by_fkey;

ALTER TABLE public.annotation
    ALTER COLUMN created_by TYPE varchar(255) USING created_by::varchar(255),
    ALTER COLUMN updated_by TYPE varchar(255) USING updated_by::varchar(255);

COMMIT;

