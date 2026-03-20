-- AO3 Book Tracker Schema
-- Run this in your Supabase SQL editor

create table if not exists books (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- AO3 metadata (scraped)
  ao3_id text unique not null,
  ao3_url text not null,
  title text not null,
  author text,
  fandom text[],
  ao3_rating text,           -- G, T, M, E, Not Rated
  warnings text[],
  categories text[],         -- F/F, F/M, M/M, etc.
  characters text[],
  relationships text[],
  additional_tags text[],
  summary text,
  word_count integer,
  chapter_count text,        -- e.g. "12/?" or "12/12"
  status text,               -- Complete / In Progress / etc.
  language text,
  published_date date,
  updated_date date,
  kudos integer,
  bookmarks integer,
  hits integer,

  -- Your personal fields
  your_rating integer check (your_rating between 1 and 5),
  your_tags text[],
  date_read date,
  reading_status text default 'want_to_read' check (reading_status in ('want_to_read', 'reading', 'finished', 'dropped')),
  notes text,
  recommended_by text         -- friend who recommended it
);

-- Enable RLS (optional, for multi-user)
-- alter table books enable row level security;

-- Updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger books_updated_at
  before update on books
  for each row execute function update_updated_at();
