-- Drop infinite-recursive RLS policy on team_members.
-- The policy team_members_select_own_teams referenced itself in the subquery,
-- causing Postgres to abort with "infinite recursion detected".
-- team_members_select_all (authenticated role) already allows full SELECT,
-- so this policy was redundant and harmful.

DROP POLICY IF EXISTS "team_members_select_own_teams" ON team_members;
