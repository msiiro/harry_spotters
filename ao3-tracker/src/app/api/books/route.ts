import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/books - list all books, optional ?status=finished&search=keyword
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')

  let query = supabase.from('books').select('*').order('created_at', { ascending: false })

  if (status && status !== 'all') query = query.eq('reading_status', status)
  if (search) query = query.ilike('title', `%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/books - create a new book entry
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { data, error } = await supabase.from('books').insert([body]).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
