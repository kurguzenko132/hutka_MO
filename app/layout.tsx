import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hutka — Beauty Growth OS',
  description: 'Внутренняя маркетинговая система для запуска CRM и карты beauty-мастеров.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
