-- ============================================================
-- Migration: Add user layer, social features, activity feed
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Profiles table (extends auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  username text unique not null,
  display_name text,
  avatar_color text default '#8b3a2a'  -- used for avatar placeholder
);

-- Auto-create a profile when a user signs up
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, username, display_name)
  values (
    new.id,
    -- Default username from email prefix
    split_part(new.email, '@', 1),
    split_part(new.email, '@', 1)
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 2. Add user_id to books
alter table books add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Backfill existing rows with a placeholder (they'll be orphaned — fine for now)
-- If you have existing rows you want to keep, assign them to a real user id:
-- update books set user_id = 'your-user-uuid' where user_id is null;

-- 3. Enable Row Level Security
alter table books enable row level security;
alter table profiles enable row level security;

-- Books policies:
-- Anyone can read all books (social shelf)
create policy "books_read_all" on books
  for select using (true);

-- Users can only insert their own books
create policy "books_insert_own" on books
  for insert with check (auth.uid() = user_id);

-- Users can only update their own books
create policy "books_update_own" on books
  for update using (auth.uid() = user_id);

-- Users can only delete their own books
create policy "books_delete_own" on books
  for delete using (auth.uid() = user_id);

-- Profiles policies:
-- Anyone can read profiles
create policy "profiles_read_all" on profiles
  for select using (true);

-- Users can update their own profile
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- 4. Activity feed view (recent adds and completions across all users)
create or replace view activity_feed as
select
  b.id,
  b.created_at,
  b.updated_at,
  b.ao3_id,
  b.ao3_url,
  b.title,
  b.author,
  b.fandom,
  b.word_count,
  b.status,
  b.reading_status,
  b.your_rating,
  b.user_id,
  p.username,
  p.display_name,
  p.avatar_color,
  case
    when b.reading_status = 'finished' then 'finished'
    else 'added'
  end as activity_type
from books b
join profiles p on p.id = b.user_id
order by
  case when b.reading_status = 'finished' then b.updated_at else b.created_at end desc;

-- 5. Ratings comparison view (all user ratings for the same ao3 work)
create or replace view work_ratings as
select
  b.ao3_id,
  b.title,
  b.author,
  b.your_rating,
  b.reading_status,
  b.date_read,
  b.notes,
  b.user_id,
  p.username,
  p.display_name,
  p.avatar_color
from books b
join profiles p on p.id = b.user_id
where b.your_rating is not null
order by b.ao3_id, b.your_rating desc;
