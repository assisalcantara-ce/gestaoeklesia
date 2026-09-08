'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SecretariaCertificadosPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/configuracoes/certificados');
  }, [router]);

  return <div className="p-8 text-gray-500">Redirecionando para Configurações &gt; Certificados...</div>;
}
