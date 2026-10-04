-- Mini 3D Studio private access layer
-- Owner Player ID: 79829179

create table if not exists public.studio_members (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null check (role in ('developer','builder','tester')),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

alter table public.studio_members enable row level security;
revoke all on table public.studio_members from public, anon, authenticated;

create or replace function public.get_studio_access()
returns table(player_id text,display_name text,role text)
language sql
stable
security definer
set search_path = public
as $$
  select p.player_id,p.display_name,
    case when p.player_id='79829179' then 'owner'
         else coalesce(sm.role,'player') end
  from public.profiles p
  left join public.studio_members sm on sm.user_id=p.id
  where p.id=auth.uid()
  limit 1;
$$;

create or replace function public.set_studio_member(target_player_id text,target_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_player_id text;
  target_user_id uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select p.player_id into caller_player_id from public.profiles p where p.id=auth.uid();
  if caller_player_id<>'79829179' then raise exception 'Owner access required'; end if;
  if target_player_id='79829179' then raise exception 'Owner role cannot be changed'; end if;

  select p.id into target_user_id from public.profiles p where p.player_id=target_player_id;
  if target_user_id is null then raise exception 'Player ID not found'; end if;

  if target_role is null or target_role='player' then
    delete from public.studio_members where user_id=target_user_id;
    return;
  end if;

  if target_role not in ('developer','builder','tester') then raise exception 'Invalid Studio role'; end if;

  insert into public.studio_members(user_id,role,created_by)
  values(target_user_id,target_role,auth.uid())
  on conflict(user_id) do update set role=excluded.role,created_by=excluded.created_by,created_at=now();
end;
$$;

create or replace function public.list_studio_members()
returns table(player_id text,display_name text,role text,created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  caller_player_id text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select p.player_id into caller_player_id from public.profiles p where p.id=auth.uid();
  if caller_player_id<>'79829179' then raise exception 'Owner access required'; end if;

  return query
  select p.player_id,p.display_name,sm.role,sm.created_at
  from public.studio_members sm
  join public.profiles p on p.id=sm.user_id
  order by sm.created_at;
end;
$$;

revoke all on function public.get_studio_access() from public;
revoke all on function public.set_studio_member(text,text) from public;
revoke all on function public.list_studio_members() from public;
revoke execute on function public.get_studio_access() from anon;
revoke execute on function public.set_studio_member(text,text) from anon;
revoke execute on function public.list_studio_members() from anon;
grant execute on function public.get_studio_access() to authenticated;
grant execute on function public.set_studio_member(text,text) to authenticated;
grant execute on function public.list_studio_members() to authenticated;
