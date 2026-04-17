'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import NotificationModal from '@/components/NotificationModal';
import { useRouter } from 'next/navigation';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { useUserContext } from '@/hooks/useUserContext';
import { createClient } from '@/lib/supabase-client';
import { CheckCircle, Clock, FileText, Printer, Send, XCircle } from 'lucide-react';

type TipoCarta = 'mudanca' | 'transito' | 'desligamento' | 'recomendacao';
type StatusPedido = 'pendente' | 'autorizado' | 'rejeitado';

interface CartaPedido {
  id: string;
  ministry_id: string;
  congregacao_id: string | null;
  solicitante_id: string;
  solicitante_nome: string | null;
  member_id: string | null;
  membro_nome: string;
  membro_cargo: string | null;
  tipo_carta: TipoCarta;
  destino: string | null;
  observacoes: string | null;
  status: StatusPedido;
  autorizador_id: string | null;
  autorizador_nome: string | null;
  data_autorizacao: string | null;
  motivo_rejeicao: string | null;
  created_at: string;
}

const TIPO_LABELS: Record<TipoCarta, string> = {
  mudanca: 'Carta de Mudança',
  transito: 'Carta de Trânsito',
  desligamento: 'Carta de Desligamento',
  recomendacao: 'Carta de Recomendação',
};

const STATUS_CONFIG: Record<StatusPedido, { label: string; bg: string; text: string; border: string }> = {
  pendente:  { label: 'Aguardando autorização', bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-300'  },
  autorizado:{ label: 'Autorizado',             bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-300'  },
  rejeitado: { label: 'Rejeitado',              bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-300'    },
};

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

function CartaParaImprimir({ pedido, ministerioNome }: { pedido: CartaPedido; ministerioNome: string }) {
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const textos: Record<TipoCarta, string> = {
    mudanca:     `Certificamos que o(a) irmão(ã) ${pedido.membro_nome}${pedido.membro_cargo ? ', ' + pedido.membro_cargo : ''}, é membro desta Igreja, encontrando-se em plena comunhão com nossa assembleia. Por motivo de mudança para ${pedido.destino || 'outra localidade'}, solicitou esta carta para que possa ser recebido(a) por uma assembleia congênere.`,
    transito:    `Certificamos que o(a) irmão(ã) ${pedido.membro_nome}${pedido.membro_cargo ? ', ' + pedido.membro_cargo : ''}, é membro desta Igreja em plena comunhão. Esta carta é concedida para que, em viagem ou trânsito para ${pedido.destino || 'outra localidade'}, possa ser recebido(a) com fraternidade por igrejas congêneres.`,
    desligamento:`Certificamos que o(a) irmão(ã) ${pedido.membro_nome}${pedido.membro_cargo ? ', ' + pedido.membro_cargo : ''}, era membro desta Igreja. Por solicitação própria, foi desligado(a) de nosso rol de membros, estando quites com todas as suas obrigações.`,
    recomendacao:`Recomendamos o(a) irmão(ã) ${pedido.membro_nome}${pedido.membro_cargo ? ', ' + pedido.membro_cargo : ''}, membro desta Igreja em plena comunhão com nossa assembleia. É pessoa de conduta íntegra e dedicação à obra de Deus, sendo por nós reconhecido(a) e recomendado(a) às igrejas congêneres.`,
  };
  return (
    <div style={{ fontFamily: 'Georgia, serif', color: '#1a1a1a', maxWidth: 720, margin: '0 auto', padding: '48px 64px', lineHeight: 1.8 }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>{ministerioNome}</h1>
        <div style={{ width: 60, height: 2, background: '#333', margin: '0 auto 12px' }} />
        <h2 style={{ fontSize: 17, fontWeight: 600, letterSpacing: 1 }}>{TIPO_LABELS[pedido.tipo_carta].toUpperCase()}</h2>
      </div>
      <p style={{ textIndent: 40, marginBottom: 20, fontSize: 15 }}>{textos[pedido.tipo_carta]}</p>
      {pedido.observacoes && <p style={{ textIndent: 40, marginBottom: 20, fontSize: 15 }}><strong>Observações:</strong> {pedido.observacoes}</p>}
      <p style={{ textIndent: 40, marginBottom: 40, fontSize: 15 }}>Por ser verdade, firmamos a presente carta.</p>
      <p style={{ textAlign: 'right', marginBottom: 60, fontSize: 14 }}>{hoje}</p>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 200, borderTop: '1px solid #555', margin: '0 auto 4px' }} />
        <p style={{ fontSize: 14, margin: 0 }}>{pedido.autorizador_nome || 'Secretaria Geral'}</p>
        <p style={{ fontSize: 12, margin: 0, color: '#666' }}>Secretaria Geral — {ministerioNome}</p>
      </div>
    </div>
  );
}

export default function CartaPedidosPage() {
  const { loading } = useRequireSupabaseAuth();
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const userCtx = useUserContext();
  const isGestor = userCtx.nivel === 'administrador' || userCtx.nivel === 'supervisor';

  // Administrador tem o editor completo em /secretaria/cartas
  useEffect(() => {
    if (!userCtx.loading && userCtx.nivel === 'administrador') {
      router.replace('/secretaria/cartas');
    }
  }, [userCtx.loading, userCtx.nivel, router]);

  const [pedidos, setPedidos] = useState<CartaPedido[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [ministerioNome, setMinisterioNome] = useState('');

  const [membroSearch, setMembroSearch] = useState('');
  const [membroNome, setMembroNome] = useState('');
  const [membroId, setMembroId] = useState<string | null>(null);
  const [membroCargo, setMembroCargo] = useState('');
  const [tipoCarta, setTipoCarta] = useState<TipoCarta>('mudanca');
  const [destino, setDestino] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [membrosEncontrados, setMembrosEncontrados] = useState<{ id: string; name: string; cargo_ministerial?: string }[]>([]);
  const skipSearchRef = useRef(false);

  const [pedidoParaAutorizar, setPedidoParaAutorizar] = useState<CartaPedido | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [autorizando, setAutorizando] = useState(false);

  const [pedidoParaImprimir, setPedidoParaImprimir] = useState<CartaPedido | null>(null);

  const [notif, setNotif] = useState({ isOpen: false, type: 'success' as 'success' | 'error' | 'warning', title: '', msg: '' });
  const showNotif = (type: 'success' | 'error' | 'warning', title: string, msg: string) =>
    setNotif({ isOpen: true, type, title, msg });

  const [activeTab, setActiveTab] = useState('solicitar');

  useEffect(() => {
    if (userCtx.loading || loading) return;
    loadData();
    loadMinisterio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userCtx.loading, loading, userCtx.ministryId]);

  async function loadData() {
    if (!userCtx.ministryId) return;
    setLoadingData(true);
    try {
      let query = supabase.from('carta_pedidos').select('*').eq('ministry_id', userCtx.ministryId).order('created_at', { ascending: false });
      if (!isGestor && userCtx.userId) query = query.eq('solicitante_id', userCtx.userId);
      const { data, error } = await query;
      if (error) throw error;
      setPedidos((data ?? []) as CartaPedido[]);
    } finally {
      setLoadingData(false);
    }
  }

  async function loadMinisterio() {
    if (!userCtx.ministryId) return;
    const { data } = await supabase.from('ministries').select('name').eq('id', userCtx.ministryId).maybeSingle();
    setMinisterioNome(data?.name ?? '');
  }

  useEffect(() => {
    if (skipSearchRef.current) { skipSearchRef.current = false; return; }
    const q = membroSearch.trim();
    if (q.length < 2 || !userCtx.ministryId) { setMembrosEncontrados([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('members').select('id, name, cargo_ministerial').eq('ministry_id', userCtx.ministryId!).ilike('name', `%${q}%`).limit(8);
      setMembrosEncontrados(data ?? []);
    }, 300);
    return () => clearTimeout(timer);
  }, [membroSearch, userCtx.ministryId, supabase]);

  function selecionarMembro(m: { id: string; name: string; cargo_ministerial?: string }) {
    skipSearchRef.current = true;
    setMembroId(m.id); setMembroNome(m.name); setMembroSearch(m.name);
    setMembroCargo(m.cargo_ministerial ?? ''); setMembrosEncontrados([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!membroNome.trim()) { showNotif('error', 'Campo obrigatório', 'Informe o nome do membro.'); return; }
    if (!userCtx.ministryId || !userCtx.userId) return;
    const semAutorizacao = tipoCarta === 'transito' || tipoCarta === 'recomendacao';
    setSubmitting(true);
    try {
      const { error } = await supabase.from('carta_pedidos').insert({
        ministry_id: userCtx.ministryId,
        congregacao_id: (userCtx as any).congregacaoId ?? null,
        solicitante_id: userCtx.userId,
        member_id: membroId,
        membro_nome: membroNome.trim(),
        membro_cargo: membroCargo.trim() || null,
        tipo_carta: tipoCarta,
        destino: destino.trim() || null,
        observacoes: observacoes.trim() || null,
        status: semAutorizacao ? 'autorizado' : 'pendente',
        autorizador_id: semAutorizacao ? userCtx.userId : null,
        data_autorizacao: semAutorizacao ? new Date().toISOString() : null,
      });
      if (error) throw error;
      if (semAutorizacao) {
        showNotif('success', 'Carta disponível!', 'A carta foi gerada e está disponível para impressão.');
      } else {
        showNotif('success', 'Pedido enviado!', 'A Secretaria Geral irá analisar e você será notificado.');
      }
      setMembroSearch(''); setMembroNome(''); setMembroId(null); setMembroCargo('');
      setTipoCarta('mudanca'); setDestino(''); setObservacoes('');
      loadData();
      setActiveTab('meus');
    } catch {
      showNotif('error', 'Erro', 'Não foi possível enviar o pedido. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAutorizar() {
    if (!pedidoParaAutorizar || !userCtx.userId) return;
    setAutorizando(true);
    try {
      const { error } = await supabase.from('carta_pedidos').update({
        status: 'autorizado',
        autorizador_id: userCtx.userId,
        data_autorizacao: new Date().toISOString(),
      }).eq('id', pedidoParaAutorizar.id);
      if (error) throw error;
      showNotif('success', 'Autorizado', 'A carta está disponível para impressão.');
      setPedidoParaAutorizar(null);
      loadData();
    } catch {
      showNotif('error', 'Erro', 'Não foi possível autorizar o pedido.');
    } finally {
      setAutorizando(false);
    }
  }

  async function handleRejeitar() {
    if (!pedidoParaAutorizar || !userCtx.userId) return;
    if (!motivoRejeicao.trim()) { showNotif('error', 'Campo obrigatório', 'Informe o motivo da rejeição.'); return; }
    setAutorizando(true);
    try {
      const { error } = await supabase.from('carta_pedidos').update({
        status: 'rejeitado',
        autorizador_id: userCtx.userId,
        motivo_rejeicao: motivoRejeicao.trim(),
        data_autorizacao: new Date().toISOString(),
      }).eq('id', pedidoParaAutorizar.id);
      if (error) throw error;
      showNotif('warning', 'Rejeitado', 'O pedido foi rejeitado.');
      setPedidoParaAutorizar(null);
      setMotivoRejeicao('');
      loadData();
    } catch {
      showNotif('error', 'Erro', 'Não foi possível rejeitar o pedido.');
    } finally {
      setAutorizando(false);
    }
  }

  const pedidosPendentes = pedidos.filter(p => p.status === 'pendente');

  const tabs = [
    { id: 'solicitar', label: 'Solicitar' },
    ...(isGestor
      ? [
          { id: 'pendentes', label: pedidosPendentes.length > 0 ? `Pendentes (${pedidosPendentes.length})` : 'Pendentes' },
          { id: 'historico', label: 'Histórico' },
        ]
      : [{ id: 'meus', label: 'Meus Pedidos' }]
    ),
  ];

  function StatusBadge({ status }: { status: StatusPedido }) {
    const cfg = STATUS_CONFIG[status];
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
        {status === 'pendente' && <Clock size={11} />}
        {status === 'autorizado' && <CheckCircle size={11} />}
        {status === 'rejeitado' && <XCircle size={11} />}
        {cfg.label}
      </span>
    );
  }

  function PedidoCard({ pedido }: { pedido: CartaPedido }) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="font-semibold text-gray-800">{pedido.membro_nome}</p>
            {pedido.membro_cargo && <p className="text-xs text-gray-400">{pedido.membro_cargo}</p>}
          </div>
          <StatusBadge status={pedido.status} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
          <span>{TIPO_LABELS[pedido.tipo_carta]}</span>
          {pedido.destino && <span>📍 {pedido.destino}</span>}
          <span>📅 {fmtDate(pedido.created_at)}</span>
          {isGestor && pedido.solicitante_nome && <span>👤 {pedido.solicitante_nome}</span>}
        </div>
        {pedido.observacoes && (
          <p className="text-xs text-gray-400 italic border-l-2 border-gray-200 pl-3">"{pedido.observacoes}"</p>
        )}
        {pedido.status === 'rejeitado' && pedido.motivo_rejeicao && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <strong>Motivo:</strong> {pedido.motivo_rejeicao}
          </p>
        )}
        {pedido.status === 'autorizado' && (
          <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            Autorizado em {fmtDate(pedido.data_autorizacao)}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          {pedido.status === 'autorizado' && (
            <button
              onClick={() => { setPedidoParaImprimir(pedido); setTimeout(() => window.print(), 150); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition"
            >
              <Printer size={12} /> Imprimir Carta
            </button>
          )}
          {isGestor && pedido.status === 'pendente' && (
            <button
              onClick={() => { setPedidoParaAutorizar(pedido); setMotivoRejeicao(''); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition"
            >
              <CheckCircle size={12} /> Avaliar
            </button>
          )}
        </div>
      </div>
    );
  }

  function ListaVazia({ mensagem }: { mensagem: string }) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <FileText size={40} className="mb-3 opacity-40" />
        <p className="text-sm">{mensagem}</p>
      </div>
    );
  }

  if (loading) return null;

  return (
    <PageLayout
      title="Pedidos de Cartas Ministeriais"
      description="Solicite, acompanhe e imprima cartas ministeriais com aprovação da Secretaria Geral"
      activeMenu="cartas-pedidos"
    >
      <NotificationModal
        isOpen={notif.isOpen}
        title={notif.title}
        message={notif.msg}
        type={notif.type}
        onClose={() => setNotif(n => ({ ...n, isOpen: false }))}
        autoClose={3000}
      />

      {pedidoParaAutorizar && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-1">Avaliar Pedido</h3>
            <p className="text-sm text-gray-500 mb-4">
              {TIPO_LABELS[pedidoParaAutorizar.tipo_carta]} —{' '}
              <strong className="text-gray-700">{pedidoParaAutorizar.membro_nome}</strong>
            </p>
            {pedidoParaAutorizar.observacoes && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 text-sm text-gray-600">
                <span className="text-xs text-gray-400 block mb-1">Observações do solicitante:</span>
                {pedidoParaAutorizar.observacoes}
              </div>
            )}
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo da rejeição{' '}
              <span className="text-gray-400 font-normal">(obrigatório para rejeitar)</span>
            </label>
            <textarea
              value={motivoRejeicao}
              onChange={e => setMotivoRejeicao(e.target.value)}
              rows={3}
              placeholder="Informe o motivo caso vá rejeitar..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setPedidoParaAutorizar(null)}
                disabled={autorizando}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleRejeitar}
                disabled={autorizando}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
              >
                <XCircle size={15} /> Rejeitar
              </button>
              <button
                onClick={handleAutorizar}
                disabled={autorizando}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
              >
                <CheckCircle size={15} /> Autorizar
              </button>
            </div>
          </div>
        </div>
      )}

      {pedidoParaImprimir && (
        <div className="print-carta hidden print:block">
          <CartaParaImprimir pedido={pedidoParaImprimir} ministerioNome={ministerioNome} />
        </div>
      )}

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>

        {activeTab === 'solicitar' && (
          <Section title="Nova Solicitação de Carta">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
              <div className="md:col-span-2 relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Membro *</label>
                <input
                  type="text"
                  value={membroSearch}
                  onChange={e => { setMembroSearch(e.target.value); setMembroNome(e.target.value); setMembroId(null); }}
                  placeholder="Digite o nome para buscar..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                {membrosEncontrados.length > 0 && (
                  <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {membrosEncontrados.map(m => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => selecionarMembro(m)}
                          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm transition"
                        >
                          <span className="font-medium text-gray-800">{m.name}</span>
                          {m.cargo_ministerial && (
                            <span className="text-gray-400 text-xs ml-2">— {m.cargo_ministerial}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cargo / Função</label>
                <input
                  type="text"
                  value={membroCargo}
                  onChange={e => setMembroCargo(e.target.value)}
                  placeholder="Ex: Diácono, Pastor Auxiliar..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Carta *</label>
                <select
                  value={tipoCarta}
                  onChange={e => setTipoCarta(e.target.value as TipoCarta)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="mudanca">Carta de Mudança</option>
                  <option value="transito">Carta de Trânsito</option>
                  <option value="desligamento">Carta de Desligamento</option>
                  <option value="recomendacao">Carta de Recomendação</option>
                </select>
              </div>
              {(tipoCarta === 'mudanca' || tipoCarta === 'transito') && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cidade / Estado de Destino</label>
                  <input
                    type="text"
                    value={destino}
                    onChange={e => setDestino(e.target.value)}
                    placeholder="Ex: São Paulo — SP"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  value={observacoes}
                  onChange={e => setObservacoes(e.target.value)}
                  rows={3}
                  placeholder="Informações adicionais para a Secretaria Geral..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
                >
                  <Send size={15} />
                  {submitting
                    ? 'Gerando...'
                    : (tipoCarta === 'transito' || tipoCarta === 'recomendacao')
                      ? 'Emitir Carta'
                      : 'Enviar Pedido à Secretaria Geral'
                  }
                </button>
              </div>
            </form>
            <div className="mt-6 max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3">
                <CheckCircle size={18} className="text-green-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-700 mb-1">Emissão imediata</p>
                  <p className="text-sm text-green-600">Trânsito e Recomendação ficam disponíveis para impressão na hora.</p>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                <Clock size={18} className="text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-700 mb-1">Requer autorização</p>
                  <p className="text-sm text-amber-600">Mudança e Desligamento precisam de aprovação da Secretaria Geral.</p>
                </div>
              </div>
            </div>
          </Section>
        )}

        {activeTab === 'meus' && !isGestor && (
          <Section title="Meus Pedidos">
            {loadingData
              ? <p className="text-sm text-gray-400">Carregando...</p>
              : pedidos.length === 0
                ? <ListaVazia mensagem="Nenhum pedido registrado ainda." />
                : <div className="grid gap-3 max-w-2xl">{pedidos.map(p => <PedidoCard key={p.id} pedido={p} />)}</div>
            }
          </Section>
        )}

        {activeTab === 'pendentes' && isGestor && (
          <Section title={`Pedidos Pendentes (${pedidosPendentes.length})`}>
            {loadingData
              ? <p className="text-sm text-gray-400">Carregando...</p>
              : pedidosPendentes.length === 0
                ? <ListaVazia mensagem="Nenhum pedido aguardando autorização." />
                : <div className="grid gap-3 max-w-2xl">{pedidosPendentes.map(p => <PedidoCard key={p.id} pedido={p} />)}</div>
            }
          </Section>
        )}

        {activeTab === 'historico' && isGestor && (
          <Section title="Histórico de Pedidos">
            {loadingData
              ? <p className="text-sm text-gray-400">Carregando...</p>
              : pedidos.length === 0
                ? <ListaVazia mensagem="Nenhum pedido registrado." />
                : <div className="grid gap-3 max-w-2xl">{pedidos.map(p => <PedidoCard key={p.id} pedido={p} />)}</div>
            }
          </Section>
        )}

      </Tabs>
    </PageLayout>
  );
}
