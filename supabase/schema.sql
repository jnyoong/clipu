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
