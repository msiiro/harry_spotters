import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

type RouteContext = { params: Promise<{ id: string }> }

// PATCH /api/books/[id] - update personal fields
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  const body = await req.json()
  const { data, error } = await supabase
    .from('books')
    .update(body)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/books/[id]
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  const { error } = await supabase.from('books').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
