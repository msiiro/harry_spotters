import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

// AO3 HTML scraper — parses the work page directly, no Python service needed.
// Covers everything visible on the page: title, author, fandom, tags, stats, summary.

function extractWorkId(url: string): string | null {
  const match = url.match(/\/works\/(\d+)/)
  return match ? match[1] : null
}

function parseNumber(text: string | undefined): number | null {
  if (!text) return null
  const cleaned = text.replace(/,/g, '').trim()
  const n = parseInt(cleaned, 10)
  return isNaN(n) ? null : n
}

function parseDate(text: string | undefined): string | null {
  if (!text) return null
  // AO3 dates are in "DD Mon YYYY" format e.g. "15 Jan 2024"
  const d = new Date(text.trim())
  if (isNaN(d.getTime())) return null
  return d.toISOString().split('T')[0] // YYYY-MM-DD
}

export async function POST(request: Request) {
  const body = await request.json()
  const { url } = body

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  const workId = extractWorkId(url)
  if (!workId) {
    return NextResponse.json({ error: 'Could not extract work ID from URL' }, { status: 400 })
  }

  // Fetch the AO3 page — use the ?view_adult=true param to bypass content warnings
  const ao3Url = `https://archiveofourown.org/works/${workId}?view_adult=true`

  let html: string
  try {
    const res = await fetch(ao3Url, {
      headers: {
        // Polite user-agent
        'User-Agent': 'Mozilla/5.0 (compatible; FicShelf/1.0; reading tracker)',
        'Accept': 'text/html',
      },
      // 15 second timeout
      signal: AbortSignal.timeout(15000),
    })

    if (res.status === 429) {
      return NextResponse.json({ error: 'AO3 is rate limiting requests. Please wait a moment and try again.' }, { status: 429 })
    }
    if (res.status === 404) {
      return NextResponse.json({ error: 'Work not found. Check the URL and try again.' }, { status: 404 })
    }
    if (!res.ok) {
      return NextResponse.json({ error: `AO3 returned an error (${res.status})` }, { status: 502 })
    }

    html = await res.text()
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError'
    return NextResponse.json(
      { error: isTimeout ? 'Request timed out — AO3 may be slow, please try again' : 'Failed to reach AO3' },
      { status: 502 }
    )
  }

  const $ = cheerio.load(html)

  // ── Detect login wall / age gate ──────────────────────────────────────
  if ($('form#login-form').length || $('[name="authenticity_token"]').filter((_, el) => $(el).closest('form#login').length > 0).length) {
    return NextResponse.json({ error: 'This work requires an AO3 login to view.' }, { status: 403 })
  }

  // ── Title ─────────────────────────────────────────────────────────────
  const title = $('h2.title.heading').first().text().trim()
  if (!title) {
    return NextResponse.json({ error: 'Could not parse this page — it may require an AO3 login.' }, { status: 422 })
  }

  // ── Author ────────────────────────────────────────────────────────────
  const authors: string[] = []
  $('h3.byline.heading a[rel="author"]').each((_, el) => {
    authors.push($(el).text().trim())
  })
  // Fallback: anonymous works
  if (authors.length === 0) {
    const byline = $('h3.byline.heading').text().trim()
    authors.push(byline || 'Anonymous')
  }
  const author = authors.join(', ')

  // ── Summary ───────────────────────────────────────────────────────────
  const summary = $('div.summary.module blockquote.userstuff').text().trim() || null

  // ── Tag helper ────────────────────────────────────────────────────────
  const getTags = (selector: string): string[] => {
    const tags: string[] = []
    $(selector).each((_, el) => { tags.push($(el).text().trim()) })
    return tags
  }

  // ── Fandom ────────────────────────────────────────────────────────────
  const fandom = getTags('dd.fandom.tags a.tag')

  // ── Rating ────────────────────────────────────────────────────────────
  const ao3_rating = $('dd.rating.tags a.tag').first().text().trim() || 'Not Rated'

  // ── Warnings ─────────────────────────────────────────────────────────
  const warnings = getTags('dd.warning.tags a.tag')

  // ── Categories ───────────────────────────────────────────────────────
  const categories = getTags('dd.category.tags a.tag')

  // ── Characters ───────────────────────────────────────────────────────
  const characters = getTags('dd.character.tags a.tag')

  // ── Relationships ─────────────────────────────────────────────────────
  const relationships = getTags('dd.relationship.tags a.tag')

  // ── Additional tags ───────────────────────────────────────────────────
  const additional_tags = getTags('dd.freeform.tags a.tag')

  // ── Language ─────────────────────────────────────────────────────────
  const language = $('dd.language').first().text().trim() || 'English'

  // ── Stats ─────────────────────────────────────────────────────────────
  const word_count     = parseNumber($('dd.words').first().text())
  const kudos          = parseNumber($('dd.kudos a, dd.kudos').first().text())
  const hits           = parseNumber($('dd.hits').first().text())
  const bookmarks      = parseNumber($('dd.bookmarks a, dd.bookmarks').first().text())
  const comments       = parseNumber($('dd.comments a, dd.comments').first().text())

  // ── Chapter count ─────────────────────────────────────────────────────
  // Format: "current/total" e.g. "12/?" or "5/5"
  const chaptersRaw = $('dd.chapters a, dd.chapters').first().text().trim()
  const chapter_count = chaptersRaw || null

  // ── Completion status ─────────────────────────────────────────────────
  // If chapters match (e.g. "5/5") or the status tag says Complete
  const statusTag = $('dt.status').next('dd').text().trim()
  const isComplete = statusTag === 'Completed' ||
    (chaptersRaw.includes('/') && chaptersRaw.split('/')[0] === chaptersRaw.split('/')[1])
  const status = isComplete ? 'Complete' : 'In Progress'

  // ── Dates ─────────────────────────────────────────────────────────────
  const published_date = parseDate($('dd.published').first().text())
  const updated_date   = parseDate($('dd.status').first().text()) // "status" dd holds last updated date

  return NextResponse.json({
    ao3_id:          workId,
    ao3_url:         `https://archiveofourown.org/works/${workId}`,
    title,
    author,
    fandom,
    ao3_rating,
    warnings,
    categories,
    characters,
    relationships,
    additional_tags,
    summary,
    word_count,
    chapter_count,
    status,
    language,
    published_date,
    updated_date,
    kudos,
    bookmarks,
    hits,
    comments,
  })
}