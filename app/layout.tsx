'use client';
import { usePathname } from 'next/navigation';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Toaster } from 'sonner';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  const isMessagesPage = pathname.startsWith('/messages');

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Nestly</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        />
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            if (localStorage.getItem('userRole') === 'landlord') {
              document.documentElement.classList.add('is-landlord');
            }
            var theme = localStorage.getItem('theme');
            if (theme === 'light' || theme === 'dark') {
              document.documentElement.setAttribute('data-theme', theme);
            }
          } catch (e) {}
        `}} />
      </head>
      <body className={isHomePage ? 'landing-page' : ''} suppressHydrationWarning>
        <Toaster position="bottom-right" richColors />
        <Navbar />
        <main style={{ flex: 1 }}>{children}</main>
        {!isMessagesPage && <Footer />}
      </body>
    </html>
  );
}
