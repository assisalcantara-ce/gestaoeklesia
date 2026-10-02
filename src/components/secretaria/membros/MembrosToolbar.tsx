'use client';

import { useState } from 'react';
import Link from 'next/link';

export interface MembrosToolbarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  cargoFilter: string;
  setCargoFilter: (cargo: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  congregacaoFilter?: string;
  setCongregacaoFilter?: (congregacao: string) => void;
  congregacoesOptions?: Array<{ id: string; nome: string }>;
  setCurrentPage: (page: number) => void;
  setSortOrdemAlfabetica?: (sort: boolean) => void;
  cargosMinisteriais: Array<{ id: string; nome: string; ativo: boolean }>;
  membrosFiltradosCount: number;
  totalMembrosCount: number;
  isSupervisor: boolean;
  limiteMembrosAtingido: boolean;
  maxMembros: number;
  abrirNovoCadastro: () => void;
  abrirCadastroPublico?: () => void;
  gerarPDFListagem: () => void;
  membrosSelecionadosCount: number;
  setImprimindoLote: (lote: boolean) => void;
  setNotification: (notif: any) => void;
}

export default function MembrosToolbar({
  searchTerm,
  setSearchTerm,
  cargoFilter,
  setCargoFilter,
  statusFilter,
  setStatusFilter,
  congregacaoFilter = 'TODAS',
  setCongregacaoFilter,
  congregacoesOptions = [],
  setCurrentPage,
  setSortOrdemAlfabetica,
  cargosMinisteriais,
  membrosFiltradosCount,
  totalMembrosCount,
  isSupervisor,
  limiteMembrosAtingido,
  maxMembros,
  abrirNovoCadastro,
  abrirCadastroPublico,
  gerarPDFListagem,
  membrosSelecionadosCount,
  setImprimindoLote,
  setNotification,
}: MembrosToolbarProps) {
  const [showExtraMenu, setShowExtraMenu] = useState(false);

  const handleLimpar = () => {
    setSearchTerm('');
    setStatusFilter('TODOS');
    setCargoFilter('TODOS');
    setCongregacaoFilter?.('TODAS');
    setSortOrdemAlfabetica?.(false);
    setCurrentPage(1);
  };

  return (
    <>
      {/* CARD DE FILTROS */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-sm mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
          {/* Buscar membros */}
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Buscar membros
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Digite o nome, matrícula ou CPF para buscar..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
              />
            </div>
          </div>

          {/* Congregação */}
          <div className="lg:col-span-3">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Congregação
            </label>
            <select
              value={congregacaoFilter}
              onChange={(e) => {
                setCongregacaoFilter?.(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
            >
              <option value="TODAS">Todas</option>
              {congregacoesOptions.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>

          {/* Cargo */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Cargo
            </label>
            <select
              value={cargoFilter}
              onChange={(e) => {
                setCargoFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
            >
              <option value="TODOS">Todos</option>
              <option value="MEMBRO">Membro</option>
              <option value="CONGREGADO">Congregado</option>
              {cargosMinisteriais.filter(c => c.ativo).map(c => (
                <option key={c.id} value={c.nome}>{c.nome}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
            >
              <option value="TODOS">Todos</option>
              <option value="ATIVO">Ativo</option>
              <option value="INATIVO">Inativo</option>
            </select>
          </div>

          {/* Botão Limpar */}
          <div className="sm:col-span-2 lg:col-span-1 flex items-center">
            <button
              onClick={handleLimpar}
              className="w-full px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 rounded-xl font-bold text-xs sm:text-sm transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              title="Limpar filtros"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>Limpar</span>
            </button>
          </div>
        </div>
      </div>

      {/* CABEÇALHO DO BLOCO DA TABELA & BOTÕES DE AÇÃO */}
      <div className="bg-white rounded-t-2xl border-t border-x border-slate-200/90 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 border-b border-slate-200/80">
          {/* Lado Esquerdo: Título & Quantidade */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              Listagem de Membros
            </h2>
            <span className="px-3 py-1 bg-teal-50 text-teal-800 border border-teal-200/90 rounded-full text-xs font-bold">
              {membrosFiltradosCount} {membrosFiltradosCount === 1 ? 'membro' : 'membros'}
              {membrosFiltradosCount !== totalMembrosCount && (
                <span className="ml-1 text-[11px] text-teal-700 font-medium">de {totalMembrosCount}</span>
              )}
            </span>
          </div>

          {/* Lado Direito: Ações */}
          <div className="flex flex-wrap items-center gap-2.5">
            {!isSupervisor && (
              <>
                {/* Cadastro Público */}
                <button
                  onClick={() => abrirCadastroPublico?.()}
                  className="px-3.5 py-2 bg-[#0f233a] hover:bg-[#163354] text-white rounded-xl transition text-xs font-bold flex items-center gap-2 shadow-sm border border-[#0a1829] cursor-pointer"
                  title="Link público e QR Code para auto-cadastro de membros"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span>Cadastro Público</span>
                </button>

                {/* Importar CSV */}
                <Link
                  href="/secretaria/membros/importar"
                  className="px-3.5 py-2 bg-teal-50/80 hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-xl transition text-xs font-bold flex items-center gap-2 shadow-xs"
                >
                  <svg className="w-3.5 h-3.5 text-teal-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>Importar CSV</span>
                </Link>

                {/* Novo Cadastro */}
                <button
                  onClick={() => {
                    if (limiteMembrosAtingido) {
                      setNotification({
                        isOpen: true,
                        title: 'Limite atingido',
                        message: `Seu plano permite no máximo ${maxMembros} cadastros. Faça upgrade para adicionar mais.`,
                        type: 'warning',
                        showButton: true
                      });
                      return;
                    }
                    abrirNovoCadastro();
                  }}
                  className={`px-3.5 py-2 rounded-xl transition text-xs font-bold flex items-center gap-2 shadow-sm ${
                    limiteMembrosAtingido
                      ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 cursor-pointer'
                  }`}
                  title={limiteMembrosAtingido ? `Limite de ${maxMembros} cadastros atingido` : 'Cadastrar novo membro'}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Novo Cadastro</span>
                </button>
              </>
            )}

            {/* Imprimir */}
            <button
              onClick={gerarPDFListagem}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl transition text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer"
              title="Gerar PDF da listagem"
            >
              <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Imprimir</span>
            </button>

            {/* Menu ⋮ e Cartões */}
            <div className="relative">
              <button
                onClick={() => setShowExtraMenu(!showExtraMenu)}
                className="w-8 h-8 flex items-center justify-center bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl transition shadow-xs cursor-pointer"
                title="Mais opções"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>

              {showExtraMenu && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowExtraMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95">
                    <button
                      onClick={() => {
                        setShowExtraMenu(false);
                        if (membrosSelecionadosCount === 0) {
                          setNotification({
                            isOpen: true,
                            title: 'Aviso',
                            message: 'Selecione pelo menos um membro com foto na tabela para imprimir cartões.',
                            type: 'warning'
                          });
                          return;
                        }
                        setImprimindoLote(true);
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-800 flex items-center gap-2.5 cursor-pointer"
                    >
                      <svg className="w-4 h-4 text-teal-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                      </svg>
                      <span>Imprimir Cartões ({membrosSelecionadosCount})</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
