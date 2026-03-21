'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'

export default function AuthPage() {
  const { signIn, signUp } = useAuth()
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const err = mode === 'login'
      ? await signIn(email, password)
      : await signUp(email, password, username)

    if (err) {
      setError(err)
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--paper)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 className="font-display" style={{ fontSize: 36, fontWeight: 900, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            Fic Shelf
          </h1>
          <p style={{ color: 'var(--ink-faint)', fontSize: 13, fontFamily: 'DM Mono', letterSpacing: '0.08em' }}>
            AO3 READING TRACKER
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'white',
          border: '1px solid var(--rule)',
          borderRadius: 8,
          padding: '32px 32px 28px',
          boxShadow: '0 4px 24px rgba(26,20,16,0.07)',
        }}>
          {/* Tab switcher */}
          <div style={{ display: 'flex', marginBottom: 28, borderBottom: '1px solid var(--rule)' }}>
            {(['login', 'signup'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null) }}
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '10px 0',
                  fontSize: 14,
                  fontFamily: 'DM Sans',
                  fontWeight: mode === m ? 600 : 400,
                  color: mode === m ? 'var(--accent)' : 'var(--ink-faint)',
                  borderBottom: mode === m ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: -1,
                  transition: 'all 0.15s',
                }}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {mode === 'signup' && (
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--ink-soft)' }}>
                    Username
                  </label>
                  <input
                    className="input-field"
                    value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                    placeholder="your_username"
                    required
                    autoComplete="username"
                  />
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--ink-soft)' }}>
                  Email
                </label>
                <input
                  className="input-field"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--ink-soft)' }}>
                  Password
                </label>
                <input
                  className="input-field"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                  required
                  minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              </div>

              {error && (
                <p style={{ color: 'var(--accent)', fontSize: 13, margin: 0 }}>⚠ {error}</p>
              )}

              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
                style={{ marginTop: 4, width: '100%', padding: '11px 0', fontSize: 14 }}
              >
                {loading ? '…' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </div>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--ink-faint)' }}>
          A reading tracker for AO3 works
        </p>
      </div>
    </div>
  )
}
