-- Allow team admin to view join requests for their teams
CREATE POLICY "join_requests_select_admin" ON join_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM teams WHERE id = team_id AND admin_id = auth.uid())
);
