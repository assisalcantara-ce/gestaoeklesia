'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import { resolveEbdScope } from '@/lib/cartoes-templates-sync';
import { useAppDialog } from '@/providers/AppDialogProvider';
import { fetchConfiguracaoIgrejaFromSupabase, type ConfiguracaoIgreja } from '@/lib/igreja-config-utils';
import { Plus, Pencil, Trash2, X, GraduationCap, Printer, Search } from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Congregacao  { id: string; nome: string; }
interface EbdProfessor {
  id: string; ministry_id: string; church_id: string | null;
  member_id: string | null; nome: string;
  telefone: string | null; email: string | null; ativo: boolean;
}
interface MembroSugestao { id: string; name: string; phone?: string; email?: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtFone = (v: string): string => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (!d) return '';
  if (d.length <= 2)  return `(${d}`;
  if (d.length <= 7)  return `(${d.slice(0,2)}) ${d.slice(2)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
};

// ─── Componente ───────────────────────────────────────────────────────────────
export default function EbdProfessoresPage() {
  const { user }  = useRequireSupabaseAuth();
  const { bloqueado } = useRequireModulo('ebd');
  const supabase  = useMemo(() => createClient(), []);
  const dialog    = useAppDialog();

  const [ministryId,   setMinistryId]   = useState<string | null>(null);
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
  const [professores,  setProfessores]  = useState<EbdProfessor[]>([]);
  const [configIgreja, setConfigIgreja] = useState<ConfiguracaoIgreja | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [msg,          setMsg]          = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [filtroCong,   setFiltroCong]   = useState('');

  // Form
  const [showForm,   setShowForm]   = useState(false);
  const [editProf,   setEditProf]   = useState<EbdProfessor | null>(null);
  const [form,       setForm]       = useState({ church_id: '', nome: '', telefone: '', email: '', member_id: '' });

  // Busca de membro
  const [buscaMembro,    setBuscaMembro]    = useState('');
  const [sugestoes,      setSugestoes]      = useState<MembroSugestao[]>([]);
  const [buscandoMembro, setBuscandoMembro] = useState(false);
  const buscaRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = (tipo: 'ok' | 'erro', texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 4000);
  };

  // ── Carregamento ────────────────────────────────────────────────────────────
  const load = useCallback(async (mid: string) => {
    setLoading(true);
    const [profsR, congsR] = await Promise.all([
      supabase.from('ebd_professores').select('*').eq('ministry_id', mid).order('nome'),
      supabase.from('congregacoes').select('id, nome').eq('ministry_id', mid).order('nome'),
    ]);
    setProfessores(profsR.data ?? []);
    setCongregacoes(congsR.data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!user || bloqueado) return;
    resolveEbdScope(supabase).then(async scope => {
      if (!scope.ministryId) return;
      setMinistryId(scope.ministryId);
      const config = await fetchConfiguracaoIgrejaFromSupabase(supabase);
      setConfigIgreja(config);
      load(scope.ministryId);
    });
  }, [user, bloqueado, supabase, load]);

  // ── Busca dinâmica de membros ────────────────────────────────────────────────
  useEffect(() => {
    if (buscaRef.current) clearTimeout(buscaRef.current);
    if (!ministryId || buscaMembro.length < 3) { setSugestoes([]); return; }

    buscaRef.current = setTimeout(async () => {
      setBuscandoMembro(true);
      const { data } = await supabase
        .from('members')
        .select('id, name, phone, email')
        .eq('ministry_id', ministryId)
        .eq('status', 'active')
        .ilike('name', `${buscaMembro}%`)
        .order('name')
        .limit(8);
      setSugestoes(data ?? []);
      setBuscandoMembro(false);
    }, 300);

    return () => { if (buscaRef.current) clearTimeout(buscaRef.current); };
  }, [buscaMembro, ministryId, supabase]);

  // ── CRUD ─────────────────────────────────────────────────────────────────────
  const abrirForm = (p?: EbdProfessor) => {
    setEditProf(p ?? null);
    setForm(p
      ? { church_id: p.church_id ?? '', nome: p.nome, telefone: p.telefone ?? '', email: p.email ?? '', member_id: p.member_id ?? '' }
      : { church_id: '', nome: '', telefone: '', email: '', member_id: '' });
    setBuscaMembro('');
    setSugestoes([]);
    setShowForm(true);
  };

  const selecionarMembro = (m: MembroSugestao) => {
    setForm(f => ({
      ...f,
      nome:      m.name,
      telefone:  fmtFone(m.phone ?? ''),
      email:     m.email ?? '',
      member_id: m.id,
    }));
    setBuscaMembro(m.name);
    setSugestoes([]);
  };

  const salvar = async () => {
    if (!ministryId || !form.nome.trim()) return;
    const payload = {
      ministry_id: ministryId,
      church_id:   form.church_id  || null,
      member_id:   form.member_id  || null,
      nome:        form.nome.trim(),
      telefone:    form.telefone   || null,
      email:       form.email      || null,
    };
    const { error } = editProf
      ? await supabase.from('ebd_professores').update(payload).eq('id', editProf.id)
      : await supabase.from('ebd_professores').insert(payload);
    if (error) flash('erro', error.message);
    else { flash('ok', editProf ? 'Professor atualizado!' : 'Professor cadastrado!'); setShowForm(false); load(ministryId); }
  };

  const excluir = async (id: string) => {
    if (!ministryId) return;
    const ok = await dialog.confirm({ title: 'Excluir professor', type: 'warning', message: 'Tem certeza que deseja excluir este professor?', confirmText: 'Excluir', cancelText: 'Cancelar' });
    if (!ok) return;
    const { error } = await supabase.from('ebd_professores').delete().eq('id', id);
    if (error) flash('erro', error.message);
    else { flash('ok', 'Professor excluído.'); load(ministryId); }
  };

  const congNome = (id: string | null) => id ? (congregacoes.find(c => c.id === id)?.nome ?? '—') : '—';

  const lista = filtroCong
    ? professores.filter(p => p.church_id === filtroCong)
    : professores;

  if (bloqueado) return null;

  return (
    <PageLayout
      title="EBD — Professores"
      description="Cadastro de professores da Escola Bíblica Dominical"
      activeMenu="ebd-cadastro-professores"
    >
      {/* Estilos de impressão */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden !important; }
          #prof-print, #prof-print * { visibility: visible !important; }
          #prof-print {
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
          <select value={filtroCong} onChange={e => setFiltroCong(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
            <option value="">Todas</option>
            {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
            <Printer className="h-4 w-4" /> Imprimir
          </button>
          <button onClick={() => abrirForm()}
            className="flex items-center gap-2 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition">
            <Plus className="h-4 w-4" /> Adicionar Professor
          </button>
        </div>
      </div>

      {/* Mensagem */}
      {msg && (
        <div className={`no-print mb-4 px-4 py-3 rounded-lg text-sm font-medium ${msg.tipo === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.texto}
        </div>
      )}

      {loading && <p className="no-print text-gray-400 text-sm py-8 text-center">Carregando...</p>}

      {!loading && lista.length === 0 && (
        <div className="no-print text-center py-16 text-gray-400">
          <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Nenhum professor cadastrado.</p>
          <p className="text-xs mt-1">Clique em &ldquo;Adicionar Professor&rdquo; para começar.</p>
        </div>
      )}

      {!loading && lista.length > 0 && (
        <div id="prof-print">
          {/* Timbre de impressão */}
          <div className="hidden print:block border-b border-gray-300 pb-4 mb-4">
            <div className="flex items-center gap-4">
              {configIgreja?.logo && <img src={configIgreja.logo} alt="Logo" className="h-16 w-16 object-contain" />}
              <div className="flex-1 text-center">
                <p className="text-xl font-bold text-gray-900">{configIgreja?.nome}</p>
                {configIgreja?.endereco && <p className="text-xs text-gray-600 mt-0.5">{configIgreja.endereco}</p>}
                <p className="text-xs text-gray-600 mt-0.5">
                  {configIgreja?.telefone && `Tel: ${configIgreja.telefone}`}
                  {configIgreja?.telefone && configIgreja?.email && ' | '}
                  {configIgreja?.email && `Email: ${configIgreja.email}`}
                </p>
              </div>
              {configIgreja?.logo && <div className="w-16" />}
            </div>
          </div>

          {/* Título impressão */}
          <div className="hidden print:block mb-4">
            <h2 className="text-lg font-bold text-gray-800">Professores EBD</h2>
            {filtroCong && <p className="text-sm text-gray-600">Congregação: {congNome(filtroCong)}</p>}
          </div>

          {/* Contador */}
          <p className="no-print text-xs text-gray-400 mb-4">
            {lista.length} professor{lista.length !== 1 ? 'es' : ''} encontrado{lista.length !== 1 ? 's' : ''}
          </p>

          {/* Tabela */}
          <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Igreja</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Telefone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">E-mail</th>
                  <th className="px-4 py-3 no-print" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lista.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">{p.nome}</td>
                    <td className="px-4 py-3 text-gray-600">{congNome(p.church_id)}</td>
                    <td className="px-4 py-3 text-gray-500">{p.telefone || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{p.email || '—'}</td>
                    <td className="px-4 py-3 no-print">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => abrirForm(p)} className="text-gray-400 hover:text-[#123b63] transition" title="Editar">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => excluir(p.id)} className="text-gray-400 hover:text-red-500 transition" title="Excluir">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Rodapé impressão */}
          <div className="hidden print:block mt-6 pt-4 border-t border-gray-200 text-xs text-gray-400 text-right">
            Emitido em {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })} — {configIgreja?.nome}
          </div>
        </div>
      )}

      {/* ── Modal de formulário ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-[#123b63] text-lg">{editProf ? 'Editar Professor' : 'Novo Professor'}</h3>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>

            <div className="space-y-4">
              {/* Busca de membro */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Buscar membro</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    value={buscaMembro}
                    onChange={e => setBuscaMembro(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm"
                    placeholder="Digite 3 letras do nome..."
                  />
                  {buscandoMembro && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">buscando...</span>
                  )}
                </div>
                {sugestoes.length > 0 && (
                  <ul className="mt-1 border border-gray-200 rounded-lg shadow-md bg-white max-h-44 overflow-y-auto divide-y divide-gray-50">
                    {sugestoes.map(m => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => selecionarMembro(m)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition"
                        >
                          <span className="font-medium text-gray-800">{m.name}</span>
                          {m.phone && <span className="text-xs text-gray-400 ml-2">{m.phone}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-gray-400 mt-1">Selecione um membro para preencher automaticamente, ou preencha manualmente abaixo.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Nome *</label>
                <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Nome completo" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Igreja vinculada</label>
                <select value={form.church_id} onChange={e => setForm(f => ({ ...f, church_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Sem vínculo específico</option>
                  {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Telefone</label>
                <input type="tel" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: fmtFone(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="(00) 00000-0000" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">E-mail</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="professor@email.com" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
                Cancelar
              </button>
              <button onClick={salvar}
                className="flex-1 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition">
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
