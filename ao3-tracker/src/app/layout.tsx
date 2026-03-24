import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/auth'
import { ThemeProvider } from '@/lib/theme'

export const metadata: Metadata = {
  title: 'Fic Shelf — AO3 Reading Tracker',
  description: 'Track fanfiction you read with friends',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}