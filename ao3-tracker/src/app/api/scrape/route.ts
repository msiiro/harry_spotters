import { NextRequest, NextResponse } from 'next/server'

const SCRAPER_URL = process.env.SCRAPER_URL        // e.g. https://ao3-scraper.onrender.com
const SCRAPER_SECRET = process.env.SCRAPER_SECRET  // shared secret

export async function POST(req: NextRequest) {
  if (!SCRAPER_URL) {
    return NextResponse.json(
      { error: 'SCRAPER_URL is not configured. Add it to your Vercel environment variables.' },
      { status: 503 }
    )
  }

  const { url } = await req.json()

  if (!url || !url.includes('archiveofourown.org')) {
    return NextResponse.json({ error: 'Please provide a valid AO3 URL' }, { status: 400 })
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (SCRAPER_SECRET) headers['Authorization'] = `Bearer ${SCRAPER_SECRET}`

    const res = await fetch(`${SCRAPER_URL}/scrape`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(30_000),
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail || 'Scraper service returned an error' },
        { status: res.status }
      )
    }

    return NextResponse.json(data)
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Request timed out — AO3 may be slow. Try again in a moment.' },
        { status: 504 }
      )
    }
    return NextResponse.json({ error: 'Failed to reach scraper service' }, { status: 502 })
  }
}
