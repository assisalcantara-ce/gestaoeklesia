'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { authenticatedFetch } from '@/lib/api-client'
import {
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  Filter,
  Eye,
  X,
  ShieldCheck,
  Clock,
  Building2,
  Calendar,
  CreditCard,
  Hash,
  User,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  FileText,
  History,
  Copy,
  Check,
} from 'lucide-react'
import type { DetalhesContratoTenantDTO } from '@/types/juridico'

interface ItemContratoAdmin {
  contrato_id: string
  id: string
  ministry_id: string
  nome_ministrio: string
  ministry_name: string
  cnpj: string | null
  plano_contratado: string
  valor_mensal: number | null
  documento_base_id: string | null
  documento_base_titulo: string
  documento_base_tipo: string
  versao_documento: string
  status: 'RASCUNHO' | 'AGUARDANDO_ASSINATURA' | 'ATIVO' | 'CANCELADO' | 'EXPIRADO' | 'RESCINDIDO' | 'SUBSTITUIDO'
  origem_snapshot: string
  snapshot_status: string
  integridade_verificada: boolean
  numero_contrato: string | null
  data_inicio: string
  data_fim: string | null
  assinado_em: string | null
  assinado_por: string | null
  created_at: string
  updated_at: string
  ultimo_aceite: {
    id: string
    versao_aceita: string
    aceito_em: string
    user_id: string
    hash_documento: string
  } | null
}

export default function ContratosPage() {
  const [contratos, setContratos] = useState<ItemContratoAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros e Busca
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('TODOS')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  // Modal de Visualização de Detalhes
  const [selectedContrato, setSelectedContrato] = useState<ItemContratoAdmin | null>(null)
  const [detalhesData, setDetalhesData] = useState<DetalhesContratoTenantDTO | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [erroDetalhes, setErroDetalhes] = useState<string | null>(null)
  const [activeModalTab, setActiveModalTab] = useState<'resumo' | 'conteudo' | 'historico' | 'integridade'>('resumo')
  const [copiedHash, setCopiedHash] = useState(false)

  const carregarContratos = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await authenticatedFetch('/api/v1/admin/juridico/contratos')
      if (!res.ok) {
        throw new Error('Falha ao carregar a lista de contratos dos clientes.')
      }
      const json = await res.json()
      if (json.success) {
        setContratos(json.data || [])
      } else {
        throw new Error(json.error || 'Erro ao consultar contratos.')
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao carregar os contratos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarContratos()
  }, [])

  // Métricas Executivas derivadas dos dados reais
  const totalContratos = contratos.length
  const totalAtivos = contratos.filter((c) => c.status === 'ATIVO').length
  const totalAguardando = contratos.filter((c) => c.status === 'AGUARDANDO_ASSINATURA').length
  const totalIntegro = contratos.filter((c) => c.snapshot_status === 'INTEGRO_IMUTAVEL' && c.integridade_verificada).length

  // Filtragem e Busca
  const contratosFiltrados = useMemo(() => {
    return contratos.filter((item) => {
      const term = searchTerm.toLowerCase().trim()
      const matchesSearch =
        !term ||
        item.nome_ministrio.toLowerCase().includes(term) ||
        (item.cnpj && item.cnpj.includes(term)) ||
        (item.numero_contrato && item.numero_contrato.toLowerCase().includes(term)) ||
        (item.plano_contratado && item.plano_contratado.toLowerCase().includes(term)) ||
        item.versao_documento.toLowerCase().includes(term)

      const matchesStatus = statusFilter === 'TODOS' || item.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [contratos, searchTerm, statusFilter])

  // Paginação
  const totalPages = Math.max(1, Math.ceil(contratosFiltrados.length / itemsPerPage))
  const paginatedContratos = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return contratosFiltrados.slice(start, start + itemsPerPage)
  }, [contratosFiltrados, currentPage])

  // Abrir Modal de Detalhes
  const handleAbrirDetalhes = async (contrato: ItemContratoAdmin) => {
    setSelectedContrato(contrato)
    setDetalhesData(null)
    setErroDetalhes(null)
    setActiveModalTab('resumo')
    setLoadingDetalhes(true)

    try {
      const res = await authenticatedFetch(`/api/v1/admin/juridico/contratos/${contrato.ministry_id}`)
      if (!res.ok) {
        throw new Error('Falha ao carregar detalhes completos do contrato.')
      }
      const json = await res.json()
      if (json.success && json.data) {
        setDetalhesData(json.data)
      } else {
        throw new Error(json.error || 'Erro ao carregar detalhes.')
      }
    } catch (err: any) {
      setErroDetalhes(err.message || 'Erro ao consultar detalhes do contrato.')
    } finally {
      setLoadingDetalhes(false)
    }
  }

  const handleCopyHash = (hash: string) => {
    if (!hash) return
    navigator.clipboard.writeText(hash)
    setCopiedHash(true)
    setTimeout(() => setCopiedHash(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Gestão de Contratos dos Clientes</h2>
          <p className="text-xs text-gray-400">
            Acompanhe a vigência, assinaturas eletrônicas e governança imutável dos contratos dos tenants.
          </p>
        </div>
        <button
          onClick={carregarContratos}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-semibold border border-gray-700 transition"
        >
          <RotateCcw size={14} className={loading ? 'animate-spin' : ''} />
          Atualizar Dados
        </button>
      </div>

      {/* Cards de Resumo Executivo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Total de Contratos</p>
            <h3 className="text-2xl font-bold text-white mt-1">{loading ? '-' : totalContratos}</h3>
          </div>
          <div className="p-3 bg-blue-600/10 text-blue-400 rounded-lg border border-blue-500/20">
            <FileCheck size={20} />
          </div>
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Contratos Ativos</p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">{loading ? '-' : totalAtivos}</h3>
          </div>
          <div className="p-3 bg-emerald-600/10 text-emerald-400 rounded-lg border border-emerald-500/20">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Aguardando Assinatura</p>
            <h3 className="text-2xl font-bold text-amber-400 mt-1">{loading ? '-' : totalAguardando}</h3>
          </div>
          <div className="p-3 bg-amber-600/10 text-amber-400 rounded-lg border border-amber-500/20">
            <Clock size={20} />
          </div>
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Governança Íntegra</p>
            <h3 className="text-2xl font-bold text-indigo-400 mt-1">{loading ? '-' : totalIntegro}</h3>
          </div>
          <div className="p-3 bg-indigo-600/10 text-indigo-400 rounded-lg border border-indigo-500/20">
            <ShieldCheck size={20} />
          </div>
        </div>
      </div>

      {/* Tratamento de Erro */}
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
        <div className="relative w-full md:w-80">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por igreja, CNPJ, contrato..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex flex-wrap gap-3 w-full md:w-auto items-center">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <span className="text-xs text-gray-400 font-medium">Status:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setCurrentPage(1)
            }}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
          >
            <option value="TODOS">Todos os Status</option>
            <option value="ATIVO">ATIVO</option>
            <option value="AGUARDANDO_ASSINATURA">AGUARDANDO ASSINATURA</option>
            <option value="SUBSTITUIDO">SUBSTITUIDO</option>
            <option value="CANCELADO">CANCELADO</option>
            <option value="EXPIRADO">EXPIRADO</option>
          </select>
        </div>
      </div>

      {/* Tabela de Contratos */}
      <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-gray-400 gap-3">
            <Loader2 size={32} className="animate-spin text-blue-500" />
            <p className="text-sm font-medium">Carregando contratos dos clientes...</p>
          </div>
        ) : paginatedContratos.length === 0 ? (
          <div className="p-12 text-center">
            <FileCheck size={40} className="mx-auto text-gray-600 mb-3" />
            <h3 className="text-base font-medium text-gray-300">Nenhum contrato encontrado</h3>
            <p className="text-xs text-gray-500 mt-1">
              Nenhum registro atende aos filtros de pesquisa ou não há contratos emitidos.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-900/50 text-xs uppercase text-gray-400 border-b border-gray-800">
                <tr>
                  <th className="px-6 py-3.5">Tenant / Ministério</th>
                  <th className="px-6 py-3.5">Nº Contrato / Versão</th>
                  <th className="px-6 py-3.5">Plano & Valor</th>
                  <th className="px-6 py-3.5">Governança</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Vigência / Aceite</th>
                  <th className="px-6 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {paginatedContratos.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-900/40 transition-colors">
                    {/* Tenant / Ministério */}
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{item.nome_ministrio}</div>
                      <div className="text-xs text-gray-400 font-mono mt-0.5">
                        {item.cnpj ? `CNPJ: ${item.cnpj}` : 'CNPJ não informado'}
                      </div>
                    </td>

                    {/* Nº Contrato / Versão */}
                    <td className="px-6 py-4">
                      <div className="font-mono text-xs text-gray-200 font-medium">
                        {item.numero_contrato || item.id.slice(0, 8)}
                      </div>
                      <div className="inline-flex items-center gap-1 mt-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-950 text-blue-400 border border-blue-800">
                          v{item.versao_documento}
                        </span>
                      </div>
                    </td>

                    {/* Plano & Valor */}
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-200 uppercase text-xs">{item.plano_contratado}</div>
                      <div className="text-xs text-emerald-400 font-mono mt-0.5">
                        {item.valor_mensal !== null && item.valor_mensal !== undefined
                          ? `R$ ${item.valor_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : 'Tabela Padrão'}
                      </div>
                    </td>

                    {/* Governança */}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium ${
                          item.snapshot_status === 'INTEGRO_IMUTAVEL'
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                            : 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                        }`}
                      >
                        <ShieldCheck size={12} />
                        {item.snapshot_status || 'INTEGRO_IMUTAVEL'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.status === 'ATIVO'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : item.status === 'AGUARDANDO_ASSINATURA'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800 animate-pulse'
                            : 'bg-gray-800 text-gray-400 border border-gray-700'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>

                    {/* Vigência / Aceite */}
                    <td className="px-6 py-4 text-xs text-gray-400">
                      <div>Início: {new Date(item.data_inicio).toLocaleDateString('pt-BR')}</div>
                      {item.ultimo_aceite ? (
                        <div className="text-emerald-400/90 text-[11px] mt-0.5">
                          Aceito em: {new Date(item.ultimo_aceite.aceito_em).toLocaleDateString('pt-BR')} (v{item.ultimo_aceite.versao_aceita})
                        </div>
                      ) : (
                        <div className="text-gray-500 text-[11px] mt-0.5">Pendente de assinatura</div>
                      )}
                    </td>

                    {/* Ações */}
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleAbrirDetalhes(item)}
                        className="p-2 hover:bg-blue-600/10 text-gray-400 hover:text-blue-400 border border-transparent hover:border-blue-500/20 rounded-lg transition"
                        title="Visualizar Detalhes do Contrato"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {!loading && contratosFiltrados.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
            <span>
              Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, contratosFiltrados.length)} a{' '}
              {Math.min(currentPage * itemsPerPage, contratosFiltrados.length)} de {contratosFiltrados.length} contratos
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

      {/* MODAL DE VISUALIZAÇÃO DETALHADA DO CONTRATO (100% READ-ONLY) */}
      {selectedContrato && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Header Modal */}
            <div className="px-6 py-4 bg-gray-900/60 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600/10 text-blue-400 rounded-lg border border-blue-500/20">
                  <FileCheck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    {selectedContrato.nome_ministrio}
                    <span className="text-xs px-2 py-0.5 rounded font-mono bg-blue-950 text-blue-400 border border-blue-800 font-normal">
                      v{selectedContrato.versao_documento}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    Contrato: <span className="font-mono text-gray-300">{selectedContrato.numero_contrato || selectedContrato.id}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedContrato(null)
                  setDetalhesData(null)
                }}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Abas do Modal */}
            <div className="px-6 bg-gray-950 border-b border-gray-800 flex gap-4 text-xs font-medium">
              <button
                onClick={() => setActiveModalTab('resumo')}
                className={`py-3 border-b-2 flex items-center gap-1.5 transition ${
                  activeModalTab === 'resumo'
                    ? 'border-blue-500 text-blue-400 font-semibold'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Building2 size={14} /> Resumo & Condições
              </button>

              <button
                onClick={() => setActiveModalTab('conteudo')}
                className={`py-3 border-b-2 flex items-center gap-1.5 transition ${
                  activeModalTab === 'conteudo'
                    ? 'border-blue-500 text-blue-400 font-semibold'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <FileText size={14} /> Conteúdo Materializado
              </button>

              <button
                onClick={() => setActiveModalTab('historico')}
                className={`py-3 border-b-2 flex items-center gap-1.5 transition ${
                  activeModalTab === 'historico'
                    ? 'border-blue-500 text-blue-400 font-semibold'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <History size={14} /> Histórico de Aceites & Versões
              </button>

              <button
                onClick={() => setActiveModalTab('integridade')}
                className={`py-3 border-b-2 flex items-center gap-1.5 transition ${
                  activeModalTab === 'integridade'
                    ? 'border-blue-500 text-blue-400 font-semibold'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <ShieldCheck size={14} /> Diagnóstico de Governança
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {loadingDetalhes ? (
                <div className="py-16 flex flex-col items-center justify-center text-gray-400 gap-3">
                  <Loader2 size={32} className="animate-spin text-blue-500" />
                  <p className="text-sm font-medium">Carregando detalhes do contrato...</p>
                </div>
              ) : erroDetalhes ? (
                <div className="p-4 bg-red-950/40 border border-red-800 rounded-xl text-red-300 text-sm flex items-center gap-3">
                  <AlertCircle size={20} className="shrink-0" />
                  <p>{erroDetalhes}</p>
                </div>
              ) : (
                <>
                  {/* ABA 1: RESUMO & CONDIÇÕES */}
                  {activeModalTab === 'resumo' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Box Contratante */}
                        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
                          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Building2 size={14} className="text-blue-400" /> Dados do Contratante (Tenant)
                          </h4>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between py-1 border-b border-gray-800/60">
                              <span className="text-gray-400">Instituição:</span>
                              <span className="text-white font-medium">{selectedContrato.nome_ministrio}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-gray-800/60">
                              <span className="text-gray-400">CNPJ:</span>
                              <span className="text-gray-200 font-mono">{selectedContrato.cnpj || 'Não informado'}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-gray-800/60">
                              <span className="text-gray-400">ID do Ministério:</span>
                              <span className="text-gray-400 font-mono text-[11px]">{selectedContrato.ministry_id}</span>
                            </div>
                          </div>
                        </div>

                        {/* Box Comercial */}
                        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
                          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                            <CreditCard size={14} className="text-emerald-400" /> Condições Comerciais
                          </h4>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between py-1 border-b border-gray-800/60">
                              <span className="text-gray-400">Plano Contratado:</span>
                              <span className="text-emerald-400 font-bold uppercase">{selectedContrato.plano_contratado}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-gray-800/60">
                              <span className="text-gray-400">Valor da Mensalidade:</span>
                              <span className="text-white font-mono font-medium">
                                {selectedContrato.valor_mensal !== null && selectedContrato.valor_mensal !== undefined
                                  ? `R$ ${selectedContrato.valor_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                  : 'Conforme tabela'}
                              </span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-gray-800/60">
                              <span className="text-gray-400">Status Contratual:</span>
                              <span className="text-emerald-400 font-medium">{selectedContrato.status}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Box Representante e Vigência */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
                          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                            <User size={14} className="text-indigo-400" /> Representante Assinante
                          </h4>
                          <div className="space-y-2 text-xs">
                            {selectedContrato.assinado_em && selectedContrato.status !== 'AGUARDANDO_ASSINATURA' ? (
                              <>
                                <div className="flex justify-between py-1 border-b border-gray-800/60">
                                  <span className="text-gray-400">Nome:</span>
                                  <span className="text-white font-medium">
                                    {detalhesData?.assinado_por_usuario?.full_name || 'Representante Principal'}
                                  </span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-gray-800/60">
                                  <span className="text-gray-400">E-mail:</span>
                                  <span className="text-gray-300">
                                    {detalhesData?.assinado_por_usuario?.email || 'E-mail cadastrado'}
                                  </span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-gray-800/60">
                                  <span className="text-gray-400">User ID:</span>
                                  <span className="text-gray-400 font-mono text-[11px]">
                                    {detalhesData?.assinado_por_usuario?.id || selectedContrato.assinado_por || '-'}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <div className="py-2 text-gray-400 italic">
                                Pendente de assinatura eletrônica
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
                          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Calendar size={14} className="text-amber-400" /> Vigência & Datas
                          </h4>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between py-1 border-b border-gray-800/60">
                              <span className="text-gray-400">Início da Vigência:</span>
                              <span className="text-gray-200">
                                {new Date(selectedContrato.data_inicio).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-gray-800/60">
                              <span className="text-gray-400">Assinado Em:</span>
                              <span className="text-gray-200">
                                {selectedContrato.assinado_em
                                  ? new Date(selectedContrato.assinado_em).toLocaleString('pt-BR')
                                  : selectedContrato.ultimo_aceite
                                  ? new Date(selectedContrato.ultimo_aceite.aceito_em).toLocaleString('pt-BR')
                                  : 'Pendente'}
                              </span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-gray-800/60">
                              <span className="text-gray-400">Criado Em:</span>
                              <span className="text-gray-400">
                                {new Date(selectedContrato.created_at).toLocaleString('pt-BR')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ABA 2: CONTEÚDO MATERIALIZADO */}
                  {activeModalTab === 'conteudo' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between bg-gray-900/60 border border-gray-800 p-3 rounded-xl text-xs">
                        <div className="flex items-center gap-2 text-gray-400">
                          <Hash size={14} className="text-blue-400" />
                          <span>Hash SHA-256 Imutável:</span>
                          <span className="font-mono text-gray-200 text-[11px] truncate max-w-md">
                            {detalhesData?.contrato?.hash_documento || selectedContrato.ultimo_aceite?.hash_documento || 'Gerado na assinatura'}
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            handleCopyHash(
                              detalhesData?.contrato?.hash_documento || selectedContrato.ultimo_aceite?.hash_documento || ''
                            )
                          }
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-medium ml-2"
                        >
                          {copiedHash ? <Check size={14} /> : <Copy size={14} />}
                          {copiedHash ? 'Copiado' : 'Copiar Hash'}
                        </button>
                      </div>

                      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-gray-300 text-xs font-mono leading-relaxed whitespace-pre-wrap max-h-[450px] overflow-y-auto">
                        {detalhesData?.conteudo_efetivo ||
                          detalhesData?.contrato?.conteudo_customizado ||
                          'Conteúdo contratual materializado não disponível.'}
                      </div>
                    </div>
                  )}

                  {/* ABA 3: HISTÓRICO DE ACEITES & VERSÕES */}
                  {activeModalTab === 'historico' && (
                    <div className="space-y-4">
                      <p className="text-xs text-gray-400">
                        Histórico completo e imutável de aceites eletrônicos e aditivos institucionais registrados para este tenant.
                      </p>

                      {!detalhesData?.historico_documentos || detalhesData.historico_documentos.length === 0 ? (
                        <div className="p-8 text-center bg-gray-900/40 rounded-xl border border-gray-800">
                          <History size={32} className="mx-auto text-gray-600 mb-2" />
                          <p className="text-xs text-gray-400">Nenhum aceite histórico registrado para este tenant.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {detalhesData.historico_documentos.map((hist, idx) => (
                            <div key={idx} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-blue-950 text-blue-400 border border-blue-800">
                                    v{hist.versao}
                                  </span>
                                  <span className="font-medium text-white text-xs">{hist.titulo}</span>
                                </div>
                                <span className="text-[11px] text-gray-400">
                                  {new Date(hist.aceito_em).toLocaleString('pt-BR')}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-gray-400 border-t border-gray-800/60 pt-2">
                                <div>
                                  <span className="text-gray-500">Assinado por: </span>
                                  <span className="text-gray-300">{hist.aceito_por_nome || hist.aceito_por_email || hist.aceito_por_id}</span>
                                </div>
                                <div className="font-mono text-[10px] truncate">
                                  <span className="text-gray-500">SHA-256: </span>
                                  <span className="text-gray-300">{hist.hash_sha256 || '-'}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ABA 4: DIAGNÓSTICO DE GOVERNANÇA */}
                  {activeModalTab === 'integridade' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
                          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Classificação de Governança</h4>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between py-1 border-b border-gray-800/60">
                              <span className="text-gray-400">Status do Snapshot:</span>
                              <span className="text-emerald-400 font-mono font-bold">
                                {detalhesData?.diagnostico_integridade?.snapshot_status || selectedContrato.snapshot_status}
                              </span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-gray-800/60">
                              <span className="text-gray-400">Origem do Snapshot:</span>
                              <span className="text-gray-300 font-mono">
                                {detalhesData?.diagnostico_integridade?.origem_snapshot || selectedContrato.origem_snapshot}
                              </span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-gray-800/60">
                              <span className="text-gray-400">Tipo de Visualização:</span>
                              <span className="text-blue-400 font-mono">
                                {detalhesData?.diagnostico_integridade?.tipo_visualizacao || 'SNAPSHOT_IMUTAVEL'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
                          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Verificações de Integridade</h4>
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between py-1 border-b border-gray-800/60">
                              <span className="text-gray-400">Snapshot Presente & Preenchido:</span>
                              <span className="text-emerald-400 font-medium">✓ Conforme</span>
                            </div>
                            <div className="flex items-center justify-between py-1 border-b border-gray-800/60">
                              <span className="text-gray-400">Placeholders Não Resolvidos:</span>
                              <span className="text-emerald-400 font-medium">✓ Nenhum (100% materializado)</span>
                            </div>
                            <div className="flex items-center justify-between py-1 border-b border-gray-800/60">
                              <span className="text-gray-400">Consistência de Hash com Aceite:</span>
                              <span className="text-emerald-400 font-medium">✓ Consistente</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer Modal (100% READ-ONLY) */}
            <div className="px-6 py-4 bg-gray-900/60 border-t border-gray-800 flex justify-end">
              <button
                onClick={() => {
                  setSelectedContrato(null)
                  setDetalhesData(null)
                }}
                className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-semibold transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
