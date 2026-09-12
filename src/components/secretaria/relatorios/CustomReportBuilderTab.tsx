'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  SlidersHorizontal,
  Search,
  Filter,
  Columns,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { authenticatedFetch } from '@/lib/api-client';
import ReportPrintHeader from './ReportPrintHeader';

interface CustomReportBuilderTabProps {
  congregacaoId?: string | null;
  congregacaoNome?: string | null;
}

// ─── DEFINIÇÃO DE COLUNAS DISPONÍVEIS ──────────────────────────────────────────

export interface ColumnDefinition {
  id: string;
  label: string;
  group: 'identificacao' | 'contato' | 'estrutura' | 'perfil' | 'eclesiastico' | 'endereco';
  defaultSelected: boolean;
  printWidth?: string;
}

export const ALL_COLUMNS: ColumnDefinition[] = [
  // Identificação
  { id: 'name', label: 'Nome Completo', group: 'identificacao', defaultSelected: true },
  { id: 'matricula', label: 'Matrícula', group: 'identificacao', defaultSelected: false },
  { id: 'cpf', label: 'CPF', group: 'identificacao', defaultSelected: false },
  { id: 'rg', label: 'RG', group: 'identificacao', defaultSelected: false },
  { id: 'tipo_cadastro', label: 'Tipo de Cadastro', group: 'identificacao', defaultSelected: true },
  { id: 'status', label: 'Status', group: 'identificacao', defaultSelected: true },
  { id: 'member_since', label: 'Membro Desde', group: 'identificacao', defaultSelected: false },

  // Contato
  { id: 'phone', label: 'Telefone', group: 'contato', defaultSelected: false },
  { id: 'celular', label: 'Celular', group: 'contato', defaultSelected: true },
  { id: 'whatsapp', label: 'WhatsApp', group: 'contato', defaultSelected: false },
  { id: 'email', label: 'E-mail', group: 'contato', defaultSelected: false },

  // Estrutura
  { id: 'congregacao_nome', label: 'Congregação', group: 'estrutura', defaultSelected: true },
  { id: 'cargo_ministerial', label: 'Cargo Ministerial', group: 'estrutura', defaultSelected: true },
  { id: 'qual_funcao', label: 'Função na Igreja', group: 'estrutura', defaultSelected: false },
  { id: 'setor_departamento', label: 'Departamento / Setor', group: 'estrutura', defaultSelected: false },

  // Perfil
  { id: 'sexo', label: 'Sexo', group: 'perfil', defaultSelected: false },
  { id: 'data_nascimento', label: 'Data Nasc.', group: 'perfil', defaultSelected: false },
  { id: 'idade', label: 'Idade', group: 'perfil', defaultSelected: true },
  { id: 'estado_civil', label: 'Estado Civil', group: 'perfil', defaultSelected: false },

  // Eclesiástico
  { id: 'data_batismo_aguas', label: 'Batismo nas Águas', group: 'eclesiastico', defaultSelected: false },
  { id: 'data_batismo_espirito_santo', label: 'Batismo Espírito Santo', group: 'eclesiastico', defaultSelected: false },
  { id: 'curso_teologico', label: 'Formação Teológica', group: 'eclesiastico', defaultSelected: false },
  { id: 'instituicao_teologica', label: 'Inst. Teológica', group: 'eclesiastico', defaultSelected: false },
  { id: 'procedencia', label: 'Procedência', group: 'eclesiastico', defaultSelected: false },

  // Endereço
  { id: 'cidade', label: 'Cidade', group: 'endereco', defaultSelected: false },
  { id: 'estado', label: 'UF', group: 'endereco', defaultSelected: false },
  { id: 'bairro', label: 'Bairro', group: 'endereco', defaultSelected: false },
  { id: 'logradouro', label: 'Logradouro', group: 'endereco', defaultSelected: false },
  { id: 'numero', label: 'Número', group: 'endereco', defaultSelected: false },
  { id: 'cep', label: 'CEP', group: 'endereco', defaultSelected: false },
];

const COLUMN_GROUPS = [
  { id: 'identificacao', label: 'Identificação' },
  { id: 'contato', label: 'Contato' },
  { id: 'estrutura', label: 'Estrutura & Liderança' },
  { id: 'perfil', label: 'Perfil & Dados Pessoais' },
  { id: 'eclesiastico', label: 'Dados Eclesiásticos' },
  { id: 'endereco', label: 'Endereço' },
];

// ─── MODELOS RÁPIDOS DE RELATÓRIO (PRESETS) ───────────────────────────────────

interface ReportPreset {
  id: string;
  name: string;
  description: string;
  filters: {
    search?: string;
    status?: string;
    tipo_cadastro?: string;
    sexo?: string;
    estado_civil?: string;
    cargo_ministerial?: string;
    tem_funcao_igreja?: string;
    faixa_etaria?: string;
    batizado_aguas?: string;
    batizado_espirito_santo?: string;
    tem_curso_teologico?: string;
    procedencia?: string;
    qualidade_cadastral?: string;
  };
  selectedColumns: string[];
}

const REPORT_PRESETS: ReportPreset[] = [
  {
    id: 'relacao_geral',
    name: 'Relação Geral de Membros',
    description: 'Listagem completa de todos os membros cadastrados na congregação.',
    filters: {
      status: 'todos',
      tipo_cadastro: 'todos',
      faixa_etaria: 'todos',
    },
    selectedColumns: ['name', 'tipo_cadastro', 'status', 'congregacao_nome', 'celular', 'cargo_ministerial', 'idade'],
  },
  {
    id: 'membros_ativos',
    name: 'Membros Ativos & Em Comunhão',
    description: 'Relação de membros com status ATIVO para chamadas e contatos.',
    filters: {
      status: 'active',
      tipo_cadastro: 'membro',
      faixa_etaria: 'todos',
    },
    selectedColumns: ['name', 'matricula', 'status', 'celular', 'congregacao_nome', 'cargo_ministerial'],
  },
  {
    id: 'jovens',
    name: 'Jovens da Igreja (18 a 29 anos)',
    description: 'Mapeamento demográfico de juventude para eventos, discipulado e liderança.',
    filters: {
      status: 'active',
      faixa_etaria: '18-29',
    },
    selectedColumns: ['name', 'idade', 'data_nascimento', 'sexo', 'celular', 'congregacao_nome'],
  },
  {
    id: 'lideranca',
    name: 'Corpo Ministerial & Liderança',
    description: 'Oficiais com cargo ministerial ou função ativa nos departamentos.',
    filters: {
      status: 'active',
      tem_funcao_igreja: 'true',
    },
    selectedColumns: ['name', 'cargo_ministerial', 'qual_funcao', 'setor_departamento', 'celular', 'email', 'congregacao_nome'],
  },
  {
    id: 'cadastros_pendencias',
    name: 'Auditoria de Cadastros Incompletos',
    description: 'Pessoas com dados essenciais faltantes (CPF, Telefone, Endereço, Foto).',
    filters: {
      status: 'active',
      qualidade_cadastral: 'pendencias',
    },
    selectedColumns: ['name', 'matricula', 'tipo_cadastro', 'cpf', 'celular', 'logradouro', 'congregacao_nome'],
  },
  {
    id: 'batismo_aguas',
    name: 'Relação de Batizados nas Águas',
    description: 'Membros que já passaram pelo ato eclesiástico do batismo nas águas.',
    filters: {
      status: 'active',
      batizado_aguas: 'true',
    },
    selectedColumns: ['name', 'tipo_cadastro', 'data_batismo_aguas', 'congregacao_nome', 'celular'],
  },
];

export default function CustomReportBuilderTab({
  congregacaoId,
  congregacaoNome,
}: CustomReportBuilderTabProps) {
  // ─── ESTADO: PRESET SELECIONADO & TÍTULO DO RELATÓRIO ────────────────────────
  const [activePresetId, setActivePresetId] = useState<string>('relacao_geral');
  const [reportTitle, setReportTitle] = useState<string>('Relação Geral de Membros');

  // ─── ESTADO: FILTROS DO RELATÓRIO ───────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [sexoFilter, setSexoFilter] = useState('todos');
  const [estadoCivilFilter, setEstadoCivilFilter] = useState('todos');
  const [cargoFilter, setCargoFilter] = useState('todos');
  const [funcaoFilter, setFuncaoFilter] = useState('todos');
  const [faixaEtariaFilter, setFaixaEtariaFilter] = useState('todos');
  const [batismoAguasFilter, setBatismoAguasFilter] = useState('todos');
  const [batismoEsFilter, setBatismoEsFilter] = useState('todos');
  const [cursoTeologicoFilter, setCursoTeologicoFilter] = useState('todos');
  const [procedenciaFilter, setProcedenciaFilter] = useState('');
  const [qualidadeFilter, setQualidadeFilter] = useState('todos');

  // ─── ESTADO: COLUNAS SELECIONADAS ───────────────────────────────────────────
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'name',
    'tipo_cadastro',
    'status',
    'congregacao_nome',
    'celular',
    'cargo_ministerial',
    'idade',
  ]);

  // UI state para painel expansível de colunas e filtros avançados
  const [showColumnsModal, setShowColumnsModal] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // ─── ESTADO: RESULTADOS & PAGINAÇÃO ─────────────────────────────────────────
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // ─── APLICAÇÃO DE PRESET RÁPIDO ────────────────────────────────────────────
  const handleApplyPreset = (preset: ReportPreset) => {
    setActivePresetId(preset.id);
    setReportTitle(preset.name);
    setSearch(preset.filters.search || '');
    setStatusFilter(preset.filters.status || 'todos');
    setTipoFilter(preset.filters.tipo_cadastro || 'todos');
    setSexoFilter(preset.filters.sexo || 'todos');
    setEstadoCivilFilter(preset.filters.estado_civil || 'todos');
    setCargoFilter(preset.filters.cargo_ministerial || 'todos');
    setFuncaoFilter(preset.filters.tem_funcao_igreja || 'todos');
    setFaixaEtariaFilter(preset.filters.faixa_etaria || 'todos');
    setBatismoAguasFilter(preset.filters.batizado_aguas || 'todos');
    setBatismoEsFilter(preset.filters.batizado_espirito_santo || 'todos');
    setCursoTeologicoFilter(preset.filters.tem_curso_teologico || 'todos');
    setProcedenciaFilter(preset.filters.procedencia || '');
    setQualidadeFilter(preset.filters.qualidade_cadastral || 'todos');
    setSelectedColumns(preset.selectedColumns);
    setPage(1);
  };

  // ─── RESET TOTAL DE FILTROS ────────────────────────────────────────────────
  const handleResetFilters = () => {
    setActivePresetId('personalizado');
    setReportTitle('Relatório Personalizado de Membros');
    setSearch('');
    setStatusFilter('todos');
    setTipoFilter('todos');
    setSexoFilter('todos');
    setEstadoCivilFilter('todos');
    setCargoFilter('todos');
    setFuncaoFilter('todos');
    setFaixaEtariaFilter('todos');
    setBatismoAguasFilter('todos');
    setBatismoEsFilter('todos');
    setCursoTeologicoFilter('todos');
    setProcedenciaFilter('');
    setQualidadeFilter('todos');
    setSelectedColumns(ALL_COLUMNS.filter((c) => c.defaultSelected).map((c) => c.id));
    setPage(1);
  };

  // ─── CONSULTA SERVER-SIDE DOS DADOS ────────────────────────────────────────
  const executeQuery = useCallback(
    async (currentPage = 1, currentLimit = limit) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set('search', search.trim());
        if (statusFilter !== 'todos') params.set('status', statusFilter);
        if (tipoFilter !== 'todos') params.set('tipo_cadastro', tipoFilter);
        if (sexoFilter !== 'todos') params.set('sexo', sexoFilter);
        if (estadoCivilFilter !== 'todos') params.set('estado_civil', estadoCivilFilter);
        if (cargoFilter !== 'todos') params.set('cargo_ministerial', cargoFilter);
        if (funcaoFilter !== 'todos') params.set('tem_funcao_igreja', funcaoFilter);
        if (faixaEtariaFilter !== 'todos') params.set('faixa_etaria', faixaEtariaFilter);
        if (batismoAguasFilter !== 'todos') params.set('batizado_aguas', batismoAguasFilter);
        if (batismoEsFilter !== 'todos') params.set('batizado_espirito_santo', batismoEsFilter);
        if (cursoTeologicoFilter !== 'todos') params.set('tem_curso_teologico', cursoTeologicoFilter);
        if (procedenciaFilter.trim()) params.set('procedencia', procedenciaFilter.trim());
        if (qualidadeFilter !== 'todos') params.set('qualidade_cadastral', qualidadeFilter);
        if (congregacaoId && congregacaoId !== 'todas') params.set('congregacao_id', congregacaoId);

        params.set('page', String(currentPage));
        params.set('limit', String(currentLimit));

        const res = await authenticatedFetch(`/api/v1/secretaria/relatorios/members?${params.toString()}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Falha ao buscar membros para o relatório.');
        }

        setResults(data.data || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setPage(data.page || 1);
      } catch (err: any) {
        setError(err.message || 'Erro inesperado ao gerar relatório.');
      } finally {
        setLoading(false);
      }
    },
    [
      search,
      statusFilter,
      tipoFilter,
      sexoFilter,
      estadoCivilFilter,
      cargoFilter,
      funcaoFilter,
      faixaEtariaFilter,
      batismoAguasFilter,
      batismoEsFilter,
      cursoTeologicoFilter,
      procedenciaFilter,
      qualidadeFilter,
      congregacaoId,
      limit,
    ]
  );

  // Execução inicial automática com o preset padrão
  useEffect(() => {
    executeQuery(1, limit);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── GERENCIAMENTO DE COLUNAS ──────────────────────────────────────────────
  const toggleColumn = (colId: string) => {
    setSelectedColumns((prev) => {
      if (prev.includes(colId)) {
        if (prev.length <= 1) return prev; // manter ao menos 1 coluna
        return prev.filter((id) => id !== colId);
      }
      return [...prev, colId];
    });
  };

  const selectAllColumns = () => {
    setSelectedColumns(ALL_COLUMNS.map((c) => c.id));
  };

  const resetDefaultColumns = () => {
    setSelectedColumns(ALL_COLUMNS.filter((c) => c.defaultSelected).map((c) => c.id));
  };

  // Colunas ativas em ordem
  const activeColumnsList = useMemo(() => {
    return ALL_COLUMNS.filter((col) => selectedColumns.includes(col.id));
  }, [selectedColumns]);

  // ─── EXPORTAÇÃO CSV COMPLETA (SERVER-SIDE) ─────────────────────────────────
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'todos') params.set('status', statusFilter);
      if (tipoFilter !== 'todos') params.set('tipo_cadastro', tipoFilter);
      if (sexoFilter !== 'todos') params.set('sexo', sexoFilter);
      if (estadoCivilFilter !== 'todos') params.set('estado_civil', estadoCivilFilter);
      if (cargoFilter !== 'todos') params.set('cargo_ministerial', cargoFilter);
      if (funcaoFilter !== 'todos') params.set('tem_funcao_igreja', funcaoFilter);
      if (faixaEtariaFilter !== 'todos') params.set('faixa_etaria', faixaEtariaFilter);
      if (batismoAguasFilter !== 'todos') params.set('batizado_aguas', batismoAguasFilter);
      if (batismoEsFilter !== 'todos') params.set('batizado_espirito_santo', batismoEsFilter);
      if (cursoTeologicoFilter !== 'todos') params.set('tem_curso_teologico', cursoTeologicoFilter);
      if (procedenciaFilter.trim()) params.set('procedencia', procedenciaFilter.trim());
      if (qualidadeFilter !== 'todos') params.set('qualidade_cadastral', qualidadeFilter);
      if (congregacaoId && congregacaoId !== 'todas') params.set('congregacao_id', congregacaoId);
      params.set('export', 'true');

      const res = await authenticatedFetch(`/api/v1/secretaria/relatorios/members?${params.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao buscar registros para exportação.');
      }

      const allRecords = data.data || [];
      if (allRecords.length === 0) {
        alert('Nenhum registro correspondente aos filtros para exportar.');
        return;
      }

      // Montagem do CSV respeitando estritamente as colunas selecionadas
      const headers = activeColumnsList.map((c) => `"${c.label}"`).join(';');
      const rows = allRecords.map((item: any) => {
        return activeColumnsList
          .map((col) => {
            const val = formatCellValue(item, col.id);
            return `"${String(val).replace(/"/g, '""')}"`;
          })
          .join(';');
      });

      const csvContent = '\uFEFF' + [headers, ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const cleanTitle = reportTitle.toLowerCase().replace(/[^a-z0-9]/gi, '_');
      link.setAttribute('download', `relatorio_secretaria_${cleanTitle}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Erro na exportação CSV: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  // ─── IMPRESSÃO A4 INSTITUCIONAL ────────────────────────────────────────────
  const handlePrint = () => {
    window.print();
  };

  // Formatador de células de acordo com o ID da coluna
  const formatCellValue = (item: any, colId: string): string => {
    switch (colId) {
      case 'status':
        if (item.status === 'active') return 'Ativo';
        if (item.status === 'inactive') return 'Inativo';
        if (item.status === 'transferred') return 'Transferido';
        if (item.status === 'deceased') return 'Falecido';
        return item.status || '—';
      case 'tipo_cadastro':
        if (item.tipo_cadastro === 'membro') return 'Membro';
        if (item.tipo_cadastro === 'congregado') return 'Congregado';
        if (item.tipo_cadastro === 'crianca') return 'Criança';
        if (item.tipo_cadastro === 'ministro') return 'Ministro';
        return item.tipo_cadastro || '—';
      case 'sexo':
        if (item.sexo === 'M') return 'Masculino';
        if (item.sexo === 'F') return 'Feminino';
        return item.sexo || 'Não informado';
      case 'data_nascimento':
      case 'data_batismo_aguas':
      case 'data_batismo_espirito_santo':
      case 'member_since':
        if (!item[colId]) return '—';
        const parts = String(item[colId]).split('T')[0].split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return item[colId];
      case 'idade':
        return item.idade !== null && item.idade !== undefined ? `${item.idade} anos` : '—';
      case 'congregacao_nome':
        return item.congregacao_nome || item.congregacoes?.nome || 'Sede';
      case 'phone':
      case 'celular':
      case 'whatsapp':
        return item[colId] || '—';
      case 'qual_funcao':
        return item.qual_funcao || (item.tem_funcao_igreja ? 'Sim' : '—');
      default:
        return item[colId] !== null && item[colId] !== undefined && item[colId] !== ''
          ? String(item[colId])
          : '—';
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── CABEÇALHO EXCLUSIVO DE IMPRESSÃO A4 ───────────────────────────── */}
      <ReportPrintHeader
        title={reportTitle.toUpperCase()}
        subtitle={`Relação personalizada extraída com ${activeColumnsList.length} colunas selecionadas.`}
        congregacaoNome={congregacaoNome}
      />

      {/* ─── CABEÇALHO DA ABA & PRESETS RÁPIDOS (OCULTO NA IMPRESSÃO) ───────── */}
      <div className="print:hidden space-y-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#123b63] flex items-center justify-center font-bold text-sm">
                  <SlidersHorizontal className="w-4 h-4 stroke-[2]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Construtor de Relatórios Personalizados</h2>
                  <p className="text-xs text-gray-500">
                    Selecione um modelo operacional ou monte uma relação combinando filtros e colunas customizadas.
                  </p>
                </div>
              </div>
            </div>

            {/* Ações de Impressão e Exportação */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                disabled={results.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition shadow-sm disabled:opacity-50"
                title="Imprimir visualização formatada em folha A4"
              >
                <Printer className="w-4 h-4 text-gray-500" />
                Imprimir A4
              </button>
              <button
                onClick={handleExportCSV}
                disabled={exporting || total === 0}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition shadow-sm disabled:opacity-50"
                title="Exportar todos os registros correspondentes aos filtros em CSV UTF-8"
              >
                <Download className="w-4 h-4" />
                {exporting ? 'Exportando...' : 'Exportar CSV'}
              </button>
            </div>
          </div>

          {/* Atalhos Rápidos (Presets Operacionais) */}
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Modelos Rápidos da Secretaria
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {REPORT_PRESETS.map((preset) => {
                const isActive = activePresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleApplyPreset(preset)}
                    className={`p-2.5 rounded-xl text-left border transition flex flex-col justify-between ${
                      isActive
                        ? 'border-[#123b63] bg-blue-50/50 ring-2 ring-[#123b63]/10 text-[#123b63]'
                        : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <span className="text-xs font-bold truncate block">{preset.name}</span>
                    <span className="text-[10px] text-gray-500 mt-1 line-clamp-1">{preset.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ─── PAINEL DE FILTROS COMBINÁVEIS ─────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#123b63]" />
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Critérios e Filtros de Busca</h3>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="text-xs text-[#123b63] hover:underline font-semibold flex items-center gap-1"
              >
                {showAdvancedFilters ? 'Ocultar Filtros Avançados' : 'Mais Filtros (Eclesiásticos & Qualidade)'}
                {showAdvancedFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={handleResetFilters}
                className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 transition"
                title="Limpar todos os filtros"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Limpar
              </button>
            </div>
          </div>

          {/* Linha Principal de Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Busca Geral */}
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Busca Textual</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setActivePresetId('personalizado');
                  }}
                  placeholder="Nome, CPF ou Matrícula..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#123b63]/20 focus:border-[#123b63]"
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Status Cadastral</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setActivePresetId('personalizado');
                }}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#123b63]/20 focus:border-[#123b63] bg-white"
              >
                <option value="todos">Todos os Status</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
                <option value="transferred">Transferidos</option>
                <option value="deceased">Falecidos</option>
              </select>
            </div>

            {/* Tipo de Cadastro */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Tipo de Cadastro</label>
              <select
                value={tipoFilter}
                onChange={(e) => {
                  setTipoFilter(e.target.value);
                  setActivePresetId('personalizado');
                }}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#123b63]/20 focus:border-[#123b63] bg-white"
              >
                <option value="todos">Todos os Tipos</option>
                <option value="membro">Membro Oficial</option>
                <option value="congregado">Congregado</option>
                <option value="crianca">Criança</option>
                <option value="ministro">Ministro / Oficial</option>
              </select>
            </div>

            {/* Faixa Etária */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Faixa Etária</label>
              <select
                value={faixaEtariaFilter}
                onChange={(e) => {
                  setFaixaEtariaFilter(e.target.value);
                  setActivePresetId('personalizado');
                }}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#123b63]/20 focus:border-[#123b63] bg-white"
              >
                <option value="todos">Todas as Idades</option>
                <option value="0-11">Crianças (0 a 11 anos)</option>
                <option value="12-17">Adolescentes (12 a 17 anos)</option>
                <option value="18-29">Jovens (18 a 29 anos)</option>
                <option value="30-59">Adultos (30 a 59 anos)</option>
                <option value="60+">Idosos (60+ anos)</option>
                <option value="nao_informado">Sem Data de Nascimento</option>
              </select>
            </div>

            {/* Sexo */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Sexo</label>
              <select
                value={sexoFilter}
                onChange={(e) => {
                  setSexoFilter(e.target.value);
                  setActivePresetId('personalizado');
                }}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#123b63]/20 focus:border-[#123b63] bg-white"
              >
                <option value="todos">Todos</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
              </select>
            </div>

            {/* Estado Civil */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Estado Civil</label>
              <select
                value={estadoCivilFilter}
                onChange={(e) => {
                  setEstadoCivilFilter(e.target.value);
                  setActivePresetId('personalizado');
                }}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#123b63]/20 focus:border-[#123b63] bg-white"
              >
                <option value="todos">Todos os Estados Civis</option>
                <option value="solteiro">Solteiro(a)</option>
                <option value="casado">Casado(a)</option>
                <option value="divorciado">Divorciado(a)</option>
                <option value="viuvo">Viúvo(a)</option>
                <option value="uniao_estavel">União Estável</option>
              </select>
            </div>

            {/* Cargo Ministerial */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Cargo Ministerial</label>
              <select
                value={cargoFilter}
                onChange={(e) => {
                  setCargoFilter(e.target.value);
                  setActivePresetId('personalizado');
                }}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#123b63]/20 focus:border-[#123b63] bg-white"
              >
                <option value="todos">Todos os Cargos</option>
                <option value="Pastor">Pastor(a)</option>
                <option value="Evangelista">Evangelista</option>
                <option value="Presbítero">Presbítero</option>
                <option value="Diácono">Diácono(a)</option>
                <option value="Missionário">Missionário(a)</option>
                <option value="Cooperador">Cooperador(a)</option>
              </select>
            </div>
          </div>

          {/* Filtros Avançados (Expansível) */}
          {showAdvancedFilters && (
            <div className="pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-gray-50/50 p-3.5 rounded-xl">
              {/* Qualidade Cadastral */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Qualidade Cadastral</label>
                <select
                  value={qualidadeFilter}
                  onChange={(e) => {
                    setQualidadeFilter(e.target.value);
                    setActivePresetId('personalizado');
                  }}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#123b63]/20 focus:border-[#123b63] bg-white"
                >
                  <option value="todos">Todos os Cadastros</option>
                  <option value="completo">Cadastro 100% Completo</option>
                  <option value="pendencias">Com Qualquer Pendência</option>
                  <option value="sem_cpf">Sem CPF</option>
                  <option value="sem_telefone">Sem Telefone/WhatsApp</option>
                  <option value="sem_data_nascimento">Sem Data de Nascimento</option>
                  <option value="sem_endereco">Sem Endereço</option>
                  <option value="sem_foto">Sem Foto de Perfil</option>
                </select>
              </div>

              {/* Batismo nas Águas */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Batismo nas Águas</label>
                <select
                  value={batismoAguasFilter}
                  onChange={(e) => {
                    setBatismoAguasFilter(e.target.value);
                    setActivePresetId('personalizado');
                  }}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#123b63]/20 focus:border-[#123b63] bg-white"
                >
                  <option value="todos">Indiferente</option>
                  <option value="true">Batizado nas Águas</option>
                  <option value="false">Não Batizado</option>
                </select>
              </div>

              {/* Batismo Espírito Santo */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Batismo Espírito Santo</label>
                <select
                  value={batismoEsFilter}
                  onChange={(e) => {
                    setBatismoEsFilter(e.target.value);
                    setActivePresetId('personalizado');
                  }}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#123b63]/20 focus:border-[#123b63] bg-white"
                >
                  <option value="todos">Indiferente</option>
                  <option value="true">Batizado no Espírito Santo</option>
                  <option value="false">Não Batizado</option>
                </select>
              </div>

              {/* Possui Função na Igreja */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Função na Igreja</label>
                <select
                  value={funcaoFilter}
                  onChange={(e) => {
                    setFuncaoFilter(e.target.value);
                    setActivePresetId('personalizado');
                  }}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#123b63]/20 focus:border-[#123b63] bg-white"
                >
                  <option value="todos">Indiferente</option>
                  <option value="true">Possui Função Ativa</option>
                  <option value="false">Sem Função Atribuída</option>
                </select>
              </div>
            </div>
          )}

          {/* Barra de Ação: Selecionar Colunas & Gerar Relatório */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-gray-100">
            <button
              onClick={() => setShowColumnsModal(!showColumnsModal)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-3.5 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-xs font-semibold rounded-xl transition shadow-sm"
            >
              <Columns className="w-4 h-4 text-[#123b63]" />
              Selecionar Colunas ({selectedColumns.length}/{ALL_COLUMNS.length})
            </button>

            <button
              onClick={() => executeQuery(1, limit)}
              disabled={loading}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-[#123b63] hover:bg-[#0e2f50] text-white text-xs font-bold rounded-xl transition shadow-sm disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Gerando Relatório...
                </>
              ) : (
                <>
                  <SlidersHorizontal className="w-4 h-4" />
                  GERAR RELATÓRIO
                </>
              )}
            </button>
          </div>
        </div>

        {/* ─── PAINEL EXPANSÍVEL DE SELEÇÃO DE COLUNAS ───────────────────────── */}
        {showColumnsModal && (
          <div className="bg-white rounded-2xl border border-[#123b63]/30 p-5 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Configuração de Colunas da Tabela & Exportação
                </h4>
                <p className="text-[11px] text-gray-500">
                  Marque ou desmarque os campos que devem ser exibidos na visualização em tela, na impressão e no CSV.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAllColumns}
                  className="text-xs text-[#123b63] hover:underline font-semibold"
                >
                  Marcar Todas
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={resetDefaultColumns}
                  className="text-xs text-gray-600 hover:underline"
                >
                  Restaurar Padrão
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {COLUMN_GROUPS.map((group) => {
                const groupCols = ALL_COLUMNS.filter((c) => c.group === group.id);
                return (
                  <div key={group.id} className="bg-gray-50/70 p-3 rounded-xl border border-gray-100">
                    <p className="text-[11px] font-bold text-[#123b63] uppercase tracking-wider mb-2 border-b border-gray-200/60 pb-1">
                      {group.label}
                    </p>
                    <div className="space-y-1.5">
                      {groupCols.map((col) => {
                        const isChecked = selectedColumns.includes(col.id);
                        return (
                          <label
                            key={col.id}
                            className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:text-gray-900 select-none"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleColumn(col.id)}
                              className="rounded border-gray-300 text-[#123b63] focus:ring-[#123b63]"
                            />
                            <span className={isChecked ? 'font-medium text-gray-900' : 'text-gray-500'}>
                              {col.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
                onClick={() => setShowColumnsModal(false)}
                className="px-4 py-1.5 bg-[#123b63] text-white text-xs font-semibold rounded-lg hover:bg-[#0e2f50] transition"
              >
                Concluir Seleção
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── RESULTADOS: TABELA DINÂMICA & PAGINAÇÃO ─────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden print:border-none print:shadow-none">
        {/* Barra superior de informações de resultados */}
        <div className="px-5 py-3.5 bg-gray-50/80 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-800">
              Total Encontrado: <span className="text-[#123b63]">{total}</span> {total === 1 ? 'registro' : 'registros'}
            </span>
            {loading && <span className="text-xs text-gray-400 animate-pulse">Atualizando...</span>}
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500 flex items-center gap-1.5">
              <span>Exibir por página:</span>
              <select
                value={limit}
                onChange={(e) => {
                  const newLimit = parseInt(e.target.value, 10);
                  setLimit(newLimit);
                  executeQuery(1, newLimit);
                }}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#123b63]"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
          </div>
        </div>

        {/* Estado de Erro */}
        {error ? (
          <div className="p-8 text-center text-red-600">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
            <p className="text-xs font-bold">{error}</p>
            <button
              onClick={() => executeQuery(page, limit)}
              className="mt-3 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-200 transition"
            >
              Tentar Novamente
            </button>
          </div>
        ) : loading && results.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <div className="w-8 h-8 rounded-full border-3 border-[#123b63] border-t-transparent animate-spin mx-auto mb-2" />
            <p className="text-xs font-medium">Processando consulta personalizada...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <div className="w-10 h-10 rounded-2xl bg-gray-100 text-gray-400 mx-auto flex items-center justify-center mb-2">
              <Search className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-gray-700">Nenhum membro encontrado</p>
            <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1">
              Tente ajustar os critérios de busca, remover filtros ou selecionar um modelo rápido diferente.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100/75 border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3 w-10 text-center print:hidden">#</th>
                  {activeColumnsList.map((col) => (
                    <th key={col.id} className="py-3 px-3.5 whitespace-nowrap">
                      {col.label}
                    </th>
                  ))}
                  <th className="py-3 px-3 w-12 text-center print:hidden">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.map((item, idx) => {
                  const rowNumber = (page - 1) * limit + idx + 1;
                  return (
                    <tr key={item.id || idx} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-2.5 px-3 text-center text-gray-400 font-mono text-[11px] print:hidden">
                        {rowNumber}
                      </td>

                      {activeColumnsList.map((col) => {
                        const formatted = formatCellValue(item, col.id);

                        // Renderizações estilizadas para badges
                        if (col.id === 'status') {
                          const isAtivo = item.status === 'active';
                          return (
                            <td key={col.id} className="py-2.5 px-3.5 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isAtivo ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {formatted}
                              </span>
                            </td>
                          );
                        }

                        if (col.id === 'tipo_cadastro') {
                          return (
                            <td key={col.id} className="py-2.5 px-3.5 whitespace-nowrap font-medium text-gray-700">
                              {formatted}
                            </td>
                          );
                        }

                        if (col.id === 'name') {
                          return (
                            <td key={col.id} className="py-2.5 px-3.5 font-bold text-gray-900 whitespace-nowrap">
                              {formatted}
                            </td>
                          );
                        }

                        return (
                          <td key={col.id} className="py-2.5 px-3.5 text-gray-600 whitespace-nowrap">
                            {formatted}
                          </td>
                        );
                      })}

                      <td className="py-2.5 px-3 text-center print:hidden">
                        <Link
                          href={`/secretaria/membros/${item.id}`}
                          target="_blank"
                          className="p-1 text-gray-400 hover:text-[#123b63] hover:bg-gray-100 rounded inline-block transition"
                          title="Abrir ficha cadastral do membro"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação Dinâmica (Oculta na Impressão) */}
        {results.length > 0 && totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600 bg-gray-50/50 print:hidden">
            <div>
              Mostrando <span className="font-semibold">{(page - 1) * limit + 1}</span> a{' '}
              <span className="font-semibold">{Math.min(page * limit, total)}</span> de{' '}
              <span className="font-semibold">{total}</span> registros
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  const p = Math.max(1, page - 1);
                  setPage(p);
                  executeQuery(p, limit);
                }}
                disabled={page <= 1 || loading}
                className="p-1.5 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-medium text-gray-700">
                Página {page} de {totalPages}
              </span>
              <button
                onClick={() => {
                  const p = Math.min(totalPages, page + 1);
                  setPage(p);
                  executeQuery(p, limit);
                }}
                disabled={page >= totalPages || loading}
                className="p-1.5 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
