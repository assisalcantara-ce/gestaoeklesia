'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, Copy, Loader2, AlertTriangle, QrCode } from 'lucide-react';

interface DestinoInfo {
  label: string;
  descricao: string | null;
  tipo_recebimento: string;
  tipo_label: string;
  valor_fixo: number | null;
  congregacao_nome: string | null;
}

interface PixData {
  charge_id: string | null;
  pix_payload: string | null;
  pix_qrcode: string | null;
  invoice_url: string | null;
  expires_at: string | null;
  valor: number;
}

const TIPO_CORES: Record<string, string> = {
  dizimo:        'bg-green-100 text-green-800',
  oferta:        'bg-blue-100 text-blue-800',
  missoes:       'bg-teal-100 text-teal-800',
  doacao:        'bg-pink-100 text-pink-800',
  campanha_local: 'bg-orange-100 text-orange-800',
  evento_local:  'bg-purple-100 text-purple-800',
};

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtExpires(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function PagarPage() {
  const params = useParams<{ token: string }>();
  const token  = params?.token ?? '';

  // ── Estados ───────────────────────────────────────────────────────────────
  const [loading, setLoading]   = useState(true);
  const [destino, setDestino]   = useState<DestinoInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [errMsg,   setErrMsg]   = useState<string | null>(null);

  // Formulário
  const [nome,     setNome]     = useState('');
  const [email,    setEmail]    = useState('');
  const [cpfCnpj,  setCpfCnpj]  = useState('');
  const [valor,    setValor]    = useState('');

  // PIX gerado
  const [pix,       setPix]      = useState<PixData | null>(null);
  const [paying,    setPaying]   = useState(false);
  const [payError,  setPayError] = useState<string | null>(null);
  const [copied,    setCopied]   = useState(false);

  // ── Carrega info do destino ───────────────────────────────────────────────
  const loadDestino = useCallback(async () => {
    if (!token) return;
    try {
      const res  = await fetch(`/api/v1/pagar/${token}`);
      const data = await res.json();

      if (!res.ok) {
        setNotFound(true);
        setErrMsg(data.error ?? 'Link inválido.');
        return;
      }
      setDestino(data as DestinoInfo);
    } catch {
      setNotFound(true);
      setErrMsg('Erro ao carregar link de pagamento.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void loadDestino(); }, [loadDestino]);

  // ── Gera PIX ──────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPayError(null);
    setPaying(true);

    try {
      const body: Record<string, unknown> = { nome: nome.trim(), email: email.trim(), cpfCnpj: cpfCnpj.trim() };

      if (!destino?.valor_fixo) {
        const v = parseFloat(valor.replace(',', '.'));
        if (!v || v <= 0) {
          setPayError('Informe um valor válido.');
          setPaying(false);
          return;
        }
        body.valor = v;
      }

      const res  = await fetch(`/api/v1/pagar/${token}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setPayError(data.error ?? 'Erro ao gerar PIX.');
        return;
      }
      setPix(data as PixData);
    } catch {
      setPayError('Erro de conexão. Tente novamente.');
    } finally {
      setPaying(false);
    }
  }

  // ── Copia código PIX ──────────────────────────────────────────────────────
  async function copiarPix() {
    if (!pix?.pix_payload) return;
    try {
      await navigator.clipboard.writeText(pix.pix_payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* fallback silencioso */
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#123b63]" />
      </div>
    );
  }

  // ── Não encontrado ────────────────────────────────────────────────────────
  if (notFound || !destino) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">Link Inativo</h1>
          <p className="text-sm text-gray-500">{errMsg ?? 'Este link não está disponível.'}</p>
        </div>
      </div>
    );
  }

  // ── PIX gerado: tela de pagamento ─────────────────────────────────────────
  if (pix) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
          {/* Header */}
          <div className="text-center mb-5">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
              <QrCode className="h-6 w-6 text-green-700" />
            </div>
            <h1 className="text-lg font-bold text-gray-800">QR Code PIX</h1>
            <p className="text-sm text-gray-500 mt-1">{destino.label}</p>
            <p className="text-2xl font-bold text-green-700 mt-2">{fmtBRL(pix.valor)}</p>
            {pix.expires_at && (
              <p className="text-xs text-gray-400 mt-1">Expira: {fmtExpires(pix.expires_at)}</p>
            )}
          </div>

          {/* QR Code */}
          {pix.pix_qrcode ? (
            <div className="flex justify-center mb-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pix.pix_qrcode}
                alt="QR Code PIX"
                className="w-56 h-56 border border-gray-200 rounded-xl"
              />
            </div>
          ) : (
            <div className="bg-gray-100 rounded-xl h-56 flex items-center justify-center mb-5">
              <p className="text-sm text-gray-400">QR Code indisponível</p>
            </div>
          )}

          {/* Copia e cola */}
          {pix.pix_payload && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Ou copie o código:
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={pix.pix_payload}
                  className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 truncate"
                />
                <button
                  onClick={copiarPix}
                  className="flex items-center gap-1 px-3 py-2 bg-[#123b63] text-white rounded-lg text-xs font-semibold hover:bg-[#1a4f85] transition shrink-0"
                >
                  {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>
          )}

          {/* Link da fatura */}
          {pix.invoice_url && (
            <a
              href={pix.invoice_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-sm text-[#123b63] font-semibold underline mb-4"
            >
              Ver fatura online
            </a>
          )}

          {/* Instrução */}
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <p className="text-xs text-blue-700">
              Abra o app do seu banco, escolha <strong>Pagar com PIX</strong> e escaneie o QR Code ou cole o código.
            </p>
          </div>

          <button
            onClick={() => { setPix(null); setNome(''); setEmail(''); setCpfCnpj(''); setValor(''); }}
            className="mt-4 w-full py-2 text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Fazer outro pagamento
          </button>
        </div>
      </div>
    );
  }

  // ── Formulário ────────────────────────────────────────────────────────────
  const tipoCor = TIPO_CORES[destino.tipo_recebimento] ?? 'bg-gray-100 text-gray-700';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#123b63] rounded-full mb-3">
            <QrCode className="h-7 w-7 text-white" />
          </div>
          {destino.congregacao_nome && (
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{destino.congregacao_nome}</p>
          )}
          <h1 className="text-xl font-bold text-gray-800">{destino.label}</h1>
          <span className={`inline-block mt-2 text-xs font-semibold px-2.5 py-0.5 rounded-full ${tipoCor}`}>
            {destino.tipo_label}
          </span>
          {destino.descricao && (
            <p className="text-sm text-gray-500 mt-2">{destino.descricao}</p>
          )}
          {destino.valor_fixo != null && (
            <p className="text-3xl font-bold text-green-700 mt-3">{fmtBRL(destino.valor_fixo)}</p>
          )}
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Seu nome <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="João da Silva"
              required
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              E-mail <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="joao@email.com"
              required
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              CPF ou CNPJ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={cpfCnpj}
              onChange={e => setCpfCnpj(e.target.value)}
              placeholder="000.000.000-00"
              required
              maxLength={18}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]"
            />
          </div>

          {/* Valor: só exibe se não for fixo */}
          {destino.valor_fixo == null && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Valor (R$) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={valor}
                onChange={e => setValor(e.target.value)}
                placeholder="0,00"
                min="0.01"
                max="99999.99"
                step="0.01"
                required
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]"
              />
            </div>
          )}

          {payError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{payError}</p>
          )}

          <button
            type="submit"
            disabled={paying}
            className="w-full py-3 bg-[#123b63] text-white rounded-xl font-semibold text-sm hover:bg-[#1a4f85] transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {paying && <Loader2 className="h-4 w-4 animate-spin" />}
            {paying ? 'Gerando PIX...' : 'Gerar QR Code PIX'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-5">
          Pagamento seguro via PIX. Seus dados são usados apenas para identificação do pagamento.
        </p>
      </div>
    </div>
  );
}
