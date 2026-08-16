'use client';

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
  startIndex: number;
  endIndex: number;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  totalPages: number;
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
  startIndex,
  endIndex,
  currentPage,
  setCurrentPage,
  totalPages,
}: MembrosTableProps) {
  return (
    <>
      {/* CARDS MOBILE — visíveis apenas em telas < md */}
      <div className="md:hidden space-y-3 px-4 pt-3 pb-2 max-w-full">
        {membrosPaginados.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">Nenhum membro encontrado.</div>
        )}
        {membrosPaginados.map((membro) => (
          <div key={membro.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-12 h-14 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center border border-gray-200 flex-shrink-0">
                {membro.fotoUrl ? (
                  <img src={membro.fotoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl text-gray-400">👤</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 text-sm break-words">{membro.nome}</p>
                <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                  <p>
                    Matrícula: <span className="font-semibold">{membro.matricula}</span>
                  </p>
                  <p>CPF: {maskCpf(membro.cpf)}</p>
                </div>
              </div>
              <span
                className={`px-2 py-1 rounded-full text-xs font-bold self-start flex-shrink-0 ${
                  membro.status === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}
              >
                {membro.status.toUpperCase()}
              </span>
            </div>
            <div className="mt-3 space-y-1 text-xs text-gray-600 break-words">
              <p>
                <span className="font-semibold">Congregação:</span> {membro.congregacao || '-'}
              </p>
              <p>
                <span className="font-semibold">Cargo/Função:</span> {membro.cargoMinisterial || '-'}
              </p>
            </div>
            <div className="mt-3 flex gap-2 flex-wrap">
              <button
                onClick={() => setMembroImprimindo(membro)}
                className="flex-1 min-w-[70px] px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200 transition"
              >
                Ver
              </button>
              {!isSupervisor && (
                <button
                  onClick={() => abrirEdicao(membro)}
                  className="flex-1 min-w-[70px] px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-100 transition"
                >
                  Editar
                </button>
              )}
              <button
                onClick={() => {
                  void abrirDocumentosMembro(membro);
                }}
                className="flex-1 min-w-[90px] px-3 py-2 bg-purple-50 text-purple-700 rounded-lg text-xs font-semibold hover:bg-purple-100 transition"
              >
                Documentos
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* TABELA DESKTOP — visível apenas em md+ */}
      <div className="hidden md:block px-4 pt-3 pb-2">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border-2 border-gray-300 px-4 py-3 text-center font-semibold text-gray-700 w-12">
                  <input
                    type="checkbox"
                    checked={membrosSelecionados.size === membrosPaginados.length && membrosPaginados.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const novoSet = new Set(membrosSelecionados);
                        membrosPaginados.forEach((m) => novoSet.add(m.id));
                        setMembrosSelecionados(novoSet);
                      } else {
                        const novoSet = new Set(membrosSelecionados);
                        membrosPaginados.forEach((m) => novoSet.delete(m.id));
                        setMembrosSelecionados(novoSet);
                      }
                    }}
                    className="w-4 h-4 cursor-pointer"
                  />
                </th>
                <th className="border-2 border-gray-300 px-4 py-3 text-left font-semibold text-gray-700 w-20">
                  Matrícula
                </th>
                <th className="border-2 border-gray-300 px-4 py-3 text-center font-semibold text-gray-700 w-12">
                  Foto
                </th>
                <th className="border-2 border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">
                  <div className="flex items-center justify-between gap-2">
                    <span>Nome</span>
                    <label
                      className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-normal text-teal-700 bg-teal-50 hover:bg-teal-100 px-2 py-1 rounded border border-teal-300 transition"
                      title="Classificar por Ordem Alfabética (A-Z)"
                    >
                      <input
                        type="checkbox"
                        checked={sortOrdemAlfabetica}
                        onChange={(e) => {
                          setSortOrdemAlfabetica?.(e.target.checked);
                          setCurrentPage(1);
                        }}
                        className="w-3.5 h-3.5 text-teal-600 rounded border-teal-400 focus:ring-teal-500 cursor-pointer"
                      />
                      <span>A-Z</span>
                    </label>
                  </div>
                </th>
                <th className="border-2 border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">CPF</th>
                <th className="border-2 border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">Cargo</th>
                <th className="border-2 border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">
                  Data Consagração
                </th>
                <th className="border-2 border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                <th className="border-2 border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">
                  Controles
                </th>
              </tr>
            </thead>
            <tbody>
              {membrosPaginados.map((membro) => (
                <tr key={membro.id} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={membrosSelecionados.has(membro.id)}
                      onChange={(e) => {
                        const novoSet = new Set(membrosSelecionados);
                        if (e.target.checked) {
                          novoSet.add(membro.id);
                        } else {
                          novoSet.delete(membro.id);
                        }
                        setMembrosSelecionados(novoSet);
                      }}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </td>
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-700">{membro.matricula}</td>
                  <td className="border border-gray-300 px-4 py-3 text-center">
                    <div className="w-10 h-12 bg-gray-100 rounded overflow-hidden flex items-center justify-center mx-auto border border-gray-200">
                      {membro.fotoUrl ? (
                        <img src={membro.fotoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl text-gray-400">👤</span>
                      )}
                    </div>
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-gray-700">{membro.nome}</td>
                  <td className="border border-gray-300 px-4 py-3 text-gray-600">{membro.cpf}</td>
                  <td className="border border-gray-300 px-4 py-3 text-gray-600">{membro.cargoMinisterial || ''}</td>
                  <td className="border border-gray-300 px-4 py-3 text-gray-600">
                    {membro.dataConsagracao
                      ? new Date(membro.dataConsagracao + 'T00:00:00').toLocaleDateString('pt-BR')
                      : '-'}
                  </td>
                  <td className="border border-gray-300 px-4 py-3">
                    <span
                      className={`px-3 py-1 rounded text-sm font-semibold ${
                        membro.status === 'ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {membro.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="border border-gray-300 px-4 py-3">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => setMembroImprimindo(membro)}
                        className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition"
                        title="Imprimir Ficha"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                          />
                        </svg>
                      </button>
                      {!isAuxiliar && (
                        <button
                          onClick={async () => {
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
                          className="p-2 text-purple-600 hover:bg-purple-100 rounded-lg transition"
                          title="Imprimir Cartão"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                            />
                          </svg>
                        </button>
                      )}
                      {!isSupervisor && (
                        <button
                          onClick={() => abrirEdicao(membro)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                          title="Editar"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                      )}
                      {!isSupervisor && !isAuxiliar && (
                        <button
                          onClick={() => abrirConfirmacaoDeletar(membro)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition"
                          title="Deletar"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rodapé da Tabela */}
      <div className="bg-white rounded-b-lg shadow-md p-4 border-t border-gray-300">
        <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-center">
          <div className="text-sm text-gray-600 text-center md:text-left">
            Mostrando {startIndex + 1} até {Math.min(endIndex, membrosFiltradosCount)} de {membrosFiltradosCount} registros
          </div>
          <div className="flex items-center justify-center gap-1 flex-wrap">
            {/* Anterior */}
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
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
                  <span key={`ellipsis-${idx}`} className="px-2 py-1 text-gray-400 select-none">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p as number)}
                    className={`px-3 py-1 rounded ${
                      currentPage === p ? 'bg-teal-600 text-white font-bold' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ›
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
