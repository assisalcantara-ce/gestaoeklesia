'use client';

import { useEffect, useMemo, useState } from 'react';
import NotificationModal from '@/components/NotificationModal';
import DashboardContainer from '@/components/dashboard/DashboardContainer';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import DashboardContent from '@/components/dashboard/DashboardContent';
import DashboardSection from '@/components/dashboard/DashboardSection';
import ExecutiveMetricCard from '@/components/dashboard/ExecutiveMetricCard';
import DashboardEmptyState from '@/components/dashboard/DashboardEmptyState';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import { QRCodeSVG } from 'qrcode.react';
import {
  Pencil,
  Trash2,
  Plus,
  Minus,
  FileText,
  Flame,
  UserPlus,
  Sparkles,
  Users,
  QrCode,
  X,
  Globe,
  Calendar,
  Lightbulb,
  Clock
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer
} from 'recharts';

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
  culto_id?: string | null;
  created_at: string;
  updated_at: string;
}

// TIPO_ATIVIDADE_OPTIONS e STATUS_OPTIONS removidos para evitar warnings de não uso.

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'cadastro', label: 'Lançamentos', icon: '📝' },
  { id: 'registros', label: 'Registros', icon: '🔍' },
  { id: 'consolidado', label: 'Consolidação por Congregação', icon: '🏢' }
];

const EMPTY_FORM = {
  congregacao_id: '',
  data_atividade: new Date().toISOString().split('T')[0],
  tipo_atividade: 'Visita' as 'Culto' | 'Santa Ceia' | 'Visita' | 'Evangelismo' | 'Outro',
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

const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function RelatorioEspiritualPage() {
  const { ctx, bloqueado } = useRequireModulo('gestao');
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [registros, setRegistros] = useState<RelatorioEspiritualRegistro[]>([]);
  const [locais, setLocais] = useState<LocalOption[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const labelDivPrincipal = 'Congregação';

  const [formData, setFormData] = useState(EMPTY_FORM);

  // Filtros de listagem
  const [filtroCongregacao, setFiltroCongregacao] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');

  // Filtros da competência do Dashboard Executivo
  const [dashMes, setDashMes] = useState<number>(new Date().getMonth() + 1);
  const [dashAno, setDashAno] = useState<number>(new Date().getFullYear());

  // Métrica selecionada no Gráfico de Evolução
  const [evolucaoMetrica, setEvolucaoMetrica] = useState<'almas' | 'visitantes' | 'reconciliacoes' | 'batismos'>('almas');

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
        .order('nome');

      if (isLocalUser && ctx.congregacaoId) {
        query = query.eq('id', ctx.congregacaoId);
      }

      const { data, error } = await query;
      if (!error && data) {
        setLocais(data as LocalOption[]);
        if (isLocalUser && ctx.congregacaoId) {
          setFormData(prev => ({ ...prev, congregacao_id: ctx.congregacaoId || '' }));
          setFiltroCongregacao(ctx.congregacaoId || '');
        }
      }
    };

    loadLocais();
    loadTokens();
  }, [ctx?.loading, ctx?.ministryId, isLocalUser, ctx?.congregacaoId]);

  // Carregar todos os Relatórios do Tenant
  const loadRegistros = async () => {
    if (!ctx?.ministryId) return;
    try {
      let query = supabase
        .from('relatorio_espiritual_registros')
        .select('*')
        .eq('ministry_id', ctx.ministryId);

      if (isLocalUser && ctx.congregacaoId) {
        query = query.eq('congregacao_id', ctx.congregacaoId);
      }

      const { data, error } = await query.order('data_atividade', { ascending: false });
      if (!error && data) {
        setRegistros(data as RelatorioEspiritualRegistro[]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!ctx?.loading && ctx?.ministryId) {
      loadRegistros();
    }
  }, [ctx?.loading, ctx?.ministryId, isLocalUser, ctx?.congregacaoId]);

  // Filtros aplicados sobre a listagem da aba "Registros"
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

  // --- MÓDULO DASHBOARD: Lógica e Cálculos de Competência ---

  // Filtro de congregação aplicado ao Dashboard
  const dashCongregacaoId = useMemo(() => {
    return isLocalUser ? (ctx.congregacaoId || '') : filtroCongregacao;
  }, [isLocalUser, ctx.congregacaoId, filtroCongregacao]);

  // Registros pertencentes ao mês filtrado
  const registrosMesAtual = useMemo(() => {
    return registros.filter(r => {
      if (dashCongregacaoId && r.congregacao_id !== dashCongregacaoId) return false;
      const d = new Date(r.data_atividade);
      const m = d.getUTCMonth() + 1;
      const y = d.getUTCFullYear();
      return m === dashMes && y === dashAno;
    });
  }, [registros, dashCongregacaoId, dashMes, dashAno]);

  // Registros pertencentes ao mês anterior
  const registrosMesAnterior = useMemo(() => {
    const prevMes = dashMes === 1 ? 12 : dashMes - 1;
    const prevAno = dashMes === 1 ? dashAno - 1 : dashAno;
    return registros.filter(r => {
      if (dashCongregacaoId && r.congregacao_id !== dashCongregacaoId) return false;
      const d = new Date(r.data_atividade);
      const m = d.getUTCMonth() + 1;
      const y = d.getUTCFullYear();
      return m === prevMes && y === prevAno;
    });
  }, [registros, dashCongregacaoId, dashMes, dashAno]);

  // Somatórias do Mês Atual
  const somaAtual = useMemo(() => {
    let almas = 0, visitantes = 0, reconciliacoes = 0, batismos = 0;
    let cultos = 0, ceias = 0, visitas = 0, evangelismos = 0;

    registrosMesAtual.forEach(r => {
      almas += r.almas_alcancadas || 0;
      visitantes += r.visitantes_presentes || 0;
      reconciliacoes += r.reconciliacoes || 0;
      batismos += r.batismos_espirito_santo || 0;
      cultos += r.cultos_realizados || 0;
      if (r.tipo_atividade === 'Santa Ceia') ceias += 1;
      visitas += r.visitas_realizadas || 0;
      evangelismos += r.evangelismos_realizados || 0;
    });

    return { almas, visitantes, reconciliacoes, batismos, cultos, ceias, visitas, evangelismos };
  }, [registrosMesAtual]);

  // Somatórias do Mês Anterior
  const somaAnterior = useMemo(() => {
    let almas = 0, visitantes = 0, reconciliacoes = 0, batismos = 0;
    let cultos = 0, ceias = 0, visitas = 0, evangelismos = 0;

    registrosMesAnterior.forEach(r => {
      almas += r.almas_alcancadas || 0;
      visitantes += r.visitantes_presentes || 0;
      reconciliacoes += r.reconciliacoes || 0;
      batismos += r.batismos_espirito_santo || 0;
      cultos += r.cultos_realizados || 0;
      if (r.tipo_atividade === 'Santa Ceia') ceias += 1;
      visitas += r.visitas_realizadas || 0;
      evangelismos += r.evangelismos_realizados || 0;
    });

    return { almas, visitantes, reconciliacoes, batismos, cultos, ceias, visitas, evangelismos };
  }, [registrosMesAnterior]);

  // Variações Percentuais
  const variacoes = useMemo(() => {
    const calcVar = (atual: number, anterior: number) => {
      if (anterior === 0) return atual > 0 ? 100 : 0;
      return ((atual - anterior) / anterior) * 100;
    };
    return {
      almas: calcVar(somaAtual.almas, somaAnterior.almas),
      visitantes: calcVar(somaAtual.visitantes, somaAnterior.visitantes),
      reconciliacoes: calcVar(somaAtual.reconciliacoes, somaAnterior.reconciliacoes),
      batismos: calcVar(somaAtual.batismos, somaAnterior.batismos)
    };
  }, [somaAtual, somaAnterior]);

  const getTrend = (value: number) => {
    if (value > 0) return { direction: 'up' as const, label: `↑ +${value.toFixed(1)}% comparado ao mês anterior` };
    if (value < 0) return { direction: 'down' as const, label: `↓ ${value.toFixed(1)}% comparado ao mês anterior` };
    return { direction: 'stable' as const, label: `Stable comparado ao mês anterior` };
  };

  // 12 Meses de Histórico para Gráfico de Evolução
  const evolucaoDados = useMemo(() => {
    const dados = [];
    const baseDate = new Date(dashAno, dashMes - 1, 15);

    for (let i = 11; i >= 0; i--) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 15);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();

      // Somar métricas desse mês/ano
      let almas = 0, visitantes = 0, reconciliacoes = 0, batismos = 0;
      registros.forEach(r => {
        if (dashCongregacaoId && r.congregacao_id !== dashCongregacaoId) return;
        const actDate = new Date(r.data_atividade);
        if (actDate.getUTCMonth() + 1 === m && actDate.getUTCFullYear() === y) {
          almas += r.almas_alcancadas || 0;
          visitantes += r.visitantes_presentes || 0;
          reconciliacoes += r.reconciliacoes || 0;
          batismos += r.batismos_espirito_santo || 0;
        }
      });

      dados.push({
        mesAno: `${m.toString().padStart(2, '0')}/${y.toString().substring(2)}`,
        Almas: almas,
        Visitantes: visitantes,
        Reconciliacoes: reconciliacoes,
        Batismos: batismos
      });
    }
    return dados;
  }, [registros, dashCongregacaoId, dashMes, dashAno]);

  // Distribuição de Atividades no Mês Filtrado
  const distribuicaoAtividades = useMemo(() => {
    return [
      { name: 'Cultos', Quantidade: somaAtual.cultos },
      { name: 'Santa Ceias', Quantidade: somaAtual.ceias },
      { name: 'Visitas', Quantidade: somaAtual.visitas },
      { name: 'Evangelismos', Quantidade: somaAtual.evangelismos }
    ];
  }, [somaAtual]);

  // Ranking das Congregações
  const rankingCongregacoes = useMemo(() => {
    const pontuacaoCong: Record<string, {
      id: string;
      nome: string;
      almas: number;
      reconciliacoes: number;
      visitantes: number;
      batismos: number;
      totalCombinado: number;
      almasAnterior: number;
    }> = {};

    // Iniciar congregações
    locais.forEach(l => {
      pontuacaoCong[l.id] = {
        id: l.id,
        nome: l.nome,
        almas: 0,
        reconciliacoes: 0,
        visitantes: 0,
        batismos: 0,
        totalCombinado: 0,
        almasAnterior: 0
      };
    });

    // Mês Atual
    registrosMesAtual.forEach(r => {
      if (r.congregacao_id && pontuacaoCong[r.congregacao_id]) {
        const item = pontuacaoCong[r.congregacao_id];
        item.almas += r.almas_alcancadas || 0;
        item.reconciliacoes += r.reconciliacoes || 0;
        item.visitantes += r.visitantes_presentes || 0;
        item.batismos += r.batismos_espirito_santo || 0;
      }
    });

    // Mês Anterior
    registrosMesAnterior.forEach(r => {
      if (r.congregacao_id && pontuacaoCong[r.congregacao_id]) {
        pontuacaoCong[r.congregacao_id].almasAnterior += r.almas_alcancadas || 0;
      }
    });

    // Calcular variação percentual de almas por congregação
    return Object.values(pontuacaoCong)
      .map(c => {
        let variacaoAlmas = 0;
        if (c.almasAnterior === 0) {
          variacaoAlmas = c.almas > 0 ? 100 : 0;
        } else {
          variacaoAlmas = ((c.almas - c.almasAnterior) / c.almasAnterior) * 100;
        }
        return {
          ...c,
          variacaoAlmas,
          totalCombinado: c.almas + c.reconciliacoes + c.visitantes + c.batismos
        };
      })
      .sort((a, b) => {
        if (b.almas !== a.almas) return b.almas - a.almas;
        if (b.reconciliacoes !== a.reconciliacoes) return b.reconciliacoes - a.reconciliacoes;
        if (b.visitantes !== a.visitantes) return b.visitantes - a.visitantes;
        return b.batismos - a.batismos;
      });
  }, [locais, registrosMesAtual, registrosMesAnterior]);

  // Insights Automáticos
  const insights = useMemo(() => {
    const list: string[] = [];

    // 1. Visitantes
    if (somaAtual.visitantes > somaAnterior.visitantes) {
      const p = somaAnterior.visitantes === 0 ? 100 : ((somaAtual.visitantes - somaAnterior.visitantes) / somaAnterior.visitantes) * 100;
      list.push(`📈 Crescimento de visitantes: O número de visitantes cresceu +${p.toFixed(0)}% comparado ao mês anterior.`);
    } else if (somaAtual.visitantes < somaAnterior.visitantes) {
      list.push(`📉 Redução de visitantes: A presença de novos visitantes diminuiu este mês. Recomendamos ações de recepção.`);
    }

    // 2. Evangelismos
    if (somaAtual.evangelismos < somaAnterior.evangelismos) {
      list.push(`📢 Ações de evangelismo: Redução nas atividades de evangelismo local em relação ao mês anterior.`);
    } else if (somaAtual.evangelismos > 0) {
      list.push(`🔥 Evangelismo ativo: Houve um engajamento maior no trabalho de evangelismo externo.`);
    }

    // 3. Congregações destaques
    if (rankingCongregacoes.length > 0) {
      const top = rankingCongregacoes[0];
      if (top.almas > 0) {
        list.push(`🏆 Destaque em Almas: A congregação ${top.nome} registrou a maior colheita espiritual com ${top.almas} almas alcançadas.`);
      }

      // Maior crescimento percentual
      const maisCresceu = [...rankingCongregacoes].sort((a, b) => b.variacaoAlmas - a.variacaoAlmas)[0];
      if (maisCresceu && maisCresceu.variacaoAlmas > 0) {
        list.push(`✨ Maior crescimento: ${maisCresceu.nome} apresentou o maior crescimento percentual em novos frutos espirituais (+${maisCresceu.variacaoAlmas.toFixed(0)}%).`);
      }

      // Sem movimentação
      const semMov = rankingCongregacoes.filter(c => c.totalCombinado === 0);
      if (semMov.length > 0) {
        const nomes = semMov.map(c => c.nome).slice(0, 3).join(', ');
        list.push(`⚠️ Alerta pastoral: Congregações sem atividade espiritual registrada este mês: ${nomes}${semMov.length > 3 ? ' e outras.' : '.'}`);
      }
    }

    if (list.length === 0) {
      list.push('💡 Nenhuma variação significativa de indicadores identificada para o mês filtrado.');
    }

    return list;
  }, [somaAtual, somaAnterior, rankingCongregacoes]);

  // --- LÓGICA DE CADASTRO E LANÇAMENTO ---

  const incrementMetric = (field: keyof typeof EMPTY_FORM) => {
    setFormData(prev => ({ ...prev, [field]: (prev[field] as number) + 1 }));
  };

  const decrementMetric = (field: keyof typeof EMPTY_FORM) => {
    setFormData(prev => ({ ...prev, [field]: Math.max(0, (prev[field] as number) - 1) }));
  };

  const resetForm = () => {
    setFormData({
      ...EMPTY_FORM,
      congregacao_id: isLocalUser ? (ctx.congregacaoId || '') : ''
    });
    setEditingId(null);
  };

  const startEdit = (reg: RelatorioEspiritualRegistro) => {
    setEditingId(reg.id);
    setFormData({
      congregacao_id: reg.congregacao_id || '',
      data_atividade: reg.data_atividade,
      tipo_atividade: reg.tipo_atividade,
      cultos_realizados: reg.cultos_realizados || 0,
      visitas_realizadas: reg.visitas_realizadas || 0,
      almas_alcancadas: reg.almas_alcancadas || 0,
      biblias_doadas: reg.biblias_doadas || 0,
      literaturas_entregues: reg.literaturas_entregues || 0,
      batismos_espirito_santo: reg.batismos_espirito_santo || 0,
      curas_divinas: reg.curas_divinas || 0,
      evangelismos_realizados: reg.evangelismos_realizados || 0,
      reconciliacoes: reg.reconciliacoes || 0,
      membros_cearam: reg.membros_cearam || 0,
      visitantes_presentes: reg.visitantes_presentes || 0,
      observacoes: reg.observacoes || '',
      status: reg.status
    } as any);
    setActiveTab('cadastro');
  };

  const deleteRegistro = async (id: string) => {
    if (!confirm('Deseja realmente excluir este registro de relatório espiritual?')) return;
    try {
      const { error } = await supabase
        .from('relatorio_espiritual_registros')
        .delete()
        .eq('id', id);

      if (error) {
        showNotification('error', 'Erro', error.message || 'Erro ao excluir.');
      } else {
        showNotification('success', 'Sucesso', 'Relatório excluído com sucesso.');
        loadRegistros();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ctx?.ministryId) return;

    if (!formData.congregacao_id) {
      showNotification('warning', 'Alerta', 'Selecione uma congregação válida.');
      return;
    }

    try {
      const payload: Partial<RelatorioEspiritualRegistro> = {
        ministry_id: ctx.ministryId,
        congregacao_id: formData.congregacao_id,
        data_atividade: formData.data_atividade,
        tipo_atividade: formData.tipo_atividade,
        cultos_realizados: formData.cultos_realizados,
        visitas_realizadas: formData.visitas_realizadas,
        almas_alcancadas: formData.almas_alcancadas,
        biblias_doadas: formData.biblias_doadas,
        literaturas_entregues: formData.literaturas_entregues,
        batismos_espirito_santo: formData.batismos_espirito_santo,
        curas_divinas: formData.curas_divinas,
        evangelismos_realizados: formData.evangelismos_realizados,
        reconciliacoes: formData.reconciliacoes,
        membros_cearam: formData.membros_cearam,
        visitantes_presentes: formData.visitantes_presentes,
        observacoes: formData.observacoes,
        status: formData.status
      };

      if (editingId) {
        const { error } = await supabase
          .from('relatorio_espiritual_registros')
          .update(payload)
          .eq('id', editingId);

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

  // Consolidação por congregação na quarta aba
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

    locais.forEach(l => {
      mapa[l.id] = {
        congregacao_id: l.id,
        nome: l.nome,
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

    registrosFiltrados.forEach(r => {
      if (r.congregacao_id && mapa[r.congregacao_id]) {
        const item = mapa[r.congregacao_id];
        item.cultos += r.cultos_realizados || 0;
        item.visitas += r.visitas_realizadas || 0;
        item.almas += r.almas_alcancadas || 0;
        item.biblias += r.biblias_doadas || 0;
        item.literaturas += r.literaturas_entregues || 0;
        item.batismos += r.batismos_espirito_santo || 0;
        item.curas += r.curas_divinas || 0;
        item.evangelismos += r.evangelismos_realizados || 0;
        item.reconciliacoes += r.reconciliacoes || 0;
        item.cearam += r.membros_cearam || 0;
        item.visitantes += r.visitantes_presentes || 0;

        if (!item.ultimo_envio || r.data_atividade > item.ultimo_envio) {
          item.ultimo_envio = r.data_atividade;
        }
      }
    });

    return Object.values(mapa);
  }, [locais, registrosFiltrados]);

  // Ativar ou desativar Link Externo de Coleta
  const toggleLinkColeta = async (congId: string, active: boolean) => {
    try {
      if (!ctx?.ministryId) return;
      if (active) {
        // Gerar Token
        const tokenString = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const expires = new Date();
        expires.setDate(expires.getDate() + 30); // 30 dias

        const { error } = await supabase
          .from('relatorio_espiritual_tokens')
          .upsert({
            ministry_id: ctx.ministryId,
            congregacao_id: congId,
            token: tokenString,
            is_active: true,
            expires_at: expires.toISOString()
          }, { onConflict: 'ministry_id,congregacao_id' });

        if (error) throw error;
        showNotification('success', 'Link Ativado', 'Link externo gerado com sucesso.');
      } else {
        // Desativar
        const { error } = await supabase
          .from('relatorio_espiritual_tokens')
          .update({ is_active: false })
          .eq('ministry_id', ctx.ministryId)
          .eq('congregacao_id', congId);

        if (error) throw error;
        showNotification('info', 'Link Desativado', 'Link de coleta desativado.');
      }
      loadTokens();
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Erro', 'Erro ao configurar link externo: ' + (err.message || ''));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showNotification('info', 'Copiado', 'Link de coleta copiado para a área de transferência.');
  };

  if (bloqueado) return null;

  return (
    <DashboardContainer>
      <DashboardHeader
        title="Relatório Espiritual"
        description="Acompanhamento consolidado das atividades espirituais e engajamento da igreja"
        contextSubtitle="Gestão Ministerial"
        actions={
          !isLocalUser ? (
            <button
              onClick={() => setIsCentralColetaOpen(true)}
              className="px-5 py-2.5 bg-[#062E6F] hover:bg-[#154A92] text-white rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Globe className="h-4 w-4" />
              Coleta das Congregações
            </button>
          ) : undefined
        }
        extra={
          <div className="flex border-b border-slate-200 mt-4">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm transition-all relative ${
                  activeTab === tab.id
                    ? 'text-[#062E6F] border-b-2 border-[#062E6F]'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        }
      />

      <DashboardContent>
        {/* ABA 1: DASHBOARD EXECUTIVO */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            
            {/* Filtro de Competência do Dashboard */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-[#062E6F]" />
                <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">
                  Período de Competência
                </h3>
              </div>

              <div className="flex flex-wrap gap-3">
                {/* Seleção do Mês */}
                <select
                  value={dashMes}
                  onChange={e => setDashMes(parseInt(e.target.value))}
                  className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-slate-50 font-bold focus:bg-white transition"
                >
                  {MESES_NOMES.map((nome, index) => (
                    <option key={index + 1} value={index + 1}>{nome}</option>
                  ))}
                </select>

                {/* Seleção do Ano */}
                <select
                  value={dashAno}
                  onChange={e => setDashAno(parseInt(e.target.value))}
                  className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-slate-50 font-bold focus:bg-white transition"
                >
                  <option value={2024}>2024</option>
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                </select>

                {/* Seletor Congregação (Visível e ativo apenas se for admin/secretario) */}
                {!isLocalUser && (
                  <select
                    value={filtroCongregacao}
                    onChange={e => setFiltroCongregacao(e.target.value)}
                    className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-slate-50 font-bold focus:bg-white transition"
                  >
                    <option value="">Todas as congregações</option>
                    {locais.map(l => (
                      <option key={l.id} value={l.id}>{l.nome}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* KPIs Consolidados com Comparativos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <ExecutiveMetricCard
                title="Almas Alcançadas"
                value={somaAtual.almas}
                icon={Flame}
                color="rose"
                trend={getTrend(variacoes.almas)}
              />
              <ExecutiveMetricCard
                title="Visitantes nos Cultos"
                value={somaAtual.visitantes}
                icon={UserPlus}
                color="blue"
                trend={getTrend(variacoes.visitantes)}
              />
              <ExecutiveMetricCard
                title="Reconciliações"
                value={somaAtual.reconciliacoes}
                icon={Users}
                color="emerald"
                trend={getTrend(variacoes.reconciliacoes)}
              />
              <ExecutiveMetricCard
                title="Batismos ES"
                value={somaAtual.batismos}
                icon={Sparkles}
                color="rose"
                trend={getTrend(variacoes.batismos)}
              />
            </div>

            {/* Gráficos de Evolução e Distribuição */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Evolução Mensal (Linha) */}
              <div className="lg:col-span-2">
                <DashboardSection title="Evolução Mensal (Últimos 12 Meses)">
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Selecione o Indicador</span>
                      <div className="flex gap-1.5">
                        {([
                          { key: 'almas', label: 'Almas' },
                          { key: 'visitantes', label: 'Visitantes' },
                          { key: 'reconciliacoes', label: 'Reconciliações' },
                          { key: 'batismos', label: 'Batismos ES' }
                        ] as const).map(met => (
                          <button
                            key={met.key}
                            onClick={() => setEvolucaoMetrica(met.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                              evolucaoMetrica === met.key
                                ? 'bg-[#062E6F] text-white shadow-sm'
                                : 'bg-slate-50 text-slate-650 hover:bg-slate-100'
                            }`}
                          >
                            {met.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={evolucaoDados} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis dataKey="mesAno" stroke="#94A3B8" fontSize={11} tickLine={false} />
                          <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                          <ChartTooltip />
                          <Line
                            type="monotone"
                            dataKey={
                              evolucaoMetrica === 'almas' ? 'Almas' :
                              evolucaoMetrica === 'visitantes' ? 'Visitantes' :
                              evolucaoMetrica === 'reconciliacoes' ? 'Reconciliacoes' : 'Batismos'
                            }
                            stroke="#062E6F"
                            strokeWidth={3}
                            dot={{ stroke: '#062E6F', strokeWidth: 2, r: 4, fill: '#fff' }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </DashboardSection>
              </div>

              {/* Distribuição das Atividades (Barras) */}
              <div>
                <DashboardSection title="Atividades da Competência">
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                      Cultos, Ceias, Visitas e Evangelismo
                    </span>
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={distribuicaoAtividades} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} />
                          <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                          <ChartTooltip />
                          <Bar dataKey="Quantidade" fill="#475569" radius={[6, 6, 0, 0]} barSize={32} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </DashboardSection>
              </div>

            </div>

            {/* Ranking das Congregações e Insights do Mês */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Ranking (Top Congregações) */}
              <div className="lg:col-span-2">
                <DashboardSection title="Ranking Geral das Congregações">
                  <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase font-black tracking-wider">
                            <th className="px-5 py-3 text-center w-16">Posição</th>
                            <th className="px-5 py-3">Congregação</th>
                            <th className="px-5 py-3 text-center">Almas</th>
                            <th className="px-5 py-3 text-center">Reconciliações</th>
                            <th className="px-5 py-3 text-center">Visitantes</th>
                            <th className="px-5 py-3 text-center">Batismos ES</th>
                            <th className="px-5 py-3 text-right">Var. Almas (Mês)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                          {rankingCongregacoes.map((c, i) => (
                            <tr key={c.id} className="hover:bg-slate-50/50 transition">
                              <td className="px-5 py-4 text-center font-black">
                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`}
                              </td>
                              <td className="px-5 py-4 font-bold text-slate-800 text-sm">
                                {c.nome}
                              </td>
                              <td className="px-5 py-4 text-center font-bold text-rose-600">{c.almas}</td>
                              <td className="px-5 py-4 text-center">{c.reconciliacoes}</td>
                              <td className="px-5 py-4 text-center">{c.visitantes}</td>
                              <td className="px-5 py-4 text-center">{c.batismos}</td>
                              <td className="px-5 py-4 text-right whitespace-nowrap">
                                {c.variacaoAlmas > 0 ? (
                                  <span className="text-emerald-600 font-bold">+{c.variacaoAlmas.toFixed(0)}%</span>
                                ) : c.variacaoAlmas < 0 ? (
                                  <span className="text-rose-600 font-bold">{c.variacaoAlmas.toFixed(0)}%</span>
                                ) : (
                                  <span className="text-slate-400 font-medium">0%</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </DashboardSection>
              </div>

              {/* Insights do Mês */}
              <div>
                <DashboardSection title="Insights do Mês">
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4 min-h-[300px]">
                    <div className="flex items-center gap-2 text-amber-600 mb-2">
                      <Lightbulb className="h-5 w-5" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Análise de Tendência
                      </span>
                    </div>

                    <div className="space-y-3">
                      {insights.map((insight, idx) => (
                        <div key={idx} className="flex gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100/70 text-xs font-semibold text-slate-700 leading-relaxed">
                          <span>💡</span>
                          <p>{insight}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </DashboardSection>
              </div>

            </div>

          </div>
        )}

        {/* ABA 2: CADASTRO E LANÇAMENTOS */}
        {activeTab === 'cadastro' && (
          <DashboardSection title={editingId ? "✏️ Editar Relatório Espiritual" : "📝 Cadastrar Atividade Espiritual"}>
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Congregação */}
                <div>
                  <label className="block text-sm font-semibold text-slate-750 mb-1">
                    {labelDivPrincipal} *
                  </label>
                  <select
                    disabled={isLocalUser}
                    value={formData.congregacao_id}
                    onChange={e => setFormData(prev => ({ ...prev, congregacao_id: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 shadow-sm focus:border-slate-500 focus:outline-none"
                    required
                  >
                    <option value="">Selecione...</option>
                    {locais.map(l => (
                      <option key={l.id} value={l.id}>{l.nome}</option>
                    ))}
                  </select>
                </div>

                {/* Data */}
                <div>
                  <label className="block text-sm font-semibold text-slate-750 mb-1">Data da Atividade *</label>
                  <input
                    type="date"
                    value={formData.data_atividade}
                    onChange={e => setFormData(prev => ({ ...prev, data_atividade: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 shadow-sm focus:border-slate-500 focus:outline-none"
                    required
                  />
                </div>

                {/* Tipo de Atividade */}
                <div>
                  <label className="block text-sm font-semibold text-slate-750 mb-1">Tipo de Atividade *</label>
                  <select
                    value={formData.tipo_atividade}
                    onChange={e => setFormData(prev => ({ ...prev, tipo_atividade: e.target.value as any }))}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 shadow-sm focus:border-slate-500 focus:outline-none"
                    required
                  >
                    <option value="Visita">🏠 Visita</option>
                    <option value="Evangelismo">📢 Evangelismo</option>
                    <option value="Culto">⛪ Culto</option>
                    <option value="Santa Ceia">🍇 Santa Ceia</option>
                    <option value="Outro">📦 Outro</option>
                  </select>
                </div>

              </div>

              {/* Métricas Principais */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                
                {/* Cultos Realizados */}
                {['Culto', 'Santa Ceia'].includes(formData.tipo_atividade) && (
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-500 mb-1">Cultos Realizados</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        value={formData.cultos_realizados}
                        onChange={e => setFormData(prev => ({ ...prev, cultos_realizados: Math.max(0, parseInt(e.target.value) || 0) }))}
                        className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-1.5 focus:outline-none"
                      />
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => decrementMetric('cultos_realizados')} className="p-1 border border-slate-300 rounded bg-white hover:bg-slate-100"><Minus className="h-3 w-3" /></button>
                        <button type="button" onClick={() => incrementMetric('cultos_realizados')} className="p-1 bg-slate-900 text-white hover:bg-slate-800 rounded"><Plus className="h-3 w-3" /></button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Visitas Realizadas */}
                {formData.tipo_atividade === 'Visita' && (
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-500 mb-1">Visitas Realizadas</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        value={formData.visitas_realizadas}
                        onChange={e => setFormData(prev => ({ ...prev, visitas_realizadas: Math.max(0, parseInt(e.target.value) || 0) }))}
                        className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-1.5 focus:outline-none"
                      />
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => decrementMetric('visitas_realizadas')} className="p-1 border border-slate-300 rounded bg-white hover:bg-slate-100"><Minus className="h-3 w-3" /></button>
                        <button type="button" onClick={() => incrementMetric('visitas_realizadas')} className="p-1 bg-slate-900 text-white hover:bg-slate-800 rounded"><Plus className="h-3 w-3" /></button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Almas Alcançadas */}
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">Almas Alcançadas</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={formData.almas_alcancadas}
                      onChange={e => setFormData(prev => ({ ...prev, almas_alcancadas: Math.max(0, parseInt(e.target.value) || 0) }))}
                      className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-1.5 focus:outline-none"
                    />
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => decrementMetric('almas_alcancadas')} className="p-1 border border-slate-300 rounded bg-white hover:bg-slate-100"><Minus className="h-3 w-3" /></button>
                      <button type="button" onClick={() => incrementMetric('almas_alcancadas')} className="p-1 bg-slate-900 text-white hover:bg-slate-800 rounded"><Plus className="h-3 w-3" /></button>
                    </div>
                  </div>
                </div>

                {/* Batismos Espírito Santo */}
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">Batismos ES</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={formData.batismos_espirito_santo}
                      onChange={e => setFormData(prev => ({ ...prev, batismos_espirito_santo: Math.max(0, parseInt(e.target.value) || 0) }))}
                      className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-1.5 focus:outline-none"
                    />
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => decrementMetric('batismos_espirito_santo')} className="p-1 border border-slate-300 rounded bg-white hover:bg-slate-100"><Minus className="h-3 w-3" /></button>
                      <button type="button" onClick={() => incrementMetric('batismos_espirito_santo')} className="p-1 bg-slate-900 text-white hover:bg-slate-800 rounded"><Plus className="h-3 w-3" /></button>
                    </div>
                  </div>
                </div>

                {/* Reconciliações */}
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">Reconciliações</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={formData.reconciliacoes}
                      onChange={e => setFormData(prev => ({ ...prev, reconciliacoes: Math.max(0, parseInt(e.target.value) || 0) }))}
                      className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-1.5 focus:outline-none"
                    />
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => decrementMetric('reconciliacoes')} className="p-1 border border-slate-300 rounded bg-white hover:bg-slate-100"><Minus className="h-3 w-3" /></button>
                      <button type="button" onClick={() => incrementMetric('reconciliacoes')} className="p-1 bg-slate-900 text-white hover:bg-slate-800 rounded"><Plus className="h-3 w-3" /></button>
                    </div>
                  </div>
                </div>

              </div>

              {/* Detalhes de Ceia e Cultos */}
              {['Santa Ceia', 'Culto'].includes(formData.tipo_atividade) && (
                <div className="p-5 bg-amber-50/50 rounded-2xl border border-amber-100/50 space-y-4">
                  <h3 className="text-xs font-black uppercase text-amber-800 tracking-wider">🌟 Requisitos da Atividade</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {formData.tipo_atividade === 'Santa Ceia' && (
                      <div>
                        <label className="block text-xs font-black uppercase text-slate-500 mb-1">Membros que Cearam</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            value={formData.membros_cearam}
                            onChange={e => setFormData(prev => ({ ...prev, membros_cearam: Math.max(0, parseInt(e.target.value) || 0) }))}
                            className="w-40 rounded-xl border border-slate-300 bg-white px-4 py-2 shadow-sm focus:outline-none"
                          />
                          <div className="flex items-center gap-1.5">
                            <button type="button" onClick={() => decrementMetric('membros_cearam')} className="p-1.5 border border-slate-300 bg-white hover:bg-slate-100 rounded-lg"><Minus className="h-3.5 w-3.5" /></button>
                            <button type="button" onClick={() => incrementMetric('membros_cearam')} className="p-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-lg"><Plus className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      </div>
                    )}
                    {formData.tipo_atividade === 'Culto' && (
                      <div>
                        <label className="block text-xs font-black uppercase text-slate-500 mb-1">Visitantes Presentes</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            value={formData.visitantes_presentes}
                            onChange={e => setFormData(prev => ({ ...prev, visitantes_presentes: Math.max(0, parseInt(e.target.value) || 0) }))}
                            className="w-40 rounded-xl border border-slate-300 bg-white px-4 py-2 shadow-sm focus:outline-none"
                          />
                          <div className="flex items-center gap-1.5">
                            <button type="button" onClick={() => decrementMetric('visitantes_presentes')} className="p-1.5 border border-slate-300 bg-white hover:bg-slate-100 rounded-lg"><Minus className="h-3.5 w-3.5" /></button>
                            <button type="button" onClick={() => incrementMetric('visitantes_presentes')} className="p-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-lg"><Plus className="h-3.5 w-3.5" /></button>
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
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Observações espirituais</label>
                  <textarea
                    value={formData.observacoes}
                    onChange={e => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                    rows={3}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 shadow-sm focus:border-slate-500 focus:outline-none"
                    placeholder="Espaço reservado para observações espirituais..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Status *</label>
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

              {/* Ações */}
              <div className="flex gap-2 justify-end pt-4 border-t border-slate-150">
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-md transition cursor-pointer"
                >
                  {editingId ? 'Salvar Alterações' : 'Salvar Registro'}
                </button>
              </div>

            </form>
          </DashboardSection>
        )}

        {/* ABA 3: REGISTROS ENVIADOS */}
        {activeTab === 'registros' && (
          <DashboardSection title="Registros Enviados">
            {/* Filtros de Listagem */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 mb-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
              
              {/* Congregação */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Congregação</label>
                <select
                  value={filtroCongregacao}
                  onChange={e => setFiltroCongregacao(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none"
                >
                  <option value="">Todas</option>
                  {locais.map(l => (
                    <option key={l.id} value={l.id}>{l.nome}</option>
                  ))}
                </select>
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Tipo</label>
                <select
                  value={filtroTipo}
                  onChange={e => setFiltroTipo(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none"
                >
                  <option value="">Todos</option>
                  <option value="Culto">⛪ Culto</option>
                  <option value="Santa Ceia">🍇 Santa Ceia</option>
                  <option value="Visita">🏠 Visita</option>
                  <option value="Evangelismo">📢 Evangelismo</option>
                  <option value="Outro">📦 Outro</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Status</label>
                <select
                  value={filtroStatus}
                  onChange={e => setFiltroStatus(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none"
                >
                  <option value="">Todos</option>
                  <option value="Rascunho">Rascunho</option>
                  <option value="Enviado">Enviado</option>
                  <option value="Revisado">Revisado</option>
                </select>
              </div>

              {/* Data Inicial */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Desde</label>
                <input
                  type="date"
                  value={filtroDataInicio}
                  onChange={e => setFiltroDataInicio(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none"
                />
              </div>

              {/* Data Final */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Até</label>
                <input
                  type="date"
                  value={filtroDataFim}
                  onChange={e => setFiltroDataFim(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none"
                />
              </div>

            </div>

            {registrosFiltrados.length === 0 ? (
              <DashboardEmptyState
                icon={FileText}
                title="Sem lançamentos espirituais"
                description="Nenhum relatório espíritual foi encontrado para os filtros aplicados."
              />
            ) : (
              <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-550 uppercase font-bold tracking-wider">
                        <th className="px-5 py-3">Data</th>
                        <th className="px-5 py-3">Congregação</th>
                        <th className="px-5 py-3">Tipo</th>
                        <th className="px-5 py-3 text-center">Almas</th>
                        <th className="px-5 py-3 text-center">Batismos ES</th>
                        <th className="px-5 py-3 text-center">Reconciliações</th>
                        <th className="px-5 py-3 text-center">Visitantes</th>
                        <th className="px-5 py-3 text-center">Status</th>
                        <th className="px-5 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {registrosFiltrados.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50/50 transition">
                          <td className="px-5 py-4 whitespace-nowrap">{formatDate(r.data_atividade)}</td>
                          <td className="px-5 py-4 font-bold text-slate-800">
                            {locais.find(l => l.id === r.congregacao_id)?.nome || 'Outra'}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase">
                              {r.tipo_atividade}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-center font-bold text-rose-600">{r.almas_alcancadas || 0}</td>
                          <td className="px-5 py-4 text-center font-bold text-rose-500">{r.batismos_espirito_santo || 0}</td>
                          <td className="px-5 py-4 text-center">{r.reconciliacoes || 0}</td>
                          <td className="px-5 py-4 text-center">{r.visitantes_presentes || 0}</td>
                          <td className="px-5 py-4 text-center whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              r.status === 'Rascunho' ? 'bg-slate-100 text-slate-750' :
                              r.status === 'Enviado' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                              'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            }`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => startEdit(r)}
                                className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => deleteRegistro(r.id)}
                                className="p-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg transition"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </DashboardSection>
        )}

        {/* ABA 4: CONSOLIDAÇÃO POR CONGREGAÇÃO */}
        {activeTab === 'consolidado' && (
          <DashboardSection title="Consolidação por Congregação">
            {consolidadoPorCongregacao.length === 0 ? (
              <DashboardEmptyState
                icon={Users}
                title="Sem consolidações"
                description="Selecione filtros na aba de registros para ver dados de consolidação."
              />
            ) : (
              <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-550 uppercase font-bold tracking-wider">
                        <th className="px-5 py-3.5">Congregação</th>
                        <th className="px-5 py-3.5 text-center">Cultos</th>
                        <th className="px-5 py-3.5 text-center">Santa Ceias</th>
                        <th className="px-5 py-3.5 text-center">Visitas</th>
                        <th className="px-5 py-3.5 text-center">Evangelismos</th>
                        <th className="px-5 py-3.5 text-center">Almas</th>
                        <th className="px-5 py-3.5 text-center">Batismos ES</th>
                        <th className="px-5 py-3.5 text-center">Reconciliados</th>
                        <th className="px-5 py-3.5 text-center">Visitantes</th>
                        <th className="px-5 py-3.5 text-right">Último Lançamento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {consolidadoPorCongregacao.map(c => (
                        <tr key={c.congregacao_id || ''} className="hover:bg-slate-50/50 transition">
                          <td className="px-5 py-4 font-bold text-slate-800 text-sm">{c.nome}</td>
                          <td className="px-5 py-4 text-center font-semibold text-slate-700">{c.cultos}</td>
                          <td className="px-5 py-4 text-center">{c.cearam > 0 ? `${c.cearam} part.` : '—'}</td>
                          <td className="px-5 py-4 text-center">{c.visitas}</td>
                          <td className="px-5 py-4 text-center">{c.evangelismos}</td>
                          <td className="px-5 py-4 text-center font-bold text-rose-600">{c.almas}</td>
                          <td className="px-5 py-4 text-center font-bold text-rose-500">{c.batismos}</td>
                          <td className="px-5 py-4 text-center font-bold text-emerald-600">{c.reconciliacoes}</td>
                          <td className="px-5 py-4 text-center">{c.visitantes}</td>
                          <td className="px-5 py-4 text-right font-medium text-slate-500">
                            {c.ultimo_envio ? formatDate(c.ultimo_envio) : <span className="text-slate-400 italic">Nunca</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </DashboardSection>
        )}

      </DashboardContent>

      {/* Modal: Central de Coleta de Relatórios das Congregações */}
      {isCentralColetaOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-100 max-h-[85vh]">
            
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-[#062E6F] to-[#154A92] flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Globe className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white uppercase tracking-wide">
                    Central de Coleta Externa
                  </h3>
                  <p className="text-blue-100 text-xs mt-0.5 font-semibold">
                    Envio de relatórios espirituais sem necessidade de login no sistema
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCentralColetaOpen(false);
                  setQrCodeCongId(null);
                }}
                className="p-1 rounded-lg text-blue-200 hover:bg-white/15 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Corpo */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 min-h-[300px]">
              
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 text-xs font-semibold text-slate-700 flex gap-2.5">
                <Lightbulb className="h-5 w-5 text-amber-600 shrink-0" />
                <p className="leading-relaxed">
                  Gere links externos com QR Codes para que os líderes locais possam lançar os indicadores diretamente de seus celulares sem precisar de usuário/senha. Os dados caem diretamente na sua tela como rascunhos.
                </p>
              </div>

              {/* Lista de congregações */}
              <div className="space-y-4">
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                  Links de Coleta por Congregação
                </h4>

                <div className="space-y-3.5">
                  {locais.map(l => {
                    const statusToken = tokens[l.id];
                    const host = window.location.origin;
                    const linkUrl = statusToken?.token ? `${host}/formularios/relatorio-espiritual/${statusToken.token}` : '';

                    return (
                      <div key={l.id} className="border border-slate-100 rounded-xl p-4 bg-white hover:shadow-sm transition space-y-3">
                        <div className="flex justify-between items-center flex-wrap gap-2">
                          <span className="font-bold text-slate-800 text-sm">{l.nome}</span>
                          
                          <div className="flex gap-2">
                            {statusToken?.is_active ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(linkUrl)}
                                  className="px-2.5 py-1.5 border border-slate-300 hover:border-slate-400 rounded-lg text-[10px] font-extrabold text-slate-700 transition cursor-pointer"
                                >
                                  Copiar Link
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setQrCodeCongId(qrCodeCongId === l.id ? null : l.id)}
                                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-850 rounded-lg text-[10px] font-extrabold text-white transition flex items-center gap-1 cursor-pointer"
                                >
                                  <QrCode className="h-3.5 w-3.5" />
                                  QR Code
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleLinkColeta(l.id, false)}
                                  className="px-2.5 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-[10px] font-extrabold transition cursor-pointer"
                                >
                                  Desativar
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => toggleLinkColeta(l.id, true)}
                                className="px-3 py-1.5 bg-[#062E6F] hover:bg-[#154A92] text-white rounded-lg text-[10px] font-extrabold transition cursor-pointer"
                              >
                                Ativar Link Externo
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Detalhe de expiração */}
                        {statusToken?.is_active && (
                          <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Link ativo {statusToken.expires_at ? `(Expira em ${new Date(statusToken.expires_at).toLocaleDateString('pt-BR')})` : ''}
                          </div>
                        )}

                        {/* Área do QR Code se aberto */}
                        {qrCodeCongId === l.id && statusToken?.is_active && (
                          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col items-center justify-center space-y-3">
                            <QRCodeSVG value={linkUrl} size={150} />
                            <span className="text-[10px] text-slate-500 font-bold max-w-xs text-center">
                              Aponte a câmera do celular para abrir o formulário da congregação
                            </span>
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>

              </div>

            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsCentralColetaOpen(false);
                  setQrCodeCongId(null);
                }}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer"
              >
                Fechar Painel
              </button>
            </div>

          </div>
        </div>
      )}

      <NotificationModal
        isOpen={modalNotify.isOpen}
        title={modalNotify.title}
        message={modalNotify.message}
        type={modalNotify.type}
        onClose={() => setModalNotify(prev => ({ ...prev, isOpen: false }))}
      />
    </DashboardContainer>
  );
}
