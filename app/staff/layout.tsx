import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Komba Bar',
  description: 'Komba Cabana Bar Blagajna',
  manifest: '/bar-manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Komba Bar',
  },
  icons: {
    apple: '/bar-icon-192.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a2029',
}

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
