-- Mini-3Dgame social/profile backend
-- Run on a dedicated Supabase project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  player_id text not null unique check (player_id ~ '^[0-9]{8}$'),
  display_name text not null default 'Player' check (char_length(display_name) between 1 and 32),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.generate_player_id()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  loop
    candidate := floor(random() * 90000000 + 10000000)::bigint::text;
    exit when not exists (
      select 1 from public.profiles where player_id = candidate
    );
  end loop;
  return candidate;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id,player_id,display_name,avatar_url)
  values (
    new.id,
    public.generate_player_id(),
    left(coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name','Player'),32),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.keep_player_id_immutable()
returns trigger
language plpgsql
as $$
begin
  new.player_id := old.player_id;
  new.id := old.id;
  return new;
end;
$$;

drop trigger if exists keep_player_id_immutable on public.profiles;
create trigger keep_player_id_immutable
before update on public.profiles
for each row execute function public.keep_player_id_immutable();

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (sender_id <> receiver_id)
);

create unique index if not exists friend_requests_one_pending_pair
on public.friend_requests (
  least(sender_id,receiver_id),
  greatest(sender_id,receiver_id)
)
where status = 'pending';

create table if not exists public.friendships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id,friend_id),
  check (user_id <> friend_id)
);

create table if not exists public.match_invites (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  room_code text not null check (room_code ~ '^[0-9]{6}$'),
  status text not null default 'pending' check (status in ('pending','accepted','rejected','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  responded_at timestamptz,
  check (sender_id <> receiver_id)
);

alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.match_invites enable row level security;

drop policy if exists "profiles readable by authenticated users" on public.profiles;
create policy "profiles readable by authenticated users"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "profile owner can update profile" on public.profiles;
create policy "profile owner can update profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "friend requests visible to participants" on public.friend_requests;
create policy "friend requests visible to participants"
on public.friend_requests for select
to authenticated
using (auth.uid() in (sender_id,receiver_id));

drop policy if exists "friendships visible to owner" on public.friendships;
create policy "friendships visible to owner"
on public.friendships for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "match invites visible to participants" on public.match_invites;
create policy "match invites visible to participants"
on public.match_invites for select
to authenticated
using (auth.uid() in (sender_id,receiver_id));

create or replace function public.send_friend_request(target_player_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  target uuid;
  request_id uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;

  select id into target from public.profiles where player_id = target_player_id;
  if target is null then raise exception 'Player ID not found'; end if;
  if target = me then raise exception 'Cannot add yourself'; end if;

  if exists (
    select 1 from public.friendships
    where user_id = me and friend_id = target
  ) then
    raise exception 'Already friends';
  end if;

  if exists (
    select 1 from public.friend_requests
    where status='pending'
      and least(sender_id,receiver_id)=least(me,target)
      and greatest(sender_id,receiver_id)=greatest(me,target)
  ) then
    raise exception 'Request already pending';
  end if;

  insert into public.friend_requests(sender_id,receiver_id)
  values(me,target)
  returning id into request_id;

  return request_id;
end;
$$;

create or replace function public.respond_friend_request(
  request_id uuid,
  accept_request boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.friend_requests%rowtype;
begin
  select * into req
  from public.friend_requests
  where id=request_id
  for update;

  if req.id is null then raise exception 'Request not found'; end if;
  if req.receiver_id <> auth.uid() then raise exception 'Not allowed'; end if;
  if req.status <> 'pending' then raise exception 'Request already handled'; end if;

  if accept_request then
    update public.friend_requests
    set status='accepted',responded_at=now()
    where id=request_id;

    insert into public.friendships(user_id,friend_id)
    values(req.sender_id,req.receiver_id),(req.receiver_id,req.sender_id)
    on conflict do nothing;
  else
    update public.friend_requests
    set status='rejected',responded_at=now()
    where id=request_id;
  end if;
end;
$$;

create or replace function public.send_match_invite(target_friend_id uuid)
returns table(invite_id uuid,room_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  code text;
begin
  if me is null then raise exception 'Not signed in'; end if;

  if not exists (
    select 1 from public.friendships
    where user_id=me and friend_id=target_friend_id
  ) then
    raise exception 'Player is not your friend';
  end if;

  code := lpad(floor(random()*1000000)::bigint::text,6,'0');

  return query
  insert into public.match_invites(sender_id,receiver_id,room_code)
  values(me,target_friend_id,code)
  returning id,public.match_invites.room_code;
end;
$$;

create or replace function public.respond_match_invite(
  invite_id uuid,
  accept_invite boolean
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.match_invites%rowtype;
begin
  select * into inv
  from public.match_invites
  where id=invite_id
  for update;

  if inv.id is null then raise exception 'Invite not found'; end if;
  if inv.receiver_id <> auth.uid() then raise exception 'Not allowed'; end if;
  if inv.status <> 'pending' then raise exception 'Invite already handled'; end if;
  if inv.expires_at < now() then
    update public.match_invites set status='expired' where id=invite_id;
    raise exception 'Invite expired';
  end if;

  update public.match_invites
  set status=case when accept_invite then 'accepted' else 'rejected' end,
      responded_at=now()
  where id=invite_id;

  if accept_invite then return inv.room_code; end if;
  return null;
end;
$$;

revoke all on function public.send_friend_request(text) from public;
revoke all on function public.respond_friend_request(uuid,boolean) from public;
revoke all on function public.send_match_invite(uuid) from public;
revoke all on function public.respond_match_invite(uuid,boolean) from public;

grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.respond_friend_request(uuid,boolean) to authenticated;
grant execute on function public.send_match_invite(uuid) to authenticated;
grant execute on function public.respond_match_invite(uuid,boolean) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='friend_requests'
  ) then
    alter publication supabase_realtime add table public.friend_requests;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='match_invites'
  ) then
    alter publication supabase_realtime add table public.match_invites;
  end if;
end $$;


-- Security + performance hardening
alter function public.keep_player_id_immutable() set search_path = public;

revoke execute on function public.generate_player_id() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

revoke execute on function public.send_friend_request(text) from anon;
revoke execute on function public.respond_friend_request(uuid,boolean) from anon;
revoke execute on function public.send_match_invite(uuid) from anon;
revoke execute on function public.respond_match_invite(uuid,boolean) from anon;

create index if not exists friend_requests_sender_idx on public.friend_requests(sender_id);
create index if not exists friend_requests_receiver_idx on public.friend_requests(receiver_id);
create index if not exists friendships_friend_idx on public.friendships(friend_id);
create index if not exists match_invites_sender_idx on public.match_invites(sender_id);
create index if not exists match_invites_receiver_idx on public.match_invites(receiver_id);

drop policy if exists "profile owner can update profile" on public.profiles;
create policy "profile owner can update profile"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists "friend requests visible to participants" on public.friend_requests;
create policy "friend requests visible to participants"
on public.friend_requests for select
to authenticated
using ((select auth.uid()) in (sender_id,receiver_id));

drop policy if exists "friendships visible to owner" on public.friendships;
create policy "friendships visible to owner"
on public.friendships for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "match invites visible to participants" on public.match_invites;
create policy "match invites visible to participants"
on public.match_invites for select
to authenticated
using ((select auth.uid()) in (sender_id,receiver_id));
