'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useAuditLog } from '@/hooks/useAuditLog'
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth'
import PageLayout from '@/components/PageLayout'
import { useAppDialog } from '@/providers/AppDialogProvider'

type TicketStatus = 'aberto' | 'em_progresso' | 'resolvido' | 'fechado' | 'aguardando_cliente'
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
  ministry_id: string
  ticket_number?: string
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
  const [ministryId, setMinistryId] = useState<string | null>(null)
  const [mensagens, setMensagens] = useState<Array<{ id: string; user_id: string; message: string; created_at: string }>>([])
  const [carregandoMensagens, setCarregandoMensagens] = useState(false)
  const [resposta, setResposta] = useState('')
  const [enviandoResposta, setEnviandoResposta] = useState(false)
  const [mostrarResposta, setMostrarResposta] = useState(false)
  const [suporteRespondeu, setSuporteRespondeu] = useState(false)
  const [podeEditarDescricao, setPodeEditarDescricao] = useState(false)
  const [descricaoEditada, setDescricaoEditada] = useState('')
  const [salvandoDescricao, setSalvandoDescricao] = useState(false)
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

  const resolveMinistryId = async () => {
    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()

      if (!currentUser) return null

      const { data: mu, error: muErr } = await supabase
        .from('ministry_users')
        .select('ministry_id')
        .eq('user_id', currentUser.id)
        .maybeSingle()

      if (!muErr && mu?.ministry_id) return mu.ministry_id as string

      const { data: m, error: mErr } = await supabase
        .from('ministries')
        .select('id')
        .eq('user_id', currentUser.id)
        .maybeSingle()

      if (!mErr && m?.id) return m.id as string
    } catch {
      return null
    }
    return null
  }

  // Carregar tickets
  useEffect(() => {
    if (authLoading) return
    if (!user) return
    resolveMinistryId().then((resolved) => {
      setMinistryId(resolved)
    })
  }, [authLoading, user?.id])

  useEffect(() => {
    if (!user || !ministryId) return
    carregarTickets()
  }, [user?.id, ministryId])

  useEffect(() => {
    if (!user || !ministryId) return
    const intervalId = setInterval(() => {
      carregarTickets()
    }, 20000)

    return () => clearInterval(intervalId)
  }, [user?.id, ministryId])

  useEffect(() => {
    if (!selecionado) return
    carregarMensagens(selecionado.id)
    setMostrarResposta(selecionado.status !== 'aguardando_cliente')
    setDescricaoEditada(selecionado.descricao)
  }, [selecionado?.id])

  useEffect(() => {
    if (!selecionado || !user || !ministryId) return
    const intervalId = setInterval(() => {
      carregarMensagens(selecionado.id)
      carregarTickets()
    }, 10000)

    return () => clearInterval(intervalId)
  }, [selecionado?.id, user?.id, ministryId])

  const mapStatusFromDb = (status: string | null): TicketStatus => {
    switch (status) {
      case 'open':
        return 'aberto'
      case 'in_progress':
        return 'em_progresso'
      case 'resolved':
        return 'fechado'
      case 'closed':
        return 'fechado'
      case 'waiting_customer':
        return 'aguardando_cliente'
      default:
        return 'aberto'
    }
  }

  const mapPriorityFromDb = (priority: string | null): TicketPriority => {
    switch (priority) {
      case 'low':
        return 'baixa'
      case 'high':
        return 'alta'
      case 'urgent':
        return 'critica'
      default:
        return 'media'
    }
  }

  const mapStatusToDb = (status: TicketStatus) => {
    switch (status) {
      case 'aberto':
        return 'open'
      case 'em_progresso':
        return 'in_progress'
      case 'resolvido':
        return 'resolved'
      case 'fechado':
        return 'closed'
      case 'aguardando_cliente':
        return 'waiting_customer'
      default:
        return 'open'
    }
  }

  const mapPriorityToDb = (priority: TicketPriority) => {
    switch (priority) {
      case 'baixa':
        return 'low'
      case 'alta':
        return 'high'
      case 'critica':
        return 'urgent'
      default:
        return 'medium'
    }
  }

  const carregarTickets = async () => {
    try {
      setLoading(true)
      if (!user || !ministryId) return

      // Buscar tickets do usuário
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('[SUPORTE] Erro ao carregar tickets:', {
          codigo: error.code,
          mensagem: error.message,
          detalhes: JSON.stringify(error),
        })
        setError('Erro ao carregar tickets: ' + (error.message || 'Erro desconhecido'))
        return
      }

      // Sucesso! Limpar erro se houver
      setError('')
      const mapped = (data || []).map((row: any) => ({
        id: row.id,
        titulo: row.subject,
        descricao: row.description,
        status: mapStatusFromDb(row.status),
        prioridade: mapPriorityFromDb(row.priority),
        categoria: row.category,
        data_criacao: row.created_at,
        data_atualizacao: row.updated_at,
        respondido_em: row.response_at || row.resolved_at,
        usuario_id: row.user_id,
        ministry_id: row.ministry_id,
        ticket_number: row.ticket_number,
      }))
      const statusOrder: Record<TicketStatus, number> = {
        aberto: 0,
        em_progresso: 1,
        aguardando_cliente: 2,
        resolvido: 3,
        fechado: 4,
      }
      const sorted = [...mapped].sort((a, b) => {
        const orderDiff = statusOrder[a.status] - statusOrder[b.status]
        if (orderDiff !== 0) return orderDiff
        return new Date(b.data_criacao).getTime() - new Date(a.data_criacao).getTime()
      })
      setTickets(sorted)

      if (selecionado) {
        const updatedSelected = mapped.find((ticket) => ticket.id === selecionado.id)
        if (updatedSelected) {
          setSelecionado(updatedSelected)
        }
      }
      
      // Registrar ação de visualização de tickets
      if (data && data.length > 0) {
        await registrarAcao({
          acao: 'visualizar',
          modulo: 'suporte',
          area: 'tickets',
          tabela_afetada: 'support_tickets',
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

  const carregarMensagens = async (ticketId: string) => {
    try {
      setCarregandoMensagens(true)
      const { data, error } = await supabase
        .from('support_ticket_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('[SUPORTE] Erro ao carregar mensagens:', error)
        return
      }

      const visible = (data || [])
        .filter((msg: any) => msg.is_internal !== true)
        .map((msg: any) => ({
          id: msg.id,
          user_id: msg.user_id,
          message: msg.message,
          created_at: msg.created_at,
        }))
      setMensagens(visible)
      const suporteRespondeuLocal = visible.some((msg) => msg.user_id !== user?.id)
      setSuporteRespondeu(suporteRespondeuLocal)
      const podeEditar = selecionado?.status === 'aberto' && !selecionado?.respondido_em && !suporteRespondeuLocal
      setPodeEditarDescricao(Boolean(podeEditar))
    } finally {
      setCarregandoMensagens(false)
    }
  }

  const salvarDescricao = async () => {
    if (!selecionado || !user) return
    if (!descricaoEditada.trim()) {
      await dialog.alert({ title: 'Atenção', type: 'warning', message: 'A descrição não pode ficar vazia.' })
      return
    }

    try {
      setSalvandoDescricao(true)
      const { error: updateError } = await supabase
        .from('support_tickets')
        .update({ description: descricaoEditada.trim(), updated_at: new Date().toISOString() })
        .eq('id', selecionado.id)

      if (updateError) {
        await dialog.alert({ title: 'Erro', type: 'error', message: updateError.message })
        return
      }

      setSelecionado({ ...selecionado, descricao: descricaoEditada.trim(), data_atualizacao: new Date().toISOString() })
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === selecionado.id
            ? { ...ticket, descricao: descricaoEditada.trim(), data_atualizacao: new Date().toISOString() }
            : ticket,
        ),
      )
    } finally {
      setSalvandoDescricao(false)
    }
  }

  const enviarResposta = async () => {
    if (!user || !selecionado || !resposta.trim()) return

    try {
      setEnviandoResposta(true)
      const { error: insertError } = await supabase
        .from('support_ticket_messages')
        .insert({
          ticket_id: selecionado.id,
          user_id: user.id,
          message: resposta,
          is_internal: false,
        })

      if (insertError) {
        await dialog.alert({ title: 'Erro', type: 'error', message: insertError.message })
        return
      }

      const { error: updateError } = await supabase
        .from('support_tickets')
        .update({ status: mapStatusToDb('em_progresso'), updated_at: new Date().toISOString() })
        .eq('id', selecionado.id)

      if (updateError) {
        await dialog.alert({ title: 'Erro', type: 'error', message: updateError.message })
        return
      }

      setResposta('')
      await carregarMensagens(selecionado.id)
      await carregarTickets()
    } finally {
      setEnviandoResposta(false)
    }
  }

  const reabrirTicket = async () => {
    if (!user || !selecionado) return

    try {
      setEnviandoResposta(true)
      const { error: updateError } = await supabase
        .from('support_tickets')
        .update({ status: mapStatusToDb('aberto'), updated_at: new Date().toISOString() })
        .eq('id', selecionado.id)

      if (updateError) {
        await dialog.alert({ title: 'Erro', type: 'error', message: updateError.message })
        return
      }

      setSelecionado({ ...selecionado, status: 'aberto', data_atualizacao: new Date().toISOString() })
      await carregarTickets()
    } finally {
      setEnviandoResposta(false)
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

      if (!ministryId) {
        await dialog.alert({ title: 'Erro', type: 'error', message: 'Ministério não encontrado para este usuário.' })
        return
      }

      // Criar novo ticket
      const { error } = await supabase
        .from('support_tickets')
        .insert([
          {
            ministry_id: ministryId,
            user_id: user.id,
            subject: novoTicket.titulo,
            description: novoTicket.descricao,
            category: novoTicket.categoria,
            priority: mapPriorityToDb(novoTicket.prioridade),
            status: mapStatusToDb('aberto'),
          },
        ])
        .select()

      if (error) {
        // Registrar erro na auditoria
        await registrarAcao({
          acao: 'criar',
          modulo: 'suporte',
          area: 'tickets',
          tabela_afetada: 'support_tickets',
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
        tabela_afetada: 'support_tickets',
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
        return 'bg-red-50 text-red-700'
      case 'aguardando_cliente':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getCardBorderColor = (status: TicketStatus) => {
    switch (status) {
      case 'aberto':
        return 'border-blue-400'
      case 'em_progresso':
        return 'border-yellow-400'
      case 'aguardando_cliente':
        return 'border-purple-400'
      case 'resolvido':
        return 'border-green-400'
      case 'fechado':
        return 'border-red-300'
      default:
        return 'border-gray-300'
    }
  }

  const getStatusLabel = (status: TicketStatus) => {
    switch (status) {
      case 'aberto':
        return 'Aberto'
      case 'em_progresso':
        return 'Em progresso'
      case 'resolvido':
        return 'Resolvido'
      case 'fechado':
        return 'Fechado'
      case 'aguardando_cliente':
        return 'Aguardando cliente'
      default:
        return 'Aberto'
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
        {/* ERRO */}
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
        <div className="mb-6 flex gap-2 flex-wrap items-center">
          {['todos', 'aberto', 'em_progresso', 'aguardando_cliente', 'fechado'].map((status) => (
            <button
              key={status}
              onClick={() => setFiltroStatus(status as TicketStatus | 'todos')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                filtroStatus === status
                  ? 'bg-[#0284c7] text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {status === 'todos' ? 'Todos' : getStatusLabel(status as TicketStatus)}
            </button>
          ))}
          <button
            onClick={carregarTickets}
            className="px-4 py-2 rounded-lg font-semibold bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
          >
            Atualizar
          </button>
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
                className={`bg-white rounded-lg shadow hover:shadow-lg transition border-l-4 ${getCardBorderColor(ticket.status)}`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className={`text-xl font-bold mb-1 ${getStatusColor(ticket.status)}`}>
                        #{ticket.ticket_number || ticket.id.slice(0, 8).toUpperCase()}
                      </h3>
                      <p className="text-lg font-semibold text-gray-800">{ticket.titulo}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(ticket.status)}`}>
                        {getStatusLabel(ticket.status)}
                      </span>
                      {ticket.status === 'aguardando_cliente' && (
                        <button
                          onClick={(event) => {
                            event.stopPropagation()
                            setSelecionado(ticket)
                            setMostrarResposta(true)
                          }}
                          className="px-3 py-1 text-xs font-semibold rounded-full bg-[#123b63] text-white hover:bg-[#0f2f4d] transition"
                        >
                          Responder ticket
                        </button>
                      )}
                      {ticket.status === 'aberto' && !ticket.respondido_em && (
                        <button
                          onClick={(event) => {
                            event.stopPropagation()
                            setSelecionado(ticket)
                            setMostrarResposta(false)
                          }}
                          className="px-3 py-1 text-xs font-semibold rounded-full bg-white text-[#123b63] border border-[#123b63]/20 hover:bg-[#123b63] hover:text-white transition"
                        >
                          Visualizar
                        </button>
                      )}
                      {ticket.status === 'em_progresso' && (
                        <button
                          onClick={(event) => {
                            event.stopPropagation()
                            setSelecionado(ticket)
                            setMostrarResposta(true)
                          }}
                          className="px-3 py-1 text-xs font-semibold rounded-full bg-white text-[#123b63] border border-[#123b63]/20 hover:bg-[#123b63] hover:text-white transition"
                        >
                          Visualizar
                        </button>
                      )}
                      {ticket.status === 'fechado' && (
                        <button
                          onClick={(event) => {
                            event.stopPropagation()
                            setSelecionado(ticket)
                            setMostrarResposta(true)
                          }}
                          className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-700 text-white hover:bg-gray-800 transition"
                        >
                          Reabrir e enviar
                        </button>
                      )}
                    </div>
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
                    {ticket.respondido_em && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Respondido em:</span>
                        <span className="font-semibold text-gray-800">
                          {new Date(ticket.respondido_em).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* DETALHES DO TICKET SELECIONADO */}
        {selecionado && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden">
              <div className="relative bg-gradient-to-r from-[#0f2f4d] via-[#123b63] to-[#1b6aa5] text-white px-8 py-7">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/70">Ticket</p>
                    <h2 className="text-2xl font-bold">{selecionado.titulo}</h2>
                    <p className="text-sm text-white/80 mt-1">#{selecionado.ticket_number || selecionado.id.slice(0, 8).toUpperCase()}</p>
                  </div>
                  <button
                    onClick={() => setSelecionado(null)}
                    className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-2 transition"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selecionado.status)}`}>
                    {getStatusLabel(selecionado.status)}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-white">
                    Prioridade {selecionado.prioridade.toUpperCase()}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-white">
                    Categoria {selecionado.categoria}
                  </span>
                </div>
              </div>

              <div className="px-6 lg:px-8 pb-8">
                <div className="mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-0">
                  <div className="p-6 border-b lg:border-b-0 lg:border-r border-gray-100 space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Resumo</h3>
                      {podeEditarDescricao && (
                        <span className="text-xs text-gray-400">Editável antes da resposta do suporte</span>
                      )}
                    </div>
                    {podeEditarDescricao ? (
                      <div className="space-y-3">
                        <textarea
                          value={descricaoEditada}
                          onChange={(e) => setDescricaoEditada(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0284c7] focus:ring-2 focus:ring-[#0284c7]/20 h-28 resize-none leading-relaxed"
                          placeholder="Descreva seu problema"
                        />
                        <div className="flex justify-end">
                          <button
                            onClick={salvarDescricao}
                            disabled={salvandoDescricao}
                            className="px-4 py-2 bg-[#123b63] text-white rounded-lg font-semibold hover:bg-[#0f2f4d] transition disabled:opacity-50"
                          >
                            {salvandoDescricao ? 'Salvando...' : 'Salvar alterações'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-700 bg-gray-50 border border-gray-100 rounded-xl p-4 leading-relaxed">
                        {selecionado.descricao}
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Conversas</h3>
                      <span className="text-xs text-gray-400">Atualiza automaticamente</span>
                    </div>
                    {carregandoMensagens ? (
                      <p className="text-gray-500 text-sm">Carregando mensagens...</p>
                    ) : mensagens.length === 0 ? (
                      <p className="text-gray-500 text-sm">Nenhuma mensagem ainda.</p>
                    ) : (
                      <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                        {mensagens.map((msg) => (
                          <div
                            key={msg.id}
                            className={`rounded-xl p-3 border ${msg.user_id === user?.id ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}
                          >
                            <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                              <span className="inline-flex items-center gap-2 font-semibold">
                                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${msg.user_id === user?.id ? 'bg-yellow-200 text-yellow-800' : 'bg-green-200 text-green-800'}`}>
                                  {msg.user_id === user?.id ? 'VC' : 'SP'}
                                </span>
                                {msg.user_id === user?.id ? 'Você' : 'Suporte'}
                              </span>
                              <span>{new Date(msg.created_at).toLocaleString('pt-BR')}</span>
                            </div>
                            <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">{msg.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                  <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="rounded-xl border border-gray-100 p-3">
                      <p className="text-xs text-gray-400 uppercase tracking-widest">Criado em</p>
                      <p className="font-semibold text-gray-700 mt-1">
                        {new Date(selecionado.data_criacao).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-100 p-3">
                      <p className="text-xs text-gray-400 uppercase tracking-widest">Atualizado</p>
                      <p className="font-semibold text-gray-700 mt-1">
                        {new Date(selecionado.data_atualizacao).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Responder</h3>
                      <span className="text-xs text-gray-400">Envie sua mensagem</span>
                    </div>
                    {(selecionado.status === 'em_progresso' || suporteRespondeu) && (selecionado.status === 'aguardando_cliente' || selecionado.status === 'fechado' || selecionado.status === 'em_progresso' || mostrarResposta) ? (
                      <>
                        <textarea
                          value={resposta}
                          onChange={(e) => setResposta(e.target.value)}
                          className="w-full px-5 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:border-[#0284c7] focus:ring-2 focus:ring-[#0284c7]/20 h-44 resize-none leading-relaxed"
                          placeholder="Digite sua resposta"
                        />
                        <div className="flex justify-end">
                          <button
                            onClick={enviarResposta}
                            disabled={enviandoResposta}
                            className="px-5 py-2 bg-[#0284c7] text-white rounded-lg font-semibold hover:bg-[#0270b0] transition disabled:opacity-50"
                          >
                            {enviandoResposta
                              ? 'Enviando...'
                              : selecionado.status === 'fechado'
                                ? 'Reabrir e enviar mensagem'
                                : 'Enviar'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500">Aguardando resposta do suporte.</p>
                    )}
                  </div>
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
