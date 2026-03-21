'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Book, ReadingStatus } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { authFetch } from '@/lib/api'
import BookCard from '@/components/BookCard'
import AddBookModal from '@/components/AddBookModal'
import BookDetailModal from '@/components/BookDetailModal'
import ActivityFeed from '@/components/ActivityFeed'
import Avatar from '@/components/Avatar'

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'want_to_read', label: 'Want to Read' },
  { key: 'reading', label: 'Reading' },
  { key: 'finished', label: 'Finished' },
  { key: 'dropped', label: 'Dropped' },
]

type ShelfView = 'mine' | 'everyone'

export default function Home() {
  const { user, profile, loading: authLoading, signOut } = useAuth()
  const router = useRouter()

  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [activeStatus, setActiveStatus] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [shelfView, setShelfView] = useState<ShelfView>('everyone')
  const [showAdd, setShowAdd] = useState(false)
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) router.push('/auth')
  }, [authLoading, user, router])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const fetchBooks = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (activeStatus !== 'all') params.set('status', activeStatus)
      if (search) params.set('search', search)
      if (shelfView === 'mine') params.set('user_id', user.id)

      const res = await authFetch(`/api/books?${params}`)
      const data = await res.json()
      if (Array.isArray(data)) setBooks(data)
      else setError(data.error || 'Failed to load books')
    } catch {
      setError('Failed to connect to database')
    } finally {
      setLoading(false)
    }
  }, [user, activeStatus, search, shelfView])

  useEffect(() => { fetchBooks() }, [fetchBooks])

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

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth')
  }

  const stats = {
    total: books.length,
    finished: books.filter(b => b.reading_status === 'finished').length,
    words: books
      .filter(b => b.reading_status === 'finished' && b.word_count)
      .reduce((s, b) => s + (b.word_count || 0), 0),
  }

  const formatWords = (n: number) =>
    n >= 1000000 ? `${(n / 1000000).toFixed(1)}M`
    : n >= 1000 ? `${(n / 1000).toFixed(0)}K`
    : String(n)

  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)' }}>
      <p className="font-display" style={{ color: 'var(--ink-faint)', fontSize: 18, fontStyle: 'italic' }}>Loading…</p>
    </div>
  )

  if (!user) return null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--rule)', background: 'var(--paper)', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 12px' }}>
            {/* Logo */}
            <div>
              <h1 className="font-display" style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', margin: 0, letterSpacing: '-0.02em' }}>
                The Vanishing Cabinet
              </h1>
              <p style={{ fontSize: 11, color: 'var(--ink-faint)', margin: '1px 0 0', fontFamily: 'DM Mono', letterSpacing: '0.06em' }}>
                AO3 READING TRACKER
              </p>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
              {[
                { value: stats.total, label: 'TRACKED' },
                { value: stats.finished, label: 'FINISHED' },
                { value: formatWords(stats.words), label: 'WORDS READ' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-faint)', fontFamily: 'DM Mono', letterSpacing: '0.06em' }}>{s.label}</div>
                </div>
              ))}

              <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Work</button>

              {/* User menu */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowUserMenu(v => !v)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <Avatar
                    username={profile?.username || '?'}
                    displayName={profile?.display_name}
                    color={profile?.avatar_color}
                    size={34}
                  />
                </button>
                {showUserMenu && (
                  <div style={{
                    position: 'absolute', right: 0, top: '100%', marginTop: 8,
                    background: 'white', border: '1px solid var(--rule)', borderRadius: 6,
                    boxShadow: '0 8px 24px rgba(26,20,16,0.12)', minWidth: 160, zIndex: 50,
                  }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--rule)' }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{profile?.display_name || profile?.username}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'DM Mono' }}>@{profile?.username}</p>
                    </div>
                    <button
                      onClick={handleSignOut}
                      style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: 'var(--ink-soft)' }}
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Shelf toggle + tabs + search */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--rule)', paddingTop: 6, paddingBottom: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              {/* Shelf view toggle */}
              <div style={{ display: 'flex', marginRight: 16, borderRight: '1px solid var(--rule)', paddingRight: 16 }}>
                {(['everyone', 'mine'] as ShelfView[]).map(v => (
                  <button key={v} onClick={() => setShelfView(v)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '8px 12px', fontSize: 12, fontFamily: 'DM Mono',
                    letterSpacing: '0.05em',
                    color: shelfView === v ? 'var(--accent)' : 'var(--ink-faint)',
                    borderBottom: shelfView === v ? '2px solid var(--accent)' : '2px solid transparent',
                    marginBottom: -1,
                  }}>
                    {v === 'everyone' ? 'ALL SHELVES' : 'MY SHELF'}
                  </button>
                ))}
              </div>

              {/* Status tabs */}
              {STATUS_TABS.map(tab => (
                <button key={tab.key} onClick={() => setActiveStatus(tab.key)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '8px 14px', fontSize: 13, fontFamily: 'DM Sans',
                  color: activeStatus === tab.key ? 'var(--accent)' : 'var(--ink-faint)',
                  borderBottom: activeStatus === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
                  fontWeight: activeStatus === tab.key ? 500 : 400,
                  marginBottom: -1, transition: 'all 0.15s',
                }}>
                  {tab.label}
                </button>
              ))}
            </div>

            <input
              className="input-field"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search titles…"
              style={{ width: 200, padding: '6px 12px', fontSize: 13 }}
            />
          </div>
        </div>
      </header>

      {/* Main layout: book grid + activity sidebar */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px', display: 'grid', gridTemplateColumns: '1fr 300px', gap: 32 }}>
        {/* Book grid */}
        <main>
          {error && (
            <div style={{ background: '#f5ebe8', border: '1px solid var(--accent-soft)', borderRadius: 6, padding: '12px 16px', marginBottom: 20, color: 'var(--accent)', fontSize: 14 }}>
              ⚠ {error}
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: 'var(--ink-faint)' }}>
              <p className="font-display" style={{ fontStyle: 'italic' }}>Loading shelf…</p>
            </div>
          ) : books.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <p className="font-display" style={{ fontSize: 28, color: 'var(--rule-dark)', fontStyle: 'italic', marginBottom: 12 }}>
                {shelfView === 'mine' ? 'Your shelf is empty' : 'Nothing here yet'}
              </p>
              <p style={{ color: 'var(--ink-faint)', marginBottom: 20 }}>
                {shelfView === 'mine' ? 'Add your first AO3 work to get started' : 'Be the first to add a work!'}
              </p>
              <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Work</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
              {books.map(book => (
                <BookCard key={book.id} book={book} onClick={() => setSelectedBook(book)} />
              ))}
            </div>
          )}
        </main>

        {/* Activity sidebar */}
        <aside>
          <div style={{ position: 'sticky', top: 100 }}>
            <p style={{ fontSize: 12, fontFamily: 'DM Mono', color: 'var(--ink-faint)', letterSpacing: '0.08em', marginBottom: 14 }}>
              RECENT ACTIVITY
            </p>
            <ActivityFeed />
          </div>
        </aside>
      </div>

      {/* Click outside to close user menu */}
      {showUserMenu && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 29 }} onClick={() => setShowUserMenu(false)} />
      )}

      {showAdd && <AddBookModal onClose={() => setShowAdd(false)} onAdded={handleBookAdded} />}
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
