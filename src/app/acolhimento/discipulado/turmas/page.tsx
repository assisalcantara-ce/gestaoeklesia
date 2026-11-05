'use client';

/**
 * /acolhimento/discipulado/turmas — Retrocompatibilidade da Subrota de Turmas
 * Renderiza diretamente o componente TabTurmas dentro do PageLayout
 */

import { useState } from 'react';
import PageLayout from '@/components/PageLayout';
import NotificationModal from '@/components/NotificationModal';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import TabTurmas from './TabTurmas';

export default function DiscipuladoTurmasPage() {
  const { ctx, bloqueado } = useRequireModulo('secretaria');

  const [notification, setNotification] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
  });

  const notify = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
    setNotification({ isOpen: true, type, title, message });
  };

  if (bloqueado || !ctx?.ministryId) return null;

  return (
    <PageLayout
      title="Turmas do Discipulado"
      description="Gestão de turmas coletivas, matrículas, diário de classe e prontuário de 26 lições"
    >
      <TabTurmas ministryId={ctx.ministryId} onNotification={notify} />

      <NotificationModal
        isOpen={notification.isOpen}
        onClose={() => setNotification((prev) => ({ ...prev, isOpen: false }))}
        type={notification.type}
        title={notification.title}
        message={notification.message}
      />
    </PageLayout>
  );
}
