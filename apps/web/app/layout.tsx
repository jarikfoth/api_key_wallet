import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'API Key Wallet',
  description:
    'A personal wallet for your AI API keys. Connect once, use everywhere — without pasting four different keys into every app.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
