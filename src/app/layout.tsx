import type { Metadata } from 'next';
import './globals.css';
import { AppDialogProvider } from '@/providers/AppDialogProvider';
import { AuthProvider } from '@/providers/AuthProvider';
import { UsuarioProvider } from '@/providers/UsuarioContext';
import { TrialGuard } from '@/components/TrialGuard';
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
      </head>
      <body className="antialiased bg-white">
        <AuthProvider>
          <UsuarioProvider>
            <AppDialogProvider>
              <TrialGuard>
                <AppShell>
                  {children}
                </AppShell>
              </TrialGuard>
            </AppDialogProvider>
          </UsuarioProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
