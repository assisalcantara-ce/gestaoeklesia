'use client';

import { useEffect, useMemo, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import NotificationModal from '@/components/NotificationModal';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import { Pencil, Trash2, Loader2, Church, Home, Flame, Calendar, Clock, CheckCircle2, Users, X, Link, Copy, Check, RefreshCw, QrCode, ClipboardList, BookCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import ExecutiveMetricCard from '@/components/dashboard/ExecutiveMetricCard';

interface LocalOption {
  id: string;
  nome: string;
}

interface CultoRegistro {
  id: string;
  ministry_id: string;
  congregacao_id: string;
  data_culto: string;
  horario_culto: string;
  tipo_culto: string;
  dirigente: string;
  pregador: string | null;
  observacoes: string | null;
  status: 'Aberto' | 'Encerrado' | 'Consolidado';
  // Campos de encerramento
  membros_presentes: number;
  visitantes_presentes: number;
  almas_alcancadas: number;
  reconciliacoes: number;
  batismos_espirito_santo: number;
  curas_divinas: number;
  biblias_doadas: number;
  literaturas_entregues: number;
  membros_cearam: number;
  observacoes_encerramento: string | null;
  encerrado_em: string | null;
  encerrado_por: string | null;
  // Referencia ao relatorio espiritual gerado (anti-duplicidade)
  relatorio_espiritual_id: string | null;
  created_at: string;
  updated_at: string;
  congregacoes?: {
    nome: string;
  } | null;
}

const TIPO_CULTO_OPTIONS = [
  'Culto de Doutrina',
  'Culto de Evangelismo',
  'Culto de Ensino',
  'Culto de Jovens',
  'Culto de Senhoras',
  'Culto de Oração',
  'Santa Ceia',
  'Culto Festivo',
  'Outro'
];

const STATUS_OPTIONS = [
  { value: 'Aberto', label: '📖 Aberto' },
  { value: 'Encerrado', label: '🔒 Encerrado' },
  { value: 'Consolidado', label: '✅ Consolidado' }
];

const EMPTY_FORM = {
  data_culto: new Date().toISOString().split('T')[0],
  horario_culto: '19:30',
  tipo_culto: 'Culto de Doutrina',
  dirigente: '',
  pregador: '',
  observacoes: '',
  status: 'Aberto' as 'Aberto' | 'Encerrado' | 'Consolidado',
  congregacao_id: ''
};

const TABS = [
  { id: 'cadastro', label: 'Registrar Culto' },
  { id: 'listagem', label: 'Histórico de Cultos' }
];

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
};

export default function CultosPage() {
  const { ctx, bloqueado } = useRequireModulo('gestao');
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState('cadastro');
  const [registros, setRegistros] = useState<CultoRegistro[]>([]);
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

  // Estados dinâmicos adicionais
  const [tiposCulto, setTiposCulto] = useState<string[]>(TIPO_CULTO_OPTIONS);
  const [showNovoTipoModal, setShowNovoTipoModal] = useState(false);
  const [novoTipoNome, setNovoTipoNome] = useState('');

  const [membrosSugestoes, setMembrosSugestoes] = useState<{ id: string; nome: string }[]>([]);
  const [showSugestoes, setShowSugestoes] = useState(false);

  // Estados da Recepção de Visitantes
  const [selectedCultoRecepcao, setSelectedCultoRecepcao] = useState<CultoRegistro | null>(null);
  const [visitantes, setVisitantes] = useState<any[]>([]);
  const [loadingVisitantes, setLoadingVisitantes] = useState(false);
  const [activeRecepcaoTab, setActiveRecepcaoTab] = useState<'lista' | 'form'>('lista');
  const [editingVisitanteId, setEditingVisitanteId] = useState<string | null>(null);
  const [visitanteForm, setVisitanteForm] = useState({
    nome: '',
    telefone: '',
    cidade: '',
    bairro: '',
    igreja_origem: '',
    primeira_visita: true,
    is_ministro: false,
    cargo_ministerial: 'Pastor',
    observacoes: ''
  });

  // Estados do Link da Recepção (token público por culto)
  const [cultoLink, setCultoLink] = useState<CultoRegistro | null>(null);

  // Estados do modal de Encerramento Oficial
  const EMPTY_ENCERRAMENTO = {
    membros_presentes: 0,
    visitantes_presentes: 0,
    almas_alcancadas: 0,
    reconciliacoes: 0,
    batismos_espirito_santo: 0,
    curas_divinas: 0,
    biblias_doadas: 0,
    literaturas_entregues: 0,
    membros_cearam: 0,
    observacoes_encerramento: ''
  };
  const [cultoEncerrar, setCultoEncerrar] = useState<CultoRegistro | null>(null);
  const [encerramentoForm, setEncerramentoForm] = useState(EMPTY_ENCERRAMENTO);
  const [loadingEncerramento, setLoadingEncerramento] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string>('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [loadingToken, setLoadingToken] = useState(false);
  const [cultoParaConsolidar, setCultoParaConsolidar] = useState<CultoRegistro | null>(null);

  const handleEncerrar = async () => {
    if (!cultoEncerrar || !ctx?.userId) return;
    setLoadingEncerramento(true);
    try {
      const { error } = await supabase
        .from('culto_registros')
        .update({
          ...encerramentoForm,
          status: 'Encerrado',
          encerrado_em: new Date().toISOString(),
          encerrado_por: ctx.userId
        })
        .eq('id', cultoEncerrar.id);

      if (error) throw error;

      // AuditLog
      try {
        await fetch('/api/v1/audit-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            acao: 'editar',
            modulo: 'Cultos',
            area: 'Secretaria',
            tabela_afetada: 'culto_registros',
            registro_id: cultoEncerrar.id,
            descricao: `Culto encerrado: ${cultoEncerrar.tipo_culto} em ${formatDate(cultoEncerrar.data_culto)}`,
            dados_novos: { status: 'Encerrado', ...encerramentoForm }
          })
        });
      } catch { /* audit não bloqueia operação */ }
      showNotification('success', 'Sucesso', 'Culto encerrado com êxito.');
      setCultoEncerrar(null);
      setEncerramentoForm(EMPTY_ENCERRAMENTO);
      loadRegistros();
    } catch (err) {
      console.error(err);
      showNotification('error', 'Erro', 'Erro ao encerrar culto.');
    } finally {
      setLoadingEncerramento(false);
    }
  };

  // Auto-fill: ao abrir o modal de encerramento, busca a quantidade de visitantes cadastrados
  useEffect(() => {
    if (!cultoEncerrar) {
      setEncerramentoForm(EMPTY_ENCERRAMENTO);
      return;
    }
    const fetchVisitantesCount = async () => {
      const { count } = await supabase
        .from('culto_visitantes')
        .select('id', { count: 'exact', head: true })
        .eq('culto_id', cultoEncerrar.id);
      setEncerramentoForm(prev => ({
        ...prev,
        visitantes_presentes: count ?? 0
      }));
    };
    fetchVisitantesCount();
  }, [cultoEncerrar]);

  const loadVisitantes = async (cultoId: string) => {
    setLoadingVisitantes(true);
    try {
      const { data, error } = await supabase
        .from('culto_visitantes')
        .select('*')
        .eq('culto_id', cultoId)
        .order('nome', { ascending: true });

      if (!error && data) {
        setVisitantes(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingVisitantes(false);
    }
  };

  // Busca dinâmica de membros para o input Dirigente
  const handleSearchMembros = async (search: string) => {
    setFormData(prev => ({ ...prev, dirigente: search }));
    if (!ctx?.ministryId || search.trim().length < 2) {
      setMembrosSugestoes([]);
      setShowSugestoes(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('members')
        .select('id, name')
        .eq('ministry_id', ctx.ministryId)
        .ilike('name', `%${search}%`)
        .limit(6);
      if (!error && data) {
        // Mapeia name para nome para compatibilidade com o JSX do autocomplete
        const mapped = data.map((m: any) => ({ id: m.id, nome: m.name }));
        setMembrosSugestoes(mapped);
        setShowSugestoes(mapped.length > 0);
      } else {
        setMembrosSugestoes([]);
        setShowSugestoes(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddNovoTipo = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomeLimpo = novoTipoNome.trim();
    if (!nomeLimpo || !ctx?.ministryId) return;

    try {
      await supabase
        .from('culto_categorias')
        .insert({ ministry_id: ctx.ministryId, nome: nomeLimpo });
    } catch (err) {
      console.error(err);
    }

    if (!tiposCulto.includes(nomeLimpo)) {
      setTiposCulto(prev => {
        const novos = [...prev];
        // Insere antes do 'Outro'
        novos.splice(novos.length - 1, 0, nomeLimpo);
        return novos;
      });
    }
    setFormData(prev => ({ ...prev, tipo_culto: nomeLimpo }));
    setNovoTipoNome('');
    setShowNovoTipoModal(false);
  };

  const handleRemoveTipo = async (tipo: string) => {
    if (TIPO_CULTO_OPTIONS.includes(tipo)) return; // Não remove nativos
    if (!ctx?.ministryId) return;
    try {
      await supabase
        .from('culto_categorias')
        .delete()
        .eq('ministry_id', ctx.ministryId)
        .eq('nome', tipo);
    } catch (err) {
      console.error(err);
    }
    setTiposCulto(prev => prev.filter(t => t !== tipo));
    setFormData(prev => ({ ...prev, tipo_culto: TIPO_CULTO_OPTIONS[0] }));
  };

  const loadCategorias = async () => {
    if (!ctx?.ministryId) return;
    try {
      const { data, error } = await supabase
        .from('culto_categorias')
        .select('nome')
        .eq('ministry_id', ctx.ministryId)
        .order('nome', { ascending: true });
      if (!error && data) {
        const nomes = data.map((c: any) => c.nome);
        setTiposCulto(prev => {
          const uniqueTypes = Array.from(new Set([...prev, ...nomes]));
          const semOutro = uniqueTypes.filter(t => t !== 'Outro');
          return [...semOutro, 'Outro'];
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedCultoRecepcao) {
      loadVisitantes(selectedCultoRecepcao.id);
      setActiveRecepcaoTab('lista');
      setEditingVisitanteId(null);
      setVisitanteForm({
        nome: '',
        telefone: '',
        cidade: '',
        bairro: '',
        igreja_origem: '',
        primeira_visita: true,
        is_ministro: false,
        cargo_ministerial: 'Pastor',
        observacoes: ''
      });
    }
  }, [selectedCultoRecepcao]);

  // Gera ou regenera o token público para um culto (expira em 24h)
  const gerarTokenCulto = async (culto: CultoRegistro, regenerar = false) => {
    if (!ctx?.ministryId) return;
    setLoadingToken(true);
    setLinkUrl('');
    try {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      if (regenerar) {
        // Exclui token existente para forçar novo
        await supabase
          .from('culto_tokens')
          .delete()
          .eq('culto_id', culto.id);
      }

      // Tenta inserir novo token
      const { data, error } = await supabase
        .from('culto_tokens')
        .insert({
          ministry_id: ctx.ministryId,
          culto_id: culto.id,
          is_active: true,
          expires_at: expiresAt
        })
        .select('token')
        .single();

      let tokenValue: string | null = null;

      if (error) {
        // Já existe — busca o token atual
        const { data: existing } = await supabase
          .from('culto_tokens')
          .select('token, expires_at')
          .eq('culto_id', culto.id)
          .single();
        tokenValue = existing?.token ?? null;
      } else {
        tokenValue = data?.token ?? null;
      }

      if (tokenValue) {
        const url = `${window.location.origin}/formularios/cultos/${tokenValue}`;
        setLinkUrl(url);
      }
    } catch (err) {
      console.error(err);
      showNotification('error', 'Erro', 'Não foi possível gerar o link de recepção.');
    } finally {
      setLoadingToken(false);
    }
  };

  // Ao abrir o modal de link, carrega token existente automaticamente
  useEffect(() => {
    if (cultoLink) {
      gerarTokenCulto(cultoLink, false);
    } else {
      setLinkUrl('');
      setLinkCopied(false);
    }
  }, [cultoLink]);


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

  const showNotification = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
    setModalNotify({ isOpen: true, type, title, message });
  };

  const isLocalUser = useMemo(() => {
    if (!ctx) return true;
    return (ctx.nivel as string) === 'secretario_local' || (ctx.nivel as string) === 'tesoureiro_local';
  }, [ctx]);

  const isEscritaPermitida = useMemo(() => {
    if (!ctx) return false;
    return ['administrador', 'suporte', 'secretaria', 'secretario_local', 'presidencia'].includes(ctx.nivel as string);
  }, [ctx]);

  // Carregar congregações
  useEffect(() => {
    const loadLocais = async () => {
      if (!ctx?.ministryId) return;
      try {
        const { data, error } = await supabase
          .from('congregacoes')
          .select('id, nome')
          .eq('ministry_id', ctx.ministryId)
          .order('nome', { ascending: true });

        if (!error && data) {
          setLocais(data as LocalOption[]);
          // Definir congregação padrão no form
          if (isLocalUser && ctx?.congregacaoId) {
            setFormData(prev => ({ ...prev, congregacao_id: ctx.congregacaoId || '' }));
          } else if (data.length > 0) {
            setFormData(prev => ({ ...prev, congregacao_id: data[0].id }));
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

    if (!ctx?.loading && ctx?.ministryId) {
      loadLocais();
    }
  }, [ctx?.loading, ctx?.ministryId, ctx?.congregacaoId, isLocalUser, supabase]);

  // Carregar Registros de Cultos
  const loadRegistros = async () => {
    if (!ctx?.ministryId) return;
    setLoadingData(true);

    try {
      let query = supabase
        .from('culto_registros')
        .select(`
          *,
          congregacoes ( nome )
        `)
        .eq('ministry_id', ctx.ministryId);

      if (isLocalUser && ctx?.congregacaoId) {
        query = query.eq('congregacao_id', ctx.congregacaoId);
      }

      const { data, error } = await query.order('data_culto', { ascending: false }).order('horario_culto', { ascending: false });

      if (error) {
        showNotification('error', 'Erro', 'Erro ao carregar os registros de cultos.');
      } else {
        const list = (data || []) as CultoRegistro[];
        setRegistros(list);

        // Extrair categorias de cultos salvas no banco que não são nativas
        const customTypes = list
          .map(r => r.tipo_culto)
          .filter(tipo => tipo && !TIPO_CULTO_OPTIONS.includes(tipo));
        
        if (customTypes.length > 0) {
          setTiposCulto(prev => {
            const uniqueTypes = Array.from(new Set([...prev, ...customTypes]));
            // Garante que 'Outro' fique sempre no final, se existir
            const semOutro = uniqueTypes.filter(t => t !== 'Outro');
            return [...semOutro, 'Outro'];
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!ctx?.loading && ctx?.ministryId) {
      loadRegistros();
      loadCategorias();
    }
  }, [ctx?.loading, ctx?.ministryId, ctx?.congregacaoId, isLocalUser]);

  // Filtragem local de registros
  const registrosFiltrados = useMemo(() => {
    return registros.filter(r => {
      if (filtroCongregacao && r.congregacao_id !== filtroCongregacao) return false;
      if (filtroTipo && r.tipo_culto !== filtroTipo) return false;
      if (filtroStatus && r.status !== filtroStatus) return false;
      if (filtroDataInicio && r.data_culto < filtroDataInicio) return false;
      if (filtroDataFim && r.data_culto > filtroDataFim) return false;
      return true;
    });
  }, [registros, filtroCongregacao, filtroTipo, filtroStatus, filtroDataInicio, filtroDataFim]);

  // KPIs
  const kpis = useMemo(() => {
    const filtered = registrosFiltrados;
    return {
      total: filtered.length,
      abertos: filtered.filter(r => r.status === 'Aberto').length,
      encerrados: filtered.filter(r => r.status === 'Encerrado').length,
      consolidados: filtered.filter(r => r.status === 'Consolidado').length
    };
  }, [registrosFiltrados]);

  // Salvar / Editar
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEscritaPermitida) {
      showNotification('warning', 'Acesso Negado', 'Você não tem permissão para salvar registros de cultos.');
      return;
    }

    if (!formData.data_culto) {
      showNotification('warning', 'Campo Obrigatório', 'A data do culto é obrigatória.');
      return;
    }
    if (!formData.horario_culto) {
      showNotification('warning', 'Campo Obrigatório', 'O horário do culto é obrigatório.');
      return;
    }
    if (!formData.dirigente.trim()) {
      showNotification('warning', 'Campo Obrigatório', 'O dirigente é obrigatório.');
      return;
    }

    setLoadingData(true);
    try {
      const payload = {
        ministry_id: ctx?.ministryId,
        congregacao_id: isLocalUser ? ctx?.congregacaoId : formData.congregacao_id,
        data_culto: formData.data_culto,
        horario_culto: formData.horario_culto,
        tipo_culto: formData.tipo_culto,
        dirigente: formData.dirigente.trim(),
        pregador: formData.pregador.trim() || null,
        observacoes: formData.observacoes.trim() || null,
        status: formData.status,
        usuario_responsavel: ctx?.userId
      };

      if (editingId) {
        const { error } = await supabase
          .from('culto_registros')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;
        showNotification('success', 'Sucesso', 'Culto atualizado com sucesso.');
      } else {
        const { error } = await supabase
          .from('culto_registros')
          .insert(payload);

        if (error) throw error;
        showNotification('success', 'Sucesso', 'Culto registrado com sucesso.');
      }

      setFormData({
        ...EMPTY_FORM,
        congregacao_id: isLocalUser && ctx?.congregacaoId ? ctx.congregacaoId : (locais[0]?.id || '')
      });
      setEditingId(null);
      await loadRegistros();
      setActiveTab('listagem');
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Erro', 'Erro ao salvar o registro de culto: ' + err.message);
    } finally {
      setLoadingData(false);
    }
  };

  const handleEdit = (reg: CultoRegistro) => {
    setEditingId(reg.id);
    setFormData({
      data_culto: reg.data_culto,
      horario_culto: reg.horario_culto.substring(0, 5),
      tipo_culto: reg.tipo_culto,
      dirigente: reg.dirigente,
      pregador: reg.pregador || '',
      observacoes: reg.observacoes || '',
      status: reg.status,
      congregacao_id: reg.congregacao_id
    });
    setActiveTab('cadastro');
  };



  // Consolida culto encerrado no Relatório Espiritual (sem redigitação)
  const handleConsolidar = (culto: CultoRegistro) => {
    if (!isEscritaPermitida) {
      showNotification('warning', 'Acesso Negado', 'Permissão insuficiente.');
      return;
    }
    // Permite consolidar cultos Encerrados OU cultos Consolidados órfãos (sem relatorio_espiritual_id)
    const isOrfao = culto.status === 'Consolidado' && !culto.relatorio_espiritual_id;
    if (culto.status !== 'Encerrado' && !isOrfao) {
      showNotification('warning', 'Não Permitido', 'Apenas cultos encerrados (ou consolidados sem vínculo) podem ser consolidados.');
      return;
    }
    // Abre o modal de confirmação estilizado
    setCultoParaConsolidar(culto);
  };

  const confirmarConsolidacao = async () => {
    const culto = cultoParaConsolidar;
    if (!culto) return;
    setCultoParaConsolidar(null);
    setLoadingData(true);
    try {
      const isOrfao = culto.status === 'Consolidado' && !culto.relatorio_espiritual_id;

      // Verificar duplicidade: já existe registro espiritual vinculado a este culto?
      const { data: existing } = await supabase
        .from('relatorio_espiritual_registros')
        .select('id')
        .eq('culto_id', culto.id)
        .maybeSingle();

      if (existing && !isOrfao) {
        // Culto normal já consolidado: bloquear
        showNotification('warning', 'Já Consolidado', 'Este culto já possui um registro no Relatório Espiritual.');
        return;
      }

      if (existing && isOrfao) {
        // Culto órfão mas registro espiritual existe no banco (índice único sobreviveu):
        // Apenas reconectar o vínculo em culto_registros
        const { error: errLink } = await supabase
          .from('culto_registros')
          .update({ relatorio_espiritual_id: existing.id, updated_at: new Date().toISOString() })
          .eq('id', culto.id);
        if (errLink) throw errLink;
        showNotification('success', 'Vínculo Restaurado!', `O vínculo entre o culto e o Relatório Espiritual foi restaurado com sucesso.`);
        await loadRegistros();
        return;
      }

      // Mapear tipo do culto para tipo de atividade
      const tipoAtividade = culto.tipo_culto === 'Santa Ceia' ? 'Santa Ceia' : 'Culto';

      // Criar registro no Relatório Espiritual
      const { data: novoRegistro, error: errInsert } = await supabase
        .from('relatorio_espiritual_registros')
        .insert({
          ministry_id: culto.ministry_id,
          congregacao_id: culto.congregacao_id,
          culto_id: culto.id,
          data_atividade: culto.data_culto,
          tipo_atividade: tipoAtividade,
          cultos_realizados: 1,
          visitantes_presentes: culto.visitantes_presentes ?? 0,
          membros_cearam: culto.membros_cearam ?? 0,
          almas_alcancadas: culto.almas_alcancadas ?? 0,
          reconciliacoes: culto.reconciliacoes ?? 0,
          batismos_espirito_santo: culto.batismos_espirito_santo ?? 0,
          curas_divinas: culto.curas_divinas ?? 0,
          biblias_doadas: culto.biblias_doadas ?? 0,
          literaturas_entregues: culto.literaturas_entregues ?? 0,
          observacoes: culto.observacoes_encerramento ?? null,
          usuario_responsavel: ctx?.userId ?? null,
          status: 'Enviado'
        })
        .select('id')
        .single();

      if (errInsert) throw errInsert;

      // Atualizar status do culto para Consolidado e salvar referência ao relatório
      const { error: errUpdate } = await supabase
        .from('culto_registros')
        .update({
          status: 'Consolidado',
          relatorio_espiritual_id: novoRegistro?.id ?? null,
          updated_at: new Date().toISOString()
        })
        .eq('id', culto.id);

      if (errUpdate) throw errUpdate;

      // AuditLog
      try {
        await fetch('/api/v1/audit-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            acao: 'editar',
            modulo: 'Cultos',
            area: 'Secretaria',
            tabela_afetada: 'culto_registros',
            registro_id: culto.id,
            descricao: isOrfao
              ? `Culto reconsolidado no Relatório Espiritual (vínculo restaurado): ${culto.tipo_culto} em ${formatDate(culto.data_culto)}`
              : `Culto consolidado no Relatório Espiritual: ${culto.tipo_culto} em ${formatDate(culto.data_culto)}`,
            dados_novos: { status: 'Consolidado', relatorio_espiritual_id: novoRegistro?.id }
          })
        });
      } catch { /* audit não bloqueia */ }

      showNotification('success', isOrfao ? 'Reconsolidado com Sucesso!' : 'Consolidado com Sucesso!', `O culto foi consolidado no Relatório Espiritual com status Enviado.`);
      await loadRegistros();
    } catch (err: any) {
      console.error('[Consolidação] Erro:', err);
      // Distinguir causas comuns de falha
      const msg = err?.message || '';
      const code = err?.code || '';
      if (code === '42501' || msg.includes('permission denied') || msg.includes('violates row-level security')) {
        showNotification('error', 'Permissão Negada', 'Você não tem permissão para criar registros no Relatório Espiritual. Verifique seu nível de acesso com o administrador.');
      } else if (code === '42703') {
        showNotification('error', 'Coluna Ausente', 'Erro de schema no banco de dados. Contate o suporte técnico.');
      } else if (code === '23503') {
        showNotification('error', 'Referência Inválida', 'Referência inválida ao banco de dados. Verifique se o culto está vinculado a um ministério e congregação válidos.');
      } else {
        showNotification('error', 'Erro', 'Erro ao consolidar: ' + (msg || 'Tente novamente.'));
      }
    } finally {
      setLoadingData(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isEscritaPermitida) {
      showNotification('warning', 'Acesso Negado', 'Permissão insuficiente.');
      return;
    }
    if (!confirm('Deseja realmente excluir este registro de culto? Esta ação não pode ser desfeita.')) return;

    setLoadingData(true);
    try {
      const { error } = await supabase
        .from('culto_registros')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showNotification('success', 'Removido', 'Registro de culto excluído com sucesso.');
      await loadRegistros();
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Erro', 'Erro ao excluir registro: ' + err.message);
    } finally {
      setLoadingData(false);
    }
  };

  const handleSaveVisitante = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCultoRecepcao) return;
    if (!isEscritaPermitida) {
      showNotification('warning', 'Acesso Negado', 'Permissão insuficiente.');
      return;
    }

    if (!visitanteForm.nome.trim()) {
      showNotification('warning', 'Campo Obrigatório', 'O nome do visitante é obrigatório.');
      return;
    }

    setLoadingVisitantes(true);
    try {
      const payload = {
        culto_id: selectedCultoRecepcao.id,
        ministry_id: selectedCultoRecepcao.ministry_id,
        congregacao_id: selectedCultoRecepcao.congregacao_id,
        nome: visitanteForm.nome.trim(),
        telefone: visitanteForm.telefone.trim() || null,
        cidade: visitanteForm.cidade.trim() || null,
        bairro: visitanteForm.bairro.trim() || null,
        igreja_origem: visitanteForm.igreja_origem.trim() || null,
        primeira_visita: visitanteForm.primeira_visita,
        is_ministro: visitanteForm.is_ministro,
        cargo_ministerial: visitanteForm.is_ministro ? visitanteForm.cargo_ministerial : null,
        observacoes: visitanteForm.observacoes.trim() || null
      };

      if (editingVisitanteId) {
        const { error } = await supabase
          .from('culto_visitantes')
          .update(payload)
          .eq('id', editingVisitanteId);

        if (error) throw error;
        showNotification('success', 'Sucesso', 'Visitante atualizado com sucesso.');
      } else {
        const { error } = await supabase
          .from('culto_visitantes')
          .insert(payload);

        if (error) throw error;
        showNotification('success', 'Sucesso', 'Visitante cadastrado com sucesso.');
      }

      setVisitanteForm({
        nome: '',
        telefone: '',
        cidade: '',
        bairro: '',
        igreja_origem: '',
        primeira_visita: true,
        is_ministro: false,
        cargo_ministerial: 'Pastor',
        observacoes: ''
      });
      setEditingVisitanteId(null);
      await loadVisitantes(selectedCultoRecepcao.id);
      setActiveRecepcaoTab('lista');
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Erro', 'Erro ao salvar visitante: ' + err.message);
    } finally {
      setLoadingVisitantes(false);
    }
  };

  const handleEditVisitante = (v: any) => {
    setEditingVisitanteId(v.id);
    setVisitanteForm({
      nome: v.nome,
      telefone: v.telefone || '',
      cidade: v.cidade || '',
      bairro: v.bairro || '',
      igreja_origem: v.igreja_origem || '',
      primeira_visita: v.primeira_visita,
      is_ministro: v.is_ministro,
      cargo_ministerial: v.cargo_ministerial || 'Pastor',
      observacoes: v.observacoes || ''
    });
    setActiveRecepcaoTab('form');
  };

  const handleDeleteVisitante = async (id: string) => {
    if (!selectedCultoRecepcao) return;
    if (!isEscritaPermitida) {
      showNotification('warning', 'Acesso Negado', 'Permissão insuficiente.');
      return;
    }
    if (!confirm('Deseja realmente remover este visitante do culto?')) return;

    setLoadingVisitantes(true);
    try {
      const { error } = await supabase
        .from('culto_visitantes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showNotification('success', 'Removido', 'Visitante removido do culto.');
      await loadVisitantes(selectedCultoRecepcao.id);
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Erro', 'Erro ao excluir visitante: ' + err.message);
    } finally {
      setLoadingVisitantes(false);
    }
  };

  if (bloqueado) {
    return (
      <PageLayout title="Acesso Negado" description="Módulo Cultos">
        <div className="p-8 text-center">
          <p className="text-red-500 font-bold">Você não tem permissão para acessar este módulo.</p>
        </div>
      </PageLayout>
    );
  }

  if (ctx?.loading) {
    return (
      <PageLayout title="Cultos" description="Carregando dados...">
        <div className="min-h-[50vh] flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Cultos" description="Gestão de registros operacionais de Cultos">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Cabeçalho */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">⛪</span>
              <h1 className="text-3xl font-bold text-slate-800">Operação de Cultos</h1>
            </div>
            <p className="text-slate-600">Registro histórico e gestão operacional dos cultos da igreja</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <ExecutiveMetricCard title="Total de Cultos" value={kpis.total} color="blue" icon={Church} />
          <ExecutiveMetricCard title="Cultos Abertos" value={kpis.abertos} color="slate" icon={Flame} />
          <ExecutiveMetricCard title="Cultos Encerrados" value={kpis.encerrados} color="indigo" icon={Home} />
          <ExecutiveMetricCard title="Consolidados" value={kpis.consolidados} color="emerald" icon={CheckCircle2} />
        </div>

        <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
          {activeTab === 'cadastro' && (
            <Section title={editingId ? 'Editar Culto' : 'Novo Registro de Culto'}>
              <form onSubmit={handleSave} className="space-y-6 max-w-3xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Congregação (Bloqueado para local) */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Congregação / Unidade *</label>
                    <select
                      disabled={isLocalUser || !!editingId}
                      value={isLocalUser ? (ctx?.congregacaoId || '') : formData.congregacao_id}
                      onChange={e => setFormData(prev => ({ ...prev, congregacao_id: e.target.value }))}
                      className="w-full border border-slate-350 rounded-xl px-3 py-2 text-sm bg-white"
                    >
                      {locais.map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.nome}</option>
                      ))}
                    </select>
                  </div>

                  {/* Tipo do Culto */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Tipo do Culto *</label>
                    <div className="flex gap-2">
                      <select
                        value={formData.tipo_culto}
                        onChange={e => setFormData(prev => ({ ...prev, tipo_culto: e.target.value }))}
                        className="flex-1 border border-slate-350 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500/20"
                      >
                        {tiposCulto.map(tipo => (
                          <option key={tipo} value={tipo}>{tipo}</option>
                        ))}
                      </select>
                      {!TIPO_CULTO_OPTIONS.includes(formData.tipo_culto) ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveTipo(formData.tipo_culto)}
                          className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-sm font-bold transition flex items-center justify-center cursor-pointer"
                          title="Remover tipo personalizado"
                        >
                          -
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowNovoTipoModal(true)}
                          className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-sm font-bold transition flex items-center justify-center cursor-pointer"
                          title="Adicionar tipo personalizado"
                        >
                          +
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Data do Culto */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Data *</label>
                    <input
                      type="date"
                      value={formData.data_culto}
                      onChange={e => setFormData(prev => ({ ...prev, data_culto: e.target.value }))}
                      className="w-full border border-slate-350 rounded-xl px-3 py-2 text-sm"
                      required
                    />
                  </div>

                  {/* Horário */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Horário *</label>
                    <input
                      type="time"
                      value={formData.horario_culto}
                      onChange={e => setFormData(prev => ({ ...prev, horario_culto: e.target.value }))}
                      className="w-full border border-slate-350 rounded-xl px-3 py-2 text-sm"
                      required
                    />
                  </div>

                  {/* Dirigente */}
                  <div className="relative">
                    <label className="block text-sm font-bold text-slate-700 mb-1">Dirigente do Trabalho *</label>
                    <input
                      type="text"
                      value={formData.dirigente}
                      onChange={e => handleSearchMembros(e.target.value)}
                      onFocus={() => {
                        if (membrosSugestoes.length > 0) setShowSugestoes(true);
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowSugestoes(false), 200);
                      }}
                      placeholder="Nome do dirigente"
                      className="w-full border border-slate-350 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20"
                      required
                      autoComplete="off"
                    />
                    {showSugestoes && (
                      <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {membrosSugestoes.map(m => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, dirigente: m.nome }));
                              setShowSugestoes(false);
                            }}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 text-xs font-semibold text-slate-750 transition"
                          >
                            👤 {m.nome}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pregador */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Ministrador / Pregador</label>
                    <input
                      type="text"
                      value={formData.pregador}
                      onChange={e => setFormData(prev => ({ ...prev, pregador: e.target.value }))}
                      placeholder="Nome do pregador (opcional)"
                      className="w-full border border-slate-350 rounded-xl px-3 py-2 text-sm"
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Status Operacional *</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                      className="w-full border border-slate-350 rounded-xl px-3 py-2 text-sm bg-white"
                    >
                      {STATUS_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Observações */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Observações / Resumo do Culto</label>
                  <textarea
                    rows={4}
                    value={formData.observacoes}
                    onChange={e => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                    placeholder="Resumo, decisões por Cristo, testemunhos marcantes ou observações administrativas..."
                    className="w-full border border-slate-350 rounded-xl px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={loadingData}
                    className="px-6 py-2.5 bg-[#062E6F] hover:bg-[#154A92] text-white rounded-xl font-bold text-sm shadow-md transition flex items-center gap-1 cursor-pointer disabled:opacity-55"
                  >
                    {loadingData && <Loader2 className="h-4 w-4 animate-spin" />}
                    {editingId ? 'Atualizar Culto' : 'Registrar Culto'}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setFormData({
                          ...EMPTY_FORM,
                          congregacao_id: isLocalUser && ctx?.congregacaoId ? ctx.congregacaoId : (locais[0]?.id || '')
                        });
                      }}
                      className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-755 rounded-xl font-bold text-sm transition"
                    >
                      Cancelar Edição
                    </button>
                  )}
                </div>
              </form>
            </Section>
          )}

          {activeTab === 'listagem' && (
            <Section title="Histórico de Cultos Registrados">
              {/* Filtros */}
              <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl mb-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                {/* Congregação (apenas para Admin) */}
                {!isLocalUser && (
                  <div>
                    <label className="block text-[11px] font-black text-slate-550 uppercase mb-1">Congregação</label>
                    <select
                      value={filtroCongregacao}
                      onChange={e => setFiltroCongregacao(e.target.value)}
                      className="w-full border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                    >
                      <option value="">Todas</option>
                      {locais.map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.nome}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Tipo de Culto */}
                <div>
                  <label className="block text-[11px] font-black text-slate-550 uppercase mb-1">Tipo</label>
                  <select
                    value={filtroTipo}
                    onChange={e => setFiltroTipo(e.target.value)}
                    className="w-full border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                  >
                    <option value="">Todos</option>
                    {TIPO_CULTO_OPTIONS.map(tipo => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-[11px] font-black text-slate-550 uppercase mb-1">Status</label>
                  <select
                    value={filtroStatus}
                    onChange={e => setFiltroStatus(e.target.value)}
                    className="w-full border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                  >
                    <option value="">Todos</option>
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Início */}
                <div>
                  <label className="block text-[11px] font-black text-slate-550 uppercase mb-1">Data Início</label>
                  <input
                    type="date"
                    value={filtroDataInicio}
                    onChange={e => setFiltroDataInicio(e.target.value)}
                    className="w-full border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs"
                  />
                </div>

                {/* Fim */}
                <div>
                  <label className="block text-[11px] font-black text-slate-550 uppercase mb-1">Data Fim</label>
                  <input
                    type="date"
                    value={filtroDataFim}
                    onChange={e => setFiltroDataFim(e.target.value)}
                    className="w-full border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>

              {/* Tabela */}
              <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-sm">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-xs">
                      <th className="p-3.5">Data/Horário</th>
                      {!isLocalUser && <th className="p-3.5">Congregação</th>}
                      <th className="p-3.5">Tipo</th>
                      <th className="p-3.5">Dirigente / Pregador</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {registrosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={isLocalUser ? 5 : 6} className="p-8 text-center text-slate-400 text-xs italic">
                          Nenhum registro de culto encontrado com os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      registrosFiltrados.map(reg => (
                        <tr key={reg.id} className="hover:bg-slate-50/50 transition">
                          <td className="p-3.5">
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-800 flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-slate-400" />
                                {formatDate(reg.data_culto)}
                              </span>
                              <span className="text-[10px] text-slate-400 flex items-center gap-0.5 mt-0.5">
                                <Clock className="h-2.5 w-2.5" />
                                {reg.horario_culto.substring(0, 5)}
                              </span>
                            </div>
                          </td>
                          {!isLocalUser && (
                            <td className="p-3.5 font-medium text-slate-700">
                              {reg.congregacoes?.nome || 'Unidade Geral'}
                            </td>
                          )}
                          <td className="p-3.5 font-bold text-[#062E6F]">{reg.tipo_culto}</td>
                          <td className="p-3.5">
                            <div className="flex flex-col text-xs">
                              <span className="font-medium text-slate-800">Dirigente: {reg.dirigente}</span>
                              {reg.pregador && (
                                <span className="text-slate-500 mt-0.5">Pregador: {reg.pregador}</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3.5">
                            {reg.status === 'Aberto' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-850">
                                Aberto
                              </span>
                            )}
                            {reg.status === 'Encerrado' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                                Encerrado
                              </span>
                            )}
                            {reg.status === 'Consolidado' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                Consolidado
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setSelectedCultoRecepcao(reg)}
                                className="px-2.5 py-1 bg-[#062E6F]/10 hover:bg-[#062E6F]/20 text-[#062E6F] rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                title="Recepção de Visitantes"
                              >
                                <Users className="h-3.5 w-3.5" />
                                Recepção
                              </button>
                              {reg.status === 'Aberto' && (
                                <button
                                  onClick={() => setCultoLink(reg)}
                                  className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                  title="Link Público da Recepção"
                                >
                                  <Link className="h-3.5 w-3.5" />
                                  Link
                                </button>
                              )}
                              {reg.status === 'Aberto' && isEscritaPermitida && (
                                <button
                                  onClick={() => setCultoEncerrar(reg)}
                                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                  title="Encerrar Culto"
                                >
                                  <ClipboardList className="h-3.5 w-3.5" />
                                  Encerrar
                                </button>
                              )}
                              {reg.status === 'Encerrado' && isEscritaPermitida && (
                                <button
                                  onClick={() => handleConsolidar(reg)}
                                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                  title="Consolidar no Relatório Espiritual"
                                >
                                  <BookCheck className="h-3.5 w-3.5" />
                                  Consolidar
                                </button>
                              )}

                              {isEscritaPermitida && (
                                <>
                                  <button
                                    onClick={() => handleEdit(reg)}
                                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                                    title="Editar"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(reg.id)}
                                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-rose-600 transition cursor-pointer"
                                    title="Excluir"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
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

      {/* Modal de Recepção de Visitantes */}
      {selectedCultoRecepcao && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden border border-slate-100">
            {/* Header */}
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Users className="h-5 w-5 text-[#062E6F]" />
                  Recepção de Visitantes
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Culto: <span className="font-bold text-[#062E6F]">{selectedCultoRecepcao.tipo_culto}</span> em <span className="font-bold">{formatDate(selectedCultoRecepcao.data_culto)}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedCultoRecepcao(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Abas Internas do Modal */}
            <div className="flex border-b border-slate-100 px-6 bg-slate-50/50">
              <button
                onClick={() => {
                  setActiveRecepcaoTab('lista');
                  setEditingVisitanteId(null);
                }}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  activeRecepcaoTab === 'lista'
                    ? 'border-[#062E6F] text-[#062E6F]'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Visitantes Presentes ({visitantes.length})
              </button>
              <button
                onClick={() => {
                  setActiveRecepcaoTab('form');
                  if (!editingVisitanteId) {
                    setVisitanteForm({
                      nome: '',
                      telefone: '',
                      cidade: '',
                      bairro: '',
                      igreja_origem: '',
                      primeira_visita: true,
                      is_ministro: false,
                      cargo_ministerial: 'Pastor',
                      observacoes: ''
                    });
                  }
                }}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  activeRecepcaoTab === 'form'
                    ? 'border-[#062E6F] text-[#062E6F]'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                {editingVisitanteId ? '🖊️ Editar Visitante' : '➕ Registrar Visitante'}
              </button>
            </div>

            {/* Conteúdo */}
            <div className="flex-1 p-6 overflow-y-auto">
              {loadingVisitantes ? (
                <div className="min-h-[30vh] flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              ) : activeRecepcaoTab === 'lista' ? (
                <div className="space-y-4">
                  {visitantes.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                      <Users className="h-10 w-10 text-slate-350 mx-auto mb-2" />
                      <p className="text-slate-400 text-sm italic">Nenhum visitante cadastrado para este culto.</p>
                      <button
                        onClick={() => setActiveRecepcaoTab('form')}
                        className="mt-3 text-xs font-bold text-[#062E6F] hover:underline"
                      >
                        Cadastrar o primeiro visitante
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-hidden border border-slate-100 rounded-xl">
                      <table className="w-full text-left border-collapse text-xs sm:text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-xs">
                            <th className="p-3">Visitante</th>
                            <th className="p-3">Contato / Localização</th>
                            <th className="p-3">Detalhes</th>
                            <th className="p-3 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {visitantes.map(v => (
                            <tr key={v.id} className="hover:bg-slate-50/50 transition">
                              <td className="p-3">
                                <div className="font-bold text-slate-800">{v.nome}</div>
                                {v.is_ministro && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 mt-1 rounded text-[10px] font-black bg-amber-100 text-amber-800">
                                    👑 Ministro: {v.cargo_ministerial}
                                  </span>
                                )}
                              </td>
                              <td className="p-3">
                                <div className="text-slate-650 font-medium">{v.telefone || 'Sem telefone'}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {v.bairro || 'S/ Bairro'}, {v.cidade || 'S/ Cidade'}
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="flex flex-col gap-1 text-[11px]">
                                  {v.primeira_visita ? (
                                    <span className="text-rose-700 font-semibold">📍 Primeira Visita</span>
                                  ) : (
                                    <span className="text-slate-500">📍 Já visitou antes</span>
                                  )}
                                  {v.igreja_origem && (
                                    <span className="text-slate-600 font-medium">Origem: {v.igreja_origem}</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleEditVisitante(v)}
                                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                                    title="Editar"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteVisitante(v.id)}
                                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-rose-600 transition cursor-pointer"
                                    title="Excluir"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSaveVisitante} className="space-y-6 max-w-3xl">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Nome */}
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Nome Completo *</label>
                      <input
                        type="text"
                        value={visitanteForm.nome}
                        onChange={e => setVisitanteForm(prev => ({ ...prev, nome: e.target.value }))}
                        placeholder="Nome do visitante"
                        className="w-full border border-slate-350 rounded-xl px-3 py-2 text-sm"
                        required
                      />
                    </div>

                    {/* Telefone */}
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Telefone / WhatsApp</label>
                      <input
                        type="text"
                        value={visitanteForm.telefone}
                        onChange={e => setVisitanteForm(prev => ({ ...prev, telefone: e.target.value }))}
                        placeholder="(00) 00000-0000"
                        className="w-full border border-slate-350 rounded-xl px-3 py-2 text-sm"
                      />
                    </div>

                    {/* Cidade */}
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Cidade</label>
                      <input
                        type="text"
                        value={visitanteForm.cidade}
                        onChange={e => setVisitanteForm(prev => ({ ...prev, cidade: e.target.value }))}
                        placeholder="Ex: São Paulo"
                        className="w-full border border-slate-350 rounded-xl px-3 py-2 text-sm"
                      />
                    </div>

                    {/* Bairro */}
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Bairro</label>
                      <input
                        type="text"
                        value={visitanteForm.bairro}
                        onChange={e => setVisitanteForm(prev => ({ ...prev, bairro: e.target.value }))}
                        placeholder="Ex: Centro"
                        className="w-full border border-slate-350 rounded-xl px-3 py-2 text-sm"
                      />
                    </div>

                    {/* Igreja de Origem */}
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Igreja de Origem</label>
                      <input
                        type="text"
                        value={visitanteForm.igreja_origem}
                        onChange={e => setVisitanteForm(prev => ({ ...prev, igreja_origem: e.target.value }))}
                        placeholder="Ex: Assembleia de Deus"
                        className="w-full border border-slate-350 rounded-xl px-3 py-2 text-sm"
                      />
                    </div>

                    {/* Primeira Visita (Checkbox/Switch) */}
                    <div className="flex items-center gap-3 pt-6">
                      <input
                        type="checkbox"
                        id="primeira_visita"
                        checked={visitanteForm.primeira_visita}
                        onChange={e => setVisitanteForm(prev => ({ ...prev, primeira_visita: e.target.checked }))}
                        className="h-4 w-4 text-blue-600 border-slate-300 rounded"
                      />
                      <label htmlFor="primeira_visita" className="text-sm font-bold text-slate-700 cursor-pointer">
                        É a primeira visita deste irmão?
                      </label>
                    </div>

                    {/* É Ministro? */}
                    <div className="flex items-center gap-3 pt-6">
                      <input
                        type="checkbox"
                        id="is_ministro"
                        checked={visitanteForm.is_ministro}
                        onChange={e => setVisitanteForm(prev => ({ ...prev, is_ministro: e.target.checked }))}
                        className="h-4 w-4 text-blue-600 border-slate-300 rounded"
                      />
                      <label htmlFor="is_ministro" className="text-sm font-bold text-slate-700 cursor-pointer">
                        É Ministro / Oficial?
                      </label>
                    </div>

                    {/* Cargo Ministerial */}
                    {visitanteForm.is_ministro && (
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Cargo Ministerial</label>
                        <select
                          value={visitanteForm.cargo_ministerial}
                          onChange={e => setVisitanteForm(prev => ({ ...prev, cargo_ministerial: e.target.value }))}
                          className="w-full border border-slate-350 rounded-xl px-3 py-2 text-sm bg-white"
                        >
                          <option value="Pastor">Pastor</option>
                          <option value="Evangelista">Evangelista</option>
                          <option value="Presbítero">Presbítero</option>
                          <option value="Diácono">Diácono</option>
                          <option value="Missionário">Missionário</option>
                          <option value="Outro">Outro</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Observações */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Observações Administrativas</label>
                    <textarea
                      rows={3}
                      value={visitanteForm.observacoes}
                      onChange={e => setVisitanteForm(prev => ({ ...prev, observacoes: e.target.value }))}
                      placeholder="Observações administrativas ou pedidos de oração informados..."
                      className="w-full border border-slate-350 rounded-xl px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={loadingVisitantes}
                      className="px-5 py-2 bg-[#062E6F] hover:bg-[#154A92] text-white rounded-xl font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-55"
                    >
                      {loadingVisitantes && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {editingVisitanteId ? 'Atualizar Dados' : 'Registrar Visitante'}
                    </button>
                    {editingVisitanteId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingVisitanteId(null);
                          setVisitanteForm({
                            nome: '',
                            telefone: '',
                            cidade: '',
                            bairro: '',
                            igreja_origem: '',
                            primeira_visita: true,
                            is_ministro: false,
                            cargo_ministerial: 'Pastor',
                            observacoes: ''
                          });
                          setActiveRecepcaoTab('lista');
                        }}
                        className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-750 rounded-xl font-bold text-xs transition cursor-pointer"
                      >
                        Cancelar Edição
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedCultoRecepcao(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition cursor-pointer"
              >
                Fechar Recepção
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Encerramento Oficial do Culto */}
      {cultoEncerrar && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-slate-100">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-indigo-600 to-indigo-700 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Encerramento Oficial do Culto
                </h3>
                <p className="text-xs text-indigo-200 mt-0.5">
                  {cultoEncerrar.tipo_culto} · {formatDate(cultoEncerrar.data_culto)} · {cultoEncerrar.horario_culto}
                </p>
              </div>
              <button onClick={() => setCultoEncerrar(null)} className="p-1.5 rounded-lg text-indigo-200 hover:bg-indigo-500 transition cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Conteúdo rolável */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* Participação */}
              <div>
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Participação</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Membros Presentes</label>
                    <input
                      type="number" min={0}
                      value={encerramentoForm.membros_presentes}
                      onChange={e => setEncerramentoForm(prev => ({ ...prev, membros_presentes: Math.max(0, +e.target.value) }))}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      Visitantes Presentes
                      <span className="text-xs text-indigo-500 font-normal ml-1">(auto-preenchido pela Recepção)</span>
                    </label>
                    <input
                      type="number" min={0}
                      value={encerramentoForm.visitantes_presentes}
                      onChange={e => setEncerramentoForm(prev => ({ ...prev, visitantes_presentes: Math.max(0, +e.target.value) }))}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                </div>
              </div>

              {/* Resultados Espirituais */}
              <div>
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Resultados Espirituais</h4>
                <div className="grid grid-cols-2 gap-4">
                  {([
                    { key: 'almas_alcancadas', label: 'Almas Alcançadas' },
                    { key: 'reconciliacoes', label: 'Reconciliações' },
                    { key: 'batismos_espirito_santo', label: 'Batismos c/ Espírito Santo' },
                    { key: 'curas_divinas', label: 'Curas Divinas' },
                    { key: 'biblias_doadas', label: 'Bíblias Doadas' },
                    { key: 'literaturas_entregues', label: 'Literaturas Entregues' },
                  ] as { key: keyof typeof encerramentoForm, label: string }[]).map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-sm font-bold text-slate-700 mb-1">{label}</label>
                      <input
                        type="number" min={0}
                        value={encerramentoForm[key] as number}
                        onChange={e => setEncerramentoForm(prev => ({ ...prev, [key]: Math.max(0, +e.target.value) }))}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Santa Ceia — só exibe se for Santa Ceia */}
              {cultoEncerrar.tipo_culto === 'Santa Ceia' && (
                <div>
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Santa Ceia</h4>
                  <div className="max-w-xs">
                    <label className="block text-sm font-bold text-slate-700 mb-1">Membros que Cearam</label>
                    <input
                      type="number" min={0}
                      value={encerramentoForm.membros_cearam}
                      onChange={e => setEncerramentoForm(prev => ({ ...prev, membros_cearam: Math.max(0, +e.target.value) }))}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                </div>
              )}

              {/* Observações */}
              <div>
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Observações Finais</h4>
                <textarea
                  rows={3}
                  value={encerramentoForm.observacoes_encerramento}
                  onChange={e => setEncerramentoForm(prev => ({ ...prev, observacoes_encerramento: e.target.value }))}
                  placeholder="Registre ocorrências, destaques ou informações relevantes do culto..."
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                  maxLength={1000}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
              <p className="text-[10px] text-slate-400">
                Esta ação alterará o status para <strong>Encerrado</strong> e registrará a data/hora e o responsável.
              </p>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setCultoEncerrar(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEncerrar}
                  disabled={loadingEncerramento}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow transition flex items-center gap-1.5 cursor-pointer disabled:opacity-55"
                >
                  {loadingEncerramento && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Confirmar Encerramento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Link Público da Recepção + QR Code */}
      {cultoLink && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden border border-slate-100">
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-teal-600 to-teal-700 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  Link da Recepção
                </h3>
                <p className="text-xs text-teal-100 mt-0.5">
                  {cultoLink.tipo_culto} · {formatDate(cultoLink.data_culto)}
                </p>
              </div>
              <button
                onClick={() => setCultoLink(null)}
                className="p-1.5 rounded-lg text-teal-200 hover:bg-teal-500 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Corpo */}
            <div className="p-6 flex flex-col items-center gap-5">
              {loadingToken ? (
                <div className="py-10 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
                </div>
              ) : linkUrl ? (
                <>
                  {/* QR Code local via qrcode.react */}
                  <div className="p-3 bg-white border-2 border-slate-200 rounded-2xl shadow-sm">
                    <QRCodeSVG
                      value={linkUrl}
                      size={220}
                      includeMargin={true}
                    />
                  </div>

                  {/* URL */}
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 break-all font-mono select-all">
                    {linkUrl}
                  </div>

                  {/* Ações */}
                  <div className="w-full flex gap-2">
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(linkUrl);
                        setLinkCopied(true);
                        setTimeout(() => setLinkCopied(false), 2500);
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs transition cursor-pointer"
                    >
                      {linkCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {linkCopied ? 'Copiado!' : 'Copiar Link'}
                    </button>
                    <button
                      onClick={() => gerarTokenCulto(cultoLink, true)}
                      disabled={loadingToken}
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer disabled:opacity-50"
                      title="Invalidar link atual e gerar novo"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Regenerar
                    </button>
                  </div>

                  <p className="text-[10px] text-slate-400 text-center">
                    ⏱ Este link expira em 24 horas e permite apenas cadastro de visitantes.<br />
                    O culto precisa estar <strong>Aberto</strong> para aceitar envios.
                  </p>
                </>
              ) : (
                <div className="py-10 text-center">
                  <p className="text-sm text-slate-500">Não foi possível carregar o link.</p>
                  <button
                    onClick={() => gerarTokenCulto(cultoLink, false)}
                    className="mt-3 text-xs font-bold text-teal-600 hover:underline cursor-pointer"
                  >
                    Tentar novamente
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setCultoLink(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Novo Tipo de Culto Customizado */}
      {showNovoTipoModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden border border-slate-100 animate-fade-in">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Church className="h-5 w-5" />
                  Nova Categoria de Culto
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNovoTipoModal(false)}
                className="p-1 rounded-lg text-blue-200 hover:bg-blue-500 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Corpo */}
            <form onSubmit={handleAddNovoTipo}>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nome da Categoria *</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Ex: Culto de Casais, Vigília..."
                    value={novoTipoNome}
                    onChange={e => setNovoTipoNome(e.target.value)}
                    className="w-full border border-slate-350 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNovoTipoModal(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-755 rounded-xl font-bold text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#062E6F] hover:bg-[#154A92] text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer"
                >
                  Adicionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Consolidação no Relatório Espiritual */}
      {cultoParaConsolidar && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden border border-slate-100 animate-fade-in">

            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-600 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <BookCheck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Consolidar no Relatório Espiritual</h3>
                  <p className="text-emerald-100 text-xs mt-0.5">Esta ação não pode ser desfeita</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCultoParaConsolidar(null)}
                className="p-1 rounded-lg text-emerald-200 hover:bg-emerald-500 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Corpo */}
            <div className="p-5 space-y-4">
              {/* Info do culto */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Church className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="text-sm font-bold text-slate-800">{cultoParaConsolidar.tipo_culto}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-600">{formatDate(cultoParaConsolidar.data_culto)}{cultoParaConsolidar.horario_culto ? ` — ${cultoParaConsolidar.horario_culto}` : ''}</span>
                </div>
              </div>

              {/* O que será consolidado */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Dados que serão enviados ao relatório</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Visitantes', value: cultoParaConsolidar.visitantes_presentes ?? 0 },
                    { label: 'Membros', value: cultoParaConsolidar.membros_presentes ?? 0 },
                    { label: 'Almas Alcançadas', value: cultoParaConsolidar.almas_alcancadas ?? 0 },
                    { label: 'Reconciliações', value: cultoParaConsolidar.reconciliacoes ?? 0 },
                    { label: 'Batismos Esp. Santo', value: cultoParaConsolidar.batismos_espirito_santo ?? 0 },
                    { label: 'Curas Divinas', value: cultoParaConsolidar.curas_divinas ?? 0 },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between items-center bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5">
                      <span className="text-xs text-slate-600">{item.label}</span>
                      <span className="text-xs font-bold text-emerald-700">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Um registro será criado automaticamente no <strong>Relatório Espiritual</strong> com estes dados e o culto receberá o status <span className="text-emerald-600 font-bold">Consolidado</span>.
              </p>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCultoParaConsolidar(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarConsolidacao}
                disabled={loadingData}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
              >
                {loadingData && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <BookCheck className="h-3.5 w-3.5" />
                Confirmar Consolidação
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
