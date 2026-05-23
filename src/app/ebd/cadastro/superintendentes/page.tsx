'use client';

import { useEffect, useMemo, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import { Crown, Mail, Building2, Printer } from 'lucide-react';
import { fetchConfiguracaoIgrejaFromSupabase, type ConfiguracaoIgreja } from '@/lib/igreja-config-utils';

interface Superintendente {
  id: string;
  nome: string;
  email: string;
  congregacao?: string;
  congregacao_id?: string | null;
  status: 'ativo' | 'inativo';
}

interface Congregacao { id: string; nome: string; }

export default function EbdSuperintendentesPage() {
  const { user, loading: authLoading } = useRequireSupabaseAuth();
  const { bloqueado } = useRequireModulo('ebd');
  const supabase = useMemo(() => createClient(), []);

  const [loading,          setLoading]          = useState(false);
  const [superintendentes, setSuperintendentes] = useState<Superintendente[]>([]);
  const [congregacoes,     setCongregacoes]     = useState<Congregacao[]>([]);
  const [filtroCong,       setFiltroCong]       = useState('');
  const [erro,             setErro]             = useState('');
  const [configIgreja,     setConfigIgreja]     = useState<ConfiguracaoIgreja | null>(null);

  useEffect(() => {
    if (authLoading || !user || bloqueado) return;
    const carregar = async () => {
      setLoading(true);
      setErro('');
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) { setErro('Sessão expirada.'); setLoading(false); return; }

      const [res, congsRes, config] = await Promise.all([
        fetch('/api/usuarios', { headers: { Authorization: `Bearer ${token}` } }),
        supabase.from('congregacoes').select('id, nome').order('nome'),
        fetchConfiguracaoIgrejaFromSupabase(supabase),
      ]);

      setCongregacoes(congsRes.data ?? []);
      setConfigIgreja(config);

      if (!res.ok) { setErro('Falha ao carregar usuários.'); setLoading(false); return; }

      const payload = await res.json();
      const todos: Superintendente[] = (payload?.data ?? []).filter(
        (u: any) => u.nivel === 'superintendente'
      );
      setSuperintendentes(todos);
      setLoading(false);
    };
    carregar();
  }, [authLoading, user, bloqueado, supabase]);

  const lista = filtroCong
    ? superintendentes.filter(s => s.congregacao_id === filtroCong)
    : superintendentes;

  if (bloqueado) return null;

  return (
    <PageLayout
      title="EBD — Superintendentes"
      description="Lista de superintendentes da Escola Bíblica Dominical"
      activeMenu="ebd-cadastro-superintendente"
    >
      {/* Estilos de impressão */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden !important; }
          #super-print, #super-print * { visibility: visible !important; }
          #super-print {
            position: fixed !important;
            inset: 0 !important;
            width: 100% !important;
            padding: 24px 32px !important;
            background: white !important;
            font-size: 11pt !important;
          }
          .no-print { display: none !important; }
        }
      `}} />

      {/* Toolbar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-gray-500">Congregação:</label>
          <select
            value={filtroCong}
            onChange={e => setFiltroCong(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">Todas</option>
            {congregacoes.map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition"
        >
          <Printer className="h-4 w-4" />
          Imprimir
        </button>
      </div>

      {erro && (
        <div className="no-print mb-4 px-4 py-3 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200">
          {erro}
        </div>
      )}

      {loading && (
        <p className="no-print text-gray-400 text-sm py-8 text-center">Carregando...</p>
      )}

      {!loading && !erro && lista.length === 0 && (
        <div className="no-print text-center py-16 text-gray-400">
          <Crown className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Nenhum superintendente cadastrado.</p>
          <p className="text-xs mt-1">Os superintendentes são cadastrados no módulo <strong>Usuários</strong> com o nível <strong>Superintendente EBD</strong>.</p>
        </div>
      )}

      {!loading && lista.length > 0 && (
        <div id="super-print">
          {/* Timbre — visível apenas na impressão */}
          <div className="hidden print:block border-b border-gray-300 pb-4 mb-4">
            <div className="flex items-center gap-4">
              {configIgreja?.logo && (
                <img src={configIgreja.logo} alt="Logo" className="h-16 w-16 object-contain" />
              )}
              <div className="flex-1 text-center">
                <p className="text-xl font-bold text-gray-900">{configIgreja?.nome}</p>
                {configIgreja?.endereco && (
                  <p className="text-xs text-gray-600 mt-0.5">{configIgreja.endereco}</p>
                )}
                <p className="text-xs text-gray-600 mt-0.5">
                  {configIgreja?.telefone && `Tel: ${configIgreja.telefone}`}
                  {configIgreja?.telefone && configIgreja?.email && ' | '}
                  {configIgreja?.email && `Email: ${configIgreja.email}`}
                </p>
              </div>
              {configIgreja?.logo && <div className="w-16" />}
            </div>
          </div>

          {/* Título do documento */}
          <div className="hidden print:block mb-4">
            <h2 className="text-lg font-bold text-gray-800">Superintendentes EBD</h2>
            {filtroCong && (
              <p className="text-sm text-gray-600">Congregação: {congregacoes.find(c => c.id === filtroCong)?.nome}</p>
            )}
          </div>

          {/* Contador — tela apenas */}
          <p className="no-print text-xs text-gray-400 mb-4">
            {lista.length} superintendente{lista.length !== 1 ? 's' : ''} encontrado{lista.length !== 1 ? 's' : ''}
          </p>

          {/* Tabela */}
          <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">E-mail</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Congregação</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide no-print">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lista.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">{s.nome}</td>
                    <td className="px-4 py-3 text-gray-500">{s.email || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{s.congregacao || '— Acesso geral —'}</td>
                    <td className="px-4 py-3 no-print">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.status === 'ativo' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {s.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Rodapé de impressão */}
          <div className="hidden print:block mt-6 pt-4 border-t border-gray-200 text-xs text-gray-400 text-right">
            Emitido em {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })} — {configIgreja?.nome}
          </div>

          {/* Cards mobile — tela apenas */}
          <div className="sm:hidden no-print mt-4 space-y-3">
            {lista.map(s => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-800">{s.nome}</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    s.status === 'ativo' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {s.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                {s.congregacao && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Building2 className="h-3.5 w-3.5 text-gray-400" />
                    {s.congregacao}
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Mail className="h-3.5 w-3.5 text-gray-400" />
                  {s.email || '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageLayout>
  );
}
