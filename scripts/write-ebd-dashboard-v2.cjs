const fs = require('fs');
const path = require('path');

const content = `'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  BookOpen, Users, UserCheck, TrendingUp, DollarSign,
  CalendarDays, Building2, ChevronRight, Globe, MapPin,
} from 'lucide-react';
import Link from 'next/link';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

const trimAtual = () => Math.ceil((new Date().getMonth() + 1) / 3);
const anoAtual  = () => new Date().getFullYear();
const TRIM_LABEL = ['1\\u00ba Trimestre', '2\\u00ba Trimestre', '3\\u00ba Trimestre', '4\\u00ba Trimestre'];
const CORES = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ec4899', '#14b8a6', '#f59e0b', '#6b7280'];

const corPresenca = (pct: number) =>
  pct >= 70 ? 'text-green-600' : pct >= 50 ? 'text-amber-500' : 'text-red-500';

const bgPresenca = (pct: number) =>
  pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface TurmaResumo {
  id: string; nome: string; church_nome: string;
  total_alunos: number; total_aulas: number; media_presenca: number; ultima_aula: string | null;
}
interface UltimaAula {
  id: string; turma_nome: string; church_nome: string;
  data_aula: string; total_presentes: number; total_visitantes: number; tema: string | null;
}
interface KPIs {
  total_alunos: number; total_turmas: number; total_aulas_trimestre: number;
  media_presenca_geral: number; total_visitantes_trimestre: number; oferta_trimestre: number;
}

// ─── Props dos sub-componentes ────────────────────────────────────────────────

interface DashboardConteudoProps {
  loading: boolean;
  selTri: number; setSelTri: (v: number) => void;
  selAno: number; setSelAno: (v: number) => void;
  kpis: KPIs;
  turmasRes: TurmaResumo[];
  ultimasAulas: UltimaAula[];
  tendencia: { data: string; presentes: number }[];
  barData: { nome: string; presenca: number }[];
  pieData: { name: string; value: number }[];
}

// ─── KpiCard ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode; iconBg: string; label: string;
  value: string | number; sub: string; accent: string;
  valueClass?: string; valueSize?: string;
}
function KpiCard({ icon, iconBg, label, value, sub, accent, valueClass = 'text-[#123b63]', valueSize = 'text-2xl' }: KpiCardProps) {
  return (
    <div className={\`bg-white rounded-2xl border border-slate-100 border-t-4 \${accent} p-4 shadow-sm\`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide leading-tight">{label}</p>
        <div className={\`w-8 h-8 rounded-xl \${iconBg} flex items-center justify-center\`}>{icon}</div>
      </div>
      <p className={\`\${valueSize} font-bold \${valueClass} leading-tight\`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

// ─── DashboardConteudo ────────────────────────────────────────────────────────
// Renderiza\\u00e7\\u00e3o compartilhada entre DashboardGeral e DashboardLocal

function DashboardConteudo({
  loading, selTri, setSelTri, selAno, setSelAno,
  kpis, turmasRes, ultimasAulas, tendencia, barData, pieData,
}: DashboardConteudoProps) {
  return (
    <>
      {/* Seletor trimestre / ano */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Trimestre</label>
          <div className="flex rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            {[1, 2, 3, 4].map(t => (
              <button key={t} onClick={() => setSelTri(t)}
                className={\`px-4 py-2 text-sm font-semibold transition \${selTri === t ? 'bg-[#123b63] text-white' : 'bg-white text-gray-500 hover:bg-slate-50'}\`}>
                {t}\\u00ba
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Ano</label>
          <select value={selAno} onChange={e => setSelAno(Number(e.target.value))} className="border border-slate-200 rounded-xl px-3 py-2 text-sm shadow-sm bg-white">
            {[anoAtual() - 1, anoAtual(), anoAtual() + 1].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="ml-auto self-end pb-1">
          <span className="text-sm font-semibold text-[#123b63]">{TRIM_LABEL[selTri - 1]} / {selAno}</span>
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center text-gray-400 text-sm animate-pulse">Carregando dados...</div>
      ) : (
        <div className="space-y-6">

          {/* ROW 1: 6 KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <KpiCard icon={<Users className="h-4 w-4 text-[#123b63]" />} iconBg="bg-blue-50" label="Alunos ativos" value={kpis.total_alunos} sub="matriculados" accent="border-t-[#123b63]" />
            <KpiCard icon={<BookOpen className="h-4 w-4 text-sky-500" />} iconBg="bg-sky-50" label="Turmas ativas" value={kpis.total_turmas} sub="em funcionamento" accent="border-t-sky-500" valueClass="text-sky-600" />
            <KpiCard icon={<CalendarDays className="h-4 w-4 text-amber-500" />} iconBg="bg-amber-50" label="Aulas no trim." value={kpis.total_aulas_trimestre} sub="realizadas" accent="border-t-amber-500" valueClass="text-amber-600" />
            <KpiCard icon={<UserCheck className="h-4 w-4 text-green-500" />} iconBg="bg-green-50" label="M\\u00e9dia presen\\u00e7a" value={\`\${kpis.media_presenca_geral}%\`} sub={kpis.media_presenca_geral >= 70 ? 'Excelente' : kpis.media_presenca_geral >= 50 ? 'Regular' : 'Aten\\u00e7\\u00e3o'} accent="border-t-green-500" valueClass={corPresenca(kpis.media_presenca_geral)} />
            <KpiCard icon={<TrendingUp className="h-4 w-4 text-purple-500" />} iconBg="bg-purple-50" label="Visitantes" value={kpis.total_visitantes_trimestre} sub="no trimestre" accent="border-t-purple-500" valueClass="text-purple-600" />
            <KpiCard icon={<DollarSign className="h-4 w-4 text-emerald-500" />} iconBg="bg-emerald-50" label="Oferta trimestral" value={fmtBRL(kpis.oferta_trimestre)} sub="arrecadado" accent="border-t-emerald-500" valueClass="text-emerald-600" valueSize="text-lg" />
          </div>

          {/* ROW 2: BarChart (2/3) + Ultimas aulas (1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-[#123b63]">Presen\\u00e7a por Turma</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{TRIM_LABEL[selTri - 1]} {selAno} \\u00b7 m\\u00e9dia de presen\\u00e7a (%)</p>
                </div>
                <Link href="/ebd/historico" className="flex items-center gap-1 text-xs text-blue-600 font-semibold hover:underline">
                  Ver hist\\u00f3rico <ChevronRight size={12} />
                </Link>
              </div>
              {barData.length === 0 ? (
                <div className="h-52 flex flex-col items-center justify-center text-gray-300 gap-2">
                  <BookOpen size={32} className="opacity-30" />
                  <span className="text-sm">Nenhuma turma com aulas no trimestre</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="nome" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tickFormatter={v => \`\${v}%\`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: any) => [\`\${v}%\`, 'Presen\\u00e7a m\\u00e9dia']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <Bar dataKey="presenca" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      {barData.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-[#123b63]">\\u00daltimas Aulas</h3>
                <Link href="/ebd/historico" className="flex items-center gap-1 text-xs text-blue-600 font-semibold hover:underline">
                  Ver tudo <ChevronRight size={12} />
                </Link>
              </div>
              {ultimasAulas.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-300 gap-2">
                  <CalendarDays size={28} className="opacity-30" />
                  <span className="text-sm">Nenhuma aula registrada</span>
                </div>
              ) : (
                <div className="divide-y divide-slate-50 overflow-y-auto" style={{ maxHeight: 256 }}>
                  {ultimasAulas.map(a => (
                    <div key={a.id} className="py-2.5 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-700 truncate">{a.turma_nome}</p>
                        {a.tema && <p className="text-xs text-gray-400 truncate">{a.tema}</p>}
                        <p className="text-xs text-gray-400">{fmtDate(a.data_aula)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 justify-end">
                          <UserCheck className="h-3.5 w-3.5 text-green-500" />
                          <span className="text-sm font-bold text-green-700">{a.total_presentes}</span>
                        </div>
                        {a.total_visitantes > 0 && <p className="text-xs text-purple-500">+{a.total_visitantes}v</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ROW 3: AreaChart tendencia (2/3) + PieChart alunos (1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-[#123b63]">Tend\\u00eancia de Presen\\u00e7as</h3>
                <p className="text-xs text-gray-400 mt-0.5">Total de presentes por domingo registrado no trimestre</p>
              </div>
              {tendencia.length < 2 ? (
                <div className="h-48 flex flex-col items-center justify-center text-gray-300 gap-2">
                  <TrendingUp size={32} className="opacity-30" />
                  <span className="text-sm">Registre mais aulas para ver a tend\\u00eancia</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={tendencia} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gPresenca" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="data" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: any) => [v, 'Presentes']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <Area type="monotone" dataKey="presentes" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gPresenca)" dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-[#123b63]">Alunos por Turma</h3>
                <p className="text-xs text-gray-400 mt-0.5">Distribui\\u00e7\\u00e3o de matr\\u00edculas ativas</p>
              </div>
              {pieData.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-gray-300 gap-2">
                  <Users size={28} className="opacity-30" />
                  <span className="text-sm">Sem alunos matriculados</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={76} paddingAngle={3}>
                      {pieData.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [v, 'alunos']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ROW 4: Ranking de turmas */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#123b63]">Ranking de Turmas</h3>
                <p className="text-xs text-gray-400 mt-0.5">Ordenado por m\\u00e9dia de presen\\u00e7a no {TRIM_LABEL[selTri - 1]}</p>
              </div>
              <Link href="/ebd/turmas" className="flex items-center gap-1 text-xs text-blue-600 font-semibold hover:underline">
                Gerenciar turmas <ChevronRight size={12} />
              </Link>
            </div>
            {turmasRes.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhuma turma com aulas no per\\u00edodo.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {turmasRes.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: CORES[i % CORES.length] }}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{t.nome}</p>
                      <p className="text-xs text-gray-400 truncate">
                        <Building2 className="h-3 w-3 inline mr-0.5" />{t.church_nome} \\u00b7 {t.total_alunos} aluno(s)
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className={\`h-full rounded-full \${bgPresenca(t.media_presenca)}\`} style={{ width: \`\${t.media_presenca}%\` }} />
                        </div>
                        <span className={\`text-xs font-bold \${corPresenca(t.media_presenca)}\`}>{t.media_presenca}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ROW 5: Atalhos rapidos */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Chamada Dominical', icon: '\\u270f\\ufe0f', path: '/ebd/chamada'      },
              { label: 'Trimestres',        icon: '\\ud83d\\udcc5', path: '/ebd/trimestres'   },
              { label: 'Turmas',            icon: '\\ud83c\\udfeb', path: '/ebd/turmas'       },
              { label: 'Hist\\u00f3rico',   icon: '\\ud83d\\udccb', path: '/ebd/historico'    },
              { label: 'Certificados',      icon: '\\ud83c\\udfc6', path: '/ebd/certificados' },
            ].map(item => (
              <Link key={item.path} href={item.path}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition flex items-center gap-3 group">
                <span className="text-2xl">{item.icon}</span>
                <span className="text-sm font-semibold text-gray-700 group-hover:text-[#123b63] transition">{item.label}</span>
                <ChevronRight className="h-4 w-4 text-gray-300 ml-auto group-hover:text-[#123b63] transition" />
              </Link>
            ))}
          </div>

        </div>
      )}
    </>
  );
}

// ─── DashboardGeral ───────────────────────────────────────────────────────────
// Renderizado para usu\\u00e1rios admin \\u2014 vis\\u00e3o de todas as congrega\\u00e7\\u00f5es

function DashboardGeral(props: DashboardConteudoProps) {
  return (
    <>
      <div className="flex items-center gap-2 mb-5 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl w-fit">
        <Globe className="h-4 w-4 text-blue-500" />
        <span className="text-xs font-semibold text-blue-700">Vis\\u00e3o Global \\u2014 todas as congrega\\u00e7\\u00f5es</span>
      </div>
      <DashboardConteudo {...props} />
    </>
  );
}

// ─── DashboardLocal ───────────────────────────────────────────────────────────
// Renderizado para usu\\u00e1rios comuns \\u2014 vis\\u00e3o restrita \\u00e0 congrega\\u00e7\\u00e3o local

function DashboardLocal({ congregacaoNome, ...props }: DashboardConteudoProps & { congregacaoNome: string }) {
  return (
    <>
      <div className="flex items-center gap-2 mb-5 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl w-fit">
        <MapPin className="h-4 w-4 text-emerald-500" />
        <span className="text-xs font-semibold text-emerald-700">
          {congregacaoNome ? \`Congrega\\u00e7\\u00e3o: \${congregacaoNome}\` : 'Vis\\u00e3o Local'}
        </span>
      </div>
      <DashboardConteudo {...props} />
    </>
  );
}

// ─── P\\u00e1gina principal ──────────────────────────────────────────────────────────
// Uma \\u00fanica rota /ebd/dashboard com renderiza\\u00e7\\u00e3o condicional baseada em permiss\\u00e3o.
// Admin v\\u00ea dados globais; usu\\u00e1rio comum v\\u00ea apenas sua congrega\\u00e7\\u00e3o.

export default function EbdDashboardPage() {
  const { user } = useRequireSupabaseAuth();
  const supabase = useMemo(() => createClient(), []);

  // ── Permiss\\u00e3o ──
  // Vari\\u00e1veis expl\\u00edcitas de role (nunca l\\u00f3gica impl\\u00edcita)
  const isAdminRef       = useRef(false);
  const congregacaoIdRef = useRef<string | null>(null);
  const [isAdmin,        setIsAdmin]        = useState(false);
  const [congregacaoNome, setCongregacaoNome] = useState('');

  // ── Estado da p\\u00e1gina ──
  const [ministryId,  setMinistryId]  = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [selTri,      setSelTri]      = useState(trimAtual());
  const [selAno,      setSelAno]      = useState(anoAtual());
  const [kpis, setKpis] = useState<KPIs>({
    total_alunos: 0, total_turmas: 0, total_aulas_trimestre: 0,
    media_presenca_geral: 0, total_visitantes_trimestre: 0, oferta_trimestre: 0,
  });
  const [turmasRes,    setTurmasRes]    = useState<TurmaResumo[]>([]);
  const [ultimasAulas, setUltimasAulas] = useState<UltimaAula[]>([]);

  // ── carregar ──
  // L\\u00ea isAdmin/congregacaoId via refs (evita stale closure sem deps extras).
  // Seguran\\u00e7a: usu\\u00e1rio comum nunca recebe dados de outras congrega\\u00e7\\u00f5es
  // pois os filtros s\\u00e3o aplicados nas queries ao banco.
  const carregar = useCallback(async (mid: string) => {
    const adm      = isAdminRef.current;
    const churchId = congregacaoIdRef.current;
    setLoading(true);

    // 1. Turmas \\u2014 admin: todas; local: apenas da congrega\\u00e7\\u00e3o
    let turmasQuery = supabase
      .from('ebd_turmas')
      .select('id, nome, church_id, congregacoes(nome)')
      .eq('ministry_id', mid)
      .eq('ativo', true);
    if (!adm && churchId) turmasQuery = turmasQuery.eq('church_id', churchId);
    const turmasR  = await turmasQuery;
    const turmas   = turmasR.data ?? [];
    const turmaIds = turmas.map((t: any) => t.id);

    // Caso local sem turmas: retorna estado vazio de forma eficiente
    if (!adm && turmaIds.length === 0) {
      let aQ = supabase.from('ebd_alunos').select('id', { count: 'exact', head: true })
        .eq('ministry_id', mid).eq('ativo', true);
      if (churchId) aQ = aQ.eq('church_id', churchId);
      let oQ = supabase.from('ebd_ofertas').select('valor')
        .eq('ministry_id', mid).eq('trimestre', selTri).eq('ano', selAno);
      if (churchId) oQ = oQ.eq('church_id', churchId);
      const [aR, oR] = await Promise.all([aQ, oQ]);
      const ofertaTotal = (oR.data ?? []).reduce((s: number, o: any) => s + Number(o.valor), 0);
      setKpis({ total_alunos: aR.count ?? 0, total_turmas: 0, total_aulas_trimestre: 0, media_presenca_geral: 0, total_visitantes_trimestre: 0, oferta_trimestre: ofertaTotal });
      setTurmasRes([]);
      setUltimasAulas([]);
      setLoading(false);
      return;
    }

    // 2. Alunos, Aulas e Ofertas em paralelo \\u2014 com filtros de segura\\u00e7a para local
    let alunosQuery = supabase.from('ebd_alunos').select('id', { count: 'exact', head: true })
      .eq('ministry_id', mid).eq('ativo', true);
    if (!adm && churchId) alunosQuery = alunosQuery.eq('church_id', churchId);

    let aulasQuery = supabase
      .from('ebd_aulas')
      .select('id, turma_id, data_aula, tema, total_presentes, total_visitantes, ebd_turmas(nome, church_id, congregacoes(nome))')
      .eq('ministry_id', mid).eq('trimestre', selTri).eq('ano', selAno).eq('status', 'realizada')
      .order('data_aula', { ascending: false });
    if (!adm) aulasQuery = aulasQuery.in('turma_id', turmaIds);

    let ofertasQuery = supabase.from('ebd_ofertas').select('valor')
      .eq('ministry_id', mid).eq('trimestre', selTri).eq('ano', selAno);
    if (!adm && churchId) ofertasQuery = ofertasQuery.eq('church_id', churchId);

    const [alunosR, aulasR, ofertasR] = await Promise.all([alunosQuery, aulasQuery, ofertasQuery]);

    const totalAlunos = alunosR.count ?? 0;
    const aulas       = aulasR.data  ?? [];
    const ofertas     = ofertasR.data ?? [];

    const ofertaTotal = ofertas.reduce((s: number, o: any) => s + Number(o.valor), 0);
    const visitTotal  = aulas.reduce((s: number, a: any) => s + (a.total_visitantes ?? 0), 0);
    let mediaGeral = 0;
    if (aulas.length > 0 && totalAlunos > 0) {
      const somaPresentes = aulas.reduce((s: number, a: any) => s + (a.total_presentes ?? 0), 0);
      mediaGeral = Math.min(Math.round((somaPresentes / aulas.length / Math.max(totalAlunos, 1)) * 100), 100);
    }
    setKpis({
      total_alunos: totalAlunos, total_turmas: turmas.length, total_aulas_trimestre: aulas.length,
      media_presenca_geral: mediaGeral, total_visitantes_trimestre: visitTotal, oferta_trimestre: ofertaTotal,
    });

    const turmaMap = new Map<string, { nome: string; church_nome: string; aulas: number; somaPresentes: number; ultima: string | null }>();
    for (const t of turmas) {
      turmaMap.set(t.id, { nome: t.nome, church_nome: (t as any).congregacoes?.nome ?? '\\u2014', aulas: 0, somaPresentes: 0, ultima: null });
    }
    for (const a of aulas) {
      const entry = turmaMap.get(a.turma_id);
      if (entry) {
        entry.aulas++;
        entry.somaPresentes += a.total_presentes ?? 0;
        if (!entry.ultima || a.data_aula > entry.ultima) entry.ultima = a.data_aula;
      }
    }

    const { data: matsData } = await supabase.from('ebd_matriculas').select('turma_id')
      .eq('ministry_id', mid).is('data_fim', null);
    const matsCount = new Map<string, number>();
    for (const m of matsData ?? []) matsCount.set(m.turma_id, (matsCount.get(m.turma_id) ?? 0) + 1);

    const resumos: TurmaResumo[] = Array.from(turmaMap.entries()).map(([id, t]) => {
      const alunos = matsCount.get(id) ?? 0;
      const base   = t.aulas > 0 && alunos > 0 ? t.aulas * alunos : 1;
      const media  = t.aulas > 0 ? Math.min(Math.round((t.somaPresentes / base) * 100), 100) : 0;
      return { id, nome: t.nome, church_nome: t.church_nome, total_alunos: alunos, total_aulas: t.aulas, media_presenca: media, ultima_aula: t.ultima };
    }).sort((a, b) => b.media_presenca - a.media_presenca);
    setTurmasRes(resumos);

    setUltimasAulas(aulas.slice(0, 12).map((a: any) => ({
      id: a.id, turma_nome: a.ebd_turmas?.nome ?? '\\u2014', church_nome: a.ebd_turmas?.congregacoes?.nome ?? '\\u2014',
      data_aula: a.data_aula, total_presentes: a.total_presentes ?? 0, total_visitantes: a.total_visitantes ?? 0, tema: a.tema,
    })));

    setLoading(false);
  }, [selTri, selAno, supabase]);

  // ── Inicializa\\u00e7\\u00e3o: carrega minist\\u00e9rio + role do usu\\u00e1rio ──
  useEffect(() => {
    if (!user) return;
    (async () => {
      const mid = await resolveMinistryId(supabase);
      if (!mid) return;

      const { data: session } = await supabase.auth.getSession();
      const uid = session?.session?.user?.id;
      if (uid) {
        const { data: mu } = await supabase
          .from('ministry_users')
          .select('role, permissions, congregacao_id, congregacoes(nome)')
          .eq('ministry_id', mid)
          .eq('user_id', uid)
          .maybeSingle();

        const role  = (mu?.role ?? '').toLowerCase();
        const perms: string[] = Array.isArray(mu?.permissions) ? mu.permissions : [];
        // isAdmin expl\\u00edcito: admin, manager ou permiss\\u00e3o ADMINISTRADOR
        const adm = role === 'admin' || role === 'manager' || perms.includes('ADMINISTRADOR');

        isAdminRef.current       = adm;
        congregacaoIdRef.current = mu?.congregacao_id ?? null;
        setIsAdmin(adm);
        setCongregacaoNome((mu as any)?.congregacoes?.nome ?? '');
      }

      setMinistryId(mid);
      carregar(mid);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase]);

  // ── Recarrega ao mudar trimestre / ano ──
  useEffect(() => {
    if (ministryId) carregar(ministryId);
  }, [ministryId, selTri, selAno, carregar]);

  // ── Dados derivados para gr\\u00e1ficos ──
  const barData = turmasRes.map(t => ({
    nome: t.nome.length > 14 ? t.nome.slice(0, 14) + '\\u2026' : t.nome,
    presenca: t.media_presenca,
  }));
  const pieData = turmasRes.filter(t => t.total_alunos > 0).map(t => ({ name: t.nome, value: t.total_alunos }));
  const tendencia = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const a of ultimasAulas) byDate.set(a.data_aula, (byDate.get(a.data_aula) ?? 0) + a.total_presentes);
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, presentes]) => ({ data: fmtDate(data), presentes }));
  }, [ultimasAulas]);

  const conteudoProps: DashboardConteudoProps = {
    loading, selTri, setSelTri, selAno, setSelAno,
    kpis, turmasRes, ultimasAulas, tendencia, barData, pieData,
  };

  return (
    <PageLayout title="EBD \\u2014 Dashboard" description="Vis\\u00e3o da Escola B\\u00edblica Dominical" activeMenu="ebd-dashboard">
      {isAdmin
        ? <DashboardGeral {...conteudoProps} />
        : <DashboardLocal {...conteudoProps} congregacaoNome={congregacaoNome} />
      }
    </PageLayout>
  );
}
`;

const dest = path.join(__dirname, '..', 'src', 'app', 'ebd', 'dashboard', 'page.tsx');
fs.writeFileSync(dest, content, 'utf8');
console.log('Written:', dest);
