import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'The Vanishing Cabinet — AO3 Reading Tracker',
  description: 'Track fanfiction you read with friends',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
