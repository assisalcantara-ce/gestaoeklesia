/**
 * Layout do App Mobile — /app/*
 *
 * Server component: permite export de metadata.
 * Renderiza o MobileShell (client) que fornece o MobileMemberProvider.
 * Herda o root layout (AuthProvider, etc.) automaticamente.
 */

import type { Metadata } from 'next';
import MobileShell from '@/components/mobile/MobileShell';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Gestão Eklesia — App',
  description: 'Portal do Membro — Gestão Eklesia',
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <MobileShell>{children}</MobileShell>;
}
