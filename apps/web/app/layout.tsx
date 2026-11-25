import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar';

export const metadata: Metadata = {
  title: {
    default: 'BharatBite — Indian food, understood',
    template: '%s · BharatBite',
  },
  description:
    'Recognise Indian food, get nutrition you can trust, and track your day. Built around roti, dal, sabzi and regional cuisines — not adapted from a Western tracker.',
  applicationName: 'BharatBite',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'BharatBite' },
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  metadataBase: new URL('https://bharatbite.vercel.app'),
  openGraph: {
    title: 'BharatBite — Indian food, understood',
    description:
      'AI food recognition and nutrition tracking designed around Indian eating habits. Free scanning, free food database, no ads.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fdfbf7' },
    { media: '(prefers-color-scheme: dark)', color: '#12100e' },
  ],
  width: 'device-width',
  initialScale: 1,
};

const themeScript = `(function(){try{var t=localStorage.getItem('bb-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(t!=='light'&&d)){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
