'use client'

import type { Book } from '@/lib/supabase'
import Avatar from './Avatar'

const STATUS_CLASSES: Record<string, string> = {
  want_to_read: 'status-want',
  reading: 'status-reading',
  finished: 'status-finished',
  dropped: 'status-dropped',
}
const STATUS_LABELS: Record<string, string> = {
  want_to_read: 'Want to Read',
  reading: 'Reading',
  finished: 'Finished',
  dropped: 'Dropped',
}

const RATING_COLORS: Record<string, string> = {
  'General Audiences': '#2d7030',
  'Teen And Up Audiences': '#c7930f',
  'Mature': '#c75a0f',
  'Explicit': '#9b2020',
  'Not Rated': '#999',
  'Not Rated (Unrated)': '#999',
}

function Stars({ rating }: { rating: number | null }) {
  return (
    <span>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ color: (rating || 0) >= i ? 'var(--accent)' : 'var(--rule-dark)', fontSize: 14 }}>★</span>
      ))}
    </span>
  )
}

export default function BookCard({ book, onClick }: { book: Book & { profiles?: { username: string; display_name: string | null; avatar_color: string } }; onClick: () => void }) {
  const ratingColor = RATING_COLORS[book.ao3_rating || ''] || '#999'
  const wordCountDisplay = book.word_count
    ? book.word_count >= 100000 ? `${(book.word_count / 1000).toFixed(0)}K words`
    : book.word_count >= 1000 ? `${(book.word_count / 1000).toFixed(1)}K words`
    : `${book.word_count} words`
    : null

  return (
    <div
      className="book-card"
      onClick={onClick}
      style={{
        background: 'white',
        border: '1px solid var(--rule)',
        borderRadius: 6,
        padding: 20,
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      {/* Top strip */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <span className={`status-badge ${STATUS_CLASSES[book.reading_status]}`}>
          {STATUS_LABELS[book.reading_status]}
        </span>
        <span style={{ fontSize: 11, color: ratingColor, fontFamily: 'DM Mono', fontWeight: 500 }}>
          {book.ao3_rating || 'Not Rated'}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-display" style={{
        fontSize: 17, fontWeight: 700, margin: '0 0 4px',
        color: 'var(--ink)', lineHeight: 1.3,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
      }}>
        {book.title}
      </h3>
      <p style={{ fontSize: 13, color: 'var(--ink-faint)', margin: '0 0 10px', fontStyle: 'italic' }}>
        by {book.author || 'Anonymous'}
      </p>

      {/* Fandoms */}
      {book.fandom && book.fandom.length > 0 && (
        <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {book.fandom.slice(0, 2).map(f => (
            <span key={f} className="tag-pill fandom">{f}</span>
          ))}
          {book.fandom.length > 2 && (
            <span className="tag-pill" style={{ color: 'var(--ink-faint)' }}>+{book.fandom.length - 2}</span>
          )}
        </div>
      )}

      {/* Summary snippet */}
      {book.summary && (
        <p style={{
          fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 12px', lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
        }}>
          {book.summary}
        </p>
      )}

      {/* Stats footer */}
      <div style={{ borderTop: '1px solid var(--rule)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 14 }}>
          {wordCountDisplay && (
            <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{wordCountDisplay}</span>
          )}
          {book.chapter_count && (
            <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
              ch. {book.chapter_count}
            </span>
          )}
          {book.status && (
            <span className="font-mono" style={{ fontSize: 11, color: book.status === 'Complete' ? '#2d5030' : '#7a5c00' }}>
              {book.status}
            </span>
          )}
        </div>
        <Stars rating={book.your_rating} />
      </div>

      {/* User attribution (everyone view) */}
      {book.profiles && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Avatar username={book.profiles.username} displayName={book.profiles.display_name} color={book.profiles.avatar_color} size={18} />
          <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'DM Mono' }}>
            {book.profiles.display_name || book.profiles.username}
          </span>
        </div>
      )}

      {/* Your tags */}
      {book.your_tags && book.your_tags.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {book.your_tags.slice(0, 3).map(t => (
            <span key={t} className="tag-pill">{t}</span>
          ))}
        </div>
      )}
    </div>
  )
}
