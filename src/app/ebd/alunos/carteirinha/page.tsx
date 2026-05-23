'use client';
import PageLayout from '@/components/PageLayout';
import { useRequireModulo } from '@/hooks/useRequireModulo';

export default function CarteirinhaPage() {
  const { ctx, bloqueado } = useRequireModulo('ebd');
  if (ctx.loading) return <div className="p-8">Carregando...</div>;
  if (bloqueado) return null;

  return (
    <PageLayout 
      title="Carteirinha do Aluno" 
      activeMenu="ebd-cadastro-alunos-carteirinha"
      description="Emissão e gerenciamento de carteirinhas dos alunos da EBD"
    >
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-700 mb-2">Carteirinha do Aluno</h2>
        <p className="text-gray-500">Emissão e gerenciamento de carteirinhas dos alunos da EBD.</p>
      </div>
    </PageLayout>
  );
}
