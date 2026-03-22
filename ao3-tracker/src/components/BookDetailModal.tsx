'use client'

import { useState, useEffect } from 'react'
import type { Book, ReadingStatus, WorkRating } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { authFetch } from '@/lib/api'
import Avatar from './Avatar'

interface Props {
  book: Book
  onClose: () => void
  onUpdated: (book: Book) => void
  onDeleted: (id: string) => void
  /** True when the viewing user owns this book entry */
  isOwnBook?: boolean
  /** Called when user wants to copy another person's book to their shelf */
  onCopyToMyShelf?: (book: Book) => Promise<{ ok: boolean; error?: string }>
}

const STATUS_OPTIONS: { value: ReadingStatus; label: string }[] = [
  { value: 'want_to_read', label: 'Want to Read' },
  { value: 'reading',      label: 'Reading' },
  { value: 'finished',     label: 'Finished' },
  { value: 'dropped',      label: 'Dropped' },
]

const STATUS_LABELS: Record<string, string> = {
  want_to_read: 'Want to Read',
  reading:      'Reading',
  finished:     'Finished',
  dropped:      'Dropped',
}

const STATUS_CLASSES: Record<string, string> = {
  want_to_read: 'status-want',
  reading:      'status-reading',
  finished:     'status-finished',
  dropped:      'status-dropped',
}

function TagList({ tags, className }: { tags: string[] | null | undefined; className?: string }) {
  if (!tags || tags.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {tags.map(t => <span key={t} className={`tag-pill ${className || ''}`}>{t}</span>)}
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '8px 0' }}>
      <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-ghost)', width: 100, flexShrink: 0, paddingTop: 2, letterSpacing: '0.05em' }}>
        {label.toUpperCase()}
      </span>
      <span style={{ fontSize: 14, color: 'var(--ink)', flex: 1 }}>{value}</span>
    </div>
  )
}

function MiniStars({ rating }: { rating: number }) {
  return (
    <span>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ fontSize: 12, color: rating >= i ? 'var(--griffindor-gold)' : 'var(--border-dark)' }}>★</span>
      ))}
    </span>
  )
}

export default function BookDetailModal({ book, onClose, onUpdated, onDeleted, isOwnBook = true, onCopyToMyShelf }: Props) {
  const { user } = useAuth()

  // Editing state — mirrors Book personal fields exactly
  const [editing,        setEditing]        = useState(false)
  const [yourRating,     setYourRating]     = useState(book.your_rating || 0)
  const [hoverRating,    setHoverRating]    = useState(0)
  const [yourTagsInput,  setYourTagsInput]  = useState((book.your_tags || []).join(', '))
  const [dateRead,       setDateRead]       = useState(book.date_read || '')
  const [dateStarted,    setDateStarted]    = useState(book.date_started || '')
  const [readingStatus,  setReadingStatus]  = useState<ReadingStatus>(book.reading_status)
  const [notes,          setNotes]          = useState(book.notes || '')
  const [recommendedBy,  setRecommendedBy]  = useState(book.recommended_by || '')
  const [saving,         setSaving]         = useState(false)
  const [deleting,       setDeleting]       = useState(false)
  const [confirmDelete,  setConfirmDelete]  = useState(false)
  const [otherRatings,   setOtherRatings]   = useState<WorkRating[]>([])

  // Copy-to-shelf state
  const [copyState, setCopyState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [copyError, setCopyError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/ratings?ao3_id=${book.ao3_id}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data))
          setOtherRatings(data.filter(r => r.user_id !== user?.id))
      })
  }, [book.ao3_id, user?.id])

  const handleSave = async () => {
    setSaving(true)
    const yourTags = yourTagsInput.split(',').map(s => s.trim()).filter(Boolean)
    try {
      const res = await authFetch(`/api/books/${book.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          your_rating:   yourRating || null,
          your_tags:     yourTags.length ? yourTags : null,
          date_started:  dateStarted || null,
          date_read:     dateRead || null,
          reading_status: readingStatus,
          notes:         notes || null,
          recommended_by: recommendedBy || null,
        }),
      })
      const data = await res.json()
      if (res.ok) { onUpdated(data); setEditing(false) }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    await authFetch(`/api/books/${book.id}`, { method: 'DELETE' })
    onDeleted(book.id)
  }

  const handleCopy = async () => {
    if (!onCopyToMyShelf) return
    setCopyState('loading')
    setCopyError(null)
    const result = await onCopyToMyShelf(book)
    if (result.ok) {
      setCopyState('done')
    } else {
      setCopyState('error')
      setCopyError(result.error || 'Something went wrong')
    }
  }

  const wordCountDisplay = book.word_count
    ? book.word_count.toLocaleString() + ' words'
    : '—'

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div
        className="modal-sheet"
        style={{
          background:   'var(--surface)',
          borderRadius: 6,
          width:        '100%',
          maxWidth:     760,
          maxHeight:    '92vh',
          overflow:     'auto',
          border:       '1px solid var(--border)',
          boxShadow:    'var(--shadow-lg)',
        }}
      >
        {/* House-colour top bar */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--griffindor-crimson), var(--griffindor-gold), var(--slytherin-emerald))' }} />

        {/* Header */}
        <div style={{ padding: '22px 28px 18px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <span className={`status-badge ${STATUS_CLASSES[book.reading_status]}`}>
              {STATUS_LABELS[book.reading_status]}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {isOwnBook && !editing && (
                <button className="btn-ghost" onClick={() => setEditing(true)} style={{ fontSize: 12 }}>✏ Edit</button>
              )}
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-ghost)', padding: '0 4px', lineHeight: 1 }}>×</button>
            </div>
          </div>

          <h2 className="font-display" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, lineHeight: 1.25, color: 'var(--ink)' }}>
            {book.title}
          </h2>
          <p style={{ margin: '0 0 10px', fontSize: 14, color: 'var(--ink-muted)', fontStyle: 'italic' }}>
            by {book.author || 'Anonymous'}
          </p>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {book.fandom?.map(f => <span key={f} className="tag-pill fandom">{f}</span>)}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 28px', display: 'grid', gridTemplateColumns: '1fr 280px', gap: 28 }}>

          {/* Left: AO3 metadata */}
          <div>
            {/* ── Copy CTA for another user's book ── */}
            {!isOwnBook && (
              <div style={{
                marginBottom: 20,
                padding:      '14px 16px',
                background:   copyState === 'done' ? '#eaf3ee' : '#fdf8ee',
                border:       `1px solid ${copyState === 'done' ? '#b8d8c8' : 'var(--griffindor-gold)'}`,
                borderRadius: 4,
              }}>
                {copyState === 'done' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--slytherin-emerald)', fontSize: 16 }}>✓</span>
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--slytherin-emerald)', fontFamily: 'Crimson Pro, serif' }}>
                      Added to your shelf as <strong>Want to Read</strong>
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-soft)', fontFamily: 'Crimson Pro, serif' }}>
                      This is on someone else's shelf.
                    </p>
                    <button
                      className="btn-primary"
                      onClick={handleCopy}
                      disabled={copyState === 'loading'}
                      style={{ flexShrink: 0 }}
                    >
                      {copyState === 'loading' ? '…' : '+ Add to My Shelf'}
                    </button>
                  </div>
                )}
                {copyState === 'error' && copyError && (
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--griffindor-red)', fontFamily: 'JetBrains Mono, monospace' }}>
                    ⚠ {copyError}
                  </p>
                )}
              </div>
            )}

            {book.summary && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--ink-ghost)', letterSpacing: '0.08em', marginBottom: 6 }}>SUMMARY</p>
                <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--ink-soft)', margin: 0, fontStyle: 'italic' }}>{book.summary}</p>
              </div>
            )}

            <StatRow label="Rating"     value={<span style={{ color: '#9b2020' }}>{book.ao3_rating || 'Not Rated'}</span>} />
            <StatRow label="Status"     value={<span style={{ color: book.status === 'Complete' ? 'var(--slytherin-emerald)' : 'var(--griffindor-gold)' }}>{book.status || '—'}</span>} />
            <StatRow label="Words"      value={wordCountDisplay} />
            <StatRow label="Chapters"   value={book.chapter_count || '—'} />
            <StatRow label="Language"   value={book.language || '—'} />
            <StatRow label="Published"  value={book.published_date || '—'} />
            {book.updated_date && <StatRow label="Updated" value={book.updated_date} />}
            <StatRow label="Kudos"      value={book.kudos?.toLocaleString() ?? '—'} />
            <StatRow label="Hits"       value={book.hits?.toLocaleString() ?? '—'} />
            <StatRow label="Bookmarks"  value={book.bookmarks?.toLocaleString() ?? '—'} />

            {book.characters && book.characters.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--ink-ghost)', letterSpacing: '0.08em', marginBottom: 6 }}>CHARACTERS</p>
                <TagList tags={book.characters} className="character" />
              </div>
            )}
            {book.relationships && book.relationships.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--ink-ghost)', letterSpacing: '0.08em', marginBottom: 6 }}>RELATIONSHIPS</p>
                <TagList tags={book.relationships} className="relationship" />
              </div>
            )}
            {book.warnings && book.warnings.length > 0 && book.warnings[0] !== 'No Archive Warnings Apply' && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--ink-ghost)', letterSpacing: '0.08em', marginBottom: 6 }}>WARNINGS</p>
                <TagList tags={book.warnings} className="warning" />
              </div>
            )}
            {book.additional_tags && book.additional_tags.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--ink-ghost)', letterSpacing: '0.08em', marginBottom: 6 }}>AO3 TAGS</p>
                <TagList tags={book.additional_tags} />
              </div>
            )}

            <a href={book.ao3_url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-block', marginTop: 16, fontSize: 13, color: 'var(--griffindor-gold)', textDecoration: 'none' }}>
              Read on AO3 →
            </a>

            {/* Friends' ratings */}
            {otherRatings.length > 0 && (
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                <p style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--ink-ghost)', letterSpacing: '0.08em', marginBottom: 12 }}>FRIENDS&apos; RATINGS</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {otherRatings.map(r => (
                    <div key={r.user_id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <Avatar username={r.username} displayName={r.display_name} color={r.avatar_color} size={28} />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>{r.display_name || r.username}</span>
                          <MiniStars rating={r.your_rating} />
                        </div>
                        {r.notes && (
                          <p style={{ fontSize: 12, color: 'var(--ink-ghost)', margin: '3px 0 0', lineHeight: 1.5, fontStyle: 'italic' }}>
                            &ldquo;{r.notes.slice(0, 120)}{r.notes.length > 120 ? '…' : ''}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: personal shelf panel */}
          <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 24 }}>
            <p style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--ink-ghost)', letterSpacing: '0.08em', marginBottom: 16 }}>
              {isOwnBook ? 'YOUR SHELF' : 'THEIR SHELF'}
            </p>

            {isOwnBook && editing ? (
              /* ── Edit form ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-muted)', display: 'block', marginBottom: 6, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em' }}>STATUS</label>
                  <select className="input-field" style={{ fontSize: 13 }} value={readingStatus} onChange={e => setReadingStatus(e.target.value as ReadingStatus)}>
                    {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-muted)', display: 'block', marginBottom: 4, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em' }}>RATING</label>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <span
                        key={i}
                        className="star"
                        style={{ fontSize: 22, color: (hoverRating || yourRating) >= i ? 'var(--griffindor-gold)' : 'var(--border-dark)' }}
                        onClick={() => setYourRating(i)}
                        onMouseEnter={() => setHoverRating(i)}
                        onMouseLeave={() => setHoverRating(0)}
                      >★</span>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-muted)', display: 'block', marginBottom: 6, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em' }}>DATE STARTED</label>
                  <input type="date" className="input-field" style={{ fontSize: 13 }} value={dateStarted} onChange={e => setDateStarted(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-muted)', display: 'block', marginBottom: 6, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em' }}>DATE READ</label>
                  <input type="date" className="input-field" style={{ fontSize: 13 }} value={dateRead} onChange={e => setDateRead(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-muted)', display: 'block', marginBottom: 6, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em' }}>RECOMMENDED BY</label>
                  <input className="input-field" style={{ fontSize: 13 }} value={recommendedBy} onChange={e => setRecommendedBy(e.target.value)} placeholder="Friend's name…" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-muted)', display: 'block', marginBottom: 6, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em' }}>YOUR TAGS</label>
                  <input className="input-field" style={{ fontSize: 13 }} value={yourTagsInput} onChange={e => setYourTagsInput(e.target.value)} placeholder="tag1, tag2…" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-muted)', display: 'block', marginBottom: 6, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em' }}>NOTES</label>
                  <textarea className="input-field" style={{ fontSize: 13, resize: 'vertical' }} value={notes} onChange={e => setNotes(e.target.value)} rows={4} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 1, fontSize: 13 }}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button className="btn-ghost" onClick={() => setEditing(false)} style={{ fontSize: 13 }}>Cancel</button>
                </div>
              </div>
            ) : (
              /* ── Read-only view ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--ink-ghost)', fontFamily: 'JetBrains Mono, monospace', margin: '0 0 4px' }}>RATING</p>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <span key={i} style={{ fontSize: 20, color: (book.your_rating || 0) >= i ? 'var(--griffindor-gold)' : 'var(--border-dark)' }}>★</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--ink-ghost)', fontFamily: 'JetBrains Mono, monospace', margin: '0 0 4px' }}>DATE STARTED</p>
                  <p style={{ fontSize: 14, margin: 0, color: 'var(--ink)' }}>{book.date_started || <span style={{ color: 'var(--ink-ghost)' }}>—</span>}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--ink-ghost)', fontFamily: 'JetBrains Mono, monospace', margin: '0 0 4px' }}>DATE READ</p>
                  <p style={{ fontSize: 14, margin: 0, color: 'var(--ink)' }}>{book.date_read || <span style={{ color: 'var(--ink-ghost)' }}>—</span>}</p>
                </div>
                {book.recommended_by && (
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--ink-ghost)', fontFamily: 'JetBrains Mono, monospace', margin: '0 0 4px' }}>RECOMMENDED BY</p>
                    <p style={{ fontSize: 14, margin: 0, color: 'var(--ink)' }}>{book.recommended_by}</p>
                  </div>
                )}
                {book.your_tags && book.your_tags.length > 0 && (
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--ink-ghost)', fontFamily: 'JetBrains Mono, monospace', margin: '0 0 6px' }}>YOUR TAGS</p>
                    <TagList tags={book.your_tags} />
                  </div>
                )}
                {book.notes && (
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--ink-ghost)', fontFamily: 'JetBrains Mono, monospace', margin: '0 0 6px' }}>NOTES</p>
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink-soft)', margin: 0, whiteSpace: 'pre-wrap' }}>{book.notes}</p>
                  </div>
                )}
                {isOwnBook && (
                  <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                    {confirmDelete ? (
                      <div>
                        <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 8 }}>Remove this work from your shelf?</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={handleDelete}
                            disabled={deleting}
                            style={{ background: 'var(--griffindor-red)', color: 'white', border: 'none', borderRadius: 3, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace' }}
                          >
                            {deleting ? 'Removing…' : 'Yes, Remove'}
                          </button>
                          <button className="btn-ghost" onClick={() => setConfirmDelete(false)} style={{ fontSize: 12 }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(true)}
                        style={{ background: 'none', border: 'none', color: 'var(--ink-ghost)', fontSize: 12, cursor: 'pointer', padding: 0, textDecoration: 'underline', fontFamily: 'Crimson Pro, serif' }}
                      >
                        Remove from shelf
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}