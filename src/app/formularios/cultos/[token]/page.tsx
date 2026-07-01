'use client';

import { useEffect, useState, use } from 'react';
import { createClient } from '@/lib/supabase-client';
import { Loader2, CheckCircle2, AlertCircle, Church, Users, User, Phone, MapPin, Home, Briefcase } from 'lucide-react';

interface TokenData {
  id: string;
  ministry_id: string;
  culto_id: string;
  token: string;
  is_active: boolean;
  expires_at: string | null;
  culto_registros?: {
    tipo_culto: string;
    data_culto: string;
    horario_culto: string;
    status: string;
    congregacao_id: string;
    congregacoes?: {
      nome: string;
    } | null;
  } | null;
}

const CARGO_OPTIONS = [
  'Pastor',
  'Evangelista',
  'Presbítero',
  'Diácono',
  'Missionário',
  'Outro',
];

const EMPTY_FORM = {
  nome: '',
  telefone: '',
  cidade: '',
  bairro: '',
  igreja_origem: '',
  primeira_visita: true,
  is_ministro: false,
  cargo_ministerial: 'Pastor',
  observacoes: '',
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
};

export default function PublicCultoRecepcaoPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState(EMPTY_FORM);

  // ---------- Validar token ----------
  useEffect(() => {
    if (!token) return;

    const fetchToken = async () => {
      try {
        const { data, error } = await supabase
          .from('culto_tokens')
          .select(`
            *,
            culto_registros (
              tipo_culto,
              data_culto,
              horario_culto,
              status,
              congregacao_id,
              congregacoes ( nome )
            )
          `)
          .eq('token', token)
          .single();

        if (error || !data) {
          setErrorMsg('Este link de recepção é inválido ou não existe.');
          return;
        }

        if (!data.is_active) {
          setErrorMsg('Este link de recepção está inativo. Solicite um novo link ao responsável.');
          return;
        }

        if (data.expires_at && new Date(data.expires_at) <= new Date()) {
          setErrorMsg('Este link de recepção expirou. Solicite um novo link ao responsável.');
          return;
        }

        const cultoStatus = data.culto_registros?.status;
        if (cultoStatus && cultoStatus !== 'Aberto') {
          setErrorMsg(
            `O culto "${data.culto_registros?.tipo_culto}" do dia ${formatDate(data.culto_registros?.data_culto)} já foi ${cultoStatus.toLowerCase()} e não está mais aceitando novos registros.`
          );
          return;
        }

        setTokenData(data as TokenData);
      } catch (err) {
        console.error(err);
        setErrorMsg('Erro ao verificar o link. Tente novamente.');
      } finally {
        setLoading(false);
      }
    };

    fetchToken();
  }, [token]);

  // ---------- Submissão ----------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tokenData || !formData.nome.trim()) return;

    setSubmitting(true);
    try {
      // congregacao_id pode vir do join ou ser buscado diretamente se o join não retornou
      let congregacaoId: string | null = tokenData.culto_registros?.congregacao_id || null;

      if (!congregacaoId && tokenData.culto_id) {
        const { data: cultoData } = await supabase
          .from('culto_registros')
          .select('congregacao_id')
          .eq('id', tokenData.culto_id)
          .single();
        congregacaoId = cultoData?.congregacao_id ?? null;
      }

      const payload = {
        culto_id: tokenData.culto_id,
        ministry_id: tokenData.ministry_id,
        congregacao_id: congregacaoId,
        nome: formData.nome.trim(),
        telefone: formData.telefone.trim() || null,
        cidade: formData.cidade.trim() || null,
        bairro: formData.bairro.trim() || null,
        igreja_origem: formData.igreja_origem.trim() || null,
        primeira_visita: formData.primeira_visita,
        is_ministro: formData.is_ministro,
        cargo_ministerial: formData.is_ministro ? formData.cargo_ministerial : null,
        observacoes: formData.observacoes.trim() || null,
      };

      const { error } = await supabase.from('culto_visitantes').insert(payload);

      if (error) {
        throw error;
      }

      setSuccess(true);
      setFormData(EMPTY_FORM);
    } catch (err) {
      console.error(err);
      alert('Erro ao registrar visitante. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Renderização de estados especiais ----------
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#062E6F] via-[#0A4499] to-[#1565C0] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-white animate-spin" />
          <p className="text-white/80 text-sm font-medium">Verificando link...</p>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#062E6F] via-[#0A4499] to-[#1565C0] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <AlertCircle className="h-14 w-14 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Link Indisponível</h2>
          <p className="text-slate-600 text-sm leading-relaxed">{errorMsg}</p>
        </div>
      </div>
    );
  }

  const culto = tokenData?.culto_registros;
  const congregacaoNome = culto?.congregacoes?.nome;

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#062E6F] via-[#0A4499] to-[#1565C0] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Visitante Registrado!</h2>
          <p className="text-slate-500 text-sm mb-6">
            Obrigado pela sua presença. Que Deus abençoe sua vida!
          </p>
          <button
            onClick={() => setSuccess(false)}
            className="px-6 py-3 bg-[#062E6F] hover:bg-[#0A4499] text-white rounded-xl font-bold text-sm transition"
          >
            Registrar Outro Visitante
          </button>
        </div>
      </div>
    );
  }

  // ---------- Formulário principal ----------
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#062E6F] via-[#0A4499] to-[#1565C0] flex flex-col items-center justify-start py-10 px-4">
      {/* Card principal */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-[#062E6F] to-[#1565C0] px-6 py-5 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-xl">
              <Church className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Recepção de Visitantes</h1>
              {congregacaoNome && (
                <p className="text-blue-200 text-xs">{congregacaoNome}</p>
              )}
            </div>
          </div>

          {culto && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/20 rounded-lg text-xs font-medium">
                <Church className="h-3 w-3" />
                {culto.tipo_culto}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/20 rounded-lg text-xs font-medium">
                📅 {formatDate(culto.data_culto)}
              </span>
              {culto.horario_culto && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/20 rounded-lg text-xs font-medium">
                  🕐 {culto.horario_culto}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Instruções */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
            <Users className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 leading-relaxed">
              Preencha seus dados para registrar sua presença neste culto. Apenas o nome é obrigatório.
            </p>
          </div>

          {/* Nome */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-[#062E6F]" />
              Nome Completo <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.nome}
              onChange={e => setFormData(prev => ({ ...prev, nome: e.target.value }))}
              placeholder="Seu nome completo"
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#062E6F]/30 focus:border-[#062E6F]"
              required
              autoFocus
            />
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-[#062E6F]" />
              Telefone / WhatsApp
            </label>
            <input
              type="tel"
              value={formData.telefone}
              onChange={e => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
              placeholder="(00) 00000-0000"
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#062E6F]/30 focus:border-[#062E6F]"
            />
          </div>

          {/* Cidade e Bairro */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-[#062E6F]" />
                Cidade
              </label>
              <input
                type="text"
                value={formData.cidade}
                onChange={e => setFormData(prev => ({ ...prev, cidade: e.target.value }))}
                placeholder="Ex: São Paulo"
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#062E6F]/30 focus:border-[#062E6F]"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Home className="h-3.5 w-3.5 text-[#062E6F]" />
                Bairro
              </label>
              <input
                type="text"
                value={formData.bairro}
                onChange={e => setFormData(prev => ({ ...prev, bairro: e.target.value }))}
                placeholder="Ex: Centro"
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#062E6F]/30 focus:border-[#062E6F]"
              />
            </div>
          </div>

          {/* Igreja de Origem */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Church className="h-3.5 w-3.5 text-[#062E6F]" />
              Igreja de Origem
            </label>
            <input
              type="text"
              value={formData.igreja_origem}
              onChange={e => setFormData(prev => ({ ...prev, igreja_origem: e.target.value }))}
              placeholder="Ex: Assembleia de Deus, Batista..."
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#062E6F]/30 focus:border-[#062E6F]"
            />
          </div>

          {/* Checkboxes */}
          <div className="space-y-3">
            {/* Primeira visita */}
            <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition select-none">
              <input
                type="checkbox"
                checked={formData.primeira_visita}
                onChange={e => setFormData(prev => ({ ...prev, primeira_visita: e.target.checked }))}
                className="h-4 w-4 text-[#062E6F] border-slate-300 rounded"
              />
              <span className="text-sm font-semibold text-slate-700">É minha primeira visita nesta congregação</span>
            </label>

            {/* É ministro */}
            <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition select-none">
              <input
                type="checkbox"
                checked={formData.is_ministro}
                onChange={e => setFormData(prev => ({ ...prev, is_ministro: e.target.checked }))}
                className="h-4 w-4 text-[#062E6F] border-slate-300 rounded"
              />
              <span className="text-sm font-semibold text-slate-700">Sou ministro / oficial eclesiástico</span>
            </label>
          </div>

          {/* Cargo ministerial (condicional) */}
          {formData.is_ministro && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-[#062E6F]" />
                Cargo Ministerial
              </label>
              <select
                value={formData.cargo_ministerial}
                onChange={e => setFormData(prev => ({ ...prev, cargo_ministerial: e.target.value }))}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#062E6F]/30 focus:border-[#062E6F]"
              >
                {CARGO_OPTIONS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}

          {/* Observações */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              Observações / Pedido de Oração
            </label>
            <textarea
              rows={3}
              value={formData.observacoes}
              onChange={e => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
              placeholder="Alguma observação ou pedido de oração..."
              maxLength={500}
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#062E6F]/30 focus:border-[#062E6F] resize-none"
            />
            <p className="text-[10px] text-slate-400 text-right mt-0.5">{formData.observacoes.length}/500</p>
          </div>

          {/* Botão de envio */}
          <button
            type="submit"
            disabled={submitting || !formData.nome.trim()}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#062E6F] hover:bg-[#0A4499] text-white rounded-xl font-bold text-sm shadow-lg transition disabled:opacity-55 disabled:cursor-not-allowed"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? 'Registrando...' : '✅ Registrar minha presença'}
          </button>
        </form>

        {/* Footer */}
        <div className="px-6 pb-5 text-center">
          <p className="text-[10px] text-slate-400">
            Gestão Eklésia · Recepção de Cultos · Dados protegidos
          </p>
        </div>
      </div>
    </div>
  );
}
