'use client'

import { useTheme } from '@/lib/theme'

interface AvatarProps {
  username: string
  displayName?: string | null
  color?: string
  size?: number
}

const LIGHT_DEFAULT = '#8b3a2a'  // Gryffindor crimson
const DARK_DEFAULT  = '#2d6a4f'  // Slytherin emerald

export default function Avatar({ username, displayName, color, size = 32 }: AvatarProps) {
  const { theme } = useTheme()
  const initials = (displayName || username || '?').slice(0, 2).toUpperCase()

  // Trust whatever color is stored in the DB.
  // Only swap the bare default (crimson) for the Slytherin emerald in dark mode.
  const resolvedColor = (color && color !== LIGHT_DEFAULT)
    ? color
    : theme === 'dark' ? DARK_DEFAULT : LIGHT_DEFAULT

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: resolvedColor,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.38,
      fontWeight: 600,
      color: 'white',
      fontFamily: 'DM Sans',
      flexShrink: 0,
      letterSpacing: '0.02em',
      transition: 'background 0.3s ease',
    }}>
      {initials}
    </div>
  )
}