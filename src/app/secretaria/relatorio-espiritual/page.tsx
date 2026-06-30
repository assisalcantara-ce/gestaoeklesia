'use client';

import { useEffect, useMemo, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import NotificationModal from '@/components/NotificationModal';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import { Pencil, Trash2, Plus, Minus, FileText, Loader2, Church, Home, Flame, BookOpen, GlassWater, UserPlus, Link as LinkIcon, Sparkles, Heart, Megaphone, Users, QrCode, Copy, RefreshCw, X, Globe } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import ExecutiveMetricCard from '@/components/dashboard/ExecutiveMetricCard';

interface LocalOption {
  id: string;
  nome: string;
}

interface RelatorioEspiritualRegistro {
  id: string;
  ministry_id: string;
  congregacao_id: string | null;
  data_atividade: string;
  tipo_atividade: 'Culto' | 'Santa Ceia' | 'Visita' | 'Evangelismo' | 'Outro';
  cultos_realizados: number;
  visitas_realizadas: number;
  almas_alcancadas: number;
  biblias_doadas: number;
  literaturas_entregues: number;
  batismos_espirito_santo: number;
  curas_divinas: number;
  evangelismos_realizados: number;
  reconciliacoes: number;
  membros_cearam?: number;
  visitantes_presentes?: number;
  observacoes: string | null;
  usuario_responsavel: string | null;
  status: 'Rascunho' | 'Enviado' | 'Revisado';
  created_at: string;
  updated_at: string;
}

const TIPO_ATIVIDADE_OPTIONS = [
  { value: 'Culto', label: '⛪ Culto' },
  { value: 'Santa Ceia', label: '🍇 Santa Ceia' },
  { value: 'Visita', label: '🏠 Visita' },
  { value: 'Evangelismo', label: '📢 Evangelismo' },
  { value: 'Outro', label: '📦 Outro' }
];

const STATUS_OPTIONS = [
  { value: 'Rascunho', label: 'Rascunho', color: 'bg-slate-100 text-slate-700' },
  { value: 'Enviado', label: 'Enviado', color: 'bg-blue-100 text-blue-700' },
  { value: 'Revisado', label: 'Revisado', color: 'bg-emerald-100 text-emerald-700' }
];

const TABS = [
  { id: 'cadastro', label: 'Cadastro', icon: '📝' },
  { id: 'registros', label: 'Registros', icon: '🔍' },
  { id: 'consolidado', label: 'Consolidação por Congregação', icon: '🏢' }
];

const EMPTY_FORM = {
  congregacao_id: '',
  data_atividade: new Date().toISOString().split('T')[0],
  tipo_atividade: 'Culto' as 'Culto' | 'Santa Ceia' | 'Visita' | 'Evangelismo' | 'Outro',
  cultos_realizados: 0,
  visitas_realizadas: 0,
  almas_alcancadas: 0,
  biblias_doadas: 0,
  literaturas_entregues: 0,
  batismos_espirito_santo: 0,
  curas_divinas: 0,
  evangelismos_realizados: 0,
  reconciliacoes: 0,
  membros_cearam: 0,
  visitantes_presentes: 0,
  observacoes: '',
  status: 'Rascunho' as 'Rascunho' | 'Enviado' | 'Revisado'
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
};

export default function RelatorioEspiritualPage() {
  const { ctx, bloqueado } = useRequireModulo('gestao');
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState('cadastro');
  const [registros, setRegistros] = useState<RelatorioEspiritualRegistro[]>([]);
  const [locais, setLocais] = useState<LocalOption[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState(EMPTY_FORM);

  // Filtros de listagem
  const [filtroCongregacao, setFiltroCongregacao] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');

  // Estados da Central de Coleta
  const [isCentralColetaOpen, setIsCentralColetaOpen] = useState(false);
  const [tokens, setTokens] = useState<Record<string, { token: string; is_active: boolean; expires_at?: string }>>({});
  const [qrCodeCongId, setQrCodeCongId] = useState<string | null>(null);

  const loadTokens = async () => {
    if (!ctx?.ministryId) return;
    const { data, error } = await supabase
      .from('relatorio_espiritual_tokens')
      .select('congregacao_id, token, is_active, expires_at')
      .eq('ministry_id', ctx.ministryId);

    if (!error && data) {
      const mapa: Record<string, { token: string; is_active: boolean; expires_at?: string }> = {};
      data.forEach((t: any) => {
        if (t.congregacao_id) {
          mapa[t.congregacao_id] = { token: t.token, is_active: t.is_active, expires_at: t.expires_at };
        }
      });
      setTokens(mapa);
    }
  };

  const [modalNotify, setModalNotify] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'success'
  });

  const showNotification = (
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string
  ) => {
    setModalNotify({ isOpen: true, title, message, type });
  };

  const isLocalUser = useMemo(() => {
    return !!(ctx?.nivel && ['admin_local', 'financeiro_local', 'secretaria_local'].includes(ctx.nivel));
  }, [ctx?.nivel]);

  // Carregar Congregações (Locais)
  useEffect(() => {
    if (ctx?.loading || !ctx?.ministryId) return;

    const loadLocais = async () => {
      let query = supabase
        .from('congregacoes')
        .select('id, nome')
        .eq('ministry_id', ctx.ministryId)
        .eq('is_active', true)
        .order('nome', { ascending: true });

      if (isLocalUser && ctx?.congregacaoId) {
        query = query.eq('id', ctx.congregacaoId);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Erro ao carregar congregações:', error);
      } else {
        setLocais((data || []) as LocalOption[]);
        if (isLocalUser && ctx?.congregacaoId) {
          setFormData(prev => ({ ...prev, congregacao_id: ctx.congregacaoId || '' }));
          setFiltroCongregacao(ctx.congregacaoId || '');
        }
      }
    };

    loadLocais();
  }, [ctx?.loading, ctx?.ministryId, ctx?.congregacaoId, isLocalUser, supabase]);

  // Carregar Registros de Relatório Espiritual
  const loadRegistros = async () => {
    if (!ctx?.ministryId) return;
    setLoadingData(true);

    try {
      let query = supabase
        .from('relatorio_espiritual_registros')
        .select('*')
        .eq('ministry_id', ctx.ministryId);

      if (isLocalUser && ctx?.congregacaoId) {
        query = query.eq('congregacao_id', ctx.congregacaoId);
      }

      const { data, error } = await query.order('data_atividade', { ascending: false });

      if (error) {
        showNotification('error', 'Erro', 'Erro ao carregar os relatórios espirituais.');
      } else {
        setRegistros((data || []) as RelatorioEspiritualRegistro[]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleGerarLink = async (congId: string | null, silently?: boolean) => {
    if (!ctx?.ministryId || !congId) return;

    try {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('relatorio_espiritual_tokens')
        .insert({
          ministry_id: ctx.ministryId,
          congregacao_id: congId,
          is_active: true,
          expires_at: expiresAt
        })
        .select('token')
        .single();

      if (error) {
        const { data: existing } = await supabase
          .from('relatorio_espiritual_tokens')
          .select('token')
          .eq('ministry_id', ctx.ministryId)
          .eq('congregacao_id', congId)
          .single();

        if (existing) {
          const link = `${window.location.origin}/formularios/relatorio-espiritual/${existing.token}`;
          if (!silently) {
            navigator.clipboard.writeText(link);
            showNotification('success', 'Link Copiado', 'O link do formulário público foi copiado para a sua área de transferência.');
          }
        }
      } else if (data) {
        const link = `${window.location.origin}/formularios/relatorio-espiritual/${data.token}`;
        if (!silently) {
          navigator.clipboard.writeText(link);
          showNotification('success', 'Link Gerado e Copiado', 'Um novo link exclusivo foi gerado e copiado para a sua área de transferência.');
        }
      }
      await loadTokens();
    } catch (err) {
      console.error(err);
      if (!silently) {
        showNotification('error', 'Erro', 'Erro ao processar o link.');
      }
    }
  };

  const handleRegenerarToken = async (congId: string) => {
    if (!ctx?.ministryId || !congId) return;
    if (!confirm('Deseja realmente regenerar o link desta congregação? O link antigo deixará de funcionar imediatamente.')) return;

    setLoadingData(true);
    try {
      // Deleta o token anterior
      await supabase
        .from('relatorio_espiritual_tokens')
        .delete()
        .eq('ministry_id', ctx.ministryId)
        .eq('congregacao_id', congId);

      // Gera um novo
      await handleGerarLink(congId, true);
      showNotification('success', 'Link Regenerado', 'Um novo link exclusivo foi gerado e copiado para a área de transferência.');
    } catch (err) {
      console.error(err);
      showNotification('error', 'Erro', 'Erro ao regenerar o token.');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!ctx?.loading && ctx?.ministryId) {
      loadRegistros();
      loadTokens();
    }
  }, [ctx?.loading, ctx?.ministryId, ctx?.congregacaoId, isLocalUser]);

  // Filtragem local de registros
  const registrosFiltrados = useMemo(() => {
    return registros.filter(r => {
      if (filtroCongregacao && r.congregacao_id !== filtroCongregacao) return false;
      if (filtroTipo && r.tipo_atividade !== filtroTipo) return false;
      if (filtroStatus && r.status !== filtroStatus) return false;
      if (filtroDataInicio && r.data_atividade < filtroDataInicio) return false;
      if (filtroDataFim && r.data_atividade > filtroDataFim) return false;
      return true;
    });
  }, [registros, filtroCongregacao, filtroTipo, filtroStatus, filtroDataInicio, filtroDataFim]);

  const kpis = useMemo(() => {
    let cultos = 0;
    let visitas = 0;
    let almas = 0;
    let biblias = 0;
    let literaturas = 0;
    let batismos = 0;
    let curas = 0;
    let evangelismos = 0;
    let reconciliacoes = 0;
    let cearam = 0;
    let visitantes = 0;

    registrosFiltrados.forEach(r => {
      cultos += r.cultos_realizados || 0;
      visitas += r.visitas_realizadas || 0;
      almas += r.almas_alcancadas || 0;
      biblias += r.biblias_doadas || 0;
      literaturas += r.literaturas_entregues || 0;
      batismos += r.batismos_espirito_santo || 0;
      curas += r.curas_divinas || 0;
      evangelismos += r.evangelismos_realizados || 0;
      reconciliacoes += r.reconciliacoes || 0;
      cearam += r.membros_cearam || 0;
      visitantes += r.visitantes_presentes || 0;
    });

    return { cultos, visitas, almas, biblias, literaturas, batismos, curas, evangelismos, reconciliacoes, cearam, visitantes };
  }, [registrosFiltrados]);

  const consolidadoPorCongregacao = useMemo(() => {
    const mapa: Record<string, {
      congregacao_id: string | null;
      nome: string;
      cultos: number;
      visitas: number;
      almas: number;
      biblias: number;
      literaturas: number;
      batismos: number;
      curas: number;
      evangelismos: number;
      reconciliacoes: number;
      cearam: number;
      visitantes: number;
      ultimo_envio: string | null;
    }> = {};

    // Inicializa as congregações
    locais.forEach(loc => {
      if (filtroCongregacao && loc.id !== filtroCongregacao) return;
      
      mapa[loc.id] = {
        congregacao_id: loc.id,
        nome: loc.nome,
        cultos: 0,
        visitas: 0,
        almas: 0,
        biblias: 0,
        literaturas: 0,
        batismos: 0,
        curas: 0,
        evangelismos: 0,
        reconciliacoes: 0,
        cearam: 0,
        visitantes: 0,
        ultimo_envio: null
      };
    });

    if (!filtroCongregacao && !isLocalUser) {
      mapa['sede'] = {
        congregacao_id: null,
        nome: 'Sede / Geral',
        cultos: 0,
        visitas: 0,
        almas: 0,
        biblias: 0,
        literaturas: 0,
        batismos: 0,
        curas: 0,
        evangelismos: 0,
        reconciliacoes: 0,
        cearam: 0,
        visitantes: 0,
        ultimo_envio: null
      };
    }

    registrosFiltrados.forEach(r => {
      const key = r.congregacao_id || 'sede';
      if (!mapa[key]) return;

      mapa[key].cultos += r.cultos_realizados || 0;
      mapa[key].visitas += r.visitas_realizadas || 0;
      mapa[key].almas += r.almas_alcancadas || 0;
      mapa[key].biblias += r.biblias_doadas || 0;
      mapa[key].literaturas += r.literaturas_entregues || 0;
      mapa[key].batismos += r.batismos_espirito_santo || 0;
      mapa[key].curas += r.curas_divinas || 0;
      mapa[key].evangelismos += r.evangelismos_realizados || 0;
      mapa[key].reconciliacoes += r.reconciliacoes || 0;
      mapa[key].cearam += r.membros_cearam || 0;
      mapa[key].visitantes += r.visitantes_presentes || 0;

      if (!mapa[key].ultimo_envio || r.data_atividade > mapa[key].ultimo_envio!) {
        mapa[key].ultimo_envio = r.data_atividade;
      }
    });

    return Object.values(mapa).filter(c => {
      return c.cultos > 0 || c.visitas > 0 || c.almas > 0 || c.batismos > 0 || c.curas > 0 || c.evangelismos > 0 || c.reconciliacoes > 0 || c.ultimo_envio !== null || (isLocalUser && c.congregacao_id === ctx?.congregacaoId);
    });
  }, [registrosFiltrados, locais, filtroCongregacao, isLocalUser, ctx?.congregacaoId]);

  const incrementMetric = (key: keyof typeof EMPTY_FORM) => {
    setFormData(prev => ({
      ...prev,
      [key]: Math.max(0, (Number(prev[key]) || 0) + 1)
    }));
  };

  const decrementMetric = (key: keyof typeof EMPTY_FORM) => {
    setFormData(prev => ({
      ...prev,
      [key]: Math.max(0, (Number(prev[key]) || 0) - 1)
    }));
  };

  const resetForm = () => {
    setFormData({
      ...EMPTY_FORM,
      congregacao_id: isLocalUser ? ctx.congregacaoId || '' : ''
    });
    setEditingId(null);
  };

  const handleEdit = (r: RelatorioEspiritualRegistro) => {
    setEditingId(r.id);
    setFormData({
      congregacao_id: r.congregacao_id || '',
      data_atividade: r.data_atividade,
      tipo_atividade: r.tipo_atividade,
      cultos_realizados: r.cultos_realizados,
      visitas_realizadas: r.visitas_realizadas,
      almas_alcancadas: r.almas_alcancadas,
      biblias_doadas: r.biblias_doadas,
      literaturas_entregues: r.literaturas_entregues,
      batismos_espirito_santo: r.batismos_espirito_santo || 0,
      curas_divinas: r.curas_divinas || 0,
      evangelismos_realizados: r.evangelismos_realizados || 0,
      reconciliacoes: r.reconciliacoes || 0,
      membros_cearam: r.membros_cearam || 0,
      visitantes_presentes: r.visitantes_presentes || 0,
      observacoes: r.observacoes || '',
      status: r.status
    });
    setActiveTab('cadastro');
  };

  const handleExcluir = async (id: string) => {
    if (!confirm('Deseja realmente excluir este relatório espiritual?')) return;

    try {
      let query = supabase
        .from('relatorio_espiritual_registros')
        .delete()
        .eq('id', id);

      if (isLocalUser && ctx.congregacaoId) {
        query = query.eq('congregacao_id', ctx.congregacaoId);
      }

      const { error } = await query;

      if (error) {
        showNotification('error', 'Erro', 'Não foi possível excluir o registro.');
      } else {
        showNotification('success', 'Sucesso', 'Registro excluído com sucesso.');
        loadRegistros();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!ctx.ministryId) {
      showNotification('error', 'Erro', 'Organização ou Ministério não identificado.');
      return;
    }

    // Se for usuário de congregação local, força o ID da congregação dele
    const finalCongregacaoId = isLocalUser ? (ctx.congregacaoId || null) : (formData.congregacao_id || null);

    if (isLocalUser && !ctx.congregacaoId) {
      showNotification('error', 'Erro', 'Você não possui uma congregação local associada ao seu usuário.');
      return;
    }

    // Validações obrigatórias
    if (!formData.data_atividade) {
      showNotification('error', 'Erro', 'A data da atividade é obrigatória.');
      return;
    }
    if (!formData.tipo_atividade) {
      showNotification('error', 'Erro', 'O tipo da atividade é obrigatório.');
      return;
    }

    const cultos = Number(formData.cultos_realizados) || 0;
    const visitas = Number(formData.visitas_realizadas) || 0;
    const almas = Number(formData.almas_alcancadas) || 0;
    const biblias = Number(formData.biblias_doadas) || 0;
    const literaturas = Number(formData.literaturas_entregues) || 0;
    const batismos = Number(formData.batismos_espirito_santo) || 0;
    const curas = Number(formData.curas_divinas) || 0;
    const evangelismos = Number(formData.evangelismos_realizados) || 0;
    const reconciliacoes = Number(formData.reconciliacoes) || 0;
    const cearam = formData.tipo_atividade === 'Santa Ceia' ? (Number(formData.membros_cearam) || 0) : 0;
    const visitantes = formData.tipo_atividade === 'Culto' ? (Number(formData.visitantes_presentes) || 0) : 0;

    if (cultos < 0 || visitas < 0 || almas < 0 || biblias < 0 || literaturas < 0 || batismos < 0 || curas < 0 || evangelismos < 0 || reconciliacoes < 0 || cearam < 0 || visitantes < 0) {
      showNotification('error', 'Erro', 'Os valores numéricos não podem ser negativos.');
      return;
    }

    if (formData.tipo_atividade === 'Santa Ceia' && cearam <= 0) {
      showNotification('error', 'Erro', 'Para a atividade de Santa Ceia, a quantidade de membros que cearam deve ser maior que zero.');
      return;
    }

    if (formData.tipo_atividade === 'Culto' && visitantes < 0) {
      showNotification('error', 'Erro', 'A quantidade de visitantes presentes deve ser informada (mínimo 0).');
      return;
    }

    const totalValores = cultos + visitas + almas + biblias + literaturas + batismos + curas + evangelismos + reconciliacoes + cearam + visitantes;
    if (totalValores <= 0) {
      showNotification('error', 'Erro', 'O relatório não pode ser enviado totalmente zerado.');
      return;
    }

    if (formData.observacoes.length > 500) {
      showNotification('error', 'Erro', 'As observações não podem exceder o limite de 500 caracteres.');
      return;
    }

    const payload: any = {
      ministry_id: ctx.ministryId,
      congregacao_id: finalCongregacaoId,
      data_atividade: formData.data_atividade,
      tipo_atividade: formData.tipo_atividade,
      cultos_realizados: cultos,
      visitas_realizadas: visitas,
      almas_alcancadas: almas,
      biblias_doadas: biblias,
      literaturas_entregues: literaturas,
      batismos_espirito_santo: batismos,
      curas_divinas: curas,
      evangelismos_realizados: evangelismos,
      reconciliacoes: reconciliacoes,
      membros_cearam: cearam,
      visitantes_presentes: visitantes,
      observacoes: formData.observacoes.trim() || null,
      status: formData.status,
      updated_at: new Date().toISOString()
    };

    try {
      if (editingId) {
        let query = supabase
          .from('relatorio_espiritual_registros')
          .update(payload)
          .eq('id', editingId);

        if (isLocalUser && ctx.congregacaoId) {
          query = query.eq('congregacao_id', ctx.congregacaoId);
        }

        const { error } = await query;

        if (error) {
          showNotification('error', 'Erro', error.message || 'Erro ao atualizar relatório.');
        } else {
          showNotification('success', 'Sucesso', 'Relatório atualizado com sucesso.');
          resetForm();
          loadRegistros();
          setActiveTab('registros');
        }
      } else {
        payload.usuario_responsavel = (await supabase.auth.getUser()).data.user?.id || null;
        const { error } = await supabase
          .from('relatorio_espiritual_registros')
          .insert({ ...payload, created_at: new Date().toISOString() });

        if (error) {
          showNotification('error', 'Erro', error.message || 'Erro ao salvar relatório.');
        } else {
          showNotification('success', 'Sucesso', 'Relatório cadastrado com sucesso.');
          resetForm();
          loadRegistros();
          setActiveTab('registros');
        }
      }
    } catch (err) {
      console.error(err);
      showNotification('error', 'Erro', 'Erro operacional ao salvar.');
    }
  };

  if (ctx.loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#123b63]" />
      </div>
    );
  }

  if (bloqueado) return null;

  return (
    <PageLayout title="Relatório Espiritual" description="Gestão de Relatórios Espirituais">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Cabeçalho */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">🕊️</span>
              <h1 className="text-3xl font-bold text-slate-800">Relatório Espiritual</h1>
            </div>
            <p className="text-slate-600">Fundação do Relatório de Atividades Espirituais do Ministério</p>
          </div>
          {!isLocalUser && (
            <button
              onClick={() => setIsCentralColetaOpen(true)}
              className="px-5 py-2.5 bg-[#062E6F] hover:bg-[#154A92] text-white rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer self-start sm:self-auto"
            >
              <Globe className="h-4 w-4" />
              Coleta das Congregações
            </button>
          )}
        </div>

        {/* Resumo de Indicadores KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 mb-8">
          <ExecutiveMetricCard title="Cultos" value={kpis.cultos} color="blue" icon={Church} />
          <ExecutiveMetricCard title="Visitas" value={kpis.visitas} color="indigo" icon={Home} />
          <ExecutiveMetricCard title="Almas" value={kpis.almas} color="rose" icon={Flame} />
          <ExecutiveMetricCard title="Bíblias" value={kpis.biblias} color="amber" icon={BookOpen} />
          <ExecutiveMetricCard title="Literaturas" value={kpis.literaturas} color="slate" icon={FileText} />
          <ExecutiveMetricCard title="Batismos ES" value={kpis.batismos} color="rose" icon={Sparkles} subtitle="Batismos no Espírito Santo" />
          <ExecutiveMetricCard title="Curas" value={kpis.curas} color="rose" icon={Heart} subtitle="Curas divinas testemunhadas" />
          <ExecutiveMetricCard title="Evangelismos" value={kpis.evangelismos} color="blue" icon={Megaphone} subtitle="Atividades de evangelismo" />
          <ExecutiveMetricCard title="Reconciliações" value={kpis.reconciliacoes} color="emerald" icon={Users} subtitle="Retornos à fé" />
          <ExecutiveMetricCard title="Santa Ceia" value={kpis.cearam} color="emerald" icon={GlassWater} subtitle="Membros que cearam" />
          <ExecutiveMetricCard title="Visitantes" value={kpis.visitantes} color="blue" icon={UserPlus} subtitle="Visitantes presentes" />
        </div>

        <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
          {activeTab === 'cadastro' && (
            <Section icon="📝" title={editingId ? 'Editar Relatório Espiritual' : 'Novo Relatório Espiritual'}>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Congregação */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Congregação / Sede *</label>
                    <select
                      value={formData.congregacao_id}
                      onChange={e => setFormData(prev => ({ ...prev, congregacao_id: e.target.value }))}
                      disabled={isLocalUser}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 shadow-sm focus:border-slate-500 focus:outline-none disabled:bg-slate-50"
                      required
                    >
                      <option value="">-- Selecione a Unidade (ou Sede) --</option>
                      {locais.map(loc => (
                        <option key={loc.id} value={loc.id}>
                          {loc.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Data */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Data da Atividade *</label>
                    <input
                      type="date"
                      value={formData.data_atividade}
                      onChange={e => setFormData(prev => ({ ...prev, data_atividade: e.target.value }))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 shadow-sm focus:border-slate-500 focus:outline-none"
                      required
                    />
                  </div>

                  {/* Tipo */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Tipo da Atividade *</label>
                    <select
                      value={formData.tipo_atividade}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        tipo_atividade: e.target.value as any
                      }))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 shadow-sm focus:border-slate-500 focus:outline-none"
                      required
                    >
                      {TIPO_ATIVIDADE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Métricas Principais */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <h3 className="text-base font-bold text-slate-800 mb-4">📈 Indicadores e Atividades Espirituais</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Cultos Realizados */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Cultos Realizados</span>
                        <span className="text-xl font-bold text-slate-800">{formData.cultos_realizados}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => decrementMetric('cultos_realizados')} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"><Minus className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => incrementMetric('cultos_realizados')} className="p-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>

                    {/* Visitas Realizadas */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Visitas Realizadas</span>
                        <span className="text-xl font-bold text-slate-800">{formData.visitas_realizadas}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => decrementMetric('visitas_realizadas')} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"><Minus className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => incrementMetric('visitas_realizadas')} className="p-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>

                    {/* Almas Alcançadas */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Almas Alcançadas</span>
                        <span className="text-xl font-bold text-slate-800">{formData.almas_alcancadas}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => decrementMetric('almas_alcancadas')} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"><Minus className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => incrementMetric('almas_alcancadas')} className="p-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>

                    {/* Bíblias Doadas */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Bíblias Doadas</span>
                        <span className="text-xl font-bold text-slate-800">{formData.biblias_doadas}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => decrementMetric('biblias_doadas')} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"><Minus className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => incrementMetric('biblias_doadas')} className="p-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>

                    {/* Literaturas Entregues */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Literaturas Entregues</span>
                        <span className="text-xl font-bold text-slate-800">{formData.literaturas_entregues}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => decrementMetric('literaturas_entregues')} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"><Minus className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => incrementMetric('literaturas_entregues')} className="p-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>

                    {/* Batismos Espírito Santo */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Batismos Espírito Santo</span>
                        <span className="text-xl font-bold text-slate-800">{formData.batismos_espirito_santo}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => decrementMetric('batismos_espirito_santo')} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"><Minus className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => incrementMetric('batismos_espirito_santo')} className="p-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>

                    {/* Curas Divinas */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Curas Divinas</span>
                        <span className="text-xl font-bold text-slate-800">{formData.curas_divinas}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => decrementMetric('curas_divinas')} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"><Minus className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => incrementMetric('curas_divinas')} className="p-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>

                    {/* Evangelismos Realizados */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Evangelismos Realizados</span>
                        <span className="text-xl font-bold text-slate-800">{formData.evangelismos_realizados}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => decrementMetric('evangelismos_realizados')} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"><Minus className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => incrementMetric('evangelismos_realizados')} className="p-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>

                    {/* Reconciliações */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Reconciliações</span>
                        <span className="text-xl font-bold text-slate-800">{formData.reconciliacoes}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => decrementMetric('reconciliacoes')} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"><Minus className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => incrementMetric('reconciliacoes')} className="p-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Campos Condicionais */}
                {(formData.tipo_atividade === 'Santa Ceia' || formData.tipo_atividade === 'Culto') && (
                  <div className="bg-amber-500/5 p-6 rounded-2xl border border-amber-500/10">
                    <h3 className="text-base font-bold text-amber-800 mb-4">🌟 Requisitos do Tipo de Atividade</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {formData.tipo_atividade === 'Santa Ceia' && (
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Membros que cearam</label>
                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              value={formData.membros_cearam}
                              onChange={e => setFormData(prev => ({ ...prev, membros_cearam: Math.max(0, parseInt(e.target.value) || 0) }))}
                              className="w-40 rounded-xl border border-slate-300 bg-white px-4 py-2 shadow-sm focus:border-slate-500 focus:outline-none"
                            />
                            <div className="flex items-center gap-1.5">
                              <button type="button" onClick={() => decrementMetric('membros_cearam')} className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"><Minus className="h-3.5 w-3.5" /></button>
                              <button type="button" onClick={() => incrementMetric('membros_cearam')} className="p-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"><Plus className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                        </div>
                      )}

                      {formData.tipo_atividade === 'Culto' && (
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Visitantes presentes</label>
                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              value={formData.visitantes_presentes}
                              onChange={e => setFormData(prev => ({ ...prev, visitantes_presentes: Math.max(0, parseInt(e.target.value) || 0) }))}
                              className="w-40 rounded-xl border border-slate-300 bg-white px-4 py-2 shadow-sm focus:border-slate-500 focus:outline-none"
                            />
                            <div className="flex items-center gap-1.5">
                              <button type="button" onClick={() => decrementMetric('visitantes_presentes')} className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"><Minus className="h-3.5 w-3.5" /></button>
                              <button type="button" onClick={() => incrementMetric('visitantes_presentes')} className="p-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"><Plus className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Observações e Status */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Observações / Detalhes</label>
                    <textarea
                      value={formData.observacoes}
                      onChange={e => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                      rows={3}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 shadow-sm focus:border-slate-500 focus:outline-none"
                      placeholder="Espaço reservado para observações espirituais..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Status do Registro *</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 shadow-sm focus:border-slate-500 focus:outline-none"
                      required
                    >
                      <option value="Rascunho">Rascunho</option>
                      <option value="Enviado">Enviado</option>
                      <option value="Revisado">Revisado</option>
                    </select>
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                  {editingId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-sm transition"
                  >
                    {editingId ? 'Salvar Alterações' : 'Salvar Registro'}
                  </button>
                </div>
              </form>
            </Section>
          )}

          {activeTab === 'registros' && (
            <Section icon="🔍" title="Relatórios Espirituais Enviados">
              {/* Filtros */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 mb-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                {/* Congregação */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Congregação</label>
                  <select
                    value={filtroCongregacao}
                    onChange={e => setFiltroCongregacao(e.target.value)}
                    disabled={isLocalUser}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none disabled:bg-slate-50"
                  >
                    <option value="">-- Todos --</option>
                    {locais.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.nome}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tipo */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Tipo da Atividade</label>
                  <select
                    value={filtroTipo}
                    onChange={e => setFiltroTipo(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none"
                  >
                    <option value="">-- Todos --</option>
                    {TIPO_ATIVIDADE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Status</label>
                  <select
                    value={filtroStatus}
                    onChange={e => setFiltroStatus(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none"
                  >
                    <option value="">-- Todos --</option>
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Período */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">A partir de</label>
                  <input
                    type="date"
                    value={filtroDataInicio}
                    onChange={e => setFiltroDataInicio(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Até</label>
                  <input
                    type="date"
                    value={filtroDataFim}
                    onChange={e => setFiltroDataFim(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none"
                  />
                </div>
              </div>

              {/* Tabela/Cards */}
              {loadingData ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : registrosFiltrados.length === 0 ? (
                <div className="py-16 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm font-semibold">Nenhum relatório espiritual encontrado</p>
                  <p className="text-slate-400 text-xs mt-1">Experimente mudar os filtros ou cadastrar um novo registro.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {registrosFiltrados.map(reg => {
                    const localName = locais.find(l => l.id === reg.congregacao_id)?.nome || 'Sede / Geral';
                    const statusOpt = STATUS_OPTIONS.find(s => s.value === reg.status);
                    
                    return (
                      <div
                        key={reg.id}
                        className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm/5 hover:shadow-md transition flex flex-col md:flex-row justify-between md:items-center gap-4"
                      >
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                              {reg.tipo_atividade}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusOpt?.color || 'bg-slate-100'}`}>
                              {reg.status}
                            </span>
                            <span className="text-xs text-slate-500 font-semibold">
                              {formatDate(reg.data_atividade)}
                            </span>
                          </div>

                          <h4 className="text-sm font-bold text-slate-800">
                            🏢 Unidade: <span className="text-slate-600 font-semibold">{localName}</span>
                          </h4>

                          {/* Resumo de Métricas */}
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-15 text-xs text-slate-600">
                            <span>⛪ Cultos: <strong>{reg.cultos_realizados}</strong></span>
                            <span>🏠 Visitas: <strong>{reg.visitas_realizadas}</strong></span>
                            <span>🔥 Almas: <strong>{reg.almas_alcancadas}</strong></span>
                            <span>📖 Bíblias: <strong>{reg.biblias_doadas}</strong></span>
                            <span>📢 Literaturas: <strong>{reg.literaturas_entregues}</strong></span>
                            <span>🕊️ Batismos ES: <strong>{reg.batismos_espirito_santo}</strong></span>
                            <span>❤️ Curas: <strong>{reg.curas_divinas}</strong></span>
                            <span>📢 Evangelismos: <strong>{reg.evangelismos_realizados}</strong></span>
                            <span>🤝 Reconciliações: <strong>{reg.reconciliacoes}</strong></span>
                            {reg.tipo_atividade === 'Santa Ceia' && (
                              <span className="col-span-2 text-amber-700 font-semibold">🍇 Cearam: {reg.membros_cearam || 0}</span>
                            )}
                            {reg.tipo_atividade === 'Culto' && (
                              <span className="col-span-2 text-blue-700 font-semibold">👥 Visitantes: {reg.visitantes_presentes || 0}</span>
                            )}
                          </div>

                          {reg.observacoes && (
                            <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg italic">
                              "{reg.observacoes}"
                            </p>
                          )}
                        </div>

                        {/* Ações */}
                        <div className="flex items-center gap-2 self-end md:self-center">
                          <button
                            onClick={() => handleEdit(reg)}
                            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleExcluir(reg.id)}
                            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-rose-600 transition"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          )}

          {activeTab === 'consolidado' && (
            <Section icon="🏢" title="Consolidação de Atividades por Unidade / Congregação">
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <th className="p-4">Congregação / Unidade</th>
                      <th className="p-4 text-center">⛪ Cultos</th>
                      <th className="p-4 text-center">🏠 Visitas</th>
                      <th className="p-4 text-center">🔥 Almas</th>
                      <th className="p-4 text-center">📖 Bíblias</th>
                      <th className="p-4 text-center">📢 Literaturas</th>
                      <th className="p-4 text-center">🕊️ Batismos ES</th>
                      <th className="p-4 text-center">❤️ Curas</th>
                      <th className="p-4 text-center">📢 Evangelismos</th>
                      <th className="p-4 text-center">🤝 Reconciliações</th>
                      <th className="p-4 text-center">🍇 Ceias</th>
                      <th className="p-4 text-center">👥 Visitantes</th>
                      <th className="p-4 text-right">📅 Último Envio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consolidadoPorCongregacao.map(item => (
                      <tr key={item.congregacao_id || 'sede'} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                        <td className="p-4 font-bold text-slate-800">
                          <div className="flex items-center justify-between">
                            <span>{item.nome}</span>
                            {!isLocalUser && item.congregacao_id && (
                              <button
                                onClick={() => handleGerarLink(item.congregacao_id)}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg transition text-xs font-semibold flex items-center gap-1 border border-slate-200 cursor-pointer"
                                title="Copiar Link de Formulário Público"
                              >
                                <LinkIcon className="h-3 w-3" />
                                Link de Envio
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-center text-slate-700 font-semibold">{item.cultos}</td>
                        <td className="p-4 text-center text-slate-700 font-semibold">{item.visitas}</td>
                        <td className="p-4 text-center text-rose-700 font-bold">{item.almas}</td>
                        <td className="p-4 text-center text-slate-700 font-semibold">{item.biblias}</td>
                        <td className="p-4 text-center text-slate-700 font-semibold">{item.literaturas}</td>
                        <td className="p-4 text-center text-slate-700 font-semibold">{item.batismos}</td>
                        <td className="p-4 text-center text-slate-700 font-semibold">{item.curas}</td>
                        <td className="p-4 text-center text-slate-700 font-semibold">{item.evangelismos}</td>
                        <td className="p-4 text-center text-slate-700 font-semibold">{item.reconciliacoes}</td>
                        <td className="p-4 text-center text-amber-700 font-bold">{item.cearam}</td>
                        <td className="p-4 text-center text-blue-700 font-bold">{item.visitantes}</td>
                        <td className="p-4 text-right text-slate-500 font-medium">
                          {item.ultimo_envio ? (
                            <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full text-xs">
                              {formatDate(item.ultimo_envio)}
                            </span>
                          ) : (
                            <span className="text-slate-350 italic">Sem registros</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {consolidadoPorCongregacao.length === 0 && (
                      <tr>
                        <td colSpan={13} className="p-8 text-center text-slate-400 italic">
                          Nenhum dado de consolidação disponível para os filtros selecionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </Tabs>
      </div>

      <NotificationModal
        isOpen={modalNotify.isOpen}
        title={modalNotify.title}
        message={modalNotify.message}
        type={modalNotify.type}
        onClose={() => setModalNotify(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Central de Coleta Modal */}
      {isCentralColetaOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden border border-slate-100">
            {/* Header */}
            <div className="p-6 bg-white border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Globe className="h-5 w-5 text-[#062E6F]" />
                  Central de Coleta de Relatórios
                </h3>
                <p className="text-xs text-slate-500 mt-1">Gerencie os tokens, links e QR codes de envio para as congregações.</p>
              </div>
              <button
                onClick={() => {
                  setIsCentralColetaOpen(false);
                  setQrCodeCongId(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              <div className="overflow-hidden border border-slate-100 rounded-xl">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <th className="p-3">Congregação / Unidade</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-right">Ações de Coleta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {locais.map(loc => {
                      const tokenInfo = tokens[loc.id];
                      const hasToken = !!tokenInfo;
                      const isExpired = hasToken && tokenInfo.expires_at && new Date(tokenInfo.expires_at) <= new Date();
                      const isInactive = hasToken && !tokenInfo.is_active;
                      const isActive = hasToken && tokenInfo.is_active && (!tokenInfo.expires_at || new Date(tokenInfo.expires_at) > new Date());
                      const link = hasToken ? `${window.location.origin}/formularios/relatorio-espiritual/${tokenInfo.token}` : '';

                      return (
                        <tr key={loc.id} className="hover:bg-slate-50/50 transition">
                          <td className="p-3 font-semibold text-slate-800">{loc.nome}</td>
                          <td className="p-3 text-center">
                            {isActive && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Ativo
                              </span>
                            )}
                            {isExpired && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                                Expirado
                              </span>
                            )}
                            {isInactive && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
                                Inativo
                              </span>
                            )}
                            {!hasToken && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                                Sem Link
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {!hasToken ? (
                                <button
                                  onClick={() => handleGerarLink(loc.id, false)}
                                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                >
                                  <Plus className="h-3 w-3" /> Gerar Link
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(link);
                                      showNotification('success', 'Copiado', 'Link copiado para a área de transferência!');
                                    }}
                                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                                    title="Copiar Link"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setQrCodeCongId(qrCodeCongId === loc.id ? null : loc.id)}
                                    className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                      qrCodeCongId === loc.id
                                        ? 'bg-blue-50 border-blue-200 text-blue-600'
                                        : 'border-slate-200 hover:bg-slate-100 text-slate-600'
                                    }`}
                                    title="Exibir QR Code"
                                  >
                                    <QrCode className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleRegenerarToken(loc.id)}
                                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-650 hover:text-amber-600 transition cursor-pointer"
                                    title="Regenerar Token / Link"
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* QR Code Container Inline */}
              {qrCodeCongId && locais.find(l => l.id === qrCodeCongId) && (() => {
                const selectedLoc = locais.find(l => l.id === qrCodeCongId)!;
                const tokenInfo = tokens[qrCodeCongId];
                const link = tokenInfo ? `${window.location.origin}/formularios/relatorio-espiritual/${tokenInfo.token}` : '';

                return (
                  <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-5 animate-fade-in">
                    <div className="flex-1 text-center sm:text-left">
                      <span className="text-xs font-black text-blue-800 uppercase tracking-widest block mb-1">QR Code de Envio</span>
                      <h4 className="text-sm font-bold text-slate-800">{selectedLoc.nome}</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-md">Posicione a câmera do celular no QR Code para acessar o formulário público desta congregação sem precisar de senha.</p>
                      <input
                        type="text"
                        readOnly
                        value={link}
                        className="w-full text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs mt-3 select-all focus:outline-none"
                      />
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center justify-center">
                      {link ? (
                        <QRCodeSVG value={link} size={130} includeMargin={true} />
                      ) : (
                        <span className="text-xs text-slate-400 italic">Sem link gerado</span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                onClick={async () => {
                  const linksCopyList: string[] = [];
                  locais.forEach(loc => {
                    const tInfo = tokens[loc.id];
                    if (tInfo) {
                      linksCopyList.push(`${loc.nome}: ${window.location.origin}/formularios/relatorio-espiritual/${tInfo.token}`);
                    }
                  });
                  if (linksCopyList.length === 0) {
                    showNotification('warning', 'Aviso', 'Nenhuma congregação possui links ativos para copiar.');
                    return;
                  }
                  navigator.clipboard.writeText(linksCopyList.join('\n'));
                  showNotification('success', 'Links Copiados', `${linksCopyList.length} links copiados de uma vez.`);
                }}
                className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 border border-slate-250 cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar Todos os Links
              </button>
              <button
                onClick={() => {
                  setIsCentralColetaOpen(false);
                  setQrCodeCongId(null);
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
