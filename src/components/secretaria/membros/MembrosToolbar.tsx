'use client';

import Link from 'next/link';

export interface MembrosToolbarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  cargoFilter: string;
  setCargoFilter: (cargo: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
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
  ultimoCadastro: any;
  gerarProximaMatricula: () => string;
  setDadosPessoais: (data: any) => void;
  setEnderecoData: (data: any) => void;
  setDadosMinisteriais: (data: any) => void;
  setCargoSelecionado: (cargo: string) => void;
  setDadosCargos: (cargos: any) => void;
  setIsEditando: (isEdit: boolean) => void;
  setShowForm: (show: boolean) => void;
  setActiveTab: (tab: string) => void;
  resolveCargoValue: (value?: string) => string;
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
  ultimoCadastro,
  gerarProximaMatricula,
  setDadosPessoais,
  setEnderecoData,
  setDadosMinisteriais,
  setCargoSelecionado,
  setDadosCargos,
  setIsEditando,
  setShowForm,
  setActiveTab,
  resolveCargoValue,
  gerarPDFListagem,
  membrosSelecionadosCount,
  setImprimindoLote,
  setNotification,
}: MembrosToolbarProps) {
  return (
    <>
      {/* Filtro de Busca */}
      <div className="bg-white rounded-lg p-4 shadow-md mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="w-full md:flex-1">
            <label className="block text-sm font-semibold text-teal-700 mb-2">Filtro de Busca</label>
            <input
              type="text"
              placeholder="DIGITE SUA BUSCA"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 border-2 border-teal-300 rounded-lg focus:outline-none focus:border-teal-500"
            />
          </div>
          <div className="w-full md:w-48">
            <label className="block text-sm font-semibold text-teal-700 mb-2">CARGO</label>
            <select
              value={cargoFilter}
              onChange={(e) => {
                setCargoFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 border-2 border-teal-300 rounded-lg bg-teal-50 focus:outline-none focus:border-teal-500"
            >
              <option value="TODOS">TODOS</option>
              {cargosMinisteriais.filter(c => c.ativo).map(c => (
                <option key={c.id} value={c.nome}>{c.nome.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-48">
            <label className="block text-sm font-semibold text-teal-700 mb-2">STATUS</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 border-2 border-teal-300 rounded-lg bg-teal-50 focus:outline-none focus:border-teal-500"
            >
              <option>ATIVO</option>
              <option>INATIVO</option>
              <option>TODOS</option>
            </select>
          </div>
          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('ATIVO');
              setCargoFilter('TODOS');
              setSortOrdemAlfabetica?.(false);
              setCurrentPage(1);
            }}
            className="w-full md:w-auto mt-0 md:mt-[26px] px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition font-semibold text-sm h-[42px]"
          >
            LIMPAR
          </button>
        </div>
      </div>

      {/* Header da Tabela & Botões de Ação */}
      <div className="bg-white rounded-t-lg shadow-md">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between p-4 border-b-2 border-teal-500">
          <div className="flex items-center gap-2">
            <span className="text-2xl">☰</span>
            <h2 className="text-lg font-bold text-teal-700">Listagem de Membros</h2>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
            <span className="text-sm text-gray-600">
              Quantidade de Membros:
              <span className="ml-2 px-2 py-0.5 bg-teal-100 text-teal-700 font-bold rounded-full text-sm">
                {membrosFiltradosCount}
              </span>
              {membrosFiltradosCount !== totalMembrosCount && (
                <span className="ml-1 text-xs text-gray-400">de {totalMembrosCount}</span>
              )}
            </span>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {!isSupervisor && (
                <>
                  <button
                    onClick={() => abrirCadastroPublico?.()}
                    className="px-4 py-2 bg-[#123b63] text-white hover:bg-[#0d2a47] rounded-lg transition font-semibold text-sm flex items-center gap-2 w-full sm:w-auto cursor-pointer shadow-sm"
                    title="Ver QR Code e link público do portal de cadastros de membros"
                  >
                    <span>📱</span>
                    <span>Cadastro Público</span>
                  </button>
                  <Link
                    href="/secretaria/membros/importar"
                    className="px-4 py-2 bg-teal-600 text-white hover:bg-teal-700 rounded-lg transition font-semibold text-sm flex items-center gap-2 w-full sm:w-auto cursor-pointer"
                  >
                    <span>📥</span>
                    <span>Importar CSV</span>
                  </Link>
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
                    className={`px-4 py-2 rounded-lg transition font-semibold text-sm flex items-center gap-2 w-full sm:w-auto ${
                      limiteMembrosAtingido
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                    title={limiteMembrosAtingido ? `Limite de ${maxMembros} cadastros atingido` : 'Novo Cadastro'}
                  >
                    <span>➕</span>
                    <span className="md:hidden">+ Membro</span>
                    <span className="hidden md:inline">Novo Cadastro</span>
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  if (ultimoCadastro) {
                    const novaMatricula = gerarProximaMatricula();
                    setDadosPessoais({
                      matricula: novaMatricula,
                      cpf: '',
                      tipoCadastro: 'ministro',
                      nome: '',
                      dataNascimento: ultimoCadastro.dataNascimento || '',
                      sexo: ultimoCadastro.sexo || 'MASCULINO',
                      tipoSanguineo: ultimoCadastro.tipoSanguineo || '',
                      escolaridade: ultimoCadastro.escolaridade || '',
                      estadoCivil: ultimoCadastro.estadoCivil || '',
                      nomeConjuge: '',
                      cpfConjuge: '',
                      dataNascimentoConjuge: '',
                      nomePai: ultimoCadastro.nomePai || '',
                      nomeMae: ultimoCadastro.nomeMae || '',
                      rg: '',
                      orgaoEmissor: ultimoCadastro.orgaoEmissor || '',
                      nacionalidade: ultimoCadastro.nacionalidade || 'BRASILEIRA',
                      naturalidade: ultimoCadastro.naturalidade || '',
                      uf: ultimoCadastro.uf || '',
                      supervisao: ultimoCadastro.supervisao || '',
                      campo: ultimoCadastro.campo || '',
                      congregacao: ultimoCadastro.congregacao || '',
                      email: '',
                      celular: '',
                      whatsapp: '',
                      profissao: ultimoCadastro.profissao || '',
                      tituloEleitoral: ultimoCadastro.tituloEleitoral || '',
                      zonaEleitoral: ultimoCadastro.zonaEleitoral || '',
                      secaoEleitoral: ultimoCadastro.secaoEleitoral || '',
                      observacoes: ultimoCadastro.observacoes || ''
                    });
                    setEnderecoData({
                      cep: ultimoCadastro.cep || '',
                      logradouro: ultimoCadastro.logradouro || '',
                      numero: ultimoCadastro.numero || '',
                      bairro: ultimoCadastro.bairro || '',
                      complemento: ultimoCadastro.complemento || '',
                      cidade: ultimoCadastro.cidade || '',
                      latitude: ultimoCadastro.latitude || '',
                      longitude: ultimoCadastro.longitude || ''
                    });
                    setDadosMinisteriais({
                      temFuncaoIgreja: ultimoCadastro.temFuncaoIgreja || false,
                      qualFuncao: ultimoCadastro.qualFuncao || '',
                      setorDepartamento: ultimoCadastro.setorDepartamento || '',
                      dataBatismoAguas: ultimoCadastro.dataBatismoAguas || '',
                      dataBatismoEspiritoSanto: ultimoCadastro.dataBatismoEspiritoSanto || '',
                      cursoTeologico: ultimoCadastro.cursoTeologico || '',
                      instituicaoTeologica: ultimoCadastro.instituicaoTeologica || '',
                      pastorAuxiliar: ultimoCadastro.pastorAuxiliar || false,
                      procedencia: ultimoCadastro.procedencia || '',
                      procedenciaLocal: ultimoCadastro.procedenciaLocal || '',
                      dataConsagracao: ultimoCadastro.dataConsagracao || '',
                      dataEmissao: ultimoCadastro.dataEmissao || '',
                      dataValidadeCredencial: ultimoCadastro.dataValidadeCredencial || '',
                      observacoesMinisteriais: ultimoCadastro.observacoesMinisteriais || ''
                    });
                    setCargoSelecionado(resolveCargoValue(ultimoCadastro.cargoMinisterial));
                    setDadosCargos(ultimoCadastro.dadosCargos || {});
                    setIsEditando(false);
                    setShowForm(true);
                    setActiveTab('dados');
                  }
                }}
                disabled={!ultimoCadastro}
                className={`px-4 py-2 rounded-lg transition font-semibold text-sm w-full sm:w-auto ${
                  ultimoCadastro
                    ? 'bg-blue-500 text-white hover:bg-blue-600 cursor-pointer'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                📋 Cadastrar Semelhante
              </button>
              <button
                onClick={gerarPDFListagem}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition font-semibold text-sm w-full sm:w-auto"
              >
                🖨️ IMPRIMIR
              </button>
              <button
                onClick={() => {
                  if (membrosSelecionadosCount === 0) {
                    setNotification({
                      isOpen: true,
                      title: 'Aviso',
                      message: 'Selecione pelo menos um membro para imprimir cartões',
                      type: 'warning'
                    });
                    return;
                  }
                  setImprimindoLote(true);
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold text-sm flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <span>🎫</span>
                <span>Cartões ({membrosSelecionadosCount})</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
