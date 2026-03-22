'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Props {
  value: string[]           // current selected tags
  onChange: (tags: string[]) => void
  placeholder?: string
}

export default function TagInput({ value, onChange, placeholder = 'Add a tag…' }: Props) {
  const [inputText,    setInputText]    = useState('')
  const [suggestions,  setSuggestions]  = useState<string[]>([])
  const [allTags,      setAllTags]      = useState<string[]>([])
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const [open,         setOpen]         = useState(false)
  const inputRef  = useRef<HTMLInputElement>(null)
  const listRef   = useRef<HTMLUListElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch all existing tags once on mount
  useEffect(() => {
    fetch('/api/tags')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAllTags(data) })
      .catch(() => {})
  }, [])

  // Filter suggestions as user types
  useEffect(() => {
    const q = inputText.trim().toLowerCase()
    if (!q) { setSuggestions([]); setOpen(false); return }

    const filtered = allTags
      .filter(t => t.toLowerCase().includes(q) && !value.includes(t))
      .slice(0, 8)

    setSuggestions(filtered)
    setOpen(filtered.length > 0 || q.length > 0)
    setHighlightIdx(-1)
  }, [inputText, allTags, value])

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const addTag = useCallback((tag: string) => {
    const trimmed = tag.trim()
    if (!trimmed || value.includes(trimmed)) return
    onChange([...value, trimmed])
    setInputText('')
    setSuggestions([])
    setOpen(false)
    setHighlightIdx(-1)
    inputRef.current?.focus()
  }, [value, onChange])

  const removeTag = (tag: string) => {
    onChange(value.filter(t => t !== tag))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (highlightIdx >= 0 && suggestions[highlightIdx]) {
        addTag(suggestions[highlightIdx])
      } else if (inputText.trim()) {
        addTag(inputText)
      }
    } else if (e.key === 'Backspace' && !inputText && value.length > 0) {
      // Remove last tag on backspace when input is empty
      onChange(value.slice(0, -1))
    } else if (e.key === 'Escape') {
      setOpen(false)
      setHighlightIdx(-1)
    }
  }

  // Exact match at top, then partial matches
  const sortedSuggestions = suggestions.slice().sort((a, b) => {
    const q = inputText.trim().toLowerCase()
    const aStarts = a.toLowerCase().startsWith(q)
    const bStarts = b.toLowerCase().startsWith(q)
    if (aStarts && !bStarts) return -1
    if (!aStarts && bStarts) return 1
    return a.localeCompare(b)
  })

  // Show "create new" option if input doesn't exactly match any suggestion
  const showCreate = inputText.trim().length > 0 &&
    !allTags.map(t => t.toLowerCase()).includes(inputText.trim().toLowerCase()) &&
    !value.map(t => t.toLowerCase()).includes(inputText.trim().toLowerCase())

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Tag pills + input */}
      <div
        onClick={() => inputRef.current?.focus()}
        style={{
          display:      'flex',
          flexWrap:     'wrap',
          gap:          6,
          padding:      '6px 10px',
          background:   'var(--surface)',
          border:       `1px solid ${open ? 'var(--griffindor-gold)' : 'var(--border)'}`,
          borderRadius: open ? '4px 4px 0 0' : 4,
          minHeight:    38,
          cursor:       'text',
          transition:   'border-color 0.15s',
          boxShadow:    open ? '0 0 0 3px rgba(184,132,10,0.12)' : 'none',
        }}
      >
        {/* Selected tags */}
        {value.map(tag => (
          <span
            key={tag}
            style={{
              display:      'inline-flex',
              alignItems:   'center',
              gap:          4,
              padding:      '2px 8px 2px 10px',
              borderRadius: 20,
              background:   '#fdf8ee',
              border:       '1px solid var(--griffindor-gold)',
              fontSize:     12,
              fontFamily:   'JetBrains Mono, monospace',
              color:        'var(--ink-soft)',
              lineHeight:   1.4,
            }}
          >
            {tag}
            <button
              onClick={e => { e.stopPropagation(); removeTag(tag) }}
              style={{
                background:  'none',
                border:      'none',
                cursor:      'pointer',
                color:       'var(--ink-ghost)',
                fontSize:    14,
                lineHeight:  1,
                padding:     '0 0 0 2px',
                display:     'flex',
                alignItems:  'center',
              }}
              title={`Remove "${tag}"`}
            >
              ×
            </button>
          </span>
        ))}

        {/* Text input */}
        <input
          ref={inputRef}
          value={inputText}
          onChange={e => { setInputText(e.target.value); setOpen(true) }}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (inputText.trim()) setOpen(true) }}
          placeholder={value.length === 0 ? placeholder : ''}
          style={{
            border:      'none',
            outline:     'none',
            background:  'transparent',
            fontSize:    13,
            fontFamily:  'Crimson Pro, serif',
            color:       'var(--ink)',
            minWidth:    120,
            flex:        1,
            padding:     '2px 0',
          }}
        />
      </div>

      {/* Dropdown */}
      {open && (sortedSuggestions.length > 0 || showCreate) && (
        <ul
          ref={listRef}
          style={{
            position:     'absolute',
            top:          '100%',
            left:         0,
            right:        0,
            background:   'var(--surface)',
            border:       '1px solid var(--griffindor-gold)',
            borderTop:    'none',
            borderRadius: '0 0 4px 4px',
            margin:       0,
            padding:      4,
            listStyle:    'none',
            zIndex:       100,
            boxShadow:    'var(--shadow-md)',
            maxHeight:    220,
            overflowY:    'auto',
          }}
        >
          {sortedSuggestions.map((tag, i) => {
            const q     = inputText.trim().toLowerCase()
            const idx   = tag.toLowerCase().indexOf(q)
            const before = tag.slice(0, idx)
            const match  = tag.slice(idx, idx + q.length)
            const after  = tag.slice(idx + q.length)

            return (
              <li
                key={tag}
                onMouseDown={e => { e.preventDefault(); addTag(tag) }}
                onMouseEnter={() => setHighlightIdx(i)}
                style={{
                  padding:      '7px 10px',
                  borderRadius: 3,
                  cursor:       'pointer',
                  fontSize:     13,
                  fontFamily:   'JetBrains Mono, monospace',
                  color:        highlightIdx === i ? 'var(--ink)' : 'var(--ink-soft)',
                  background:   highlightIdx === i ? '#fdf8ee' : 'transparent',
                  transition:   'background 0.1s',
                  display:      'flex',
                  alignItems:   'center',
                  gap:          8,
                }}
              >
                <span style={{ color: 'var(--ink-ghost)', fontSize: 10 }}>✦</span>
                <span>
                  {before}
                  <strong style={{ color: 'var(--griffindor-gold)', fontWeight: 700 }}>{match}</strong>
                  {after}
                </span>
              </li>
            )
          })}

          {/* Create new tag option */}
          {showCreate && (
            <li
              onMouseDown={e => { e.preventDefault(); addTag(inputText.trim()) }}
              onMouseEnter={() => setHighlightIdx(sortedSuggestions.length)}
              style={{
                padding:      '7px 10px',
                borderRadius: 3,
                cursor:       'pointer',
                fontSize:     13,
                fontFamily:   'JetBrains Mono, monospace',
                color:        highlightIdx === sortedSuggestions.length ? 'var(--ink)' : 'var(--ink-muted)',
                background:   highlightIdx === sortedSuggestions.length ? '#fdf8ee' : 'transparent',
                borderTop:    sortedSuggestions.length > 0 ? '1px solid var(--border)' : 'none',
                marginTop:    sortedSuggestions.length > 0 ? 4 : 0,
                display:      'flex',
                alignItems:   'center',
                gap:          8,
                transition:   'background 0.1s',
              }}
            >
              <span style={{ color: 'var(--griffindor-gold)', fontSize: 12 }}>+</span>
              <span>Create <strong style={{ fontWeight: 600 }}>&ldquo;{inputText.trim()}&rdquo;</strong></span>
            </li>
          )}
        </ul>
      )}

      <p style={{ fontSize: 11, color: 'var(--ink-ghost)', fontFamily: 'JetBrains Mono, monospace', margin: '5px 0 0', letterSpacing: '0.04em' }}>
        Type to search · Enter or , to add · Backspace to remove
      </p>
    </div>
  )
}