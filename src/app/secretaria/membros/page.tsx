'use client';
import NotificationModal from '@/components/NotificationModal';
import MembrosOverview from '@/components/MembrosOverview';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import ConfirmDeleteModal from '@/components/secretaria/membros/ConfirmDeleteModal';
import MembroCarteirinhaModal from '@/components/secretaria/membros/MembroCarteirinhaModal';
import MembrosToolbar from '@/components/secretaria/membros/MembrosToolbar';
import MembrosTable from '@/components/secretaria/membros/MembrosTable';
import MembroFormModal from '@/components/secretaria/membros/MembroFormModal';
import MembrosAniversariantesView from '@/components/secretaria/membros/MembrosAniversariantesView';
import { useMembros } from '@/hooks/secretaria/useMembros';

import { useState } from 'react';
import PublicMemberQrModal from '@/components/secretaria/membros/PublicMemberQrModal';

export default function MembrosPage() {
  const { bloqueado } = useRequireModulo('secretaria');
  const [showPublicQrModal, setShowPublicQrModal] = useState(false);

  const {
    // Estado: membros e configuração
    membros,
    membersError,
    maxMembros,
    limiteMembrosAtingido,
    configIgreja,
    cargosMinisteriais,
    nomenclaturas,

    // Estado: UI / navegação
    dashboardView,
    setDashboardView,
    showForm,
    setShowForm,
    activeTab,
    setActiveTab,

    // Estado: filtros e paginação
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    cargoFilter,
    setCargoFilter,
    sortOrdemAlfabetica,
    setSortOrdemAlfabetica,
    currentPage,
    setCurrentPage,
    membrosFiltrados,
    membrosPaginados,
    totalPages,
    startIndex,
    endIndex,

    // Estado: seleção em lote
    membrosSelecionados,
    setMembrosSelecionados,
    imprimindoLote,
    setImprimindoLote,

    // Estado: modais
    membroEditando,
    membroDeletando,
    membroImprimindo,
    setMembroImprimindo,
    membroImprimindoCartao,
    setMembroImprimindoCartao,
    ultimoCadastro,

    // Estado: notificação
    notification,
    setNotification,

    // Estado: formulário
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
    isDizimista,
    setIsDizimista,
    dizimosHistorico,
    loadingDizimosHistorico,

    // Estado: foto e crop
    fotoMembro,
    setFotoMembro,
    fotoOriginal,
    fotoCropRotacao,
    fotoCropZoom,
    setFotoCropZoom,
    fotoCropPositionX,
    setFotoCropPositionX,
    fotoCropPositionY,
    setFotoCropPositionY,
    isDragging,
    mostrarCropModal,
    canvasRefCrop,
    previewAreaRef,
    fileInputRef,

    // Permissões de usuário
    isSupervisor,
    isAuxiliar,

    // Opções de nomenclatura
    supervisoesOptions,
    camposOptions,
    congregacoesOptions,

    // Helpers expostos
    maskCpf,
    gerarProximaMatricula,
    resolveCargoValue,
    hasActiveTemplate,
    getMensagemSemTemplate,
    ensureTemplatesSnapshot,

    // Ações CRUD
    salvarMembro,
    deletarMembro,
    abrirNovoCadastro,
    abrirEdicao,
    abrirDocumentosMembro,
    abrirConfirmacaoDeletar,
    cancelarDeletar,
    fecharFormulario,

    // Ações PDF
    gerarPDFListagem,

    // Ações CEP
    buscarCEP,

    // Ações foto/crop
    handleFotoUpload,
    confirmarCropFoto,
    cancelarCropFoto,
    handleCropWheel,
    handleCropMouseDown,
    handleCropMouseMove,
    handleCropMouseUp,
    resetCropView,
    girarCropImagemEsquerda,
    girarCropImagemDireita,
    handleGirarFoto,
  } = useMembros();

  if (bloqueado) return null;

  return (
    <>
      <NotificationModal
        isOpen={notification.isOpen}
        title={notification.title}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification({ ...notification, isOpen: false })}
        autoClose={notification.autoClose}
        showButton={notification.showButton !== undefined ? notification.showButton : true}
      />

      {/* Modal de Confirmação de Deleção */}
      <ConfirmDeleteModal
        isOpen={!!membroDeletando}
        membro={membroDeletando}
        onConfirm={deletarMembro}
        onCancel={cancelarDeletar}
      />

      {/* Modal de Crop de Foto */}
      {mostrarCropModal && fotoOriginal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b-2 border-teal-500 bg-gradient-to-r from-teal-600 to-teal-700">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🖼️</span> Enquadrar Foto (3x4)
              </h2>
              <button onClick={cancelarCropFoto} className="text-white hover:text-gray-100 text-2xl">✕</button>
            </div>

            {/* Conteúdo */}
            <div className="p-6 space-y-4">
              {/* Área de Preview */}
              <div className="bg-gray-100 rounded-lg p-4 flex justify-center">
                <div
                  ref={previewAreaRef}
                  className="relative bg-black rounded-lg overflow-hidden cursor-grab active:cursor-grabbing select-none aspect-[3/4]"
                  style={{ width: '220px', height: '293px' }}
                  onWheel={handleCropWheel}
                  onMouseDown={handleCropMouseDown}
                  onMouseMove={handleCropMouseMove}
                  onMouseUp={handleCropMouseUp}
                  onMouseLeave={handleCropMouseUp}
                >
                  <canvas ref={canvasRefCrop} width={220} height={293} className="hidden" />
                  <div className="w-full h-full absolute inset-0 flex items-center justify-center bg-gray-900">
                    <img
                      src={fotoOriginal}
                      alt="Preview para crop"
                      className="w-full h-full object-cover pointer-events-none"
                      style={{
                        transform: `rotate(${fotoCropRotacao}deg) scale(${fotoCropZoom}) translateX(${fotoCropPositionX}px) translateY(${fotoCropPositionY}px)`,
                        transformOrigin: 'center',
                        transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Controles de Rotação */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Rotação</label>
                <div className="flex gap-3 justify-center items-center">
                  <button onClick={girarCropImagemEsquerda} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition">↺ 90° Esq</button>
                  <span className="text-sm font-bold text-gray-700 bg-gray-100 px-3 py-2 rounded min-w-[50px] text-center">{fotoCropRotacao}°</span>
                  <button onClick={girarCropImagemDireita} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition">90° Dir ↻</button>
                </div>
              </div>

              {/* Controles de Zoom */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-semibold text-gray-700">Zoom</label>
                  <span className="text-xs font-bold text-teal-600 bg-teal-100 px-2 py-1 rounded">{fotoCropZoom.toFixed(1)}x</span>
                </div>
                <input
                  type="range" min="1" max="3" step="0.1"
                  value={fotoCropZoom}
                  onChange={(e) => setFotoCropZoom(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500"><span>1x</span><span>3x</span></div>
              </div>

              {/* Controles de Posição */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-gray-700">Posição</label>
                  <button onClick={resetCropView} className="text-xs px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition">↺ Resetar</button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Horizontal</label>
                    <input type="range" min="-200" max="200" step="5" value={fotoCropPositionX}
                      onChange={(e) => setFotoCropPositionX(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Vertical</label>
                    <input type="range" min="-200" max="200" step="5" value={fotoCropPositionY}
                      onChange={(e) => setFotoCropPositionY(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer" />
                  </div>
                </div>
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-4 px-6 py-4 border-t border-gray-300 bg-gray-50">
              <button onClick={confirmarCropFoto} className="flex-1 px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-lg hover:from-teal-700 hover:to-teal-800 transition font-bold text-sm">
                ✓ Confirmar Enquadramento
              </button>
              <button onClick={cancelarCropFoto} className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-bold text-sm">
                ✕ Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modais de Impressão e Carteirinha */}
      <MembroCarteirinhaModal
        membroImprimindo={membroImprimindo}
        setMembroImprimindo={setMembroImprimindo}
        membroImprimindoCartao={membroImprimindoCartao}
        setMembroImprimindoCartao={setMembroImprimindoCartao}
        imprimindoLote={imprimindoLote}
        setImprimindoLote={setImprimindoLote}
        membrosSelecionados={membrosSelecionados}
        setMembrosSelecionados={setMembrosSelecionados}
        membros={membros}
        configIgreja={configIgreja}
        setNotification={setNotification}
      />

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="p-6 max-w-[96rem] mx-auto w-full">
          {/* Navegação de Abas */}
          <div className="bg-white rounded-lg shadow-md mb-6 border-b-4 border-teal-500">
            <div className="flex flex-wrap items-center gap-4 p-4">
              <button
                onClick={() => setDashboardView('overview')}
                className={`px-6 py-3 rounded-lg font-semibold transition ${
                  dashboardView === 'overview' ? 'bg-teal-600 text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                📊 Dashboard
              </button>
              <button
                onClick={() => setDashboardView('list')}
                className={`px-6 py-3 rounded-lg font-semibold transition ${
                  dashboardView === 'list' ? 'bg-teal-600 text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                👥 Dados de Membros
              </button>
              <button
                onClick={() => setDashboardView('aniversariantes')}
                className={`px-6 py-3 rounded-lg font-semibold transition ${
                  dashboardView === 'aniversariantes' ? 'bg-teal-600 text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🎂 Aniversariantes
              </button>
            </div>
          </div>

          {membersError && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-6">
              <p className="text-amber-900 font-semibold">{membersError}</p>
              {membersError === 'Usuário sem ministério associado' && (
                <p className="text-amber-900 text-sm mt-1">
                  Seu usuário ainda não está vinculado a um ministério. Se você acabou de se cadastrar, aguarde a liberação/associação do seu acesso.
                </p>
              )}
            </div>
          )}

          {/* Vista — Dashboard */}
          {dashboardView === 'overview' && (
            <div>
              <MembrosOverview
                membros={membros}
                nivelUsuario="administrador"
                maxMembros={maxMembros}
              />
            </div>
          )}

          {/* Vista — Dados de Membros */}
          {dashboardView === 'list' && (
            <div>
              <MembrosToolbar
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                cargoFilter={cargoFilter}
                setCargoFilter={setCargoFilter}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                setCurrentPage={setCurrentPage}
                setSortOrdemAlfabetica={setSortOrdemAlfabetica}
                cargosMinisteriais={cargosMinisteriais as any}
                membrosFiltradosCount={membrosFiltrados.length}
                totalMembrosCount={membros.length}
                isSupervisor={isSupervisor}
                limiteMembrosAtingido={limiteMembrosAtingido}
                maxMembros={maxMembros}
                abrirNovoCadastro={abrirNovoCadastro}
                abrirCadastroPublico={() => setShowPublicQrModal(true)}
                ultimoCadastro={ultimoCadastro}
                gerarProximaMatricula={gerarProximaMatricula}
                setDadosPessoais={setDadosPessoais}
                setEnderecoData={setEnderecoData}
                setDadosMinisteriais={setDadosMinisteriais}
                setCargoSelecionado={setCargoSelecionado}
                setDadosCargos={setDadosCargos}
                setIsEditando={() => {}}
                setShowForm={setShowForm}
                setActiveTab={setActiveTab as any}
                resolveCargoValue={resolveCargoValue}
                gerarPDFListagem={gerarPDFListagem}
                membrosSelecionadosCount={membrosSelecionados.size}
                setImprimindoLote={setImprimindoLote}
                setNotification={setNotification}
              />

              <MembrosTable
                membrosPaginados={membrosPaginados}
                membrosFiltradosCount={membrosFiltrados.length}
                membrosSelecionados={membrosSelecionados}
                setMembrosSelecionados={setMembrosSelecionados}
                sortOrdemAlfabetica={sortOrdemAlfabetica}
                setSortOrdemAlfabetica={setSortOrdemAlfabetica}
                maskCpf={maskCpf}
                isSupervisor={isSupervisor}
                isAuxiliar={isAuxiliar}
                setMembroImprimindo={setMembroImprimindo}
                abrirEdicao={abrirEdicao}
                abrirDocumentosMembro={abrirDocumentosMembro}
                abrirConfirmacaoDeletar={abrirConfirmacaoDeletar}
                ensureTemplatesSnapshot={ensureTemplatesSnapshot}
                hasActiveTemplate={hasActiveTemplate}
                getMensagemSemTemplate={getMensagemSemTemplate}
                setNotification={setNotification}
                setMembroImprimindoCartao={setMembroImprimindoCartao}
                startIndex={startIndex}
                endIndex={endIndex}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                totalPages={totalPages}
              />

              {(() => {
                console.log('props enviadas', {
                  supervisoesOptions,
                  camposOptions,
                  congregacoesOptions
                });
                return null;
              })()}
              <MembroFormModal
                showForm={showForm}
                setShowForm={setShowForm}
                membroEditando={membroEditando}
                activeTab={activeTab}
                setActiveTab={(tab: any) => setActiveTab(tab)}
                dadosPessoais={dadosPessoais}
                setDadosPessoais={setDadosPessoais}
                enderecoData={enderecoData}
                setEnderecoData={setEnderecoData}
                dadosMinisteriais={dadosMinisteriais}
                setDadosMinisteriais={setDadosMinisteriais}
                cargoSelecionado={cargoSelecionado}
                setCargoSelecionado={setCargoSelecionado}
                dadosCargos={dadosCargos}
                setDadosCargos={setDadosCargos}
                nomenclaturas={nomenclaturas}
                supervisoesOptions={supervisoesOptions}
                camposOptions={camposOptions}
                congregacoesOptions={congregacoesOptions}
                cargosMinisteriais={cargosMinisteriais as any}
                buscarCep={buscarCEP}
                loadingCep={false}
                fotoMembro={fotoMembro}
                setFotoMembro={setFotoMembro}
                fileInputRef={fileInputRef}
                handleFotoUpload={handleFotoUpload}
                handleGirarFoto={handleGirarFoto}
                salvarMembro={salvarMembro}
                fecharFormulario={fecharFormulario}
                dizimosHistorico={dizimosHistorico}
                loadingDizimosHistorico={loadingDizimosHistorico}
                isDizimista={isDizimista}
                setIsDizimista={setIsDizimista}
              />
            </div>
          )}

          {/* Vista — Aniversariantes */}
          {dashboardView === 'aniversariantes' && (
            <div>
              <MembrosAniversariantesView
                membros={membros}
                setMembroImprimindo={setMembroImprimindo}
              />
            </div>
          )}
        </div>
      </div>

      {/* Modal QR Code de Cadastro Público */}
      <PublicMemberQrModal
        isOpen={showPublicQrModal}
        onClose={() => setShowPublicQrModal(false)}
        institutionIdentifier={configIgreja.slug || (configIgreja as any).id || ''}
        institutionName={configIgreja.nome || 'Igreja'}
        logoUrl={configIgreja.logo}
      />
    </>
  );
}
