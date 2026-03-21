import * as cheerio from 'cheerio'
import type { ScrapedWork } from './supabase'

function extractWorkId(url: string): string | null {
  const match = url.match(/\/works\/(\d+)/)
  return match ? match[1] : null
}

function parseNumber(s: string | undefined): number | null {
  if (!s) return null
  const n = parseInt(s.replace(/,/g, ''), 10)
  return isNaN(n) ? null : n
}

function parseDate(s: string | undefined): string | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]
}

export async function scrapeAO3Work(inputUrl: string): Promise<ScrapedWork> {
  const workId = extractWorkId(inputUrl)
  if (!workId) throw new Error('Could not extract work ID from URL')

  // Always fetch from the canonical work URL (no chapter), with adult bypass
  const fetchUrl = `https://archiveofourown.org/works/${workId}?view_adult=true`

  const res = await fetch(fetchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AO3BookTracker/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    next: { revalidate: 0 }
  })

  if (!res.ok) {
    throw new Error(`AO3 returned ${res.status}. The work may be locked or require login.`)
  }

  const html = await res.text()
  const $ = cheerio.load(html)

  // Title & Author
  const title = $('h2.title.heading').text().trim() || 'Unknown Title'
  const author = $('h3.byline.heading a').map((_, el) => $(el).text().trim()).get().join(', ') || 'Anonymous'

  // Tags block helper
  const getTagList = (className: string): string[] =>
    $(`.${className} .tags .tag`).map((_, el) => $(el).text().trim()).get()

  const fandom = getTagList('fandoms')
  const warnings = getTagList('warnings')
  const categories = getTagList('categories')
  const characters = getTagList('characters')
  const relationships = getTagList('relationships')
  const additional_tags = getTagList('freeforms')

  // Rating
  const ao3_rating = $('.rating .tag').first().text().trim() || 'Not Rated'

  // Summary
  const summary = $('.summary.module blockquote').text().trim()

  // Stats
  const wordCountRaw = $('dd.words').text().trim()
  const word_count = parseNumber(wordCountRaw)

  const chaptersRaw = $('dd.chapters').text().trim()
  const chapter_count = chaptersRaw || '?'

  // Status from chapters (if chapters = x/x → Complete, else In Progress)
  const parts = chaptersRaw.split('/')
  const status = parts.length === 2 && parts[0] === parts[1] ? 'Complete' : 'In Progress'

  const language = $('dd.language').text().trim() || 'English'
  const published_date = parseDate($('dd.published').text().trim())
  const updated_date = parseDate($('dd.status').text().trim())

  const kudos = parseNumber($('dd.kudos').text().trim())
  const bookmarks = parseNumber($('dd.bookmarks').text().trim())
  const hits = parseNumber($('dd.hits').text().trim())

  return {
    ao3_id: workId,
    ao3_url: `https://archiveofourown.org/works/${workId}`,
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
  }
}
