'use client';

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
  dadosCargos: _dadosCargos,
  setDadosCargos: _setDadosCargos,
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
}: MembroFormModalProps) {
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
          <button onClick={() => setShowForm(false)} className="text-white hover:text-gray-100 text-2xl">
            ✕
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-gray-300 bg-white overflow-x-auto h-16 items-center flex-shrink-0">
          <button
            onClick={() => setActiveTab('dados')}
            className={`px-4 py-3 font-semibold transition whitespace-nowrap text-sm border-b-3 h-full flex items-center ${
              activeTab === 'dados' ? 'text-teal-700 border-teal-600' : 'text-gray-600 border-transparent hover:text-teal-600'
            }`}
          >
            📋 Dados
          </button>
          <button
            onClick={() => setActiveTab('endereco')}
            className={`px-4 py-3 font-semibold transition whitespace-nowrap text-sm border-b-3 h-full flex items-center ${
              activeTab === 'endereco' ? 'text-teal-700 border-teal-600' : 'text-gray-600 border-transparent hover:text-teal-600'
            }`}
          >
            🌍 Endereço + Contato
          </button>
          {dadosPessoais.tipoCadastro === 'ministro' && (
            <button
              onClick={() => setActiveTab('ministerial')}
              className={`px-4 py-3 font-semibold transition whitespace-nowrap text-sm border-b-3 h-full flex items-center ${
                activeTab === 'ministerial' ? 'text-teal-700 border-teal-600' : 'text-gray-600 border-transparent hover:text-teal-600'
              }`}
            >
              ⛪ Ministerial
            </button>
          )}
          <button
            onClick={() => setActiveTab('foto')}
            className={`px-4 py-3 font-semibold transition whitespace-nowrap text-sm border-b-3 h-full flex items-center ${
              activeTab === 'foto' ? 'text-teal-700 border-teal-600' : 'text-gray-600 border-transparent hover:text-teal-600'
            }`}
          >
            🖼️ Foto
          </button>
          <button
            onClick={() => setActiveTab('dizimos')}
            className={`px-4 py-3 font-semibold transition whitespace-nowrap text-sm border-b-3 h-full flex items-center ${
              activeTab === 'dizimos' ? 'text-teal-700 border-teal-600' : 'text-gray-600 border-transparent hover:text-teal-600'
            }`}
          >
            💰 Dízimos
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ABA: DADOS PESSOAIS */}
          {activeTab === 'dados' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Matrícula</label>
                  <input
                    type="text"
                    value={dadosPessoais.matricula}
                    disabled
                    className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md font-semibold text-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Nome Completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={dadosPessoais.nome}
                    onChange={(e) => setDadosPessoais((p: any) => ({ ...p, nome: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">CPF</label>
                  <input
                    type="text"
                    value={dadosPessoais.cpf}
                    onChange={(e) => setDadosPessoais((p: any) => ({ ...p, cpf: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Data de Nascimento</label>
                  <input
                    type="date"
                    value={dadosPessoais.dataNascimento}
                    onChange={(e) => setDadosPessoais((p: any) => ({ ...p, dataNascimento: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Sexo</label>
                  <select
                    value={dadosPessoais.sexo}
                    onChange={(e) => setDadosPessoais((p: any) => ({ ...p, sexo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-teal-500 bg-white"
                  >
                    <option value="MASCULINO">MASCULINO</option>
                    <option value="FEMININO">FEMININO</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Estado Civil</label>
                  <select
                    value={dadosPessoais.estadoCivil}
                    onChange={(e) => setDadosPessoais((p: any) => ({ ...p, estadoCivil: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-teal-500 bg-white"
                  >
                    <option value="">Selecione...</option>
                    <option value="SOLTEIRO(A)">SOLTEIRO(A)</option>
                    <option value="CASADO(A)">CASADO(A)</option>
                    <option value="DIVORCIADO(A)">DIVORCIADO(A)</option>
                    <option value="VIÚVO(A)">VIÚVO(A)</option>
                    <option value="UNIÃO ESTÁVEL">UNIÃO ESTÁVEL</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{nomenclaturas.divisao1}</label>
                  <select
                    value={dadosPessoais.supervisao}
                    onChange={(e) => setDadosPessoais((p: any) => ({ ...p, supervisao: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-teal-500 bg-white"
                  >
                    <option value="">Selecione...</option>
                    {supervisoesOptions.map((s) => (
                      <option key={s.id} value={s.nome}>
                        {s.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{nomenclaturas.divisao2}</label>
                  <select
                    value={dadosPessoais.campo}
                    onChange={(e) => setDadosPessoais((p: any) => ({ ...p, campo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-teal-500 bg-white"
                  >
                    <option value="">Selecione...</option>
                    {camposOptions.map((c) => (
                      <option key={c.id} value={c.nome}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Congregação</label>
                  <select
                    value={dadosPessoais.congregacao}
                    onChange={(e) => setDadosPessoais((p: any) => ({ ...p, congregacao: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-teal-500 bg-white"
                  >
                    <option value="">Selecione...</option>
                    {congregacoesOptions.map((g) => (
                      <option key={g.id} value={g.nome}>
                        {g.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ABA: ENDEREÇO & CONTATO */}
          {activeTab === 'endereco' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">CEP</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={enderecoData.cep}
                      onChange={(e) => setEnderecoData((p: any) => ({ ...p, cep: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-teal-500"
                    />
                    <button
                      onClick={buscarCep}
                      disabled={loadingCep}
                      className="px-3 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 font-semibold text-sm"
                    >
                      {loadingCep ? '...' : 'Buscar'}
                    </button>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Logradouro / Rua</label>
                  <input
                    type="text"
                    value={enderecoData.logradouro}
                    onChange={(e) => setEnderecoData((p: any) => ({ ...p, logradouro: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Número</label>
                  <input
                    type="text"
                    value={enderecoData.numero}
                    onChange={(e) => setEnderecoData((p: any) => ({ ...p, numero: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Bairro</label>
                  <input
                    type="text"
                    value={enderecoData.bairro}
                    onChange={(e) => setEnderecoData((p: any) => ({ ...p, bairro: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Cidade</label>
                  <input
                    type="text"
                    value={enderecoData.cidade}
                    onChange={(e) => setEnderecoData((p: any) => ({ ...p, cidade: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Celular / Telefone</label>
                  <input
                    type="text"
                    value={dadosPessoais.celular}
                    onChange={(e) => setDadosPessoais((p: any) => ({ ...p, celular: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={dadosPessoais.email}
                    onChange={(e) => setDadosPessoais((p: any) => ({ ...p, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ABA: MINISTERIAL */}
          {activeTab === 'ministerial' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Cargo Ministerial</label>
                  <select
                    value={cargoSelecionado}
                    onChange={(e) => setCargoSelecionado(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-teal-500 bg-white"
                  >
                    <option value="">Selecione...</option>
                    {cargosMinisteriais
                      .filter((c) => c.ativo)
                      .map((c) => (
                        <option key={c.id} value={c.nome}>
                          {c.nome.toUpperCase()}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Data de Batismo nas Águas</label>
                  <input
                    type="date"
                    value={dadosMinisteriais.dataBatismoAguas}
                    onChange={(e) => setDadosMinisteriais((p: any) => ({ ...p, dataBatismoAguas: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ABA: FOTO */}
          {activeTab === 'foto' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                {fotoMembro ? (
                  <div className="space-y-3">
                    <div className="w-32 h-40 mx-auto overflow-hidden rounded-lg border border-gray-300">
                      <img src={fotoMembro} alt="Foto Membro" className="w-full h-full object-cover" />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-4xl mb-3">📸</div>
                    <h3 className="text-base font-semibold text-gray-800 mb-1">Foto do Membro</h3>
                    <p className="text-xs text-gray-600 mb-3">Clique para fazer upload</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 font-semibold text-sm inline-flex items-center gap-2"
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
              {!membroEditando ? (
                <div className="text-center py-8 text-gray-500">
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
                  ) : dizimosHistorico.length === 0 ? (
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
                        {dizimosHistorico.map((h) => (
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
