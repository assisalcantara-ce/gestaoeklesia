import { redirect } from 'next/navigation';

// Esta rota foi consolidada em /ebd/dashboard.
// O conteúdo (global ou local) é definido por permissão do usuário.
export default function EbdDashboardLocalPage() {
  redirect('/ebd/dashboard');
}
