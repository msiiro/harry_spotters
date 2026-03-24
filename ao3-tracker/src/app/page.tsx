'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Book } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { authFetch } from '@/lib/api'
import BookCard from '@/components/BookCard'
import AddBookModal from '@/components/AddBookModal'
import BookDetailModal from '@/components/BookDetailModal'
import ActivityFeed from '@/components/ActivityFeed'
import Avatar from '@/components/Avatar'

const STATUS_TABS = [
  { key: 'all',          label: 'All' },
  { key: 'want_to_read', label: 'Want to Read' },
  { key: 'reading',      label: 'Reading' },
  { key: 'finished',     label: 'Finished' },
  { key: 'dropped',      label: 'Dropped' },
]

interface Profile {
  id: string
  username: string
  display_name: string | null
  avatar_color: string | null
}

export default function Home() {
  const { user, profile, loading: authLoading, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const router = useRouter()

  const [books, setBooks]               = useState<Book[]>([])
  const [loading, setLoading]           = useState(true)
  const [activeStatus, setActiveStatus] = useState('all')
  const [searchInput, setSearchInput]   = useState('')
  const [search, setSearch]             = useState('')
  const [filterUserId, setFilterUserId] = useState<string | null>(null)
  const [profiles, setProfiles]         = useState<Profile[]>([])
  const [showAdd, setShowAdd]           = useState(false)
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showMobileSearch, setShowMobileSearch] = useState(false)
  const [error, setError]               = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth')
  }, [authLoading, user, router])

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    if (!user) return
    authFetch('/api/users')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setProfiles(data) })
      .catch(() => {})
  }, [user])

  const fetchBooks = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (activeStatus !== 'all') params.set('status', activeStatus)
      if (search) params.set('search', search)
      // null filterUserId = "My Shelf" (current user)
      // set filterUserId = a specific other user
      params.set('user_id', filterUserId ?? user.id)

      const res  = await authFetch(`/api/books?${params}`)
      const data = await res.json()
      if (Array.isArray(data)) setBooks(data)
      else setError(data.error || 'Failed to load books')
    } catch {
      setError('Failed to connect to database')
    } finally {
      setLoading(false)
    }
  }, [user, activeStatus, search, filterUserId])

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

  const handleCopyToMyShelf = async (book: Book): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res  = await authFetch('/api/books/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_book_id: book.id }),
      })
      const data = await res.json()
      if (!res.ok) return { ok: false, error: data.error || 'Failed to copy' }
      return { ok: true }
    } catch {
      return { ok: false, error: 'Network error' }
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth')
  }

  const stats = {
    total:    books.length,
    finished: books.filter(b => b.reading_status === 'finished').length,
    words:    books
      .filter(b => b.reading_status === 'finished' && b.word_count)
      .reduce((s, b) => s + (b.word_count || 0), 0),
  }
  const formatWords = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000   ? `${(n / 1_000).toFixed(0)}K`
    : String(n)

  const filterProfile  = profiles.find(p => p.id === filterUserId)
  const otherProfiles  = profiles.filter(p => p.id !== user?.id)
  const isMyShelf      = filterUserId === null

  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p className="font-display" style={{ color: 'var(--ink-ghost)', fontSize: 22, fontStyle: 'italic', fontWeight: 300 }}>
        Opening the cabinet…
      </p>
    </div>
  )
  if (!user) return null

  return (
    <div style={{ minHeight: '100vh' }}>

      {/* ═══════════════ HEADER ═══════════════ */}
      <header className="site-header">
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px' }}>

          {/* Top row: logo + stats + actions */}
          <div className="header-inner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0 10px' }}>
            <div className="header-top-row" style={{ display: 'contents' }}>

              <div style={{ flexShrink: 0 }}>
                <h1 className="font-display" style={{ fontSize: 'clamp(18px, 4vw, 26px)', fontWeight: 600, color: 'var(--ink)', margin: 0, letterSpacing: '-0.01em', lineHeight: 1.1 }}>
                  The Vanishing Cabinet
                </h1>
                <p className="font-mono" style={{ fontSize: 9, color: 'var(--griffindor-gold)', margin: '3px 0 0', letterSpacing: '0.18em', opacity: 0.9 }}>
                  ✦ FANFIC TRACKER ✦
                </p>
              </div>

              <div className="header-stats" style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                {[
                  { value: stats.total,             label: 'TRACKED' },
                  { value: stats.finished,           label: 'FINISHED' },
                  { value: formatWords(stats.words), label: 'WORDS' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div className="font-display" style={{ fontSize: 'clamp(16px, 3vw, 22px)', fontWeight: 600, color: 'var(--griffindor-crimson)', lineHeight: 1 }}>
                      {s.value}
                    </div>
                    <div className="stat-item-label font-mono" style={{ fontSize: 9, color: 'var(--ink-ghost)', letterSpacing: '0.1em', marginTop: 2 }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>

              <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => setShowMobileSearch(v => !v)} className="mobile-search-btn" style={{ display: 'none', background: 'none', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--ink-ghost)', padding: '6px 10px', cursor: 'pointer', fontSize: 14 }}>
                  🔍
                </button>

                <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Work</button>

                <button
                  className="theme-toggle"
                  onClick={toggleTheme}
                  title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
                >
                  {theme === 'light' ? '🌙' : '☀️'}
                </button>

                <div style={{ position: 'relative' }}>
                  <button onClick={() => setShowUserMenu(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <Avatar username={profile?.username || '?'} displayName={profile?.display_name} color={profile?.avatar_color} size={32} />
                  </button>
                  {showUserMenu && (
                    <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, boxShadow: 'var(--shadow-lg)', minWidth: 160, zIndex: 60 }}>
                      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                        <p className="font-display" style={{ margin: 0, fontSize: 15, color: 'var(--ink)', fontWeight: 600 }}>{profile?.display_name || profile?.username}</p>
                        <p className="font-mono" style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--ink-ghost)' }}>@{profile?.username}</p>
                      </div>
                      <button onClick={handleSignOut} style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: 'var(--ink-soft)', fontFamily: 'Crimson Pro, serif' }}>
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="gold-rule" />

          {/* ── Nav row: person filter + status tabs + search ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 2 }}>
            <div className="nav-row" style={{ flex: 1, overflowX: 'auto' }}>
              <div className="nav-inner" style={{ display: 'flex', alignItems: 'center', gap: 0 }}>

                {/* Person selector: My Shelf | Person 1 | Person 2 … */}
                <button
                  onClick={() => setFilterUserId(null)}
                  className={`person-tab${isMyShelf ? ' active' : ''}`}
                >
                  My Shelf
                </button>

                {otherProfiles.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setFilterUserId(prev => prev === p.id ? null : p.id)}
                    className={`person-tab${filterUserId === p.id ? ' active' : ''}`}
                    title={p.display_name || p.username}
                  >
                    <Avatar username={p.username} displayName={p.display_name} color={p.avatar_color ?? undefined} size={18} />
                    <span>{p.display_name || p.username}</span>
                  </button>
                ))}

                {/* Divider */}
                <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 6px', flexShrink: 0 }} />

                {/* Status tabs */}
                {STATUS_TABS.map(tab => (
                  <button key={tab.key} onClick={() => setActiveStatus(tab.key)} className={`nav-tab${activeStatus === tab.key ? ' active' : ''}`}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="search-input-wrap" style={{ flexShrink: 0 }}>
              <input className="input-field-dark" value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search titles…" style={{ width: 180 }} />
            </div>
          </div>

          {showMobileSearch && (
            <div style={{ padding: '8px 0 10px' }}>
              <input className="input-field-dark" value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search titles…" style={{ width: '100%' }} autoFocus />
            </div>
          )}
        </div>
      </header>

      {/* ═══════════════ MAIN ═══════════════ */}
      <div className="main-layout" style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 20px', display: 'grid', gridTemplateColumns: '1fr 280px', gap: 32 }}>
        <main>

          {/* Viewing someone else's shelf — banner */}
          {filterProfile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, borderLeft: '3px solid var(--griffindor-gold)' }}>
              <Avatar username={filterProfile.username} displayName={filterProfile.display_name} color={filterProfile.avatar_color ?? undefined} size={28} />
              <div style={{ flex: 1 }}>
                <span className="font-display" style={{ fontSize: 15, color: 'var(--ink)', fontWeight: 600 }}>
                  {filterProfile.display_name || filterProfile.username}&apos;s shelf
                </span>
                <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-ghost)', marginLeft: 8 }}>
                  — click any card to add it to yours
                </span>
              </div>
              <button onClick={() => setFilterUserId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-ghost)', fontSize: 18, lineHeight: 1, padding: '0 4px' }} title="Clear filter">×</button>
            </div>
          )}

          {error && (
            <div style={{ background: 'var(--accent-pale)', border: '1px solid var(--border-warm)', borderRadius: 4, padding: '12px 16px', marginBottom: 20, color: 'var(--accent)', fontSize: 14 }}>
              ⚠ {error}
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
              <p className="font-display" style={{ fontStyle: 'italic', color: 'var(--ink-ghost)', fontSize: 20 }}>Searching the shelves…</p>
            </div>
          ) : books.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <p className="font-display" style={{ fontSize: 'clamp(22px, 5vw, 30px)', color: 'var(--ink-ghost)', fontStyle: 'italic', marginBottom: 12, fontWeight: 300 }}>
                {isMyShelf
                  ? 'Your shelf awaits…'
                  : `${filterProfile?.display_name || filterProfile?.username} hasn't added anything yet`}
              </p>
              <p style={{ color: 'var(--ink-ghost)', marginBottom: 24, fontSize: 15 }}>
                {isMyShelf ? 'Add your first work to begin the collection' : 'Be the first to add a work to the cabinet'}
              </p>
              {isMyShelf && <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Work</button>}
            </div>
          ) : (
            <div className="book-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {books.map(book => (
                <BookCard
                  key={book.id}
                  book={book}
                  onClick={() => setSelectedBook(book)}
                  showCopyHint={!!filterUserId && book.user_id !== user.id}
                />
              ))}
            </div>
          )}
        </main>

        <aside className="aside-panel">
          <div style={{ position: 'sticky', top: 90 }}>
            <div className="section-ornament" style={{ marginBottom: 16 }}>Recent Activity</div>
            <ActivityFeed />
          </div>
        </aside>
      </div>

      {showUserMenu && <div style={{ position: 'fixed', inset: 0, zIndex: 55 }} onClick={() => setShowUserMenu(false)} />}

      {showAdd && <AddBookModal onClose={() => setShowAdd(false)} onAdded={handleBookAdded} />}

      {selectedBook && (
        <BookDetailModal
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
          onUpdated={handleBookUpdated}
          onDeleted={handleBookDeleted}
          isOwnBook={selectedBook.user_id === user.id}
          onCopyToMyShelf={handleCopyToMyShelf}
        />
      )}

      <style>{`
        /* Person selector tabs — same row as nav tabs */
        .person-tab {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 10px 12px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ink-ghost);
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          transition: color 0.2s, border-color 0.2s;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .person-tab:hover { color: var(--ink-muted); }
        .person-tab.active {
          color: var(--griffindor-crimson);
          border-bottom-color: var(--griffindor-gold);
        }

        .theme-toggle {
          background: var(--surface-tinted);
          border: 1px solid var(--border);
          border-radius: 3px;
          padding: 5px 9px;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.2s;
          line-height: 1;
          display: flex;
          align-items: center;
        }
        .theme-toggle:hover {
          border-color: var(--accent-gold);
          background: var(--surface);
        }

        @media (max-width: 768px) {
          .mobile-search-btn { display: block !important; }
          .search-input-wrap { display: none !important; }
          .aside-panel { display: none !important; }
          .main-layout { grid-template-columns: 1fr !important; }
          .book-grid { grid-template-columns: 1fr !important; }
          .header-inner { flex-wrap: wrap; gap: 10px; }
          .header-stats { gap: 16px !important; }
          .stat-item-label { display: none !important; }
        }
      `}</style>
    </div>
  )
}