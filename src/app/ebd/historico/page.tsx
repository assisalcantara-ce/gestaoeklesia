'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { CalendarDays, Users, UserCheck, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Congregacao { id: string; nome: string; }
interface EbdTurma    { id: string; nome: string; church_id: string; }

interface FreqDetalhe {
  aluno_id: string;
  nome: string;
  presente: boolean;
}

interface VisitanteDetalhe {
  id: string;
  nome: string;
  telefone: string | null;
}

interface Aula {
  id: string;
  turma_id: string;
  turma_nome: string;
  church_id: string;
  church_nome: string;
  data_aula: string;
  trimestre: number | null;
  ano: number;
  licao_numero: number | null;
  tema: string | null;
  professor_nome: string | null;
  total_presentes: number;
  total_visitantes: number;
  status: string;
  oferta_valor: number | null;
  // detalhes expandidos (carregados sob demanda)
  freqs?: FreqDetalhe[];
  visitantes?: VisitanteDetalhe[];
}

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const TRIM_LABEL = ['1º Tri', '2º Tri', '3º Tri', '4º Tri'];

// ─── Componente ──────────────────────────────────────────────────────────────

export default function EbdHistoricoPage() {
  const { user }  = useRequireSupabaseAuth();
  const supabase  = useMemo(() => createClient(), []);

  const [ministryId,   setMinistryId]   = useState<string | null>(null);
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
  const [turmas,       setTurmas]       = useState<EbdTurma[]>([]);
  const [aulas,        setAulas]        = useState<Aula[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [expandLoading,setExpandLoading]= useState(false);

  // Filtros
  const [filtCong,  setFiltCong]  = useState('');
  const [filtTurma, setFiltTurma] = useState('');
  const [filtDe,    setFiltDe]    = useState('');
  const [filtAte,   setFiltAte]   = useState('');

  // ── Carregar base ────────────────────────────────────────────────────────

  const loadBase = useCallback(async (mid: string) => {
    const [congsR, turmasR] = await Promise.all([
      supabase.from('congregacoes').select('id, nome').eq('ministry_id', mid).order('nome'),
      supabase.from('ebd_turmas').select('id, nome, church_id').eq('ministry_id', mid).eq('ativo', true).order('nome'),
    ]);
    setCongregacoes(congsR.data ?? []);
    setTurmas(turmasR.data ?? []);
  }, [supabase]);

  useEffect(() => {
    if (!user) return;
    resolveMinistryId(supabase).then(mid => {
      if (mid) { setMinistryId(mid); loadBase(mid); }
    });
  }, [user, supabase, loadBase]);

  // ── Buscar aulas ─────────────────────────────────────────────────────────

  const buscar = useCallback(async () => {
    if (!ministryId) return;
    setLoading(true);
    setExpandedId(null);

    let q = supabase
      .from('ebd_aulas')
      .select(`
        id, turma_id, data_aula, trimestre, ano,
        licao_numero, tema, status,
        total_presentes, total_visitantes,
        ebd_turmas(nome, church_id, congregacoes(nome)),
        ebd_professores(nome),
        ebd_ofertas(valor)
      `)
      .eq('ministry_id', ministryId)
      .order('data_aula', { ascending: false })
      .limit(200);

    if (filtCong)  q = q.eq('ebd_turmas.church_id', filtCong);
    if (filtTurma) q = q.eq('turma_id', filtTurma);
    if (filtDe)    q = q.gte('data_aula', filtDe);
    if (filtAte)   q = q.lte('data_aula', filtAte);

    const { data, error } = await q;
    if (error) { setLoading(false); return; }

    const mapped: Aula[] = (data ?? [])
      .map((r: any) => ({
        id:               r.id,
        turma_id:         r.turma_id,
        turma_nome:       r.ebd_turmas?.nome ?? '—',
        church_id:        r.ebd_turmas?.church_id ?? '',
        church_nome:      r.ebd_turmas?.congregacoes?.nome ?? '—',
        data_aula:        r.data_aula,
        trimestre:        r.trimestre,
        ano:              r.ano,
        licao_numero:     r.licao_numero,
        tema:             r.tema,
        professor_nome:   r.ebd_professores?.nome ?? null,
        total_presentes:  r.total_presentes ?? 0,
        total_visitantes: r.total_visitantes ?? 0,
        status:           r.status,
        oferta_valor:     r.ebd_ofertas?.[0]?.valor ?? null,
      }))
      // filtro de congregação no client (PostgREST faz filtro inner join)
      .filter((r: Aula) => !filtCong || r.church_id === filtCong);

    setAulas(mapped);
    setLoading(false);
  }, [ministryId, filtCong, filtTurma, filtDe, filtAte, supabase]);

  useEffect(() => { buscar(); }, [buscar]);

  // ── Expandir detalhe ─────────────────────────────────────────────────────

  const toggleExpand = async (aula: Aula) => {
    if (expandedId === aula.id) { setExpandedId(null); return; }
    setExpandedId(aula.id);
    if (aula.freqs) return; // já carregado

    setExpandLoading(true);
    const [freqR, visitR] = await Promise.all([
      supabase
        .from('ebd_frequencias')
        .select('aluno_id, presente, ebd_alunos(nome)')
        .eq('aula_id', aula.id)
        .order('ebd_alunos(nome)'),
      supabase
        .from('ebd_visitantes_aula')
        .select('id, nome, telefone')
        .eq('aula_id', aula.id)
        .order('nome'),
    ]);
    const freqs: FreqDetalhe[] = (freqR.data ?? []).map((f: any) => ({
      aluno_id: f.aluno_id,
      nome:     f.ebd_alunos?.nome ?? '—',
      presente: f.presente,
    }));
    const visitantes: VisitanteDetalhe[] = visitR.data ?? [];
    setAulas(prev => prev.map(a => a.id === aula.id ? { ...a, freqs, visitantes } : a));
    setExpandLoading(false);
  };

  // ── Turmas filtradas ─────────────────────────────────────────────────────

  const turmasFiltradas = filtCong
    ? turmas.filter(t => t.church_id === filtCong)
    : turmas;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <PageLayout
      title="EBD — Histórico de Chamadas"
      description="Lista de todas as aulas registradas com presença, visitantes e oferta"
      activeMenu="ebd-relatorios-historico"
    >

      {/* ── Filtros ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-md mb-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Igreja</label>
            <select
              value={filtCong}
              onChange={e => { setFiltCong(e.target.value); setFiltTurma(''); }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Todas</option>
              {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Turma</label>
            <select
              value={filtTurma}
              onChange={e => setFiltTurma(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Todas</option>
              {turmasFiltradas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">De</label>
            <input
              type="date"
              value={filtDe}
              onChange={e => setFiltDe(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Até</label>
            <input
              type="date"
              value={filtAte}
              onChange={e => setFiltAte(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
          {aulas.length} aula(s) encontrada(s)
        </div>
      </div>

      {/* ── Tabela ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Carregando...</div>
        ) : aulas.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            Nenhuma chamada registrada para os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b-2 border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-8" />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Igreja</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Turma</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Lição / Tema</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Professor</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Presença</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Visitantes</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Oferta</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {aulas.map(aula => {
                  const isExpanded = expandedId === aula.id;
                  const totalMatric = aula.freqs ? aula.freqs.length : null;
                  const pct = totalMatric && totalMatric > 0
                    ? Math.round((aula.total_presentes / totalMatric) * 100)
                    : null;

                  return (
                    <>
                      <tr
                        key={aula.id}
                        className="hover:bg-slate-50 transition cursor-pointer"
                        onClick={() => toggleExpand(aula)}
                      >
                        {/* Expand toggle */}
                        <td className="px-4 py-3 text-gray-400">
                          {isExpanded
                            ? <ChevronUp className="h-4 w-4" />
                            : <ChevronDown className="h-4 w-4" />}
                        </td>

                        {/* Data */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-[#123b63] shrink-0" />
                            <div>
                              <p className="font-semibold text-gray-800">{fmtDate(aula.data_aula)}</p>
                              {aula.trimestre && (
                                <p className="text-xs text-gray-400">{TRIM_LABEL[(aula.trimestre - 1)] ?? ''}/{aula.ano}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Igreja */}
                        <td className="px-4 py-3 text-gray-600 text-xs">{aula.church_nome}</td>

                        {/* Turma */}
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-semibold">
                            {aula.turma_nome}
                          </span>
                        </td>

                        {/* Lição / Tema */}
                        <td className="px-4 py-3 max-w-[180px]">
                          {aula.licao_numero && (
                            <span className="text-xs font-bold text-gray-500 mr-1">Lição {aula.licao_numero}</span>
                          )}
                          {aula.tema && (
                            <span className="text-xs text-gray-600 truncate block">{aula.tema}</span>
                          )}
                          {!aula.licao_numero && !aula.tema && (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>

                        {/* Professor */}
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {aula.professor_nome ?? <span className="text-gray-300">—</span>}
                        </td>

                        {/* Presença */}
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <UserCheck className="h-4 w-4 text-green-500" />
                            <span className="font-semibold text-green-700">{aula.total_presentes}</span>
                          </div>
                          {pct !== null && (
                            <p className="text-xs text-gray-400 mt-0.5">{pct}%</p>
                          )}
                        </td>

                        {/* Visitantes */}
                        <td className="px-4 py-3 text-center">
                          {aula.total_visitantes > 0 ? (
                            <div className="flex items-center justify-center gap-1">
                              <Users className="h-4 w-4 text-blue-400" />
                              <span className="font-semibold text-blue-600">{aula.total_visitantes}</span>
                            </div>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>

                        {/* Oferta */}
                        <td className="px-4 py-3 text-right">
                          {aula.oferta_valor != null ? (
                            <span className="font-semibold text-[#123b63] text-xs">{fmtBRL(aula.oferta_valor)}</span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>

                        {/* Ações */}
                        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <Link
                            href={`/ebd/chamada?turma=${aula.turma_id}&data=${aula.data_aula}&cong=${aula.church_id}`}
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-[#123b63] text-white rounded-lg hover:bg-[#0f2a45] transition"
                            title="Abrir chamada"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Abrir
                          </Link>
                        </td>
                      </tr>

                      {/* Linha expandida — detalhes */}
                      {isExpanded && (
                        <tr key={`${aula.id}-detail`} className="bg-slate-50/80">
                          <td colSpan={10} className="px-6 py-4">
                            {expandLoading && !aula.freqs ? (
                              <p className="text-xs text-gray-400">Carregando detalhes...</p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                                {/* Chamada */}
                                <div>
                                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                                    Chamada ({aula.freqs?.length ?? 0} alunos)
                                  </p>
                                  {!aula.freqs || aula.freqs.length === 0 ? (
                                    <p className="text-xs text-gray-400">Nenhum aluno registrado.</p>
                                  ) : (
                                    <div className="grid grid-cols-2 gap-1">
                                      {aula.freqs.map(f => (
                                        <div
                                          key={f.aluno_id}
                                          className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                                            f.presente
                                              ? 'bg-green-50 text-green-800'
                                              : 'bg-red-50 text-red-600'
                                          }`}
                                        >
                                          <span>{f.presente ? '✓' : '✗'}</span>
                                          <span className="truncate">{f.nome}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Visitantes */}
                                <div>
                                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                                    Visitantes ({aula.visitantes?.length ?? 0})
                                  </p>
                                  {!aula.visitantes || aula.visitantes.length === 0 ? (
                                    <p className="text-xs text-gray-400">Nenhum visitante.</p>
                                  ) : (
                                    <div className="space-y-1">
                                      {aula.visitantes.map(v => (
                                        <div key={v.id} className="flex items-center gap-2 text-xs text-gray-700 bg-blue-50 px-2 py-1 rounded">
                                          <Users className="h-3 w-3 text-blue-400 shrink-0" />
                                          <span className="font-medium">{v.nome}</span>
                                          {v.telefone && <span className="text-gray-400">{v.telefone}</span>}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
