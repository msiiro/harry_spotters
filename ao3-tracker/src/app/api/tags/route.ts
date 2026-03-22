import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 300

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabase
    .from('books')
    .select('your_tags')
    .not('your_tags', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const tagSet = new Set<string>()
  for (const row of data ?? []) {
    if (Array.isArray(row.your_tags)) {
      row.your_tags.forEach((t: string) => { if (t) tagSet.add(t.trim()) })
    }
  }

  return NextResponse.json(Array.from(tagSet).sort((a, b) => a.localeCompare(b)))
}