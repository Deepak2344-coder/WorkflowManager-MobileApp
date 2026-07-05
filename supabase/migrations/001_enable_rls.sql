-- Enable RLS on all tables
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE update_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_requests ENABLE ROW LEVEL SECURITY;

-- Helper: check team membership
CREATE OR REPLACE FUNCTION public.is_team_member(check_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members WHERE team_id = check_team_id AND member_id = auth.uid()
  );
$$;

-- ── members ──
CREATE POLICY "members_select_own" ON members FOR SELECT USING (id = auth.uid());
CREATE POLICY "members_insert_own" ON members FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "members_update_own" ON members FOR UPDATE USING (id = auth.uid());
CREATE POLICY "members_delete_own" ON members FOR DELETE USING (id = auth.uid());

-- ── teams ──
CREATE POLICY "teams_select_all" ON teams FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "teams_insert_admin" ON teams FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ── team_members ──
CREATE POLICY "team_members_select_own_teams" ON team_members FOR SELECT USING (
  team_id IN (SELECT team_id FROM team_members WHERE member_id = auth.uid())
  OR member_id = auth.uid()
);
CREATE POLICY "team_members_insert_join" ON team_members FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "team_members_delete_own" ON team_members FOR DELETE USING (member_id = auth.uid());

-- ── tasks ──
CREATE POLICY "tasks_select_all" ON tasks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "tasks_insert_team_member" ON tasks FOR INSERT WITH CHECK (
  is_team_member(assigned_team_id)
);
CREATE POLICY "tasks_update_team_member" ON tasks FOR UPDATE USING (
  is_team_member(assigned_team_id)
);
CREATE POLICY "tasks_delete_own" ON tasks FOR DELETE USING (created_by = auth.uid());

-- ── task_assignees ──
CREATE POLICY "task_assignees_select" ON task_assignees FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "task_assignees_insert" ON task_assignees FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ── task_updates ──
CREATE POLICY "task_updates_select_team" ON task_updates FOR SELECT USING (
  is_team_member(team_id)
);
CREATE POLICY "task_updates_insert_team" ON task_updates FOR INSERT WITH CHECK (
  is_team_member(team_id)
);
CREATE POLICY "task_updates_delete_own" ON task_updates FOR DELETE USING (posted_by = auth.uid());

-- ── notices ──
CREATE POLICY "notices_select_all" ON notices FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "notices_insert_all" ON notices FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "notices_delete_own" ON notices FOR DELETE USING (created_by = auth.uid());

-- ── notice_views ──
CREATE POLICY "notice_views_select_own" ON notice_views FOR SELECT USING (member_id = auth.uid());
CREATE POLICY "notice_views_insert_own" ON notice_views FOR INSERT WITH CHECK (member_id = auth.uid());

-- ── task_views ──
CREATE POLICY "task_views_select_own" ON task_views FOR SELECT USING (member_id = auth.uid());
CREATE POLICY "task_views_insert_own" ON task_views FOR INSERT WITH CHECK (member_id = auth.uid());

-- ── update_views ──
CREATE POLICY "update_views_select_own" ON update_views FOR SELECT USING (member_id = auth.uid());
CREATE POLICY "update_views_insert_own" ON update_views FOR INSERT WITH CHECK (member_id = auth.uid());

-- ── push_tokens ──
CREATE POLICY "push_tokens_select_own" ON push_tokens FOR SELECT USING (member_id = auth.uid());
CREATE POLICY "push_tokens_insert_own" ON push_tokens FOR INSERT WITH CHECK (member_id = auth.uid());
CREATE POLICY "push_tokens_update_own" ON push_tokens FOR UPDATE USING (member_id = auth.uid());

-- ── join_requests ──
CREATE POLICY "join_requests_select_own" ON join_requests FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "join_requests_insert_own" ON join_requests FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "join_requests_delete_own" ON join_requests FOR DELETE USING (user_id = auth.uid());

-- ── team_requests ──
CREATE POLICY "team_requests_select_own" ON team_requests FOR SELECT USING (requested_by = auth.uid());
CREATE POLICY "team_requests_insert_own" ON team_requests FOR INSERT WITH CHECK (requested_by = auth.uid());
