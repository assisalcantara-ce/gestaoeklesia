'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useAuditLog } from '@/hooks/useAuditLog'
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth'
import PageLayout from '@/components/PageLayout'
import { useAppDialog } from '@/providers/AppDialogProvider'

type TicketStatus = 'aberto' | 'em_progresso' | 'resolvido' | 'fechado'
type TicketPriority = 'baixa' | 'media' | 'alta' | 'critica'

interface Ticket {
  id: string
  titulo: string
  descricao: string
  status: TicketStatus
  prioridade: TicketPriority
  categoria: string
  data_criacao: string
  data_atualizacao: string
  respondido_em?: string
  usuario_id: string
}

interface NovoTicket {
  titulo: string
  descricao: string
  categoria: string
  prioridade: TicketPriority
}

export default function SuportePage() {
  const supabase = createClient()
  const { registrarAcao } = useAuditLog()
  const { user, loading: authLoading } = useRequireSupabaseAuth()
  const dialog = useAppDialog()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState<TicketStatus | 'todos'>('todos')
  const [selecionado, setSelecionado] = useState<Ticket | null>(null)
  const [novoTicket, setNovoTicket] = useState<NovoTicket>({
    titulo: '',
    descricao: '',
    categoria: 'Geral',
    prioridade: 'media',
  })
  const [enviando, setEnviando] = useState(false)

  // Categorias disponíveis
  const categorias = [
    'Geral',
    'Bugs/Erros',
    'Funcionalidade',
    'Performance',
    'Segurança',
    'Dados',
    'Integração',
    'Outro',
  ]

  // Carregar tickets
  useEffect(() => {
    if (authLoading) return
    if (!user) return
    carregarTickets()
  }, [authLoading, user?.id])

  const criarTabelaAutomaticamente = async () => {
    try {
      const response = await fetch('/api/v1/create-tickets-table', {
        method: 'POST',
      })
      if (response.ok) {
        // Esperar um pouco para a tabela ser criada
        await new Promise(resolve => setTimeout(resolve, 2000))
        return true
      }
      return false
    } catch (err) {
      console.error('Erro ao criar tabela:', err)
      return false
    }
  }

  const carregarTickets = async (tentarCriarTabela = true) => {
    try {
      setLoading(true)
      if (!user) return

      // Buscar tickets do usuário
      const { data, error } = await supabase
        .from('tickets_suporte')
        .select('*')
        .eq('usuario_id', user.id)
        .order('data_criacao', { ascending: false })

      if (error) {
        // Verificar se é erro de tabela não encontrada
        if ((error.code === 'PGRST116' || error.message?.includes('not found')) && tentarCriarTabela) {
          console.log('[SUPORTE] Tabela não encontrada. Criando automaticamente...')
          const tabelaCriada = await criarTabelaAutomaticamente()
          if (tabelaCriada) {
            // Tentar carregar novamente após criar a tabela
            await carregarTickets(false)
            return
          } else {
            setError('❌ Erro ao criar tabela de suporte. Tente novamente.')
            return
          }
        } else {
          console.error('[SUPORTE] Erro ao carregar tickets:', {
            codigo: error.code,
            mensagem: error.message,
            detalhes: JSON.stringify(error),
          })
          setError('Erro ao carregar tickets: ' + (error.message || 'Erro desconhecido'))
          return
        }
      }

      // Sucesso! Limpar erro se houver
      setError('')
      setTickets(data || [])
      
      // Registrar ação de visualização de tickets
      if (data && data.length > 0) {
        await registrarAcao({
          acao: 'visualizar',
          modulo: 'suporte',
          area: 'tickets',
          tabela_afetada: 'tickets_suporte',
          descricao: `Visualizou ${data.length} ticket(s)`,
          status: 'sucesso'
        })
      }
    } catch (err) {
      console.error('Erro ao carregar tickets:', err)
      setError('Erro ao carregar tickets. Tente recarregar a página.')
    } finally {
      setLoading(false)
    }
  }

  const handleAbrirTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnviando(true)

    try {
      if (!user) {
        await dialog.alert({ title: 'Atenção', type: 'warning', message: 'Você precisa estar logado para abrir um ticket' })
        return
      }

      // Validação básica
      if (!novoTicket.titulo.trim() || !novoTicket.descricao.trim()) {
        await dialog.alert({ title: 'Atenção', type: 'warning', message: 'Por favor, preencha todos os campos' })
        setEnviando(false)
        return
      }

      // Criar novo ticket
      const { error } = await supabase
        .from('tickets_suporte')
        .insert([
          {
            usuario_id: user.id,
            titulo: novoTicket.titulo,
            descricao: novoTicket.descricao,
            categoria: novoTicket.categoria,
            prioridade: novoTicket.prioridade,
            status: 'aberto',
            data_criacao: new Date().toISOString(),
            data_atualizacao: new Date().toISOString(),
          },
        ])
        .select()

      if (error) {
        // Registrar erro na auditoria
        await registrarAcao({
          acao: 'criar',
          modulo: 'suporte',
          area: 'tickets',
          tabela_afetada: 'tickets_suporte',
          descricao: `Tentativa de abrir novo ticket falhou`,
          status: 'erro',
          mensagem_erro: error.message
        })
        await dialog.alert({ title: 'Erro', type: 'error', message: 'Erro ao abrir ticket: ' + error.message })
        return
      }

      // Registrar sucesso na criação
      await registrarAcao({
        acao: 'criar',
        modulo: 'suporte',
        area: 'tickets',
        tabela_afetada: 'tickets_suporte',
        descricao: `Novo ticket aberto: "${novoTicket.titulo}"`,
        dados_novos: {
          titulo: novoTicket.titulo,
          categoria: novoTicket.categoria,
          prioridade: novoTicket.prioridade
        },
        status: 'sucesso'
      })

      await dialog.alert({ title: 'Sucesso', type: 'success', message: 'Ticket aberto com sucesso!' })
      setNovoTicket({
        titulo: '',
        descricao: '',
        categoria: 'Geral',
        prioridade: 'media',
      })
      setMostrarFormulario(false)
      carregarTickets()
    } catch (err) {
      console.error('Erro ao criar ticket:', err)
      await dialog.alert({ title: 'Erro', type: 'error', message: 'Erro ao abrir ticket' })
    } finally {
      setEnviando(false)
    }
  }

  const getStatusColor = (status: TicketStatus) => {
    switch (status) {
      case 'aberto':
        return 'bg-blue-100 text-blue-800'
      case 'em_progresso':
        return 'bg-yellow-100 text-yellow-800'
      case 'resolvido':
        return 'bg-green-100 text-green-800'
      case 'fechado':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (authLoading) return <div className="p-8">Carregando...</div>

  const getPriorityColor = (prioridade: TicketPriority) => {
    switch (prioridade) {
      case 'baixa':
        return 'text-green-600'
      case 'media':
        return 'text-yellow-600'
      case 'alta':
        return 'text-orange-600'
      case 'critica':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const ticketsFiltrados = filtroStatus === 'todos'
    ? tickets
    : tickets.filter(t => t.status === filtroStatus)

  return (
    <PageLayout
      title="Suporte"
      description="Abra tickets e acompanhe o progresso dos seus atendimentos"
      activeMenu="suporte"
    >
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* ERRO - TABELA NÃO CRIADA (agora será criada automaticamente) */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 rounded-lg">
            <p className="text-red-800 font-semibold">{error}</p>
            <p className="text-red-700 text-sm mt-2">
              🔄 Tente recarregar a página (F5)
            </p>
          </div>
        )}

        {/* BOTÃO ABRIR TICKET */}
        <div className="mb-6">
          <button
            onClick={() => setMostrarFormulario(!mostrarFormulario)}
            className="px-6 py-3 bg-[#0284c7] text-white rounded-lg font-semibold hover:bg-[#0270b0] transition shadow-lg"
          >
            {mostrarFormulario ? '✕ Cancelar' : '+ Abrir Novo Ticket'}
          </button>
        </div>

        {/* FORMULÁRIO NOVO TICKET */}
        {mostrarFormulario && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8 border-t-4 border-[#0284c7]">
            <h2 className="text-2xl font-bold text-[#123b63] mb-6">Abrir Novo Ticket</h2>
            <form onSubmit={handleAbrirTicket} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Título do Ticket *
                </label>
                <input
                  type="text"
                  value={novoTicket.titulo}
                  onChange={(e) =>
                    setNovoTicket({ ...novoTicket, titulo: e.target.value })
                  }
                  placeholder="Descreva brevemente o assunto"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0284c7] focus:ring-2 focus:ring-[#0284c7]/20"
                  maxLength={100}
                />
                <p className="text-xs text-gray-500 mt-1">{novoTicket.titulo.length}/100</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Descrição *
                </label>
                <textarea
                  value={novoTicket.descricao}
                  onChange={(e) =>
                    setNovoTicket({ ...novoTicket, descricao: e.target.value })
                  }
                  placeholder="Descreva em detalhes o problema ou solicitação"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0284c7] focus:ring-2 focus:ring-[#0284c7]/20 h-24 resize-none"
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1">{novoTicket.descricao.length}/500</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Categoria
                  </label>
                  <select
                    value={novoTicket.categoria}
                    onChange={(e) =>
                      setNovoTicket({ ...novoTicket, categoria: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0284c7] focus:ring-2 focus:ring-[#0284c7]/20"
                  >
                    {categorias.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Prioridade
                  </label>
                  <select
                    value={novoTicket.prioridade}
                    onChange={(e) =>
                      setNovoTicket({
                        ...novoTicket,
                        prioridade: e.target.value as TicketPriority,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0284c7] focus:ring-2 focus:ring-[#0284c7]/20"
                  >
                    <option value="baixa">🟢 Baixa</option>
                    <option value="media">🟡 Média</option>
                    <option value="alta">🟠 Alta</option>
                    <option value="critica">🔴 Crítica</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={enviando}
                  className="flex-1 px-6 py-3 bg-[#0284c7] text-white rounded-lg font-semibold hover:bg-[#0270b0] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {enviando ? '⏳ Enviando...' : '✓ Abrir Ticket'}
                </button>
                <button
                  type="button"
                  onClick={() => setMostrarFormulario(false)}
                  className="flex-1 px-6 py-3 bg-gray-300 text-gray-800 rounded-lg font-semibold hover:bg-gray-400 transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* FILTROS */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {['todos', 'aberto', 'em_progresso', 'resolvido', 'fechado'].map((status) => (
            <button
              key={status}
              onClick={() => setFiltroStatus(status as TicketStatus | 'todos')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                filtroStatus === status
                  ? 'bg-[#0284c7] text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {status === 'todos' ? 'Todos' : status.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>

        {/* LISTA DE TICKETS */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin mb-4">
              <svg
                className="w-12 h-12 mx-auto text-[#0284c7]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
            <p className="text-gray-600">Carregando tickets...</p>
          </div>
        ) : ticketsFiltrados.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600 text-lg">📭 Nenhum ticket {filtroStatus !== 'todos' ? 'nesta categoria' : 'encontrado'}</p>
            <button
              onClick={() => setMostrarFormulario(true)}
              className="mt-4 px-6 py-2 bg-[#0284c7] text-white rounded-lg hover:bg-[#0270b0] transition"
            >
              Abrir primeiro ticket
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {ticketsFiltrados.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => setSelecionado(ticket)}
                className="bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer border-l-4 border-[#0284c7]"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-[#123b63] mb-1">#{ticket.id.slice(0, 8).toUpperCase()}</h3>
                      <p className="text-lg font-semibold text-gray-800">{ticket.titulo}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(ticket.status)}`}>
                      {ticket.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>

                  <p className="text-gray-600 mb-3 line-clamp-2">{ticket.descricao}</p>

                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Categoria:</span>
                      <span className="font-semibold text-gray-800">{ticket.categoria}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Prioridade:</span>
                      <span className={`font-bold ${getPriorityColor(ticket.prioridade)}`}>
                        {ticket.prioridade.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Criado em:</span>
                      <span className="font-semibold text-gray-800">
                        {new Date(ticket.data_criacao).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* DETALHES DO TICKET SELECIONADO */}
        {selecionado && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-96 overflow-y-auto">
              <div className="bg-[#0284c7] text-white p-6 border-b">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-white/70">#{selecionado.id.slice(0, 8).toUpperCase()}</p>
                    <h2 className="text-2xl font-bold">{selecionado.titulo}</h2>
                  </div>
                  <button
                    onClick={() => setSelecionado(null)}
                    className="text-white hover:bg-white/20 rounded p-2 transition"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <h3 className="font-bold text-gray-700 mb-2">Descrição</h3>
                  <p className="text-gray-600 bg-gray-50 p-4 rounded">{selecionado.descricao}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-bold text-gray-700 mb-1">Status</h3>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(selecionado.status)}`}>
                      {selecionado.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-700 mb-1">Prioridade</h3>
                    <span className={`font-bold ${getPriorityColor(selecionado.prioridade)}`}>
                      {selecionado.prioridade.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-700 mb-1">Categoria</h3>
                    <p className="text-gray-600">{selecionado.categoria}</p>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-700 mb-1">Criado em</h3>
                    <p className="text-gray-600">{new Date(selecionado.data_criacao).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  )
}
