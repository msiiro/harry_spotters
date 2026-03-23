'use client'

import type { Book } from '@/lib/supabase'
import Avatar from './Avatar'

interface Props {
  book: Book & { profiles?: { username: string; display_name: string | null; avatar_color: string } }
  onClick: () => void
  /** Show a subtle "add to shelf" hint — used when browsing another user's shelf */
  showCopyHint?: boolean
}

const STATUS_CLASS: Record<string, string> = {
  want_to_read: 'status-want',
  reading:      'status-reading',
  finished:     'status-finished',
  dropped:      'status-dropped',
}

const STATUS_LABEL: Record<string, string> = {
  want_to_read: 'Want to Read',
  reading:      'Reading',
  finished:     'Finished',
  dropped:      'Dropped',
}

const RATING_COLORS: Record<string, string> = {
  'General Audiences':     '#2d7030',
  'Teen And Up Audiences': '#c7930f',
  'Mature':                '#c75a0f',
  'Explicit':              '#9b2020',
  'Not Rated':             '#999',
}

export default function BookCard({ book, onClick, showCopyHint = false }: Props) {
  const ratingColor = RATING_COLORS[book.ao3_rating || ''] || '#999'

  const wordCountDisplay = book.word_count
    ? book.word_count >= 100000 ? `${(book.word_count / 1000).toFixed(0)}K words`
    : book.word_count >= 1000   ? `${(book.word_count / 1000).toFixed(1)}K words`
    : `${book.word_count} words`
    : null

  return (
    <div
      className="book-card"
      onClick={onClick}
      style={{ padding: '18px 20px', cursor: 'pointer', position: 'relative' }}
    >

      {/* Top strip: status + AO3 rating */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <span className={`status-badge ${STATUS_CLASS[book.reading_status]}`}>
          {STATUS_LABEL[book.reading_status]}
        </span>
        <span style={{ fontSize: 11, color: ratingColor, fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}>
          {book.ao3_rating || 'Not Rated'}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-display" style={{
        fontSize:     17,
        fontWeight:   700,
        color:        'var(--ink)',
        margin:       '0 0 4px',
        lineHeight:   1.3,
        display:      '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow:     'hidden',
      }}>
        {book.title}
      </h3>
      <p style={{ fontSize: 13, color: 'var(--ink-muted)', margin: '0 0 10px', fontStyle: 'italic' }}>
        by {book.author || 'Anonymous'}
      </p>

      {/* Fandoms */}
      {book.fandom && book.fandom.length > 0 && (
        <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {book.fandom.slice(0, 2).map(f => (
            <span key={f} className="tag-pill fandom">{f}</span>
          ))}
          {book.fandom.length > 2 && (
            <span className="tag-pill" style={{ color: 'var(--ink-ghost)' }}>+{book.fandom.length - 2}</span>
          )}
        </div>
      )}

      {/* Summary snippet */}
      {book.summary && (
        <p style={{
          fontSize:        13,
          color:           'var(--ink-soft)',
          margin:          '0 0 12px',
          lineHeight:      1.5,
          display:         '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow:        'hidden',
        }}>
          {book.summary}
        </p>
      )}

      {/* Footer: word count + status + stars */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          {wordCountDisplay && (
            <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-ghost)' }}>{wordCountDisplay}</span>
          )}
          {book.chapter_count && (
            <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-ghost)' }}>ch. {book.chapter_count}</span>
          )}
          {book.status && (
            <span className="font-mono" style={{ fontSize: 11, color: book.status === 'Complete' ? 'var(--slytherin-emerald)' : 'var(--griffindor-gold)' }}>
              {book.status}
            </span>
          )}
        </div>
        {/* Personal star rating */}
        <div style={{ display: 'flex', gap: 1 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <span key={n} style={{ fontSize: 13, color: (book.your_rating || 0) >= n ? 'var(--griffindor-gold)' : 'var(--border-dark)' }}>★</span>
          ))}
        </div>
      </div>

      {/* User attribution (everyone view) */}
      {book.profiles && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Avatar username={book.profiles.username} displayName={book.profiles.display_name} color={book.profiles.avatar_color} size={18} />
          <span style={{ fontSize: 11, color: 'var(--ink-ghost)', fontFamily: 'JetBrains Mono, monospace' }}>
            {book.profiles.display_name || book.profiles.username}
          </span>
        </div>
      )}

      {/* Personal tags */}
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