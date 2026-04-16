'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { Plus, Pencil, Trash2, X, BookOpen, Users, GraduationCap, Sparkles } from 'lucide-react';

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

type Aba = 'classes' | 'turmas' | 'professores';

const CORES_CLASSE = [
  '#ec4899','#f97316','#eab308','#22c55e',
  '#3b82f6','#8b5cf6','#123b63','#6b7280',
  '#ef4444','#14b8a6','#f59e0b','#06b6d4',
];

// ─── Componente ──────────────────────────────────────────────────────────────

export default function EbdTurmasPage() {
  const { user } = useRequireSupabaseAuth();
  const supabase  = useMemo(() => createClient(), []);

  const [ministryId,   setMinistryId]   = useState<string | null>(null);
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
  const [classes,      setClasses]      = useState<EbdClasse[]>([]);
  const [professores,  setProfessores]  = useState<EbdProfessor[]>([]);
  const [turmas,       setTurmas]       = useState<EbdTurma[]>([]);

  const [aba,     setAba]     = useState<Aba>('classes');
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Filtros
  const [filtroCong, setFiltroCong] = useState('');

  // Forms
  const [showClasseForm, setShowClasseForm]   = useState(false);
  const [editClasse,     setEditClasse]        = useState<EbdClasse | null>(null);
  const [formClasse,     setFormClasse]        = useState({ nome: '', faixa_etaria_min: '', faixa_etaria_max: '', descricao: '', cor: '#3b82f6', ordem: 0 });

  const [showTurmaForm, setShowTurmaForm]   = useState(false);
  const [editTurma,     setEditTurma]       = useState<EbdTurma | null>(null);
  const [formTurma,     setFormTurma]       = useState({ church_id: '', classe_id: '', nome: '', professor_titular_id: '', sala: '', capacidade_max: '' });

  const [showProfForm,  setShowProfForm]    = useState(false);
  const [editProf,      setEditProf]        = useState<EbdProfessor | null>(null);
  const [formProf,      setFormProf]        = useState({ church_id: '', nome: '', telefone: '', email: '' });

  // ── Carregar dados ───────────────────────────────────────────────────────

  const load = useCallback(async (mid: string) => {
    setLoading(true);
    const [congsR, classesR, profsR, turmasR] = await Promise.all([
      supabase.from('congregacoes').select('id, nome').eq('ministry_id', mid).order('nome'),
      supabase.from('ebd_classes').select('*').eq('ministry_id', mid).order('ordem').order('nome'),
      supabase.from('ebd_professores').select('*').eq('ministry_id', mid).order('nome'),
      supabase.from('ebd_turmas').select('*').eq('ministry_id', mid).order('nome'),
    ]);
    setCongregacoes(congsR.data ?? []);
    setClasses(classesR.data ?? []);
    setProfessores(profsR.data ?? []);

    const rawTurmas: EbdTurma[] = turmasR.data ?? [];
    const congMap  = new Map<string, string>((congsR.data ?? []).map((c: { id: string; nome: string }) => [c.id, c.nome]));
    const clasMap  = new Map<string, string>((classesR.data ?? []).map((c: { id: string; nome: string }) => [c.id, c.nome]));
    const profMap  = new Map<string, string>((profsR.data ?? []).map((p: { id: string; nome: string }) => [p.id, p.nome]));
    setTurmas(rawTurmas.map(t => ({
      ...t,
      church_nome:    congMap.get(t.church_id) ?? '—',
      classe_nome:    t.classe_id ? (clasMap.get(t.classe_id) ?? '—') : '—',
      professor_nome: t.professor_titular_id ? (profMap.get(t.professor_titular_id) ?? '—') : '—',
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

  // ── Seed classes padrão ──────────────────────────────────────────────────

  const handleSeedClasses = async () => {
    if (!ministryId) return;
    setSeeding(true);
    const { error } = await supabase.rpc('ebd_seed_classes_padrao', { p_ministry_id: ministryId });
    if (error) flash('erro', error.message);
    else { flash('ok', 'Classes padrão importadas com sucesso!'); load(ministryId); }
    setSeeding(false);
  };

  // ── CRUD Classes ─────────────────────────────────────────────────────────

  const abrirFormClasse = (c?: EbdClasse) => {
    setEditClasse(c ?? null);
    setFormClasse(c
      ? { nome: c.nome, faixa_etaria_min: c.faixa_etaria_min?.toString() ?? '', faixa_etaria_max: c.faixa_etaria_max?.toString() ?? '', descricao: c.descricao ?? '', cor: c.cor, ordem: c.ordem }
      : { nome: '', faixa_etaria_min: '', faixa_etaria_max: '', descricao: '', cor: '#3b82f6', ordem: 0 });
    setShowClasseForm(true);
  };

  const salvarClasse = async () => {
    if (!ministryId || !formClasse.nome.trim()) return;
    const payload = {
      ministry_id: ministryId,
      nome: formClasse.nome.trim(),
      faixa_etaria_min: formClasse.faixa_etaria_min ? parseInt(formClasse.faixa_etaria_min) : null,
      faixa_etaria_max: formClasse.faixa_etaria_max ? parseInt(formClasse.faixa_etaria_max) : null,
      descricao: formClasse.descricao || null,
      cor: formClasse.cor,
      ordem: formClasse.ordem,
    };
    const { error } = editClasse
      ? await supabase.from('ebd_classes').update(payload).eq('id', editClasse.id)
      : await supabase.from('ebd_classes').insert(payload);
    if (error) flash('erro', error.message);
    else { flash('ok', editClasse ? 'Classe atualizada!' : 'Classe criada!'); setShowClasseForm(false); load(ministryId); }
  };

  const excluirClasse = async (id: string) => {
    if (!ministryId || !confirm('Excluir esta classe?')) return;
    const { error } = await supabase.from('ebd_classes').delete().eq('id', id);
    if (error) flash('erro', error.message);
    else { flash('ok', 'Classe excluída.'); load(ministryId); }
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
    if (!ministryId || !confirm('Excluir esta turma?')) return;
    const { error } = await supabase.from('ebd_turmas').delete().eq('id', id);
    if (error) flash('erro', error.message);
    else { flash('ok', 'Turma excluída.'); load(ministryId); }
  };

  const toggleTurmaAtivo = async (t: EbdTurma) => {
    if (!ministryId) return;
    const { error } = await supabase.from('ebd_turmas').update({ ativo: !t.ativo }).eq('id', t.id);
    if (!error) load(ministryId);
  };

  // ── CRUD Professores ─────────────────────────────────────────────────────

  const abrirFormProf = (p?: EbdProfessor) => {
    setEditProf(p ?? null);
    setFormProf(p
      ? { church_id: p.church_id ?? '', nome: p.nome, telefone: p.telefone ?? '', email: p.email ?? '' }
      : { church_id: '', nome: '', telefone: '', email: '' });
    setShowProfForm(true);
  };

  const salvarProf = async () => {
    if (!ministryId || !formProf.nome.trim()) return;
    const payload = {
      ministry_id: ministryId,
      church_id: formProf.church_id || null,
      nome: formProf.nome.trim(),
      telefone: formProf.telefone || null,
      email: formProf.email || null,
    };
    const { error } = editProf
      ? await supabase.from('ebd_professores').update(payload).eq('id', editProf.id)
      : await supabase.from('ebd_professores').insert(payload);
    if (error) flash('erro', error.message);
    else { flash('ok', editProf ? 'Professor atualizado!' : 'Professor cadastrado!'); setShowProfForm(false); load(ministryId); }
  };

  const excluirProf = async (id: string) => {
    if (!ministryId || !confirm('Excluir este professor?')) return;
    const { error } = await supabase.from('ebd_professores').delete().eq('id', id);
    if (error) flash('erro', error.message);
    else { flash('ok', 'Professor excluído.'); load(ministryId); }
  };

  // ── Renderização ─────────────────────────────────────────────────────────

  const turmasFiltradas = filtroCong ? turmas.filter(t => t.church_id === filtroCong) : turmas;
  const profsFiltrados  = filtroCong ? professores.filter(p => p.church_id === filtroCong) : professores;

  const TABS: { id: Aba; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'classes',    label: 'Classes EBD', icon: <BookOpen className="h-4 w-4" />,     count: classes.length },
    { id: 'turmas',     label: 'Turmas',      icon: <Users className="h-4 w-4" />,         count: turmas.length },
    { id: 'professores',label: 'Professores', icon: <GraduationCap className="h-4 w-4" />, count: professores.length },
  ];

  return (
    <PageLayout title="EBD — Turmas" description="Gerencie classes, turmas e professores da Escola Bíblica Dominical" activeMenu="ebd-turmas">
      {/* Mensagem de feedback */}
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

      {/* Filtro de congregação (turmas e professores) */}
      {aba !== 'classes' && (
        <div className="mb-4 flex items-center gap-3">
          <label className="text-xs font-semibold text-gray-500">Filtrar por congregação:</label>
          <select value={filtroCong} onChange={e => setFiltroCong(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
            <option value="">Todas</option>
            {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm py-8 text-center">Carregando...</p>}

      {/* ══ ABA: CLASSES ══ */}
      {aba === 'classes' && !loading && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-gray-700">Classes EBD ({classes.length})</h2>
            <div className="flex gap-2">
              {classes.length === 0 && (
                <button onClick={handleSeedClasses} disabled={seeding}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 transition disabled:opacity-60">
                  <Sparkles className="h-4 w-4" />
                  {seeding ? 'Importando...' : 'Importar classes padrão'}
                </button>
              )}
              <button onClick={() => abrirFormClasse()}
                className="flex items-center gap-2 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition">
                <Plus className="h-4 w-4" /> Nova Classe
              </button>
            </div>
          </div>

          {classes.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma classe cadastrada.</p>
              <p className="text-xs mt-1">Use "Importar classes padrão" para começar rapidamente.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {classes.map(c => (
                <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full flex-shrink-0" style={{ backgroundColor: c.cor }} />
                      <span className="font-semibold text-gray-800 text-sm">{c.nome}</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => abrirFormClasse(c)} className="p-1 text-gray-400 hover:text-[#123b63] transition"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => excluirClasse(c.id)} className="p-1 text-gray-400 hover:text-red-500 transition"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  {(c.faixa_etaria_min !== null || c.faixa_etaria_max !== null) && (
                    <p className="text-xs text-gray-500">
                      Faixa: {c.faixa_etaria_min ?? '?'} – {c.faixa_etaria_max ?? '∞'} anos
                    </p>
                  )}
                  {c.descricao && <p className="text-xs text-gray-400 mt-1 truncate">{c.descricao}</p>}
                  {c.padrao && <span className="mt-2 inline-block px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">Padrão</span>}
                </div>
              ))}
            </div>
          )}

          {/* Form Classes */}
          {showClasseForm && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="font-bold text-[#123b63] text-lg">{editClasse ? 'Editar Classe' : 'Nova Classe'}</h3>
                  <button onClick={() => setShowClasseForm(false)}><X className="h-5 w-5 text-gray-400" /></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Nome da classe *</label>
                    <input value={formClasse.nome} onChange={e => setFormClasse(f => ({ ...f, nome: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Ex: Adolescentes" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Idade mínima</label>
                      <input type="number" value={formClasse.faixa_etaria_min} onChange={e => setFormClasse(f => ({ ...f, faixa_etaria_min: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Ex: 12" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Idade máxima</label>
                      <input type="number" value={formClasse.faixa_etaria_max} onChange={e => setFormClasse(f => ({ ...f, faixa_etaria_max: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Ex: 17 (vazio = sem limite)" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Cor identificadora</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {CORES_CLASSE.map(cor => (
                        <button key={cor} onClick={() => setFormClasse(f => ({ ...f, cor }))}
                          className={`h-7 w-7 rounded-full transition ${formClasse.cor === cor ? 'ring-2 ring-offset-2 ring-gray-600 scale-110' : ''}`}
                          style={{ backgroundColor: cor }} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Descrição</label>
                    <input value={formClasse.descricao} onChange={e => setFormClasse(f => ({ ...f, descricao: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Opcional" />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowClasseForm(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">Cancelar</button>
                  <button onClick={salvarClasse} className="flex-1 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition">Salvar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ ABA: TURMAS ══ */}
      {aba === 'turmas' && !loading && (
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

      {/* ══ ABA: PROFESSORES ══ */}
      {aba === 'professores' && !loading && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-gray-700">Professores ({profsFiltrados.length})</h2>
            <button onClick={() => abrirFormProf()}
              className="flex items-center gap-2 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition">
              <Plus className="h-4 w-4" /> Novo Professor
            </button>
          </div>

          {profsFiltrados.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum professor cadastrado.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Nome</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Igreja</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Telefone</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">E-mail</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {profsFiltrados.map(p => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-medium text-gray-800">{p.nome}</td>
                      <td className="px-4 py-3 text-gray-600">{congregacoes.find(c => c.id === p.church_id)?.nome ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{p.telefone || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{p.email || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => abrirFormProf(p)} className="text-gray-400 hover:text-[#123b63] transition"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => excluirProf(p.id)} className="text-gray-400 hover:text-red-500 transition"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Form Professor */}
          {showProfForm && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="font-bold text-[#123b63] text-lg">{editProf ? 'Editar Professor' : 'Novo Professor'}</h3>
                  <button onClick={() => setShowProfForm(false)}><X className="h-5 w-5 text-gray-400" /></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Igreja vinculada</label>
                    <select value={formProf.church_id} onChange={e => setFormProf(f => ({ ...f, church_id: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      <option value="">Sem vínculo específico</option>
                      {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Nome *</label>
                    <input value={formProf.nome} onChange={e => setFormProf(f => ({ ...f, nome: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Nome completo" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Telefone</label>
                    <input value={formProf.telefone} onChange={e => setFormProf(f => ({ ...f, telefone: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="(00) 00000-0000" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">E-mail</label>
                    <input type="email" value={formProf.email} onChange={e => setFormProf(f => ({ ...f, email: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="professor@email.com" />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowProfForm(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">Cancelar</button>
                  <button onClick={salvarProf} className="flex-1 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition">Salvar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </PageLayout>
  );
}
