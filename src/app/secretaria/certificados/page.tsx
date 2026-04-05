'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { createClient } from '@/lib/supabase-client';
import { loadCertificadosTemplatesForCurrentUser } from '@/lib/certificados-templates-sync';

interface CertificadoTemplate {
  id: string;
  nome: string;
  backgroundUrl?: string;
  elementos: any[];
  orientacao?: string;
  ativo?: boolean;
}

export default function SecretariaCertificadosPage() {
  const { loading } = useRequireSupabaseAuth();
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [activeMenu, setActiveMenu] = useState('certificados');
  const [templates, setTemplates] = useState<CertificadoTemplate[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (loading) return;
    (async () => {
      const res = await loadCertificadosTemplatesForCurrentUser(supabase);
      setTemplates(res.templates as CertificadoTemplate[]);
      setLoadingData(false);
    })();
  }, [loading, supabase]);

  if (loading || loadingData) return <div className="p-8">Carregando...</div>;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Certificados</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Modelos de certificado criados pela sua organizacao
            </p>
          </div>
          <button
            onClick={() => router.push('/configuracoes/certificados')}
            className="px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition shadow"
          >
            Gerenciar Modelos
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 text-sm gap-4">
              <p className="text-5xl font-light text-gray-300">+</p>
              <p>Nenhum modelo de certificado criado ainda.</p>
              <button
                onClick={() => router.push('/configuracoes/certificados')}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
              >
                Criar Primeiro Modelo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition overflow-hidden group"
                >
                  {/* Preview */}
                  <div
                    className="w-full h-40 relative overflow-hidden"
                    style={
                      t.backgroundUrl
                        ? {
                            backgroundImage: `url(${t.backgroundUrl})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }
                        : { background: 'linear-gradient(135deg,#dbeafe 0%,#eef2ff 100%)' }
                    }
                  >
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition" />
                    <div className="absolute bottom-2 right-2 bg-white/90 text-gray-600 text-[10px] font-medium px-2 py-0.5 rounded">
                      {t.elementos?.length ?? 0} elem.
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-800 text-sm truncate">{t.nome}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {t.orientacao === 'portrait' ? 'Retrato' : 'Paisagem'} &middot; Ministerial
                    </p>
                    <button
                      className="mt-3 w-full px-3 py-1.5 bg-[#123b63] text-white text-xs font-semibold rounded-lg hover:bg-[#0f2a45] transition"
                      onClick={() => router.push('/configuracoes/certificados')}
                    >
                      Editar Modelo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
