import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Alexandria',
  description: 'Context that survives the next chat',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
