'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { CalendarDays, MapPin, Users, Clock, AlertTriangle, CheckCircle2, Loader2, Copy, RefreshCw } from 'lucide-react';

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
  inscritos_confirmados: number;
  lista_espera: number;
  vagas_restantes: number | null;
  lotado: boolean;
}

type FormState = {
  nome: string;
  email: string;
  telefone: string;
  igreja: string;
  cidade: string;
  cpf_cnpj: string;
};

const FORM_INICIAL: FormState = { nome: '', email: '', telefone: '', igreja: '', cidade: '', cpf_cnpj: '' };

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
    conferencia:    'Conferência',
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
  const [sucesso, setSucesso] = useState<{ nome: string; status: string } | null>(null);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [pixStatus, setPixStatus] = useState<'pendente' | 'pago' | 'expirado'>('pendente');
  const [copiado, setCopiado] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        body: JSON.stringify({ slug, ...form }),
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
        setSucesso({ nome: data.nome, status: 'aguardando_pagamento' });
        setForm(FORM_INICIAL);
        if (data.pagamento_id) startPixPolling(data.pagamento_id);
      } else {
        setSucesso({ nome: data.nome, status: data.status });
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

  const encerrado = evento.status === 'cancelado' || evento.status === 'realizado';
  const podeSe = evento.aceita_inscricao && !encerrado && !sucesso;
  const mostrarLotado = evento.lotado && evento.aceita_inscricao && !encerrado;

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
          {evento.valor_inscricao > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
              <p className="text-xs text-gray-500 mb-1">Inscrição</p>
              <p className="text-xl font-bold text-[#123b63]">
                {evento.valor_inscricao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          )}
        </div>

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

        {/* Status: cancelado/realizado */}
        {encerrado && (
          <div className="bg-gray-50 rounded-xl border border-gray-300 p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600 font-semibold">
              {evento.status === 'cancelado' ? 'Este evento foi cancelado.' : 'Este evento já foi realizado.'}
            </p>
          </div>
        )}

        {/* Sucesso — Pago via PIX */}
        {sucesso && pixData && sucesso.status === 'aguardando_pagamento' && (
          <div className="bg-white rounded-xl border border-[#123b63]/20 p-6 shadow-md space-y-5">
            {pixStatus === 'pago' ? (
              <div className="text-center">
                <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-3" />
                <h3 className="font-bold text-xl text-gray-800 mb-1">Pagamento confirmado!</h3>
                <p className="text-gray-600 text-sm">Olá, {sucesso.nome}! Sua inscrição foi confirmada. Nos vemos em breve!</p>
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
          <div className={`rounded-xl border p-6 text-center ${sucesso.status === 'confirmado' ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
            <CheckCircle2 className={`w-12 h-12 mx-auto mb-3 ${sucesso.status === 'confirmado' ? 'text-green-500' : 'text-amber-500'}`} />
            <h3 className="font-bold text-lg text-gray-800 mb-1">
              {sucesso.status === 'confirmado' ? 'Inscrição confirmada!' : 'Você está na lista de espera!'}
            </h3>
            <p className="text-gray-600 text-sm">
              {sucesso.status === 'confirmado'
                ? `Olá, ${sucesso.nome}! Sua inscrição foi registrada com sucesso. Nos vemos em breve!`
                : `Olá, ${sucesso.nome}! O evento está lotado. Você foi adicionado à lista de espera e será notificado se surgir uma vaga.`
              }
            </p>
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
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Nome completo *</label>
                  <input
                    required
                    value={form.nome}
                    onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]/30"
                    placeholder="Seu nome"
                  />
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
                    value={form.telefone}
                    onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]/30"
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Igreja / Organização</label>
                  <input
                    value={form.igreja}
                    onChange={e => setForm(f => ({ ...f, igreja: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]/30"
                    placeholder="Opcional"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Cidade</label>
                  <input
                    value={form.cidade}
                    onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]/30"
                    placeholder="Opcional"
                  />
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

        {/* Sem inscrição aberta */}
        {!encerrado && !evento.aceita_inscricao && (
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-center">
            <p className="text-gray-500 text-sm">As inscrições para este evento estão encerradas.</p>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pb-4">
          Powered by Gestão Eklesia
        </p>
      </div>
    </div>
  );
}
