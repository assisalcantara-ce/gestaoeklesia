import { redirect } from 'next/navigation';

// A emissão de carteirinhas está integrada diretamente em /ebd/alunos.
export default function CarteirinhaPage() {
  redirect('/ebd/alunos');
}
