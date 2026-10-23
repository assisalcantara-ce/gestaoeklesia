'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { CalendarDays, MapPin, Users, Clock, AlertTriangle, CheckCircle2, Loader2, Copy, RefreshCw, Gift, Award, Utensils, Home, Search, ShieldCheck, UserCheck, X } from 'lucide-react';

interface EventoPublico {
  id: string;
  slug: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  data_inicio: string;
  data_fim: string | null;
  local_nome: string | null;
  local_endereco: string | null;
  capacidade: number | null;
  status: string;
  is_publico: boolean;
  aceita_inscricao: boolean;
  valor_inscricao: number;
  inclui_brinde?: boolean;
  brinde_distribuicao?: string;
  brinde_quantidade?: number | null;
  inclui_certificado?: boolean;
  inclui_alimentacao?: boolean;
  inclui_hospedagem?: boolean;
  inscritos_confirmados: number;
  inscritos_aguardando?: number;
  lista_espera: number;
  vagas_restantes: number | null;
  lotado: boolean;
  status_inscricao?: 'aberto' | 'lotado' | 'encerrado_manual' | 'expirado' | 'cancelado';
  permite_inscricao?: boolean;
  is_lista_espera?: boolean;
  motivo_bloqueio?: string | null;
  descricao_status?: string;
  congregacoes?: Array<{ id: string; nome: string }>;
}

type FormState = {
  nome: string;
  email: string;
  telefone: string;
  congregacao: string;
  cpf_cnpj: string;
};

const FORM_INICIAL: FormState = { nome: '', email: '', telefone: '', congregacao: '', cpf_cnpj: '' };

// Máscara formatadora de CPF: 000.000.000-00 (permite digitação incremental)
function aplicarMascaraCpf(valor: string): string {
  const digits = valor.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

// Máscara formatadora de Data: DD/MM/AAAA (permite digitação incremental)
function aplicarMascaraData(valor: string): string {
  const digits = valor.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

// Máscara formatadora de Telefone/Celular: (00) 00000-0000 ou (00) 0000-0000
function aplicarMascaraTelefone(valor: string): string {
  const digits = valor.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// Validador simples de data real no padrão DD/MM/AAAA
function validarDataReal(dataStr: string): boolean {
  const digits = dataStr.replace(/\D/g, '');
  if (digits.length !== 8) return false;
  const dia = parseInt(digits.slice(0, 2), 10);
  const mes = parseInt(digits.slice(2, 4), 10);
  const ano = parseInt(digits.slice(4, 8), 10);
  if (mes < 1 || mes > 12) return false;
  if (dia < 1 || dia > 31) return false;
  const anoAtual = new Date().getFullYear();
  if (ano < 1900 || ano > anoAtual) return false;
  const diasNoMes = new Date(ano, mes, 0).getDate();
  return dia <= diasNoMes;
}

type PixData = {
  pagamento_id: string;
  payload: string | null;
  qrcode_base64: string | null;
  expira_em: string | null;
  invoice_url: string | null;
  valor: number;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function tipoLabel(tipo: string) {
  const map: Record<string, string> = {
    culto_especial: 'Culto Especial',
    congresso:      'Congresso',
    conferencia:    'Conferência',
    palestra:       'Palestra',
    retiro:         'Retiro',
    evangelismo:    'Evangelismo',
    treinamento:    'Treinamento',
    social:         'Social',
    outro:          'Outro',
  };
  return map[tipo] ?? 'Evento';
}

export default function EventoPublicoPage() {
  const { slug } = useParams<{ slug: string }>();
  const [evento, setEvento] = useState<EventoPublico | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<{ nome: string; status: string; tem_brinde?: boolean } | null>(null);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [pixStatus, setPixStatus] = useState<'pendente' | 'pago' | 'expirado'>('pendente');
  const [copiado, setCopiado] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Autocomplete Dinâmico e Seguro de Membros ──
  const [sugestoesMembros, setSugestoesMembros] = useState<Array<{ id: string; nome: string; congregacao_nome: string }>>([]);
  const [buscandoMembros, setBuscandoMembros] = useState(false);
  const [mostrarDropdown, setMostrarDropdown] = useState(false);
  const [indiceFocado, setIndiceFocado] = useState<number>(-1);
  const [membroSelecionado, setMembroSelecionado] = useState<{ id: string; nome: string; congregacao_nome: string } | null>(null);
  const [modalConfirmacaoAberto, setModalConfirmacaoAberto] = useState(false);
  const [tipoConfirmacao, setTipoConfirmacao] = useState<'cpf' | 'nascimento'>('cpf');
  const [valorConfirmacao, setValorConfirmacao] = useState('');
  const [confirmandoMembro, setConfirmandoMembro] = useState(false);
  const [erroConfirmacao, setErroConfirmacao] = useState<string | null>(null);
  const [memberToken, setMemberToken] = useState<string | null>(null);
  const [membroConfirmadoBadge, setMembroConfirmadoBadge] = useState<string | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const inputConfirmacaoRef = useRef<HTMLInputElement | null>(null);

  // Foco automático ao abrir o modal ou ao trocar de método de confirmação
  useEffect(() => {
    if (modalConfirmacaoAberto) {
      const t = setTimeout(() => {
        inputConfirmacaoRef.current?.focus();
      }, 50);
      return () => clearTimeout(t);
    }
  }, [modalConfirmacaoAberto, tipoConfirmacao]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMostrarDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Executar busca após debounce de 300ms quando nome tiver >= 3 caracteres
  const dispararBuscaMembros = useCallback((termo: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!slug || termo.trim().length < 3) {
      setSugestoesMembros([]);
      setMostrarDropdown(false);
      setBuscandoMembros(false);
      return;
    }

    setBuscandoMembros(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/eventos/publico/${encodeURIComponent(slug)}/membros?q=${encodeURIComponent(termo.trim())}`);
        if (!res.ok) {
          setSugestoesMembros([]);
          return;
        }
        const data = await res.json();
        setSugestoesMembros(data.membros || []);
        setMostrarDropdown(true);
        setIndiceFocado(-1);
      } catch {
        setSugestoesMembros([]);
      } finally {
        setBuscandoMembros(false);
      }
    }, 300);
  }, [slug]);

  function handleNomeChange(valor: string) {
    setForm(f => ({ ...f, nome: valor }));
    // Se o usuário já havia confirmado um membro e resolveu alterar o nome, reseta o vínculo
    if (memberToken) {
      setMemberToken(null);
      setMembroConfirmadoBadge(null);
    }
    dispararBuscaMembros(valor);
  }

  function handleSelecionarMembro(m: { id: string; nome: string; congregacao_nome: string }) {
    setMembroSelecionado(m);
    setMostrarDropdown(false);
    setErroConfirmacao(null);
    setValorConfirmacao('');
    setTipoConfirmacao('cpf');
    setModalConfirmacaoAberto(true);
  }

  async function handleConfirmarIdentidade(e: React.FormEvent) {
    e.preventDefault();
    if (!membroSelecionado || !valorConfirmacao.trim()) return;

    // Se for data de nascimento, validar se é uma data real
    if (tipoConfirmacao === 'nascimento') {
      const cleanData = valorConfirmacao.replace(/\D/g, '');
      if (cleanData.length !== 8 || !validarDataReal(valorConfirmacao)) {
        setErroConfirmacao('Informe uma data de nascimento válida (DD/MM/AAAA).');
        return;
      }
    } else if (tipoConfirmacao === 'cpf') {
      const cleanCpf = valorConfirmacao.replace(/\D/g, '');
      if (cleanCpf.length !== 11) {
        setErroConfirmacao('Informe o CPF completo com 11 dígitos.');
        return;
      }
    }

    setConfirmandoMembro(true);
    setErroConfirmacao(null);

    try {
      const payload: Record<string, any> = { member_id: membroSelecionado.id };
      if (tipoConfirmacao === 'nascimento') {
        payload.data_nascimento = valorConfirmacao.trim();
      } else if (tipoConfirmacao === 'cpf') {
        payload.digitos_cpf = valorConfirmacao.trim();
      }

      const res = await fetch(`/api/v1/eventos/publico/${encodeURIComponent(slug)}/membros/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.confirmado) {
        setErroConfirmacao(data.error || 'Não foi possível confirmar os dados.');
        return;
      }

      // Auto-preenchimento seguro dos dados oficiais
      setMemberToken(data.token);
      setMembroConfirmadoBadge(data.dados.nome);
      const telFormatado = data.dados.telefone ? aplicarMascaraTelefone(data.dados.telefone) : '';
      setForm(prev => ({
        ...prev,
        nome: data.dados.nome || prev.nome,
        email: data.dados.email || prev.email,
        telefone: telFormatado || prev.telefone,
        congregacao: data.dados.congregacao || prev.congregacao,
        cpf_cnpj: data.dados.cpf || prev.cpf_cnpj,
      }));

      setModalConfirmacaoAberto(false);
      setMembroSelecionado(null);
      setSugestoesMembros([]);
    } catch {
      setErroConfirmacao('Erro ao conectar ao servidor. Tente novamente.');
    } finally {
      setConfirmandoMembro(false);
    }
  }

  function handleKeyDownNome(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!mostrarDropdown || sugestoesMembros.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndiceFocado(prev => (prev < sugestoesMembros.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndiceFocado(prev => (prev > 0 ? prev - 1 : sugestoesMembros.length - 1));
    } else if (e.key === 'Enter') {
      if (indiceFocado >= 0 && indiceFocado < sugestoesMembros.length) {
        e.preventDefault();
        handleSelecionarMembro(sugestoesMembros[indiceFocado]);
      }
    } else if (e.key === 'Escape') {
      setMostrarDropdown(false);
    }
  }

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/v1/eventos/publico/${encodeURIComponent(slug)}`)
      .then(r => {
        if (!r.ok) { setNotFound(true); return null; }
        return r.json();
      })
      .then(data => { if (data) setEvento(data); })
      .finally(() => setLoading(false));
  }, [slug]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  function startPixPolling(pagamentoId: string) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/v1/eventos/pagamento/${pagamentoId}/status`);
        if (!r.ok) return;
        const d = await r.json();
        if (d.status === 'pago') {
          setPixStatus('pago');
          setSucesso(prev => prev ? { ...prev, status: 'confirmado', tem_brinde: Boolean(d.tem_brinde) } : null);
          stopPolling();
          // Atualizar vagas
          fetch(`/api/v1/eventos/publico/${encodeURIComponent(slug)}`)
            .then(r2 => r2.json()).then(ev => setEvento(ev)).catch(() => null);
        } else if (d.status === 'expirado' || d.status === 'cancelado') {
          setPixStatus('expirado');
          stopPolling();
        }
      } catch { /* ignora */ }
    }, 5000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      const res = await fetch('/api/v1/eventos/inscricao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, ...form, member_token: memberToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? 'Erro desconhecido.');
      } else if (data.status === 'aguardando_pagamento' && data.pix) {
        // Evento pago — exibir QR Code
        setPixData({
          pagamento_id: data.pagamento_id,
          payload:        data.pix.payload,
          qrcode_base64:  data.pix.qrcode_base64,
          expira_em:      data.pix.expira_em,
          invoice_url:    data.pix.invoice_url,
          valor:          data.valor,
        });
        setPixStatus('pendente');
        setSucesso({ nome: data.nome, status: 'aguardando_pagamento', tem_brinde: Boolean(data.tem_brinde) });
        setForm(FORM_INICIAL);
        if (data.pagamento_id) startPixPolling(data.pagamento_id);
      } else {
        setSucesso({ nome: data.nome, status: data.status, tem_brinde: Boolean(data.tem_brinde) });
        setForm(FORM_INICIAL);
        // Recarregar dados do evento para atualizar vagas
        fetch(`/api/v1/eventos/publico/${encodeURIComponent(slug)}`)
          .then(r => r.json())
          .then(d => setEvento(d))
          .catch(() => null);
      }
    } catch {
      setErro('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  async function copiarPix() {
    if (!pixData?.payload) return;
    await navigator.clipboard.writeText(pixData.payload).catch(() => null);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#123b63] animate-spin" />
      </div>
    );
  }

  if (notFound || !evento) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Evento não encontrado</h1>
          <p className="text-gray-500">O link que você acessou pode estar desatualizado ou o evento não está mais disponível.</p>
        </div>
      </div>
    );
  }

  const statusInsc = evento.status_inscricao ?? (
    evento.status === 'cancelado' ? 'cancelado' :
    evento.status === 'realizado' ? 'expirado' :
    !evento.aceita_inscricao ? 'encerrado_manual' :
    evento.lotado ? 'lotado' : 'aberto'
  );

  const podeSe = (evento.permite_inscricao ?? (statusInsc === 'aberto' || statusInsc === 'lotado')) && !sucesso;
  const mostrarLotado = Boolean(evento.is_lista_espera ?? (statusInsc === 'lotado'));

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#123b63]/5 to-white">
      {/* Hero */}
      <div className="bg-[#123b63] text-white py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <p className="text-[#123b63]/30 text-sm mb-1 uppercase tracking-widest font-medium text-white/60">
            {tipoLabel(evento.tipo)}
          </p>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4">{evento.titulo}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-white/80">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4" />
              {fmtDate(evento.data_inicio)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {fmtTime(evento.data_inicio)}
              {evento.data_fim && ` – ${fmtTime(evento.data_fim)}`}
            </span>
            {evento.local_nome && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {evento.local_nome}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        {/* Cards de info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {evento.capacidade != null && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
              <Users className="w-5 h-5 text-[#123b63] mx-auto mb-1" />
              <p className="text-xl font-bold text-[#123b63]">{evento.vagas_restantes ?? '—'}</p>
              <p className="text-xs text-gray-500">Vagas restantes</p>
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
            <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-green-600">{evento.inscritos_confirmados}</p>
            <p className="text-xs text-gray-500">Confirmados</p>
          </div>
          {evento.lista_espera > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
              <Clock className="w-5 h-5 text-amber-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-amber-600">{evento.lista_espera}</p>
              <p className="text-xs text-gray-500">Lista de espera</p>
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
            <p className="text-xs text-gray-500 mb-1">Inscrição</p>
            <p className="text-xl font-bold text-[#123b63]">
              {evento.valor_inscricao > 0
                ? evento.valor_inscricao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                : 'Gratuita'}
            </p>
          </div>
        </div>

        {/* Benefícios inclusos na Inscrição */}
        {(evento.inclui_brinde || evento.inclui_certificado || evento.inclui_alimentacao || evento.inclui_hospedagem) && (
          <div className="bg-white rounded-xl border border-emerald-200 p-5 shadow-sm space-y-3">
            <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Benefícios Inclusos na Inscrição
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {evento.inclui_brinde && (
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-xs font-semibold">
                  <Gift className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Brinde Oficial{' '}
                    {evento.brinde_distribuicao === 'quantidade_limitada' && evento.brinde_quantidade
                      ? `(limitado aos primeiros ${evento.brinde_quantidade} inscritos)`
                      : '(todos os confirmados)'}
                  </span>
                </div>
              )}
              {evento.inclui_certificado && (
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-blue-50/70 border border-blue-200 text-blue-900 text-xs font-semibold">
                  <Award className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Certificado de Participação</span>
                </div>
              )}
              {evento.inclui_alimentacao && (
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 text-amber-900 text-xs font-semibold">
                  <Utensils className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Alimentação inclusa</span>
                </div>
              )}
              {evento.inclui_hospedagem && (
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-purple-50/70 border border-purple-200 text-purple-900 text-xs font-semibold">
                  <Home className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>Hospedagem inclusa</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Descrição */}
        {evento.descricao && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="font-semibold text-[#123b63] mb-3">Sobre o evento</h2>
            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{evento.descricao}</p>
          </div>
        )}

        {/* Local */}
        {(evento.local_nome || evento.local_endereco) && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="font-semibold text-[#123b63] mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Local
            </h2>
            {evento.local_nome && <p className="text-gray-800 font-medium text-sm">{evento.local_nome}</p>}
            {evento.local_endereco && <p className="text-gray-500 text-sm">{evento.local_endereco}</p>}
          </div>
        )}

        {/* Status: cancelado */}
        {statusInsc === 'cancelado' && (
          <div className="bg-rose-50 rounded-xl border border-rose-200 p-6 text-center space-y-2 shadow-xs">
            <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
            <h3 className="font-bold text-base text-rose-900">Evento Cancelado</h3>
            <p className="text-rose-700 text-sm">
              {evento.motivo_bloqueio || 'Este evento foi cancelado pela organização e não está aceitando novas inscrições.'}
            </p>
          </div>
        )}

        {/* Status: expirado / realizado */}
        {statusInsc === 'expirado' && (
          <div className="bg-amber-50/80 rounded-xl border border-amber-200 p-6 text-center space-y-2 shadow-xs">
            <Clock className="w-10 h-10 text-amber-500 mx-auto" />
            <h3 className="font-bold text-base text-amber-900">Inscrições Encerradas</h3>
            <p className="text-amber-800 text-sm">
              {evento.motivo_bloqueio || 'Este evento já foi realizado ou o prazo de inscrições expirou.'}
            </p>
          </div>
        )}

        {/* Status: encerramento manual pela organização */}
        {statusInsc === 'encerrado_manual' && (
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 text-center space-y-2 shadow-xs">
            <AlertTriangle className="w-10 h-10 text-slate-400 mx-auto" />
            <h3 className="font-bold text-base text-slate-800">Inscrições Encerradas</h3>
            <p className="text-slate-600 text-sm">
              {evento.motivo_bloqueio || 'As inscrições para este evento foram encerradas pela organização.'}
            </p>
          </div>
        )}

        {/* Sucesso — Pago via PIX */}
        {sucesso && pixData && sucesso.status === 'aguardando_pagamento' && (
          <div className="bg-white rounded-xl border border-[#123b63]/20 p-6 shadow-md space-y-5">
            {pixStatus === 'pago' ? (
              <div className="text-center space-y-3">
                <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-1" />
                <h3 className="font-bold text-xl text-gray-800">Pagamento confirmado!</h3>
                <p className="text-gray-600 text-sm">Olá, <strong>{sucesso.nome}</strong>! Sua inscrição foi confirmada. Nos vemos em breve!</p>
                {sucesso.tem_brinde && (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold">
                    <Gift className="w-4 h-4 text-emerald-600" />
                    <span>✓ Brinde incluso</span>
                  </div>
                )}
              </div>
            ) : pixStatus === 'expirado' ? (
              <div className="text-center">
                <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                <h3 className="font-bold text-lg text-gray-800 mb-1">PIX expirado</h3>
                <p className="text-gray-600 text-sm mb-4">O prazo de pagamento expirou. Por favor, realize uma nova inscrição.</p>
                <button
                  onClick={() => { setSucesso(null); setPixData(null); setPixStatus('pendente'); }}
                  className="inline-flex items-center gap-2 bg-[#123b63] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#0e2d4f]"
                >
                  <RefreshCw className="w-4 h-4" /> Tentar novamente
                </button>
              </div>
            ) : (
              <>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Olá, <strong>{sucesso.nome}</strong>! Escaneie o QR Code ou copie o código PIX para pagar.</p>
                  <p className="text-lg font-bold text-[#123b63] mt-1">
                    {pixData.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>

                {pixData.qrcode_base64 && (
                  <div className="flex justify-center">
                    <img
                      src={`data:image/png;base64,${pixData.qrcode_base64}`}
                      alt="QR Code PIX"
                      className="w-48 h-48 rounded-lg border border-gray-200"
                    />
                  </div>
                )}

                {pixData.payload && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1 text-center">Código PIX copia e cola:</p>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={pixData.payload}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono bg-gray-50 truncate"
                      />
                      <button
                        onClick={copiarPix}
                        className="shrink-0 flex items-center gap-1.5 bg-[#123b63] text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-[#0e2d4f]"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copiado ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 justify-center text-xs text-gray-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Aguardando confirmação do pagamento...
                </div>

                {pixData.expira_em && (
                  <p className="text-center text-xs text-amber-600">
                    Válido até {new Date(pixData.expira_em).toLocaleString('pt-BR')}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Sucesso — Gratuito ou Lista de Espera */}
        {sucesso && !pixData && (
          <div className={`rounded-xl border p-6 text-center space-y-3 ${sucesso.status === 'confirmado' ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
            <CheckCircle2 className={`w-12 h-12 mx-auto mb-1 ${sucesso.status === 'confirmado' ? 'text-green-500' : 'text-amber-500'}`} />
            <h3 className="font-bold text-lg text-gray-800">
              {sucesso.status === 'confirmado' ? 'Inscrição confirmada!' : 'Você está na lista de espera!'}
            </h3>
            <p className="text-gray-600 text-sm">
              {sucesso.status === 'confirmado'
                ? `Olá, ${sucesso.nome}! Sua inscrição foi registrada com sucesso. Nos vemos em breve!`
                : `Olá, ${sucesso.nome}! O evento está lotado. Você foi adicionado à lista de espera e será notificado se surgir uma vaga.`
              }
            </p>
            {sucesso.status === 'confirmado' && sucesso.tem_brinde && (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold">
                <Gift className="w-4 h-4 text-emerald-600" />
                <span>✓ Brinde incluso</span>
              </div>
            )}
          </div>
        )}

        {/* Lotado mas aceita lista de espera */}
        {mostrarLotado && !sucesso && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              <strong>Evento lotado.</strong> Você ainda pode se inscrever para entrar na lista de espera e ser notificado se surgir uma vaga.
            </p>
          </div>
        )}

        {/* Formulário de inscrição */}
        {podeSe && (
          <div className="bg-white rounded-xl border border-[#123b63]/20 p-6 shadow-md">
            <h2 className="font-bold text-[#123b63] text-lg mb-5">
              {mostrarLotado ? 'Entrar na lista de espera' : 'Inscrever-se'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative" ref={dropdownRef}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-500 block">Nome completo *</label>
                    {membroConfirmadoBadge && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <UserCheck className="w-3 h-3 text-emerald-600" />
                        Membro Identificado
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      required
                      value={form.nome}
                      onChange={e => handleNomeChange(e.target.value)}
                      onFocus={() => {
                        if (sugestoesMembros.length > 0) setMostrarDropdown(true);
                      }}
                      onKeyDown={handleKeyDownNome}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]/30"
                      placeholder="Digite seu nome (busca a partir de 3 letras)"
                      autoComplete="off"
                    />
                    <div className="absolute right-3 top-2.5 text-gray-400 pointer-events-none">
                      {buscandoMembros ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#123b63]" />
                      ) : (
                        <Search className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Dropdown de sugestões */}
                  {mostrarDropdown && form.nome.trim().length >= 3 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      {sugestoesMembros.length > 0 ? (
                        <div className="p-1.5 space-y-1">
                          <p className="px-2.5 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            Membros encontrados na igreja:
                          </p>
                          {sugestoesMembros.map((m, idx) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => handleSelecionarMembro(m)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition ${
                                idx === indiceFocado ? 'bg-[#123b63]/10 text-[#123b63]' : 'hover:bg-gray-50 text-gray-800'
                              }`}
                            >
                              <div>
                                <p className="font-semibold">{m.nome}</p>
                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                  <span>{m.congregacao_nome}</span>
                                </p>
                              </div>
                              <span className="text-[11px] font-medium text-[#123b63] bg-[#123b63]/5 px-2 py-1 rounded">
                                Selecionar
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 text-center text-xs text-gray-500">
                          Nenhum membro encontrado com este nome. Você pode continuar preenchendo normalmente como participante não cadastrado.
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">E-mail *</label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]/30"
                    placeholder="seu@email.com"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Telefone / WhatsApp *</label>
                  <input
                    required
                    type="tel"
                    inputMode="tel"
                    value={form.telefone}
                    onChange={e => setForm(f => ({ ...f, telefone: aplicarMascaraTelefone(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]/30"
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Congregação</label>
                  {evento.congregacoes && evento.congregacoes.length > 0 ? (
                    <select
                      value={form.congregacao}
                      onChange={e => setForm(f => ({ ...f, congregacao: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#123b63]/30"
                    >
                      <option value="">Selecione sua congregação (opcional)</option>
                      {evento.congregacoes.map(c => (
                        <option key={c.id} value={c.nome}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={form.congregacao}
                      onChange={e => setForm(f => ({ ...f, congregacao: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]/30"
                      placeholder="Sua congregação (opcional)"
                    />
                  )}
                </div>
                {evento.valor_inscricao > 0 && (
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">CPF / CNPJ <span className="text-gray-400">(opcional, para emissão da nota)</span></label>
                    <input
                      value={form.cpf_cnpj}
                      onChange={e => setForm(f => ({ ...f, cpf_cnpj: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]/30"
                      placeholder="000.000.000-00"
                    />
                  </div>
                )}
              </div>

              {erro && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {erro}
                </div>
              )}

              <button
                type="submit"
                disabled={enviando}
                className="w-full bg-[#123b63] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#0e2d4f] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
                {enviando
                  ? 'Enviando...'
                  : mostrarLotado
                    ? 'Entrar na lista de espera'
                    : evento.valor_inscricao > 0
                      ? `Pagar ${evento.valor_inscricao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} via PIX`
                      : 'Confirmar inscrição'
                }
              </button>
            </form>
          </div>
        )}

        {/* Modal de Confirmação Segura de Identidade (LGPD) */}
        {modalConfirmacaoAberto && membroSelecionado && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4 my-auto">
              <button
                type="button"
                onClick={() => {
                  setModalConfirmacaoAberto(false);
                  setMembroSelecionado(null);
                }}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#123b63]/10 flex items-center justify-center text-[#123b63]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-base">Confirmar Identidade</h3>
                  <p className="text-xs text-gray-500">
                    Você selecionou: <strong>{membroSelecionado.nome}</strong>
                  </p>
                </div>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed">
                Por proteção de dados (LGPD), confirme seu CPF ou Data de Nascimento para preenchimento automático seguro:
              </p>

              {/* Seletor do método de verificação com CPF como padrão */}
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setTipoConfirmacao('cpf');
                    setValorConfirmacao('');
                    setErroConfirmacao(null);
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg font-bold transition border cursor-pointer ${
                    tipoConfirmacao === 'cpf'
                      ? 'bg-[#123b63] text-white border-[#123b63] shadow-xs'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  CPF (Principal)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTipoConfirmacao('nascimento');
                    setValorConfirmacao('');
                    setErroConfirmacao(null);
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg font-bold transition border cursor-pointer ${
                    tipoConfirmacao === 'nascimento'
                      ? 'bg-[#123b63] text-white border-[#123b63] shadow-xs'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  Data de Nascimento
                </button>
              </div>

              <form onSubmit={handleConfirmarIdentidade} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    {tipoConfirmacao === 'cpf' ? 'Informe o CPF cadastrado:' : 'Informe a Data de Nascimento:'}
                  </label>
                  <input
                    ref={inputConfirmacaoRef}
                    required
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={valorConfirmacao}
                    onChange={e => {
                      const raw = e.target.value;
                      if (tipoConfirmacao === 'cpf') {
                        setValorConfirmacao(aplicarMascaraCpf(raw));
                      } else {
                        setValorConfirmacao(aplicarMascaraData(raw));
                      }
                      if (erroConfirmacao) setErroConfirmacao(null);
                    }}
                    placeholder={tipoConfirmacao === 'cpf' ? '000.000.000-00' : 'DD/MM/AAAA'}
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]/40 tracking-wider font-medium text-gray-900 bg-white"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    {tipoConfirmacao === 'cpf'
                      ? 'Digite os 11 números do seu CPF.'
                      : 'Digite o dia, mês e ano com 4 dígitos.'}
                  </p>
                </div>

                {erroConfirmacao && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                    {erroConfirmacao}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setModalConfirmacaoAberto(false);
                      setMembroSelecionado(null);
                    }}
                    className="flex-1 py-2.5 px-3 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                  >
                    Digitar Manualmente
                  </button>
                  <button
                    type="submit"
                    disabled={
                      confirmandoMembro ||
                      (tipoConfirmacao === 'cpf'
                        ? valorConfirmacao.replace(/\D/g, '').length !== 11
                        : valorConfirmacao.replace(/\D/g, '').length !== 8)
                    }
                    className="flex-1 py-2.5 px-3 rounded-lg bg-[#123b63] text-xs font-semibold text-white hover:bg-[#0e2d4f] disabled:opacity-50 flex items-center justify-center gap-1.5 transition"
                  >
                    {confirmandoMembro ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Validando...
                      </>
                    ) : (
                      'Confirmar e Preencher'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pb-4">
          Powered by Gestão Eklesia
        </p>
      </div>
    </div>
  );
}
