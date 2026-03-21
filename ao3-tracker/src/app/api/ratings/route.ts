import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/ratings?ao3_id=12345
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ao3Id = searchParams.get('ao3_id')
  if (!ao3Id) return NextResponse.json({ error: 'ao3_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('work_ratings')
    .select('*')
    .eq('ao3_id', ao3Id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
