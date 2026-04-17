'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { CheckCircle2, XCircle, Plus, Trash2, Save, UserPlus, Calendar, AlertCircle, Clock } from 'lucide-react';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Congregacao { id: string; nome: string; }
interface EbdTurma    { id: string; nome: string; church_id: string; professor_titular_id: string | null; }
interface EbdAluno    { id: string; nome: string; }
interface EbdProfessor{ id: string; nome: string; }

interface EbdTrimestre {
  id: string; numero: number; ano: number; descricao: string;
  data_inicio: string; data_fim: string; ativo: boolean;
}

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

interface Visitante { id: string; nome: string; telefone: string | null; }

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const hoje      = () => dateStr(new Date());
const isSunday  = () => new Date().getDay() === 0;
const trimAtual = () => Math.ceil((new Date().getMonth() + 1) / 3);
const anoAtual  = () => new Date().getFullYear();

function getSundays(inicio: string, fim: string): string[] {
  const sundays: string[] = [];
  const d   = new Date(inicio + 'T12:00:00');
  const end = new Date(fim   + 'T12:00:00');
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  while (d <= end) { sundays.push(dateStr(d)); d.setDate(d.getDate() + 7); }
  return sundays;
}

function proximoDomingo(): { data: string; dias: number } {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const daysUntil = d.getDay() === 0 ? 7 : 7 - d.getDay();
  d.setDate(d.getDate() + daysUntil);
  return { data: dateStr(d), dias: daysUntil };
}

const fmtBRL   = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtMoeda = (val: string): string => {
  if (!val) return '';
  const n = parseFloat(val);
  return isNaN(n) ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const parseMoeda = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return (parseInt(digits, 10) / 100).toString();
};
const fmtFone = (v: string): string => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
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
  const [selCong,  setSelCong]  = useState('');
  const [selTurma, setSelTurma] = useState('');
  const [selData,  setSelData]  = useState<string | null>(null);

  // Trimestre
  const [trimestre,    setTrimestre]    = useState<EbdTrimestre | null>(null);
  const [trimLoading,  setTrimLoading]  = useState(false);
  const [sundays,      setSundays]      = useState<string[]>([]);
  const [aulasMap,     setAulasMap]     = useState<Map<string, EbdAula>>(new Map());
  const [aulasMapLoad, setAulasMapLoad] = useState(false);

  // Aula atual
  const [aula,        setAula]        = useState<EbdAula | null>(null);
  const [aulaLoading, setAulaLoading] = useState(false);
  const [aulaForm,    setAulaForm]    = useState({ tema: '', licao_numero: '', professor_id: '', trimestre: trimAtual().toString(), observacoes: '' });

  // Chamada
  const [freqs,         setFreqs]         = useState<FreqItem[]>([]);
  const [visitantes,    setVisitantes]    = useState<Visitante[]>([]);
  const [novoVisit,     setNovoVisit]     = useState({ nome: '', telefone: '' });
  const [showVisitForm, setShowVisitForm] = useState(false);

  // Oferta
  const [oferta,      setOferta]      = useState('');
  const [formaOferta, setFormaOferta] = useState('dinheiro');
  const [ofertaSalva, setOfertaSalva] = useState(false);

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
    setSelData(null);
    setAula(null);
    setFreqs([]);
    setVisitantes([]);
    setAulasMap(new Map());
  }, [supabase]);

  // ── Carregar trimestre ativo ─────────────────────────────────────────────

  const loadTrimestre = useCallback(async (mid: string) => {
    setTrimLoading(true);
    const today = hoje();
    let { data } = await supabase
      .from('ebd_trimestres').select('*').eq('ministry_id', mid).eq('ativo', true)
      .lte('data_inicio', today).gte('data_fim', today)
      .order('created_at', { ascending: false }).limit(1);
    if (!data?.length) {
      const r = await supabase
        .from('ebd_trimestres').select('*').eq('ministry_id', mid).eq('ativo', true)
        .order('ano', { ascending: false }).order('numero', { ascending: false }).limit(1);
      data = r.data;
    }
    const trim = data?.[0] ?? null;
    setTrimestre(trim);
    setSundays(trim ? getSundays(trim.data_inicio, trim.data_fim) : []);
    setTrimLoading(false);
  }, [supabase]);

  // ── Carregar aulas do trimestre para a turma ─────────────────────────────

  const loadAulasMap = useCallback(async (turmaId: string, trim: EbdTrimestre) => {
    setAulasMapLoad(true);
    const { data } = await supabase.from('ebd_aulas').select('*')
      .eq('turma_id', turmaId).gte('data_aula', trim.data_inicio).lte('data_aula', trim.data_fim);
    const map = new Map<string, EbdAula>();
    (data ?? []).forEach((a: EbdAula) => map.set(a.data_aula, a));
    setAulasMap(map);
    setAulasMapLoad(false);
  }, [supabase]);

  useEffect(() => {
    if (!user) return;
    resolveMinistryId(supabase).then(mid => {
      if (mid) { setMinistryId(mid); loadBase(mid); loadTrimestre(mid); }
    });
  }, [user, supabase, loadBase, loadTrimestre]);

  useEffect(() => {
    if (ministryId && selCong) loadTurmas(ministryId, selCong);
  }, [ministryId, selCong, loadTurmas]);

  useEffect(() => {
    if (selTurma && trimestre) {
      loadAulasMap(selTurma, trimestre);
      setSelData(null); setAula(null); setFreqs([]); setVisitantes([]);
    }
  }, [selTurma, trimestre, loadAulasMap]);

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
        trimestre: trimestre?.numero?.toString() ?? trimAtual().toString(), observacoes: '',
      });
      setFreqs(alunosDaTurma.map(a => ({ aluno_id: a.id, nome: a.nome, presente: false, freq_id: null })));
    }
    setAulaLoading(false);
  }, [ministryId, selTurma, selData, turmas, trimestre, supabase]);

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
    if (!ministryId || !selTurma || !selData) return;
    setSaving(true);

    const totalPresentes  = freqs.filter(f => f.presente).length;
    const totalVisitantes = visitantes.length;
    const ano = anoAtual();
    const numeroTrimestre = parseInt(aulaForm.trimestre) || trimAtual();

    let aulaId = aula?.id ?? null;

    if (!aulaId) {
      // Cria a aula
      const { data: novaAula, error } = await supabase.from('ebd_aulas').insert({
        ministry_id: ministryId,
        turma_id: selTurma,
        data_aula: selData,
        trimestre_id: trimestre?.id ?? null,
        ano,
        trimestre: numeroTrimestre,
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
      const novaAulaObj: EbdAula = {
        id: novaAula.id, turma_id: selTurma, data_aula: selData,
        ano, trimestre: numeroTrimestre, licao_numero: null, tema: null,
        professor_id: null, total_presentes: totalPresentes,
        total_visitantes: totalVisitantes, status: 'realizada', observacoes: null,
      };
      setAula(novaAulaObj);
      setAulasMap(prev => new Map(prev).set(selData, novaAulaObj));
    } else {
      // Atualiza aula existente
      const updated = {
        licao_numero: aulaForm.licao_numero ? parseInt(aulaForm.licao_numero) : null,
        tema: aulaForm.tema || null,
        professor_id: aulaForm.professor_id || null,
        observacoes: aulaForm.observacoes || null,
        status: 'realizada',
        trimestre: numeroTrimestre,
        total_presentes: totalPresentes,
        total_visitantes: totalVisitantes,
      };
      await supabase.from('ebd_aulas').update(updated).eq('id', aulaId);
      setAulasMap(prev => {
        const m = new Map(prev);
        const existing = m.get(selData);
        if (existing) m.set(selData, { ...existing, ...updated, status: 'realizada' });
        return m;
      });
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
    if (!aula?.id || !ministryId || !selCong || !oferta || parseFloat(oferta) <= 0 || !selData) return;
    const ano = anoAtual();
    const numeroTrimestre = parseInt(aulaForm.trimestre) || trimAtual();
    const { error } = await supabase.from('ebd_ofertas').upsert({
      ministry_id: ministryId,
      church_id: selCong,
      aula_id: aula.id,
      data_oferta: selData,
      ano,
      trimestre: numeroTrimestre,
      valor: parseFloat(oferta),
      forma_pagamento: formaOferta,
      destino: 'tesouraria_local',
    }, { onConflict: 'aula_id' } as any);
    if (error) flash('erro', error.message);
    else { setOfertaSalva(true); flash('ok', 'Oferta registrada!'); }
  };

  // ── Status de cada domingo ─────────────────────────────────────────────

  const getSundayStatus = (d: string): 'realizada' | 'disponivel' | 'sem_chamada' | 'agendada' => {
    const aulaEntry = aulasMap.get(d);
    if (aulaEntry?.status === 'realizada') return 'realizada';
    const todayStr = hoje();
    if (d === todayStr && isSunday()) return 'disponivel';
    if (d <= todayStr) return 'sem_chamada';
    return 'agendada';
  };

  // ── Derived ──────────────────────────────────────────────────────────────

  const turmasFiltradas = turmas.filter(t => !selCong || t.church_id === selCong);
  const presentes       = freqs.filter(f => f.presente).length;
  const ausentes        = freqs.filter(f => !f.presente).length;
  const pctPresenca     = freqs.length > 0 ? Math.round((presentes / freqs.length) * 100) : 0;
  const todayStr        = hoje();
  const proximoDom      = !isSunday() ? proximoDomingo() : null;

  return (
    <PageLayout
      title="EBD — Chamada Dominical"
      description="Registre a presença dos alunos em cada domingo do trimestre"
      activeMenu="ebd-aulas-frequencia"
    >
      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
          msg.tipo === 'ok'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {msg.texto}
        </div>
      )}

      {/* ── Seleção Igreja + Turma ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-5">
        <h2 className="text-sm font-bold text-gray-600 mb-4">Selecionar turma</h2>
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
        </div>
      </div>

      {/* ── Sem trimestre ativo ── */}
      {!trimLoading && !trimestre && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3 mb-5">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Nenhum trimestre ativo encontrado</p>
            <p className="text-xs text-amber-600 mt-1">Cadastre um trimestre para ativar o controle de chamadas por domingo.</p>
            <a href="/ebd/trimestres" className="inline-block mt-2 text-xs font-semibold text-amber-700 underline hover:text-amber-900">
              Gerenciar Trimestres →
            </a>
          </div>
        </div>
      )}

      {/* ── Trimestre ativo ── */}
      {trimestre && (
        <>
          {/* Cabeçalho do trimestre */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                {trimestre.numero}º
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{trimestre.descricao}</p>
                <p className="text-xs text-gray-400">
                  {new Date(trimestre.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')} até{' '}
                  {new Date(trimestre.data_fim + 'T12:00:00').toLocaleDateString('pt-BR')}
                  {' · '}{sundays.length} domingos
                </p>
              </div>
            </div>
            <a href="/ebd/trimestres" className="text-xs text-gray-400 hover:text-blue-600 transition">Gerenciar →</a>
          </div>

          {/* Banner: hoje não é domingo */}
          {proximoDom && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 flex items-center gap-3">
              <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <p className="text-xs text-blue-700">
                Hoje não é domingo. Próxima chamada em{' '}
                <span className="font-bold">
                  {new Date(proximoDom.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}
                </span>
                {' '}({proximoDom.dias} {proximoDom.dias === 1 ? 'dia' : 'dias'}).
                Você ainda pode registrar chamadas retroativas nos domingos passados abaixo.
              </p>
            </div>
          )}

          {/* Banner: hoje é domingo */}
          {isSunday() && (
            <div className="bg-green-50 border border-green-300 rounded-xl p-3 mb-4 flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
              <p className="text-xs text-green-800 font-semibold">
                Hoje é domingo! Selecione a turma e clique no domingo de hoje para registrar a chamada.
              </p>
            </div>
          )}

          {/* Grade de domingos */}
          {!selTurma ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 mb-5">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Selecione uma turma para ver os domingos do trimestre</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-700">Domingos do trimestre</h3>
                {aulasMapLoad && <span className="text-xs text-gray-400">Carregando...</span>}
              </div>
              <div className="flex flex-wrap gap-3 mb-4">
                {[
                  { color: 'bg-green-500', label: 'Realizada' },
                  { color: 'bg-blue-600', label: 'Hoje — fazer chamada' },
                  { color: 'bg-red-300', label: 'Sem chamada (passado)' },
                  { color: 'bg-gray-200', label: 'Agendada' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <span className={`w-3 h-3 rounded-full ${item.color}`} />
                    <span className="text-xs text-gray-500">{item.label}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-9 gap-2">
                {sundays.map((d, i) => {
                  const status   = getSundayStatus(d);
                  const canClick = d <= todayStr;
                  const isSelected = selData === d;
                  const label = new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                  const colorClass = {
                    realizada:   'bg-green-500 text-white border-green-500',
                    disponivel:  'bg-blue-600 text-white border-blue-600 animate-pulse',
                    sem_chamada: 'bg-red-100 text-red-600 border-red-200',
                    agendada:    'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60',
                  }[status];
                  return (
                    <button
                      key={d}
                      disabled={!canClick}
                      onClick={() => canClick && setSelData(d)}
                      title={`Semana ${i + 1} — ${new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}`}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-medium transition-all
                        ${colorClass}
                        ${canClick ? 'hover:scale-105 hover:shadow-sm' : ''}
                        ${isSelected ? 'ring-2 ring-offset-1 ring-blue-400 scale-105 shadow-md' : ''}
                      `}
                    >
                      <span className="font-bold">{label}</span>
                      {status === 'realizada'   && <CheckCircle2 className="w-3 h-3 mt-0.5" />}
                      {status === 'sem_chamada' && <XCircle className="w-3 h-3 mt-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Formulário da aula (aparece ao selecionar um domingo) ── */}
          {selData && selTurma && (
            aulaLoading ? (
              <div className="text-center py-12 text-gray-400 text-sm">Carregando chamada...</div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs font-semibold text-gray-500 px-2">
                    {new Date(selData + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                  </span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  <div className="lg:col-span-2 space-y-5">

                    {/* Dados da aula */}
                    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                      <h3 className="text-sm font-bold text-gray-600 mb-4">Dados da aula</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Lição nº</label>
                          <input type="number" value={aulaForm.licao_numero}
                            onChange={e => setAulaForm(f => ({ ...f, licao_numero: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Ex: 3" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Trimestre</label>
                          <select value={aulaForm.trimestre}
                            onChange={e => setAulaForm(f => ({ ...f, trimestre: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                            {[1,2,3,4].map(t => <option key={t} value={t}>{t}º Trimestre</option>)}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Tema / Título da lição</label>
                          <input value={aulaForm.tema}
                            onChange={e => setAulaForm(f => ({ ...f, tema: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                            placeholder="Ex: A fé que move montanhas" />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Professor que ministrou</label>
                          <select value={aulaForm.professor_id}
                            onChange={e => setAulaForm(f => ({ ...f, professor_id: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                            <option value="">Não informado</option>
                            {professores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Observações</label>
                          <textarea value={aulaForm.observacoes}
                            onChange={e => setAulaForm(f => ({ ...f, observacoes: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" rows={2}
                            placeholder="Anotações sobre a aula..." />
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

                  {/* Coluna lateral */}
                  <div className="space-y-5">
                    {/* Resumo */}
                    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                      <h3 className="text-sm font-bold text-gray-600 mb-4">Resumo da aula</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm"><span className="text-gray-500">Matriculados</span><span className="font-semibold text-gray-800">{freqs.length}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-gray-500">Presentes</span><span className="font-semibold text-green-600">{presentes}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-gray-500">Ausentes</span><span className="font-semibold text-red-500">{ausentes}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-gray-500">Visitantes</span><span className="font-semibold text-blue-600">{visitantes.length}</span></div>
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
                      {!aula && <p className="px-5 py-4 text-xs text-gray-400">Salve a chamada primeiro para adicionar visitantes.</p>}
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
                        {visitantes.length === 0 && aula && <p className="px-5 py-4 text-xs text-gray-400">Nenhum visitante registrado.</p>}
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
                            <input type="text" inputMode="numeric" value={fmtMoeda(oferta)}
                              onChange={e => { setOferta(parseMoeda(e.target.value)); setOfertaSalva(false); }}
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
              </>
            )
          )}
        </>
      )}

      {/* Estado vazio */}
      {!selTurma && !trimestre && !trimLoading && (
        <div className="text-center py-20 text-gray-300">
          <Calendar className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-sm font-medium text-gray-400">Configure um trimestre e selecione uma turma para começar</p>
        </div>
      )}
    </PageLayout>
  );
}
