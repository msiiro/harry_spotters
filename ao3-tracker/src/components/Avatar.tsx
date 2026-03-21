'use client'

interface AvatarProps {
  username: string
  displayName?: string | null
  color?: string
  size?: number
}

export default function Avatar({ username, displayName, color = '#8b3a2a', size = 32 }: AvatarProps) {
  const initials = (displayName || username || '?').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.38,
      fontWeight: 600,
      color: 'white',
      fontFamily: 'DM Sans',
      flexShrink: 0,
      letterSpacing: '0.02em',
    }}>
      {initials}
    </div>
  )
}
