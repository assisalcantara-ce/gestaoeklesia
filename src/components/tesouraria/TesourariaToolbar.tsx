'use client';

import { Download, Plus } from 'lucide-react';

export interface TesourariaToolbarProps {
  filtroMes: string;
  setFiltroMes: (val: string) => void;
  filtroMovimento: '' | 'entrada' | 'saida';
  setFiltroMovimento: (val: '' | 'entrada' | 'saida') => void;
  filtroTipo: string;
  setFiltroTipo: (val: string) => void;
  filtroCategoria?: string;
  setFiltroCategoria?: (val: string) => void;
  filtroOrigem?: '' | 'manual' | 'arrecadacao_digital';
  setFiltroOrigem?: (val: '' | 'manual' | 'arrecadacao_digital') => void;
  filtroCong: string;
  setFiltroCong: (val: string) => void;
  filtroDept: string;
  setFiltroDept: (val: string) => void;
  filtroDataInicio?: string;
  setFiltroDataInicio?: (val: string) => void;
  filtroDataFim?: string;
  setFiltroDataFim?: (val: string) => void;
  scope: {
    canWrite?: boolean;
    isFinanceiroLocal?: boolean;
  };
  congregacoes: Array<{ id: string; nome: string }>;
  departamentos: Array<{ id: string; nome: string; sigla?: string }>;
  finCategorias?: Array<{ id: string; nome: string; icone?: string | null; tipo_movimento?: string }>;
  TIPOS: Array<{ value: string; label: string }>;
  TIPOS_SAIDA: Array<{ value: string; label: string }>;
  MonthPicker: React.ComponentType<{ value: string; onChange: (v: string) => void; className?: string }>;
  onNovoClick: () => void;
  lancamentosMesCount: number;
  onExportarCSV: () => void;
  lancsFiltradosCount: number;
  entradasFiltradas: number;
  saidasFiltradas: number;
  fmtBRL: (val: number) => string;
  loadingMes?: boolean;
}

export default function TesourariaToolbar({
  filtroMes,
  setFiltroMes,
  filtroMovimento,
  setFiltroMovimento,
  filtroTipo,
  setFiltroTipo,
  filtroCategoria = '',
  setFiltroCategoria,
  filtroOrigem = '',
  setFiltroOrigem,
  filtroCong,
  setFiltroCong,
  filtroDept,
  setFiltroDept,
  filtroDataInicio = '',
  setFiltroDataInicio,
  filtroDataFim = '',
  setFiltroDataFim,
  scope,
  congregacoes,
  departamentos,
  finCategorias,
  TIPOS,
  TIPOS_SAIDA,
  MonthPicker,
  onNovoClick,
  lancamentosMesCount,
  onExportarCSV,
  lancsFiltradosCount,
  entradasFiltradas,
  saidasFiltradas,
  fmtBRL,
  loadingMes,
}: TesourariaToolbarProps) {
  const isIntervaloInvalido = Boolean(
    filtroDataInicio && filtroDataFim && filtroDataFim < filtroDataInicio
  );

  const isLimparDisabled =
    filtroMovimento === '' &&
    filtroTipo === '' &&
    filtroCategoria === '' &&
    filtroOrigem === '' &&
    filtroCong === '' &&
    filtroDept === '' &&
    !filtroDataInicio &&
    !filtroDataFim;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-md">
      {/* Linha 1: Mês | Movimento | Tipo | Categoria | Origem | Caixa */}
      <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Mês</label>
          <MonthPicker value={filtroMes} onChange={setFiltroMes} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Movimento</label>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm h-[38px]">
            {[
              { v: '' as const, label: 'Todos' },
              { v: 'entrada' as const, label: '↑ Entr.' },
              { v: 'saida' as const, label: '↓ Saída' },
            ].map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => {
                  setFiltroMovimento(opt.v);
                  setFiltroTipo('');
                  setFiltroCategoria?.('');
                }}
                className={`flex-1 text-xs font-medium transition px-1 ${
                  filtroMovimento === opt.v
                    ? opt.v === 'entrada'
                      ? 'bg-green-600 text-white'
                      : opt.v === 'saida'
                      ? 'bg-red-500 text-white'
                      : 'bg-[#123b63] text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo</label>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white h-[38px] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
          >
            <option value="">Todos os tipos</option>
            {filtroMovimento === 'saida'
              ? TIPOS_SAIDA.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))
              : TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Categoria Financeira</label>
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria?.(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white h-[38px] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
          >
            <option value="">Todas as categorias</option>
            {finCategorias &&
              finCategorias
                .filter((c) => !filtroMovimento || c.tipo_movimento === filtroMovimento || c.tipo_movimento === 'ambos')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icone ? `${c.icone} ` : ''}
                    {c.nome}
                  </option>
                ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Origem</label>
          <select
            value={filtroOrigem}
            onChange={(e) => setFiltroOrigem?.(e.target.value as any)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white h-[38px] font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
          >
            <option value="">Todas as origens</option>
            <option value="manual">Manual</option>
            <option value="arrecadacao_digital">Arrecadação Digital PIX</option>
          </select>
        </div>
        {!scope.isFinanceiroLocal && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Caixa</label>
            <select
              value={filtroCong}
              onChange={(e) => setFiltroCong(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white h-[38px] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
            >
              <option value="">Todas as congregações</option>
              {congregacoes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Linha 2: Departamento | Data inicial | Data final | Novo lançamento | Limpar | Totalizador */}
      <div className="mt-3 flex flex-wrap lg:flex-nowrap items-end gap-3 justify-between">
        <div className="flex flex-wrap items-end gap-3 flex-1 min-w-0">
          {/* Departamento */}
          <div className="w-full sm:w-44 lg:w-44 shrink-0">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Departamento</label>
            <select
              value={filtroDept}
              onChange={(e) => setFiltroDept(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white h-[38px] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
            >
              <option value="">Todos os departamentos</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.sigla ? `${d.sigla} – ` : ''}
                  {d.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Data inicial */}
          <div className="w-full sm:w-36 lg:w-36 shrink-0">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Data inicial</label>
            <input
              type="date"
              value={filtroDataInicio}
              onChange={(e) => setFiltroDataInicio?.(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs sm:text-sm bg-white h-[38px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
            />
          </div>

          {/* Data final */}
          <div className="w-full sm:w-36 lg:w-36 shrink-0">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Data final</label>
              {isIntervaloInvalido && (
                <span className="text-[10px] text-red-500 font-bold mb-1">Inválida</span>
              )}
            </div>
            <input
              type="date"
              value={filtroDataFim}
              onChange={(e) => setFiltroDataFim?.(e.target.value)}
              className={`w-full border rounded-lg px-2.5 py-2 text-xs sm:text-sm bg-white h-[38px] text-slate-800 focus:outline-none focus:ring-2 ${
                isIntervaloInvalido
                  ? 'border-red-400 focus:ring-red-500/20 focus:border-red-500 bg-red-50/30'
                  : 'border-gray-200 focus:ring-teal-500/20 focus:border-teal-600'
              }`}
              title={isIntervaloInvalido ? 'Data final deve ser maior ou igual à data inicial' : undefined}
            />
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-2 items-center flex-wrap shrink-0">
            {scope.canWrite && (
              <button
                onClick={onNovoClick}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition h-[38px] whitespace-nowrap shadow-xs cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Novo lançamento
              </button>
            )}
            {lancamentosMesCount > 0 && (
              <button
                onClick={onExportarCSV}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition h-[38px] cursor-pointer"
                title="Exportar lançamentos filtrados para CSV"
              >
                <Download className="h-4 w-4" /> CSV
              </button>
            )}
            <button
              onClick={() => {
                setFiltroMovimento('');
                setFiltroTipo('');
                setFiltroCategoria?.('');
                setFiltroOrigem?.('');
                setFiltroCong('');
                setFiltroDept('');
                setFiltroDataInicio?.('');
                setFiltroDataFim?.('');
              }}
              disabled={isLimparDisabled}
              className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition h-[38px] whitespace-nowrap cursor-pointer ${
                isLimparDisabled
                  ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
                  : 'border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300'
              }`}
            >
              Limpar Filtros
            </button>
          </div>
        </div>

        {/* Totalizador */}
        <div className="flex gap-3 flex-wrap text-sm items-center h-[38px] shrink-0 justify-end">
          <span className="text-gray-400">{lancsFiltradosCount} reg.</span>
          <span className="text-green-600 font-semibold">↑ {fmtBRL(entradasFiltradas)}</span>
          <span className="text-red-500 font-semibold">↓ {fmtBRL(saidasFiltradas)}</span>
          <span
            className={`font-bold ${
              entradasFiltradas - saidasFiltradas >= 0 ? 'text-[#123b63]' : 'text-red-600'
            }`}
          >
            = {fmtBRL(entradasFiltradas - saidasFiltradas)}
          </span>
        </div>
      </div>

      {/* Loading do mês */}
      {loadingMes && (
        <p className="text-xs text-gray-400 mt-2 text-center">Buscando lançamentos do mês...</p>
      )}
    </div>
  );
}
