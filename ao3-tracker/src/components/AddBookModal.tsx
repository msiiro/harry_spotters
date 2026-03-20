'use client'

import { useState } from 'react'
import type { Book, ScrapedWork, ReadingStatus } from '@/lib/supabase'

interface Props {
  onClose: () => void
  onAdded: (book: Book) => void
}

const STATUS_OPTIONS: { value: ReadingStatus; label: string }[] = [
  { value: 'want_to_read', label: 'Want to Read' },
  { value: 'reading', label: 'Reading' },
  { value: 'finished', label: 'Finished' },
  { value: 'dropped', label: 'Dropped' },
]

export default function AddBookModal({ onClose, onAdded }: Props) {
  const [url, setUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState<string | null>(null)
  const [work, setWork] = useState<ScrapedWork | null>(null)

  // Personal fields
  const [yourRating, setYourRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [yourTagsInput, setYourTagsInput] = useState('')
  const [dateRead, setDateRead] = useState('')
  const [readingStatus, setReadingStatus] = useState<ReadingStatus>('want_to_read')
  const [notes, setNotes] = useState('')
  const [recommendedBy, setRecommendedBy] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleScrape = async () => {
    setScrapeError(null)
    setScraping(true)
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) setScrapeError(data.error || 'Failed to scrape')
      else setWork(data)
    } catch {
      setScrapeError('Network error while scraping')
    } finally {
      setScraping(false)
    }
  }

  const handleSave = async () => {
    if (!work) return
    setSaving(true)
    setSaveError(null)
    const yourTags = yourTagsInput.split(',').map(s => s.trim()).filter(Boolean)
    try {
      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...work,
          your_rating: yourRating || null,
          your_tags: yourTags.length ? yourTags : null,
          date_read: dateRead || null,
          reading_status: readingStatus,
          notes: notes || null,
          recommended_by: recommendedBy || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) setSaveError(data.error || 'Failed to save')
      else onAdded(data)
    } catch {
      setSaveError('Network error while saving')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'var(--paper)',
        borderRadius: 8,
        width: '100%',
        maxWidth: 680,
        maxHeight: '90vh',
        overflow: 'auto',
        border: '1px solid var(--rule)',
        boxShadow: '0 20px 60px rgba(26,20,16,0.2)',
      }}>
        {/* Header */}
        <div style={{ padding: '24px 28px 16px', borderBottom: '1px solid var(--rule)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 className="font-display" style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Add a Work</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--ink-faint)', fontSize: 13 }}>Paste an AO3 link to import metadata</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-faint)', padding: '0 4px' }}>×</button>
        </div>

        <div style={{ padding: '24px 28px' }}>
          {/* URL input */}
          {!work ? (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--ink-soft)' }}>
                AO3 Work URL
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  className="input-field"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://archiveofourown.org/works/..."
                  onKeyDown={e => e.key === 'Enter' && handleScrape()}
                />
                <button
                  className="btn-primary"
                  onClick={handleScrape}
                  disabled={!url || scraping}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {scraping ? 'Fetching…' : 'Fetch'}
                </button>
              </div>
              {scrapeError && (
                <p style={{ color: 'var(--accent)', fontSize: 13, marginTop: 8 }}>⚠ {scrapeError}</p>
              )}
            </div>
          ) : (
            <>
              {/* Scraped preview */}
              <div style={{ background: 'var(--paper-aged)', borderRadius: 6, padding: 16, marginBottom: 24, border: '1px solid var(--rule)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h3 className="font-display" style={{ margin: '0 0 2px', fontSize: 18, fontWeight: 700 }}>{work.title}</h3>
                    <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--ink-faint)', fontStyle: 'italic' }}>by {work.author}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                      {work.fandom.slice(0, 3).map(f => <span key={f} className="tag-pill fandom">{f}</span>)}
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <span className="font-mono" style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                        {work.word_count ? `${work.word_count.toLocaleString()} words` : '—'}
                      </span>
                      <span className="font-mono" style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                        {work.chapter_count} chapters
                      </span>
                      <span className="font-mono" style={{ fontSize: 12, color: work.status === 'Complete' ? '#2d5030' : '#7a5c00' }}>
                        {work.status}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setWork(null)}
                    style={{ background: 'none', border: '1px solid var(--rule)', borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--ink-faint)', marginLeft: 12 }}
                  >
                    Change
                  </button>
                </div>
              </div>

              {/* Personal fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Reading Status */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--ink-soft)' }}>
                    Reading Status
                  </label>
                  <select
                    className="input-field"
                    value={readingStatus}
                    onChange={e => setReadingStatus(e.target.value as ReadingStatus)}
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                {/* Date Read */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--ink-soft)' }}>
                    Date Read
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    value={dateRead}
                    onChange={e => setDateRead(e.target.value)}
                  />
                </div>

                {/* Your Rating */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--ink-soft)' }}>
                    Your Rating
                  </label>
                  <div style={{ display: 'flex', gap: 4, padding: '8px 0' }}>
                    {[1,2,3,4,5].map(i => (
                      <span
                        key={i}
                        className="star"
                        style={{ fontSize: 26, color: (hoverRating || yourRating) >= i ? 'var(--accent)' : 'var(--rule-dark)' }}
                        onClick={() => setYourRating(i)}
                        onMouseEnter={() => setHoverRating(i)}
                        onMouseLeave={() => setHoverRating(0)}
                      >★</span>
                    ))}
                    {yourRating > 0 && (
                      <button onClick={() => setYourRating(0)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--ink-faint)', padding: '0 6px' }}>clear</button>
                    )}
                  </div>
                </div>

                {/* Recommended By */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--ink-soft)' }}>
                    Recommended By
                  </label>
                  <input
                    className="input-field"
                    value={recommendedBy}
                    onChange={e => setRecommendedBy(e.target.value)}
                    placeholder="Friend's name…"
                  />
                </div>

                {/* Your Tags */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--ink-soft)' }}>
                    Your Tags <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>(comma-separated)</span>
                  </label>
                  <input
                    className="input-field"
                    value={yourTagsInput}
                    onChange={e => setYourTagsInput(e.target.value)}
                    placeholder="e.g. comfort read, cried, slow burn, reread…"
                  />
                </div>

                {/* Notes */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--ink-soft)' }}>
                    Notes
                  </label>
                  <textarea
                    className="input-field"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Your thoughts, quotes you loved, context…"
                    rows={3}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>

              {saveError && (
                <p style={{ color: 'var(--accent)', fontSize: 13, marginTop: 12 }}>⚠ {saveError}</p>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                <button className="btn-ghost" onClick={onClose}>Cancel</button>
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Add to Shelf'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
