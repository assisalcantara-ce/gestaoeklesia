'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { authenticatedFetch } from '@/lib/api-client'
import {
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Search,
  Filter,
  Eye,
  X,
  Building2,
  User,
  FileText,
  Hash,
  Globe,
  Monitor,
  Calendar,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Layers,
} from 'lucide-react'

interface ItemAceiteAdmin {
  id: string
  ministry_id: string
  nome_tenant: string
  ministry_name: string
  user_id: string
  nome_usuario: string
  user_name: string
  user_email: string | null
  documento_id: string
  documento_titulo: string
  documento_tipo: string
  documento_escopo: string
  versao_aceita: string
  hash_documento: string
  ip_address: string | null
  user_agent: string | null
  payload_aceite: Record<string, any>
  aceito_em: string
  created_at: string
}

export default function AceitesPage() {
  const [aceites, setAceites] = useState<ItemAceiteAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros e Busca
  const [searchTerm, setSearchTerm] = useState('')
  const [filterEscopo, setFilterEscopo] = useState('TODOS')
  const [filterTipo, setFilterTipo] = useState('TODOS')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  // Modal de Detalhes (READ-ONLY)
  const [selectedAceite, setSelectedAceite] = useState<ItemAceiteAdmin | null>(null)
  const [copiedHash, setCopiedHash] = useState(false)

  const carregarAceites = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await authenticatedFetch('/api/v1/admin/juridico/aceites')
      if (!res.ok) {
        throw new Error('Falha ao carregar os registros de aceites eletrônicos.')
      }
      const json = await res.json()
      if (json.success) {
        setAceites(json.data || [])
      } else {
        throw new Error(json.error || 'Erro ao consultar aceites.')
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao carregar os registros de aceite.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarAceites()
  }, [])

  // Métricas Executivas derivadas dos registros reais
  const totalAceites = aceites.length
  const totalInstitucionais = aceites.filter(
    (a) => a.documento_escopo === 'INSTITUCIONAL' || ['CONTRATO_SERVICO', 'ADITIVO'].includes(a.documento_tipo)
  ).length
  const totalIndividuais = aceites.filter(
    (a) => a.documento_escopo === 'INDIVIDUAL' || ['TERMOS_DE_USO', 'POLITICA_PRIVACIDADE'].includes(a.documento_tipo)
  ).length

  // Filtragem e Busca
  const aceitesFiltrados = useMemo(() => {
    return aceites.filter((item) => {
      const term = searchTerm.toLowerCase().trim()
      const matchesSearch =
        !term ||
        item.nome_tenant.toLowerCase().includes(term) ||
        item.nome_usuario.toLowerCase().includes(term) ||
        (item.user_email && item.user_email.toLowerCase().includes(term)) ||
        item.documento_titulo.toLowerCase().includes(term) ||
        item.versao_aceita.toLowerCase().includes(term) ||
        (item.ip_address && item.ip_address.includes(term))

      const matchesEscopo = filterEscopo === 'TODOS' || item.documento_escopo === filterEscopo
      const matchesTipo = filterTipo === 'TODOS' || item.documento_tipo === filterTipo

      return matchesSearch && matchesEscopo && matchesTipo
    })
  }, [aceites, searchTerm, filterEscopo, filterTipo])

  // Paginação
  const totalPages = Math.max(1, Math.ceil(aceitesFiltrados.length / itemsPerPage))
  const paginatedAceites = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return aceitesFiltrados.slice(start, start + itemsPerPage)
  }, [aceitesFiltrados, currentPage])

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
          <h2 className="text-lg font-bold text-white tracking-tight">Registro de Aceites Eletrônicos</h2>
          <p className="text-xs text-gray-400">
            Evidências jurídicas imutáveis de aceites de termos, políticas e contratos institucionais.
          </p>
        </div>
        <button
          onClick={carregarAceites}
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
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Total de Aceites</p>
            <h3 className="text-2xl font-bold text-white mt-1">{loading ? '-' : totalAceites}</h3>
          </div>
          <div className="p-3 bg-blue-600/10 text-blue-400 rounded-lg border border-blue-500/20">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Aceites Institucionais</p>
            <h3 className="text-2xl font-bold text-purple-400 mt-1">{loading ? '-' : totalInstitucionais}</h3>
          </div>
          <div className="p-3 bg-purple-600/10 text-purple-400 rounded-lg border border-purple-500/20">
            <Building2 size={20} />
          </div>
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Aceites Individuais</p>
            <h3 className="text-2xl font-bold text-amber-400 mt-1">{loading ? '-' : totalIndividuais}</h3>
          </div>
          <div className="p-3 bg-amber-600/10 text-amber-400 rounded-lg border border-amber-500/20">
            <User size={20} />
          </div>
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Registros Auditados</p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">{loading ? '-' : totalAceites}</h3>
          </div>
          <div className="p-3 bg-emerald-600/10 text-emerald-400 rounded-lg border border-emerald-500/20">
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
            placeholder="Buscar por usuário, tenant, versão, IP..."
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
            <span className="text-xs text-gray-400 font-medium">Filtros:</span>
          </div>

          <select
            value={filterEscopo}
            onChange={(e) => {
              setFilterEscopo(e.target.value)
              setCurrentPage(1)
            }}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
          >
            <option value="TODOS">Todos os Escopos</option>
            <option value="INSTITUCIONAL">INSTITUCIONAL</option>
            <option value="INDIVIDUAL">INDIVIDUAL</option>
          </select>

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
        </div>
      </div>

      {/* Tabela de Aceites */}
      <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-gray-400 gap-3">
            <Loader2 size={32} className="animate-spin text-blue-500" />
            <p className="text-sm font-medium">Carregando evidências de aceite eletrônico...</p>
          </div>
        ) : paginatedAceites.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 size={40} className="mx-auto text-gray-600 mb-3" />
            <h3 className="text-base font-medium text-gray-300">Nenhum aceite registrado</h3>
            <p className="text-xs text-gray-500 mt-1">
              Nenhum registro atende aos filtros de pesquisa ou não há aceites efetuados no sistema.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-900/50 text-xs uppercase text-gray-400 border-b border-gray-800">
                <tr>
                  <th className="px-6 py-3.5">Tenant / Ministério</th>
                  <th className="px-6 py-3.5">Usuário Responsável</th>
                  <th className="px-6 py-3.5">Documento & Escopo</th>
                  <th className="px-6 py-3.5">Versão Aceita</th>
                  <th className="px-6 py-3.5">Data do Aceite</th>
                  <th className="px-6 py-3.5">IP de Origem</th>
                  <th className="px-6 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {paginatedAceites.map((aceite) => (
                  <tr key={aceite.id} className="hover:bg-gray-900/40 transition-colors">
                    {/* Tenant / Ministério */}
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{aceite.nome_tenant}</div>
                      <div className="text-[11px] text-gray-400 font-mono">{aceite.ministry_id.slice(0, 8)}...</div>
                    </td>

                    {/* Usuário Responsável */}
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-200">{aceite.nome_usuario}</div>
                      <div className="text-xs text-gray-400">{aceite.user_email || '-'}</div>
                    </td>

                    {/* Documento & Escopo */}
                    <td className="px-6 py-4">
                      <div className="text-gray-200 text-xs font-medium">{aceite.documento_titulo}</div>
                      <div className="inline-flex items-center gap-1.5 mt-1">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                            aceite.documento_escopo === 'INSTITUCIONAL'
                              ? 'bg-purple-950 text-purple-400 border border-purple-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}
                        >
                          {aceite.documento_escopo}
                        </span>
                        <span className="text-gray-500 text-[10px] font-mono">({aceite.documento_tipo})</span>
                      </div>
                    </td>

                    {/* Versão Aceita */}
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-blue-950 text-blue-400 border border-blue-800">
                        v{aceite.versao_aceita}
                      </span>
                    </td>

                    {/* Data do Aceite */}
                    <td className="px-6 py-4 text-xs text-gray-300">
                      <div>{new Date(aceite.aceito_em).toLocaleDateString('pt-BR')}</div>
                      <div className="text-gray-500 text-[11px]">{new Date(aceite.aceito_em).toLocaleTimeString('pt-BR')}</div>
                    </td>

                    {/* IP de Origem */}
                    <td className="px-6 py-4 text-xs font-mono text-gray-400">
                      {aceite.ip_address || 'desconhecido'}
                    </td>

                    {/* Ações */}
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedAceite(aceite)}
                        className="p-2 hover:bg-blue-600/10 text-gray-400 hover:text-blue-400 border border-transparent hover:border-blue-500/20 rounded-lg transition"
                        title="Visualizar Evidência do Aceite"
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
        {!loading && aceitesFiltrados.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
            <span>
              Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, aceitesFiltrados.length)} a{' '}
              {Math.min(currentPage * itemsPerPage, aceitesFiltrados.length)} de {aceitesFiltrados.length} aceites
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

      {/* MODAL DE VISUALIZAÇÃO DETALHADA DA EVIDÊNCIA DE ACEITE (100% READ-ONLY) */}
      {selectedAceite && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Header Modal */}
            <div className="px-6 py-4 bg-gray-900/60 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-600/10 text-emerald-400 rounded-lg border border-emerald-500/20">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Evidência de Aceite Eletrônico
                    <span className="text-xs px-2 py-0.5 rounded font-mono bg-blue-950 text-blue-400 border border-blue-800 font-normal">
                      v{selectedAceite.versao_aceita}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    ID do Registro: <span className="font-mono text-gray-300">{selectedAceite.id}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedAceite(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Grid 2 colunas: Tenant/Usuário e Documento */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Box 1: Partes Envolvidas */}
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <User size={14} className="text-blue-400" /> Partes Envolvidas
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-gray-800/60">
                      <span className="text-gray-400">Tenant / Ministério:</span>
                      <span className="text-white font-medium">{selectedAceite.nome_tenant}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-800/60">
                      <span className="text-gray-400">Usuário Assinante:</span>
                      <span className="text-gray-200">{selectedAceite.nome_usuario}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-800/60">
                      <span className="text-gray-400">E-mail:</span>
                      <span className="text-gray-300">{selectedAceite.user_email || 'Não informado'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-800/60">
                      <span className="text-gray-400">User ID:</span>
                      <span className="text-gray-400 font-mono text-[11px]">{selectedAceite.user_id}</span>
                    </div>
                  </div>
                </div>

                {/* Box 2: Documento Aceito */}
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={14} className="text-purple-400" /> Documento Vinculado
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-gray-800/60">
                      <span className="text-gray-400">Título:</span>
                      <span className="text-white font-medium">{selectedAceite.documento_titulo}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-800/60">
                      <span className="text-gray-400">Tipo:</span>
                      <span className="text-gray-300 font-mono">{selectedAceite.documento_tipo}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-800/60">
                      <span className="text-gray-400">Escopo:</span>
                      <span className="text-purple-400 font-medium font-mono">{selectedAceite.documento_escopo}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-800/60">
                      <span className="text-gray-400">Versão Aceita:</span>
                      <span className="text-blue-400 font-bold font-mono">v{selectedAceite.versao_aceita}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Box 3: Auditoria Técnica (IP, Data, User Agent) */}
              <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe size={14} className="text-emerald-400" /> Metadados de Auditoria & Origem
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="flex justify-between py-1 border-b border-gray-800/60">
                    <span className="text-gray-400 flex items-center gap-1">
                      <Calendar size={12} /> Data/Hora do Aceite:
                    </span>
                    <span className="text-gray-200">
                      {new Date(selectedAceite.aceito_em).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-800/60">
                    <span className="text-gray-400 flex items-center gap-1">
                      <Globe size={12} /> Endereço IP:
                    </span>
                    <span className="text-emerald-400 font-mono font-medium">
                      {selectedAceite.ip_address || 'desconhecido'}
                    </span>
                  </div>
                </div>
                <div className="text-xs pt-1">
                  <span className="text-gray-400 flex items-center gap-1 mb-1">
                    <Monitor size={12} /> User Agent / Dispositivo:
                  </span>
                  <div className="bg-gray-950 p-2.5 rounded-lg text-gray-300 font-mono text-[11px] break-all border border-gray-800">
                    {selectedAceite.user_agent || 'Não capturado'}
                  </div>
                </div>
              </div>

              {/* Box 4: Criptografia & Hash SHA-256 */}
              <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Hash size={14} className="text-blue-400" /> Hash SHA-256 do Documento
                  </h4>
                  <button
                    onClick={() => handleCopyHash(selectedAceite.hash_documento)}
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-medium"
                  >
                    {copiedHash ? <Check size={14} /> : <Copy size={14} />}
                    {copiedHash ? 'Copiado' : 'Copiar Hash'}
                  </button>
                </div>
                <div className="bg-gray-950 p-3 rounded-lg text-gray-200 font-mono text-xs break-all border border-gray-800">
                  {selectedAceite.hash_documento || 'Hash não calculado'}
                </div>
              </div>

              {/* Box 5: Payload de Aceite */}
              {selectedAceite.payload_aceite && Object.keys(selectedAceite.payload_aceite).length > 0 && (
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers size={14} className="text-indigo-400" /> Payload do Aceite
                  </h4>
                  <pre className="bg-gray-950 p-3 rounded-lg text-gray-300 font-mono text-xs overflow-x-auto border border-gray-800">
                    {JSON.stringify(selectedAceite.payload_aceite, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Footer Modal (100% READ-ONLY) */}
            <div className="px-6 py-4 bg-gray-900/60 border-t border-gray-800 flex justify-end">
              <button
                onClick={() => setSelectedAceite(null)}
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
