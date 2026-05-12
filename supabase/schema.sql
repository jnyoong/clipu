-- Clipu MVP Schema
-- Run this in Supabase SQL Editor

-- links 테이블
create table public.links (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  url         text not null,
  title       text,
  description text,
  image_url   text,
  created_at  timestamptz not null default now()
);

-- RLS 활성화
alter table public.links enable row level security;

-- ============================================================
-- join_collection RPC 함수 (Supabase SQL Editor에서 실행)
-- 공유 클립 참여 최대 인원: 30명
-- ============================================================
-- create or replace function public.join_collection(code text)
-- returns text
-- language plpgsql
-- security definer
-- as $$
-- declare
--   col_id uuid;
--   member_count int;
-- begin
--   select id into col_id
--     from public.collections
--    where invite_code = code and is_shared = true;
--
--   if col_id is null then
--     return 'not_found';
--   end if;
--
--   select count(*) into member_count
--     from public.collection_members
--    where collection_id = col_id;
--
--   if member_count >= 30 then
--     return 'full';
--   end if;
--
--   insert into public.collection_members (collection_id, user_id, role)
--     values (col_id, auth.uid(), 'member')
--     on conflict do nothing;
--
--   return 'ok';
-- end;
-- $$;

-- 본인 링크만 조회
create policy "select own links"
  on public.links for select
  using (auth.uid() = user_id);

-- 본인 링크만 삽입
create policy "insert own links"
  on public.links for insert
  with check (auth.uid() = user_id);

-- 본인 링크만 삭제
create policy "delete own links"
  on public.links for delete
  using (auth.uid() = user_id);
