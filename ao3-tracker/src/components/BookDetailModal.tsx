'use client'

import { useState } from 'react'
import type { Book, ReadingStatus } from '@/lib/supabase'

interface Props {
  book: Book
  onClose: () => void
  onUpdated: (book: Book) => void
  onDeleted: (id: string) => void
}

const STATUS_OPTIONS: { value: ReadingStatus; label: string }[] = [
  { value: 'want_to_read', label: 'Want to Read' },
  { value: 'reading', label: 'Reading' },
  { value: 'finished', label: 'Finished' },
  { value: 'dropped', label: 'Dropped' },
]

const STATUS_LABELS: Record<string, string> = {
  want_to_read: 'Want to Read', reading: 'Reading', finished: 'Finished', dropped: 'Dropped',
}
const STATUS_CLASSES: Record<string, string> = {
  want_to_read: 'status-want', reading: 'status-reading', finished: 'status-finished', dropped: 'status-dropped',
}

function TagList({ tags, className }: { tags: string[] | null | undefined, className?: string }) {
  if (!tags || tags.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {tags.map(t => <span key={t} className={`tag-pill ${className || ''}`}>{t}</span>)}
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--rule)', padding: '8px 0' }}>
      <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-faint)', width: 100, flexShrink: 0, paddingTop: 2, letterSpacing: '0.05em' }}>
        {label.toUpperCase()}
      </span>
      <span style={{ fontSize: 14, color: 'var(--ink)', flex: 1 }}>{value}</span>
    </div>
  )
}

export default function BookDetailModal({ book, onClose, onUpdated, onDeleted }: Props) {
  const [editing, setEditing] = useState(false)
  const [yourRating, setYourRating] = useState(book.your_rating || 0)
  const [hoverRating, setHoverRating] = useState(0)
  const [yourTagsInput, setYourTagsInput] = useState((book.your_tags || []).join(', '))
  const [dateRead, setDateRead] = useState(book.date_read || '')
  const [readingStatus, setReadingStatus] = useState<ReadingStatus>(book.reading_status)
  const [notes, setNotes] = useState(book.notes || '')
  const [recommendedBy, setRecommendedBy] = useState(book.recommended_by || '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const yourTags = yourTagsInput.split(',').map(s => s.trim()).filter(Boolean)
    try {
      const res = await fetch(`/api/books/${book.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          your_rating: yourRating || null,
          your_tags: yourTags.length ? yourTags : null,
          date_read: dateRead || null,
          reading_status: readingStatus,
          notes: notes || null,
          recommended_by: recommendedBy || null,
        }),
      })
      const data = await res.json()
      if (res.ok) { onUpdated(data); setEditing(false) }
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    await fetch(`/api/books/${book.id}`, { method: 'DELETE' })
    onDeleted(book.id)
  }

  const wordCountDisplay = book.word_count
    ? book.word_count >= 1000 ? `${book.word_count.toLocaleString()} words` : `${book.word_count} words`
    : '—'

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'var(--paper)',
        borderRadius: 8,
        width: '100%',
        maxWidth: 740,
        maxHeight: '92vh',
        overflow: 'auto',
        border: '1px solid var(--rule)',
        boxShadow: '0 20px 60px rgba(26,20,16,0.2)',
      }}>
        {/* Header */}
        <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--rule)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <span className={`status-badge ${STATUS_CLASSES[book.reading_status]}`}>
              {STATUS_LABELS[book.reading_status]}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {!editing && (
                <button className="btn-ghost" onClick={() => setEditing(true)} style={{ fontSize: 12 }}>
                  ✏ Edit
                </button>
              )}
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-faint)', padding: '0 4px', lineHeight: 1 }}>×</button>
            </div>
          </div>
          <h2 className="font-display" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, lineHeight: 1.25 }}>
            {book.title}
          </h2>
          <p style={{ margin: '0 0 10px', fontSize: 14, color: 'var(--ink-faint)', fontStyle: 'italic' }}>
            by {book.author || 'Anonymous'}
          </p>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {book.fandom?.map(f => <span key={f} className="tag-pill fandom">{f}</span>)}
          </div>
        </div>

        <div style={{ padding: '20px 28px', display: 'grid', gridTemplateColumns: '1fr 280px', gap: 28 }}>
          {/* Left: AO3 metadata */}
          <div>
            {book.summary && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 12, fontFamily: 'DM Mono', color: 'var(--ink-faint)', letterSpacing: '0.08em', marginBottom: 6 }}>SUMMARY</p>
                <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--ink-soft)', margin: 0, fontStyle: 'italic' }}>
                  {book.summary}
                </p>
              </div>
            )}

            <StatRow label="Rating" value={<span style={{ color: '#9b2020' }}>{book.ao3_rating || 'Not Rated'}</span>} />
            <StatRow label="Status" value={
              <span style={{ color: book.status === 'Complete' ? '#2d5030' : '#7a5c00' }}>{book.status || '—'}</span>
            } />
            <StatRow label="Words" value={wordCountDisplay} />
            <StatRow label="Chapters" value={book.chapter_count || '—'} />
            <StatRow label="Language" value={book.language || '—'} />
            <StatRow label="Published" value={book.published_date || '—'} />
            {book.updated_date && <StatRow label="Updated" value={book.updated_date} />}
            <StatRow label="Kudos" value={book.kudos?.toLocaleString() ?? '—'} />
            <StatRow label="Hits" value={book.hits?.toLocaleString() ?? '—'} />
            <StatRow label="Bookmarks" value={book.bookmarks?.toLocaleString() ?? '—'} />

            {/* Character / relationship tags */}
            {book.characters && book.characters.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: 12, fontFamily: 'DM Mono', color: 'var(--ink-faint)', letterSpacing: '0.08em', marginBottom: 6 }}>CHARACTERS</p>
                <TagList tags={book.characters} className="character" />
              </div>
            )}
            {book.relationships && book.relationships.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 12, fontFamily: 'DM Mono', color: 'var(--ink-faint)', letterSpacing: '0.08em', marginBottom: 6 }}>RELATIONSHIPS</p>
                <TagList tags={book.relationships} className="relationship" />
              </div>
            )}
            {book.warnings && book.warnings.length > 0 && book.warnings[0] !== 'No Archive Warnings Apply' && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 12, fontFamily: 'DM Mono', color: 'var(--ink-faint)', letterSpacing: '0.08em', marginBottom: 6 }}>WARNINGS</p>
                <TagList tags={book.warnings} className="warning" />
              </div>
            )}
            {book.additional_tags && book.additional_tags.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 12, fontFamily: 'DM Mono', color: 'var(--ink-faint)', letterSpacing: '0.08em', marginBottom: 6 }}>AO3 TAGS</p>
                <TagList tags={book.additional_tags} />
              </div>
            )}

            <a
              href={book.ao3_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-block', marginTop: 16, fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}
            >
              Read on AO3 →
            </a>
          </div>

          {/* Right: Personal fields (view or edit) */}
          <div style={{ borderLeft: '1px solid var(--rule)', paddingLeft: 24 }}>
            <p style={{ fontSize: 12, fontFamily: 'DM Mono', color: 'var(--ink-faint)', letterSpacing: '0.08em', marginBottom: 16 }}>YOUR SHELF</p>

            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>Status</label>
                  <select className="input-field" style={{ fontSize: 13 }} value={readingStatus} onChange={e => setReadingStatus(e.target.value as ReadingStatus)}>
                    {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-soft)', display: 'block', marginBottom: 4 }}>Your Rating</label>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {[1,2,3,4,5].map(i => (
                      <span key={i} className="star" style={{ fontSize: 22, color: (hoverRating || yourRating) >= i ? 'var(--accent)' : 'var(--rule-dark)' }}
                        onClick={() => setYourRating(i)} onMouseEnter={() => setHoverRating(i)} onMouseLeave={() => setHoverRating(0)}>★</span>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>Date Read</label>
                  <input type="date" className="input-field" style={{ fontSize: 13 }} value={dateRead} onChange={e => setDateRead(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>Recommended By</label>
                  <input className="input-field" style={{ fontSize: 13 }} value={recommendedBy} onChange={e => setRecommendedBy(e.target.value)} placeholder="Friend's name…" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>Your Tags</label>
                  <input className="input-field" style={{ fontSize: 13 }} value={yourTagsInput} onChange={e => setYourTagsInput(e.target.value)} placeholder="tag1, tag2…" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>Notes</label>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'DM Mono', margin: '0 0 4px' }}>RATING</p>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {[1,2,3,4,5].map(i => (
                      <span key={i} style={{ fontSize: 20, color: (book.your_rating || 0) >= i ? 'var(--accent)' : 'var(--rule-dark)' }}>★</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'DM Mono', margin: '0 0 4px' }}>DATE READ</p>
                  <p style={{ fontSize: 14, margin: 0 }}>{book.date_read || <span style={{ color: 'var(--ink-faint)' }}>—</span>}</p>
                </div>
                {book.recommended_by && (
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'DM Mono', margin: '0 0 4px' }}>RECOMMENDED BY</p>
                    <p style={{ fontSize: 14, margin: 0 }}>{book.recommended_by}</p>
                  </div>
                )}
                {book.your_tags && book.your_tags.length > 0 && (
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'DM Mono', margin: '0 0 6px' }}>YOUR TAGS</p>
                    <TagList tags={book.your_tags} />
                  </div>
                )}
                {book.notes && (
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'DM Mono', margin: '0 0 6px' }}>NOTES</p>
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink-soft)', margin: 0, whiteSpace: 'pre-wrap' }}>{book.notes}</p>
                  </div>
                )}

                {/* Delete */}
                <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: '1px solid var(--rule)' }}>
                  {confirmDelete ? (
                    <div>
                      <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 8 }}>Remove this work from your shelf?</p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={handleDelete} disabled={deleting} style={{ background: '#9b2020', color: 'white', border: 'none', borderRadius: 4, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
                          {deleting ? 'Removing…' : 'Yes, Remove'}
                        </button>
                        <button className="btn-ghost" onClick={() => setConfirmDelete(false)} style={{ fontSize: 12 }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(true)} style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', fontSize: 12, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                      Remove from shelf
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
