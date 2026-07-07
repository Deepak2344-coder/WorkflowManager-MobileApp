-- Allow team admin to update join requests for their team
CREATE POLICY "join_requests_update_admin" ON join_requests FOR UPDATE
  USING (EXISTS (SELECT 1 FROM teams WHERE id = team_id AND admin_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM teams WHERE id = team_id AND admin_id = auth.uid()));
