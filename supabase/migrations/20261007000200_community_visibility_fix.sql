-- Published community posts are visible to authenticated members; ownership rules remain unchanged.
begin;

drop policy if exists community_posts_read on public.community_posts;
create policy community_posts_read on public.community_posts
for select to authenticated
using (status = 'PUBLISHED' or public.is_admin());

commit;
