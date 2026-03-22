import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export type ReadingStatus = 'want_to_read' | 'reading' | 'finished' | 'dropped'

export interface Profile {
  id: string
  created_at: string
  username: string
  display_name: string | null
  avatar_color: string
}

export interface Book {
  id: string
  created_at: string
  updated_at: string
  user_id: string | null
  // AO3 scraped
  ao3_id: string
  ao3_url: string
  title: string
  author: string | null
  fandom: string[] | null
  ao3_rating: string | null
  warnings: string[] | null
  categories: string[] | null
  characters: string[] | null
  relationships: string[] | null
  additional_tags: string[] | null
  summary: string | null
  word_count: number | null
  chapter_count: string | null
  status: string | null
  language: string | null
  published_date: string | null
  updated_date: string | null
  kudos: number | null
  bookmarks: number | null
  hits: number | null
  comments: number | null
  // Personal
  your_rating: number | null
  your_tags: string[] | null
  date_read: string | null
  date_started: string | null
  reading_status: ReadingStatus
  notes: string | null
  recommended_by: string | null
}

export interface ActivityItem {
  id: string
  created_at: string
  updated_at: string
  ao3_id: string
  ao3_url: string
  title: string
  author: string | null
  fandom: string[] | null
  word_count: number | null
  status: string | null
  reading_status: ReadingStatus
  your_rating: number | null
  user_id: string
  username: string
  display_name: string | null
  avatar_color: string
  activity_type: 'finished' | 'added'
}

export interface WorkRating {
  ao3_id: string
  title: string
  author: string | null
  your_rating: number
  reading_status: ReadingStatus
  date_read: string | null
  notes: string | null
  user_id: string
  username: string
  display_name: string | null
  avatar_color: string
}

export interface ScrapedWork {
  ao3_id: string
  ao3_url: string
  title: string
  author: string
  fandom: string[]
  ao3_rating: string
  warnings: string[]
  categories: string[]
  characters: string[]
  relationships: string[]
  additional_tags: string[]
  summary: string
  word_count: number | null
  chapter_count: string
  status: string
  language: string
  published_date: string | null
  updated_date: string | null
  kudos: number | null
  bookmarks: number | null
  hits: number | null
  comments: number | null
}
