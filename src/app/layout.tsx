import type { Metadata } from 'next';
import './globals.css';
import { AppDialogProvider } from '@/providers/AppDialogProvider';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Gestão Eclesial - Login',
  description: 'Sistema de Administração Ministerial',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <head>
      </head>
      <body className="antialiased bg-white">
        <AppDialogProvider>
          {children}
        </AppDialogProvider>
      </body>
    </html>
  );
}
