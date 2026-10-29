import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'UpdatePilot — Software Update Intelligence & Management Platform',
  description:
    'A Windows-first software update intelligence platform discovering installed software, comparing versions with trusted sources, and supporting safe user-confirmed updates.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-brand-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
