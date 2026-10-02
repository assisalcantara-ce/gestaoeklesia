'use client';

import { useState } from 'react';

export interface MembroData {
  id: string;
  matricula: string;
  nome: string;
  cpf: string;
  tipoCadastro: string;
  status: string;
  fotoUrl?: string | null;
  cargoMinisterial?: string | null;
  dataConsagracao?: string | null;
  congregacao?: string | null;
  [key: string]: any;
}

export interface MembrosTableProps {
  membrosPaginados: any[];
  membrosFiltradosCount: number;
  membrosSelecionados: Set<string>;
  setMembrosSelecionados: React.Dispatch<React.SetStateAction<Set<string>>>;
  sortOrdemAlfabetica?: boolean;
  setSortOrdemAlfabetica?: React.Dispatch<React.SetStateAction<boolean>>;
  maskCpf: (cpf: string) => string;
  isSupervisor: boolean;
  isAuxiliar: boolean;
  setMembroImprimindo: (membro: any) => void;
  abrirEdicao: (membro: any) => void;
  abrirDocumentosMembro: (membro: any) => Promise<void>;
  abrirConfirmacaoDeletar: (membro: any) => void;
  ensureTemplatesSnapshot: () => Promise<any>;
  hasActiveTemplate: (tipo: string, templates: any) => boolean;
  getMensagemSemTemplate: (tipo: string) => string;
  setNotification: (notif: any) => void;
  setMembroImprimindoCartao: (membro: any) => void;
  abrirHistoricoMembro?: (membro: any) => void;
  startIndex: number;
  endIndex: number;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  totalPages: number;
  itemsPerPage?: number;
  setItemsPerPage?: (items: number) => void;
}

export default function MembrosTable({
  membrosPaginados,
  membrosFiltradosCount,
  membrosSelecionados,
  setMembrosSelecionados,
  sortOrdemAlfabetica = false,
  setSortOrdemAlfabetica,
  maskCpf,
  isSupervisor,
  isAuxiliar,
  setMembroImprimindo,
  abrirEdicao,
  abrirDocumentosMembro,
  abrirConfirmacaoDeletar,
  ensureTemplatesSnapshot,
  hasActiveTemplate,
  getMensagemSemTemplate,
  setNotification,
  setMembroImprimindoCartao,
  abrirHistoricoMembro,
  startIndex,
  endIndex,
  currentPage,
  setCurrentPage,
  totalPages,
  itemsPerPage = 10,
  setItemsPerPage,
}: MembrosTableProps) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const getCargoExibicao = (membro: any) => {
    const tipo = (membro?.tipoCadastro || '').toLowerCase().trim();
    if (tipo === 'ministro') {
      return (membro?.cargoMinisterial || '').trim().toUpperCase() || 'MINISTRO';
    }
    return (membro?.tipoCadastro || '').toUpperCase().trim();
  };

  const getCargoBadgeClass = (membro: any) => {
    const tipo = (membro?.tipoCadastro || '').toLowerCase().trim();
    const cargo = (membro?.cargoMinisterial || '').toUpperCase().trim();

    if (tipo === 'ministro') {
      if (cargo.includes('PASTOR')) {
        return 'bg-amber-100 text-amber-900 border-amber-300';
      }
      if (cargo.includes('EVANGELISTA')) {
        return 'bg-blue-100 text-blue-900 border-blue-300';
      }
      if (cargo.includes('PRESB')) {
        return 'bg-indigo-100 text-indigo-900 border-indigo-300';
      }
      if (cargo.includes('DIACON')) {
        return 'bg-cyan-100 text-cyan-900 border-cyan-300';
      }
      if (cargo.includes('MISSION')) {
        return 'bg-rose-100 text-rose-900 border-rose-300';
      }
      return 'bg-sky-100 text-sky-900 border-sky-300';
    }
    if (tipo === 'congregado') {
      return 'bg-purple-100 text-purple-900 border-purple-300';
    }
    if (tipo === 'crianca') {
      return 'bg-pink-100 text-pink-900 border-pink-300';
    }
    return 'bg-emerald-100 text-emerald-900 border-emerald-300';
  };

  const temFotoValida = (membro: any): boolean => {
    return Boolean(membro?.fotoUrl && typeof membro.fotoUrl === 'string' && membro.fotoUrl.trim().length > 0);
  };

  const membrosComFotoNaPagina = membrosPaginados.filter(temFotoValida);
  const todosComFotoSelecionados =
    membrosComFotoNaPagina.length > 0 &&
    membrosComFotoNaPagina.every((m) => membrosSelecionados.has(m.id));

  return (
    <div className="bg-white rounded-b-2xl border-b border-x border-slate-200/90 shadow-sm overflow-hidden mb-8">
      {/* CARDS MOBILE — visíveis apenas em telas < md */}
      <div className="md:hidden space-y-3 p-4">
        {membrosPaginados.length === 0 && (
          <div className="text-center py-10 text-slate-500 font-medium text-sm">
            Nenhum membro encontrado com os filtros atuais.
          </div>
        )}
        {membrosPaginados.map((membro, index) => (
          <div
            key={membro.id}
            className={`border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3 ${
              index % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-12 h-14 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center border border-slate-300 flex-shrink-0 shadow-xs">
                {membro.fotoUrl ? (
                  <img src={membro.fotoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl text-slate-400">👤</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 text-sm break-words">{membro.nome}</p>
                <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                  <p>
                    Matrícula: <span className="font-bold text-slate-900">{membro.matricula || '-'}</span>
                  </p>
                  <p>CPF: {membro.cpf ? maskCpf(membro.cpf) : '-'}</p>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold self-start flex-shrink-0 border uppercase tracking-wider ${
                  membro.status === 'ativo'
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-rose-100 text-rose-900 border-rose-300'
                }`}
              >
                {membro.status.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200">
              <div>
                <span className="text-slate-500 block text-[11px] font-semibold uppercase">Cargo</span>
                <span className={`inline-block px-2.5 py-0.5 mt-0.5 rounded text-[11px] font-bold border ${getCargoBadgeClass(membro)}`}>
                  {getCargoExibicao(membro)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px] font-semibold uppercase">Consagração</span>
                <span className="text-slate-800 font-semibold mt-0.5 block">
                  {membro.dataConsagracao
                    ? new Date(membro.dataConsagracao + 'T00:00:00').toLocaleDateString('pt-BR')
                    : '-'}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setMembroImprimindo(membro)}
                className="p-2 text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition border border-slate-300 cursor-pointer"
                title="Visualizar / Imprimir Ficha"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>

              {!isSupervisor && (
                <button
                  onClick={() => abrirEdicao(membro)}
                  className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-xl transition border border-blue-200 cursor-pointer"
                  title="Editar Membro"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}

              {!isSupervisor && !isAuxiliar && (
                <button
                  onClick={() => abrirConfirmacaoDeletar(membro)}
                  className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition border border-rose-200 cursor-pointer"
                  title="Excluir"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* TABELA DESKTOP — visível apenas em telas md+ */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[980px]">
          <thead>
            <tr className="bg-slate-100/90 border-b border-slate-200 text-[11px] font-bold text-slate-800 uppercase tracking-wider">
              <th className="w-12 px-4 py-3.5 text-center">
                <input
                  type="checkbox"
                  checked={todosComFotoSelecionados}
                  disabled={membrosComFotoNaPagina.length === 0}
                  onChange={(e) => {
                    const novoSet = new Set(membrosSelecionados);
                    if (e.target.checked) {
                      membrosComFotoNaPagina.forEach((m) => novoSet.add(m.id));
                    } else {
                      membrosComFotoNaPagina.forEach((m) => novoSet.delete(m.id));
                    }
                    setMembrosSelecionados(novoSet);
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
                  title={
                    membrosComFotoNaPagina.length === 0
                      ? 'Nenhum membro com foto nesta página'
                      : 'Selecionar todos os membros com foto'
                  }
                />
              </th>
              <th className="px-4 py-3.5 w-24">Matrícula</th>
              <th className="px-4 py-3.5 text-center w-20">Foto</th>
              <th className="px-4 py-3.5">
                <div className="flex items-center gap-1.5">
                  <span>Nome</span>
                  <button
                    onClick={() => {
                      setSortOrdemAlfabetica?.(!sortOrdemAlfabetica);
                      setCurrentPage(1);
                    }}
                    className={`p-0.5 rounded transition cursor-pointer ${
                      sortOrdemAlfabetica ? 'text-teal-800 bg-teal-100' : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="Ordenar por Nome (A-Z)"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </th>
              <th className="px-4 py-3.5">CPF</th>
              <th className="px-4 py-3.5">Cargo</th>
              <th className="px-4 py-3.5">Data de Consagração</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5 text-center w-36">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/80">
            {membrosPaginados.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-12 text-slate-500 font-medium text-sm">
                  Nenhum membro cadastrado ou encontrado com os filtros selecionados.
                </td>
              </tr>
            )}
            {membrosPaginados.map((membro, index) => {
              const possuiFoto = temFotoValida(membro);
              const isMenuOpen = activeMenuId === membro.id;
              const isOddRow = index % 2 === 1;

              return (
                <tr
                  key={membro.id}
                  className={`transition-colors text-sm text-slate-800 group hover:bg-[#f1f5f9] ${
                    isOddRow ? 'bg-[#f8fafc]' : 'bg-white'
                  }`}
                >
                  {/* Checkbox */}
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={possuiFoto && membrosSelecionados.has(membro.id)}
                      disabled={!possuiFoto}
                      onChange={(e) => {
                        if (!possuiFoto) return;
                        const novoSet = new Set(membrosSelecionados);
                        if (e.target.checked) {
                          novoSet.add(membro.id);
                        } else {
                          novoSet.delete(membro.id);
                        }
                        setMembrosSelecionados(novoSet);
                      }}
                      className={`w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 ${
                        possuiFoto
                          ? 'cursor-pointer'
                          : 'cursor-not-allowed opacity-30 accent-slate-400'
                      }`}
                      title={possuiFoto ? 'Selecionar membro' : 'Membro sem foto'}
                    />
                  </td>

                  {/* Matrícula */}
                  <td className="px-4 py-3 font-bold text-slate-900">
                    {membro.matricula || '-'}
                  </td>

                  {/* Foto */}
                  <td className="px-4 py-2.5 text-center">
                    <div className="w-12 h-14 rounded-xl overflow-hidden bg-slate-100 border border-slate-300 flex items-center justify-center mx-auto shadow-xs">
                      {membro.fotoUrl ? (
                        <img src={membro.fotoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl text-slate-400">👤</span>
                      )}
                    </div>
                  </td>

                  {/* Nome */}
                  <td className="px-4 py-3.5 font-bold text-slate-900">
                    {membro.nome}
                  </td>

                  {/* CPF */}
                  <td className="px-4 py-3.5 text-slate-600 text-xs font-mono font-medium">
                    {membro.cpf ? maskCpf(membro.cpf) : '-'}
                  </td>

                  {/* Cargo */}
                  <td className="px-4 py-3.5">
                    <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold border ${getCargoBadgeClass(membro)}`}>
                      {getCargoExibicao(membro)}
                    </span>
                  </td>

                  {/* Data de Consagração */}
                  <td className="px-4 py-3.5 text-slate-700 font-medium text-xs">
                    {membro.dataConsagracao
                      ? new Date(membro.dataConsagracao + 'T00:00:00').toLocaleDateString('pt-BR')
                      : '-'}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold border uppercase tracking-wider ${
                        membro.status === 'ativo'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : 'bg-rose-100 text-rose-900 border-rose-300'
                      }`}
                    >
                      {membro.status.toUpperCase()}
                    </span>
                  </td>

                  {/* Ações Coloridas */}
                  <td className="px-4 py-3.5 text-center">
                    <div className="flex items-center justify-center gap-1.5 relative">
                      {/* Visualizar Ficha (Slate / Navy) */}
                      <button
                        onClick={() => setMembroImprimindo(membro)}
                        className="p-1.5 text-slate-700 hover:text-slate-950 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
                        title="Visualizar / Imprimir Ficha"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>

                      {/* Editar (Azul) */}
                      {!isSupervisor && (
                        <button
                          onClick={() => abrirEdicao(membro)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100/60 rounded-lg transition cursor-pointer"
                          title="Editar Membro"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}

                      {/* Excluir (Vermelho) */}
                      {!isSupervisor && !isAuxiliar && (
                        <button
                          onClick={() => abrirConfirmacaoDeletar(membro)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-100/60 rounded-lg transition cursor-pointer"
                          title="Excluir Membro"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}

                      {/* Menu ⋮ (Mais opções) */}
                      <div className="relative inline-block text-left">
                        <button
                          onClick={() => setActiveMenuId(isMenuOpen ? null : membro.id)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
                          title="Mais opções"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>

                        {isMenuOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-20"
                              onClick={() => setActiveMenuId(null)}
                            />
                            <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 text-left">
                              {/* Imprimir Cartão */}
                              {!isAuxiliar && (
                                <button
                                  disabled={!possuiFoto}
                                  onClick={async () => {
                                    setActiveMenuId(null);
                                    if (!possuiFoto) return;
                                    const templatesBase = await ensureTemplatesSnapshot();
                                    if (!hasActiveTemplate(membro.tipoCadastro, templatesBase)) {
                                      setNotification({
                                        isOpen: true,
                                        title: 'Template Ausente',
                                        message: getMensagemSemTemplate(membro.tipoCadastro),
                                        type: 'warning',
                                      });
                                      return;
                                    }
                                    setMembroImprimindoCartao(membro);
                                  }}
                                  className={`w-full px-3.5 py-2 text-xs font-semibold flex items-center gap-2 ${
                                    possuiFoto
                                      ? 'text-slate-700 hover:bg-purple-50 hover:text-purple-800 cursor-pointer'
                                      : 'text-slate-300 opacity-50 cursor-not-allowed'
                                  }`}
                                >
                                  <svg className="w-4 h-4 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                                  </svg>
                                  <span>{possuiFoto ? 'Imprimir Cartão' : 'Cartão (sem foto)'}</span>
                                </button>
                              )}

                              {/* Documentos */}
                              <button
                                onClick={() => {
                                  setActiveMenuId(null);
                                  void abrirDocumentosMembro(membro);
                                }}
                                className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-800 flex items-center gap-2 cursor-pointer"
                              >
                                <svg className="w-4 h-4 text-teal-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span>Documentos</span>
                              </button>

                              {/* Histórico do Ministro */}
                              {abrirHistoricoMembro && (
                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    abrirHistoricoMembro(membro);
                                  }}
                                  className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-800 flex items-center gap-2 cursor-pointer"
                                >
                                  <svg className="w-4 h-4 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                  </svg>
                                  <span>Histórico Completo</span>
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* RODAPÉ DA TABELA / PAGINAÇÃO */}
      <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Informações e Seletor de Itens */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs font-medium text-slate-600 text-center sm:text-left">
          <div>
            Exibindo <span className="font-bold text-slate-900">{membrosFiltradosCount > 0 ? startIndex + 1 : 0}</span> a{' '}
            <span className="font-bold text-slate-900">{Math.min(endIndex, membrosFiltradosCount)}</span> de{' '}
            <span className="font-bold text-slate-900">{membrosFiltradosCount}</span> registros
          </div>

          {setItemsPerPage && (
            <div className="flex items-center gap-1.5">
              <span>Exibir:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 cursor-pointer shadow-xs"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
              </select>
              <span>por página</span>
            </div>
          )}
        </div>

          {/* Navegação de Páginas */}
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            {/* Anterior */}
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-sm transition cursor-pointer font-bold"
              title="Página Anterior"
            >
              ‹
            </button>

            {/* Páginas com ellipsis */}
            {(() => {
              const pages: (number | string)[] = [];
              if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                pages.push(1);
                if (currentPage > 4) pages.push('...');
                const start = Math.max(2, currentPage - 2);
                const end = Math.min(totalPages - 1, currentPage + 2);
                for (let i = start; i <= end; i++) pages.push(i);
                if (currentPage < totalPages - 3) pages.push('...');
                pages.push(totalPages);
              }
              return pages.map((p, idx) =>
                p === '...' ? (
                  <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 text-xs select-none">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p as number)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                      currentPage === p
                        ? 'bg-teal-700 text-white shadow-sm border border-teal-800'
                        : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                )
              );
            })()}

            {/* Próximo */}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="w-8 h-8 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-sm transition cursor-pointer font-bold"
              title="Próxima Página"
            >
              ›
            </button>
          </div>
        </div>
      </div>
  );
}
