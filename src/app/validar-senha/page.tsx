import { Suspense } from 'react';
import ValidarSenhaContent from './content';

export default function ValidarSenhaPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#123b63] to-[#0284c7]"><div className="text-white">Carregando...</div></div>}>
      <ValidarSenhaContent />
    </Suspense>
  );
}
