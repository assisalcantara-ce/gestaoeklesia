'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { BarChart3, DollarSign, Link2, Cake, FileText, Printer, UserCheck, X } from 'lucide-react';
import { useAppDialog } from '@/providers/AppDialogProvider';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Congregacao { id: string; nome: string; }
interface EbdTurma    { id: string; nome: string; church_id: string; }

interface FreqResumo {
  aluno_id: string; nome: string; turma_nome: string;
  total_aulas: number; presentes: number; pct: number;
}

interface EbdOferta {
  id: string; church_id: string; aula_id: string | null;
  data_oferta: string; trimestre: number | null; ano: number;
  valor: number; forma_pagamento: string; destino: string;
  lancamento_tesouraria_id: string | null; observacoes: string | null;
  church_nome?: string;
}

interface Aniversariante {
  id: string; nome: string; data_nascimento: string;
  idade: number; turma_nome: string;
  responsavel_nome: string | null; responsavel_telefone: string | null;
  church_nome: string;
}

interface BoletimAula {
  id: string; turma_nome: string; church_nome: string;
  data_aula: string; trimestre: number | null; ano: number;
  licao_numero: number | null; tema: string | null;
  professor_nome: string | null;
  total_presentes: number; total_visitantes: number;
  status: string;
}

interface BoletimFreq {
  aluno_id: string; nome: string; presente: boolean;
}

interface BoletimVisitante {
  id: string; nome: string; telefone: string | null;
}

type Aba = 'frequencia' | 'ofertas' | 'aniversariantes' | 'boletim';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const anoAtual = () => new Date().getFullYear();

// ─── Componente ──────────────────────────────────────────────────────────────

export default function EbdRelatoriosPage() {
  const { user } = useRequireSupabaseAuth();
  const supabase  = useMemo(() => createClient(), []);
  const dialog    = useAppDialog();

  const [ministryId,   setMinistryId]   = useState<string | null>(null);
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
  const [turmas,       setTurmas]       = useState<EbdTurma[]>([]);

  const [aba,     setAba]     = useState<Aba>('frequencia');
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  // Filtros frequência
  const [filtFreqCong,  setFiltFreqCong]  = useState('');
  const [filtFreqTurma, setFiltFreqTurma] = useState('');
  const [filtFreqDe,    setFiltFreqDe]    = useState('');
  const [filtFreqAte,   setFiltFreqAte]   = useState('');
  const [freqDados,     setFreqDados]     = useState<FreqResumo[]>([]);
  const [freqLoading,   setFreqLoading]   = useState(false);

  // Aniversariantes
  const [filtAnivMes,    setFiltAnivMes]    = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [filtAnivCong,   setFiltAnivCong]   = useState('');
  const [aniversariantes,setAniversariantes]= useState<Aniversariante[]>([]);
  const [anivLoading,    setAnivLoading]    = useState(false);

  // Boletim
  const [boletimCong,      setBoletimCong]      = useState('');
  const [boletimTurma,     setBoletimTurma]     = useState('');
  const [boletimData,      setBoletimData]      = useState('');
  const [boletimAulas,     setBoletimAulas]     = useState<BoletimAula[]>([]);
  const [boletimSel,       setBoletimSel]       = useState<BoletimAula | null>(null);
  const [boletimFreqs,     setBoletimFreqs]     = useState<BoletimFreq[]>([]);
  const [boletimVisit,     setBoletimVisit]     = useState<BoletimVisitante[]>([]);
  const [boletimOferta,    setBoletimOferta]    = useState<number>(0);
  const [boletimLoading,   setBoletimLoading]   = useState(false);
  const [boletimDetLoading,setBoletimDetLoading]= useState(false);

  // Filtros ofertas
  const [filtOfCong,  setFiltOfCong]  = useState('');
  const [filtOfAno,   setFiltOfAno]   = useState(anoAtual().toString());
  const [filtOfTri,   setFiltOfTri]   = useState('');
  const [ofertas,     setOfertas]     = useState<EbdOferta[]>([]);
  const [ofLoading,   setOfLoading]   = useState(false);
  const [integrandoId,setIntegrandoId]= useState<string | null>(null);

  // ── Carregar base ────────────────────────────────────────────────────────

  const loadBase = useCallback(async (mid: string) => {
    setLoading(true);
    const [congsR, turmasR] = await Promise.all([
      supabase.from('congregacoes').select('id, nome').eq('ministry_id', mid).order('nome'),
      supabase.from('ebd_turmas').select('id, nome, church_id').eq('ministry_id', mid).eq('ativo', true).order('nome'),
    ]);
    setCongregacoes(congsR.data ?? []);
    setTurmas(turmasR.data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!user) return;
    resolveMinistryId(supabase).then(mid => { if (mid) { setMinistryId(mid); loadBase(mid); } });
  }, [user, supabase, loadBase]);

  const flash = (tipo: 'ok' | 'erro', texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 5000);
  };

  // ── Relatório de Frequência ──────────────────────────────────────────────

  const gerarRelFreq = useCallback(async () => {
    if (!ministryId) return;
    setFreqLoading(true);
    setFreqDados([]);

    // 1. Busca aulas no período
    let aulasQ = supabase
      .from('ebd_aulas')
      .select('id, turma_id, data_aula')
      .eq('ministry_id', ministryId)
      .eq('status', 'realizada');
    if (filtFreqDe)    aulasQ = aulasQ.gte('data_aula', filtFreqDe);
    if (filtFreqAte)   aulasQ = aulasQ.lte('data_aula', filtFreqAte);
    if (filtFreqTurma) aulasQ = aulasQ.eq('turma_id', filtFreqTurma);
    const { data: aulasData } = await aulasQ;
    if (!aulasData || aulasData.length === 0) { setFreqLoading(false); return; }

    type AulaRow = { id: string; turma_id: string; data_aula: string };
    const aulas = aulasData as AulaRow[];
    const turmaIds = [...new Set(aulas.map(a => a.turma_id))];

    // Filtra por congregação (via turma → church_id)
    const turmasFiltradas = filtFreqCong
      ? turmas.filter(t => t.church_id === filtFreqCong && turmaIds.includes(t.id))
      : turmas.filter(t => turmaIds.includes(t.id));
    const turmaIdsFiltrados = turmasFiltradas.map(t => t.id);
    const aulasIds2 = aulas.filter(a => turmaIdsFiltrados.includes(a.turma_id)).map(a => a.id);

    // 2. Conta aulas por turma
    const aulasPorTurma = new Map<string, number>();
    aulas.filter(a => turmaIdsFiltrados.includes(a.turma_id)).forEach(a => {
      aulasPorTurma.set(a.turma_id, (aulasPorTurma.get(a.turma_id) ?? 0) + 1);
    });

    // 3. Busca frequências
    const { data: freqData } = await supabase
      .from('ebd_frequencias')
      .select('aluno_id, presente, aula_id')
      .in('aula_id', aulasIds2.length > 0 ? aulasIds2 : ['__none__']);

    // 4. Busca alunos + matrículas ativas
    const { data: matsData } = await supabase
      .from('ebd_matriculas')
      .select('aluno_id, turma_id, ebd_alunos(id, nome)')
      .in('turma_id', turmaIdsFiltrados.length > 0 ? turmaIdsFiltrados : ['__none__'])
      .is('data_fim', null);

    // 5. Agrupa frequências por aluno
    type FreqRow = { aluno_id: string; presente: boolean; aula_id: string };
    const freqPorAluno = new Map<string, { presentes: number }>();
    ((freqData ?? []) as FreqRow[]).forEach(f => {
      const prev = freqPorAluno.get(f.aluno_id) ?? { presentes: 0 };
      if (f.presente) prev.presentes += 1;
      freqPorAluno.set(f.aluno_id, prev);
    });

    // 6. Monta resumo
    const turmaMap = new Map(turmas.map(t => [t.id, t.nome]));
    const resultado: FreqResumo[] = (matsData ?? []).map((m: any) => {
      const totalAulas = aulasPorTurma.get(m.turma_id) ?? 0;
      const presentes  = freqPorAluno.get(m.aluno_id)?.presentes ?? 0;
      return {
        aluno_id:   m.aluno_id,
        nome:       m.ebd_alunos?.nome ?? '—',
        turma_nome: turmaMap.get(m.turma_id) ?? '—',
        total_aulas: totalAulas,
        presentes,
        pct: totalAulas > 0 ? Math.round((presentes / totalAulas) * 100) : 0,
      };
    });

    setFreqDados(resultado.sort((a, b) => b.pct - a.pct));
    setFreqLoading(false);
  }, [ministryId, filtFreqCong, filtFreqTurma, filtFreqDe, filtFreqAte, turmas, supabase]);

  // ── Ofertas ──────────────────────────────────────────────────────────────

  const carregarOfertas = useCallback(async () => {
    if (!ministryId) return;
    setOfLoading(true);
    let q = supabase
      .from('ebd_ofertas')
      .select('*')
      .eq('ministry_id', ministryId)
      .order('data_oferta', { ascending: false });
    if (filtOfCong) q = q.eq('church_id', filtOfCong);
    if (filtOfAno)  q = q.eq('ano', parseInt(filtOfAno));
    if (filtOfTri)  q = q.eq('trimestre', parseInt(filtOfTri));
    const { data } = await q;
    const congMap = new Map(congregacoes.map(c => [c.id, c.nome]));
    setOfertas(((data ?? []) as EbdOferta[]).map(o => ({ ...o, church_nome: congMap.get(o.church_id) ?? '—' })));
    setOfLoading(false);
  }, [ministryId, filtOfCong, filtOfAno, filtOfTri, congregacoes, supabase]);

  useEffect(() => {
    if (aba === 'ofertas' && ministryId && congregacoes.length > 0) carregarOfertas();
  }, [aba, ministryId, congregacoes, carregarOfertas]);

  // ── Aniversariantes ──────────────────────────────────────────────────────

  const carregarAniversariantes = useCallback(async () => {
    if (!ministryId) return;
    setAnivLoading(true);
    let q = supabase
      .from('ebd_alunos')
      .select('id, nome, data_nascimento, church_id, responsavel_nome, responsavel_telefone')
      .eq('ministry_id', ministryId)
      .eq('ativo', true)
      .not('data_nascimento', 'is', null);
    if (filtAnivCong) q = q.eq('church_id', filtAnivCong);
    const { data: alunos } = await q;

    const { data: mats } = await supabase
      .from('ebd_matriculas')
      .select('aluno_id, turma_id')
      .eq('ministry_id', ministryId)
      .is('data_fim', null);
    const turmaMap = new Map(turmas.map(t => [t.id, t.nome]));
    const congMap  = new Map(congregacoes.map(c => [c.id, c.nome]));
    const alunoTurma = new Map<string, string>();
    (mats ?? []).forEach((m: any) => alunoTurma.set(m.aluno_id, turmaMap.get(m.turma_id) ?? '—'));

    const mes = parseInt(filtAnivMes);
    const hoje = new Date();
    const lista: Aniversariante[] = ((alunos ?? []) as any[])
      .filter(a => new Date(a.data_nascimento).getUTCMonth() + 1 === mes)
      .map(a => {
        const nasc = new Date(a.data_nascimento);
        const idade = hoje.getFullYear() - nasc.getUTCFullYear() -
          (hoje < new Date(hoje.getFullYear(), nasc.getUTCMonth(), nasc.getUTCDate()) ? 1 : 0);
        return {
          id:                  a.id,
          nome:                a.nome,
          data_nascimento:     a.data_nascimento,
          idade,
          turma_nome:          alunoTurma.get(a.id) ?? '—',
          responsavel_nome:    a.responsavel_nome,
          responsavel_telefone:a.responsavel_telefone,
          church_nome:         congMap.get(a.church_id) ?? '—',
        };
      })
      .sort((a, b) => {
        const da = new Date(a.data_nascimento).getUTCDate();
        const db = new Date(b.data_nascimento).getUTCDate();
        return da - db;
      });
    setAniversariantes(lista);
    setAnivLoading(false);
  }, [ministryId, filtAnivMes, filtAnivCong, turmas, congregacoes, supabase]);

  useEffect(() => {
    if (aba === 'aniversariantes' && ministryId && congregacoes.length > 0) carregarAniversariantes();
  }, [aba, ministryId, congregacoes, carregarAniversariantes]);

  // ── Boletim ──────────────────────────────────────────────────────────────

  const buscarAulasBoletim = useCallback(async () => {
    if (!ministryId || !boletimTurma) return;
    setBoletimLoading(true);
    setBoletimSel(null);
    let q = supabase
      .from('ebd_aulas')
      .select('id, turma_id, data_aula, trimestre, ano, licao_numero, tema, total_presentes, total_visitantes, status, ebd_turmas(nome, congregacoes(nome)), ebd_professores(nome)')
      .eq('ministry_id', ministryId)
      .eq('turma_id', boletimTurma)
      .eq('status', 'realizada')
      .order('data_aula', { ascending: false })
      .limit(20);
    if (boletimData) q = q.eq('data_aula', boletimData);
    const { data } = await q;
    setBoletimAulas((data ?? []).map((a: any) => ({
      id:               a.id,
      turma_nome:       a.ebd_turmas?.nome ?? '—',
      church_nome:      a.ebd_turmas?.congregacoes?.nome ?? '—',
      data_aula:        a.data_aula,
      trimestre:        a.trimestre,
      ano:              a.ano,
      licao_numero:     a.licao_numero,
      tema:             a.tema,
      professor_nome:   a.ebd_professores?.nome ?? null,
      total_presentes:  a.total_presentes,
      total_visitantes: a.total_visitantes,
      status:           a.status,
    })));
    setBoletimLoading(false);
  }, [ministryId, boletimTurma, boletimData, supabase]);

  const abrirBoletim = async (aula: BoletimAula) => {
    setBoletimSel(aula);
    setBoletimDetLoading(true);
    const [freqR, visitR, ofertaR] = await Promise.all([
      supabase
        .from('ebd_frequencias')
        .select('aluno_id, presente, ebd_alunos(nome)')
        .eq('aula_id', aula.id),
      supabase
        .from('ebd_visitantes_aula')
        .select('id, nome, telefone')
        .eq('aula_id', aula.id),
      supabase
        .from('ebd_ofertas')
        .select('valor')
        .eq('aula_id', aula.id),
    ]);
    setBoletimFreqs(((freqR.data ?? []) as any[]).map(f => ({
      aluno_id: f.aluno_id,
      nome:     f.ebd_alunos?.nome ?? '—',
      presente: f.presente,
    })).sort((a, b) => a.nome.localeCompare(b.nome)));
    setBoletimVisit(((visitR.data ?? []) as any[]));
    setBoletimOferta((ofertaR.data ?? []).reduce((s: number, o: any) => s + Number(o.valor), 0));
    setBoletimDetLoading(false);
  };

  const integrarTesouraria = async (oferta: EbdOferta) => {
    if (!ministryId || oferta.lancamento_tesouraria_id) return;
    const ok = await dialog.confirm({ title: 'Integrar com Tesouraria', type: 'info', message: `Deseja criar um lançamento de ${fmtBRL(oferta.valor)} na Tesouraria para esta oferta?`, confirmText: 'Integrar', cancelText: 'Cancelar' });
    if (!ok) return;
    setIntegrandoId(oferta.id);

    const cong = congregacoes.find(c => c.id === oferta.church_id);
    const { data: lanc, error } = await supabase.from('tesouraria_lancamentos').insert({
      ministry_id: ministryId,
      church_id: oferta.church_id,
      descricao: `Oferta EBD — ${cong?.nome ?? ''} — ${new Date(oferta.data_oferta).toLocaleDateString('pt-BR')}`,
      valor: oferta.valor,
      tipo_movimento: 'entrada',
      forma_pagamento: oferta.forma_pagamento,
      data_lancamento: oferta.data_oferta,
      categoria: 'Oferta EBD',
    }).select('id').single();

    if (error) { flash('erro', error.message); setIntegrandoId(null); return; }

    await supabase.from('ebd_ofertas').update({ lancamento_tesouraria_id: lanc.id }).eq('id', oferta.id);
    flash('ok', 'Integrado com a tesouraria com sucesso!');
    setIntegrandoId(null);
    carregarOfertas();
  };

  // ── Derived ──────────────────────────────────────────────────────────────

  const totalOfertas    = ofertas.reduce((s, o) => s + o.valor, 0);
  const totalIntegradas = ofertas.filter(o => o.lancamento_tesouraria_id).length;
  const turmasFiltCong  = filtFreqCong ? turmas.filter(t => t.church_id === filtFreqCong) : turmas;

  const TABS = [
    { id: 'frequencia'     as Aba, label: 'Frequência',      icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'ofertas'        as Aba, label: 'Ofertas',          icon: <DollarSign className="h-4 w-4" /> },
    { id: 'aniversariantes'as Aba, label: 'Aniversariantes',  icon: <Cake className="h-4 w-4" /> },
    { id: 'boletim'        as Aba, label: 'Boletim de Aula',  icon: <FileText className="h-4 w-4" /> },
  ];

  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const boletimTurmasFiltradas = boletimCong ? turmas.filter(t => t.church_id === boletimCong) : turmas;

  return (
    <PageLayout title="EBD — Relatórios" description="Frequência de alunos e ofertas da Escola Bíblica Dominical" activeMenu="ebd-relatorios">
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
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-400 text-sm py-8 text-center">Carregando...</p>}

      {/* ══ ABA: FREQUÊNCIA ══ */}
      {aba === 'frequencia' && !loading && (
        <div className="space-y-5">
          {/* Filtros */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-600 mb-4">Filtros</h3>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Igreja</label>
                <select value={filtFreqCong} onChange={e => { setFiltFreqCong(e.target.value); setFiltFreqTurma(''); }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Todas</option>
                  {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Turma</label>
                <select value={filtFreqTurma} onChange={e => setFiltFreqTurma(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Todas</option>
                  {turmasFiltCong.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">De</label>
                <input type="date" value={filtFreqDe} onChange={e => setFiltFreqDe(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Até</label>
                <input type="date" value={filtFreqAte} onChange={e => setFiltFreqAte(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex items-end">
                <button onClick={gerarRelFreq} disabled={freqLoading}
                  className="px-5 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition disabled:opacity-60">
                  {freqLoading ? 'Gerando...' : 'Gerar relatório'}
                </button>
              </div>
            </div>
          </div>

          {/* Resultado */}
          {freqDados.length > 0 && (
            <>
              {/* Resumo cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm text-center">
                  <p className="text-2xl font-bold text-[#123b63]">{freqDados.length}</p>
                  <p className="text-xs text-gray-500 mt-1">Alunos</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {freqDados.length > 0 ? Math.round(freqDados.reduce((s, f) => s + f.pct, 0) / freqDados.length) : 0}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Média de presença</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm text-center">
                  <p className="text-2xl font-bold text-amber-600">{freqDados.filter(f => f.pct < 50).length}</p>
                  <p className="text-xs text-gray-500 mt-1">Abaixo de 50%</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Aluno</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Turma</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Aulas</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Presentes</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">% Presença</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {freqDados.map(f => (
                      <tr key={f.aluno_id}>
                        <td className="px-4 py-3 font-medium text-gray-800">{f.nome}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{f.turma_nome}</td>
                        <td className="px-4 py-3 text-center text-gray-500">{f.total_aulas}</td>
                        <td className="px-4 py-3 text-center text-green-600 font-medium">{f.presentes}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${f.pct >= 70 ? 'bg-green-500' : f.pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${f.pct}%` }} />
                            </div>
                            <span className={`text-xs font-bold w-9 text-right ${f.pct >= 70 ? 'text-green-600' : f.pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                              {f.pct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {!freqLoading && freqDados.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Aplique os filtros e clique em &quot;Gerar relatório&quot;.</p>
            </div>
          )}
        </div>
      )}

      {/* ══ ABA: OFERTAS ══ */}
      {aba === 'ofertas' && !loading && (
        <div className="space-y-5">
          {/* Filtros */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Igreja</label>
                <select value={filtOfCong} onChange={e => setFiltOfCong(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Todas</option>
                  {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Ano</label>
                <input type="number" value={filtOfAno} onChange={e => setFiltOfAno(e.target.value)}
                  className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Trimestre</label>
                <select value={filtOfTri} onChange={e => setFiltOfTri(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Todos</option>
                  {[1,2,3,4].map(t => <option key={t} value={t}>{t}º Tri</option>)}
                </select>
              </div>
              <button onClick={carregarOfertas} disabled={ofLoading}
                className="px-5 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition disabled:opacity-60">
                {ofLoading ? 'Carregando...' : 'Filtrar'}
              </button>
            </div>
          </div>

          {/* Resumo */}
          {ofertas.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm text-center">
                <p className="text-2xl font-bold text-green-600">{fmtBRL(totalOfertas)}</p>
                <p className="text-xs text-gray-500 mt-1">Total arrecadado</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm text-center">
                <p className="text-2xl font-bold text-[#123b63]">{ofertas.length}</p>
                <p className="text-xs text-gray-500 mt-1">Registros</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm text-center">
                <p className="text-2xl font-bold text-amber-600">{ofertas.length - totalIntegradas}</p>
                <p className="text-xs text-gray-500 mt-1">Não integradas</p>
              </div>
            </div>
          )}

          {ofLoading ? (
            <p className="text-center py-8 text-gray-400 text-sm">Carregando ofertas...</p>
          ) : ofertas.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Nenhuma oferta encontrada para os filtros selecionados.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Data</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Igreja</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Forma</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Valor</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Tesouraria</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ofertas.map(o => (
                    <tr key={o.id}>
                      <td className="px-4 py-3 text-gray-700">{new Date(o.data_oferta).toLocaleDateString('pt-BR')}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{o.church_nome}</td>
                      <td className="px-4 py-3 text-gray-500 capitalize text-xs">{o.forma_pagamento}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmtBRL(o.valor)}</td>
                      <td className="px-4 py-3 text-center">
                        {o.lancamento_tesouraria_id
                          ? <span className="text-xs text-green-600 flex items-center justify-center gap-1"><Link2 className="h-3 w-3" />Integrado</span>
                          : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!o.lancamento_tesouraria_id && (
                          <button onClick={() => integrarTesouraria(o)} disabled={integrandoId === o.id}
                            className="text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-lg font-medium hover:bg-green-100 transition disabled:opacity-50">
                            {integrandoId === o.id ? 'Integrando...' : 'Integrar Tesouraria'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-gray-200 bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-xs font-bold text-gray-600">Total</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-800">{fmtBRL(totalOfertas)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
      {/* ══ ABA: ANIVERSARIANTES ══ */}
      {aba === 'aniversariantes' && !loading && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Mês</label>
                <select value={filtAnivMes} onChange={e => setFiltAnivMes(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  {MESES.map((m, i) => (
                    <option key={i+1} value={String(i+1).padStart(2,'0')}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Igreja</label>
                <select value={filtAnivCong} onChange={e => setFiltAnivCong(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Todas</option>
                  {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <button onClick={carregarAniversariantes} disabled={anivLoading}
                className="px-5 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition disabled:opacity-60">
                {anivLoading ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
          </div>

          {anivLoading ? (
            <p className="text-center py-8 text-gray-400 text-sm">Carregando...</p>
          ) : aniversariantes.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Cake className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Nenhum aniversariante em {MESES[parseInt(filtAnivMes)-1]}.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  <span className="font-bold text-[#123b63]">{aniversariantes.length}</span> aniversariante(s) em {MESES[parseInt(filtAnivMes)-1]}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Dia</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Nome</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Idade</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Turma</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Igreja</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Responsável</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Telefone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {aniversariantes.map(a => (
                      <tr key={a.id}>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-pink-100 text-pink-700 font-bold text-sm">
                            {new Date(a.data_nascimento + 'T00:00:00').getUTCDate()}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800">{a.nome}</td>
                        <td className="px-4 py-3 text-gray-600">{a.idade} anos</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{a.turma_nome}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{a.church_nome}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{a.responsavel_nome || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{a.responsavel_telefone || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ ABA: BOLETIM DE AULA ══ */}
      {aba === 'boletim' && !loading && (
        <div className="space-y-5">
          {/* Seletor */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Igreja</label>
                <select value={boletimCong} onChange={e => { setBoletimCong(e.target.value); setBoletimTurma(''); setBoletimAulas([]); setBoletimSel(null); }}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Selecione...</option>
                  {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Turma *</label>
                <select value={boletimTurma} onChange={e => { setBoletimTurma(e.target.value); setBoletimAulas([]); setBoletimSel(null); }}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Selecione...</option>
                  {boletimTurmasFiltradas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Data (opcional)</label>
                <input type="date" value={boletimData} onChange={e => setBoletimData(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <button onClick={buscarAulasBoletim} disabled={!boletimTurma || boletimLoading}
                className="px-5 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition disabled:opacity-60">
                {boletimLoading ? 'Buscando...' : 'Buscar aulas'}
              </button>
            </div>
          </div>

          {/* Lista de aulas encontradas */}
          {boletimAulas.length > 0 && !boletimSel && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500">{boletimAulas.length} aula(s) encontrada(s) — clique para ver o boletim</p>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {boletimAulas.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => abrirBoletim(a)}>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {new Date(a.data_aula + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{a.licao_numero ? `Lição ${a.licao_numero}` : ''} {a.tema || ''}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{a.professor_nome || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-3 justify-end">
                          <span className="flex items-center gap-1 text-green-700 text-xs font-semibold">
                            <UserCheck className="h-3.5 w-3.5" />{a.total_presentes}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">Ver boletim</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Boletim detalhado */}
          {boletimSel && (
            <div className="bg-white rounded-xl border-2 border-[#123b63] shadow-lg overflow-hidden" id="boletim-print">
              {/* Cabeçalho do boletim */}
              <div className="bg-[#123b63] text-white px-6 py-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold">Boletim de Aula — EBD</h2>
                    <p className="text-blue-200 text-sm mt-0.5">{boletimSel.turma_nome} · {boletimSel.church_nome}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => window.print()}
                      className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition">
                      <Printer className="h-4 w-4" /> Imprimir
                    </button>
                    <button onClick={() => { setBoletimSel(null); }}
                      className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Dados da aula */}
              <div className="px-6 py-4 border-b border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase">Data</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">
                    {new Date(boletimSel.data_aula + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase">Trimestre</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">{boletimSel.trimestre ? `${boletimSel.trimestre}º / ${boletimSel.ano}` : boletimSel.ano}</p>
                </div>
                {boletimSel.licao_numero && (
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase">Lição</p>
                    <p className="text-sm font-medium text-gray-800 mt-0.5">Nº {boletimSel.licao_numero}</p>
                  </div>
                )}
                {boletimSel.professor_nome && (
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase">Professor</p>
                    <p className="text-sm font-medium text-gray-800 mt-0.5">{boletimSel.professor_nome}</p>
                  </div>
                )}
                {boletimSel.tema && (
                  <div className="col-span-full">
                    <p className="text-xs text-gray-400 font-semibold uppercase">Tema</p>
                    <p className="text-sm font-medium text-gray-800 mt-0.5">{boletimSel.tema}</p>
                  </div>
                )}
              </div>

              {/* Resumo */}
              <div className="px-6 py-4 border-b border-gray-100 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{boletimSel.total_presentes}</p>
                  <p className="text-xs text-gray-500">Presentes</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{boletimSel.total_visitantes}</p>
                  <p className="text-xs text-gray-500">Visitantes</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-600">{fmtBRL(boletimOferta)}</p>
                  <p className="text-xs text-gray-500">Oferta</p>
                </div>
              </div>

              {boletimDetLoading ? (
                <p className="text-center py-8 text-gray-400 text-sm">Carregando...</p>
              ) : (
                <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Lista de chamada */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-3">Lista de chamada ({boletimFreqs.length})</h3>
                    {boletimFreqs.length === 0 ? (
                      <p className="text-xs text-gray-400">Nenhuma frequência registrada.</p>
                    ) : (
                      <div className="space-y-1">
                        {boletimFreqs.map(f => (
                          <div key={f.aluno_id} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                            f.presente ? 'bg-green-50' : 'bg-red-50'
                          }`}>
                            <span className={f.presente ? 'text-gray-800' : 'text-gray-400 line-through'}>{f.nome}</span>
                            <span className={`font-bold text-xs ${f.presente ? 'text-green-600' : 'text-red-400'}`}>
                              {f.presente ? '✓' : '✗'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Visitantes */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-3">Visitantes ({boletimVisit.length})</h3>
                    {boletimVisit.length === 0 ? (
                      <p className="text-xs text-gray-400">Nenhum visitante registrado.</p>
                    ) : (
                      <div className="space-y-1">
                        {boletimVisit.map(v => (
                          <div key={v.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-blue-50 text-sm">
                            <span className="text-gray-800">{v.nome}</span>
                            {v.telefone && <span className="text-xs text-gray-400">{v.telefone}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {!boletimLoading && boletimAulas.length === 0 && !boletimSel && (
            <div className="text-center py-12 text-gray-400">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Selecione uma turma e clique em &quot;Buscar aulas&quot;.</p>
            </div>
          )}
        </div>
      )}
    </PageLayout>
  );
}
