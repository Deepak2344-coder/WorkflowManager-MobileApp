ALTER TABLE tasks ADD COLUMN accepted_at timestamptz;
ALTER TABLE tasks ADD COLUMN rejected_by uuid references members(id);
ALTER TABLE tasks ADD COLUMN rejected_at timestamptz;
