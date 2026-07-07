-- Add admin_id to teams
ALTER TABLE teams ADD COLUMN admin_id UUID REFERENCES members(id);

-- Set first member as admin for existing teams
UPDATE teams t SET admin_id = (
  SELECT member_id FROM team_members tm WHERE tm.team_id = t.id LIMIT 1
);

-- RLS: allow admin to update team (transfer admin privileges)
CREATE POLICY "teams_update_admin" ON teams FOR UPDATE
  USING (admin_id = auth.uid());

-- RLS: allow admin to delete any member from their team
CREATE POLICY "team_members_delete_admin" ON team_members FOR DELETE USING (
  EXISTS (SELECT 1 FROM teams WHERE id = team_id AND admin_id = auth.uid())
);
