'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldOff } from 'lucide-react';

export default function AcessoNegadoPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
            <ShieldOff className="w-10 h-10 text-red-500" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-800 mb-2">Acesso Negado</h1>
        <p className="text-gray-500 text-sm mb-1">
          Você não tem permissão para acessar esta página.
        </p>
        <p className="text-gray-400 text-xs mb-8">
          Caso acredite que isso é um erro, entre em contato com o administrador do sistema.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => router.back()}
            className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition"
          >
            ← Voltar
          </button>
          <Link
            href="/dashboard"
            className="px-5 py-2.5 rounded-lg bg-[#123b63] text-white text-sm font-medium hover:bg-[#0f2a45] transition"
          >
            Ir para o Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
