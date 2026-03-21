'use client'

import { useState, useEffect } from 'react'
import type { ActivityItem } from '@/lib/supabase'
import Avatar from './Avatar'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function Stars({ rating }: { rating: number | null }) {
  if (!rating) return null
  return (
    <span style={{ fontSize: 12, letterSpacing: 1 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ color: rating >= i ? 'var(--accent)' : 'var(--rule-dark)' }}>★</span>
      ))}
    </span>
  )
}

export default function ActivityFeed({ onSelectWork }: { onSelectWork?: (ao3Id: string) => void }) {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/activity?limit=30')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setItems(data) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ padding: '24px 0', color: 'var(--ink-faint)', fontSize: 13, textAlign: 'center' }}>
      Loading activity…
    </div>
  )

  if (items.length === 0) return (
    <div style={{ padding: '24px 0', color: 'var(--ink-faint)', fontSize: 13, textAlign: 'center' }}>
      No activity yet — be the first to add a work!
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {items.map(item => (
        <div
          key={`${item.id}`}
          onClick={() => onSelectWork?.(item.ao3_id)}
          style={{
            display: 'flex',
            gap: 12,
            padding: '12px 0',
            borderBottom: '1px solid var(--rule)',
            cursor: onSelectWork ? 'pointer' : 'default',
            transition: 'background 0.1s',
          }}
        >
          <Avatar
            username={item.username}
            displayName={item.display_name}
            color={item.avatar_color}
            size={34}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.4 }}>
              <span style={{ fontWeight: 600 }}>{item.display_name || item.username}</span>
              {' '}
              <span style={{ color: 'var(--ink-faint)' }}>
                {item.activity_type === 'finished' ? 'finished' : 'added'}
              </span>
              {' '}
              <span style={{ fontStyle: 'italic', fontFamily: 'Playfair Display, serif' }}>
                {item.title}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3 }}>
              {item.fandom && item.fandom[0] && (
                <span className="tag-pill fandom" style={{ fontSize: 10 }}>{item.fandom[0]}</span>
              )}
              {item.activity_type === 'finished' && item.your_rating && (
                <Stars rating={item.your_rating} />
              )}
              {item.word_count && (
                <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'DM Mono' }}>
                  {item.word_count >= 1000 ? `${(item.word_count/1000).toFixed(0)}K words` : item.word_count}
                </span>
              )}
              <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'DM Mono', marginLeft: 'auto' }}>
                {timeAgo(item.activity_type === 'finished' ? item.updated_at : item.created_at)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
