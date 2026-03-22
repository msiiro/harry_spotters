'use client'

import { useState, useRef } from 'react'
import type { Book, ScrapedWork, ReadingStatus } from '@/lib/supabase'
import { authFetch } from '@/lib/api'

interface Props {
  onClose: () => void
  onAdded: (book: Book) => void
}

const STATUS_OPTIONS: { value: ReadingStatus; label: string }[] = [
  { value: 'want_to_read', label: 'Want to Read' },
  { value: 'reading',      label: 'Reading' },
  { value: 'finished',     label: 'Finished' },
  { value: 'dropped',      label: 'Dropped' },
]

const labelStyle: React.CSSProperties = {
  display:       'block',
  fontSize:      11,
  fontFamily:    'JetBrains Mono, monospace',
  letterSpacing: '0.1em',
  color:         'var(--ink-ghost)',
  textTransform: 'uppercase',
  marginBottom:  6,
}

type WorkSource   = 'ao3' | 'epub' | 'custom'
type ScrapeStatus = 'idle' | 'loading' | 'done' | 'error'
type EpubStatus   = 'idle' | 'parsing' | 'done' | 'error'

// ── ePub metadata parsed from OPF ────────────────────────────────────────────
interface EpubMeta {
  title:         string
  author:        string
  description:   string
  language:      string
  publisher:     string
  publishedDate: string
  subjects:      string[]
  identifier:    string
  chapterCount:  number
  wordCount:     number | null
}

// ── Parse an ePub File client-side using JSZip ────────────────────────────────
async function parseEpub(file: File): Promise<EpubMeta> {
  // Dynamic import so JSZip is only loaded when needed
  const JSZip = (await import('jszip')).default

  const zip        = await JSZip.loadAsync(file)
  const parser     = new DOMParser()

  // 1. Find the OPF path via META-INF/container.xml
  const containerXml = await zip.file('META-INF/container.xml')?.async('string')
  if (!containerXml) throw new Error('Not a valid ePub — missing META-INF/container.xml')

  const containerDoc = parser.parseFromString(containerXml, 'application/xml')
  const opfPath = containerDoc
    .querySelector('rootfile')
    ?.getAttribute('full-path')
  if (!opfPath) throw new Error('Could not find OPF path in container.xml')

  // 2. Parse the OPF file
  const opfXml = await zip.file(opfPath)?.async('string')
  if (!opfXml) throw new Error(`Could not read OPF file at ${opfPath}`)

  const opf = parser.parseFromString(opfXml, 'application/xml')

  const getText = (selector: string): string =>
    opf.querySelector(selector)?.textContent?.trim() || ''

  const getAll = (selector: string): string[] => {
    const els = opf.querySelectorAll(selector)
    return Array.from(els).map(el => el.textContent?.trim() || '').filter(Boolean)
  }

  // dc:creator can have multiple — join them
  const authors = getAll('creator')
  // Strip role annotations like " (Author)" that some tools add
  const author  = authors
    .map(a => a.replace(/\s*\(.*?\)\s*$/, '').trim())
    .join(', ') || 'Unknown'

  // dc:description may contain HTML — strip tags
  const rawDesc   = getText('description')
  const descClean = rawDesc.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()

  // dc:date — take the first one; some epubs have multiple
  const dates = getAll('date')
  const publishedDate = dates[0]?.split('T')[0] || ''

  // Subjects → tags
  const subjects = getAll('subject')

  // Identifier (ISBN / UUID)
  const identifier = getText('identifier')

  // Language
  const language = getText('language') || 'English'

  // Publisher
  const publisher = getText('publisher')

  // 3. Count chapters from spine / TOC
  const spineItems = opf.querySelectorAll('spine itemref')
  const chapterCount = spineItems.length

  // 4. Word count — parse content files referenced in spine
  // We sample up to 10 files to estimate; full parse can be slow for large epubs
  const manifest   = opf.querySelector('manifest')
  const opfDir     = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : ''
  let wordCount: number | null = null

  try {
    const spineIds   = Array.from(spineItems).map(el => el.getAttribute('idref')).filter(Boolean)
    const sampleIds  = spineIds.slice(0, Math.min(spineIds.length, 10))

    let sampleWords  = 0
    let sampleCount  = 0

    for (const id of sampleIds) {
      const item = manifest?.querySelector(`item[id="${id}"]`)
      const href = item?.getAttribute('href')
      if (!href) continue

      const fullPath  = opfDir + href
      const content   = await zip.file(fullPath)?.async('string')
      if (!content) continue

      const doc       = parser.parseFromString(content, 'text/html')
      const text      = doc.body?.textContent || ''
      const words     = text.trim().split(/\s+/).filter(w => w.length > 0).length
      sampleWords    += words
      sampleCount++
    }

    if (sampleCount > 0) {
      // Extrapolate from sample to full spine
      const avgPerChapter = sampleWords / sampleCount
      wordCount = Math.round(avgPerChapter * spineIds.length)
    }
  } catch {
    // Word count is best-effort — silently ignore errors
    wordCount = null
  }

  return {
    title: getText('title') || file.name.replace('.epub', ''),
    author,
    description: descClean,
    language,
    publisher,
    publishedDate,
    subjects,
    identifier,
    chapterCount,
    wordCount,
  }
}

export default function AddBookModal({ onClose, onAdded }: Props) {

  // ── Mode ──────────────────────────────────────────────────────────────
  const [source,      setSource]      = useState<WorkSource>('ao3')
  const [formVisible, setFormVisible] = useState(false)

  // ── AO3 scrape ────────────────────────────────────────────────────────
  const [url,          setUrl]          = useState('')
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus>('idle')
  const [scrapeError,  setScrapeError]  = useState<string | null>(null)
  const [rawWork,      setRawWork]      = useState<ScrapedWork | null>(null)
  const [showMetaEdit, setShowMetaEdit] = useState(false)

  // Editable AO3 metadata
  const [metaTitle,         setMetaTitle]         = useState('')
  const [metaAuthor,        setMetaAuthor]        = useState('')
  const [metaSummary,       setMetaSummary]       = useState('')
  const [metaFandom,        setMetaFandom]        = useState('')
  const [metaCharacters,    setMetaCharacters]    = useState('')
  const [metaRelationships, setMetaRelationships] = useState('')
  const [metaWordCount,     setMetaWordCount]     = useState('')
  const [metaStatus,        setMetaStatus]        = useState<'Complete' | 'In Progress'>('Complete')

  // ── ePub ──────────────────────────────────────────────────────────────
  const fileInputRef                        = useRef<HTMLInputElement>(null)
  const [epubStatus,  setEpubStatus]        = useState<EpubStatus>('idle')
  const [epubError,   setEpubError]         = useState<string | null>(null)
  const [epubMeta,    setEpubMeta]          = useState<EpubMeta | null>(null)
  const [epubFileName, setEpubFileName]     = useState('')
  const [showEpubEdit, setShowEpubEdit]     = useState(false)

  // Editable ePub fields (pre-filled from parse, user can override)
  const [epubTitle,     setEpubTitle]     = useState('')
  const [epubAuthor,    setEpubAuthor]    = useState('')
  const [epubSummary,   setEpubSummary]   = useState('')
  const [epubFandom,    setEpubFandom]    = useState('')
  const [epubSubjects,  setEpubSubjects]  = useState('')
  const [epubWordCount, setEpubWordCount] = useState('')
  const [epubLink,      setEpubLink]      = useState('')
  const [epubCompletionStatus, setEpubCompletionStatus] = useState<'Complete' | 'In Progress'>('Complete')

  // ── Custom work fields ────────────────────────────────────────────────
  const [customTitle,     setCustomTitle]     = useState('')
  const [customAuthor,    setCustomAuthor]    = useState('')
  const [customFandom,    setCustomFandom]    = useState('')
  const [customSummary,   setCustomSummary]   = useState('')
  const [customLink,      setCustomLink]      = useState('')
  const [customWordCount, setCustomWordCount] = useState('')
  const [customStatus,    setCustomStatus]    = useState<'Complete' | 'In Progress'>('Complete')

  // ── Personal fields (shared) ──────────────────────────────────────────
  const [yourRating,    setYourRating]    = useState(0)
  const [hoverRating,   setHoverRating]   = useState(0)
  const [yourTagsInput, setYourTagsInput] = useState('')
  const [dateStarted,   setDateStarted]   = useState('')
  const [dateRead,      setDateRead]      = useState('')
  const [readingStatus, setReadingStatus] = useState<ReadingStatus>('want_to_read')
  const [notes,         setNotes]         = useState('')
  const [recommendedBy, setRecommendedBy] = useState('')
  const [saving,        setSaving]        = useState(false)
  const [saveError,     setSaveError]     = useState<string | null>(null)

  // ── Helpers ───────────────────────────────────────────────────────────
  const splitTags = (s: string) => s.split(',').map(t => t.trim()).filter(Boolean)

  const populateMeta = (w: ScrapedWork) => {
    setMetaTitle(w.title || '')
    setMetaAuthor(w.author || '')
    setMetaSummary(w.summary || '')
    setMetaFandom((w.fandom || []).join(', '))
    setMetaCharacters((w.characters || []).join(', '))
    setMetaRelationships((w.relationships || []).join(', '))
    setMetaWordCount(w.word_count ? String(w.word_count) : '')
    setMetaStatus(w.status === 'Complete' ? 'Complete' : 'In Progress')
  }

  const populateEpubFields = (meta: EpubMeta) => {
    setEpubTitle(meta.title)
    setEpubAuthor(meta.author)
    setEpubSummary(meta.description)
    setEpubSubjects(meta.subjects.join(', '))
    setEpubWordCount(meta.wordCount ? String(meta.wordCount) : '')
    // Leave fandom blank — subjects rarely map cleanly to fandom
    setEpubFandom('')
    setEpubCompletionStatus('Complete')
  }

  // ── AO3 fetch ─────────────────────────────────────────────────────────
  const handleFetch = async () => {
    if (!url.trim()) return
    setScrapeError(null)
    setScrapeStatus('loading')
    setFormVisible(true)
    try {
      const res  = await fetch('/api/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
      const data = await res.json()
      if (!res.ok) { setScrapeError(data.error || 'Failed to scrape'); setScrapeStatus('error') }
      else         { setRawWork(data); populateMeta(data); setScrapeStatus('done') }
    } catch {
      setScrapeError('Network error while scraping'); setScrapeStatus('error')
    }
  }

  const resetToUrlEntry = () => {
    setRawWork(null); setScrapeStatus('idle'); setScrapeError(null)
    setFormVisible(false); setShowMetaEdit(false); setUrl('')
  }

  // ── ePub file handler ─────────────────────────────────────────────────
  const handleEpubFile = async (file: File) => {
    if (!file.name.endsWith('.epub')) {
      setEpubError('Please select a .epub file')
      return
    }
    setEpubError(null)
    setEpubStatus('parsing')
    setEpubFileName(file.name)

    try {
      const meta = await parseEpub(file)
      setEpubMeta(meta)
      populateEpubFields(meta)
      setEpubStatus('done')
    } catch (err) {
      setEpubError(err instanceof Error ? err.message : 'Failed to parse ePub')
      setEpubStatus('error')
    }
  }

  const handleEpubDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleEpubFile(file)
  }

  const resetEpub = () => {
    setEpubMeta(null); setEpubStatus('idle'); setEpubError(null)
    setEpubFileName(''); setShowEpubEdit(false)
    setEpubTitle(''); setEpubAuthor(''); setEpubSummary('')
    setEpubFandom(''); setEpubSubjects(''); setEpubWordCount(''); setEpubLink('')
  }

  // ── Save ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    const yourTags = splitTags(yourTagsInput)

    const personalFields = {
      your_rating:    yourRating || null,
      your_tags:      yourTags.length ? yourTags : null,
      date_started:   dateStarted || null,
      date_read:      dateRead || null,
      reading_status: readingStatus,
      notes:          notes || null,
      recommended_by: recommendedBy || null,
    }

    let payload: Record<string, unknown>

    if (source === 'ao3') {
      if (!rawWork) { setSaveError('Still fetching AO3 data — please wait a moment'); setSaving(false); return }
      payload = {
        ...rawWork,
        title:         metaTitle.trim()      || rawWork.title,
        author:        metaAuthor.trim()     || rawWork.author,
        summary:       metaSummary.trim()    || rawWork.summary,
        fandom:        splitTags(metaFandom).length         ? splitTags(metaFandom)         : rawWork.fandom,
        characters:    splitTags(metaCharacters).length     ? splitTags(metaCharacters)     : rawWork.characters,
        relationships: splitTags(metaRelationships).length  ? splitTags(metaRelationships)  : rawWork.relationships,
        word_count:    metaWordCount ? parseInt(metaWordCount, 10) : rawWork.word_count,
        status:        metaStatus,
        ...personalFields,
      }

    } else if (source === 'epub') {
      if (!epubMeta) { setSaveError('Please select an ePub file first'); setSaving(false); return }
      const title = epubTitle.trim() || epubMeta.title
      if (!title) { setSaveError('Title is required'); setSaving(false); return }

      payload = {
        ao3_id:          `epub_${Date.now()}`,
        ao3_url:         epubLink.trim() || null,
        title,
        author:          epubAuthor.trim() || epubMeta.author || null,
        fandom:          splitTags(epubFandom).length ? splitTags(epubFandom) : null,
        summary:         epubSummary.trim() || epubMeta.description || null,
        word_count:      epubWordCount ? parseInt(epubWordCount, 10) : epubMeta.wordCount,
        status:          epubCompletionStatus,
        additional_tags: splitTags(epubSubjects).length ? splitTags(epubSubjects) : null,
        chapter_count:   epubMeta.chapterCount ? String(epubMeta.chapterCount) : null,
        language:        epubMeta.language || null,
        published_date:  epubMeta.publishedDate || null,
        // Fields not available from ePub
        ao3_rating:    null,
        warnings:      null,
        categories:    null,
        characters:    null,
        relationships: null,
        updated_date:  null,
        kudos:         null,
        bookmarks:     null,
        hits:          null,
        comments:      null,
        ...personalFields,
      }

    } else {
      // Custom
      if (!customTitle.trim()) { setSaveError('Title is required'); setSaving(false); return }
      payload = {
        ao3_id:          `custom_${Date.now()}`,
        ao3_url:         customLink.trim() || null,
        title:           customTitle.trim(),
        author:          customAuthor.trim() || null,
        fandom:          customFandom.trim() ? [customFandom.trim()] : null,
        summary:         customSummary.trim() || null,
        word_count:      customWordCount ? parseInt(customWordCount, 10) : null,
        status:          customStatus,
        ao3_rating:      null, warnings: null, categories: null,
        characters:      null, relationships: null, additional_tags: null,
        chapter_count:   null, language: null, published_date: null,
        updated_date:    null, kudos: null, bookmarks: null, hits: null, comments: null,
        ...personalFields,
      }
    }

    try {
      const res  = await authFetch('/api/books', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) setSaveError(data.error || 'Failed to save')
      else onAdded(data)
    } catch {
      setSaveError('Network error while saving')
    } finally {
      setSaving(false)
    }
  }

  const isAo3Form    = source === 'ao3' && formVisible
  const isEpubForm   = source === 'epub'
  const isCustomForm = source === 'custom'
  const showToggle   = !isAo3Form && !isCustomForm && !(isEpubForm && epubStatus === 'done')

  return (
    <div className="modal-backdrop" style={{ background: 'rgba(28, 14, 8, 0.82)' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-sheet" style={{ background: 'var(--surface)', borderRadius: 6, width: '100%', maxWidth: 680, maxHeight: '92vh', overflowY: 'auto', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>

        {/* House-colour bar */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--griffindor-crimson), var(--griffindor-gold), var(--slytherin-emerald))' }} />

        {/* Header */}
        <div style={{ padding: '22px 28px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 className="font-display" style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>Add a Work</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--ink-ghost)', fontSize: 13, fontFamily: 'Crimson Pro, serif' }}>Import from AO3, ePub, or add manually</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-ghost)', padding: '0 4px', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '22px 28px' }}>

          {/* ── Source toggle ── */}
          {showToggle && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 24 }}>
              {([
                { key: 'ao3',    label: '✦ AO3 Link' },
                { key: 'epub',   label: '📖 ePub File' },
                { key: 'custom', label: '✎ Manual Entry' },
              ] as { key: WorkSource; label: string }[]).map(s => (
                <button
                  key={s.key}
                  onClick={() => { setSource(s.key); resetEpub() }}
                  style={{
                    padding: '10px 0', borderRadius: 3,
                    border:     `1px solid ${source === s.key ? 'var(--griffindor-gold)' : 'var(--border)'}`,
                    background: source === s.key ? '#fdf8ee' : 'var(--surface)',
                    color:      source === s.key ? 'var(--ink)' : 'var(--ink-muted)',
                    cursor: 'pointer', fontFamily: 'Cormorant Garamond, serif',
                    fontSize: 15, fontWeight: source === s.key ? 600 : 400, transition: 'all 0.15s',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* ══════════ AO3 — URL entry ══════════ */}
          {source === 'ao3' && !formVisible && (
            <div>
              <label style={labelStyle}>AO3 Work URL</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <input className="input-field" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://archiveofourown.org/works/..." onKeyDown={e => e.key === 'Enter' && handleFetch()} autoFocus />
                <button className="btn-primary" onClick={handleFetch} disabled={!url.trim()} style={{ whiteSpace: 'nowrap' }}>Fetch</button>
              </div>
            </div>
          )}

          {/* ══════════ AO3 — Form ══════════ */}
          {source === 'ao3' && formVisible && (
            <>
              {scrapeStatus === 'loading' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#fdf8ee', border: '1px solid var(--griffindor-gold)', borderRadius: 4, marginBottom: 20 }}>
                  <div style={{ width: 14, height: 14, border: '2px solid var(--griffindor-gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)', fontFamily: 'Crimson Pro, serif' }}>
                    Fetching from AO3… <span style={{ color: 'var(--ink-ghost)' }}>fill in your details below while you wait</span>
                  </p>
                </div>
              )}

              {scrapeStatus === 'error' && (
                <div style={{ padding: '12px 14px', background: '#faeaea', border: '1px solid #e8c0c0', borderRadius: 4, marginBottom: 20 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--griffindor-red)', fontFamily: 'Crimson Pro, serif' }}>⚠ {scrapeError}</p>
                  <button onClick={resetToUrlEntry} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--griffindor-red)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', padding: 0, textDecoration: 'underline' }}>Try a different URL</button>
                </div>
              )}

              {scrapeStatus === 'done' && rawWork && (
                <div style={{ background: 'var(--surface-tinted)', borderRadius: 4, border: '1px solid var(--border)', marginBottom: 20, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <h3 className="font-display" style={{ margin: '0 0 2px', fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{metaTitle || rawWork.title}</h3>
                        <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--ink-muted)', fontStyle: 'italic' }}>by {metaAuthor || rawWork.author}</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                          {splitTags(metaFandom).slice(0, 3).map(f => <span key={f} className="tag-pill fandom">{f}</span>)}
                        </div>
                        <div style={{ display: 'flex', gap: 14 }}>
                          <span className="font-mono" style={{ fontSize: 12, color: 'var(--ink-ghost)' }}>{metaWordCount ? parseInt(metaWordCount).toLocaleString() : rawWork.word_count?.toLocaleString() || '—'} words</span>
                          <span className="font-mono" style={{ fontSize: 12, color: metaStatus === 'Complete' ? 'var(--slytherin-emerald)' : 'var(--griffindor-gold)' }}>{metaStatus}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => setShowMetaEdit(v => !v)} style={{ background: showMetaEdit ? '#fdf8ee' : 'none', border: `1px solid ${showMetaEdit ? 'var(--griffindor-gold)' : 'var(--border)'}`, borderRadius: 3, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: showMetaEdit ? 'var(--griffindor-gold)' : 'var(--ink-ghost)', fontFamily: 'JetBrains Mono, monospace', transition: 'all 0.15s' }}>
                          {showMetaEdit ? '✓ Editing' : '✎ Edit details'}
                        </button>
                        <button onClick={resetToUrlEntry} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 3, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: 'var(--ink-ghost)', fontFamily: 'JetBrains Mono, monospace' }}>Change</button>
                      </div>
                    </div>
                  </div>
                  {showMetaEdit && (
                    <div style={{ padding: '16px', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <p style={{ gridColumn: '1 / -1', margin: '0 0 4px', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--ink-ghost)', letterSpacing: '0.08em' }}>EDIT SCRAPED DETAILS</p>
                      <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Title</label><input className="input-field" value={metaTitle} onChange={e => setMetaTitle(e.target.value)} /></div>
                      <div><label style={labelStyle}>Author</label><input className="input-field" value={metaAuthor} onChange={e => setMetaAuthor(e.target.value)} /></div>
                      <div><label style={labelStyle}>Word Count</label><input className="input-field" value={metaWordCount} onChange={e => setMetaWordCount(e.target.value.replace(/\D/g, ''))} /></div>
                      <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Fandom <span style={{ fontWeight: 400, opacity: 0.7 }}>(comma-separated)</span></label><input className="input-field" value={metaFandom} onChange={e => setMetaFandom(e.target.value)} /></div>
                      <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Characters <span style={{ fontWeight: 400, opacity: 0.7 }}>(comma-separated)</span></label><input className="input-field" value={metaCharacters} onChange={e => setMetaCharacters(e.target.value)} /></div>
                      <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Relationships <span style={{ fontWeight: 400, opacity: 0.7 }}>(comma-separated)</span></label><input className="input-field" value={metaRelationships} onChange={e => setMetaRelationships(e.target.value)} /></div>
                      <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Summary</label><textarea className="input-field" value={metaSummary} onChange={e => setMetaSummary(e.target.value)} rows={3} style={{ resize: 'vertical' }} /></div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={labelStyle}>Completion</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {(['Complete', 'In Progress'] as const).map(s => (
                            <button key={s} onClick={() => setMetaStatus(s)} style={{ padding: '6px 16px', borderRadius: 3, border: `1px solid ${metaStatus === s ? 'var(--griffindor-gold)' : 'var(--border)'}`, background: metaStatus === s ? '#fdf8ee' : 'var(--surface)', color: metaStatus === s ? 'var(--ink)' : 'var(--ink-muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', transition: 'all 0.15s' }}>{s}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <PersonalFields readingStatus={readingStatus} setReadingStatus={setReadingStatus} yourRating={yourRating} setYourRating={setYourRating} hoverRating={hoverRating} setHoverRating={setHoverRating} dateStarted={dateStarted} setDateStarted={setDateStarted} dateRead={dateRead} setDateRead={setDateRead} recommendedBy={recommendedBy} setRecommendedBy={setRecommendedBy} yourTagsInput={yourTagsInput} setYourTagsInput={setYourTagsInput} notes={notes} setNotes={setNotes} />
              {saveError && <p style={{ color: 'var(--griffindor-red)', fontSize: 13, marginTop: 12 }}>⚠ {saveError}</p>}
              <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
                <button className="btn-ghost" onClick={onClose}>Cancel</button>
                <button className="btn-primary" onClick={handleSave} disabled={saving || scrapeStatus === 'loading'}>
                  {saving ? 'Saving…' : scrapeStatus === 'loading' ? 'Fetching…' : 'Add to Shelf'}
                </button>
              </div>
            </>
          )}

          {/* ══════════ EPUB MODE ══════════ */}
          {source === 'epub' && (
            <>
              {/* Back link */}
              {epubStatus !== 'done' && (
                <button onClick={() => { setSource('ao3'); resetEpub() }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--griffindor-gold)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', padding: '0 0 16px', textDecoration: 'underline', letterSpacing: '0.06em', display: 'block' }}>
                  ← Back
                </button>
              )}

              {/* Drop zone / file picker */}
              {epubStatus === 'idle' || epubStatus === 'error' ? (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".epub"
                    style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleEpubFile(f) }}
                  />
                  <div
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleEpubDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed var(--border-warm)',
                      borderRadius: 6,
                      padding: '40px 24px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: 'var(--surface-tinted)',
                      transition: 'all 0.15s',
                      marginBottom: epubStatus === 'error' ? 12 : 0,
                    }}
                  >
                    <div style={{ fontSize: 32, marginBottom: 12 }}>📖</div>
                    <p className="font-display" style={{ fontSize: 18, color: 'var(--ink)', margin: '0 0 6px', fontWeight: 600 }}>
                      Drop your ePub here
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--ink-ghost)', margin: 0, fontFamily: 'Crimson Pro, serif' }}>
                      or click to browse — title, author, summary and more will be extracted automatically
                    </p>
                  </div>
                  {epubStatus === 'error' && epubError && (
                    <p style={{ color: 'var(--griffindor-red)', fontSize: 13, marginTop: 8, fontFamily: 'Crimson Pro, serif' }}>⚠ {epubError}</p>
                  )}
                </div>
              ) : epubStatus === 'parsing' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px', background: '#fdf8ee', border: '1px solid var(--griffindor-gold)', borderRadius: 4 }}>
                  <div style={{ width: 16, height: 16, border: '2px solid var(--griffindor-gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                  <div>
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-soft)', fontFamily: 'Crimson Pro, serif' }}>Parsing <strong>{epubFileName}</strong>…</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink-ghost)', fontFamily: 'JetBrains Mono, monospace' }}>extracting metadata & counting words</p>
                  </div>
                </div>
              ) : epubMeta ? (
                <>
                  {/* ePub preview card */}
                  <div style={{ background: 'var(--surface-tinted)', borderRadius: 4, border: '1px solid var(--border)', marginBottom: 20, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <h3 className="font-display" style={{ margin: '0 0 2px', fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{epubTitle || epubMeta.title}</h3>
                          <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--ink-muted)', fontStyle: 'italic' }}>by {epubAuthor || epubMeta.author}</p>
                          {epubMeta.subjects.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                              {epubMeta.subjects.slice(0, 4).map(s => <span key={s} className="tag-pill">{s}</span>)}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                            {(epubWordCount || epubMeta.wordCount) && (
                              <span className="font-mono" style={{ fontSize: 12, color: 'var(--ink-ghost)' }}>
                                ~{(epubWordCount ? parseInt(epubWordCount) : epubMeta.wordCount!).toLocaleString()} words
                                <span style={{ opacity: 0.6 }}> (est.)</span>
                              </span>
                            )}
                            {epubMeta.chapterCount > 0 && (
                              <span className="font-mono" style={{ fontSize: 12, color: 'var(--ink-ghost)' }}>{epubMeta.chapterCount} chapters</span>
                            )}
                            {epubMeta.language && epubMeta.language !== 'en' && (
                              <span className="font-mono" style={{ fontSize: 12, color: 'var(--ink-ghost)' }}>{epubMeta.language}</span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button onClick={() => setShowEpubEdit(v => !v)} style={{ background: showEpubEdit ? '#fdf8ee' : 'none', border: `1px solid ${showEpubEdit ? 'var(--griffindor-gold)' : 'var(--border)'}`, borderRadius: 3, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: showEpubEdit ? 'var(--griffindor-gold)' : 'var(--ink-ghost)', fontFamily: 'JetBrains Mono, monospace', transition: 'all 0.15s' }}>
                            {showEpubEdit ? '✓ Editing' : '✎ Edit details'}
                          </button>
                          <button onClick={resetEpub} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 3, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: 'var(--ink-ghost)', fontFamily: 'JetBrains Mono, monospace' }}>Change</button>
                        </div>
                      </div>
                    </div>

                    {/* ── ePub editable fields ── */}
                    {showEpubEdit && (
                      <div style={{ padding: '16px', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <p style={{ gridColumn: '1 / -1', margin: '0 0 4px', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--ink-ghost)', letterSpacing: '0.08em' }}>EDIT EPUB DETAILS</p>

                        <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Title</label><input className="input-field" value={epubTitle} onChange={e => setEpubTitle(e.target.value)} /></div>
                        <div><label style={labelStyle}>Author</label><input className="input-field" value={epubAuthor} onChange={e => setEpubAuthor(e.target.value)} /></div>
                        <div><label style={labelStyle}>Word Count <span style={{ fontWeight: 400, opacity: 0.7 }}>(est.)</span></label><input className="input-field" value={epubWordCount} onChange={e => setEpubWordCount(e.target.value.replace(/\D/g, ''))} /></div>
                        <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Fandom <span style={{ fontWeight: 400, opacity: 0.7 }}>(if applicable)</span></label><input className="input-field" value={epubFandom} onChange={e => setEpubFandom(e.target.value)} placeholder="e.g. Harry Potter" /></div>
                        <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Tags / Subjects <span style={{ fontWeight: 400, opacity: 0.7 }}>(comma-separated)</span></label><input className="input-field" value={epubSubjects} onChange={e => setEpubSubjects(e.target.value)} /></div>
                        <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Link <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span></label><input className="input-field" value={epubLink} onChange={e => setEpubLink(e.target.value)} placeholder="https://…" type="url" /></div>
                        <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Summary</label><textarea className="input-field" value={epubSummary} onChange={e => setEpubSummary(e.target.value)} rows={3} style={{ resize: 'vertical' }} /></div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={labelStyle}>Completion</label>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {(['Complete', 'In Progress'] as const).map(s => (
                              <button key={s} onClick={() => setEpubCompletionStatus(s)} style={{ padding: '6px 16px', borderRadius: 3, border: `1px solid ${epubCompletionStatus === s ? 'var(--griffindor-gold)' : 'var(--border)'}`, background: epubCompletionStatus === s ? '#fdf8ee' : 'var(--surface)', color: epubCompletionStatus === s ? 'var(--ink)' : 'var(--ink-muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', transition: 'all 0.15s' }}>{s}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <PersonalFields readingStatus={readingStatus} setReadingStatus={setReadingStatus} yourRating={yourRating} setYourRating={setYourRating} hoverRating={hoverRating} setHoverRating={setHoverRating} dateStarted={dateStarted} setDateStarted={setDateStarted} dateRead={dateRead} setDateRead={setDateRead} recommendedBy={recommendedBy} setRecommendedBy={setRecommendedBy} yourTagsInput={yourTagsInput} setYourTagsInput={setYourTagsInput} notes={notes} setNotes={setNotes} />

                  {saveError && <p style={{ color: 'var(--griffindor-red)', fontSize: 13, marginTop: 12 }}>⚠ {saveError}</p>}
                  <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
                    <button className="btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Add to Shelf'}</button>
                  </div>
                </>
              ) : null}
            </>
          )}

          {/* ══════════ CUSTOM MODE ══════════ */}
          {source === 'custom' && (
            <>
              <button onClick={() => setSource('ao3')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--griffindor-gold)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', padding: '0 0 16px', textDecoration: 'underline', letterSpacing: '0.06em', display: 'block' }}>← Back</button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Title *</label><input className="input-field" value={customTitle} onChange={e => setCustomTitle(e.target.value)} placeholder="Work title" autoFocus /></div>
                <div><label style={labelStyle}>Author</label><input className="input-field" value={customAuthor} onChange={e => setCustomAuthor(e.target.value)} placeholder="Author name" /></div>
                <div><label style={labelStyle}>Fandom</label><input className="input-field" value={customFandom} onChange={e => setCustomFandom(e.target.value)} placeholder="e.g. Harry Potter" /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Link</label><input className="input-field" value={customLink} onChange={e => setCustomLink(e.target.value)} placeholder="https://…" type="url" /></div>
                <div><label style={labelStyle}>Word Count</label><input className="input-field" value={customWordCount} onChange={e => setCustomWordCount(e.target.value.replace(/\D/g, ''))} placeholder="e.g. 45000" /></div>
                <div>
                  <label style={labelStyle}>Completion</label>
                  <div style={{ display: 'flex', gap: 6, paddingTop: 2 }}>
                    {(['Complete', 'In Progress'] as const).map(s => (
                      <button key={s} onClick={() => setCustomStatus(s)} style={{ flex: 1, padding: '7px 0', borderRadius: 3, border: `1px solid ${customStatus === s ? 'var(--griffindor-gold)' : 'var(--border)'}`, background: customStatus === s ? '#fdf8ee' : 'var(--surface)', color: customStatus === s ? 'var(--ink)' : 'var(--ink-muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', transition: 'all 0.15s' }}>{s}</button>
                    ))}
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Summary</label><textarea className="input-field" value={customSummary} onChange={e => setCustomSummary(e.target.value)} placeholder="Brief description…" rows={3} style={{ resize: 'vertical' }} /></div>
              </div>
              <div style={{ height: 1, background: 'var(--border)', margin: '20px 0' }} />
              <PersonalFields readingStatus={readingStatus} setReadingStatus={setReadingStatus} yourRating={yourRating} setYourRating={setYourRating} hoverRating={hoverRating} setHoverRating={setHoverRating} dateStarted={dateStarted} setDateStarted={setDateStarted} dateRead={dateRead} setDateRead={setDateRead} recommendedBy={recommendedBy} setRecommendedBy={setRecommendedBy} yourTagsInput={yourTagsInput} setYourTagsInput={setYourTagsInput} notes={notes} setNotes={setNotes} />
              {saveError && <p style={{ color: 'var(--griffindor-red)', fontSize: 13, marginTop: 12 }}>⚠ {saveError}</p>}
              <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
                <button className="btn-ghost" onClick={onClose}>Cancel</button>
                <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Add to Shelf'}</button>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Personal fields ───────────────────────────────────────────────────────────
interface PersonalFieldsProps {
  readingStatus:    ReadingStatus
  setReadingStatus: (v: ReadingStatus) => void
  yourRating:       number
  setYourRating:    (v: number) => void
  hoverRating:      number
  setHoverRating:   (v: number) => void
  dateStarted:      string
  setDateStarted:   (v: string) => void
  dateRead:         string
  setDateRead:      (v: string) => void
  recommendedBy:    string
  setRecommendedBy: (v: string) => void
  yourTagsInput:    string
  setYourTagsInput: (v: string) => void
  notes:            string
  setNotes:         (v: string) => void
}

function PersonalFields({ readingStatus, setReadingStatus, yourRating, setYourRating, hoverRating, setHoverRating, dateStarted, setDateStarted, dateRead, setDateRead, recommendedBy, setRecommendedBy, yourTagsInput, setYourTagsInput, notes, setNotes }: PersonalFieldsProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <div style={{ gridColumn: '1 / -1' }}>
        <label style={labelStyle}>Reading Status</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUS_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setReadingStatus(opt.value)} style={{ padding: '6px 14px', borderRadius: 3, border: `1px solid ${readingStatus === opt.value ? 'var(--griffindor-gold)' : 'var(--border)'}`, background: readingStatus === opt.value ? '#fdf8ee' : 'var(--surface)', color: readingStatus === opt.value ? 'var(--ink)' : 'var(--ink-muted)', cursor: 'pointer', fontSize: 13, fontFamily: 'Crimson Pro, serif', transition: 'all 0.15s' }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={labelStyle}>Your Rating</label>
        <div style={{ display: 'flex', gap: 4, paddingTop: 4 }}>
          {[1,2,3,4,5].map(i => (
            <span key={i} className="star" style={{ fontSize: 24, color: (hoverRating || yourRating) >= i ? 'var(--griffindor-gold)' : 'var(--border-dark)', cursor: 'pointer' }} onClick={() => setYourRating(yourRating === i ? 0 : i)} onMouseEnter={() => setHoverRating(i)} onMouseLeave={() => setHoverRating(0)}>★</span>
          ))}
        </div>
      </div>

      <div>
        <label style={labelStyle}>Recommended By</label>
        <input className="input-field" value={recommendedBy} onChange={e => setRecommendedBy(e.target.value)} placeholder="Friend's name…" />
      </div>

      <div>
        <label style={labelStyle}>Date Started</label>
        <input type="date" className="input-field" value={dateStarted} onChange={e => setDateStarted(e.target.value)} />
      </div>

      <div>
        <label style={labelStyle}>Date Read</label>
        <input type="date" className="input-field" value={dateRead} onChange={e => setDateRead(e.target.value)} />
      </div>

      <div>
        <label style={labelStyle}>Your Tags</label>
        <input className="input-field" value={yourTagsInput} onChange={e => setYourTagsInput(e.target.value)} placeholder="cozy, slow burn, reread…" />
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <label style={labelStyle}>Notes</label>
        <textarea className="input-field" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Thoughts, quotes you loved, context…" rows={3} style={{ resize: 'vertical' }} />
      </div>
    </div>
  )
}