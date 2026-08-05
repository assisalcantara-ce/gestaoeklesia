'use client';

import React from 'react';

export interface MembroFormModalProps {
  showForm: boolean;
  setShowForm: (show: boolean) => void;
  membroEditando: any;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  dadosPessoais: any;
  setDadosPessoais: React.Dispatch<React.SetStateAction<any>>;
  enderecoData: any;
  setEnderecoData: React.Dispatch<React.SetStateAction<any>>;
  dadosMinisteriais: any;
  setDadosMinisteriais: React.Dispatch<React.SetStateAction<any>>;
  cargoSelecionado: string;
  setCargoSelecionado: (cargo: string) => void;
  dadosCargos: any;
  setDadosCargos: React.Dispatch<React.SetStateAction<any>>;
  nomenclaturas: { divisao1: string; divisao2: string; divisao3: string };
  supervisoesOptions: Array<{ id: string; nome: string }>;
  camposOptions: Array<{ id: string; nome: string }>;
  congregacoesOptions: Array<{ id: string; nome: string }>;
  cargosMinisteriais: Array<any>;
  buscarCep: () => Promise<void>;
  loadingCep: boolean;
  fotoMembro: string | null;
  setFotoMembro: (foto: string | null) => void;
  fileInputRef: any;
  handleFotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleGirarFoto: () => void;
  salvarMembro: () => Promise<void>;
  fecharFormulario: () => void;
  dizimosHistorico: any[];
  loadingDizimosHistorico: boolean;
  isDizimista: boolean;
  setIsDizimista: (val: boolean) => void;
}

export default function MembroFormModal({
  showForm,
  setShowForm,
  membroEditando,
  activeTab,
  setActiveTab,
  dadosPessoais,
  setDadosPessoais,
  enderecoData,
  setEnderecoData,
  dadosMinisteriais,
  setDadosMinisteriais,
  cargoSelecionado,
  setCargoSelecionado,
  dadosCargos,
  setDadosCargos,
  nomenclaturas,
  supervisoesOptions,
  camposOptions,
  congregacoesOptions,
  cargosMinisteriais,
  buscarCep,
  loadingCep,
  fotoMembro,
  setFotoMembro,
  fileInputRef,
  handleFotoUpload,
  handleGirarFoto,
  salvarMembro,
  fecharFormulario,
  dizimosHistorico,
  loadingDizimosHistorico,
  isDizimista,
  setIsDizimista,
}: MembroFormModalProps) {
  console.log('props recebidas', {
    supervisoesOptions,
    camposOptions,
    congregacoesOptions
  });

  if (!showForm) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col" style={{ height: '90vh' }}>
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-4 border-b-2 border-teal-500 bg-gradient-to-r from-teal-600 to-teal-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>{membroEditando ? '✏️' : '➕'}</span>
            {membroEditando ? `Editar Membro - ${membroEditando.nome}` : 'Inserir Novo Membro'}
          </h2>
          <button
            onClick={() => setShowForm(false)}
            className="text-white hover:text-gray-100 text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-gray-300 bg-white overflow-x-auto h-16 items-center flex-shrink-0">
          <button
            onClick={() => setActiveTab('dados')}
            className={`px-4 py-3 font-semibold transition whitespace-nowrap text-sm border-b-3 h-full flex items-center ${
              activeTab === 'dados'
                ? 'text-teal-700 border-teal-600'
                : 'text-gray-600 border-transparent hover:text-teal-600'
            }`}
          >
            📋 Dados
          </button>
          <button
            onClick={() => setActiveTab('endereco')}
            className={`px-4 py-3 font-semibold transition whitespace-nowrap text-sm border-b-3 h-full flex items-center ${
              activeTab === 'endereco'
                ? 'text-teal-700 border-teal-600'
                : 'text-gray-600 border-transparent hover:text-teal-600'
            }`}
          >
            🌍 Endereço + Contato
          </button>
          {dadosPessoais.tipoCadastro === 'ministro' && (
            <button
              onClick={() => setActiveTab('ministerial')}
              className={`px-4 py-3 font-semibold transition whitespace-nowrap text-sm border-b-3 h-full flex items-center ${
                activeTab === 'ministerial'
                  ? 'text-teal-700 border-teal-600'
                  : 'text-gray-600 border-transparent hover:text-teal-600'
              }`}
            >
              ⛪ Ministerial
            </button>
          )}
          <button
            onClick={() => setActiveTab('foto')}
            className={`px-4 py-3 font-semibold transition whitespace-nowrap text-sm border-b-3 h-full flex items-center ${
              activeTab === 'foto'
                ? 'text-teal-700 border-teal-600'
                : 'text-gray-600 border-transparent hover:text-teal-600'
            }`}
          >
            🖼️ Foto
          </button>
          <button
            onClick={() => setActiveTab('dizimos')}
            className={`px-4 py-3 font-semibold transition whitespace-nowrap text-sm border-b-3 h-full flex items-center ${
              activeTab === 'dizimos'
                ? 'text-teal-700 border-teal-600'
                : 'text-gray-600 border-transparent hover:text-teal-600'
            }`}
          >
            💰 Dízimos
          </button>
        </div>

        {/* Conteúdo das Abas */}
        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
          {/* ABA: DADOS CADASTRAIS */}
          {activeTab === 'dados' && (
            <div className="space-y-3">
              {/* Linha 0: Matrícula */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Matrícula</label>
                  <input
                    type="text"
                    placeholder="Automática"
                    value={dadosPessoais.matricula || ''}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Linha 1: CPF e Tipo de Cadastro */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    CPF * {membroEditando && <span className="ml-2 text-xs text-gray-500">(Bloqueado)</span>}
                  </label>
                  <input
                    type="text"
                    placeholder="Somente Números"
                    value={dadosPessoais.cpf || ''}
                    onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, cpf: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tipo de Cadastro *</label>
                  <select
                    value={dadosPessoais.tipoCadastro || 'membro'}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDadosPessoais((prev: any) => ({ ...prev, tipoCadastro: v }));
                      if (v !== 'ministro') {
                        setActiveTab((activeTab as string) === 'ministerial' ? 'dados' : activeTab);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="ministro">Ministro</option>
                    <option value="membro">Membro</option>
                    <option value="congregado">Congregado</option>
                  </select>
                </div>
              </div>

              {/* Nome */}
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">NOME *</label>
                  <input
                    type="text"
                    placeholder="Nome da Pessoa"
                    value={dadosPessoais.nome || ''}
                    onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, nome: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Data Nascimento, Sexo e Tipo Sanguíneo */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Data Nascimento *</label>
                  <input
                    type="date"
                    value={dadosPessoais.dataNascimento || ''}
                    onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, dataNascimento: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Sexo</label>
                  <select
                    value={dadosPessoais.sexo || 'MASCULINO'}
                    onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, sexo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option>MASCULINO</option>
                    <option>FEMININO</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tipo Sanguíneo</label>
                  <select
                    value={dadosPessoais.tipoSanguineo || ''}
                    onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, tipoSanguineo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="">- Escolha -</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>

              {/* Escolaridade e Estado Civil */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Escolaridade</label>
                  <select
                    value={dadosPessoais.escolaridade || ''}
                    onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, escolaridade: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="">- Escolha -</option>
                    <option value="sem_instrucao">Sem Instrução</option>
                    <option value="fundamental">Ensino Fundamental</option>
                    <option value="medio">Ensino Médio</option>
                    <option value="superior">Ensino Superior</option>
                    <option value="posgraduacao">Pós-Graduação</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Estado Civil</label>
                  <select
                    value={dadosPessoais.estadoCivil || ''}
                    onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, estadoCivil: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="">- Escolha -</option>
                    <option value="solteiro">{dadosPessoais.sexo === 'FEMININO' ? 'Solteira' : 'Solteiro'}</option>
                    <option value="casado">{dadosPessoais.sexo === 'FEMININO' ? 'Casada' : 'Casado'}</option>
                  </select>
                </div>
              </div>

              {/* Dados do Cônjuge - Aparecem apenas se casado */}
              {dadosPessoais.estadoCivil === 'casado' && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
                  <h4 className="text-xs font-semibold text-blue-800 mb-3">👥 Dados do Cônjuge</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Nome do Cônjuge</label>
                      <input
                        type="text"
                        placeholder="Nome"
                        value={dadosPessoais.nomeConjuge || ''}
                        onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, nomeConjuge: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">CPF do Cônjuge</label>
                      <input
                        type="text"
                        placeholder="Somente Números"
                        value={dadosPessoais.cpfConjuge || ''}
                        onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, cpfConjuge: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Data Nascimento do Cônjuge</label>
                      <input
                        type="date"
                        value={dadosPessoais.dataNascimentoConjuge || ''}
                        onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, dataNascimentoConjuge: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Pais e Filiação */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nome do Pai</label>
                  <input
                    type="text"
                    value={dadosPessoais.nomePai || ''}
                    onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, nomePai: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nome da Mãe</label>
                  <input
                    type="text"
                    value={dadosPessoais.nomeMae || ''}
                    onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, nomeMae: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Documentação */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">RG</label>
                  <input
                    type="text"
                    value={dadosPessoais.rg || ''}
                    onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, rg: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Órgão Emissor</label>
                  <input
                    type="text"
                    value={dadosPessoais.orgaoEmissor || ''}
                    onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, orgaoEmissor: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nacionalidade</label>
                  <select
                    value={dadosPessoais.nacionalidade || 'BRASILEIRA'}
                    onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, nacionalidade: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option>BRASILEIRA</option>
                    <option>ESTRANGEIRA</option>
                  </select>
                </div>
              </div>

              {/* Naturalidade e UF */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Naturalidade</label>
                  <input
                    type="text"
                    value={dadosPessoais.naturalidade || ''}
                    onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, naturalidade: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">UF</label>
                  <select
                    value={dadosPessoais.uf || ''}
                    onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, uf: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="">Selecionar</option>
                    <option value="AC">Acre</option>
                    <option value="AL">Alagoas</option>
                    <option value="AP">Amapá</option>
                    <option value="AM">Amazonas</option>
                    <option value="BA">Bahia</option>
                    <option value="CE">Ceará</option>
                    <option value="DF">Distrito Federal</option>
                    <option value="ES">Espírito Santo</option>
                    <option value="GO">Goiás</option>
                    <option value="MA">Maranhão</option>
                    <option value="MT">Mato Grosso</option>
                    <option value="MS">Mato Grosso do Sul</option>
                    <option value="MG">Minas Gerais</option>
                    <option value="PA">Pará</option>
                    <option value="PB">Paraíba</option>
                    <option value="PR">Paraná</option>
                    <option value="PE">Pernambuco</option>
                    <option value="PI">Piauí</option>
                    <option value="RJ">Rio de Janeiro</option>
                    <option value="RN">Rio Grande do Norte</option>
                    <option value="RS">Rio Grande do Sul</option>
                    <option value="RO">Rondônia</option>
                    <option value="RR">Roraima</option>
                    <option value="SC">Santa Catarina</option>
                    <option value="SP">São Paulo</option>
                    <option value="SE">Sergipe</option>
                    <option value="TO">Tocantins</option>
                  </select>
                </div>
              </div>

              {/* Batismo */}
              <div className={`bg-teal-50 border border-teal-200 p-3 rounded-md ${dadosPessoais.tipoCadastro === 'congregado' ? 'opacity-50' : ''}`}>
                <h4 className="text-xs font-semibold text-teal-800 mb-3">⛪ Dados Eclesiásticos</h4>
                {dadosPessoais.tipoCadastro === 'congregado' && (
                  <p className="text-xs text-teal-700 mb-2 italic">Não disponível para Congregado.</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Data de Batismo nas Águas</label>
                    <input
                      type="date"
                      value={dadosMinisteriais.dataBatismoAguas || ''}
                      onChange={(e) => setDadosMinisteriais((prev: any) => ({ ...prev, dataBatismoAguas: e.target.value }))}
                      disabled={dadosPessoais.tipoCadastro === 'congregado'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:cursor-not-allowed disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Data de Batismo no Espírito Santo</label>
                    <input
                      type="date"
                      value={dadosMinisteriais.dataBatismoEspiritoSanto || ''}
                      onChange={(e) => setDadosMinisteriais((prev: any) => ({ ...prev, dataBatismoEspiritoSanto: e.target.value }))}
                      disabled={dadosPessoais.tipoCadastro === 'congregado'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:cursor-not-allowed disabled:bg-gray-100"
                    />
                  </div>
                </div>
              </div>

              {/* Profissão e Título Eleitoral */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Profissão</label>
                  <input
                    type="text"
                    value={dadosPessoais.profissao || ''}
                    onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, profissao: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Título Eleitoral</label>
                  <input
                    type="text"
                    value={dadosPessoais.tituloEleitoral || ''}
                    onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, tituloEleitoral: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Zona</label>
                  <input
                    type="text"
                    value={dadosPessoais.zonaEleitoral || ''}
                    onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, zonaEleitoral: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Seção</label>
                  <input
                    type="text"
                    value={dadosPessoais.secaoEleitoral || ''}
                    onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, secaoEleitoral: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Organização Eclesiástica */}
              {((nomenclaturas?.divisao1 && nomenclaturas.divisao1 !== 'NENHUMA') ||
                (nomenclaturas?.divisao2 && nomenclaturas.divisao2 !== 'NENHUMA') ||
                (nomenclaturas?.divisao3 && nomenclaturas.divisao3 !== 'NENHUMA')) && (
                <div className="bg-sky-50 border border-sky-200 p-3 rounded-md mt-3">
                  <h4 className="text-xs font-semibold text-sky-800 mb-3">🏢 Organização Eclesiástica</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {nomenclaturas?.divisao1 && nomenclaturas.divisao1 !== 'NENHUMA' && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">{nomenclaturas.divisao1} (1ª Divisão)</label>
                        <select
                          value={dadosPessoais.supervisao || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            const congregacaoSelecionada = supervisoesOptions.find((opt) => opt.nome === value) || null;
                            const setorRelacionado = (congregacaoSelecionada as any)?.campo_id
                              ? camposOptions.find((opt) => opt.id === (congregacaoSelecionada as any).campo_id) || null
                              : null;
                            const regionalRelacionado = (setorRelacionado as any)?.supervisao_id
                              ? congregacoesOptions.find((opt) => opt.id === (setorRelacionado as any).supervisao_id) || null
                              : ((congregacaoSelecionada as any)?.supervisao_id
                                  ? congregacoesOptions.find((opt) => opt.id === (congregacaoSelecionada as any).supervisao_id) || null
                                  : null);

                            setDadosPessoais((prev: any) => ({
                              ...prev,
                              supervisao: value,
                              campo: setorRelacionado?.nome || prev.campo || '',
                              congregacao: regionalRelacionado?.nome || prev.congregacao || '',
                            }));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        >
                          <option value="">Selecione</option>
                          {(() => {
                            console.log('1ª divisão renderizando', supervisoesOptions);
                            return null;
                          })()}
                          {supervisoesOptions.map((opt) => (
                            <option key={opt.id} value={opt.nome}>{opt.nome}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {nomenclaturas?.divisao2 && nomenclaturas.divisao2 !== 'NENHUMA' && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">{nomenclaturas.divisao2} (2ª Divisão)</label>
                        <select
                          value={dadosPessoais.campo || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            const setorSelecionado = camposOptions.find((opt) => opt.nome === value) || null;
                            const regionalRelacionado = (setorSelecionado as any)?.supervisao_id
                              ? congregacoesOptions.find((opt) => opt.id === (setorSelecionado as any).supervisao_id) || null
                              : null;

                            setDadosPessoais((prev: any) => ({
                              ...prev,
                              campo: value,
                              congregacao: regionalRelacionado?.nome || prev.congregacao || '',
                            }));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        >
                          <option value="">Selecione</option>
                          {camposOptions.map((opt) => (
                            <option key={opt.id} value={opt.nome}>{opt.nome}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {nomenclaturas?.divisao3 && nomenclaturas.divisao3 !== 'NENHUMA' && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">{nomenclaturas.divisao3} (3ª Divisão)</label>
                        <select
                          value={dadosPessoais.congregacao || ''}
                          onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, congregacao: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        >
                          <option value="">Selecione</option>
                          {congregacoesOptions.map((opt) => (
                            <option key={opt.id} value={opt.nome}>{opt.nome}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Observações</label>
                <input
                  type="text"
                  value={dadosPessoais.observacoes || ''}
                  onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, observacoes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* ABA: ENDEREÇO + CONTATO */}
          {activeTab === 'endereco' && (
            <div className="space-y-3">
              <div className="border-b pb-3">
                <h3 className="text-sm font-bold text-teal-700 mb-3">📍 Endereço</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">CEP</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={enderecoData.cep || ''}
                        onChange={(e) => setEnderecoData((prev: any) => ({ ...prev, cep: e.target.value }))}
                        placeholder="00000-000"
                        className="w-32 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={buscarCep}
                        disabled={loadingCep}
                        className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 font-semibold text-sm transition whitespace-nowrap"
                      >
                        {loadingCep ? '...' : '🔍 Buscar'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Logradouro</label>
                      <input
                        type="text"
                        value={enderecoData.logradouro || ''}
                        onChange={(e) => setEnderecoData((prev: any) => ({ ...prev, logradouro: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Número</label>
                      <input
                        type="text"
                        value={enderecoData.numero || ''}
                        onChange={(e) => setEnderecoData((prev: any) => ({ ...prev, numero: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Bairro</label>
                    <input
                      type="text"
                      value={enderecoData.bairro || ''}
                      onChange={(e) => setEnderecoData((prev: any) => ({ ...prev, bairro: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Complemento</label>
                    <input
                      type="text"
                      value={enderecoData.complemento || ''}
                      onChange={(e) => setEnderecoData((prev: any) => ({ ...prev, complemento: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Cidade</label>
                    <input
                      type="text"
                      value={enderecoData.cidade || ''}
                      onChange={(e) => setEnderecoData((prev: any) => ({ ...prev, cidade: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Geolocalização (Automática) */}
                <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                  <label className="block text-xs font-semibold text-gray-700 mb-2">📍 Geolocalização (Automática)</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Latitude</label>
                      <input
                        type="text"
                        value={enderecoData.latitude || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Longitude</label>
                      <input
                        type="text"
                        value={enderecoData.longitude || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">Os dados de latitude e longitude serão preenchidos automaticamente ao buscar o CEP.</p>
                </div>
              </div>

              {/* Seção: CONTATO */}
              <div>
                <h3 className="text-sm font-bold text-teal-700 mb-3">📱 Contato</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">EMAIL</label>
                    <input
                      type="email"
                      value={dadosPessoais.email || ''}
                      onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">CELULAR</label>
                    <input
                      type="text"
                      placeholder="(00) 00000-0000"
                      value={dadosPessoais.celular || ''}
                      onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, celular: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">WHATSAPP</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="(00) 00000-0000"
                        value={dadosPessoais.whatsapp || ''}
                        onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, whatsapp: e.target.value }))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (dadosPessoais.whatsapp) {
                            const num = dadosPessoais.whatsapp.replace(/\D/g, '');
                            window.open(`https://wa.me/55${num}`, '_blank');
                          }
                        }}
                        className="bg-green-600 text-white px-3 rounded-md hover:bg-green-700 font-semibold text-sm"
                      >
                        💬
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ABA: MINISTERIAL */}
          {activeTab === 'ministerial' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Curso Teológico</label>
                  <select
                    value={dadosMinisteriais.cursoTeologico || ''}
                    onChange={(e) => setDadosMinisteriais((prev: any) => ({ ...prev, cursoTeologico: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="">NÃO TEM</option>
                    <option value="basico">Básico</option>
                    <option value="medio">Médio</option>
                    <option value="bacharel">Bacharel</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Instituição</label>
                  <input
                    type="text"
                    value={dadosMinisteriais.instituicaoTeologica || ''}
                    onChange={(e) => setDadosMinisteriais((prev: any) => ({ ...prev, instituicaoTeologica: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Pastor Auxiliar?</label>
                  <input
                    type="checkbox"
                    checked={!!dadosMinisteriais.pastorAuxiliar}
                    onChange={(e) => setDadosMinisteriais((prev: any) => ({ ...prev, pastorAuxiliar: e.target.checked }))}
                    className="w-5 h-5 mt-2 cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Procedência</label>
                  <select
                    value={dadosMinisteriais.procedencia || ''}
                    onChange={(e) => setDadosMinisteriais((prev: any) => ({ ...prev, procedencia: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="">- Definir -</option>
                    <option value="aclamacao">Aclamação</option>
                    <option value="batismo">Batismo</option>
                    <option value="carta">Carta</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Procedência Local</label>
                  <input
                    type="text"
                    value={dadosMinisteriais.procedenciaLocal || ''}
                    onChange={(e) => setDadosMinisteriais((prev: any) => ({ ...prev, procedenciaLocal: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Cargo Ministerial</label>
                  <select
                    value={cargoSelecionado || ''}
                    onChange={(e) => setCargoSelecionado(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="">- Selecionar -</option>
                    {cargosMinisteriais
                      ?.filter((cargo: any) => cargo.ativo)
                      .map((cargo: any) => (
                        <option key={cargo.id} value={cargo.nome}>
                          {cargo.nome}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Data Batismo Esp. Santo</label>
                  <input
                    type="date"
                    value={dadosMinisteriais.dataBatismoEspiritoSanto || ''}
                    onChange={(e) => setDadosMinisteriais((prev: any) => ({ ...prev, dataBatismoEspiritoSanto: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Data Batismo Águas</label>
                  <input
                    type="date"
                    value={dadosMinisteriais.dataBatismoAguas || ''}
                    onChange={(e) => setDadosMinisteriais((prev: any) => ({ ...prev, dataBatismoAguas: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Bloco de Consagração/Recebimento */}
              {cargoSelecionado && (
                <div className="p-4 border border-teal-200 rounded-lg bg-teal-50">
                  <h3 className="text-sm font-bold text-teal-900 mb-3">Consagração / Recebimento - {cargoSelecionado}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Data da Consagração ou Recebimento</label>
                      <input
                        type="date"
                        value={dadosCargos?.[cargoSelecionado]?.dataConsagracaoRecebimento || ''}
                        onChange={(e) =>
                          setDadosCargos((prev: any) => ({
                            ...prev,
                            [cargoSelecionado]: {
                              ...prev?.[cargoSelecionado],
                              dataConsagracaoRecebimento: e.target.value,
                            },
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Local de Consagração</label>
                      <input
                        type="text"
                        placeholder="Ex: Templo Central"
                        value={dadosCargos?.[cargoSelecionado]?.localConsagracao || ''}
                        onChange={(e) =>
                          setDadosCargos((prev: any) => ({
                            ...prev,
                            [cargoSelecionado]: {
                              ...prev?.[cargoSelecionado],
                              localConsagracao: e.target.value,
                            },
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Local de Origem</label>
                      <input
                        type="text"
                        placeholder="Ex: Igreja Original, Pastor Referência"
                        value={dadosCargos?.[cargoSelecionado]?.localOrigem || ''}
                        onChange={(e) =>
                          setDadosCargos((prev: any) => ({
                            ...prev,
                            [cargoSelecionado]: {
                              ...prev?.[cargoSelecionado],
                              localOrigem: e.target.value,
                            },
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!dadosMinisteriais.temFuncaoIgreja}
                      onChange={(e) => setDadosMinisteriais((prev: any) => ({ ...prev, temFuncaoIgreja: e.target.checked }))}
                      className="w-5 h-5 cursor-pointer"
                    />
                    <label className="text-sm font-semibold text-gray-700">Função na Igreja?</label>
                  </div>
                </div>

                <div
                  className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-lg"
                  style={{
                    backgroundColor: dadosMinisteriais.temFuncaoIgreja ? '#f0f9ff' : '#f9fafb',
                    borderColor: dadosMinisteriais.temFuncaoIgreja ? '#bfdbfe' : '#e5e7eb',
                    borderWidth: '1px',
                  }}
                >
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Qual Função?</label>
                    <input
                      type="text"
                      placeholder="Ex: Líder de Louvor, Coordenador"
                      value={dadosMinisteriais.qualFuncao || ''}
                      onChange={(e) => setDadosMinisteriais((prev: any) => ({ ...prev, qualFuncao: e.target.value }))}
                      disabled={!dadosMinisteriais.temFuncaoIgreja}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Setor ou Departamento</label>
                    <input
                      type="text"
                      placeholder="Ex: Ministério de Louvor"
                      value={dadosMinisteriais.setorDepartamento || ''}
                      onChange={(e) => setDadosMinisteriais((prev: any) => ({ ...prev, setorDepartamento: e.target.value }))}
                      disabled={!dadosMinisteriais.temFuncaoIgreja}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Observações</label>
                <textarea
                  rows={2}
                  value={dadosMinisteriais.observacoesMinisteriais || ''}
                  onChange={(e) => setDadosMinisteriais((prev: any) => ({ ...prev, observacoesMinisteriais: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* ABA: FOTO */}
          {activeTab === 'foto' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50 relative overflow-hidden flex flex-col items-center justify-center min-h-[300px]">
                {fotoMembro ? (
                  <div className="relative group">
                    <img
                      src={fotoMembro}
                      alt="Foto do Membro"
                      className="max-h-64 rounded-md shadow-md border-2 border-teal-500 transition-opacity group-hover:opacity-50"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-teal-600 text-white p-2 rounded-full shadow-lg"
                        title="Alterar Foto"
                      >
                        ✏️
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-4xl mb-3">📸</div>
                    <h3 className="text-base font-semibold text-gray-800 mb-1">Foto do Membro</h3>
                    <p className="text-xs text-gray-600 mb-3">Clique para fazer upload</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 font-semibold text-sm flex items-center gap-2"
                    >
                      📁 Escolher Foto
                    </button>
                  </>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFotoUpload}
                  accept="image/*"
                  className="hidden"
                />
              </div>

              {fotoMembro && (
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleGirarFoto}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 font-semibold text-sm flex items-center gap-2"
                  >
                    🔄 Girar
                  </button>
                  <button
                    onClick={() => setFotoMembro(null)}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-semibold text-sm flex items-center gap-2"
                  >
                    🗑️ Remover
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ABA: DÍZIMOS */}
          {activeTab === 'dizimos' && (
            <div className="space-y-4">
              {/* Checkbox Marcar como dizimista */}
              <div className="flex items-start gap-3 p-3.5 border border-teal-200 rounded-lg bg-teal-50/50">
                <input
                  type="checkbox"
                  id="chkIsDizimista"
                  checked={!!isDizimista}
                  onChange={(e) => setIsDizimista(e.target.checked)}
                  className="w-5 h-5 mt-0.5 text-teal-600 rounded border-gray-300 focus:ring-teal-500 cursor-pointer"
                />
                <div>
                  <label htmlFor="chkIsDizimista" className="text-sm font-bold text-gray-800 cursor-pointer">
                    Marcar como dizimista?
                  </label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Ao marcar este membro como dizimista, ele será gerenciado no painel de adimplência/inadimplência na aba <strong>Tesouraria → Dizimistas</strong>.
                  </p>
                </div>
              </div>

              {!membroEditando ? (
                <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                  <p className="text-sm">Salve o membro primeiro para visualizar o histórico de dízimos.</p>
                </div>
              ) : (
                <>
                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm text-teal-800">
                    <p>
                      Para registrar pagamentos, use a aba <strong>Tesouraria → Dizimistas</strong>.
                    </p>
                    <p className="mt-1 text-teal-600">Aqui você vê o histórico deste membro.</p>
                  </div>
                  {loadingDizimosHistorico ? (
                    <div className="text-center py-6 text-gray-400 text-sm">Carregando...</div>
                  ) : !dizimosHistorico || dizimosHistorico.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-sm">Nenhum registro de dízimo encontrado.</div>
                  ) : (
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="text-left p-2 text-xs font-semibold text-gray-700 border-b">Mês/Ano</th>
                          <th className="text-left p-2 text-xs font-semibold text-gray-700 border-b">Status</th>
                          <th className="text-left p-2 text-xs font-semibold text-gray-700 border-b">Valor</th>
                          <th className="text-left p-2 text-xs font-semibold text-gray-700 border-b">Pagamento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dizimosHistorico.map((h: any) => (
                          <tr key={h.mes_referencia} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="p-2 text-gray-800">{h.mes_referencia.split('-').reverse().join('/')}</td>
                            <td className="p-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  h.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                }`}
                              >
                                {h.status === 'pago' ? 'Pago' : 'Pendente'}
                              </span>
                            </td>
                            <td className="p-2 text-gray-700">
                              {h.valor != null ? `R$ ${Number(h.valor).toFixed(2).replace('.', ',')}` : '—'}
                            </td>
                            <td className="p-2 text-gray-700">
                              {h.data_pagamento ? h.data_pagamento.split('-').reverse().join('/') : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex gap-4 px-4 py-3 border-t border-gray-300 bg-gradient-to-r from-teal-50 to-cyan-50 flex-shrink-0">
          <button
            onClick={salvarMembro}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-lg hover:from-teal-700 hover:to-teal-800 transition font-bold text-sm"
          >
            ✓ {membroEditando ? 'Atualizar' : 'Cadastrar'}
          </button>
          <button
            onClick={fecharFormulario}
            className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-bold text-sm"
          >
            ✕ Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

