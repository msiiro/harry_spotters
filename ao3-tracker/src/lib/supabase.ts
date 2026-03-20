import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export type ReadingStatus = 'want_to_read' | 'reading' | 'finished' | 'dropped'

export interface Book {
  id: string
  created_at: string
  updated_at: string
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
  // Personal
  your_rating: number | null
  your_tags: string[] | null
  date_read: string | null
  reading_status: ReadingStatus
  notes: string | null
  recommended_by: string | null
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
}
