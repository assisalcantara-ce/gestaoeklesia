'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import { resolveEbdScope } from '@/lib/cartoes-templates-sync';
import { Plus, Pencil, Trash2, X, Users } from 'lucide-react';
import { useAppDialog } from '@/providers/AppDialogProvider';

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface Congregacao { id: string; nome: string; }

interface EbdClasse {
  id: string; ministry_id: string; nome: string;
  faixa_etaria_min: number | null; faixa_etaria_max: number | null;
  descricao: string | null; cor: string; ordem: number;
  padrao: boolean; ativo: boolean;
}

interface EbdProfessor {
  id: string; ministry_id: string; church_id: string | null;
  member_id: string | null; nome: string;
  telefone: string | null; email: string | null; ativo: boolean;
}

interface EbdTurma {
  id: string; ministry_id: string; church_id: string;
  classe_id: string | null; nome: string;
  professor_titular_id: string | null; sala: string | null;
  capacidade_max: number | null; ativo: boolean;
  // joined
  church_nome?: string; classe_nome?: string; professor_nome?: string;
}

// ─── Componente ──────────────────────────────────────────────────────────────
export default function EbdTurmasPage() {
  const { user } = useRequireSupabaseAuth();
  const { bloqueado } = useRequireModulo('ebd');
  const supabase  = useMemo(() => createClient(), []);
  const dialog    = useAppDialog();

  const [ministryId,   setMinistryId]   = useState<string | null>(null);
  const churchIdRef = useRef<string | null>(null);
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
  const [classes,      setClasses]      = useState<EbdClasse[]>([]);
  const [professores,  setProfessores]  = useState<EbdProfessor[]>([]);
  const [turmas,       setTurmas]       = useState<EbdTurma[]>([]);

  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  // Filtros
  const [filtroCong, setFiltroCong] = useState('');

  // Forms
  const [showTurmaForm, setShowTurmaForm] = useState(false);
  const [editTurma,     setEditTurma]     = useState<EbdTurma | null>(null);
  const [formTurma,     setFormTurma]     = useState({ church_id: '', classe_id: '', nome: '', professor_titular_id: '', sala: '', capacidade_max: '' });



  // ── Carregar dados ───────────────────────────────────────────────────────

  const load = useCallback(async (mid: string) => {
    setLoading(true);
    const cid = churchIdRef.current;
    let congsQ = supabase.from('congregacoes').select('id, nome').eq('ministry_id', mid).order('nome');
    if (cid) congsQ = congsQ.eq('id', cid);
    let profsQ = supabase.from('ebd_professores').select('*').eq('ministry_id', mid).order('nome');
    if (cid) profsQ = profsQ.eq('church_id', cid);
    let turmasQ = supabase.from('ebd_turmas').select('*').eq('ministry_id', mid).order('nome');
    if (cid) turmasQ = turmasQ.eq('church_id', cid);
    const [congsR, classesR, profsR, turmasR] = await Promise.all([
      congsQ,
      supabase.from('ebd_classes').select('*').eq('ministry_id', mid).order('ordem').order('nome'),
      profsQ,
      turmasQ,
    ]);
    setCongregacoes(congsR.data ?? []);
    setClasses(classesR.data ?? []);
    setProfessores(profsR.data ?? []);

    const rawTurmas: EbdTurma[] = turmasR.data ?? [];
    const congMap = new Map<string, string>((congsR.data ?? []).map((c: { id: string; nome: string }) => [c.id, c.nome]));
    const clasMap = new Map<string, string>((classesR.data ?? []).map((c: { id: string; nome: string }) => [c.id, c.nome]));
    const profMap = new Map<string, string>((profsR.data ?? []).map((p: { id: string; nome: string }) => [p.id, p.nome]));
    setTurmas(rawTurmas.map(t => ({
      ...t,
      church_nome:    congMap.get(t.church_id) ?? '—',
      classe_nome:    t.classe_id ? (clasMap.get(t.classe_id) ?? '—') : '—',
      professor_nome: t.professor_titular_id ? (profMap.get(t.professor_titular_id) ?? '—') : '—',
    })));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!user || bloqueado) return;
    resolveEbdScope(supabase).then(scope => {
      if (scope.ministryId) {
        churchIdRef.current = scope.churchId;
        setMinistryId(scope.ministryId);
        if (scope.churchId) setFiltroCong(scope.churchId);
        load(scope.ministryId);
      }
    });
  }, [user, bloqueado, supabase, load]);

  const flash = (tipo: 'ok' | 'erro', texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 4000);
  };

  // ── CRUD Turmas ──────────────────────────────────────────────────────────

  const abrirFormTurma = (t?: EbdTurma) => {
    setEditTurma(t ?? null);
    setFormTurma(t
      ? { church_id: t.church_id, classe_id: t.classe_id ?? '', nome: t.nome, professor_titular_id: t.professor_titular_id ?? '', sala: t.sala ?? '', capacidade_max: t.capacidade_max?.toString() ?? '' }
      : { church_id: '', classe_id: '', nome: '', professor_titular_id: '', sala: '', capacidade_max: '' });
    setShowTurmaForm(true);
  };

  const salvarTurma = async () => {
    if (!ministryId || !formTurma.church_id || !formTurma.nome.trim()) return;
    const payload = {
      ministry_id: ministryId,
      church_id: formTurma.church_id,
      classe_id: formTurma.classe_id || null,
      nome: formTurma.nome.trim(),
      professor_titular_id: formTurma.professor_titular_id || null,
      sala: formTurma.sala || null,
      capacidade_max: formTurma.capacidade_max ? parseInt(formTurma.capacidade_max) : null,
    };
    const { error } = editTurma
      ? await supabase.from('ebd_turmas').update(payload).eq('id', editTurma.id)
      : await supabase.from('ebd_turmas').insert(payload);
    if (error) flash('erro', error.message);
    else { flash('ok', editTurma ? 'Turma atualizada!' : 'Turma criada!'); setShowTurmaForm(false); load(ministryId); }
  };

  const excluirTurma = async (id: string) => {
    if (!ministryId) return;
    const ok = await dialog.confirm({ title: 'Excluir turma', type: 'warning', message: 'Tem certeza que deseja excluir esta turma?', confirmText: 'Excluir', cancelText: 'Cancelar' });
    if (!ok) return;
    const { error } = await supabase.from('ebd_turmas').delete().eq('id', id);
    if (error) flash('erro', error.message);
    else { flash('ok', 'Turma excluída.'); load(ministryId); }
  };

  const toggleTurmaAtivo = async (t: EbdTurma) => {
    if (!ministryId) return;
    const { error } = await supabase.from('ebd_turmas').update({ ativo: !t.ativo }).eq('id', t.id);
    if (!error) load(ministryId);
  };

  // ── Renderização ─────────────────────────────────────────────────────────

  const turmasFiltradas = filtroCong ? turmas.filter(t => t.church_id === filtroCong) : turmas;

  if (bloqueado) return null;

  return (
    <PageLayout title="EBD — Turmas" description="Gerencie turmas da Escola Bíblica Dominical" activeMenu="ebd-cadastro-turmas">
      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${msg.tipo === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.texto}
        </div>
      )}

      {/* Filtro de congregação */}
      <div className="mb-4 flex items-center gap-3">
          <label className="text-xs font-semibold text-gray-500">Filtrar por congregação:</label>
          <select value={filtroCong} onChange={e => setFiltroCong(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
            <option value="">Todas</option>
            {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>

      {loading && <p className="text-gray-400 text-sm py-8 text-center">Carregando...</p>}

      {!loading && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-gray-700">Turmas ({turmasFiltradas.length})</h2>
            <button onClick={() => abrirFormTurma()}
              className="flex items-center gap-2 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition">
              <Plus className="h-4 w-4" /> Nova Turma
            </button>
          </div>

          {turmasFiltradas.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma turma cadastrada.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Turma</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Igreja</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Classe</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Professor Titular</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Sala</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {turmasFiltradas.map(t => (
                    <tr key={t.id} className={!t.ativo ? 'opacity-50' : ''}>
                      <td className="px-4 py-3 font-medium text-gray-800">{t.nome}</td>
                      <td className="px-4 py-3 text-gray-600">{t.church_nome}</td>
                      <td className="px-4 py-3 text-gray-500">{t.classe_nome}</td>
                      <td className="px-4 py-3 text-gray-500">{t.professor_nome}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{t.sala || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => toggleTurmaAtivo(t)}
                          className={`px-2 py-0.5 rounded text-xs font-semibold ${t.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {t.ativo ? 'Ativa' : 'Inativa'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => abrirFormTurma(t)} className="text-gray-400 hover:text-[#123b63] transition"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => excluirTurma(t.id)} className="text-gray-400 hover:text-red-500 transition"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Form Turma */}
          {showTurmaForm && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="font-bold text-[#123b63] text-lg">{editTurma ? 'Editar Turma' : 'Nova Turma'}</h3>
                  <button onClick={() => setShowTurmaForm(false)}><X className="h-5 w-5 text-gray-400" /></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Igreja *</label>
                    <select value={formTurma.church_id} onChange={e => setFormTurma(f => ({ ...f, church_id: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      <option value="">Selecione...</option>
                      {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Nome da turma *</label>
                    <input value={formTurma.nome} onChange={e => setFormTurma(f => ({ ...f, nome: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Ex: Adultos A" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Classe EBD</label>
                    <select value={formTurma.classe_id} onChange={e => setFormTurma(f => ({ ...f, classe_id: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      <option value="">Sem classe</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Professor titular</label>
                    <select value={formTurma.professor_titular_id} onChange={e => setFormTurma(f => ({ ...f, professor_titular_id: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      <option value="">Nenhum</option>
                      {professores.filter(p => !formTurma.church_id || p.church_id === formTurma.church_id || !p.church_id).map(p =>
                        <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Sala</label>
                      <input value={formTurma.sala} onChange={e => setFormTurma(f => ({ ...f, sala: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Ex: Sala 3" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Capacidade máx.</label>
                      <input type="number" value={formTurma.capacidade_max} onChange={e => setFormTurma(f => ({ ...f, capacidade_max: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Ex: 30" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowTurmaForm(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">Cancelar</button>
                  <button onClick={salvarTurma} className="flex-1 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition">Salvar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </PageLayout>
  );
}
