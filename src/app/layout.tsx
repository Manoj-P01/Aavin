import type { Metadata } from 'next';
import './globals.css';
import { LoadingProvider } from '@/context/LoadingContext';

export const metadata: Metadata = {
  title: 'Aavin Dashboard | NKL Dairy Union',
  description: 'Total Solids and Milk & Cream Stock Statement dashboard for Namakkal District Co-operative Milk Producers\' Union Ltd',
  keywords: 'aavin, dairy, milk, namakkal, total solids, stock statement, NKL',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🥛</text></svg>" />
      </head>
      <body>
        <LoadingProvider>
          {children}
        </LoadingProvider>
      </body>
    </html>
  );
}

