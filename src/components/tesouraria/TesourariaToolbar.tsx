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
    <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-4">
      {/* Linha 1: Mês | Movimento | Tipo | Categoria | Origem | Caixa */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Mês Ref.
          </label>
          <MonthPicker value={filtroMes} onChange={setFiltroMes} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Movimento
          </label>
          <div className="flex rounded-xl border border-slate-300 overflow-hidden text-sm h-[38px] p-0.5 bg-slate-50">
            {[
              { v: '' as const, label: 'Todos' },
              { v: 'entrada' as const, label: '↑ Entr.' },
              { v: 'saida' as const, label: '↓ Saída' },
            ].map((opt) => {
              const isActive = filtroMovimento === opt.v;
              let activeBg = 'bg-teal-700 text-white shadow-xs';
              if (isActive && opt.v === 'entrada') activeBg = 'bg-[#16a34a] text-white shadow-xs';
              if (isActive && opt.v === 'saida') activeBg = 'bg-[#e11d48] text-white shadow-xs';

              return (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => {
                    setFiltroMovimento(opt.v);
                    setFiltroTipo('');
                    setFiltroCategoria?.('');
                  }}
                  className={`flex-1 text-xs font-bold rounded-lg transition-all duration-150 px-1 cursor-pointer ${
                    isActive
                      ? activeBg
                      : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Tipo
          </label>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white font-medium text-slate-800 h-[38px] focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
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
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Categoria Financeira
          </label>
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria?.(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white font-medium text-slate-800 h-[38px] focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
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
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Origem
          </label>
          <select
            value={filtroOrigem}
            onChange={(e) => setFiltroOrigem?.(e.target.value as any)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white font-medium text-slate-800 h-[38px] focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
          >
            <option value="">Todas as origens</option>
            <option value="manual">Manual</option>
            <option value="arrecadacao_digital">Arrecadação Digital PIX</option>
          </select>
        </div>
        {!scope.isFinanceiroLocal && (
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Caixa / Congregação
            </label>
            <select
              value={filtroCong}
              onChange={(e) => setFiltroCong(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white font-medium text-slate-800 h-[38px] focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
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
      <div className="pt-2 border-t border-slate-100 flex flex-wrap lg:flex-nowrap items-end gap-3 justify-between">
        <div className="flex flex-wrap items-end gap-3 flex-1 min-w-0">
          {/* Departamento */}
          <div className="w-full sm:w-44 lg:w-44 shrink-0">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Departamento
            </label>
            <select
              value={filtroDept}
              onChange={(e) => setFiltroDept(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white font-medium text-slate-800 h-[38px] focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
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
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Data inicial
            </label>
            <input
              type="date"
              value={filtroDataInicio}
              onChange={(e) => setFiltroDataInicio?.(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-2.5 py-2 text-xs sm:text-sm bg-white font-medium text-slate-800 h-[38px] focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
            />
          </div>

          {/* Data final */}
          <div className="w-full sm:w-36 lg:w-36 shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Data final
              </label>
              {isIntervaloInvalido && (
                <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1 rounded">Inválida</span>
              )}
            </div>
            <input
              type="date"
              value={filtroDataFim}
              onChange={(e) => setFiltroDataFim?.(e.target.value)}
              className={`w-full border rounded-xl px-2.5 py-2 text-xs sm:text-sm bg-white font-medium text-slate-800 h-[38px] focus:outline-none focus:ring-2 transition ${
                isIntervaloInvalido
                  ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500 bg-rose-50/40 text-rose-900'
                  : 'border-slate-300 focus:ring-teal-600/20 focus:border-teal-600'
              }`}
              title={isIntervaloInvalido ? 'Data final deve ser maior ou igual à data inicial' : undefined}
            />
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-2 items-center flex-wrap shrink-0">
            {scope.canWrite && (
              <button
                onClick={onNovoClick}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-xl text-sm font-bold hover:bg-teal-800 transition h-[38px] whitespace-nowrap shadow-xs cursor-pointer border border-teal-800"
              >
                <Plus className="h-4 w-4" /> Novo lançamento
              </button>
            )}
            {lancamentosMesCount > 0 && (
              <button
                onClick={onExportarCSV}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 bg-white text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 hover:text-slate-900 transition h-[38px] cursor-pointer shadow-2xs"
                title="Exportar lançamentos filtrados para CSV"
              >
                <Download className="h-4 w-4 text-slate-500" /> CSV
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
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition h-[38px] whitespace-nowrap cursor-pointer ${
                isLimparDisabled
                  ? 'border border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 shadow-xs'
              }`}
            >
              Limpar Filtros
            </button>
          </div>
        </div>

        {/* Totalizador de Alto Contraste */}
        <div className="flex gap-2.5 flex-wrap text-xs sm:text-sm items-center h-[38px] shrink-0 justify-end bg-slate-50/90 px-3.5 py-1.5 rounded-2xl border border-slate-200">
          <span className="font-semibold text-slate-500">{lancsFiltradosCount} reg.</span>
          <span className="text-slate-300">|</span>
          <span className="text-[#15803d] font-bold">↑ {fmtBRL(entradasFiltradas)}</span>
          <span className="text-[#be123c] font-bold">↓ {fmtBRL(saidasFiltradas)}</span>
          <span className="text-slate-300">|</span>
          <span
            className={`font-extrabold ${
              entradasFiltradas - saidasFiltradas >= 0 ? 'text-[#1e3a8a]' : 'text-[#881337]'
            }`}
          >
            = {fmtBRL(entradasFiltradas - saidasFiltradas)}
          </span>
        </div>
      </div>

      {/* Loading do mês */}
      {loadingMes && (
        <p className="text-xs text-slate-500 font-medium mt-2 text-center">Buscando lançamentos do mês...</p>
      )}
    </div>
  );
}
