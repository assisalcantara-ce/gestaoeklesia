import type { Metadata } from 'next';
import './globals.css';
import { AppDialogProvider } from '@/providers/AppDialogProvider';
import { AuthProvider } from '@/providers/AuthProvider';
import { UsuarioProvider } from '@/providers/UsuarioContext';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'GESTAOSERVUS - Login',
  description: 'Sistema de Gestão para Instituições',
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
        <AuthProvider>
          <UsuarioProvider>
            <AppDialogProvider>
              {children}
            </AppDialogProvider>
          </UsuarioProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
