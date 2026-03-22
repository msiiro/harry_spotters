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
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Ambient glow spots — subtle on light bg */}
      <div style={{
        position: 'fixed',
        top: '20%', left: '15%',
        width: 500, height: 500,
        background: 'radial-gradient(circle, rgba(184,132,10,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed',
        bottom: '20%', right: '15%',
        width: 400, height: 400,
        background: 'radial-gradient(circle, rgba(38,92,58,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}>

        {/* Masthead */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          {/* Decorative top rule */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 20,
            justifyContent: 'center',
          }}>
            <div style={{ height: 1, width: 48, background: 'linear-gradient(90deg, transparent, var(--griffindor-gold))' }} />
            <span style={{ color: 'var(--griffindor-gold)', fontSize: 12, opacity: 0.7 }}>✦</span>
            <div style={{ height: 1, width: 48, background: 'linear-gradient(90deg, var(--griffindor-gold), transparent)' }} />
          </div>

          <h1 className="font-display" style={{
            fontSize: 'clamp(32px, 8vw, 44px)',
            fontWeight: 600,
            margin: '0 0 6px',
            letterSpacing: '-0.02em',
            color: 'var(--ink)',
            lineHeight: 1.1,
          }}>
            The Vanishing<br />Cabinet
          </h1>
          <p className="font-mono" style={{
            color: 'var(--griffindor-gold)',
            fontSize: 10,
            letterSpacing: '0.2em',
            opacity: 0.75,
            marginTop: 10,
          }}>
            ✦ AO3 READING TRACKER ✦
          </p>
        </div>

        {/* Auth card */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
        }}>

          {/* Slytherin/Gryffindor house bar */}
          <div style={{
            height: 3,
            background: 'linear-gradient(90deg, var(--griffindor-crimson) 0%, var(--griffindor-gold) 50%, var(--slytherin-emerald) 100%)',
          }} />

          <div style={{ padding: '28px 28px 24px' }}>
            {/* Tab switcher */}
            <div style={{ display: 'flex', marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
              {(['login', 'signup'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(null) }}
                  style={{
                    flex: 1,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px 0 12px',
                    fontFamily: 'Cormorant Garamond, serif',
                    fontSize: 17,
                    fontWeight: mode === m ? 600 : 400,
                    fontStyle: mode === m ? 'normal' : 'italic',
                    color: mode === m ? 'var(--griffindor-red)' : 'var(--ink-muted)',
                    borderBottom: mode === m ? '2px solid var(--griffindor-gold)' : '2px solid transparent',
                    marginBottom: -1,
                    transition: 'all 0.2s',
                    letterSpacing: '0.01em',
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
                    <label style={{ display: 'block', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em', marginBottom: 6, color: 'var(--ink-muted)' }}>
                      USERNAME
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
                  <label style={{ display: 'block', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em', marginBottom: 6, color: 'var(--ink-muted)' }}>
                    EMAIL
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
                  <label style={{ display: 'block', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em', marginBottom: 6, color: 'var(--ink-muted)' }}>
                    PASSWORD
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
                  <p style={{
                    color: 'var(--griffindor-red)',
                    fontSize: 13,
                    margin: 0,
                    fontFamily: 'Crimson Pro, serif',
                    padding: '8px 10px',
                    background: 'rgba(139,26,26,0.08)',
                    borderRadius: 3,
                    border: '1px solid rgba(139,26,26,0.2)',
                  }}>
                    ⚠ {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                  style={{ marginTop: 6, width: '100%', padding: '11px 0', fontSize: 12, letterSpacing: '0.12em' }}
                >
                  {loading ? '…' : mode === 'login' ? 'ENTER THE CABINET' : 'CREATE ACCOUNT'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Footer caption */}
        <p style={{
          textAlign: 'center',
          marginTop: 24,
          fontSize: 12,
          color: 'var(--ink-ghost)',
          fontFamily: 'Crimson Pro, serif',
          fontStyle: 'italic',
          opacity: 0.7,
        }}>
          A reading tracker for the bibliophile in you
        </p>
      </div>
    </div>
  )
}