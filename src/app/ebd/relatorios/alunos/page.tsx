import { redirect } from 'next/navigation';

// Os relatórios foram consolidados em /ebd/relatorios.
export default function RelatoriosAlunosPage() {
  redirect('/ebd/relatorios');
}
