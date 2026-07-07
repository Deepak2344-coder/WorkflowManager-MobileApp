-- Add 'rejected' to tasks status check constraint
ALTER TABLE tasks DROP CONSTRAINT tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (status = ANY (ARRAY['pending', 'in_progress', 'done', 'rejected']));
