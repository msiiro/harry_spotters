import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// POST /api/books/copy
// Body: { source_book_id: string }
// Copies a book's AO3 metadata onto the current user's shelf as "want_to_read".
// Returns 409 if the user already has that work.
export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { source_book_id } = body

  if (!source_book_id) {
    return NextResponse.json({ error: 'source_book_id is required' }, { status: 400 })
  }

  // Fetch the source book
  const { data: source, error: sourceError } = await supabase
    .from('books')
    .select('*')
    .eq('id', source_book_id)
    .single()

  if (sourceError || !source) {
    return NextResponse.json({ error: 'Source book not found' }, { status: 404 })
  }

  if (source.user_id === user.id) {
    return NextResponse.json({ error: 'This book is already on your shelf' }, { status: 400 })
  }

  // Check if the user already has this AO3 work by ao3_id (matches the composite constraint)
  const { data: existing } = await supabase
    .from('books')
    .select('id')
    .eq('user_id', user.id)
    .eq('ao3_id', source.ao3_id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'This work is already on your shelf' }, { status: 409 })
  }

  const { data: newBook, error: insertError } = await supabase
    .from('books')
    .insert({
      user_id:         user.id,
      ao3_id:          source.ao3_id,
      ao3_url:         source.ao3_url,
      title:           source.title,
      author:          source.author,
      fandom:          source.fandom,
      ao3_rating:      source.ao3_rating,
      warnings:        source.warnings,
      categories:      source.categories,
      characters:      source.characters,
      relationships:   source.relationships,
      additional_tags: source.additional_tags,
      summary:         source.summary,
      word_count:      source.word_count,
      chapter_count:   source.chapter_count,
      status:          source.status,
      language:        source.language,
      published_date:  source.published_date,
      updated_date:    source.updated_date,
      kudos:           source.kudos,
      bookmarks:       source.bookmarks,
      hits:            source.hits,
      comments:        source.comments,
      reading_status:  'want_to_read',
      your_rating:     null,
      your_tags:       null,
      date_read:       null,
      notes:           null,
      recommended_by:  null,
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json(newBook, { status: 201 })
}