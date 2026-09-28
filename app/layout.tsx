import type { Metadata, Viewport } from 'next'
import { Inter, Manrope } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ReminderPopup } from '@/components/reminder-popup'
import './globals.css'

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Pinch-to-zoom is deliberately allowed: the bungalow cards, calendar and schedule
  // tables carry a lot of fine print on a phone. The cap is 5x, which is what the
  // browser uses for images. The staff till (/staff) keeps zoom locked in its own layout.
  maximumScale: 5,
  userScalable: true,
  themeColor: '#071c24',
}

export const metadata: Metadata = {
  title: 'Komba Cabana - Poslovni Sistem',
  description: 'Boutique island management dashboard for bungalows, guests, transfers, excursions and delivery notes',
  generator: 'v0.app',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Komba Cabana',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <body className="font-sans antialiased bg-[#071c24]">
        {children}
        {/* Sits above every page: a tapped reminder must show up wherever he is. */}
        <ReminderPopup />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
