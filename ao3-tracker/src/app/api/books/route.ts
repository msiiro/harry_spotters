import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase(req: NextRequest) {
  // Use the user's auth token so RLS policies apply correctly
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}
  )
}

// GET /api/books - list books, optional ?status=&search=&user_id=
export async function GET(req: NextRequest) {
  const supabase = getSupabase(req)
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const userId = searchParams.get('user_id')

  let query = supabase
    .from('books')
    .select('*, profiles(username, display_name, avatar_color)')
    .order('created_at', { ascending: false })

  if (status && status !== 'all') query = query.eq('reading_status', status)
  if (search) query = query.ilike('title', `%${search}%`)
  if (userId) query = query.eq('user_id', userId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/books - create entry (must be authenticated)
export async function POST(req: NextRequest) {
  const supabase = getSupabase(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await supabase
    .from('books')
    .insert([{ ...body, user_id: user.id }])
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
