'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { CheckCircle2, XCircle, Plus, Trash2, Save, UserPlus } from 'lucide-react';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Congregacao { id: string; nome: string; }
interface EbdTurma    { id: string; nome: string; church_id: string; professor_titular_id: string | null; }
interface EbdAluno    { id: string; nome: string; }
interface EbdProfessor{ id: string; nome: string; }

interface EbdAula {
  id: string; turma_id: string; data_aula: string;
  trimestre: number | null; ano: number; licao_numero: number | null;
  tema: string | null; professor_id: string | null;
  total_presentes: number; total_visitantes: number;
  status: string; observacoes: string | null;
}

interface FreqItem {
  aluno_id: string; nome: string;
  presente: boolean; freq_id: string | null;
}

interface Visitante {
  id: string; nome: string; telefone: string | null;
}

const hoje = () => new Date().toISOString().slice(0, 10);
const trimAtual = () => Math.ceil((new Date().getMonth() + 1) / 3);
const anoAtual  = () => new Date().getFullYear();

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// formata dígitos como BRL sem símbolo: 1250.5 → "1.250,50"
const fmtMoeda = (val: string): string => {
  if (!val) return '';
  const n = parseFloat(val);
  return isNaN(n) ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
// extrai valor numérico de string mascarada: "1.250,50" → "1250.50"
const parseMoeda = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return (parseInt(digits, 10) / 100).toString();
};
// máscara de telefone celular: → (xx) xxxxx-xxxx
const fmtFone = (v: string): string => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (!d) return '';
  if (d.length <= 2)  return `(${d}`;
  if (d.length <= 7)  return `(${d.slice(0,2)}) ${d.slice(2)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
};

// ─── Componente ──────────────────────────────────────────────────────────────

export default function EbdChamadaPage() {
  const { user } = useRequireSupabaseAuth();
  const supabase  = useMemo(() => createClient(), []);

  const [ministryId,   setMinistryId]   = useState<string | null>(null);
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
  const [turmas,       setTurmas]       = useState<EbdTurma[]>([]);
  const [professores,  setProfessores]  = useState<EbdProfessor[]>([]);

  // Seleção
  const [selCong,   setSelCong]   = useState('');
  const [selTurma,  setSelTurma]  = useState('');
  const [selData,   setSelData]   = useState(hoje());

  // Aula atual
  const [aula,       setAula]       = useState<EbdAula | null>(null);
  const [aulaLoading,setAulaLoading] = useState(false);
  const [aulaForm,   setAulaForm]   = useState({ tema: '', licao_numero: '', professor_id: '', trimestre: trimAtual().toString(), observacoes: '' });

  // Chamada
  const [freqs,        setFreqs]        = useState<FreqItem[]>([]);
  const [visitantes,   setVisitantes]   = useState<Visitante[]>([]);
  const [novoVisit,    setNovoVisit]    = useState({ nome: '', telefone: '' });
  const [showVisitForm,setShowVisitForm]= useState(false);

  // Oferta
  const [oferta,       setOferta]       = useState('');
  const [formaOferta,  setFormaOferta]  = useState('dinheiro');
  const [ofertaSalva,  setOfertaSalva]  = useState(false);

  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  // ── Carregar base ────────────────────────────────────────────────────────

  const loadBase = useCallback(async (mid: string) => {
    const [congsR, profsR] = await Promise.all([
      supabase.from('congregacoes').select('id, nome').eq('ministry_id', mid).order('nome'),
      supabase.from('ebd_professores').select('id, nome').eq('ministry_id', mid).eq('ativo', true).order('nome'),
    ]);
    setCongregacoes(congsR.data ?? []);
    setProfessores(profsR.data ?? []);
  }, [supabase]);

  const loadTurmas = useCallback(async (mid: string, congId: string) => {
    const { data } = await supabase.from('ebd_turmas').select('id, nome, church_id, professor_titular_id')
      .eq('ministry_id', mid).eq('church_id', congId).eq('ativo', true).order('nome');
    setTurmas(data ?? []);
    setSelTurma('');
    setAula(null);
    setFreqs([]);
    setVisitantes([]);
  }, [supabase]);

  useEffect(() => {
    if (!user) return;
    resolveMinistryId(supabase).then(mid => { if (mid) { setMinistryId(mid); loadBase(mid); } });
  }, [user, supabase, loadBase]);

  useEffect(() => {
    if (ministryId && selCong) loadTurmas(ministryId, selCong);
  }, [ministryId, selCong, loadTurmas]);

  const flash = (tipo: 'ok' | 'erro', texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 5000);
  };

  // ── Carregar aula do dia ─────────────────────────────────────────────────

  const carregarAula = useCallback(async () => {
    if (!ministryId || !selTurma || !selData) return;
    setAulaLoading(true);
    setAula(null); setFreqs([]); setVisitantes([]); setOferta(''); setOfertaSalva(false);

    // Busca aula existente
    const { data: aulaExistente } = await supabase
      .from('ebd_aulas')
      .select('*')
      .eq('turma_id', selTurma)
      .eq('data_aula', selData)
      .maybeSingle();

    // Busca alunos matriculados na turma
    const { data: matsData } = await supabase
      .from('ebd_matriculas')
      .select('aluno_id, ebd_alunos(id, nome)')
      .eq('turma_id', selTurma)
      .is('data_fim', null);

    const alunosDaTurma: EbdAluno[] = (matsData ?? [])
      .map((m: any) => m.ebd_alunos)
      .filter(Boolean) as EbdAluno[];

    if (aulaExistente) {
      setAula(aulaExistente);
      setAulaForm({
        tema: aulaExistente.tema ?? '',
        licao_numero: aulaExistente.licao_numero?.toString() ?? '',
        professor_id: aulaExistente.professor_id ?? '',
        trimestre: aulaExistente.trimestre?.toString() ?? trimAtual().toString(),
        observacoes: aulaExistente.observacoes ?? '',
      });

      // Carrega frequências existentes
      const { data: freqData } = await supabase
        .from('ebd_frequencias')
        .select('id, aluno_id, presente')
        .eq('aula_id', aulaExistente.id);
      const freqMap = new Map<string, { id: string; presente: boolean }>(
        (freqData ?? []).map((f: { id: string; aluno_id: string; presente: boolean }) => [f.aluno_id, { id: f.id, presente: f.presente }])
      );

      setFreqs(alunosDaTurma.map(a => ({
        aluno_id: a.id, nome: a.nome,
        presente: freqMap.get(a.id)?.presente ?? false,
        freq_id:  freqMap.get(a.id)?.id ?? null,
      })));

      // Carrega visitantes
      const { data: visitData } = await supabase
        .from('ebd_visitantes_aula').select('id, nome, telefone').eq('aula_id', aulaExistente.id);
      setVisitantes(visitData ?? []);

      // Carrega oferta
      const { data: ofertaData } = await supabase
        .from('ebd_ofertas').select('valor, forma_pagamento').eq('aula_id', aulaExistente.id).maybeSingle();
      if (ofertaData) { setOferta(ofertaData.valor.toString()); setFormaOferta(ofertaData.forma_pagamento); setOfertaSalva(true); }
    } else {
      // Aula nova — pré-preenche professor titular da turma
      const turma = turmas.find(t => t.id === selTurma);
      setAulaForm({
        tema: '', licao_numero: '', professor_id: turma?.professor_titular_id ?? '',
        trimestre: trimAtual().toString(), observacoes: '',
      });
      setFreqs(alunosDaTurma.map(a => ({ aluno_id: a.id, nome: a.nome, presente: false, freq_id: null })));
    }
    setAulaLoading(false);
  }, [ministryId, selTurma, selData, turmas, supabase]);

  useEffect(() => {
    if (selTurma && selData) carregarAula();
  }, [selTurma, selData, carregarAula]);

  // ── Toggle presença ──────────────────────────────────────────────────────

  const togglePresenca = (aluno_id: string) => {
    setFreqs(prev => prev.map(f => f.aluno_id === aluno_id ? { ...f, presente: !f.presente } : f));
  };

  const marcarTodos = (presente: boolean) => setFreqs(prev => prev.map(f => ({ ...f, presente })));

  // ── Salvar chamada ───────────────────────────────────────────────────────

  const salvarChamada = async () => {
    if (!ministryId || !selTurma) return;
    setSaving(true);

    const totalPresentes  = freqs.filter(f => f.presente).length;
    const totalVisitantes = visitantes.length;
    const ano = anoAtual();
    const trimestre = parseInt(aulaForm.trimestre) || trimAtual();

    let aulaId = aula?.id ?? null;

    if (!aulaId) {
      // Cria a aula
      const { data: novaAula, error } = await supabase.from('ebd_aulas').insert({
        ministry_id: ministryId,
        turma_id: selTurma,
        data_aula: selData,
        ano,
        trimestre,
        licao_numero: aulaForm.licao_numero ? parseInt(aulaForm.licao_numero) : null,
        tema: aulaForm.tema || null,
        professor_id: aulaForm.professor_id || null,
        observacoes: aulaForm.observacoes || null,
        status: 'realizada',
        total_presentes: totalPresentes,
        total_visitantes: totalVisitantes,
      }).select('id').single();
      if (error) { flash('erro', error.message); setSaving(false); return; }
      aulaId = novaAula.id;
      setAula({ ...novaAula, turma_id: selTurma, data_aula: selData, ano, trimestre, licao_numero: null, tema: null, professor_id: null, total_presentes: totalPresentes, total_visitantes: totalVisitantes, status: 'realizada', observacoes: null } as EbdAula);
    } else {
      // Atualiza aula existente
      await supabase.from('ebd_aulas').update({
        licao_numero: aulaForm.licao_numero ? parseInt(aulaForm.licao_numero) : null,
        tema: aulaForm.tema || null,
        professor_id: aulaForm.professor_id || null,
        observacoes: aulaForm.observacoes || null,
        status: 'realizada',
        trimestre,
        total_presentes: totalPresentes,
        total_visitantes: totalVisitantes,
      }).eq('id', aulaId);
    }

    // Salva frequências em batch (upsert)
    const freqPayload = freqs.map(f => ({
      ministry_id: ministryId,
      aula_id: aulaId!,
      aluno_id: f.aluno_id,
      presente: f.presente,
    }));
    if (freqPayload.length > 0) {
      const { error: freqErr } = await supabase
        .from('ebd_frequencias')
        .upsert(freqPayload, { onConflict: 'aula_id,aluno_id' });
      if (freqErr) { flash('erro', freqErr.message); setSaving(false); return; }
    }

    flash('ok', `Chamada salva! ${totalPresentes} presente(s), ${totalVisitantes} visitante(s).`);
    setSaving(false);
  };

  // ── Visitantes ───────────────────────────────────────────────────────────

  const adicionarVisitante = async () => {
    if (!aula?.id || !ministryId || !novoVisit.nome.trim()) return;
    const { data, error } = await supabase.from('ebd_visitantes_aula').insert({
      ministry_id: ministryId,
      aula_id: aula.id,
      nome: novoVisit.nome.trim(),
      telefone: novoVisit.telefone || null,
    }).select('id, nome, telefone').single();
    if (error) flash('erro', error.message);
    else { setVisitantes(v => [...v, data]); setNovoVisit({ nome: '', telefone: '' }); setShowVisitForm(false); }
  };

  const removerVisitante = async (id: string) => {
    await supabase.from('ebd_visitantes_aula').delete().eq('id', id);
    setVisitantes(v => v.filter(x => x.id !== id));
  };

  // ── Oferta ───────────────────────────────────────────────────────────────

  const salvarOferta = async () => {
    if (!aula?.id || !ministryId || !selCong || !oferta || parseFloat(oferta) <= 0) return;
    const ano  = anoAtual();
    const trimestre = parseInt(aulaForm.trimestre) || trimAtual();
    const { error } = await supabase.from('ebd_ofertas').upsert({
      ministry_id: ministryId,
      church_id: selCong,
      aula_id: aula.id,
      data_oferta: selData,
      ano,
      trimestre,
      valor: parseFloat(oferta),
      forma_pagamento: formaOferta,
      destino: 'tesouraria_local',
    }, { onConflict: 'aula_id' } as any);
    if (error) flash('erro', error.message);
    else { setOfertaSalva(true); flash('ok', 'Oferta registrada!'); }
  };

  // ── Derived ──────────────────────────────────────────────────────────────

  const turmasFiltradas  = turmas.filter(t => !selCong || t.church_id === selCong);
  const presentes        = freqs.filter(f => f.presente).length;
  const ausentes         = freqs.filter(f => !f.presente).length;
  const pctPresenca      = freqs.length > 0 ? Math.round((presentes / freqs.length) * 100) : 0;

  return (
    <PageLayout title="EBD — Chamada Semanal" description="Registre a presença dos alunos e dados de cada aula" activeMenu="ebd-chamada">
      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${msg.tipo === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.texto}
        </div>
      )}

      {/* ── Painel de seleção ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-5">
        <h2 className="text-sm font-bold text-gray-600 mb-4">Selecionar aula</h2>
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Igreja</label>
            <select value={selCong} onChange={e => setSelCong(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Selecione...</option>
              {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Turma</label>
            <select value={selTurma} onChange={e => setSelTurma(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" disabled={!selCong}>
              <option value="">Selecione...</option>
              {turmasFiltradas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Data</label>
            <input type="date" value={selData} onChange={e => setSelData(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      {/* ── Corpo principal ── */}
      {selTurma && selData && (
        aulaLoading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Carregando chamada...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* ── Coluna principal: chamada ── */}
            <div className="lg:col-span-2 space-y-5">

              {/* Dados da aula */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-600 mb-4">Dados da aula</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Lição nº</label>
                    <input type="number" value={aulaForm.licao_numero} onChange={e => setAulaForm(f => ({ ...f, licao_numero: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Ex: 3" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Trimestre</label>
                    <select value={aulaForm.trimestre} onChange={e => setAulaForm(f => ({ ...f, trimestre: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      {[1,2,3,4].map(t => <option key={t} value={t}>{t}º Trimestre</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Tema / Título da lição</label>
                    <input value={aulaForm.tema} onChange={e => setAulaForm(f => ({ ...f, tema: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Ex: A fé que move montanhas" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Professor que ministrou</label>
                    <select value={aulaForm.professor_id} onChange={e => setAulaForm(f => ({ ...f, professor_id: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      <option value="">Não informado</option>
                      {professores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Chamada */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-700">Chamada — {freqs.length} aluno(s)</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{presentes} presente(s) · {ausentes} ausente(s) · {pctPresenca}% de presença</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => marcarTodos(true)} className="text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-lg font-medium hover:bg-green-100 transition">Todos presentes</button>
                    <button onClick={() => marcarTodos(false)} className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition">Limpar</button>
                  </div>
                </div>

                {freqs.length === 0 ? (
                  <div className="px-5 py-10 text-center text-gray-400 text-sm">
                    Nenhum aluno matriculado nesta turma.<br />
                    <span className="text-xs">Acesse a aba Alunos para matriculá-los.</span>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {freqs.map(f => (
                      <button key={f.aluno_id} onClick={() => togglePresenca(f.aluno_id)}
                        className={`w-full flex items-center gap-4 px-5 py-3 transition text-left ${f.presente ? 'bg-green-50/50 hover:bg-green-50' : 'hover:bg-gray-50'}`}>
                        {f.presente
                          ? <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" />
                          : <XCircle className="h-6 w-6 text-gray-300 flex-shrink-0" />}
                        <span className={`text-sm font-medium ${f.presente ? 'text-gray-800' : 'text-gray-400'}`}>{f.nome}</span>
                        {f.presente && <span className="ml-auto text-xs text-green-600 font-semibold">Presente</span>}
                      </button>
                    ))}
                  </div>
                )}

                <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50">
                  <button onClick={salvarChamada} disabled={saving || freqs.length === 0}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-[#123b63] text-white rounded-xl font-semibold text-sm hover:bg-[#0f2a45] transition disabled:opacity-60">
                    <Save className="h-4 w-4" />
                    {saving ? 'Salvando...' : 'Salvar chamada'}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Coluna lateral ── */}
            <div className="space-y-5">
              {/* Resumo */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-600 mb-4">Resumo da aula</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Matriculados</span>
                    <span className="font-semibold text-gray-800">{freqs.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Presentes</span>
                    <span className="font-semibold text-green-600">{presentes}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Ausentes</span>
                    <span className="font-semibold text-red-500">{ausentes}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Visitantes</span>
                    <span className="font-semibold text-blue-600">{visitantes.length}</span>
                  </div>
                  <div className="border-t border-gray-100 pt-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">% Presença</span>
                      <span className={`font-bold ${pctPresenca >= 70 ? 'text-green-600' : pctPresenca >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{pctPresenca}%</span>
                    </div>
                    <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${pctPresenca >= 70 ? 'bg-green-500' : pctPresenca >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${pctPresenca}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Visitantes */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-700">Visitantes ({visitantes.length})</h3>
                  <button onClick={() => setShowVisitForm(v => !v)} disabled={!aula}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition disabled:opacity-40">
                    <UserPlus className="h-3.5 w-3.5" /> Adicionar
                  </button>
                </div>

                {!aula && (
                  <p className="px-5 py-4 text-xs text-gray-400">Salve a chamada primeiro para adicionar visitantes.</p>
                )}

                {showVisitForm && aula && (
                  <div className="px-5 py-4 bg-blue-50/50 border-b border-gray-100 space-y-2">
                    <input value={novoVisit.nome} onChange={e => setNovoVisit(v => ({ ...v, nome: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Nome do visitante *" />
                    <input type="tel" value={novoVisit.telefone} onChange={e => setNovoVisit(v => ({ ...v, telefone: fmtFone(e.target.value) }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="(00) 00000-0000" />
                    <div className="flex gap-2">
                      <button onClick={() => setShowVisitForm(false)} className="flex-1 text-xs py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">Cancelar</button>
                      <button onClick={adicionarVisitante} className="flex-1 text-xs py-1.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">Salvar</button>
                    </div>
                  </div>
                )}

                <div className="divide-y divide-gray-50">
                  {visitantes.length === 0 && aula && (
                    <p className="px-5 py-4 text-xs text-gray-400">Nenhum visitante registrado.</p>
                  )}
                  {visitantes.map(v => (
                    <div key={v.id} className="flex items-center gap-3 px-5 py-3">
                      <Plus className="h-4 w-4 text-blue-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{v.nome}</p>
                        {v.telefone && <p className="text-xs text-gray-400">{v.telefone}</p>}
                      </div>
                      <button onClick={() => removerVisitante(v.id)} className="text-gray-300 hover:text-red-400 transition"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Oferta */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 mb-4">Oferta da EBD</h3>
                {!aula ? (
                  <p className="text-xs text-gray-400">Salve a chamada primeiro para registrar a oferta.</p>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Valor (R$)</label>
                      <input type="text" inputMode="numeric" value={fmtMoeda(oferta)} onChange={e => { setOferta(parseMoeda(e.target.value)); setOfertaSalva(false); }}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="0,00" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Forma</label>
                      <select value={formaOferta} onChange={e => setFormaOferta(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                        <option value="dinheiro">Dinheiro</option>
                        <option value="pix">PIX</option>
                        <option value="cartao">Cartão</option>
                        <option value="transferencia">Transferência</option>
                      </select>
                    </div>
                    <button onClick={salvarOferta} disabled={!oferta || parseFloat(oferta) <= 0}
                      className={`w-full py-2.5 rounded-xl text-sm font-semibold transition ${ofertaSalva ? 'bg-green-500 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50'}`}>
                      {ofertaSalva ? `✓ ${fmtBRL(parseFloat(oferta))} registrado` : 'Registrar oferta'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      )}

      {!selTurma && (
        <div className="text-center py-20 text-gray-300">
          <Save className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-sm font-medium text-gray-400">Selecione uma igreja, turma e data para começar</p>
        </div>
      )}
    </PageLayout>
  );
}
