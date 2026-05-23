'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import PageLayout from '@/components/PageLayout';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';

// ─── Labels e helpers ────────────────────────────────────────────────────────

const TIPO_LABEL: Record<string, string> = {
  membro: 'Membro',
  congregado: 'Congregado',
  ministro: 'Ministro',
  crianca: 'Criança',
};

const STATUS_MEMBRO_LABEL: Record<string, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  deceased: 'Falecido',
  transferred: 'Transferido',
};

const STATUS_BATISMO_LABEL: Record<string, string> = {
  registrado: 'Registrado',
  batizado: 'Batizado',
  cancelado: 'Cancelado',
};

const STATUS_CARTA_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  autorizado: 'Autorizado',
  rejeitado: 'Rejeitado',
};

const TIPO_CARTA_LABEL: Record<string, string> = {
  mudanca: 'Mudança',
  transito: 'Trânsito',
  desligamento: 'Desligamento',
  recomendacao: 'Recomendação',
};

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function lb(map: Record<string, string>, val?: string | null): string {
  if (!val) return 'Não informado';
  return map[val] ?? val;
}

function fmtDate(d?: string | null): string {
  if (!d) return 'Não informado';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
}

function calcAge(d?: string | null): string {
  if (!d) return '—';
  const birth = new Date(d + 'T00:00:00');
  const now = new Date();
  const age =
    now.getFullYear() -
    birth.getFullYear() -
    (now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
      ? 1
      : 0);
  return String(age);
}

function fmtPhone(phone?: string | null, celular?: string | null): string {
  return phone || celular || 'Não informado';
}

function getLast12Months(): { key: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
    };
  });
}

function exportCSV(
  filename: string,
  rows: Record<string, unknown>[],
  cols: { key: string; label: string }[],
) {
  const header = cols.map(c => `"${c.label}"`).join(',');
  const body = rows.map(r =>
    cols
      .map(c => `"${((r[c.key] ?? '') as string).toString().replace(/"/g, '""')}"`)
      .join(','),
  );
  const csv = '\uFEFF' + [header, ...body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Atoms de UI ─────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex justify-center py-20">
      <div className="w-9 h-9 rounded-full border-4 border-[#123b63] border-t-transparent animate-spin" />
    </div>
  );
}

function Empty({ msg = 'Nenhum registro encontrado.' }: { msg?: string }) {
  return (
    <div className="bg-white rounded-xl border py-16 text-center">
      <p className="text-gray-400 text-sm">{msg}</p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color = 'blue',
}: {
  label: string;
  value: string | number;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple';
}) {
  const clr: Record<string, string> = {
    blue:   'text-blue-700',
    green:  'text-green-600',
    amber:  'text-amber-600',
    red:    'text-red-600',
    purple: 'text-purple-600',
  };
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide leading-tight">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${clr[color]}`}>{value}</p>
    </div>
  );
}

function StatusBadge({
  value,
  map,
  colorMap,
}: {
  value?: string | null;
  map: Record<string, string>;
  colorMap: Record<string, string>;
}) {
  const text = lb(map, value);
  const cls = value ? (colorMap[value] ?? 'bg-gray-100 text-gray-600') : 'bg-gray-100 text-gray-400';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {text}
    </span>
  );
}

const STATUS_MEMBRO_COLORS: Record<string, string> = {
  active:      'bg-green-100 text-green-700',
  inactive:    'bg-gray-100 text-gray-600',
  deceased:    'bg-red-100 text-red-700',
  transferred: 'bg-blue-100 text-blue-700',
};

const STATUS_BATISMO_COLORS: Record<string, string> = {
  batizado:   'bg-green-100 text-green-700',
  registrado: 'bg-amber-100 text-amber-700',
  cancelado:  'bg-red-100 text-red-700',
};

const STATUS_CARTA_COLORS: Record<string, string> = {
  pendente:   'bg-amber-100 text-amber-700',
  autorizado: 'bg-green-100 text-green-700',
  rejeitado:  'bg-red-100 text-red-700',
};

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type TabId = 'crescimento' | 'membros' | 'aniversariantes' | 'cartas' | 'batismos';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'crescimento',     label: 'Crescimento',       icon: '📈' },
  { id: 'membros',         label: 'Ficha Geral',        icon: '👥' },
  { id: 'aniversariantes', label: 'Aniversariantes',   icon: '🎂' },
  { id: 'cartas',          label: 'Pedidos de Cartas', icon: '✉️' },
  { id: 'batismos',        label: 'Batismos',           icon: '✝️' },
];

// ─── Página principal ─────────────────────────────────────────────────────────

export default function RelatoriosSecretariaPage() {
  const { bloqueado } = useRequireModulo('gestao');
  const [tab, setTab] = useState<TabId>('crescimento');

  if (bloqueado) return null;

  return (
    <PageLayout
      title="📋 Central de Relatórios"
      description="Relatórios gerenciais da Secretaria"
      activeMenu="relatorios-secretaria"
      headerExtra={
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition print:hidden"
        >
          🖨️ Imprimir
        </button>
      }
    >
      {/* Abas */}
      <div className="flex gap-2 flex-wrap mb-6 print:hidden">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.id
                ? 'bg-[#123b63] text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'crescimento'     && <RelatorioCrescimento />}
      {tab === 'membros'         && <RelatorioFichaGeral />}
      {tab === 'aniversariantes' && <RelatorioAniversariantes />}
      {tab === 'cartas'          && <RelatorioCartasPendentes />}
      {tab === 'batismos'        && <RelatorioBatismos />}
    </PageLayout>
  );
}

// ─── 1. Crescimento Mensal ────────────────────────────────────────────────────

function RelatorioCrescimento() {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<{ mes: string; total: number }[]>([]);
  const [totalPeriodo, setTotalPeriodo] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    const months = getLast12Months();
    const oldest = months[0].key + '-01';

    supabase
      .from('members')
      .select('member_since')
      .gte('member_since', oldest)
      .then((res: { data: { member_since: string | null }[] | null; error: unknown }) => {
        const grouped: Record<string, number> = {};
        (res.data ?? []).forEach(m => {
          const raw = m.member_since as string | null;
          if (!raw) return;
          const d = new Date(raw);
          const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          grouped[k] = (grouped[k] ?? 0) + 1;
        });
        const result = months.map(m => ({ mes: m.label, total: grouped[m.key] ?? 0 }));
        setChartData(result);
        setTotalPeriodo((res.data ?? []).length);
        setLoading(false);
      });
  }, []);

  if (loading) return <Spinner />;

  const melhorMes = chartData.reduce(
    (acc, cur) => (cur.total > acc.total ? cur : acc),
    { mes: '—', total: 0 },
  );

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <SummaryCard label="Cadastros (12 meses)" value={totalPeriodo} />
        <SummaryCard
          label="Média mensal"
          value={totalPeriodo > 0 ? (totalPeriodo / 12).toFixed(1) : '0'}
          color="green"
        />
        <SummaryCard
          label="Melhor mês"
          value={melhorMes.total > 0 ? `${melhorMes.total} (${melhorMes.mes})` : '—'}
          color="amber"
        />
      </div>

      {chartData.every(d => d.total === 0) ? (
        <Empty msg="Nenhum cadastro nos últimos 12 meses." />
      ) : (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-5">
            Novos cadastros por mês — últimos 12 meses
          </h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: number | string | undefined) => [`${v ?? 0} cadastro(s)`, 'Total']}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="total" fill="#123b63" radius={[4, 4, 0, 0]} name="Cadastros" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 2. Ficha Geral de Membros ────────────────────────────────────────────────

type MembroRow = {
  id: string;
  name: string | null;
  tipo_cadastro: string | null;
  status: string | null;
  cargo_ministerial: string | null;
  data_nascimento: string | null;
  phone: string | null;
  celular: string | null;
  cidade: string | null;
  estado: string | null;
  congregacao_id: string | null;
  congregacoes: { nome: string } | null;
};

const CSV_COLS_MEMBROS = [
  { key: 'nome',        label: 'Nome' },
  { key: 'tipo',        label: 'Tipo' },
  { key: 'status',      label: 'Status' },
  { key: 'cargo',       label: 'Cargo Ministerial' },
  { key: 'nascimento',  label: 'Data de Nascimento' },
  { key: 'telefone',    label: 'Telefone' },
  { key: 'cidade',      label: 'Cidade' },
  { key: 'uf',          label: 'UF' },
  { key: 'congregacao', label: 'Congregação' },
];

function RelatorioFichaGeral() {
  const [loading, setLoading] = useState(true);
  const [membros, setMembros] = useState<MembroRow[]>([]);
  const [congregacoes, setCongregacoes] = useState<{ id: string; nome: string }[]>([]);
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroCong, setFiltroCong] = useState('');

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase
        .from('members')
        .select(
          'id, name, tipo_cadastro, status, cargo_ministerial, data_nascimento, phone, celular, cidade, estado, congregacao_id, congregacoes(nome)',
        )
        .order('name', { ascending: true })
        .limit(1000),
      supabase
        .from('congregacoes')
        .select('id, nome')
        .eq('is_active', true)
        .order('nome'),
    ]).then(([membRes, congRes]) => {
      setMembros((membRes.data as MembroRow[]) ?? []);
      setCongregacoes((congRes.data as { id: string; nome: string }[]) ?? []);
      setLoading(false);
    });
  }, []);

  const filtrados = useMemo(() => {
    const nome = filtroNome.toLowerCase();
    return membros.filter(m => {
      if (nome && !(m.name ?? '').toLowerCase().includes(nome)) return false;
      if (filtroStatus && m.status !== filtroStatus) return false;
      if (filtroTipo && m.tipo_cadastro !== filtroTipo) return false;
      if (filtroCong && m.congregacao_id !== filtroCong) return false;
      return true;
    });
  }, [membros, filtroNome, filtroStatus, filtroTipo, filtroCong]);

  function congNome(m: MembroRow): string {
    if (m.congregacoes?.nome) return m.congregacoes.nome;
    if (m.congregacao_id) return '—';
    return 'Não vinculada';
  }

  function handleCSV() {
    const hoje = new Date().toISOString().slice(0, 10);
    exportCSV(
      `ficha-geral-membros-${hoje}.csv`,
      filtrados.map(m => ({
        nome:        m.name ?? '',
        tipo:        lb(TIPO_LABEL, m.tipo_cadastro),
        status:      lb(STATUS_MEMBRO_LABEL, m.status),
        cargo:       m.cargo_ministerial ?? '',
        nascimento:  fmtDate(m.data_nascimento),
        telefone:    fmtPhone(m.phone, m.celular),
        cidade:      m.cidade ?? '',
        uf:          m.estado ?? '',
        congregacao: congNome(m),
      })),
      CSV_COLS_MEMBROS,
    );
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <SummaryCard label="Total filtrado"  value={filtrados.length} />
        <SummaryCard label="Ativos"          value={filtrados.filter(m => m.status === 'active').length}      color="green" />
        <SummaryCard label="Inativos"        value={filtrados.filter(m => m.status === 'inactive').length}    color="amber" />
        <SummaryCard label="Transferidos"    value={filtrados.filter(m => m.status === 'transferred').length} color="blue" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4 print:hidden">
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={filtroNome}
          onChange={e => setFiltroNome(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[180px] focus:outline-none focus:ring-2 focus:ring-[#123b63]"
        />
        <select
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]"
        >
          <option value="">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
          <option value="deceased">Falecido</option>
          <option value="transferred">Transferido</option>
        </select>
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]"
        >
          <option value="">Todos os tipos</option>
          <option value="membro">Membro</option>
          <option value="congregado">Congregado</option>
          <option value="ministro">Ministro</option>
          <option value="crianca">Criança</option>
        </select>
        {congregacoes.length > 0 && (
          <select
            value={filtroCong}
            onChange={e => setFiltroCong(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]"
          >
            <option value="">Todas as congregações</option>
            {congregacoes.map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        )}
        <button
          onClick={handleCSV}
          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm rounded-lg transition font-medium"
        >
          ⬇️ Exportar CSV
        </button>
      </div>

      {filtrados.length === 0 ? (
        <Empty />
      ) : (
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Cargo</th>
                <th className="px-4 py-3 text-left">Nascimento</th>
                <th className="px-4 py-3 text-left">Telefone</th>
                <th className="px-4 py-3 text-left">Cidade/UF</th>
                <th className="px-4 py-3 text-left">Congregação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map(m => (
                <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                    {m.name ?? 'Não informado'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{lb(TIPO_LABEL, m.tipo_cadastro)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      value={m.status}
                      map={STATUS_MEMBRO_LABEL}
                      colorMap={STATUS_MEMBRO_COLORS}
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-600">{m.cargo_ministerial ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {fmtDate(m.data_nascimento)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {fmtPhone(m.phone, m.celular)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {m.cidade ? `${m.cidade}${m.estado ? `/${m.estado}` : ''}` : 'Não informado'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{congNome(m)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 px-4 py-2 border-t">
            {filtrados.length} de {membros.length} registros
            {membros.length >= 1000 && ' — limite de 1.000 aplicado; use os filtros para refinar'}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── 3. Aniversariantes do Mês ────────────────────────────────────────────────

type AniversarianteRow = {
  id: string;
  name: string | null;
  data_nascimento: string | null;
  phone: string | null;
  celular: string | null;
  congregacoes: { nome: string } | null;
};

function RelatorioAniversariantes() {
  const [loading, setLoading] = useState(true);
  const [todos, setTodos] = useState<AniversarianteRow[]>([]);
  const [mes, setMes] = useState(() => new Date().getMonth() + 1);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('members')
      .select('id, name, data_nascimento, phone, celular, congregacoes(nome)')
      .eq('status', 'active')
      .not('data_nascimento', 'is', null)
      .order('name')
      .limit(2000)
      .then((res: { data: AniversarianteRow[] | null }) => {
        setTodos(res.data ?? []);
        setLoading(false);
      });
  }, []);

  const filtrados = useMemo(() => {
    return todos
      .filter(m => {
        if (!m.data_nascimento) return false;
        return new Date(m.data_nascimento + 'T00:00:00').getMonth() + 1 === mes;
      })
      .sort((a, b) => {
        const da = new Date(a.data_nascimento! + 'T00:00:00').getDate();
        const db = new Date(b.data_nascimento! + 'T00:00:00').getDate();
        return da - db;
      });
  }, [todos, mes]);

  const mesHoje = new Date().getMonth() + 1;
  const diaHoje = new Date().getDate();

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 mb-5">
        <select
          value={mes}
          onChange={e => setMes(Number(e.target.value))}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63] print:hidden"
        >
          {MESES_PT.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>
        <p className="text-sm text-gray-500 print:hidden">
          {filtrados.length} aniversariante(s) em <strong>{MESES_PT[mes - 1]}</strong>
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
        <SummaryCard
          label={`Aniversariantes em ${MESES_PT[mes - 1]}`}
          value={filtrados.length}
          color="purple"
        />
        <SummaryCard
          label="Membros com nascimento cadastrado"
          value={todos.length}
          color="green"
        />
      </div>

      {filtrados.length === 0 ? (
        <Empty msg={`Nenhum aniversariante em ${MESES_PT[mes - 1]}.`} />
      ) : (
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Dia</th>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Idade</th>
                <th className="px-4 py-3 text-left">Telefone</th>
                <th className="px-4 py-3 text-left">Congregação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map(m => {
                const dia = new Date(m.data_nascimento! + 'T00:00:00').getDate();
                const isHoje = mes === mesHoje && dia === diaHoje;
                return (
                  <tr
                    key={m.id}
                    className={`transition-colors ${isHoje ? 'bg-amber-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-4 py-3 font-bold text-[#123b63]">
                      {String(dia).padStart(2, '0')}
                      {isHoje && (
                        <span className="ml-2 text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded">
                          Hoje! 🎂
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{m.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{calcAge(m.data_nascimento)} anos</td>
                    <td className="px-4 py-3 text-gray-600">{fmtPhone(m.phone, m.celular)}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {m.congregacoes?.nome ?? 'Não vinculada'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── 4. Pedidos de Cartas ─────────────────────────────────────────────────────

type CartaPedidoRow = {
  id: string;
  solicitante_nome: string | null;
  membro_nome: string | null;
  tipo_carta: string | null;
  status: string | null;
  created_at: string | null;
  congregacao_id: string | null;
  congregacoes: { nome: string } | null;
};

function RelatorioCartasPendentes() {
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<CartaPedidoRow[]>([]);
  const [filtroStatus, setFiltroStatus] = useState('pendente');

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('carta_pedidos')
      .select(
        'id, solicitante_nome, membro_nome, tipo_carta, status, created_at, congregacao_id, congregacoes(nome)',
      )
      .order('created_at', { ascending: false })
      .limit(500)
      .then((res: { data: CartaPedidoRow[] | null }) => {
        setPedidos(res.data ?? []);
        setLoading(false);
      });
  }, []);

  const filtrados = useMemo(() => {
    if (!filtroStatus) return pedidos;
    return pedidos.filter(p => p.status === filtroStatus);
  }, [pedidos, filtroStatus]);

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
        <SummaryCard label="Pendentes"   value={pedidos.filter(p => p.status === 'pendente').length}   color="amber" />
        <SummaryCard label="Autorizados" value={pedidos.filter(p => p.status === 'autorizado').length} color="green" />
        <SummaryCard label="Rejeitados"  value={pedidos.filter(p => p.status === 'rejeitado').length}  color="red"   />
      </div>

      <div className="flex gap-3 mb-4 print:hidden">
        <select
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]"
        >
          <option value="">Todos os status</option>
          <option value="pendente">Pendentes</option>
          <option value="autorizado">Autorizados</option>
          <option value="rejeitado">Rejeitados</option>
        </select>
        <span className="text-sm text-gray-500 self-center">{filtrados.length} resultado(s)</span>
      </div>

      {filtrados.length === 0 ? (
        <Empty
          msg={filtroStatus === 'pendente' ? 'Nenhum pedido pendente. ✅' : 'Nenhum pedido encontrado.'}
        />
      ) : (
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Membro</th>
                <th className="px-4 py-3 text-left">Tipo de Carta</th>
                <th className="px-4 py-3 text-left">Solicitante</th>
                <th className="px-4 py-3 text-left">Congregação</th>
                <th className="px-4 py-3 text-left">Data do Pedido</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {p.membro_nome ?? 'Não informado'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{lb(TIPO_CARTA_LABEL, p.tipo_carta)}</td>
                  <td className="px-4 py-3 text-gray-600">{p.solicitante_nome ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.congregacoes?.nome ?? (p.congregacao_id ? '—' : 'Não vinculada')}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      value={p.status}
                      map={STATUS_CARTA_LABEL}
                      colorMap={STATUS_CARTA_COLORS}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 px-4 py-2 border-t">
            {filtrados.length} de {pedidos.length} registros
          </p>
        </div>
      )}
    </div>
  );
}

// ─── 5. Batismos por Período ──────────────────────────────────────────────────

type BatismoRow = {
  id: string;
  candidato_nome: string | null;
  data_batismo: string | null;
  local_batismo: string | null;
  pastor_nome: string | null;
  status: string | null;
};

function RelatorioBatismos() {
  const [loading, setLoading] = useState(true);
  const [batismos, setBatismos] = useState<BatismoRow[]>([]);
  const [filtroAno, setFiltroAno] = useState(() => String(new Date().getFullYear()));
  const [filtroStatus, setFiltroStatus] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('batismo_aguas_registros')
      .select('id, candidato_nome, data_batismo, local_batismo, pastor_nome, status')
      .order('data_batismo', { ascending: false })
      .limit(1000)
      .then((res: { data: BatismoRow[] | null }) => {
        setBatismos(res.data ?? []);
        setLoading(false);
      });
  }, []);

  const anos = useMemo(() => {
    const s = new Set<string>();
    batismos.forEach(b => {
      if (b.data_batismo) s.add(b.data_batismo.slice(0, 4));
    });
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [batismos]);

  const filtrados = useMemo(() => {
    return batismos.filter(b => {
      if (filtroAno && (!b.data_batismo || !b.data_batismo.startsWith(filtroAno))) return false;
      if (filtroStatus && b.status !== filtroStatus) return false;
      return true;
    });
  }, [batismos, filtroAno, filtroStatus]);

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
        <SummaryCard label="Total filtrado"            value={filtrados.length} />
        <SummaryCard label="Batizados"                 value={filtrados.filter(b => b.status === 'batizado').length}   color="green" />
        <SummaryCard label="Registrados (a realizar)"  value={filtrados.filter(b => b.status === 'registrado').length} color="amber" />
      </div>

      <div className="flex flex-wrap gap-3 mb-4 print:hidden">
        <select
          value={filtroAno}
          onChange={e => setFiltroAno(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]"
        >
          <option value="">Todos os anos</option>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]"
        >
          <option value="">Todos os status</option>
          <option value="registrado">Registrado</option>
          <option value="batizado">Batizado</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <span className="text-sm text-gray-500 self-center">{filtrados.length} resultado(s)</span>
      </div>

      {filtrados.length === 0 ? (
        <Empty msg="Nenhum batismo encontrado para os filtros aplicados." />
      ) : (
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Candidato</th>
                <th className="px-4 py-3 text-left">Data do Batismo</th>
                <th className="px-4 py-3 text-left">Local</th>
                <th className="px-4 py-3 text-left">Pastor</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map(b => (
                <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {b.candidato_nome ?? 'Não informado'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {fmtDate(b.data_batismo)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{b.local_batismo ?? 'Não informado'}</td>
                  <td className="px-4 py-3 text-gray-600">{b.pastor_nome ?? 'Não informado'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      value={b.status}
                      map={STATUS_BATISMO_LABEL}
                      colorMap={STATUS_BATISMO_COLORS}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 px-4 py-2 border-t">
            {filtrados.length} de {batismos.length} registros
          </p>
        </div>
      )}
    </div>
  );
}
