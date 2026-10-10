-- Suspended and banned members may not bypass community controls by editing existing rows.
begin;

drop policy if exists community_posts_update on public.community_posts;
create policy community_posts_update on public.community_posts
for update to authenticated
using ((author_id = auth.uid() and public.community_can_view(auth.uid())) or public.is_admin())
with check ((author_id = auth.uid() and public.community_can_view(auth.uid())) or public.is_admin());

drop policy if exists community_posts_delete on public.community_posts;
create policy community_posts_delete on public.community_posts
for delete to authenticated
using ((author_id = auth.uid() and public.community_can_view(auth.uid())) or public.is_admin());

drop policy if exists community_comments_update on public.community_comments;
create policy community_comments_update on public.community_comments
for update to authenticated
using ((author_id = auth.uid() and public.community_can_view(auth.uid())) or public.is_admin())
with check ((author_id = auth.uid() and public.community_can_view(auth.uid())) or public.is_admin());

drop policy if exists community_comments_delete on public.community_comments;
create policy community_comments_delete on public.community_comments
for delete to authenticated
using ((author_id = auth.uid() and public.community_can_view(auth.uid())) or public.is_admin());

drop policy if exists community_reactions_delete on public.community_reactions;
create policy community_reactions_delete on public.community_reactions
for delete to authenticated
using ((user_id = auth.uid() and public.community_can_view(auth.uid())) or public.is_admin());

commit;
