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
  Lightbulb,
  Clock,
  Activity,
  Lock,
  Unlock,
  ClipboardCopy,
  CheckCircle2,
  AlertCircle
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

interface FechamentoRegistro {
  id: string;
  text_id?: string;
  ministry_id: string;
  congregacao_id: string | null;
  mes: number;
  ano: number;
  status: 'Aberta' | 'Fechada';
  fechado_em: string | null;
  fechado_por: string | null;
  observacoes: string | null;
}

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

  // Competência selecionada globalmente
  const [dashMes, setDashMes] = useState<number>(new Date().getMonth() + 1);
  const [dashAno, setDashAno] = useState<number>(new Date().getFullYear());
  const [filtroCongregacao, setFiltroCongregacao] = useState('');

  // Status de Fechamento da Competência
  const [fechamentoStatus, setFechamentoStatus] = useState<'Aberta' | 'Fechada'>('Aberta');
  const [fechamentoInfo, setFechamentoInfo] = useState<FechamentoRegistro | null>(null);
  const [loadingFechamento, setLoadingFechamento] = useState(false);

  const [formData, setFormData] = useState(EMPTY_FORM);

  // Filtros internos das abas
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  // Métrica selecionada no Gráfico de Evolução
  const [evolucaoMetrica, setEvolucaoMetrica] = useState<'almas' | 'visitantes' | 'reconciliacoes' | 'batismos'>('almas');

  // Chave de ordenação dinâmica do Ranking
  const [rankingSortKey, setRankingSortKey] = useState<'ise' | 'almas' | 'visitantes' | 'evangelismos' | 'reconciliacoes' | 'batismos'>('ise');

  // Congregação selecionada para visualização de evolução detalhada (Modal)
  const [selectedCongregacaoEvolucao, setSelectedCongregacaoEvolucao] = useState<{ id: string; nome: string } | null>(null);

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

  const dashCongregacaoId = useMemo(() => {
    return isLocalUser ? (ctx.congregacaoId || '') : filtroCongregacao;
  }, [isLocalUser, ctx.congregacaoId, filtroCongregacao]);

  // Carregar status do Fechamento
  const loadStatusFechamento = async () => {
    if (!ctx?.ministryId) return;
    setLoadingFechamento(true);
    try {
      let query = supabase
        .from('relatorio_espiritual_fechamentos')
        .select('*')
        .eq('ministry_id', ctx.ministryId)
        .eq('mes', dashMes)
        .eq('ano', dashAno);

      if (dashCongregacaoId) {
        query = query.eq('congregacao_id', dashCongregacaoId);
      } else {
        query = query.is('congregacao_id', null);
      }

      const { data, error } = await query.maybeSingle();

      if (!error && data) {
        setFechamentoStatus(data.status as 'Aberta' | 'Fechada');
        setFechamentoInfo(data as FechamentoRegistro);
      } else {
        setFechamentoStatus('Aberta');
        setFechamentoInfo(null);
      }
    } catch (err) {
      console.error(err);
      setFechamentoStatus('Aberta');
      setFechamentoInfo(null);
    } finally {
      setLoadingFechamento(false);
    }
  };

  useEffect(() => {
    if (!ctx?.loading && ctx?.ministryId) {
      loadStatusFechamento();
    }
  }, [ctx?.loading, ctx?.ministryId, dashMes, dashAno, dashCongregacaoId]);

  // Ações de Fechamento / Reabertura
  const handleFecharCompetencia = async () => {
    if (!ctx?.ministryId) return;
    if (!confirm(`Deseja realmente FECHAR a competência de ${MESES_NOMES[dashMes - 1]}/${dashAno}? Novos registros serão bloqueados.`)) return;

    try {
      const { data: user } = await supabase.auth.getUser();
      const payload = {
        ministry_id: ctx.ministryId,
        congregacao_id: dashCongregacaoId || null,
        mes: dashMes,
        ano: dashAno,
        status: 'Fechada',
        fechado_em: new Date().toISOString(),
        fechado_por: user.user?.id || null,
        observacoes: `Competência fechada pelo gestor.`
      };

      const { error } = await supabase
        .from('relatorio_espiritual_fechamentos')
        .upsert(payload, { onConflict: 'ministry_id,congregacao_id,mes,ano' });

      if (error) {
        showNotification('error', 'Erro', 'Não foi possível fechar a competência: ' + error.message);
      } else {
        showNotification('success', 'Fechado', 'Competência fechada com sucesso. Lançamentos bloqueados.');
        loadStatusFechamento();
      }
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Erro', 'Erro operacional ao fechar competência.');
    }
  };

  const handleReabrirCompetencia = async () => {
    if (!ctx?.ministryId) return;
    
    // Validar permissão
    const isAutorizado = !isLocalUser || ['administrador', 'suporte', 'presidencia', 'secretaria'].includes(ctx.nivel as string);
    if (!isAutorizado) {
      showNotification('warning', 'Acesso Negado', 'Você não possui permissão administrativa geral para reabrir esta competência.');
      return;
    }

    if (!confirm(`Deseja realmente REABRIR a competência de ${MESES_NOMES[dashMes - 1]}/${dashAno}? Lançamentos serão liberados.`)) return;

    try {
      const { error } = await supabase
        .from('relatorio_espiritual_fechamentos')
        .delete()
        .eq('ministry_id', ctx.ministryId)
        .eq('mes', dashMes)
        .eq('ano', dashAno)
        .eq(dashCongregacaoId ? 'congregacao_id' : 'id', dashCongregacaoId || (fechamentoInfo?.id || '')); // corrige match de id

      if (error) {
        showNotification('error', 'Erro', 'Não foi possível reabrir a competência: ' + error.message);
      } else {
        showNotification('success', 'Reaberta', 'Competência reaberta com sucesso. Lançamentos liberados.');
        loadStatusFechamento();
      }
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Erro', 'Erro operacional ao reabrir competência.');
    }
  };

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showNotification('info', 'Copiado', 'Link de coleta copiado para a área de transferência.');
  };

  const toggleLinkColeta = async (congId: string, active: boolean) => {
    if (!ctx?.ministryId) return;
    try {
      if (active) {
        const token = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
        const { error } = await supabase
          .from('relatorio_espiritual_tokens')
          .insert({
            ministry_id: ctx.ministryId,
            congregacao_id: congId,
            token,
            is_active: true,
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          });

        if (error) {
          showNotification('error', 'Erro', 'Erro ao ativar link: ' + error.message);
        } else {
          showNotification('success', 'Ativado', 'Link externo ativado com sucesso.');
          loadTokens();
        }
      } else {
        const { error } = await supabase
          .from('relatorio_espiritual_tokens')
          .delete()
          .eq('ministry_id', ctx.ministryId)
          .eq('congregacao_id', congId);

        if (error) {
          showNotification('error', 'Erro', 'Erro ao desativar link: ' + error.message);
        } else {
          showNotification('success', 'Desativado', 'Link externo desativado.');
          loadTokens();
        }
      }
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Erro', 'Erro operacional ao alterar link.');
    }
  };

  // Alinha a data padrão de novos lançamentos ao alterar a competência
  useEffect(() => {
    const mesStr = String(dashMes).padStart(2, '0');
    setFormData(prev => ({
      ...prev,
      data_atividade: `${dashAno}-${mesStr}-01`
    }));
  }, [dashMes, dashAno]);

  // Filtros aplicados sobre a listagem da aba "Registros" (Isolamento de Competência Mensal)
  const registrosFiltrados = useMemo(() => {
    return registros.filter(r => {
      if (dashCongregacaoId && r.congregacao_id !== dashCongregacaoId) return false;
      if (filtroTipo && r.tipo_atividade !== filtroTipo) return false;
      if (filtroStatus && r.status !== filtroStatus) return false;

      // Isolamento absoluto da competência
      const d = new Date(r.data_atividade);
      const m = d.getUTCMonth() + 1;
      const y = d.getUTCFullYear();
      return m === dashMes && y === dashAno;
    });
  }, [registros, dashCongregacaoId, filtroTipo, filtroStatus, dashMes, dashAno]);

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

  // Variações Percentuais Gerais
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
    return { direction: 'stable' as const, label: `Estável comparado ao mês anterior` };
  };

  // 12 Meses de Histórico Geral
  const evolucaoDados = useMemo(() => {
    const dados = [];
    const baseDate = new Date(dashAno, dashMes - 1, 15);

    for (let i = 11; i >= 0; i--) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 15);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();

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

  // Distribuição de Atividades
  const distribuicaoAtividades = useMemo(() => {
    return [
      { name: 'Cultos', Quantidade: somaAtual.cultos },
      { name: 'Santa Ceias', Quantidade: somaAtual.ceias },
      { name: 'Visitas', Quantidade: somaAtual.visitas },
      { name: 'Evangelismos', Quantidade: somaAtual.evangelismos }
    ];
  }, [somaAtual]);

  // --- MODELAGEM DE SAÚDE E PONTUAÇÃO (ISE) ---

  const obterSomaPonderada = (
    congId: string,
    regs: RelatorioEspiritualRegistro[]
  ) => {
    let almas = 0, recon = 0, bat = 0, visit = 0, evang = 0, visitas = 0;
    regs.forEach(r => {
      if (r.congregacao_id === congId) {
        almas += r.almas_alcancadas || 0;
        recon += r.reconciliacoes || 0;
        bat += r.batismos_espirito_santo || 0;
        visit += r.visitantes_presentes || 0;
        evang += r.evangelismos_realizados || 0;
        visitas += r.visitas_realizadas || 0;
      }
    });
    return (almas * 5) + (recon * 4) + (bat * 4) + (visit * 2) + (evang * 2) + (visitas * 1);
  };

  // Cálculo da Saúde Espiritual (ISE) por congregação
  const congregacoesAnaliticas = useMemo(() => {
    let maxSoma = 20;
    locais.forEach(l => {
      const soma = obterSomaPonderada(l.id, registrosMesAtual);
      if (soma > maxSoma) maxSoma = soma;
    });

    return locais.map(l => {
      let almas = 0, reconciliacoes = 0, visitantes = 0, batismos = 0, evangelismos = 0, visitas = 0;
      registrosMesAtual.forEach(r => {
        if (r.congregacao_id === l.id) {
          almas += r.almas_alcancadas || 0;
          reconciliacoes += r.reconciliacoes || 0;
          visitantes += r.visitantes_presentes || 0;
          batismos += r.batismos_espirito_santo || 0;
          evangelismos += r.evangelismos_realizados || 0;
          visitas += r.visitas_realizadas || 0;
        }
      });

      const somaPonderada = (almas * 5) + (reconciliacoes * 4) + (batismos * 4) + (visitantes * 2) + (evangelismos * 2) + (visitas * 1);
      const ise = Math.round((somaPonderada / maxSoma) * 100);

      let almasAnterior = 0, reconciliacoesAnterior = 0, visitantesAnterior = 0, batismosAnterior = 0, evangelismosAnterior = 0, visitasAnterior = 0;
      registrosMesAnterior.forEach(r => {
        if (r.congregacao_id === l.id) {
          almasAnterior += r.almas_alcancadas || 0;
          reconciliacoesAnterior += r.reconciliacoes || 0;
          visitantesAnterior += r.visitantes_presentes || 0;
          batismosAnterior += r.batismos_espirito_santo || 0;
          evangelismosAnterior += r.evangelismos_realizados || 0;
          visitasAnterior += r.visitas_realizadas || 0;
        }
      });

      const somaPonderadaAnterior = (almasAnterior * 5) + (reconciliacoesAnterior * 4) + (batismosAnterior * 4) + (visitantesAnterior * 2) + (evangelismosAnterior * 2) + (visitasAnterior * 1);

      let variacaoIse = 0;
      if (somaPonderadaAnterior === 0) {
        variacaoIse = somaPonderada > 0 ? 100 : 0;
      } else {
        variacaoIse = ((somaPonderada - somaPonderadaAnterior) / somaPonderadaAnterior) * 100;
      }

      // Mês Retrasado
      const prev2Mes = dashMes <= 2 ? (dashMes === 2 ? 12 : 11) : dashMes - 2;
      const prev2Ano = dashMes <= 2 ? (dashMes === 2 ? dashAno - 1 : dashAno - 1) : dashAno;
      const registrosMesRetrasado = registros.filter(r => {
        const d = new Date(r.data_atividade);
        const m = d.getUTCMonth() + 1;
        const y = d.getUTCFullYear();
        return r.congregacao_id === l.id && m === prev2Mes && y === prev2Ano;
      });

      let almasRetrasado = 0, reconciliacoesRetrasado = 0, visitantesRetrasado = 0, batismosRetrasado = 0, evangelismosRetrasado = 0, visitasRetrasado = 0;
      registrosMesRetrasado.forEach(r => {
        almasRetrasado += r.almas_alcancadas || 0;
        reconciliacoesRetrasado += r.reconciliacoes || 0;
        visitantesRetrasado += r.visitantes_presentes || 0;
        batismosRetrasado += r.batismos_espirito_santo || 0;
        evangelismosRetrasado += r.evangelismos_realizados || 0;
        visitasRetrasado += r.visitas_realizadas || 0;
      });

      const somaPonderadaRetrasado = (almasRetrasado * 5) + (reconciliacoesRetrasado * 4) + (batismosRetrasado * 4) + (visitantesRetrasado * 2) + (evangelismosRetrasado * 2) + (visitasRetrasado * 1);

      let tendencia: 'Crescimento' | 'Estabilidade' | 'Queda' = 'Estabilidade';
      if (somaPonderada > somaPonderadaAnterior && somaPonderadaAnterior >= somaPonderadaRetrasado) {
        tendencia = 'Crescimento';
      } else if (somaPonderada < somaPonderadaAnterior && somaPonderadaAnterior <= somaPonderadaRetrasado) {
        tendencia = 'Queda';
      } else {
        const diff = somaPonderada - somaPonderadaAnterior;
        if (diff > 5) tendencia = 'Crescimento';
        else if (diff < -5) tendencia = 'Queda';
      }

      let semaforo: 'Excelente' | 'Atenção' | 'Crítico' = 'Atenção';
      if (somaPonderada === 0) {
        semaforo = 'Crítico';
      } else if (ise >= 65 || (ise >= 45 && tendencia === 'Crescimento')) {
        semaforo = 'Excelente';
      } else if (ise < 25 || (ise < 40 && tendencia === 'Queda')) {
        semaforo = 'Crítico';
      }

      return {
        id: l.id,
        nome: l.nome,
        almas,
        reconciliacoes,
        visitantes,
        batismos,
        evangelismos,
        visitas,
        somaPonderada,
        somaPonderadaAnterior,
        ise,
        variacaoIse,
        tendencia,
        semaforo
      };
    });
  }, [locais, registrosMesAtual, registrosMesAnterior, registros, dashMes, dashAno]);

  // Ranking ordenado dinamicamente
  const rankingOrdenado = useMemo(() => {
    return [...congregacoesAnaliticas].sort((a, b) => {
      if (rankingSortKey === 'ise') return b.ise - a.ise;
      if (rankingSortKey === 'almas') return b.almas - a.almas;
      if (rankingSortKey === 'visitantes') return b.visitantes - a.visitantes;
      if (rankingSortKey === 'evangelismos') return b.evangelismos - a.evangelismos;
      if (rankingSortKey === 'reconciliacoes') return b.reconciliacoes - a.reconciliacoes;
      return b.batismos - a.batismos;
    });
  }, [congregacoesAnaliticas, rankingSortKey]);

  // Destaques do Período
  const destaques = useMemo(() => {
    const defaultDestaque = { nome: 'Sem registros', valor: 0 };
    
    const topCrescimento = [...congregacoesAnaliticas]
      .filter(c => c.somaPonderada > 0)
      .sort((a, b) => b.variacaoIse - a.variacaoIse)[0];

    const topEvangelistica = [...congregacoesAnaliticas].sort((a, b) => b.visitantes - a.visitantes)[0];
    const topMissionaria = [...congregacoesAnaliticas].sort((a, b) => b.evangelismos - a.evangelismos)[0];
    const topFrutifera = [...congregacoesAnaliticas].sort((a, b) => b.almas - a.almas)[0];
    
    const topQueda = [...congregacoesAnaliticas]
      .filter(c => c.somaPonderadaAnterior > 0)
      .sort((a, b) => a.variacaoIse - b.variacaoIse)[0];

    return {
      destaque: topCrescimento && topCrescimento.variacaoIse > 0 ? { nome: topCrescimento.nome, valor: `${topCrescimento.variacaoIse.toFixed(0)}%` } : defaultDestaque,
      evangelistica: topEvangelistica && topEvangelistica.visitantes > 0 ? { nome: topEvangelistica.nome, valor: topEvangelistica.visitantes } : defaultDestaque,
      missionaria: topMissionaria && topMissionaria.evangelismos > 0 ? { nome: topMissionaria.nome, valor: topMissionaria.evangelismos } : defaultDestaque,
      frutifera: topFrutifera && topFrutifera.almas > 0 ? { nome: topFrutifera.nome, valor: topFrutifera.almas } : defaultDestaque,
      atencao: topQueda && topQueda.variacaoIse < 0 ? { nome: topQueda.nome, valor: `${topQueda.variacaoIse.toFixed(0)}%` } : defaultDestaque
    };
  }, [congregacoesAnaliticas]);

  // Projeção Anual
  const projecaoAnual = useMemo(() => {
    const registrosAno = registros.filter(r => {
      if (dashCongregacaoId && r.congregacao_id !== dashCongregacaoId) return false;
      const d = new Date(r.data_atividade);
      const m = d.getUTCMonth() + 1;
      const y = d.getUTCFullYear();
      return y === dashAno && m <= dashMes;
    });

    const mesesComRegistro = new Set<number>();
    registrosAno.forEach(r => {
      const d = new Date(r.data_atividade);
      mesesComRegistro.add(d.getUTCMonth() + 1);
    });

    const divisor = mesesComRegistro.size || 1;

    let almasTot = 0, visitantesTot = 0, reconciliacoesTot = 0, batismosTot = 0;
    registrosAno.forEach(r => {
      almasTot += r.almas_alcancadas || 0;
      visitantesTot += r.visitantes_presentes || 0;
      reconciliacoesTot += r.reconciliacoes || 0;
      batismosTot += r.batismos_espirito_santo || 0;
    });

    return {
      almas: Math.round((almasTot / divisor) * 12),
      visitantes: Math.round((visitantesTot / divisor) * 12),
      reconciliacoes: Math.round((reconciliacoesTot / divisor) * 12),
      batismos: Math.round((batismosTot / divisor) * 12),
      divisor
    };
  }, [registros, dashCongregacaoId, dashMes, dashAno]);

  // Heatmap
  const heatmapDados = useMemo(() => {
    return locais.map(l => {
      const colunasMeses = Array.from({ length: 12 }, (_, mesIdx) => {
        const m = mesIdx + 1;
        const regsMes = registros.filter(r => {
          if (r.congregacao_id !== l.id) return false;
          const d = new Date(r.data_atividade);
          return (d.getUTCMonth() + 1) === m && d.getUTCFullYear() === dashAno;
        });

        let almas = 0, recon = 0, bat = 0, visit = 0, evang = 0, visitas = 0;
        regsMes.forEach(r => {
          almas += r.almas_alcancadas || 0;
          recon += r.reconciliacoes || 0;
          bat += r.batismos_espirito_santo || 0;
          visit += r.visitantes_presentes || 0;
          evang += r.evangelismos_realizados || 0;
          visitas += r.visitas_realizadas || 0;
        });
        const soma = (almas * 5) + (recon * 4) + (bat * 4) + (visit * 2) + (evang * 2) + (visitas * 1);
        const intensidade = Math.min(100, Math.round((soma / 30) * 100));
        return { mes: m, ise: intensidade, somaRaw: soma };
      });

      return { id: l.id, nome: l.nome, meses: colunasMeses };
    });
  }, [locais, registros, dashAno]);

  // Evolução individual (Modal)
  const evolucaoDadosModal = useMemo(() => {
    if (!selectedCongregacaoEvolucao) return [];
    const dados = [];
    const baseDate = new Date(dashAno, dashMes - 1, 15);

    for (let i = 11; i >= 0; i--) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 15);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();

      let almas = 0, visitantes = 0, reconciliacoes = 0, batismos = 0, evangelismos = 0, visitas = 0;
      registros.forEach(r => {
        if (r.congregacao_id !== selectedCongregacaoEvolucao.id) return;
        const actDate = new Date(r.data_atividade);
        if (actDate.getUTCMonth() + 1 === m && actDate.getUTCFullYear() === y) {
          almas += r.almas_alcancadas || 0;
          visitantes += r.visitantes_presentes || 0;
          reconciliacoes += r.reconciliacoes || 0;
          batismos += r.batismos_espirito_santo || 0;
          evangelismos += r.evangelismos_realizados || 0;
          visitas += r.visitas_realizadas || 0;
        }
      });

      dados.push({
        mesAno: `${m.toString().padStart(2, '0')}/${y.toString().substring(2)}`,
        Almas: almas,
        Visitantes: visitantes,
        Reconciliacoes: reconciliacoes,
        Batismos: batismos,
        Evangelismos: evangelismos,
        Visitas: visitas
      });
    }
    return dados;
  }, [registros, selectedCongregacaoEvolucao, dashMes, dashAno]);

  // Consolidação por congregação calculada
  const consolidadoPorCongregacao = useMemo(() => {
    return locais.map(l => {
      let cultos = 0, almas = 0, batismos = 0, reconciliacoes = 0, visitantes = 0, visitas = 0, evangelismos = 0, cearam = 0;
      let ultimoEnvio: string | null = null;

      registrosMesAtual.forEach(r => {
        if (r.congregacao_id === l.id) {
          cultos += r.cultos_realizados || 0;
          almas += r.almas_alcancadas || 0;
          batismos += r.batismos_espirito_santo || 0;
          reconciliacoes += r.reconciliacoes || 0;
          visitantes += r.visitantes_presentes || 0;
          visitas += r.visitas_realizadas || 0;
          evangelismos += r.evangelismos_realizados || 0;
          cearam += r.membros_cearam || 0;
          
          if (!ultimoEnvio || new Date(r.data_atividade) > new Date(ultimoEnvio)) {
            ultimoEnvio = r.data_atividade;
          }
        }
      });

      return {
        congregacao_id: l.id,
        nome: l.nome,
        cultos,
        cearam,
        visitas,
        evangelismos,
        almas,
        batismos,
        reconciliacoes,
        visitantes,
        ultimo_envio: ultimoEnvio
      };
    });
  }, [locais, registrosMesAtual]);

  // --- MÉTODOS DE FECHAMENTO MENSAL E PENDÊNCIAS (SPRINT 10) ---

  const congregacoesComEnvio = useMemo(() => {
    return new Set(registrosMesAtual.map(r => r.congregacao_id).filter(Boolean));
  }, [registrosMesAtual]);

  const totalEnviados = useMemo(() => {
    return congregacoesComEnvio.size;
  }, [congregacoesComEnvio]);

  const totalPendentes = useMemo(() => {
    return Math.max(0, locais.length - totalEnviados);
  }, [locais, totalEnviados]);

  const listaPendentes = useMemo(() => {
    if (isLocalUser && ctx.congregacaoId) {
      const enviado = congregacoesComEnvio.has(ctx.congregacaoId);
      if (!enviado) {
        const local = locais.find(l => l.id === ctx.congregacaoId);
        return local ? [local] : [];
      }
      return [];
    }
    return locais.filter(l => !congregacoesComEnvio.has(l.id));
  }, [locais, congregacoesComEnvio, isLocalUser, ctx.congregacaoId]);

  const ultimaAtualizacao = useMemo(() => {
    if (registrosMesAtual.length === 0) return 'Nenhum registro lançado';
    const datas = registrosMesAtual.map(r => new Date(r.updated_at).getTime());
    const maxTime = Math.max(...datas);
    return new Date(maxTime).toLocaleString('pt-BR');
  }, [registrosMesAtual]);

  const handleCopiarLembrete = (nomeCongregacao: string) => {
    const msg = `A Paz do Senhor.\n\nA competência ${MESES_NOMES[dashMes - 1]}/${dashAno} ainda encontra-se pendente.\n\nSolicitamos o envio do Relatório Espiritual para que seja possível realizar o fechamento mensal.\n\nSecretaria Geral`;
    navigator.clipboard.writeText(msg);
    showNotification('success', 'Lembrete Copiado', `Lembrete de pendência para a congregação ${nomeCongregacao} copiado para a área de transferência!`);
  };

  // --- LÓGICA DE CADASTRO E LANÇAMENTO ---

  const incrementMetric = (field: keyof typeof EMPTY_FORM) => {
    if (fechamentoStatus === 'Fechada') return;
    setFormData(prev => ({ ...prev, [field]: (prev[field] as number) + 1 }));
  };

  const decrementMetric = (field: keyof typeof EMPTY_FORM) => {
    if (fechamentoStatus === 'Fechada') return;
    setFormData(prev => ({ ...prev, [field]: Math.max(0, (prev[field] as number) - 1) }));
  };

  const resetForm = () => {
    const mesStr = String(dashMes).padStart(2, '0');
    setFormData({
      ...EMPTY_FORM,
      congregacao_id: isLocalUser ? (ctx.congregacaoId || '') : '',
      data_atividade: `${dashAno}-${mesStr}-01`
    });
    setEditingId(null);
  };

  const startEdit = (reg: RelatorioEspiritualRegistro) => {
    if (fechamentoStatus === 'Fechada') {
      showNotification('warning', 'Bloqueado', 'Esta competência encontra-se fechada. Não é permitido editar registros.');
      return;
    }
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
    if (fechamentoStatus === 'Fechada') {
      showNotification('warning', 'Bloqueado', 'Esta competência encontra-se fechada. Não é permitido excluir registros.');
      return;
    }
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

    if (fechamentoStatus === 'Fechada') {
      showNotification('warning', 'Bloqueado', 'Esta competência encontra-se fechada. Lançamentos bloqueados.');
      return;
    }

    if (!formData.congregacao_id) {
      showNotification('warning', 'Alerta', 'Selecione uma congregação válida.');
      return;
    }

    // Validação rígida de isolamento de Competência
    const dAct = new Date(formData.data_atividade);
    const mAct = dAct.getUTCMonth() + 1;
    const yAct = dAct.getUTCFullYear();

    if (mAct !== dashMes || yAct !== dashAno) {
      showNotification('warning', 'Fora da Competência', `A data da atividade (${formatDate(formData.data_atividade)}) não pertence à competência selecionada no topo (${MESES_NOMES[dashMes - 1]}/${dashAno}). Corrija a data.`);
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
        {/* BLOCO VISUAL PÁGINA FECHADA (REFORÇO SPRINT 10) */}
        {fechamentoStatus === 'Fechada' && (
          <div className="bg-rose-50 border border-rose-250 p-5 rounded-2xl text-rose-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <Lock className="h-6 w-6 text-rose-700 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-wider">Competência Fechada</h4>
                <p className="text-xs font-semibold text-rose-650 mt-0.5">
                  Os relatórios de <strong>{MESES_NOMES[dashMes - 1]}/{dashAno}</strong> foram arquivados para visualização. Lançamentos e exclusões desabilitados.
                </p>
                {fechamentoInfo?.fechado_em && (
                  <div className="text-[10px] text-rose-500 font-bold mt-1 uppercase tracking-wide">
                    Fechado em: {new Date(fechamentoInfo.fechado_em).toLocaleString('pt-BR')} {fechamentoInfo.fechado_por ? `| Responsável: ${fechamentoInfo.fechado_por.substring(0, 8)}...` : ''}
                  </div>
                )}
              </div>
            </div>
            
            {(!isLocalUser || ['administrador', 'suporte', 'presidencia', 'secretaria'].includes(ctx.nivel as string)) && (
              <button
                onClick={handleReabrirCompetencia}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
              >
                <Unlock className="h-3.5 w-3.5" />
                Reabrir Competência
              </button>
            )}
          </div>
        )}

        {/* CABEÇALHO EXECUTIVO DA COMPETÊNCIA (SPRINT 10) */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-100 pb-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              {/* Seleção do Período */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Competência Selecionada
                </label>
                <div className="flex gap-2">
                  <select
                    value={dashMes}
                    onChange={e => setDashMes(parseInt(e.target.value))}
                    className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-slate-50 font-bold focus:bg-white transition cursor-pointer"
                  >
                    {MESES_NOMES.map((nome, index) => (
                      <option key={index + 1} value={index + 1}>{nome}</option>
                    ))}
                  </select>

                  <select
                    value={dashAno}
                    onChange={e => setDashAno(parseInt(e.target.value))}
                    className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-slate-50 font-bold focus:bg-white transition cursor-pointer"
                  >
                    <option value={2024}>2024</option>
                    <option value={2025}>2025</option>
                    <option value={2026}>2026</option>
                  </select>
                </div>
              </div>

              {/* Seleção da Congregação */}
              {!isLocalUser && (
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Congregação em Análise
                  </label>
                  <select
                    value={filtroCongregacao}
                    onChange={e => setFiltroCongregacao(e.target.value)}
                    className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-slate-50 font-bold focus:bg-white transition cursor-pointer min-w-[200px]"
                  >
                    <option value="">Visão Consolidada do Tenant</option>
                    {locais.map(l => (
                      <option key={l.id} value={l.id}>{l.nome}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Indicador Visual do Fechamento */}
              <div className="space-y-1">
                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Status da Competência
                </span>
                <div className="flex items-center gap-2 pt-1.5">
                  {loadingFechamento ? (
                    <span className="text-slate-400 text-xs font-bold animate-pulse">Sincronizando...</span>
                  ) : fechamentoStatus === 'Fechada' ? (
                    <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 border border-rose-100 rounded-full px-3 py-1 font-bold text-xs uppercase tracking-wide">
                      <Lock className="h-3.5 w-3.5" />
                      Competência Fechada
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-3 py-1 font-bold text-xs uppercase tracking-wide animate-pulse">
                      <Unlock className="h-3.5 w-3.5" />
                      Competência Aberta
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Ações Rápidas de Fechamento */}
            {fechamentoStatus === 'Aberta' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleFecharCompetencia}
                  disabled={loadingFechamento}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Lock className="h-3.5 w-3.5" />
                  Fechar Competência
                </button>
              </div>
            )}
          </div>

          {/* Cards de Metadados do Fechamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-1">
              <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Última Atualização</span>
              <strong className="block text-slate-700 font-extrabold text-sm">{ultimaAtualizacao}</strong>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-1">
              <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Cultos Consolidados</span>
              <strong className="block text-slate-700 font-extrabold text-sm">{somaAtual.cultos} cultos</strong>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-1">
              <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Congregações com Envio</span>
              <strong className="block text-slate-700 font-extrabold text-sm">{totalEnviados} de {locais.length}</strong>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-1">
              <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Congregações Pendentes</span>
              <strong className={`block font-extrabold text-sm ${totalPendentes > 0 ? 'text-amber-600 animate-pulse' : 'text-emerald-600'}`}>
                {totalPendentes} unidades
              </strong>
            </div>
          </div>
        </div>

        {/* Aviso: Competência vazia mas existem registros em outros meses */}
        {registrosMesAtual.length === 0 && registros.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-start gap-3">
            <span className="text-amber-500 text-xl mt-0.5">⚠️</span>
            <div>
              <p className="text-sm font-bold text-amber-800">
                Nenhum registro encontrado para {MESES_NOMES[dashMes - 1]}/{dashAno}.
              </p>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                Existem <strong>{registros.length} registro(s)</strong> em outras competências. Verifique se os cultos foram consolidados com a <strong>data correta</strong>:
                a competência de um culto é determinada pela data em que ele ocorreu.
                Um culto realizado em <strong>30/06/2026</strong> pertence à competência <strong>Junho/2026</strong>, não Julho/2026.
              </p>
            </div>
          </div>
        )}

        {/* ABA 1: DASHBOARD EXECUTIVO ANALÍTICO */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Linha 0 (Sprint 10): Checklist de Fechamento & Congregações Pendentes */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Checklist de Fechamento */}
              <div className="lg:col-span-1">
                <DashboardSection title="📋 Checklist de Fechamento">
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className={`h-4 w-4 ${somaAtual.cultos > 0 ? 'text-emerald-500' : 'text-slate-350'}`} />
                        <span className="text-xs font-bold text-slate-700">Cultos Consolidados</span>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${somaAtual.cultos > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {somaAtual.cultos > 0 ? 'Sim' : 'Nenhum'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className={`h-4 w-4 ${totalPendentes === 0 ? 'text-emerald-500' : 'text-slate-350'}`} />
                        <span className="text-xs font-bold text-slate-700">Relatórios Recebidos</span>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${totalPendentes === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {totalPendentes === 0 ? '100%' : `${totalEnviados}/${locais.length}`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2">
                        <AlertCircle className={`h-4 w-4 ${fechamentoStatus === 'Fechada' ? 'text-rose-500' : 'text-emerald-500'}`} />
                        <span className="text-xs font-bold text-slate-700">Status Competência</span>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${fechamentoStatus === 'Fechada' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {fechamentoStatus}
                      </span>
                    </div>

                    {fechamentoStatus === 'Aberta' && (
                      <p className="text-[10px] font-bold text-slate-400 text-center leading-relaxed">
                        {totalPendentes > 0 ? '⚠️ Solucione as pendências de envio das congregações para poder realizar o fechamento do mês com segurança.' : '✅ Tudo pronto! Todos os relatórios foram recebidos.'}
                      </p>
                    )}
                  </div>
                </DashboardSection>
              </div>

              {/* Congregações Pendentes */}
              <div className="lg:col-span-2">
                <DashboardSection title="🏢 Congregações Pendentes">
                  <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="max-h-[220px] overflow-y-auto">
                      {listaPendentes.length === 0 ? (
                        <div className="p-8 text-center text-xs font-semibold text-slate-400">
                          🎉 Nenhuma congregação pendente nesta competência!
                        </div>
                      ) : (
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-450 uppercase font-black tracking-wider">
                              <th className="px-5 py-3">Unidade / Congregação</th>
                              <th className="px-5 py-3 w-32">Status</th>
                              <th className="px-5 py-3 text-right">Cobrança</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                            {listaPendentes.map(l => (
                              <tr key={l.id} className="hover:bg-slate-55/30 transition">
                                <td className="px-5 py-3 font-extrabold text-slate-800">{l.nome}</td>
                                <td className="px-5 py-3">
                                  <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-full px-2 py-0.5 font-bold text-[9px] uppercase tracking-wide">
                                    Pendente
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-right">
                                  <button
                                    onClick={() => handleCopiarLembrete(l.nome)}
                                    className="p-1.5 text-[#062E6F] hover:bg-slate-100 rounded-lg transition inline-flex items-center gap-1 cursor-pointer font-bold text-[10px] uppercase border border-slate-200"
                                  >
                                    <ClipboardCopy className="h-3.5 w-3.5" />
                                    Copiar lembrete
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </DashboardSection>
              </div>
            </div>

            {/* Linha 1: KPIs & Comparativos */}
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

            {/* Linha 2: Evolução Mensal & Distribuição das Atividades */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

            {/* Linha 3: Ranking Inteligente, Painel de Saúde & Destaques */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <DashboardSection title="Ranking de Saúde & Desempenho Espiritual">
                  <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-2 items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Ordenar ranking por:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {([
                          { key: 'ise', label: 'Saúde (ISE)' },
                          { key: 'almas', label: 'Almas' },
                          { key: 'visitantes', label: 'Visitantes' },
                          { key: 'evangelismos', label: 'Evang.' },
                          { key: 'reconciliacoes', label: 'Recon.' },
                          { key: 'batismos', label: 'Batismo ES' }
                        ] as const).map(k => (
                          <button
                            key={k.key}
                            onClick={() => setRankingSortKey(k.key)}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase transition ${
                              rankingSortKey === k.key
                                ? 'bg-slate-900 text-white shadow-sm'
                                : 'bg-white border border-slate-200 text-slate-650 hover:bg-slate-100'
                            }`}
                          >
                            {k.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-slate-550 uppercase font-black tracking-wider">
                            <th className="px-5 py-3 text-center w-12">Pos</th>
                            <th className="px-5 py-3">Congregação</th>
                            <th className="px-5 py-3 text-center w-24">Semáforo</th>
                            <th className="px-5 py-3 text-center w-12">Tend.</th>
                            <th className="px-5 py-3 text-center w-40">Índice Saúde (ISE)</th>
                            <th className="px-5 py-3 text-right">Ficha</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                          {rankingOrdenado.map((c, i) => (
                            <tr
                              key={c.id}
                              onClick={() => setSelectedCongregacaoEvolucao({ id: c.id, nome: c.nome })}
                              className="hover:bg-slate-55/30 transition cursor-pointer group"
                            >
                              <td className="px-5 py-4 text-center font-black">
                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`}
                              </td>
                              <td className="px-5 py-4">
                                <div className="font-extrabold text-slate-800 text-sm group-hover:text-[#062E6F] transition">{c.nome}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Almas: <strong className="text-rose-600 font-bold">{c.almas}</strong> |
                                  Visitantes: <strong className="text-blue-600 font-bold">{c.visitantes}</strong> |
                                  Evang.: <strong className="text-slate-700 font-bold">{c.evangelismos}</strong>
                                </div>
                              </td>
                              <td className="px-5 py-4 text-center whitespace-nowrap">
                                {c.semaforo === 'Excelente' ? (
                                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2 py-0.5 font-bold text-[9px] uppercase tracking-wide">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Excelente
                                  </span>
                                ) : c.semaforo === 'Atenção' ? (
                                  <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-full px-2 py-0.5 font-bold text-[9px] uppercase tracking-wide">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    Atenção
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-100 rounded-full px-2 py-0.5 font-bold text-[9px] uppercase tracking-wide">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                    Crítico
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-4 text-center text-sm font-black whitespace-nowrap">
                                {c.tendencia === 'Crescimento' ? (
                                  <span className="text-emerald-600">⬈</span>
                                ) : c.tendencia === 'Queda' ? (
                                  <span className="text-rose-600">⬊</span>
                                ) : (
                                  <span className="text-slate-400">➡</span>
                                )}
                              </td>
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <span className="text-slate-800 font-extrabold text-sm w-8 shrink-0">{c.ise}</span>
                                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        c.ise >= 65 ? 'bg-emerald-500' :
                                        c.ise >= 25 ? 'bg-amber-500' : 'bg-rose-500'
                                      }`}
                                      style={{ width: `${c.ise}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-4 text-right">
                                <button className="text-[10px] font-black uppercase text-[#062E6F] hover:underline whitespace-nowrap">Ver Ficha</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </DashboardSection>
              </div>

              <div>
                <DashboardSection title="Destaques do Período">
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4.5">
                    <div className="p-4 bg-emerald-50/40 border border-emerald-100/50 rounded-xl space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-emerald-700 font-bold text-xs flex items-center gap-1.5">🏆 Congregação Destaque</span>
                        <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">{destaques.destaque.valor}</span>
                      </div>
                      <h4 className="font-extrabold text-slate-800 text-sm">{destaques.destaque.nome}</h4>
                      <p className="text-[10px] text-slate-500">Maior crescimento percentual do ISE.</p>
                    </div>

                    <div className="p-4 bg-blue-50/40 border border-blue-100/50 rounded-xl space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-blue-700 font-bold text-xs flex items-center gap-1.5">🔥 Congregação Evangelística</span>
                        <span className="text-[10px] font-black text-blue-800 bg-blue-100 px-2 py-0.5 rounded-md">{destaques.evangelistica.valor} visit.</span>
                      </div>
                      <h4 className="font-extrabold text-slate-800 text-sm">{destaques.evangelistica.nome}</h4>
                      <p className="text-[10px] text-slate-500">Maior número de visitantes atraídos nos cultos.</p>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-700 font-bold text-xs flex items-center gap-1.5">📢 Congregação Missionária</span>
                        <span className="text-[10px] font-black text-slate-800 bg-slate-205 px-2 py-0.5 rounded-md">{destaques.missionaria.valor} ações</span>
                      </div>
                      <h4 className="font-extrabold text-slate-800 text-sm">{destaques.missionaria.nome}</h4>
                      <p className="text-[10px] text-slate-500">Maior número de ações de evangelismo externo.</p>
                    </div>

                    <div className="p-4 bg-rose-50/40 border border-rose-100/50 rounded-xl space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-rose-700 font-bold text-xs flex items-center gap-1.5">❤️ Congregação Frutífera</span>
                        <span className="text-[10px] font-black text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md">{destaques.frutifera.valor} almas</span>
                      </div>
                      <h4 className="font-extrabold text-slate-800 text-sm">{destaques.frutifera.nome}</h4>
                      <p className="text-[10px] text-slate-500">Maior número de almas ganhas para Cristo.</p>
                    </div>

                    <div className="p-4 bg-rose-50/30 border border-rose-100/30 rounded-xl space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-rose-900 font-bold text-xs flex items-center gap-1.5">⚠️ Congregação em Atenção</span>
                        <span className="text-[10px] font-black text-rose-955 bg-rose-100 px-2 py-0.5 rounded-md">{destaques.atencao.valor}</span>
                      </div>
                      <h4 className="font-extrabold text-slate-800 text-sm">{destaques.atencao.nome}</h4>
                      <p className="text-[10px] text-slate-500">Maior redução percentual do ISE.</p>
                    </div>
                  </div>
                </DashboardSection>
              </div>
            </div>

            {/* Linha 4: Heatmap & Projeção Anual */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <DashboardSection title={`Mapa de Calor do Índice de Saúde Espiritual (Ano: ${dashAno})`}>
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <span>Linhas: Congregações | Colunas: Jan a Dez</span>
                      <div className="flex items-center gap-2">
                        <span>Menor ISE</span>
                        <div className="flex h-3 w-20 rounded bg-gradient-to-r from-slate-100 via-emerald-200 to-emerald-700" />
                        <span>Maior ISE</span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <div className="min-w-[600px] space-y-3">
                        {heatmapDados.map(row => (
                          <div key={row.id} className="flex items-center gap-2">
                            <span className="w-36 text-xs font-bold text-slate-700 truncate" title={row.nome}>{row.nome}</span>
                            <div className="flex gap-1.5 flex-1 justify-between">
                              {row.meses.map(col => (
                                <div
                                  key={col.mes}
                                  title={`${MESES_NOMES[col.mes - 1]}: ISE de ${col.ise}% (${col.somaRaw} pts)`}
                                  className="h-8 rounded-lg flex-1 flex items-center justify-center text-[9px] font-bold text-slate-700 transition duration-300 hover:scale-105 border border-slate-200/20"
                                  style={{
                                    backgroundColor: col.somaRaw === 0 ? '#F8FAFC' :
                                                     col.ise < 25 ? '#ECFDF5' :
                                                     col.ise < 55 ? '#A7F3D0' :
                                                     col.ise < 80 ? '#34D399' : '#047857',
                                    color: col.ise >= 55 ? '#FFFFFF' : '#334155'
                                  }}
                                >
                                  {col.somaRaw > 0 ? col.ise : '—'}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}

                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                          <span className="w-36" />
                          <div className="flex gap-1.5 flex-1 justify-between text-[10px] font-bold text-slate-400 text-center">
                            {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((m, idx) => (
                              <span key={idx} className="flex-1">{m}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </DashboardSection>
              </div>

              <div>
                <DashboardSection title="Projeção Acumulada do Ano">
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4.5 min-h-[300px]">
                    <div className="flex items-center gap-2 text-indigo-600 mb-1">
                      <Activity className="h-5 w-5" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Projeções Matemáticas (Jan a Dez)</span>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-500 leading-relaxed">
                      Estimativa de fechamento anual com base no histórico de {projecaoAnual.divisor} meses registrados in {dashAno}.
                    </p>

                    <div className="space-y-3.5">
                      <div className="flex justify-between items-center p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">🔥 Almas</span>
                        <strong className="text-sm font-black text-rose-600">{projecaoAnual.almas} vidas</strong>
                      </div>

                      <div className="flex justify-between items-center p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">👥 Visitantes</span>
                        <strong className="text-sm font-black text-blue-600">{projecaoAnual.visitantes} pessoas</strong>
                      </div>

                      <div className="flex justify-between items-center p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">🤝 Reconciliações</span>
                        <strong className="text-sm font-black text-emerald-600">{projecaoAnual.reconciliacoes} retornos</strong>
                      </div>

                      <div className="flex justify-between items-center p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">✨ Batismos ES</span>
                        <strong className="text-sm font-black text-rose-500">{projecaoAnual.batismos} batismos</strong>
                      </div>
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
            {fechamentoStatus === 'Fechada' ? (
              <div className="bg-rose-50 border border-rose-250 p-5 rounded-2xl text-rose-700 font-bold flex items-center gap-3">
                <Lock className="h-6 w-6 text-rose-600" />
                <div>
                  <h4 className="text-sm uppercase tracking-wide">Competência Fechada</h4>
                  <p className="text-xs font-medium text-rose-650 mt-1">
                    Esta competência ({MESES_NOMES[dashMes - 1]}/{dashAno}) encontra-se fechada. Não é permitido novos lançamentos ou alterações de registros.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-750 mb-1">{labelDivPrincipal} *</label>
                    <select
                      disabled={isLocalUser}
                      value={formData.congregacao_id}
                      onChange={e => setFormData(prev => ({ ...prev, congregacao_id: e.target.value }))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 shadow-sm focus:border-slate-500 focus:outline-none cursor-pointer"
                      required
                    >
                      <option value="">Selecione...</option>
                      {locais.map(l => (
                        <option key={l.id} value={l.id}>{l.nome}</option>
                      ))}
                    </select>
                  </div>

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

                  <div>
                    <label className="block text-sm font-semibold text-slate-750 mb-1">Tipo de Atividade *</label>
                    <select
                      value={formData.tipo_atividade}
                      onChange={e => setFormData(prev => ({ ...prev, tipo_atividade: e.target.value as any }))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 shadow-sm focus:border-slate-500 focus:outline-none cursor-pointer"
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-5 bg-slate-50 rounded-2xl border border-slate-100">
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
                          <button type="button" onClick={() => incrementMetric('cultos_realizados')} className="p-1 bg-slate-950 text-white hover:bg-slate-800 rounded"><Plus className="h-3 w-3" /></button>
                        </div>
                      </div>
                    </div>
                  )}

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
                          <button type="button" onClick={() => incrementMetric('visitas_realizadas')} className="p-1 bg-slate-950 text-white hover:bg-slate-800 rounded"><Plus className="h-3 w-3" /></button>
                        </div>
                      </div>
                    </div>
                  )}

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
                        <button type="button" onClick={() => incrementMetric('almas_alcancadas')} className="p-1 bg-slate-950 text-white hover:bg-slate-800 rounded"><Plus className="h-3 w-3" /></button>
                      </div>
                    </div>
                  </div>

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
                        <button type="button" onClick={() => incrementMetric('batismos_espirito_santo')} className="p-1 bg-slate-955 text-white hover:bg-slate-800 rounded"><Plus className="h-3 w-3" /></button>
                      </div>
                    </div>
                  </div>

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
                        <button type="button" onClick={() => incrementMetric('reconciliacoes')} className="p-1 bg-slate-950 text-white hover:bg-slate-800 rounded"><Plus className="h-3 w-3" /></button>
                      </div>
                    </div>
                  </div>
                </div>

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
                              <button type="button" onClick={() => incrementMetric('membros_cearam')} className="p-1.5 bg-slate-950 text-white hover:bg-slate-800 rounded-lg"><Plus className="h-3.5 w-3.5" /></button>
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
                              <button type="button" onClick={() => incrementMetric('visitantes_presentes')} className="p-1.5 bg-slate-950 text-white hover:bg-slate-800 rounded-lg"><Plus className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

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
            )}
          </DashboardSection>
        )}

        {/* ABA 3: REGISTROS ENVIADOS */}
        {activeTab === 'registros' && (
          <DashboardSection title="Registros Enviados">
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Tipo de Atividade</label>
                <select
                  value={filtroTipo}
                  onChange={e => setFiltroTipo(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none cursor-pointer"
                >
                  <option value="">Todos os tipos</option>
                  <option value="Culto">⛪ Culto</option>
                  <option value="Santa Ceia">🍇 Santa Ceia</option>
                  <option value="Visita">🏠 Visita</option>
                  <option value="Evangelismo">📢 Evangelismo</option>
                  <option value="Outro">📦 Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Status</label>
                <select
                  value={filtroStatus}
                  onChange={e => setFiltroStatus(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none cursor-pointer"
                >
                  <option value="">Todos os status</option>
                  <option value="Rascunho">Rascunho</option>
                  <option value="Enviado">Enviado</option>
                  <option value="Revisado">Revisado</option>
                </select>
              </div>

              <div className="flex items-end text-slate-500 font-bold text-xs pb-2 whitespace-nowrap">
                Filtros aplicados para a competência: <strong className="text-slate-800 ml-1">{MESES_NOMES[dashMes - 1]}/{dashAno}</strong>
              </div>
            </div>

            {registrosFiltrados.length === 0 ? (
              <DashboardEmptyState
                icon={FileText}
                title="Sem lançamentos espirituais"
                description="Nenhum relatório espiritual foi encontrado para os filtros aplicados nesta competência."
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
                        <tr key={r.id} className="hover:bg-slate-55/30 transition">
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
                              {fechamentoStatus === 'Aberta' ? (
                                <>
                                  <button
                                    onClick={() => startEdit(r)}
                                    className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => deleteRegistro(r.id)}
                                    className="p-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg transition cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">Competência Fechada</span>
                              )}
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
          <DashboardSection title={`Consolidação da Competência: ${MESES_NOMES[dashMes - 1]}/${dashAno}`}>
            {consolidadoPorCongregacao.length === 0 ? (
              <DashboardEmptyState
                icon={Users}
                title="Sem consolidações"
                description="Nenhum relatório foi lançado nesta competência ainda."
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
                        <tr key={c.congregacao_id || ''} className="hover:bg-slate-55/30 transition">
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

      {/* Modal: Evolução Detalhada da Congregação */}
      {selectedCongregacaoEvolucao && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-100 max-h-[90vh]">
            <div className="p-5 bg-gradient-to-r from-[#062E6F] to-[#154A92] flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Activity className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white uppercase tracking-wide">Ficha de Evolução Espiritual</h3>
                  <p className="text-blue-100 text-xs mt-0.5 font-semibold">Histórico detalhado da congregação: {selectedCongregacaoEvolucao.nome}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCongregacaoEvolucao(null)}
                className="p-1 rounded-lg text-blue-200 hover:bg-white/15 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 min-h-[300px]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-2">
                  <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider">Frutos: Almas & Reconciliados</h4>
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={evolucaoDadosModal}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#CBD5E1" />
                        <XAxis dataKey="mesAno" stroke="#64748B" fontSize={9} />
                        <YAxis stroke="#64748B" fontSize={9} />
                        <ChartTooltip />
                        <Line type="monotone" dataKey="Almas" stroke="#E11D48" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="Reconciliacoes" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-2">
                  <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider">Acolhimento: Visitantes & Visitas</h4>
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={evolucaoDadosModal}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#CBD5E1" />
                        <XAxis dataKey="mesAno" stroke="#64748B" fontSize={9} />
                        <YAxis stroke="#64748B" fontSize={9} />
                        <ChartTooltip />
                        <Line type="monotone" dataKey="Visitantes" stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="Visitas" stroke="#4F46E5" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-2 col-span-1 md:col-span-2">
                  <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider">Espiritualidade & Missões: Batismos ES & Evangelismos</h4>
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={evolucaoDadosModal}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#CBD5E1" />
                        <XAxis dataKey="mesAno" stroke="#64748B" fontSize={9} />
                        <YAxis stroke="#64748B" fontSize={9} />
                        <ChartTooltip />
                        <Line type="monotone" dataKey="Batismos" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="Evangelismos" stroke="#475569" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCongregacaoEvolucao(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer"
              >
                Fechar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Central de Coleta de Relatórios das Congregações */}
      {isCentralColetaOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-100 max-h-[85vh]">
            <div className="p-5 bg-gradient-to-r from-[#062E6F] to-[#154A92] flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Globe className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white uppercase tracking-wide">Central de Coleta Externa</h3>
                  <p className="text-blue-100 text-xs mt-0.5 font-semibold">Envio de relatórios espirituais sem necessidade de login no sistema</p>
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

            <div className="p-6 overflow-y-auto space-y-6 flex-1 min-h-[300px]">
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 text-xs font-semibold text-slate-700 flex gap-2.5">
                <Lightbulb className="h-5 w-5 text-amber-600 shrink-0" />
                <p className="leading-relaxed">
                  Gere links externos com QR Codes para que os líderes locais possam lançar os indicadores diretamente de seus celulares sem precisar de usuário/senha. Os dados caem diretamente na sua tela como rascunhos.
                </p>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Links de Coleta por Congregação</h4>
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

                        {statusToken?.is_active && (
                          <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Link ativo {statusToken.expires_at ? `(Expira em ${new Date(statusToken.expires_at).toLocaleDateString('pt-BR')})` : ''}
                          </div>
                        )}

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
