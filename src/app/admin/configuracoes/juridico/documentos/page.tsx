'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { authenticatedFetch } from '@/lib/api-client'
import {
  FileText,
  CheckCircle2,
  Archive,
  FilePlus,
  AlertCircle,
  Loader2,
  Search,
  Filter,
  MoreVertical,
  Eye,
  Edit,
  Send,
  GitFork,
  History,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  X,
} from 'lucide-react'
import type {
  DocumentoJuridico,
  ItemHistoricoVersaoDTO,
} from '@/types/juridico'

export default function DocumentosPage() {
  const [documentos, setDocumentos] = useState<DocumentoJuridico[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  // Filtros, Busca e Paginação
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTipo, setFilterTipo] = useState<string>('TODOS')
  const [filterStatus, setFilterStatus] = useState<string>('TODOS')
  const [filterObrigatorio, setFilterObrigatorio] = useState<string>('TODOS')
  const [sortField, setSortField] = useState<'titulo' | 'created_at' | 'versao'>('created_at')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  // Menu de ações por linha
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  // Modais de Ações & Confirmação
  const [selectedDoc, setSelectedDoc] = useState<DocumentoJuridico | null>(null)
  const [modalMode, setModalMode] = useState<
    'VISUALIZAR' | 'EDITAR' | 'PUBLICAR' | 'NOVA_VERSAO' | 'HISTORICO' | 'ARQUIVAR' | null
  >(null)
  const [modalLoading, setModalLoading] = useState(false)

  // Formulários de Edição / Nova Versão
  const [editForm, setEditForm] = useState({
    titulo: '',
    conteudo_md: '',
    obrigatorio: true,
  })
  const [novaVersaoInput, setNovaVersaoInput] = useState('')
  const [historicoVersoes, setHistoricoVersoes] = useState<ItemHistoricoVersaoDTO[]>([])

  const carregarDocumentos = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await authenticatedFetch('/api/admin/juridico/documentos')
      if (!res.ok) {
        throw new Error('Falha ao carregar a lista de documentos jurídicos.')
      }
      const json = await res.json()
      if (json.success) {
        setDocumentos(json.data || [])
      } else {
        throw new Error(json.error || 'Erro ao consultar documentos.')
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao carregar os dados.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDocumentos()
  }, [])

  // Métricas
  const totalDocumentos = documentos.length
  const totalPublicados = documentos.filter((d) => d.status === 'PUBLICADO').length
  const totalRascunhos = documentos.filter((d) => d.status === 'RASCUNHO').length
  const totalArquivados = documentos.filter((d) => d.status === 'ARQUIVADO').length

  // Filtragem e Ordenação
  const documentosFiltrados = useMemo(() => {
    return documentos
      .filter((doc) => {
        const matchesSearch =
          doc.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
          doc.versao.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesTipo = filterTipo === 'TODOS' || doc.tipo === filterTipo
        const matchesStatus = filterStatus === 'TODOS' || doc.status === filterStatus
        const matchesObrigatorio =
          filterObrigatorio === 'TODOS' ||
          (filterObrigatorio === 'SIM' && doc.obrigatorio) ||
          (filterObrigatorio === 'NAO' && !doc.obrigatorio)

        return matchesSearch && matchesTipo && matchesStatus && matchesObrigatorio
      })
      .sort((a, b) => {
        let valA: any = a[sortField]
        let valB: any = b[sortField]

        if (sortField === 'created_at') {
          valA = new Date(valA).getTime()
          valB = new Date(valB).getTime()
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
  }, [documentos, searchTerm, filterTipo, filterStatus, filterObrigatorio, sortField, sortDirection])

  // Paginação
  const totalPages = Math.max(1, Math.ceil(documentosFiltrados.length / itemsPerPage))
  const paginatedDocumentos = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return documentosFiltrados.slice(start, start + itemsPerPage)
  }, [documentosFiltrados, currentPage])

  // Handlers de Ações das APIs
  const handleOpenAction = async (doc: DocumentoJuridico, mode: typeof modalMode) => {
    setSelectedDoc(doc)
    setModalMode(mode)
    setOpenMenuId(null)
    setActionMessage(null)

    if (mode === 'EDITAR') {
      setEditForm({
        titulo: doc.titulo,
        conteudo_md: doc.conteudo_md,
        obrigatorio: doc.obrigatorio,
      })
    } else if (mode === 'NOVA_VERSAO') {
      const parts = doc.versao.split('.')
      const major = parseInt(parts[0] || '1', 10)
      setNovaVersaoInput(`${major + 1}.0`)
    } else if (mode === 'HISTORICO') {
      try {
        setModalLoading(true)
        const res = await authenticatedFetch(`/api/admin/juridico/documentos/${doc.id}/historico`)
        const json = await res.json()
        if (json.success) {
          setHistoricoVersoes(json.data.versoes || [])
        }
      } catch {
        setHistoricoVersoes([])
      } finally {
        setModalLoading(false)
      }
    }
  }

  const handleSalvarEdicao = async () => {
    if (!selectedDoc) return
    try {
      setModalLoading(true)
      const res = await authenticatedFetch(`/api/admin/juridico/documentos/${selectedDoc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)

      setActionMessage('Rascunho atualizado com sucesso!')
      setModalMode(null)
      carregarDocumentos()
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar rascunho.')
    } finally {
      setModalLoading(false)
    }
  }

  const handlePublicar = async () => {
    if (!selectedDoc) return
    try {
      setModalLoading(true)
      const res = await authenticatedFetch(`/api/admin/juridico/documentos/${selectedDoc.id}/publicar`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)

      setActionMessage(`Documento "${selectedDoc.titulo}" v${selectedDoc.versao} publicado com sucesso!`)
      setModalMode(null)
      carregarDocumentos()
    } catch (err: any) {
      setError(err.message || 'Erro ao publicar documento.')
    } finally {
      setModalLoading(false)
    }
  }

  const handleCriarNovaVersao = async () => {
    if (!selectedDoc) return
    try {
      setModalLoading(true)
      const res = await authenticatedFetch(`/api/admin/juridico/documentos/${selectedDoc.id}/nova-versao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versao: novaVersaoInput }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)

      setActionMessage(`Nova versão v${novaVersaoInput} gerada com sucesso em Rascunho!`)
      setModalMode(null)
      carregarDocumentos()
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar nova versão.')
    } finally {
      setModalLoading(false)
    }
  }

  const handleArquivar = async () => {
    if (!selectedDoc) return
    try {
      setModalLoading(true)
      const res = await authenticatedFetch(`/api/admin/juridico/documentos/${selectedDoc.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)

      setActionMessage(`Documento "${selectedDoc.titulo}" arquivado com sucesso!`)
      setModalMode(null)
      carregarDocumentos()
    } catch (err: any) {
      setError(err.message || 'Erro ao arquivar documento.')
    } finally {
      setModalLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Resumo Estatístico */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Total de Documentos</p>
            <h3 className="text-2xl font-bold text-white mt-1">{loading ? '-' : totalDocumentos}</h3>
          </div>
          <div className="p-3 bg-blue-600/10 text-blue-400 rounded-lg border border-blue-500/20">
            <FileText size={20} />
          </div>
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Publicados Vigentes</p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">{loading ? '-' : totalPublicados}</h3>
          </div>
          <div className="p-3 bg-emerald-600/10 text-emerald-400 rounded-lg border border-emerald-500/20">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Rascunhos em Edição</p>
            <h3 className="text-2xl font-bold text-amber-400 mt-1">{loading ? '-' : totalRascunhos}</h3>
          </div>
          <div className="p-3 bg-amber-600/10 text-amber-400 rounded-lg border border-amber-500/20">
            <FilePlus size={20} />
          </div>
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Arquivados</p>
            <h3 className="text-2xl font-bold text-gray-400 mt-1">{loading ? '-' : totalArquivados}</h3>
          </div>
          <div className="p-3 bg-gray-800 text-gray-400 rounded-lg border border-gray-700">
            <Archive size={20} />
          </div>
        </div>
      </div>

      {/* Alertas */}
      {actionMessage && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-800/50 rounded-xl flex items-center justify-between text-emerald-300">
          <p className="text-sm">{actionMessage}</p>
          <button onClick={() => setActionMessage(null)} className="text-emerald-400 hover:text-emerald-200">
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-950/40 border border-red-800/50 rounded-xl flex items-center justify-between text-red-300">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Toolbar: Filtros & Busca */}
      <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Pesquisa */}
        <div className="relative w-full md:w-80">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por título ou versão..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Filtros Dropdowns */}
        <div className="flex flex-wrap gap-3 w-full md:w-auto items-center">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <span className="text-xs text-gray-400 font-medium">Filtros:</span>
          </div>

          <select
            value={filterTipo}
            onChange={(e) => {
              setFilterTipo(e.target.value)
              setCurrentPage(1)
            }}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
          >
            <option value="TODOS">Todos os Tipos</option>
            <option value="TERMOS_DE_USO">Termos de Uso</option>
            <option value="POLITICA_PRIVACIDADE">Política de Privacidade</option>
            <option value="CONTRATO_SERVICO">Contrato de Serviço</option>
            <option value="ADITIVO">Aditivo</option>
            <option value="OUTRO">Outro</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value)
              setCurrentPage(1)
            }}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
          >
            <option value="TODOS">Todos os Status</option>
            <option value="PUBLICADO">PUBLICADO</option>
            <option value="RASCUNHO">RASCUNHO</option>
            <option value="ARQUIVADO">ARQUIVADO</option>
          </select>

          <select
            value={filterObrigatorio}
            onChange={(e) => {
              setFilterObrigatorio(e.target.value)
              setCurrentPage(1)
            }}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
          >
            <option value="TODOS">Obrigatoriedade</option>
            <option value="SIM">Sim (Obrigatório)</option>
            <option value="NAO">Não</option>
          </select>
        </div>
      </div>

      {/* Tabela de Documentos */}
      <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-gray-400 gap-3">
            <Loader2 size={32} className="animate-spin text-blue-500" />
            <p className="text-sm font-medium">Carregando documentos jurídicos...</p>
          </div>
        ) : paginatedDocumentos.length === 0 ? (
          <div className="p-12 text-center">
            <FileText size={40} className="mx-auto text-gray-600 mb-3" />
            <h3 className="text-base font-medium text-gray-300">Nenhum documento localizado</h3>
            <p className="text-xs text-gray-500 mt-1">Nenhum registro atende aos filtros de pesquisa selecionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-900/50 text-xs uppercase text-gray-400 border-b border-gray-800">
                <tr>
                  <th
                    className="px-6 py-3.5 cursor-pointer hover:text-white transition-colors"
                    onClick={() => {
                      setSortField('titulo')
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      Título
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th className="px-6 py-3.5">Tipo</th>
                  <th
                    className="px-6 py-3.5 cursor-pointer hover:text-white transition-colors"
                    onClick={() => {
                      setSortField('versao')
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      Versão
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Obrigatório</th>
                  <th
                    className="px-6 py-3.5 cursor-pointer hover:text-white transition-colors"
                    onClick={() => {
                      setSortField('created_at')
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      Criado Em
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th className="px-6 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {paginatedDocumentos.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-900/40 transition-colors relative">
                    <td className="px-6 py-4 font-medium text-white">{doc.titulo}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-md text-xs font-mono bg-gray-900 border border-gray-800 text-gray-300">
                        {doc.tipo}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-blue-400 font-bold">v{doc.versao}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          doc.status === 'PUBLICADO'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : doc.status === 'RASCUNHO'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-gray-800 text-gray-400 border border-gray-700'
                        }`}
                      >
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {doc.obrigatorio ? (
                        <span className="text-emerald-400 font-medium">Sim</span>
                      ) : (
                        <span className="text-gray-500">Não</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-400">
                      {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-right relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === doc.id ? null : doc.id)}
                        className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {/* Dropdown ActionMenu */}
                      {openMenuId === doc.id && (
                        <div className="absolute right-6 top-12 z-20 w-48 bg-gray-950 border border-gray-800 rounded-xl shadow-xl py-1 text-left">
                          <button
                            onClick={() => handleOpenAction(doc, 'VISUALIZAR')}
                            className="w-full px-4 py-2 text-xs text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2"
                          >
                            <Eye size={14} /> Visualizar Detalhes
                          </button>

                          {doc.status === 'RASCUNHO' && (
                            <button
                              onClick={() => handleOpenAction(doc, 'EDITAR')}
                              className="w-full px-4 py-2 text-xs text-amber-400 hover:bg-gray-800 flex items-center gap-2"
                            >
                              <Edit size={14} /> Editar Rascunho
                            </button>
                          )}

                          {doc.status === 'RASCUNHO' && (
                            <button
                              onClick={() => handleOpenAction(doc, 'PUBLICAR')}
                              className="w-full px-4 py-2 text-xs text-emerald-400 hover:bg-gray-800 flex items-center gap-2"
                            >
                              <Send size={14} /> Publicar Oficialmente
                            </button>
                          )}

                          {doc.status === 'PUBLICADO' && (
                            <button
                              onClick={() => handleOpenAction(doc, 'NOVA_VERSAO')}
                              className="w-full px-4 py-2 text-xs text-blue-400 hover:bg-gray-800 flex items-center gap-2"
                            >
                              <GitFork size={14} /> Gerar Nova Versão
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenAction(doc, 'HISTORICO')}
                            className="w-full px-4 py-2 text-xs text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2"
                          >
                            <History size={14} /> Ver Histórico Versões
                          </button>

                          {doc.status !== 'ARQUIVADO' && (
                            <button
                              onClick={() => handleOpenAction(doc, 'ARQUIVAR')}
                              className="w-full px-4 py-2 text-xs text-red-400 hover:bg-gray-800 flex items-center gap-2"
                            >
                              <Trash2 size={14} /> Arquivar
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Rodapé da Tabela: Paginação */}
        {!loading && documentosFiltrados.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
            <span>
              Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, documentosFiltrados.length)} a{' '}
              {Math.min(currentPage * itemsPerPage, documentosFiltrados.length)} de {documentosFiltrados.length} registros
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-gray-800 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="font-medium text-gray-200">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-gray-800 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE AÇÕES E CONFIRMAÇÃO */}
      {modalMode && selectedDoc && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-5">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <h3 className="text-base font-bold text-white">
                {modalMode === 'VISUALIZAR' && 'Detalhes do Documento'}
                {modalMode === 'EDITAR' && 'Editar Rascunho'}
                {modalMode === 'PUBLICAR' && 'Confirmar Publicação Oficial'}
                {modalMode === 'NOVA_VERSAO' && 'Gerar Nova Versão (Rascunho)'}
                {modalMode === 'HISTORICO' && 'Histórico de Versões'}
                {modalMode === 'ARQUIVAR' && 'Confirmar Arquivamento'}
              </h3>
              <button
                onClick={() => setModalMode(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Conteúdo por modo */}
            {modalMode === 'VISUALIZAR' && (
              <div className="space-y-3 text-xs text-gray-300">
                <div>
                  <span className="text-gray-500 uppercase tracking-wider font-semibold block mb-1">Título:</span>
                  <p className="text-sm font-medium text-white">{selectedDoc.titulo}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-500 uppercase tracking-wider font-semibold block mb-1">Tipo:</span>
                    <p className="font-mono text-gray-300">{selectedDoc.tipo}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 uppercase tracking-wider font-semibold block mb-1">Versão:</span>
                    <p className="font-mono text-blue-400 font-bold">v{selectedDoc.versao}</p>
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 uppercase tracking-wider font-semibold block mb-1">Hash SHA-256:</span>
                  <p className="font-mono text-[11px] bg-gray-900 p-2 rounded border border-gray-800 text-gray-400 break-all">
                    {selectedDoc.hash_sha256 || 'PENDENTE (RASCUNHO)'}
                  </p>
                </div>
              </div>
            )}

            {modalMode === 'EDITAR' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1">Título do Documento</label>
                  <input
                    type="text"
                    value={editForm.titulo}
                    onChange={(e) => setEditForm({ ...editForm, titulo: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1">Conteúdo Markdown</label>
                  <textarea
                    rows={5}
                    value={editForm.conteudo_md}
                    onChange={(e) => setEditForm({ ...editForm, conteudo_md: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {modalMode === 'PUBLICAR' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-300">
                  Tem certeza que deseja publicar oficialmente o documento{' '}
                  <strong className="text-white">"{selectedDoc.titulo}"</strong> versão{' '}
                  <strong className="text-blue-400">v{selectedDoc.versao}</strong>?
                </p>
                <div className="p-3 bg-amber-950/40 border border-amber-800/50 rounded-xl text-xs text-amber-300">
                  ⚠️ <strong>Atenção:</strong> Documentos publicados tornam-se imutáveis e não poderão mais ser alterados ou excluídos.
                </div>
              </div>
            )}

            {modalMode === 'NOVA_VERSAO' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-300">
                  Informe a numeração da nova versão a ser derivada de{' '}
                  <strong className="text-white">"{selectedDoc.titulo}" (v{selectedDoc.versao})</strong>:
                </p>
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1">Nova Versão</label>
                  <input
                    type="text"
                    value={novaVersaoInput}
                    onChange={(e) => setNovaVersaoInput(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {modalMode === 'HISTORICO' && (
              <div className="space-y-3">
                {modalLoading ? (
                  <div className="p-6 flex items-center justify-center text-gray-400">
                    <Loader2 size={24} className="animate-spin text-blue-500" />
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto divide-y divide-gray-800 text-xs">
                    {historicoVersoes.map((v) => (
                      <div key={v.id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-mono text-blue-400 font-bold">v{v.versao}</span>
                          <span className="ml-2 text-gray-400">{new Date(v.created_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            v.status === 'PUBLICADO'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-gray-800 text-gray-400'
                          }`}
                        >
                          {v.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {modalMode === 'ARQUIVAR' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-300">
                  Tem certeza que deseja arquivar o documento{' '}
                  <strong className="text-white">"{selectedDoc.titulo}"</strong>?
                </p>
              </div>
            )}

            {/* Footer Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
              <button
                onClick={() => setModalMode(null)}
                className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>

              {modalMode === 'EDITAR' && (
                <button
                  onClick={handleSalvarEdicao}
                  disabled={modalLoading}
                  className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  {modalLoading && <Loader2 size={14} className="animate-spin" />}
                  Salvar Rascunho
                </button>
              )}

              {modalMode === 'PUBLICAR' && (
                <button
                  onClick={handlePublicar}
                  disabled={modalLoading}
                  className="px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  {modalLoading && <Loader2 size={14} className="animate-spin" />}
                  Confirmar Publicação
                </button>
              )}

              {modalMode === 'NOVA_VERSAO' && (
                <button
                  onClick={handleCriarNovaVersao}
                  disabled={modalLoading}
                  className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  {modalLoading && <Loader2 size={14} className="animate-spin" />}
                  Gerar Versão
                </button>
              )}

              {modalMode === 'ARQUIVAR' && (
                <button
                  onClick={handleArquivar}
                  disabled={modalLoading}
                  className="px-4 py-2 text-xs font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  {modalLoading && <Loader2 size={14} className="animate-spin" />}
                  Confirmar Arquivamento
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
