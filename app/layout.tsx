import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Codex Gate Presenter',
  description: 'Upload, present, and share HTML decks.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
