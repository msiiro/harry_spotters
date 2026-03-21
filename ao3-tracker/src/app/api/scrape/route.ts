import { NextRequest, NextResponse } from 'next/server'

const SCRAPER_URL = process.env.SCRAPER_URL
const SCRAPER_SECRET = process.env.SCRAPER_SECRET

export async function POST(req: NextRequest) {
  console.log('SCRAPER_URL:', SCRAPER_URL)
  console.log('SCRAPER_SECRET set:', !!SCRAPER_SECRET)

  if (!SCRAPER_URL) {
    return NextResponse.json(
      { error: 'SCRAPER_URL is not configured.' },
      { status: 503 }
    )
  }

  const { url } = await req.json()
  console.log('Attempting to reach:', `${SCRAPER_URL}/scrape`)

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (SCRAPER_SECRET) headers['Authorization'] = `Bearer ${SCRAPER_SECRET}`

    const res = await fetch(`${SCRAPER_URL}/scrape`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(30_000),
    })

    console.log('Railway response status:', res.status)
    const data = await res.json()
    console.log('Railway response:', data)

    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail || 'Scraper error' },
        { status: res.status }
      )
    }

    return NextResponse.json(data)
  } catch (err: unknown) {
    console.error('Fetch error:', err)
    if (err instanceof Error && err.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Request timed out.' }, { status: 504 })
    }
    return NextResponse.json({ error: `Failed to reach scraper: ${err}` }, { status: 502 })
  }
}