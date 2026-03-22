import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const revalidate = 300 // re-fetch at most every 5 minutes

// GET /api/tags
// Returns a sorted list of all unique personal tags used across all books.
// Used to power the TagInput autocomplete.
export async function GET() {
  const { data, error } = await supabase
    .rpc('get_all_tags')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Flatten all tag arrays, deduplicate, sort
  const tagSet = new Set<string>()
  for (const row of data ?? []) {
    if (Array.isArray(row.your_tags)) {
      row.your_tags.forEach((t: string) => { if (t) tagSet.add(t.trim()) })
    }
  }

  const tags = Array.from(tagSet).sort((a, b) => a.localeCompare(b))
  return NextResponse.json(tags)
}