'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { Plus, Pencil, Trash2, X, Users, UserCheck, Search } from 'lucide-react';
import { useAppDialog } from '@/providers/AppDialogProvider';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Congregacao { id: string; nome: string; }
interface EbdTurma    { id: string; nome: string; church_id: string; }

interface EbdAluno {
  id: string; ministry_id: string; church_id: string;
  member_id: string | null; nome: string;
  data_nascimento: string | null; sexo: string | null;
  responsavel_nome: string | null; responsavel_telefone: string | null;
  ativo: boolean;
}

interface EbdMatricula {
  id: string; aluno_id: string; turma_id: string;
  data_inicio: string; data_fim: string | null; motivo_saida: string | null;
  // joined
  aluno_nome?: string; turma_nome?: string;
}

type Aba = 'alunos' | 'matriculas';

const calcIdade = (nasc: string | null): string => {
  if (!nasc) return '—';
  const anos = Math.floor((Date.now() - new Date(nasc).getTime()) / (365.25 * 24 * 3600 * 1000));
  return `${anos} anos`;
};

// ─── Componente ──────────────────────────────────────────────────────────────

export default function EbdAlunosPage() {
  const { user } = useRequireSupabaseAuth();
  const supabase  = useMemo(() => createClient(), []);
  const dialog    = useAppDialog();

  const [ministryId,    setMinistryId]    = useState<string | null>(null);
  const [encerrarModal, setEncerrarModal] = useState<{ mat: EbdMatricula } | null>(null);
  const [motivoSaida,   setMotivoSaida]   = useState('');
  const [congregacoes,  setCongregacoes]  = useState<Congregacao[]>([]);
  const [turmas,        setTurmas]        = useState<EbdTurma[]>([]);
  const [alunos,        setAlunos]        = useState<EbdAluno[]>([]);
  const [matriculas,    setMatriculas]    = useState<EbdMatricula[]>([]);

  const [aba,        setAba]        = useState<Aba>('alunos');
  const [loading,    setLoading]    = useState(false);
  const [msg,        setMsg]        = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [busca,      setBusca]      = useState('');
  const [filtroCong, setFiltroCong] = useState('');

  // Form Aluno
  const [showForm,  setShowForm]  = useState(false);
  const [editAluno, setEditAluno] = useState<EbdAluno | null>(null);
  const [form, setForm] = useState({
    church_id: '', nome: '', data_nascimento: '', sexo: '',
    responsavel_nome: '', responsavel_telefone: '',
  });

  // Form Matrícula
  const [showMatForm, setShowMatForm] = useState(false);
  const [formMat, setFormMat] = useState({
    aluno_id: '', turma_id: '',
    data_inicio: new Date().toISOString().slice(0, 10),
  });

  // ── Carregar dados ───────────────────────────────────────────────────────

  const load = useCallback(async (mid: string) => {
    setLoading(true);
    const [congsR, turmasR, alunosR, matsR] = await Promise.all([
      supabase.from('congregacoes').select('id, nome').eq('ministry_id', mid).order('nome'),
      supabase.from('ebd_turmas').select('id, nome, church_id').eq('ministry_id', mid).eq('ativo', true).order('nome'),
      supabase.from('ebd_alunos').select('*').eq('ministry_id', mid).order('nome'),
      supabase.from('ebd_matriculas').select('*').eq('ministry_id', mid).order('data_inicio', { ascending: false }),
    ]);
    setCongregacoes(congsR.data ?? []);
    setTurmas(turmasR.data ?? []);
    setAlunos(alunosR.data ?? []);

    const alunoMap = new Map((alunosR.data ?? []).map((a: { id: string; nome: string }) => [a.id, a.nome]));
    const turmaMap = new Map((turmasR.data ?? []).map((t: { id: string; nome: string }) => [t.id, t.nome]));
    setMatriculas((matsR.data ?? []).map((m: EbdMatricula) => ({
      ...m,
      aluno_nome: alunoMap.get(m.aluno_id) ?? '—',
      turma_nome: turmaMap.get(m.turma_id) ?? '—',
    })));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!user) return;
    resolveMinistryId(supabase).then(mid => {
      if (mid) { setMinistryId(mid); load(mid); }
    });
  }, [user, supabase, load]);

  const flash = (tipo: 'ok' | 'erro', texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 4000);
  };

  // ── CRUD Alunos ──────────────────────────────────────────────────────────

  const abrirForm = (a?: EbdAluno) => {
    setEditAluno(a ?? null);
    setForm(a
      ? { church_id: a.church_id, nome: a.nome, data_nascimento: a.data_nascimento ?? '', sexo: a.sexo ?? '', responsavel_nome: a.responsavel_nome ?? '', responsavel_telefone: a.responsavel_telefone ?? '' }
      : { church_id: '', nome: '', data_nascimento: '', sexo: '', responsavel_nome: '', responsavel_telefone: '' });
    setShowForm(true);
  };

  const salvar = async () => {
    if (!ministryId || !form.church_id || !form.nome.trim()) return;
    const payload = {
      ministry_id: ministryId,
      church_id: form.church_id,
      nome: form.nome.trim(),
      data_nascimento: form.data_nascimento || null,
      sexo: form.sexo || null,
      responsavel_nome: form.responsavel_nome || null,
      responsavel_telefone: form.responsavel_telefone || null,
    };
    const { error } = editAluno
      ? await supabase.from('ebd_alunos').update(payload).eq('id', editAluno.id)
      : await supabase.from('ebd_alunos').insert(payload);
    if (error) flash('erro', error.message);
    else { flash('ok', editAluno ? 'Aluno atualizado!' : 'Aluno cadastrado!'); setShowForm(false); load(ministryId); }
  };

  const excluir = async (id: string) => {
    if (!ministryId) return;
    const ok = await dialog.confirm({ title: 'Excluir aluno', type: 'warning', message: 'Tem certeza que deseja excluir este aluno?', confirmText: 'Excluir', cancelText: 'Cancelar' });
    if (!ok) return;
    const { error } = await supabase.from('ebd_alunos').delete().eq('id', id);
    if (error) flash('erro', error.message);
    else { flash('ok', 'Aluno excluído.'); load(ministryId); }
  };

  const toggleAtivo = async (a: EbdAluno) => {
    if (!ministryId) return;
    const { error } = await supabase.from('ebd_alunos').update({ ativo: !a.ativo }).eq('id', a.id);
    if (!error) load(ministryId);
  };

  // ── Matrículas ───────────────────────────────────────────────────────────

  const matricular = async () => {
    if (!ministryId || !formMat.aluno_id || !formMat.turma_id) return;
    // Fecha matrícula ativa anterior
    const { error: e1 } = await supabase
      .from('ebd_matriculas')
      .update({ data_fim: formMat.data_inicio, motivo_saida: 'Transferência' })
      .eq('aluno_id', formMat.aluno_id)
      .is('data_fim', null);
    if (e1 && !e1.message.includes('no rows')) { flash('erro', e1.message); return; }

    const { error: e2 } = await supabase.from('ebd_matriculas').insert({
      ministry_id: ministryId,
      aluno_id: formMat.aluno_id,
      turma_id: formMat.turma_id,
      data_inicio: formMat.data_inicio,
    });
    if (e2) flash('erro', e2.message);
    else { flash('ok', 'Matrícula realizada!'); setShowMatForm(false); load(ministryId); }
  };

  const encerrarMatricula = (m: EbdMatricula) => {
    setMotivoSaida('');
    setEncerrarModal({ mat: m });
  };

  const confirmarEncerramento = async () => {
    if (!ministryId || !encerrarModal) return;
    const { error } = await supabase
      .from('ebd_matriculas')
      .update({ data_fim: new Date().toISOString().slice(0, 10), motivo_saida: motivoSaida.trim() || null })
      .eq('id', encerrarModal.mat.id);
    if (error) flash('erro', error.message);
    else { flash('ok', 'Matrícula encerrada.'); setEncerrarModal(null); load(ministryId); }
  };

  // ── Filtros ──────────────────────────────────────────────────────────────

  const alunosFiltrados = alunos.filter(a => {
    if (filtroCong && a.church_id !== filtroCong) return false;
    if (busca && !a.nome.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

  const matsAtivas    = matriculas.filter(m => !m.data_fim);
  const matsHistorico = matriculas.filter(m => m.data_fim);

  const TABS = [
    { id: 'alunos'     as Aba, label: 'Alunos',    icon: <Users className="h-4 w-4" />,     count: alunos.length },
    { id: 'matriculas' as Aba, label: 'Matrículas', icon: <UserCheck className="h-4 w-4" />, count: matsAtivas.length },
  ];

  return (
    <PageLayout title="EBD — Alunos" description="Gerencie alunos e matrículas da Escola Bíblica Dominical" activeMenu="ebd-alunos">
      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${msg.tipo === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.texto}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setAba(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition ${
              aba === t.id ? 'bg-white text-[#123b63] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.icon} {t.label}
            <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${aba === t.id ? 'bg-[#123b63]/10 text-[#123b63]' : 'bg-gray-200 text-gray-500'}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-400 text-sm py-8 text-center">Carregando...</p>}

      {/* ══ ABA: ALUNOS ══ */}
      {aba === 'alunos' && !loading && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-3 items-center">
              <div className="relative">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={busca} onChange={e => setBusca(e.target.value)}
                  className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Buscar aluno..." />
              </div>
              <select value={filtroCong} onChange={e => setFiltroCong(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Todas as igrejas</option>
                {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <button onClick={() => abrirForm()}
              className="flex items-center gap-2 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition">
              <Plus className="h-4 w-4" /> Novo Aluno
            </button>
          </div>

          {alunosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum aluno encontrado.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Nome</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Igreja</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Idade</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Sexo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Responsável</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {alunosFiltrados.map(a => {
                    const matAtiva = matsAtivas.find(m => m.aluno_id === a.id);
                    return (
                      <tr key={a.id} className={!a.ativo ? 'opacity-50' : ''}>
                        <td className="px-4 py-3">
                          <span className="font-medium text-gray-800">{a.nome}</span>
                          {matAtiva && <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{matAtiva.turma_nome}</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{congregacoes.find(c => c.id === a.church_id)?.nome ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{calcIdade(a.data_nascimento)}</td>
                        <td className="px-4 py-3 text-gray-500">{a.sexo === 'M' ? 'Masc.' : a.sexo === 'F' ? 'Fem.' : '—'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{a.responsavel_nome || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => toggleAtivo(a)}
                            className={`px-2 py-0.5 rounded text-xs font-semibold ${a.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {a.ativo ? 'Ativo' : 'Inativo'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => abrirForm(a)} className="text-gray-400 hover:text-[#123b63] transition"><Pencil className="h-4 w-4" /></button>
                            <button onClick={() => excluir(a.id)} className="text-gray-400 hover:text-red-500 transition"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Form Aluno */}
          {showForm && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="font-bold text-[#123b63] text-lg">{editAluno ? 'Editar Aluno' : 'Novo Aluno'}</h3>
                  <button onClick={() => setShowForm(false)}><X className="h-5 w-5 text-gray-400" /></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Igreja *</label>
                    <select value={form.church_id} onChange={e => setForm(f => ({ ...f, church_id: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      <option value="">Selecione...</option>
                      {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Nome completo *</label>
                    <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Nome do aluno" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Data de nascimento</label>
                      <input type="date" value={form.data_nascimento} onChange={e => setForm(f => ({ ...f, data_nascimento: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Sexo</label>
                      <select value={form.sexo} onChange={e => setForm(f => ({ ...f, sexo: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                        <option value="">Não informado</option>
                        <option value="M">Masculino</option>
                        <option value="F">Feminino</option>
                      </select>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-xs font-semibold text-gray-500 mb-3">Responsável (para menores de idade)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Nome do responsável</label>
                        <input value={form.responsavel_nome} onChange={e => setForm(f => ({ ...f, responsavel_nome: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Telefone</label>
                        <input value={form.responsavel_telefone} onChange={e => setForm(f => ({ ...f, responsavel_telefone: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="(00) 00000-0000" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">Cancelar</button>
                  <button onClick={salvar} className="flex-1 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition">Salvar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ ABA: MATRÍCULAS ══ */}
      {aba === 'matriculas' && !loading && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-gray-700">Matrículas ativas ({matsAtivas.length})</h2>
            <button onClick={() => { setFormMat({ aluno_id: '', turma_id: '', data_inicio: new Date().toISOString().slice(0, 10) }); setShowMatForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition">
              <Plus className="h-4 w-4" /> Matricular Aluno
            </button>
          </div>

          {matsAtivas.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">Nenhuma matrícula ativa.</div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Aluno</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Turma</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Desde</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {matsAtivas.map(m => (
                    <tr key={m.id}>
                      <td className="px-4 py-3 font-medium text-gray-800">{m.aluno_nome}</td>
                      <td className="px-4 py-3 text-gray-600">{m.turma_nome}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(m.data_inicio).toLocaleDateString('pt-BR')}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => encerrarMatricula(m)} className="text-xs text-red-500 hover:text-red-700 font-medium transition">Encerrar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {matsHistorico.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 mb-3">Histórico ({matsHistorico.length})</h3>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Aluno</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Turma</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Período</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {matsHistorico.map(m => (
                      <tr key={m.id} className="opacity-60">
                        <td className="px-4 py-2 text-gray-700">{m.aluno_nome}</td>
                        <td className="px-4 py-2 text-gray-500">{m.turma_nome}</td>
                        <td className="px-4 py-2 text-gray-400 text-xs">
                          {new Date(m.data_inicio).toLocaleDateString('pt-BR')} → {m.data_fim ? new Date(m.data_fim).toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td className="px-4 py-2 text-gray-400 text-xs">{m.motivo_saida || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Matricular Aluno */}
      {showMatForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-[#123b63] text-lg">Matricular Aluno</h3>
              <button onClick={() => setShowMatForm(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Aluno *</label>
                <select value={formMat.aluno_id} onChange={e => setFormMat(f => ({ ...f, aluno_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Selecione...</option>
                  {alunos.filter(a => a.ativo).map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Turma *</label>
                <select value={formMat.turma_id} onChange={e => setFormMat(f => ({ ...f, turma_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Selecione...</option>
                  {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Data de início</label>
                <input type="date" value={formMat.data_inicio} onChange={e => setFormMat(f => ({ ...f, data_inicio: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mt-4">
              Se o aluno já tiver uma matrícula ativa, ela será encerrada automaticamente.
            </p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowMatForm(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">Cancelar</button>
              <button onClick={matricular} className="flex-1 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition">Matricular</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Encerrar Matrícula */}
      {encerrarModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <UserCheck className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Encerrar matrícula</h3>
                <p className="text-xs text-gray-400">{encerrarModal.mat.aluno_nome}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">Informe o motivo da saída (opcional):</p>
            <input
              value={motivoSaida}
              onChange={e => setMotivoSaida(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-5"
              placeholder="Ex: Mudança de cidade, formatura..."
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setEncerrarModal(null)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">Cancelar</button>
              <button onClick={confirmarEncerramento}
                className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 transition">Encerrar</button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
