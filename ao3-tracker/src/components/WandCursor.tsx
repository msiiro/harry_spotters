'use client'

import { useEffect, useRef, useCallback } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  type: 'dust' | 'spark'
}

interface WandCursorProps {
  enabled: boolean
}

const DUST_COLORS_LIGHT = ['#b8840a', '#d4a832', '#b83030', '#8b1a1a', '#e8c86a', '#f0d090']
const DUST_COLORS_DARK  = ['#52b788', '#a8c5a0', '#7ec8a0', '#3d8c5c', '#c0d8b0', '#ddeae0']

// Fixed angle matching a standard cursor (pointing top-left, rotated 45deg)
const WAND_ANGLE = Math.PI / 4

function getDustColors(): string[] {
  if (typeof document === 'undefined') return DUST_COLORS_LIGHT
  return document.documentElement.getAttribute('data-theme') === 'dark'
    ? DUST_COLORS_DARK
    : DUST_COLORS_LIGHT
}

export default function WandCursor({ enabled }: WandCursorProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const particles  = useRef<Particle[]>([])
  const mousePos   = useRef({ x: -200, y: -200 })
  const rafRef     = useRef<number>(0)

  const spawnDust = useCallback((x: number, y: number) => {
    const colors = getDustColors()
    // Bottom of shaft in local coords is (0, 30) — rotate by WAND_ANGLE for world offset
    const baseX = x - Math.cos(WAND_ANGLE) * 30
    const baseY = y + Math.sin(WAND_ANGLE) * 30
    for (let i = 0; i < 3; i++) {
      const baseAngle = Math.random() * Math.PI * 2
      particles.current.push({
        x: baseX + (Math.random() - 0.5) * 3,
        y: baseY + (Math.random() - 0.5) * 3,
        vx: Math.cos(baseAngle) * (0.2 + Math.random() * 0.6),
        vy: Math.sin(baseAngle) * (0.2 + Math.random() * 0.6) - 0.4,
        life: 1,
        maxLife: 28 + Math.random() * 28,
        size: 1.05 + Math.random() * 1.4,
        color: colors[Math.floor(Math.random() * colors.length)],
        type: 'dust',
      })
    }
  }, [])

  const spawnSparks = useCallback((x: number, y: number) => {
    const colors = getDustColors()
    const count = 24
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4
      const speed = 4 + Math.random() * 8
      particles.current.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 1,
        maxLife: 30 + Math.random() * 25,
        size: 3 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        type: 'spark',
      })
    }
  }, [])

  const drawWand = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(WAND_ANGLE)

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'

    // Wand shaft
    const grad = ctx.createLinearGradient(-2, 0, 2, 0)
    if (isDark) {
      grad.addColorStop(0,   '#2a4a38')
      grad.addColorStop(0.4, '#4a7a60')
      grad.addColorStop(1,   '#1a3028')
    } else {
      grad.addColorStop(0,   '#3d1810')
      grad.addColorStop(0.4, '#7a3d26')
      grad.addColorStop(1,   '#2a0f0a')
    }

    ctx.beginPath()
    ctx.moveTo(0, 4)
    ctx.lineTo(0, 30)
    ctx.lineWidth = 3.5
    ctx.strokeStyle = grad
    ctx.lineCap = 'round'
    ctx.stroke()

    // Taper toward tip (no circle — just the point)
    ctx.beginPath()
    ctx.moveTo(-1.5, 4)
    ctx.lineTo(1.5, 4)
    ctx.lineTo(0, -10)
    ctx.closePath()
    ctx.fillStyle = isDark ? '#3d6a50' : '#5c2a1a'
    ctx.fill()

    // Handle wrap bands
    const bandColor = isDark ? '#52b788' : '#b8840a'
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(-2.5, 12 + i * 6)
      ctx.lineTo(2.5, 12 + i * 6)
      ctx.lineWidth = 1.2
      ctx.strokeStyle = bandColor
      ctx.stroke()
    }

    ctx.restore()
  }, [])

  const loop = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const mx = mousePos.current.x
    const my = mousePos.current.y

    // Update & draw particles
    particles.current = particles.current.filter(p => p.life > 0)
    for (const p of particles.current) {
      p.x  += p.vx
      p.y  += p.vy
      p.vy += 0.06  // gravity
      p.vx *= 0.97
      p.vy *= 0.97
      p.life -= 1 / p.maxLife

      const alpha = p.life * (p.type === 'dust' ? 0.4 : 0.9)
      const size  = p.size * (p.type === 'spark' ? p.life : 1)

      ctx.beginPath()
      ctx.arc(p.x, p.y, Math.max(0.1, size), 0, Math.PI * 2)
      ctx.fillStyle = p.color
      ctx.globalAlpha = alpha
      ctx.fill()
    }

    ctx.globalAlpha = 1

    // Draw wand at cursor
    if (mx > 0) drawWand(ctx, mx, my)

    rafRef.current = requestAnimationFrame(loop)
  }, [drawWand])

  useEffect(() => {
    if (!enabled) return

    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const onMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY }
      spawnDust(e.clientX, e.clientY)
    }
    const onClick = (e: MouseEvent) => {
      spawnSparks(e.clientX, e.clientY)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('click', onClick)

    rafRef.current = requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('click', onClick)
      cancelAnimationFrame(rafRef.current)
      particles.current = []
    }
  }, [enabled, loop, spawnDust, spawnSparks])

  if (!enabled) return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
        cursor: 'none',
      }}
    />
  )
}