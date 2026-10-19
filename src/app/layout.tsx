import type { Metadata } from 'next';
import './globals.css';
import { AppDialogProvider } from '@/providers/AppDialogProvider';
import { AuthProvider } from '@/providers/AuthProvider';
import { UsuarioProvider } from '@/providers/UsuarioContext';
import { CurrentMinistryProvider } from '@/providers/CurrentMinistryProvider';
import { TrialGuard } from '@/components/TrialGuard';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppShell from '@/components/AppShell';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Gestão Eklesia — Gestão que fortalece sua igreja',
  description: 'Gestão Eklesia: organização, pessoas e finanças para igrejas.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <head>
        <link rel="preload" href="/fonts/GreatVibes-Regular.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Allura-Regular.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Allura&family=Caveat:wght@600;700&family=Great+Vibes&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased bg-white">
        <AuthProvider>
          <UsuarioProvider>
            <CurrentMinistryProvider>
              <AppDialogProvider>
                <TrialGuard>
                  <ProtectedRoute>
                    <AppShell>
                      {children}
                    </AppShell>
                  </ProtectedRoute>
                </TrialGuard>
              </AppDialogProvider>
            </CurrentMinistryProvider>
          </UsuarioProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
