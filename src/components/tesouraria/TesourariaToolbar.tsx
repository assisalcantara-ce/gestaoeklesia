'use client';

import { Download, Plus } from 'lucide-react';

export interface TesourariaToolbarProps {
  filtroMes: string;
  setFiltroMes: (val: string) => void;
  filtroMovimento: '' | 'entrada' | 'saida';
  setFiltroMovimento: (val: '' | 'entrada' | 'saida') => void;
  filtroTipo: string;
  setFiltroTipo: (val: string) => void;
  filtroCong: string;
  setFiltroCong: (val: string) => void;
  filtroDept: string;
  setFiltroDept: (val: string) => void;
  scope: {
    canWrite?: boolean;
    isFinanceiroLocal?: boolean;
  };
  congregacoes: Array<{ id: string; nome: string }>;
  departamentos: Array<{ id: string; nome: string; sigla?: string }>;
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
  filtroCong,
  setFiltroCong,
  filtroDept,
  setFiltroDept,
  scope,
  congregacoes,
  departamentos,
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
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-md">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
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
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
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
        {!scope.isFinanceiroLocal && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Caixa</label>
            <select
              value={filtroCong}
              onChange={(e) => setFiltroCong(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
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

      {/* Linha 2: Departamento + Botões e Métricas */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Departamento</label>
          <select
            value={filtroDept}
            onChange={(e) => setFiltroDept(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
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

        <div className="sm:col-span-3 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex gap-2">
            {scope.canWrite && (
              <button
                onClick={onNovoClick}
                className="flex items-center gap-2 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition h-[38px] whitespace-nowrap"
              >
                <Plus className="h-4 w-4" /> Novo lançamento
              </button>
            )}
            {lancamentosMesCount > 0 && (
              <button
                onClick={onExportarCSV}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition h-[38px]"
                title="Exportar lançamentos filtrados para CSV"
              >
                <Download className="h-4 w-4" /> CSV
              </button>
            )}
            <button
              onClick={() => {
                setFiltroMovimento('');
                setFiltroTipo('');
                setFiltroCong('');
                setFiltroDept('');
              }}
              disabled={filtroMovimento === '' && filtroTipo === '' && filtroCong === '' && filtroDept === ''}
              className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition h-[38px] ${
                filtroMovimento === '' && filtroTipo === '' && filtroCong === '' && filtroDept === ''
                  ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
                  : 'border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300'
              }`}
            >
              Limpar Filtros
            </button>
          </div>

          {/* Totalizador */}
          <div className="flex gap-3 flex-wrap text-sm items-center h-[38px]">
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
      </div>

      {/* Loading do mês */}
      {loadingMes && (
        <p className="text-xs text-gray-400 mt-2 text-center">Buscando lançamentos do mês...</p>
      )}
    </div>
  );
}
