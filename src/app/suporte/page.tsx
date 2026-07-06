'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { useAuditLog } from '@/hooks/useAuditLog'
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth'
import { useRequireModulo } from '@/hooks/useRequireModulo'
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
  ultimo_autor_id?: string | null
  ultimo_autor_role?: 'support' | 'user' | null
  suporte_respondeu?: boolean
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
  const router = useRouter()
  const supabase = createClient()
  const { registrarAcao } = useAuditLog()
  const { user, loading: authLoading } = useRequireSupabaseAuth()
  const { ctx, bloqueado } = useRequireModulo('suporte')
  const dialog = useAppDialog()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [filtroGrupo, setFiltroGrupo] = useState<'todos' | 'abertos' | 'finalizados'>('todos')
  const [buscaTicket, setBuscaTicket] = useState('')
  const [selecionado, setSelecionado] = useState<Ticket | null>(null)
  const [ministryId, setMinistryId] = useState<string | null>(null)
  const [ministryResolved, setMinistryResolved] = useState(false)
  const [mensagens, setMensagens] = useState<
    Array<{ id: string; user_id: string; message: string; created_at: string; sender_role?: 'support' | 'user' | null }>
  >([])
  const [carregandoMensagens, setCarregandoMensagens] = useState(false)
  const [resposta, setResposta] = useState('')
  const [enviandoResposta, setEnviandoResposta] = useState(false)
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
    if (authLoading || ctx.loading || bloqueado) return
    if (!user) {
      setLoading(false)
      setMinistryResolved(true)
      return
    }
    resolveMinistryId().then((resolved) => {
      setMinistryId(resolved)
      setMinistryResolved(true)
    })
  }, [authLoading, ctx.loading, bloqueado, user?.id])

  useEffect(() => {
    if (!user || !ministryResolved) return
    carregarTickets()
  }, [user?.id, ministryResolved])

  useEffect(() => {
    if (!user || !ministryResolved) return
    const intervalId = setInterval(() => {
      carregarTickets()
    }, 20000)

    return () => clearInterval(intervalId)
  }, [user?.id, ministryResolved])

  useEffect(() => {
    if (!selecionado) return
    carregarMensagens(selecionado.id)
    setDescricaoEditada(selecionado.descricao)
  }, [selecionado?.id])

  useEffect(() => {
    if (!selecionado || !user) return
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

  const mapPriorityToDb = (priority: TicketPriority) => {
    switch (priority) {
      case 'baixa':
        return 'low'
      case 'media':
        return 'medium'
      case 'alta':
        return 'high'
      case 'critica':
        return 'urgent'
      default:
        return 'medium'
    }
  }

  const carregarTickets = async () => {
    if (!user || !ministryId) return
    try {
      const { data, error: fetchErr } = await supabase
        .from('tickets_suporte')
        .select('*')
        .eq('ministry_id', ministryId)
        .order('data_atualizacao', { ascending: false })

      if (fetchErr) throw fetchErr

      const mapped: Ticket[] = (data || []).map((t: any) => ({
        id: t.id,
        titulo: t.titulo,
        descricao: t.descricao,
        status: mapStatusFromDb(t.status),
        prioridade: mapPriorityFromDb(t.prioridade),
        categoria: t.categoria || 'Geral',
        data_criacao: t.data_criacao,
        data_atualizacao: t.data_atualizacao,
        respondido_em: t.respondido_em,
        usuario_id: t.usuario_id,
        ultimo_autor_id: t.ultimo_autor_id,
        ultimo_autor_role: t.ultimo_autor_role,
        suporte_respondeu: t.suporte_respondeu,
        ministry_id: t.ministry_id,
        ticket_number: t.ticket_number,
      }))

      setTickets(mapped)
      setError('')
    } catch (err: any) {
      console.error('Erro ao carregar tickets:', err)
      setError('Erro ao atualizar lista de chamados.')
    } finally {
      setLoading(false)
    }
  }

  const carregarMensagens = async (ticketId: string) => {
    setCarregandoMensagens(true)
    try {
      const { data, error: fetchErr } = await supabase
        .from('tickets_suporte_mensagens')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })

      if (fetchErr) throw fetchErr
      setMensagens(data || [])
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err)
    } finally {
      setCarregandoMensagens(false)
    }
  }

  const handleAbrirTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoTicket.titulo.trim() || !novoTicket.descricao.trim() || !user || !ministryId) return

    setEnviando(true)
    try {
      const { data, error: insertErr } = await supabase
        .from('tickets_suporte')
        .insert({
          titulo: novoTicket.titulo.trim(),
          descricao: novoTicket.descricao.trim(),
          categoria: novoTicket.categoria,
          prioridade: mapPriorityToDb(novoTicket.prioridade),
          status: 'open',
          usuario_id: user.id,
          ministry_id: ministryId,
          ultimo_autor_id: user.id,
          ultimo_autor_role: 'user',
        })
        .select()
        .single()

      if (insertErr) throw insertErr

      await registrarAcao({
        acao: 'criar',
        descricao: `Abriu chamado sobre '${novoTicket.titulo.trim()}'`,
        modulo: 'suporte',
      })

      setNovoTicket({
        titulo: '',
        descricao: '',
        categoria: 'Geral',
        prioridade: 'media',
      })
      setMostrarFormulario(false)
      carregarTickets()
      if (data) {
        const mappedTicket: Ticket = {
          id: data.id,
          titulo: data.titulo,
          descricao: data.descricao,
          status: mapStatusFromDb(data.status),
          prioridade: mapPriorityFromDb(data.prioridade),
          categoria: data.categoria || 'Geral',
          data_criacao: data.data_criacao,
          data_atualizacao: data.data_atualizacao,
          usuario_id: data.usuario_id,
          ultimo_autor_id: data.ultimo_autor_id,
          ultimo_autor_role: data.ultimo_autor_role,
          ministry_id: data.ministry_id,
          ticket_number: data.ticket_number,
        }
        setSelecionado(mappedTicket)
      }
    } catch (err) {
      console.error('Erro ao abrir ticket:', err)
      setError('Não foi possível abrir o chamado.')
    } finally {
      setEnviando(false)
    }
  }

  const handleResponder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resposta.trim() || !selecionado || !user) return

    setEnviandoResposta(true)
    try {
      const { error: msgErr } = await supabase.from('tickets_suporte_mensagens').insert({
        ticket_id: selecionado.id,
        user_id: user.id,
        message: resposta.trim(),
        sender_role: 'user',
      })

      if (msgErr) throw msgErr

      const { error: ticketErr } = await supabase
        .from('tickets_suporte')
        .update({
          status: 'open',
          ultimo_autor_id: user.id,
          ultimo_autor_role: 'user',
          data_atualizacao: new Date().toISOString(),
        })
        .eq('id', selecionado.id)

      if (ticketErr) throw ticketErr

      setResposta('')
      carregarMensagens(selecionado.id)
      carregarTickets()
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err)
    } finally {
      setEnviandoResposta(false)
    }
  }

  const handleSalvarDescricao = async () => {
    if (!selecionado || !descricaoEditada.trim()) return
    setSalvandoDescricao(true)
    try {
      const { error: updateErr } = await supabase
        .from('tickets_suporte')
        .update({ descricao: descricaoEditada.trim(), data_atualizacao: new Date().toISOString() })
        .eq('id', selecionado.id)

      if (updateErr) throw updateErr

      setSelecionado({ ...selecionado, descricao: descricaoEditada.trim() })
      setPodeEditarDescricao(false)
      carregarTickets()
    } catch (err) {
      console.error('Erro ao editar descrição:', err)
    } finally {
      setSalvandoDescricao(false)
    }
  }

  const handleApagarTicket = async (ticketId: string) => {
    const confirmar = await dialog.confirm({
      message: 'Tem certeza que deseja excluir permanentemente este chamado e todo o seu histórico de mensagens?'
    })
    if (!confirmar) return

    try {
      const { error: delMsgsErr } = await supabase
        .from('tickets_suporte_mensagens')
        .delete()
        .eq('ticket_id', ticketId)

      if (delMsgsErr) throw delMsgsErr

      const { error: delErr } = await supabase.from('tickets_suporte').delete().eq('id', ticketId)
      if (delErr) throw delErr

      if (selecionado?.id === ticketId) {
        setSelecionado(null)
      }
      carregarTickets()
    } catch (err) {
      console.error('Erro ao apagar ticket:', err)
      setError('Não foi possível excluir o chamado.')
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
        return 'RESPOSTA DO SUPORTE'
      default:
        return 'Aberto'
    }
  }

  const ticketTemRespostaDoSuporte = (ticket: Ticket) => {
    const ultimoAutorSuporte = Boolean(
      ticket.ultimo_autor_id && ticket.usuario_id && ticket.ultimo_autor_id !== ticket.usuario_id
    )
    return (
      ticket.ultimo_autor_role === 'support' ||
      ticket.status === 'aguardando_cliente' ||
      Boolean(ticket.respondido_em) ||
      Boolean(ticket.suporte_respondeu) ||
      ultimoAutorSuporte
    )
  }

  const ticketTemRespostaDoCliente = (ticket: Ticket) => {
    if (ticket.ultimo_autor_role) return ticket.ultimo_autor_role === 'user'
    if (ticket.ultimo_autor_id && ticket.usuario_id) return ticket.ultimo_autor_id === ticket.usuario_id
    return false
  }

  const getStatusLabelExibicao = (ticket: Ticket) => {
    if (ticket.status === 'fechado') return 'Finalizado'
    if (ticketTemRespostaDoCliente(ticket)) return 'RESPOSTA DO CLIENTE'
    if (ticketTemRespostaDoSuporte(ticket)) return 'RESPOSTA DO SUPORTE'
    return getStatusLabel(ticket.status)
  }

  const getStatusBadgeClass = (ticket: Ticket) => {
    if (ticket.status === 'fechado') return 'bg-red-50 text-red-700'
    if (ticketTemRespostaDoCliente(ticket)) return 'bg-emerald-100 text-emerald-800'
    if (ticketTemRespostaDoSuporte(ticket)) return 'bg-orange-100 text-orange-800'
    return 'bg-[#eceff3] text-[#2f3f52]'
  }

  if (authLoading || ctx.loading) return <div className="p-8">Carregando...</div>
  if (bloqueado) return null

  const statusEhFinalizado = (status: TicketStatus) => status === 'fechado' || status === 'resolvido'

  const ticketsFiltrados = tickets.filter((ticket) => {
    if (filtroGrupo === 'abertos' && statusEhFinalizado(ticket.status)) return false
    if (filtroGrupo === 'finalizados' && !statusEhFinalizado(ticket.status)) return false

    const termo = buscaTicket.trim().toLowerCase()
    if (!termo) return true

    return ticket.titulo.toLowerCase().includes(termo)
  })

  const chamadosEmAberto = tickets.filter((ticket) => ticket.status === 'aberto').length

  return (
    <PageLayout
      title="Suporte"
      description="Abra tickets e acompanhe o progresso dos seus atendimentos"
      activeMenu="suporte"
    >
      <div className="bg-white rounded-lg shadow-lg p-6">
        
        {/* Assistente de Implantação */}
        <div className="mb-6 p-5 bg-gradient-to-r from-amber-50 to-amber-100/30 border border-amber-200 rounded-xl flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
              <span>🚀</span> Assistente de Implantação
            </h4>
            <p className="text-xs text-amber-800">
              Precisa de ajuda para configurar o sistema? Acompanhe o checklist e complete a implantação.
            </p>
          </div>
          <button
            onClick={() => router.push('/boas-vindas?show=true')}
            className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold transition shadow-sm"
          >
            Abrir Assistente
          </button>
        </div>

        {/* ERRO */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 rounded-lg">
            <p className="text-red-800 font-semibold">{error}</p>
            <p className="text-red-700 text-sm mt-2">
              🔄 Tente recarregar a página (F5)
            </p>
          </div>
        )}

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
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Crítica</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={enviando}
                  className="flex-1 px-6 py-3 bg-[#0284c7] text-white rounded-lg font-semibold hover:bg-[#0270b0] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {enviando ? 'Enviando...' : 'Abrir Ticket'}
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

        {/* FILTROS E BUSCA */}
        <div className="mb-2 border-b border-gray-200 pb-5">
          <h3 className="text-3xl leading-tight font-medium text-[#2d3e50]">Listagem de chamados</h3>
          <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-2">Filtrar por</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFiltroGrupo('todos')}
                  className={`px-5 py-2 rounded-full text-base transition ${
                    filtroGrupo === 'todos' ? 'bg-[#e8eef5] text-[#2f4a66] font-semibold' : 'text-[#2f4a66] hover:bg-gray-100'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setFiltroGrupo('abertos')}
                  className={`px-5 py-2 rounded-full text-base transition ${
                    filtroGrupo === 'abertos' ? 'bg-[#e8eef5] text-[#2f4a66] font-semibold' : 'text-[#2f4a66] hover:bg-gray-100'
                  }`}
                >
                  Abertos
                </button>
                <button
                  onClick={() => setFiltroGrupo('finalizados')}
                  className={`px-5 py-2 rounded-full text-base transition ${
                    filtroGrupo === 'finalizados' ? 'bg-[#e8eef5] text-[#2f4a66] font-semibold' : 'text-[#2f4a66] hover:bg-gray-100'
                  }`}
                >
                  Finalizados
                </button>
              </div>
            </div>

            <div className="w-full lg:max-w-md">
              <label className="block text-gray-500 text-sm mb-1">Busca por assunto</label>
              <div className="flex items-center gap-3 border-b border-[#c8d2dc] pb-2">
                <input
                  value={buscaTicket}
                  onChange={(e) => setBuscaTicket(e.target.value)}
                  placeholder=""
                  className="w-full bg-transparent outline-none text-[#2d3e50] placeholder:text-gray-400"
                />
                <svg className="w-6 h-6 text-[#2380e6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z" />
                </svg>
              </div>
            </div>
          </div>
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
            <p className="text-gray-600 text-lg">Nenhum ticket encontrado para os filtros aplicados.</p>
            <button
              onClick={() => setMostrarFormulario(true)}
              className="mt-4 px-6 py-2 bg-[#0284c7] text-white rounded-lg hover:bg-[#0270b0] transition"
            >
              Abrir primeiro ticket
            </button>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-md overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-[#f8fafc] border-b border-gray-200">
              <div className="flex items-center gap-3 text-[#2d3e50]">
                <span className="text-lg">i</span>
                <span className="text-base">
                  {chamadosEmAberto > 0
                    ? `Você possui ${chamadosEmAberto} chamado${chamadosEmAberto > 1 ? 's' : ''} em aberto.`
                    : 'Você não possui chamados em aberto.'}
                </span>
              </div>
              <button
                onClick={() => setMostrarFormulario(true)}
                className="px-8 py-2.5 bg-[#0074e8] text-white rounded-full font-semibold hover:bg-[#0067cf] transition"
              >
                Novo chamado
              </button>
            </div>

            <div className="hidden lg:grid lg:grid-cols-[minmax(0,4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-4 px-4 py-2 bg-[#f3f6fa] border-b border-gray-200">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5f7388]">Assunto</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5f7388]">Status</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5f7388]">Número</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5f7388]">Abertura</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5f7388]">Ações</span>
            </div>

            {ticketsFiltrados.map((ticket) => (
              <div
                key={ticket.id}
                className="grid grid-cols-1 lg:grid-cols-[minmax(0,4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-start lg:items-center gap-2 lg:gap-4 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition"
              >
                <div className="flex flex-col">
                  <button
                    onClick={() => setSelecionado(ticket)}
                    className="text-left font-semibold text-[#2d3e50] hover:text-[#0074e8] transition"
                  >
                    {ticket.titulo}
                  </button>
                  <span className="text-xs text-gray-400 mt-0.5">
                    Categoria: {ticket.categoria} · Prioridade:{' '}
                    <span className="capitalize">{ticket.prioridade}</span>
                  </span>
                </div>

                <div>
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${getStatusBadgeClass(
                      ticket
                    )}`}
                  >
                    {getStatusLabelExibicao(ticket)}
                  </span>
                </div>

                <div className="text-xs text-gray-500 font-medium">
                  {ticket.ticket_number || '-'}
                </div>

                <div className="text-xs text-gray-500">
                  {new Date(ticket.data_criacao).toLocaleDateString('pt-BR')}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelecionado(ticket)}
                    className="px-3 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition text-xs font-bold"
                  >
                    Visualizar
                  </button>
                  <button
                    onClick={() => handleApagarTicket(ticket.id)}
                    className="px-3 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 transition text-xs font-bold"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DETALHES E MENSAGENS (MODAL/DETALHE) */}
      {selecionado && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl border border-gray-100 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-150 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-[#123b63]">{selecionado.titulo}</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Ticket #{selecionado.ticket_number} · Criado em{' '}
                  {new Date(selecionado.data_criacao).toLocaleDateString('pt-BR')} às{' '}
                  {new Date(selecionado.data_criacao).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <button
                onClick={() => setSelecionado(null)}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
              >
                ✖
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Descrição Principal */}
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Descrição</h4>
                  {podeEditarDescricao ? (
                    <div className="flex gap-2">
                      <button
                        onClick={handleSalvarDescricao}
                        disabled={salvandoDescricao}
                        className="text-xs font-bold text-emerald-700 hover:underline disabled:opacity-50"
                      >
                        Salvar
                      </button>
                      <button
                        onClick={() => setPodeEditarDescricao(false)}
                        className="text-xs font-bold text-gray-500 hover:underline"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setPodeEditarDescricao(true)}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      Editar
                    </button>
                  )}
                </div>
                {podeEditarDescricao ? (
                  <textarea
                    value={descricaoEditada}
                    onChange={(e) => setDescricaoEditada(e.target.value)}
                    className="w-full p-2 border rounded focus:outline-none focus:border-[#0284c7] h-20 text-sm"
                    maxLength={500}
                  />
                ) : (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{selecionado.descricao}</p>
                )}
              </div>

              {/* Mensagens de Conversa */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Histórico de Atendimento</h4>

                {carregandoMensagens ? (
                  <div className="text-center py-4 text-gray-500 text-sm">Carregando histórico...</div>
                ) : mensagens.length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-sm">Aguardando atendimento.</div>
                ) : (
                  <div className="space-y-3">
                    {mensagens.map((msg) => {
                      const isMe = msg.sender_role === 'user'
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col max-w-[80%] rounded-2xl p-4 ${
                            isMe
                              ? 'bg-slate-100 text-slate-800 self-end ml-auto'
                              : 'bg-blue-50 border border-blue-100 text-slate-800 self-start mr-auto'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-6 mb-1 text-[10px] font-bold text-slate-400">
                            <span>{isMe ? 'Você' : 'Suporte Gestão Eklésia'}</span>
                            <span>
                              {new Date(msg.created_at).toLocaleDateString('pt-BR')} às{' '}
                              {new Date(msg.created_at).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Nova Resposta */}
            <div className="p-6 border-t border-gray-150 bg-gray-50 rounded-b-2xl">
              <form onSubmit={handleResponder} className="flex gap-3">
                <input
                  type="text"
                  value={resposta}
                  onChange={(e) => setResposta(e.target.value)}
                  placeholder="Escreva sua resposta..."
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-[#0284c7]"
                />
                <button
                  type="submit"
                  disabled={enviandoResposta || !resposta.trim()}
                  className="px-6 py-2.5 bg-[#0284c7] text-white rounded-xl font-bold hover:bg-[#0270b0] transition disabled:opacity-50"
                >
                  Enviar
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}
