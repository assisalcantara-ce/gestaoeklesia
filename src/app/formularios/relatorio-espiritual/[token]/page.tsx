'use client';

import { useEffect, useState, use } from 'react';
import { createClient } from '@/lib/supabase-client';
import { Loader2, CheckCircle2, AlertCircle, Church, Home, Flame, BookOpen, FileText, GlassWater, UserPlus, Plus, Minus } from 'lucide-react';

interface TokenData {
  id: string;
  ministry_id: string;
  congregacao_id: string | null;
  token: string;
  is_active: boolean;
  ministries?: {
    name: string;
  } | null;
  congregacoes?: {
    nome: string;
  } | null;
}

const TIPO_ATIVIDADE_OPTIONS = [
  { value: 'Culto', label: '⛪ Culto' },
  { value: 'Santa Ceia', label: '🍇 Santa Ceia' },
  { value: 'Visita', label: '🏠 Visita' },
  { value: 'Evangelismo', label: '📢 Evangelismo' },
  { value: 'Outro', label: 'Outro' }
];

export default function PublicRelatorioEspiritualPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    data_atividade: new Date().toISOString().split('T')[0],
    tipo_atividade: 'Culto' as 'Culto' | 'Santa Ceia' | 'Visita' | 'Evangelismo' | 'Outro',
    cultos_realizados: 0,
    visitas_realizadas: 0,
    almas_alcancadas: 0,
    biblias_doadas: 0,
    literaturas_entregues: 0,
    membros_cearam: 0,
    visitantes_presentes: 0,
    observacoes: ''
  });

  useEffect(() => {
    if (!token) return;

    const fetchTokenData = async () => {
      try {
        const { data, error } = await supabase
          .from('relatorio_espiritual_tokens')
          .select(`
            *,
            ministries ( name ),
            congregacoes ( nome )
          `)
          .eq('token', token)
          .eq('is_active', true)
          .single();

        if (error || !data) {
          setErrorMsg('Este link de formulário expirou, está inativo ou não existe.');
        } else {
          setTokenData(data as any);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg('Erro operacional ao validar o token.');
      } finally {
        setLoading(false);
      }
    };

    fetchTokenData();
  }, [token, supabase]);

  const incrementMetric = (key: keyof typeof formData) => {
    setFormData(prev => ({
      ...prev,
      [key]: Math.max(0, (Number(prev[key]) || 0) + 1)
    }));
  };

  const decrementMetric = (key: keyof typeof formData) => {
    setFormData(prev => ({
      ...prev,
      [key]: Math.max(0, (Number(prev[key]) || 0) - 1)
    }));
  };

  const handleInputChange = (key: keyof typeof formData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenData) return;

    setSubmitting(true);
    const payload: any = {
      ministry_id: tokenData.ministry_id,
      congregacao_id: tokenData.congregacao_id,
      data_atividade: formData.data_atividade,
      tipo_atividade: formData.tipo_atividade,
      cultos_realizados: Number(formData.cultos_realizados) || 0,
      visitas_realizadas: Number(formData.visitas_realizadas) || 0,
      almas_alcancadas: Number(formData.almas_alcancadas) || 0,
      biblias_doadas: Number(formData.biblias_doadas) || 0,
      literaturas_entregues: Number(formData.literaturas_entregues) || 0,
      observacoes: formData.observacoes.trim() || null,
      status: 'Enviado', // Gravar como Enviado
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (formData.tipo_atividade === 'Santa Ceia') {
      payload.membros_cearam = Number(formData.membros_cearam) || 0;
    } else {
      payload.membros_cearam = 0;
    }

    if (formData.tipo_atividade === 'Culto') {
      payload.visitantes_presentes = Number(formData.visitantes_presentes) || 0;
    } else {
      payload.visitantes_presentes = 0;
    }

    try {
      const { error } = await supabase
        .from('relatorio_espiritual_registros')
        .insert(payload);

      if (error) {
        alert('Erro ao enviar relatório: ' + error.message);
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      console.error(err);
      alert('Erro de rede/operação.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto" />
          <p className="text-slate-400 text-sm font-medium">Validando link seguro...</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !tokenData) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl text-center space-y-5">
          <div className="p-3 bg-rose-500/10 text-rose-500 rounded-2xl inline-block">
            <AlertCircle className="h-10 w-10" />
          </div>
          <h2 className="text-xl font-bold text-white">Link Inválido</h2>
          <p className="text-slate-400 text-sm leading-relaxed">{errorMsg}</p>
          <div className="pt-2">
            <span className="text-slate-600 text-xs font-bold block uppercase tracking-widest">Gestão Eklésia</span>
          </div>
        </div>
      </div>
    );
  }

  const ministryName = (tokenData.ministries as any)?.name || 'Ministério';
  const congregacaoNome = (tokenData.congregacoes as any)?.nome || 'Sede / Geral';

  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center space-y-6">
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl inline-block">
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Relatório Enviado!</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              O relatório espiritual da congregação <strong>{congregacaoNome}</strong> foi enviado com sucesso e consolidado na Secretaria Geral.
            </p>
          </div>
          <div className="pt-4 border-t border-slate-800 flex flex-col gap-3">
            <button
              onClick={() => {
                setSuccess(false);
                setFormData({
                  data_atividade: new Date().toISOString().split('T')[0],
                  tipo_atividade: 'Culto',
                  cultos_realizados: 0,
                  visitas_realizadas: 0,
                  almas_alcancadas: 0,
                  biblias_doadas: 0,
                  literaturas_entregues: 0,
                  membros_cearam: 0,
                  visitantes_presentes: 0,
                  observacoes: ''
                });
              }}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition cursor-pointer"
            >
              Enviar Outro Relatório
            </button>
            <span className="text-slate-600 text-[10px] font-bold block uppercase tracking-widest">Gestão Eklésia</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4 flex justify-center items-start">
      <div className="max-w-xl w-full bg-slate-900 border border-slate-800 shadow-2xl rounded-3xl p-6 md:p-8 space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <span className="text-blue-500 text-xs font-bold tracking-widest uppercase block">{ministryName}</span>
          <h1 className="text-2xl md:text-3xl font-black text-white">Relatório Espiritual</h1>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-800 text-slate-300 rounded-full text-xs font-bold border border-slate-700">
            🏢 {congregacaoNome}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-2 uppercase tracking-wider">
                Data da Atividade
              </label>
              <input
                type="date"
                required
                value={formData.data_atividade}
                onChange={e => handleInputChange('data_atividade', e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 block mb-2 uppercase tracking-wider">
                Tipo da Atividade
              </label>
              <select
                value={formData.tipo_atividade}
                onChange={e => handleInputChange('tipo_atividade', e.target.value as any)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition"
              >
                {TIPO_ATIVIDADE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6 space-y-5">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Indicadores Espirituais</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Cultos */}
              <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
                    <Church className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Cultos</span>
                    <span className="text-[10px] text-slate-500">Realizados</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => decrementMetric('cultos_realizados')} className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-slate-300 transition">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center text-sm font-black text-white">{formData.cultos_realizados}</span>
                  <button type="button" onClick={() => incrementMetric('cultos_realizados')} className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-slate-300 transition">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Visitas */}
              <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                    <Home className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Visitas</span>
                    <span className="text-[10px] text-slate-500">Realizadas</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => decrementMetric('visitas_realizadas')} className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-slate-300 transition">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center text-sm font-black text-white">{formData.visitas_realizadas}</span>
                  <button type="button" onClick={() => incrementMetric('visitas_realizadas')} className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-slate-300 transition">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Almas */}
              <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl">
                    <Flame className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Almas</span>
                    <span className="text-[10px] text-slate-500">Alcançadas</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => decrementMetric('almas_alcancadas')} className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-slate-300 transition">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center text-sm font-black text-white">{formData.almas_alcancadas}</span>
                  <button type="button" onClick={() => incrementMetric('almas_alcancadas')} className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-slate-300 transition">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Bíblias */}
              <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Bíblias</span>
                    <span className="text-[10px] text-slate-500">Doadas</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => decrementMetric('biblias_doadas')} className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-slate-300 transition">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center text-sm font-black text-white">{formData.biblias_doadas}</span>
                  <button type="button" onClick={() => incrementMetric('biblias_doadas')} className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-slate-300 transition">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Literaturas */}
              <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-2xl flex items-center justify-between md:col-span-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-500/10 text-slate-400 rounded-xl">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Literaturas Entregues</span>
                    <span className="text-[10px] text-slate-500">Panfletos, folhetos, livros</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => decrementMetric('literaturas_entregues')} className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-slate-300 transition">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center text-sm font-black text-white">{formData.literaturas_entregues}</span>
                  <button type="button" onClick={() => incrementMetric('literaturas_entregues')} className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-slate-300 transition">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Condicionais */}
          {formData.tipo_atividade === 'Santa Ceia' && (
            <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                  <GlassWater className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Membros que Cearam</span>
                  <span className="text-[10px] text-slate-500">Total presente na comunhão</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => decrementMetric('membros_cearam')} className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-slate-300 transition">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center text-sm font-black text-white">{formData.membros_cearam}</span>
                <button type="button" onClick={() => incrementMetric('membros_cearam')} className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-slate-300 transition">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {formData.tipo_atividade === 'Culto' && (
            <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Visitantes Presentes</span>
                  <span className="text-[10px] text-slate-500">Pessoas não membros</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => decrementMetric('visitantes_presentes')} className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-slate-300 transition">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center text-sm font-black text-white">{formData.visitantes_presentes}</span>
                <button type="button" onClick={() => incrementMetric('visitantes_presentes')} className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-slate-300 transition">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 block uppercase tracking-wider">
              Observações (Opcional)
            </label>
            <textarea
              value={formData.observacoes}
              onChange={e => handleInputChange('observacoes', e.target.value)}
              placeholder="Informações adicionais do culto, batismos, eventos especiais, etc."
              className="w-full h-24 bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-2xl transition shadow-lg hover:shadow-blue-500/20 cursor-pointer flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Enviando relatório...
              </>
            ) : (
              'Enviar Relatório Espiritual'
            )}
          </button>
        </form>

        <div className="text-center pt-4 border-t border-slate-800/80 text-[10px] text-slate-500 font-bold tracking-widest uppercase">
          Gestão Eklésia • Conexão Segura
        </div>

      </div>
    </div>
  );
}
