'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Book, ReadingStatus, ScrapedWork } from '@/lib/supabase'
import BookCard from '@/components/BookCard'
import AddBookModal from '@/components/AddBookModal'
import BookDetailModal from '@/components/BookDetailModal'

const STATUS_TABS: { key: string; label: string; count?: number }[] = [
  { key: 'all', label: 'All Works' },
  { key: 'want_to_read', label: 'Want to Read' },
  { key: 'reading', label: 'Reading' },
  { key: 'finished', label: 'Finished' },
  { key: 'dropped', label: 'Dropped' },
]

export default function Home() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [activeStatus, setActiveStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchBooks = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (activeStatus !== 'all') params.set('status', activeStatus)
      if (search) params.set('search', search)
      const res = await fetch(`/api/books?${params}`)
      const data = await res.json()
      if (Array.isArray(data)) setBooks(data)
      else setError(data.error || 'Failed to load books')
    } catch {
      setError('Failed to connect to database')
    } finally {
      setLoading(false)
    }
  }, [activeStatus, search])

  useEffect(() => { fetchBooks() }, [fetchBooks])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const handleBookAdded = (book: Book) => {
    setBooks(prev => [book, ...prev])
    setShowAdd(false)
  }

  const handleBookUpdated = (updated: Book) => {
    setBooks(prev => prev.map(b => b.id === updated.id ? updated : b))
    setSelectedBook(updated)
  }

  const handleBookDeleted = (id: string) => {
    setBooks(prev => prev.filter(b => b.id !== id))
    setSelectedBook(null)
  }

  const stats = {
    total: books.length,
    finished: books.filter(b => b.reading_status === 'finished').length,
    words: books
      .filter(b => b.reading_status === 'finished' && b.word_count)
      .reduce((s, b) => s + (b.word_count || 0), 0),
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--rule)',
        background: 'var(--paper)',
        position: 'sticky', top: 0, zIndex: 30,
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 0 12px' }}>
            <div>
              <h1 className="font-display" style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', margin: 0, letterSpacing: '-0.02em' }}>
                Fic Shelf
              </h1>
              <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '2px 0 0', fontFamily: 'DM Mono', letterSpacing: '0.05em' }}>
                AO3 READING TRACKER
              </p>
            </div>

            {/* Stats strip */}
            <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div className="font-display" style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>{stats.total}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'DM Mono', letterSpacing: '0.06em' }}>TRACKED</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div className="font-display" style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>{stats.finished}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'DM Mono', letterSpacing: '0.06em' }}>FINISHED</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div className="font-display" style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
                  {stats.words >= 1000000 ? `${(stats.words / 1000000).toFixed(1)}M` : stats.words >= 1000 ? `${(stats.words / 1000).toFixed(0)}K` : stats.words}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'DM Mono', letterSpacing: '0.06em' }}>WORDS READ</div>
              </div>
              <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ marginLeft: 8 }}>
                + Add Work
              </button>
            </div>
          </div>

          {/* Tabs + Search */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--rule)', paddingTop: 8, paddingBottom: 2 }}>
            <div style={{ display: 'flex', gap: 0 }}>
              {STATUS_TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveStatus(tab.key)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '8px 16px',
                    fontSize: 13,
                    fontFamily: 'DM Sans',
                    color: activeStatus === tab.key ? 'var(--accent)' : 'var(--ink-faint)',
                    borderBottom: activeStatus === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
                    fontWeight: activeStatus === tab.key ? 500 : 400,
                    transition: 'all 0.15s',
                    marginBottom: -1,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <input
              className="input-field"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search titles…"
              style={{ width: 220, padding: '6px 12px', fontSize: 13 }}
            />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        {error && (
          <div style={{ background: '#f5ebe8', border: '1px solid var(--accent-soft)', borderRadius: 6, padding: '12px 16px', marginBottom: 24, color: 'var(--accent)', fontSize: 14 }}>
            ⚠ {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0', color: 'var(--ink-faint)' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="font-display" style={{ fontSize: 18, marginBottom: 8 }}>Loading your shelf…</div>
            </div>
          </div>
        ) : books.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div className="font-display" style={{ fontSize: 36, color: 'var(--rule-dark)', marginBottom: 12, fontStyle: 'italic' }}>
              Your shelf is empty
            </div>
            <p style={{ color: 'var(--ink-faint)', marginBottom: 24 }}>
              Add an AO3 work to get started
            </p>
            <button className="btn-primary" onClick={() => setShowAdd(true)}>
              + Add Your First Work
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {books.map(book => (
              <BookCard key={book.id} book={book} onClick={() => setSelectedBook(book)} />
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      {showAdd && (
        <AddBookModal onClose={() => setShowAdd(false)} onAdded={handleBookAdded} />
      )}
      {selectedBook && (
        <BookDetailModal
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
          onUpdated={handleBookUpdated}
          onDeleted={handleBookDeleted}
        />
      )}
    </div>
  )
}
