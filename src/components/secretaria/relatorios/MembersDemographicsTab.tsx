'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  PieChart as PieChartIcon,
  AlertTriangle,
  Search,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import {
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import type {
  DemographicsSummary,
  IncompleteProfileItem,
} from '@/services/secretary-reports-service';
import ReportPrintHeader from './ReportPrintHeader';

interface MembersDemographicsTabProps {
  initialDemographics?: DemographicsSummary | null;
  congregacaoId?: string | null;
  congregacaoNome?: string | null;
}

type SubSectionId = 'relacao' | 'demografia' | 'auditoria';

const SEXO_COLORS = ['#3b82f6', '#ec4899', '#9ca3af'];
const FAIXA_COLORS = ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#6b7280'];

const ESTADO_CIVIL_LABELS: Record<string, string> = {
  solteiro: 'Solteiro(a)',
  casado: 'Casado(a)',
  divorciado: 'Divorciado(a)',
  viuvo: 'Viúvo(a)',
  uniao_estavel: 'União Estável',
  separado: 'Separado(a)',
  nao_informado: 'Não Informado',
};

const TIPO_CADASTRO_LABELS: Record<string, string> = {
  membro: 'Membro',
  congregado: 'Congregado',
  crianca: 'Criança',
  ministro: 'Ministro / Oficial',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  transferred: 'Transferido',
  deceased: 'Falecido',
};

export default function MembersDemographicsTab({
  initialDemographics,
  congregacaoId,
  congregacaoNome,
}: MembersDemographicsTabProps) {
  const [activeSection, setActiveSection] = useState<SubSectionId>('relacao');

  // ─── ESTADO: RELAÇÃO GERAL ────────────────────────────────────────────────
  const [membersData, setMembersData] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersPage, setMembersPage] = useState(1);
  const [membersLimit, setMembersLimit] = useState(25);
  const [membersTotal, setMembersTotal] = useState(0);
  const [membersTotalPages, setMembersTotalPages] = useState(1);

  // Filtros da Relação Geral
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [sexoFilter, setSexoFilter] = useState('todos');
  const [estadoCivilFilter, setEstadoCivilFilter] = useState('todos');
  const [faixaEtariaFilter, setFaixaEtariaFilter] = useState('todos');

  // ─── ESTADO: AUDITORIA DE CADASTROS ───────────────────────────────────────
  const [auditData, setAuditData] = useState<IncompleteProfileItem[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditLimit] = useState(25);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [pendenciaFilter, setPendenciaFilter] = useState<'qualquer' | 'cpf' | 'data_nascimento' | 'telefone' | 'endereco' | 'foto'>('qualquer');

  // ─── BUSCA SERVER-SIDE: RELAÇÃO GERAL ─────────────────────────────────────
  const fetchMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const url = new URL('/api/v1/secretaria/relatorios/members', window.location.origin);
      if (search.trim()) url.searchParams.set('search', search.trim());
      if (statusFilter !== 'todos') url.searchParams.set('status', statusFilter);
      if (tipoFilter !== 'todos') url.searchParams.set('tipo_cadastro', tipoFilter);
      if (congregacaoId && congregacaoId !== 'todas') url.searchParams.set('congregacao_id', congregacaoId);
      if (sexoFilter !== 'todos') url.searchParams.set('sexo', sexoFilter);
      if (estadoCivilFilter !== 'todos') url.searchParams.set('estado_civil', estadoCivilFilter);
      if (faixaEtariaFilter !== 'todos') url.searchParams.set('faixa_etaria', faixaEtariaFilter);
      url.searchParams.set('page', String(membersPage));
      url.searchParams.set('limit', String(membersLimit));

      const res = await fetch(url.toString(), { headers: { 'Cache-Control': 'no-cache' } });
      const json = await res.json();
      if (json.success) {
        setMembersData(json.data || []);
        setMembersTotal(json.total || 0);
        setMembersTotalPages(json.totalPages || 1);
      }
    } catch (err) {
      console.error('Erro ao buscar membros na Central de Relatórios:', err);
    } finally {
      setMembersLoading(false);
    }
  }, [
    search,
    statusFilter,
    tipoFilter,
    congregacaoId,
    sexoFilter,
    estadoCivilFilter,
    faixaEtariaFilter,
    membersPage,
    membersLimit,
  ]);

  useEffect(() => {
    if (activeSection === 'relacao') {
      fetchMembers();
    }
  }, [fetchMembers, activeSection]);

  // ─── BUSCA SERVER-SIDE: AUDITORIA DE CADASTROS ────────────────────────────
  const fetchAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const url = new URL('/api/v1/secretaria/relatorios/incomplete-profiles', window.location.origin);
      if (congregacaoId && congregacaoId !== 'todas') url.searchParams.set('congregacao_id', congregacaoId);
      if (pendenciaFilter !== 'qualquer') url.searchParams.set('pendencia', pendenciaFilter);
      url.searchParams.set('page', String(auditPage));
      url.searchParams.set('limit', String(auditLimit));

      const res = await fetch(url.toString(), { headers: { 'Cache-Control': 'no-cache' } });
      const json = await res.json();
      if (json.success) {
        setAuditData(json.data || []);
        setAuditTotal(json.total || 0);
        setAuditTotalPages(json.totalPages || 1);
      }
    } catch (err) {
      console.error('Erro ao buscar auditoria de cadastros:', err);
    } finally {
      setAuditLoading(false);
    }
  }, [congregacaoId, pendenciaFilter, auditPage, auditLimit]);

  useEffect(() => {
    if (activeSection === 'auditoria') {
      fetchAudit();
    }
  }, [fetchAudit, activeSection]);

  // ─── EXPORTAÇÃO CSV SERVER-SIDE COM BOM UTF-8 ─────────────────────────────
  const handleExportCSV = async () => {
    try {
      const url = new URL('/api/v1/secretaria/relatorios/members', window.location.origin);
      if (search.trim()) url.searchParams.set('search', search.trim());
      if (statusFilter !== 'todos') url.searchParams.set('status', statusFilter);
      if (tipoFilter !== 'todos') url.searchParams.set('tipo_cadastro', tipoFilter);
      if (congregacaoId && congregacaoId !== 'todas') url.searchParams.set('congregacao_id', congregacaoId);
      if (sexoFilter !== 'todos') url.searchParams.set('sexo', sexoFilter);
      if (estadoCivilFilter !== 'todos') url.searchParams.set('estado_civil', estadoCivilFilter);
      if (faixaEtariaFilter !== 'todos') url.searchParams.set('faixa_etaria', faixaEtariaFilter);
      url.searchParams.set('export', 'true');

      const res = await fetch(url.toString());
      const json = await res.json();
      if (!json.success || !json.data) return;

      const headers = [
        'Nome',
        'Tipo Cadastro',
        'Status',
        'Congregação',
        'Cargo',
        'Sexo',
        'Estado Civil',
        'Data Nascimento',
        'Idade',
        'CPF',
        'Telefone',
        'Celular/WhatsApp',
        'Cidade/UF',
      ];

      const rows = json.data.map((m: any) => [
        `"${(m.name || '').replace(/"/g, '""')}"`,
        `"${TIPO_CADASTRO_LABELS[m.tipo_cadastro] || m.tipo_cadastro || ''}"`,
        `"${STATUS_LABELS[m.status] || m.status || ''}"`,
        `"${(m.congregacao_nome || '').replace(/"/g, '""')}"`,
        `"${(m.cargo_ministerial || '').replace(/"/g, '""')}"`,
        `"${m.sexo || ''}"`,
        `"${ESTADO_CIVIL_LABELS[m.estado_civil] || m.estado_civil || ''}"`,
        `"${m.data_nascimento || ''}"`,
        `"${m.idade !== null && m.idade !== undefined ? m.idade : ''}"`,
        `"${m.cpf || ''}"`,
        `"${m.phone || ''}"`,
        `"${m.whatsapp || m.celular || ''}"`,
        `"${m.cidade ? `${m.cidade}/${m.estado || ''}` : ''}"`,
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = `relatorio-membros-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(dlUrl);
    } catch (err) {
      console.error('Erro ao exportar CSV:', err);
    }
  };

  // ─── DADOS GRÁFICOS PARA O PAINEL DEMOGRÁFICO ─────────────────────────────
  const demo = initialDemographics;
  const sexoData = demo
    ? [
        { name: 'Masculino', value: demo.porSexo.masculino },
        { name: 'Feminino', value: demo.porSexo.feminino },
        { name: 'Não informado', value: demo.porSexo.naoInformado },
      ].filter((d) => d.value > 0)
    : [];

  const estadoCivilData = demo
    ? Object.entries(demo.porEstadoCivil).map(([key, val]) => ({
        name: ESTADO_CIVIL_LABELS[key] || key,
        value: val,
      }))
    : [];

  const tipoCadastroData = demo
    ? Object.entries(demo.porTipoCadastro).map(([key, val]) => ({
        name: TIPO_CADASTRO_LABELS[key] || key,
        value: val,
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* ─── CABEÇALHO OFICIAL DE IMPRESSÃO A4 (hidden em tela, visível em print) ─── */}
      <ReportPrintHeader
        title={
          activeSection === 'auditoria'
            ? 'Auditoria de Integridade e Qualidade Cadastral'
            : activeSection === 'demografia'
            ? 'Relatório de Perfil Demográfico da Membresia'
            : 'Relação Geral de Membros e Congregados'
        }
        periodoOuData={`Posição em ${new Date().toLocaleDateString('pt-BR')}`}
        congregacaoNome={congregacaoNome}
      />

      {/* ─── SUBNAVEGAÇÃO INTERNA DA ABA (PRINT:HIDDEN) ──────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-2 shadow-sm flex items-center justify-between flex-wrap gap-2 print:hidden">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveSection('relacao')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeSection === 'relacao'
                ? 'bg-[#123b63] text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Users className="w-4 h-4" />
            Relação Geral
          </button>

          <button
            onClick={() => setActiveSection('demografia')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeSection === 'demografia'
                ? 'bg-[#123b63] text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <PieChartIcon className="w-4 h-4" />
            Perfil Demográfico
          </button>

          <button
            onClick={() => setActiveSection('auditoria')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeSection === 'auditoria'
                ? 'bg-[#123b63] text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Qualidade Cadastral
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeSection === 'relacao' && (
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg transition"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar CSV
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir A4
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* SEÇÃO A: RELAÇÃO GERAL DE MEMBROS (PAGINADA SERVER-SIDE)                */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'relacao' && (
        <div className="space-y-4">
          {/* BARRA DE FILTROS SERVER-SIDE */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm print:hidden space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              {/* Busca Textual */}
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Nome, CPF ou matrícula..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setMembersPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#123b63] bg-gray-50/50"
                />
              </div>

              {/* Status */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setMembersPage(1);
                }}
                className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-gray-50/50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#123b63]"
              >
                <option value="todos">Todos os Status</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
                <option value="transferred">Transferidos</option>
                <option value="deceased">Falecidos</option>
              </select>

              {/* Tipo de Cadastro */}
              <select
                value={tipoFilter}
                onChange={(e) => {
                  setTipoFilter(e.target.value);
                  setMembersPage(1);
                }}
                className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-gray-50/50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#123b63]"
              >
                <option value="todos">Todos os Tipos</option>
                <option value="membro">Membro</option>
                <option value="congregado">Congregado</option>
                <option value="crianca">Criança</option>
                <option value="ministro">Ministro / Liderança</option>
              </select>

              {/* Faixa Etária */}
              <select
                value={faixaEtariaFilter}
                onChange={(e) => {
                  setFaixaEtariaFilter(e.target.value);
                  setMembersPage(1);
                }}
                className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-gray-50/50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#123b63]"
              >
                <option value="todos">Todas as Idades</option>
                <option value="0-11">Crianças (0 a 11)</option>
                <option value="12-17">Adolescentes (12 a 17)</option>
                <option value="18-29">Jovens (18 a 29)</option>
                <option value="30-59">Adultos (30 a 59)</option>
                <option value="60+">Idosos (60+)</option>
              </select>
            </div>

            {/* Linha 2 de Filtros: Sexo e Estado Civil */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={sexoFilter}
                  onChange={(e) => {
                    setSexoFilter(e.target.value);
                    setMembersPage(1);
                  }}
                  className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 text-gray-700 focus:outline-none"
                >
                  <option value="todos">Sexo: Todos</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>

                <select
                  value={estadoCivilFilter}
                  onChange={(e) => {
                    setEstadoCivilFilter(e.target.value);
                    setMembersPage(1);
                  }}
                  className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 text-gray-700 focus:outline-none"
                >
                  <option value="todos">Estado Civil: Todos</option>
                  <option value="solteiro">Solteiro(a)</option>
                  <option value="casado">Casado(a)</option>
                  <option value="divorciado">Divorciado(a)</option>
                  <option value="viuvo">Viúvo(a)</option>
                </select>

                {(search || statusFilter !== 'todos' || tipoFilter !== 'todos' || sexoFilter !== 'todos' || estadoCivilFilter !== 'todos' || faixaEtariaFilter !== 'todos') && (
                  <button
                    onClick={() => {
                      setSearch('');
                      setStatusFilter('todos');
                      setTipoFilter('todos');
                      setSexoFilter('todos');
                      setEstadoCivilFilter('todos');
                      setFaixaEtariaFilter('todos');
                      setMembersPage(1);
                    }}
                    className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 font-medium px-2 py-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Limpar Filtros
                  </button>
                )}
              </div>

              {/* Seletor de limite por página */}
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Exibir por página:</span>
                <select
                  value={membersLimit}
                  onChange={(e) => {
                    setMembersLimit(Number(e.target.value));
                    setMembersPage(1);
                  }}
                  className="border border-gray-200 rounded-lg px-2 py-1 bg-gray-50 text-gray-700 font-semibold"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>

          {/* TABELA DE MEMBROS */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden print:border-none print:shadow-none print:rounded-none">
            {membersLoading ? (
              <div className="py-16 text-center text-gray-400">
                <div className="w-8 h-8 rounded-full border-3 border-[#123b63] border-t-transparent animate-spin mx-auto mb-2" />
                <p className="text-xs">Consultando base de membros...</p>
              </div>
            ) : membersData.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <Users className="w-10 h-10 mx-auto text-gray-300 mb-2 stroke-1" />
                <p className="text-sm font-medium text-gray-500">
                  Nenhum membro encontrado com os filtros aplicados.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase tracking-wider font-semibold print:bg-gray-100 print:text-black">
                      <th className="py-3 px-4">Nome do Membro</th>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Congregação</th>
                      <th className="py-3 px-4">Idade</th>
                      <th className="py-3 px-4">Contato</th>
                      <th className="py-3 px-4">Cargo Ministerial</th>
                      <th className="py-3 px-4 text-right print:hidden">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {membersData.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50/80 transition-colors print:break-inside-avoid">
                        <td className="py-3 px-4 font-semibold text-gray-900 whitespace-nowrap">
                          {m.name}
                        </td>
                        <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                          {TIPO_CADASTRO_LABELS[m.tipo_cadastro] || m.tipo_cadastro || 'Membro'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              m.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800'
                                : m.status === 'inactive'
                                ? 'bg-gray-100 text-gray-700'
                                : m.status === 'transferred'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {STATUS_LABELS[m.status] || m.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {m.congregacao_nome || 'Sede / Principal'}
                        </td>
                        <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                          {m.idade !== null && m.idade !== undefined ? `${m.idade} anos` : '—'}
                        </td>
                        <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                          {m.whatsapp || m.celular || m.phone || <span className="text-gray-400 italic">Sem contato</span>}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {m.cargo_ministerial || '—'}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap print:hidden">
                          <Link
                            href="/secretaria/membros"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#123b63] hover:underline"
                            title="Abrir no módulo de Membros"
                          >
                            Ficha
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* CONTROLES DE PAGINAÇÃO SERVER-SIDE */}
            <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
              <p className="text-xs text-gray-500">
                Exibindo <span className="font-semibold text-gray-800">{membersData.length}</span> de{' '}
                <span className="font-semibold text-gray-800">{membersTotal}</span> registros cadastrados
              </p>

              <div className="flex items-center gap-2 self-center sm:self-auto">
                <button
                  onClick={() => setMembersPage((p) => Math.max(1, p - 1))}
                  disabled={membersPage <= 1 || membersLoading}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  title="Página anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="text-xs font-semibold text-gray-700 px-2">
                  Página {membersPage} de {membersTotalPages}
                </span>

                <button
                  onClick={() => setMembersPage((p) => Math.min(membersTotalPages, p + 1))}
                  disabled={membersPage >= membersTotalPages || membersLoading}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  title="Próxima página"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* SEÇÃO B: PERFIL DEMOGRÁFICO DA MEMBRESIA                                 */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'demografia' && (
        <div className="space-y-6">
          {/* CARDS RESUMO DEMOGRÁFICO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Total Analisado</span>
              <p className="text-3xl font-extrabold text-[#123b63] mt-2">{demo?.totalGeral || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Membros e congregados ativos</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Predominância Sexual</span>
              <p className="text-xl font-bold text-gray-800 mt-2">
                {demo && demo.porSexo.feminino >= demo.porSexo.masculino
                  ? `Feminino (${demo.porSexo.feminino})`
                  : `Masculino (${demo?.porSexo.masculino || 0})`}
              </p>
              <p className="text-xs text-gray-500 mt-1">Maior concentração de gênero</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Estado Civil Líder</span>
              <p className="text-xl font-bold text-gray-800 mt-2">
                {estadoCivilData.length > 0
                  ? estadoCivilData.sort((a, b) => b.value - a.value)[0].name
                  : '—'}
              </p>
              <p className="text-xs text-gray-500 mt-1">Perfil matrimonial mais frequente</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Função Ministerial</span>
              <p className="text-xl font-bold text-purple-700 mt-2">
                {demo ? Object.values(demo.porCargoMinisterial).reduce((a, b) => a + b, 0) : 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">Membros com cargos registrados</p>
            </div>
          </div>

          {/* GRÁFICOS DEMOGRÁFICOS OBJETIVOS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* DISTRIBUIÇÃO POR FAIXA ETÁRIA */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 mb-1">
                Pirâmide Etária da Membresia
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                Distribuição quantitativa e percentual por ciclo de vida
              </p>

              <div className="space-y-3">
                {demo?.porFaixaEtaria.map((f, i) => (
                  <div key={f.faixa} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-700">{f.label}</span>
                      <span className="text-gray-500 font-medium">
                        {f.total} ({f.percentual}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-2.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, f.percentual)}%`,
                          backgroundColor: FAIXA_COLORS[i % FAIXA_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* DISTRIBUIÇÃO POR SEXO & ESTADO CIVIL */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">Distribuição por Sexo</h3>
                <p className="text-xs text-gray-500 mb-4">Divisão proporcional entre homens e mulheres</p>
                <div style={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sexoData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {sexoData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={SEXO_COLORS[index % SEXO_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Distribuição por Estado Civil</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {estadoCivilData.map((ec) => (
                    <div key={ec.name} className="p-2.5 rounded-xl border border-gray-100 bg-gray-50 text-center">
                      <p className="text-[11px] text-gray-500 font-medium">{ec.name}</p>
                      <p className="text-base font-bold text-gray-900 mt-0.5">{ec.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Distribuição por Tipo de Cadastro</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {tipoCadastroData.map((tc) => (
                    <div key={tc.name} className="p-2.5 rounded-xl border border-gray-100 bg-gray-50 text-center">
                      <p className="text-[11px] text-gray-500 font-medium">{tc.name}</p>
                      <p className="text-base font-bold text-[#123b63] mt-0.5">{tc.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* SEÇÃO C: AUDITORIA DE QUALIDADE CADASTRAL (PAGINADA SERVER-SIDE)        */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'auditoria' && (
        <div className="space-y-4">
          {/* FILTROS RÁPIDOS DE PENDÊNCIAS */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm print:hidden space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Painel de Auditoria e Saneamento de Cadastros
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Localize cadastros incompletos para solicitar documentos ou atualizar fichas na Secretaria.
                </p>
              </div>

              <span className="text-xs font-semibold px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full self-start sm:self-auto">
                {auditTotal} cadastro(s) com pendências
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-100">
              <button
                onClick={() => {
                  setPendenciaFilter('qualquer');
                  setAuditPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  pendenciaFilter === 'qualquer'
                    ? 'bg-[#123b63] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Todas as Pendências
              </button>

              <button
                onClick={() => {
                  setPendenciaFilter('cpf');
                  setAuditPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  pendenciaFilter === 'cpf'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Sem CPF
              </button>

              <button
                onClick={() => {
                  setPendenciaFilter('data_nascimento');
                  setAuditPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  pendenciaFilter === 'data_nascimento'
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Sem Nascimento
              </button>

              <button
                onClick={() => {
                  setPendenciaFilter('telefone');
                  setAuditPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  pendenciaFilter === 'telefone'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Sem Contato
              </button>

              <button
                onClick={() => {
                  setPendenciaFilter('endereco');
                  setAuditPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  pendenciaFilter === 'endereco'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Sem Endereço
              </button>

              <button
                onClick={() => {
                  setPendenciaFilter('foto');
                  setAuditPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  pendenciaFilter === 'foto'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Sem Foto
              </button>
            </div>
          </div>

          {/* LISTAGEM DE AUDITORIA */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden print:border-none print:shadow-none print:rounded-none">
            {auditLoading ? (
              <div className="py-16 text-center text-gray-400">
                <div className="w-8 h-8 rounded-full border-3 border-[#123b63] border-t-transparent animate-spin mx-auto mb-2" />
                <p className="text-xs">Auditando qualidade dos cadastros...</p>
              </div>
            ) : auditData.length === 0 ? (
              <div className="py-16 text-center text-gray-500">
                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2 stroke-1" />
                <p className="text-sm font-bold text-gray-800">
                  Excelente! Nenhum cadastro com as pendências selecionadas.
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  A integridade das fichas dos membros está em dia.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase tracking-wider font-semibold print:bg-gray-100 print:text-black">
                      <th className="py-3 px-4">Nome do Membro</th>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4">Congregação</th>
                      <th className="py-3 px-4">Campos com Pendência</th>
                      <th className="py-3 px-4 text-right print:hidden">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {auditData.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/80 transition-colors print:break-inside-avoid">
                        <td className="py-3 px-4 font-semibold text-gray-900">
                          {item.name}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {TIPO_CADASTRO_LABELS[item.tipo_cadastro || ''] || item.tipo_cadastro || 'Membro'}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {item.congregacao_nome || 'Sede / Principal'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {item.pendencias.map((p) => (
                              <span
                                key={p}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  p === 'cpf'
                                    ? 'bg-red-100 text-red-800'
                                    : p === 'data_nascimento'
                                    ? 'bg-orange-100 text-orange-800'
                                    : p === 'telefone'
                                    ? 'bg-amber-100 text-amber-800'
                                    : p === 'endereco'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-purple-100 text-purple-800'
                                }`}
                              >
                                {p === 'data_nascimento' ? 'Nascimento' : p}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap print:hidden">
                          <Link
                            href="/secretaria/membros"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#123b63] hover:underline"
                            title="Atualizar cadastro do membro"
                          >
                            Editar
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* CONTROLES DE PAGINAÇÃO DA AUDITORIA */}
            <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
              <p className="text-xs text-gray-500">
                Página <span className="font-semibold text-gray-800">{auditPage}</span> de{' '}
                <span className="font-semibold text-gray-800">{auditTotalPages}</span> ({auditTotal} pendências)
              </p>

              <div className="flex items-center gap-2 self-center sm:self-auto">
                <button
                  onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                  disabled={auditPage <= 1 || auditLoading}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setAuditPage((p) => Math.min(auditTotalPages, p + 1))}
                  disabled={auditPage >= auditTotalPages || auditLoading}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
