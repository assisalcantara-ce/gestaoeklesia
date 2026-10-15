'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import NotificationModal from '@/components/NotificationModal';
import InteractiveCanvas from '@/components/InteractiveCanvas';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { useUserContext } from '@/hooks/useUserContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { createClient } from '@/lib/supabase-client';
import { fetchConfiguracaoIgrejaFromSupabase, type ConfiguracaoIgreja } from '@/lib/igreja-config-utils';
import { useMembers } from '@/hooks/useMembers';
import QRCode from 'qrcode';
import type {
  Member,
  TemplateCategoria,
  TemplateTipo,
  TemplateScope,
  CartaCanvasElement,
  CartaCanvasData,
  CartaTemplate,
  CartaRegistro,
} from '@/types/supabase';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  Bold,
  ChevronDown,
  ChevronUp,
  Copy,
  Eraser,
  FileCheck,
  Image,
  Italic,
  Lock,
  Minus,
  Paintbrush,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Shield,
  Square,
  Trash2,
  Type,
  Underline,
  Unlock,
  Upload,
  Send,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CartasService, type VerificacaoAutorizacaoCarta } from '@/services/cartas-service';
import { isSecretariaLocal } from '@/lib/access-control';

const CANVAS_A4 = { width: 794, height: 1123 };

const createElementId = () => {
  try {
    if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
      return (crypto as any).randomUUID() as string;
    }
  } catch {
    // ignore
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createCanvasTextElement = (text: string): CartaCanvasElement => ({
  id: createElementId(),
  tipo: 'texto',
  x: 64,
  y: 72,
  largura: 660,
  altura: 360,
  fontSize: 18,
  fonte: 'Calibri',
  cor: '#111827',
  alinhamento: 'left',
  negrito: false,
  italico: false,
  sublinhado: false,
  texto: text,
  locked: false,
  visivel: true,
});

const createDefaultCanvas = (text = 'Escreva o conteudo da carta aqui.'): CartaCanvasData => ({
  width: CANVAS_A4.width,
  height: CANVAS_A4.height,
  backgroundUrl: '',
  elements: [createCanvasTextElement(text)],
});

const CANVAS_FONTES = [
  'Arial',
  'Calibri',
  'Georgia',
  'Times New Roman',
  'Verdana',
  'Trebuchet MS',
];

const CANVAS_ELEMENT_LABELS: Record<CartaCanvasElement['tipo'], string> = {
  texto: 'Texto',
  linha: 'Linha',
  logo: 'Logo',
  imagem: 'Imagem',
  qrcode: 'QR Code',
  'foto-membro': 'Foto do Membro',
  chapa: 'Chapa',
  forma: 'Forma / Retângulo',
};

const PLACEHOLDER_GROUPS = [
  {
    title: 'Igreja',
    items: [
      { key: 'igreja.nome', label: 'Nome da igreja' },
      { key: 'igreja.endereco', label: 'Endereco' },
      { key: 'igreja.cnpj', label: 'CNPJ' },
      { key: 'igreja.telefone', label: 'Telefone' },
      { key: 'igreja.email', label: 'Email' },
      { key: 'igreja.responsavel', label: 'Responsavel' },
    ],
  },
  {
    title: 'Membro',
    items: [
      { key: 'membro.nome', label: 'Nome' },
      { key: 'membro.cpf', label: 'CPF' },
      { key: 'membro.rg', label: 'RG' },
      { key: 'membro.email', label: 'Email' },
      { key: 'membro.telefone', label: 'Telefone' },
      { key: 'membro.matricula', label: 'Matricula' },
      { key: 'membro.cargo', label: 'Cargo ministerial' },
      { key: 'membro.congregacao', label: 'Congregacao' },
    ],
  },
  {
    title: 'Carta',
    items: [
      { key: 'carta.destino', label: 'Destino' },
      { key: 'carta.motivo', label: 'Motivo' },
      { key: 'carta.observacoes', label: 'Observacoes' },
    ],
  },
  {
    title: 'Data',
    items: [
      { key: 'data.hoje', label: 'Data (curta)' },
      { key: 'data.extenso', label: 'Data por extenso' },
    ],
  },
  {
    title: 'Assinatura',
    items: [
      { key: 'pastor.responsavel', label: 'Assinatura responsavel' },
    ],
  },
];

const PLACEHOLDER_LABELS = PLACEHOLDER_GROUPS.reduce<Record<string, string>>((acc, group) => {
  group.items.forEach((item) => {
    acc[item.key] = `${group.title}: ${item.label}`;
  });
  return acc;
}, {});



const normalizeTemplateKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const formatDateExtenso = (date: Date) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);

const normalizeCanvasData = (canvas?: Partial<CartaCanvasData> | null): CartaCanvasData => ({
  width: Number(canvas?.width) || CANVAS_A4.width,
  height: Number(canvas?.height) || CANVAS_A4.height,
  backgroundUrl: canvas?.backgroundUrl || '',
  elements: Array.isArray(canvas?.elements)
    ? (canvas?.elements as CartaCanvasElement[]).map((el) => ({
        ...el,
        locked: !!el.locked,
      }))
    : [],
});

const extractTextFromDoc = (node: any): string => {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  if (node.type === 'hardBreak') return '\n';

  const children = Array.isArray(node.content)
    ? node.content.map(extractTextFromDoc).join('')
    : '';

  if (['paragraph', 'heading', 'listItem'].includes(node.type)) {
    return `${children}\n`;
  }

  return children;
};

const convertDocToCanvas = (doc: any): CartaCanvasData => {
  const text = extractTextFromDoc(doc).trim();
  return createDefaultCanvas(text || 'Escreva o conteudo da carta aqui.');
};

const parseTemplateToCanvas = (content: any): CartaCanvasData => {
  if (content?.mode === 'canvas') {
    return normalizeCanvasData(content.canvas);
  }
  if (content?.canvas) {
    return normalizeCanvasData(content.canvas);
  }
  if (content?.mode === 'tiptap') {
    return convertDocToCanvas(content.doc);
  }
  if (content?.type === 'doc') {
    return convertDocToCanvas(content);
  }
  if (content?.doc) {
    return convertDocToCanvas(content.doc);
  }
  return createDefaultCanvas();
};

const serializeCanvasContent = (canvas: CartaCanvasData) => ({
  mode: 'canvas',
  canvas,
});

const getCanvasPreviewText = (texto: string) => {
  if (!texto) return 'Texto';
  return texto
    .replace(/{{\s*([a-zA-Z0-9_.]+)\s*}}/g, (_match, key) => {
      const label = PLACEHOLDER_LABELS[key];
      return label ? `[${label}]` : `{{${key}}}`;
    })
    .replace(/\n/g, '<br />');
};

const sanitizeHtmlText = (text: string) => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const replacePlaceholders = (html: string, map: Record<string, string>) => {
  const regex = /{{\s*([a-zA-Z0-9_.]+)\s*}}/g;
  // Se o texto tiver tags HTML inline (ex: <b>, <i>, <u>), preservar as tags e apenas higienizar os valores inseridos
  const containsHtml = /<[a-z][\s\S]*>/i.test(html);
  if (containsHtml) {
    return html.replace(regex, (_match, key) => {
      const value = map[key] ?? '';
      return sanitizeHtmlText(String(value));
    });
  }
  return html.replace(regex, (_match, key) => {
    const value = map[key] ?? '';
    return sanitizeHtmlText(String(value));
  });
};

export default function CartasPage() {
  const { loading } = useRequireSupabaseAuth();
  const { bloqueado } = useRequireModulo('gestao');
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const userCtx = useUserContext();
  const { registrarAcao } = useAuditLog();
  const { fetchMembers } = useMembers();

  // Secretaria Local não pode emitir cartas diretamente nem editar modelos; redireciona para a central de pedidos
  useEffect(() => {
    if (!userCtx.loading && userCtx.nivel) {
      if (isSecretariaLocal(userCtx.nivel)) {
        router.replace('/secretaria/cartas/pedidos');
      }
    }
  }, [userCtx.loading, userCtx.nivel, router]);

  const canvasImageInputRef = useRef<HTMLInputElement>(null);
  const canvasBackgroundInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleToggleTextInlineFormat = (tag: 'b' | 'i' | 'u') => {
    if (!selectedCanvasElement) return;
    const textarea = textareaRef.current;
    if (textarea && textarea.selectionStart !== undefined && textarea.selectionEnd !== undefined && textarea.selectionStart !== textarea.selectionEnd) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const originalText = selectedCanvasElement.texto || '';
      const selectedText = originalText.substring(start, end);
      const openTag = `<${tag}>`;
      const closeTag = `</${tag}>`;

      let newText = '';
      if (selectedText.startsWith(openTag) && selectedText.endsWith(closeTag)) {
        newText = originalText.substring(0, start) + selectedText.substring(openTag.length, selectedText.length - closeTag.length) + originalText.substring(end);
      } else {
        newText = originalText.substring(0, start) + openTag + selectedText + closeTag + originalText.substring(end);
      }

      updateCanvasElement(selectedCanvasElement.id, { texto: newText });
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(start, start + openTag.length + selectedText.length + closeTag.length);
        }
      }, 50);
      return;
    }

    // Se nenhum trecho estiver selecionado, alterna a formatação do bloco inteiro
    if (tag === 'b') updateCanvasElement(selectedCanvasElement.id, { negrito: !selectedCanvasElement.negrito });
    if (tag === 'i') updateCanvasElement(selectedCanvasElement.id, { italico: !selectedCanvasElement.italico });
    if (tag === 'u') updateCanvasElement(selectedCanvasElement.id, { sublinhado: !selectedCanvasElement.sublinhado });
  };

  const [activeTab, setActiveTab] = useState('modelos');
  const [templates, setTemplates] = useState<CartaTemplate[]>([]);
  const [systemTemplates, setSystemTemplates] = useState<Record<string, CartaTemplate>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<CartaTemplate | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftKey, setDraftKey] = useState('');
  const [draftTipo, setDraftTipo] = useState<TemplateTipo>('custom');
  const [isDraftReady, setIsDraftReady] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'elementos' | 'variaveis' | 'camadas'>('elementos');
  const lastSelectedTemplateRef = useRef<CartaTemplate | null>(null);
  const lastSavedSnapshotRef = useRef<string>('');
  const [canvasContent, setCanvasContent] = useState<CartaCanvasData>(() => createDefaultCanvas());
  const [categoriaFilter, setCategoriaFilter] = useState<'todas' | 'carta' | 'declaracao'>('todas');
  const [emitirCategoria, setEmitirCategoria] = useState<'todas' | 'carta' | 'declaracao'>('todas');
  const [historicoCategoria, setHistoricoCategoria] = useState<'todas' | 'carta' | 'declaracao'>('todas');
  const [historicoBusca, setHistoricoBusca] = useState('');
  const [draftCategoria, setDraftCategoria] = useState<TemplateCategoria>('carta');
  const [selectedCanvasElement, setSelectedCanvasElement] = useState<CartaCanvasElement | null>(null);
  const [selectedCanvasElements, setSelectedCanvasElements] = useState<CartaCanvasElement[]>([]);
  const [canvasImageTargetId, setCanvasImageTargetId] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [records, setRecords] = useState<CartaRegistro[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [configIgreja, setConfigIgreja] = useState<ConfiguracaoIgreja>({
    nome: 'Igreja/Ministerio',
    endereco: '',
    cnpj: '',
    telefone: '',
    email: '',
    website: '',
    descricao: '',
    responsavel: '',
    logo: '',
  });
  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [issueFields, setIssueFields] = useState({
    destino: '',
    motivo: '',
    observacoes: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);

  // Verificação de alterações não salvas no modelo ativo
  const currentSnapshot = useMemo(() => {
    return JSON.stringify({
      title: draftTitle,
      canvas: canvasContent,
    });
  }, [draftTitle, canvasContent]);

  const isDirty = useMemo(() => {
    if (!lastSavedSnapshotRef.current) return false;
    return currentSnapshot !== lastSavedSnapshotRef.current;
  }, [currentSnapshot]);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    variant: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    variant: 'danger',
    onConfirm: () => {},
  });
  const [notification, setNotification] = useState<{
    isOpen: boolean; title: string; message: string;
    type: 'success' | 'error' | 'warning' | 'info'; autoClose: number | undefined;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'success',
    autoClose: 3000,
  });

  const [pedidosRecebidos, setPedidosRecebidos] = useState<any[]>([]);
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [pedidoParaAvaliar, setPedidoParaAvaliar] = useState<any | null>(null);
  const [motivoRejeicaoPedido, setMotivoRejeicaoPedido] = useState('');
  const [avaliandoPedido, setAvaliandoPedido] = useState(false);
  const [pedidosFiltroStatus, setPedidosFiltroStatus] = useState<'todos' | 'pendente' | 'autorizado' | 'rejeitado'>('pendente');

  const effMinistryId = ministryId || userCtx.ministryId;

  const fetchPedidosRecebidos = useCallback(async () => {
    if (!effMinistryId) return;
    setLoadingPedidos(true);
    try {
      const { data, error } = await supabase
        .from('carta_pedidos')
        .select('*')
        .eq('ministry_id', effMinistryId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPedidosRecebidos(data || []);
    } catch (err: any) {
      console.error('Erro ao carregar pedidos de cartas recebidos:', err);
    } finally {
      setLoadingPedidos(false);
    }
  }, [effMinistryId, supabase]);

  useEffect(() => {
    if (effMinistryId) {
      fetchPedidosRecebidos();
    }
  }, [effMinistryId, fetchPedidosRecebidos]);

  const handleAutorizarPedido = async (pedido: any) => {
    if (CartasService.exigeAutorizacaoPresidencial(pedido.tipo_carta)) {
      setNotification({
        isOpen: true,
        title: 'Deliberação Presidencial Obrigatória',
        message: 'Cartas de Mudança e Desligamento devem ser deliberadas na Central de Decisões da Presidência.',
        type: 'warning',
        autoClose: 4000,
      });
      return;
    }

    setAvaliandoPedido(true);
    try {
      const { error } = await supabase
        .from('carta_pedidos')
        .update({
          status: 'autorizado',
          autorizador_id: userCtx.userId,
          autorizador_nome: userCtx.userId || 'Secretaria Geral',
          data_autorizacao: new Date().toISOString(),
        })
        .eq('id', pedido.id)
        .eq('ministry_id', effMinistryId);

      if (error) throw error;

      await registrarAcao({
        acao: 'atualizar_status',
        modulo: 'secretaria',
        area: 'cartas',
        tabela_afetada: 'carta_pedidos',
        registro_id: pedido.id,
        descricao: `Pedido de carta para ${pedido.membro_nome} autorizado pela Secretaria Geral`,
        dados_novos: { status: 'autorizado', autorizador_id: userCtx.userId },
        status: 'sucesso',
      });

      setNotification({
        isOpen: true,
        title: 'Pedido Autorizado',
        message: 'O pedido foi autorizado com sucesso e está liberado para emissão e impressão.',
        type: 'success',
        autoClose: 3000,
      });
      setPedidoParaAvaliar(null);
      fetchPedidosRecebidos();
    } catch (err: any) {
      setNotification({
        isOpen: true,
        title: 'Erro ao autorizar',
        message: err?.message || 'Falha ao autorizar o pedido.',
        type: 'error',
        autoClose: 4000,
      });
    } finally {
      setAvaliandoPedido(false);
    }
  };

  const handleRejeitarPedido = async () => {
    if (!pedidoParaAvaliar) return;
    if (!motivoRejeicaoPedido.trim()) {
      setNotification({
        isOpen: true,
        title: 'Campo Obrigatório',
        message: 'Informe o motivo da rejeição do pedido.',
        type: 'warning',
        autoClose: 3000,
      });
      return;
    }

    setAvaliandoPedido(true);
    try {
      const { error } = await supabase
        .from('carta_pedidos')
        .update({
          status: 'rejeitado',
          autorizador_id: userCtx.userId,
          autorizador_nome: userCtx.userId || 'Secretaria Geral',
          motivo_rejeicao: motivoRejeicaoPedido.trim(),
          data_autorizacao: new Date().toISOString(),
        })
        .eq('id', pedidoParaAvaliar.id)
        .eq('ministry_id', effMinistryId);

      if (error) throw error;

      await registrarAcao({
        acao: 'atualizar_status',
        modulo: 'secretaria',
        area: 'cartas',
        tabela_afetada: 'carta_pedidos',
        registro_id: pedidoParaAvaliar.id,
        descricao: `Pedido de carta para ${pedidoParaAvaliar.membro_nome} rejeitado pela Secretaria Geral. Motivo: ${motivoRejeicaoPedido.trim()}`,
        dados_novos: { status: 'rejeitado', motivo_rejeicao: motivoRejeicaoPedido.trim() },
        status: 'sucesso',
      });

      setNotification({
        isOpen: true,
        title: 'Pedido Rejeitado',
        message: 'O pedido foi rejeitado e a emissão oficial permanece bloqueada.',
        type: 'warning',
        autoClose: 3000,
      });
      setPedidoParaAvaliar(null);
      setMotivoRejeicaoPedido('');
      fetchPedidosRecebidos();
    } catch (err: any) {
      setNotification({
        isOpen: true,
        title: 'Erro ao rejeitar',
        message: err?.message || 'Falha ao rejeitar o pedido.',
        type: 'error',
        autoClose: 4000,
      });
    } finally {
      setAvaliandoPedido(false);
    }
  };

  const pedidosPendentesCount = pedidosRecebidos.filter(p => p.status === 'pendente').length;

  const tabs = [
    {
      id: 'pedidos',
      label: pedidosPendentesCount > 0 ? `Pedidos (${pedidosPendentesCount})` : 'Pedidos Recebidos',
      icon: '📬',
    },
    { id: 'modelos', label: 'Modelos', icon: '🧩' },
    { id: 'emitir', label: 'Emitir', icon: '📄' },
    { id: 'historico', label: 'Histórico', icon: '🗂️' },
  ];

  const visibleTabs = tabs;
  const templatesFiltrados = templates;

  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedMemberId) || null,
    [members, selectedMemberId]
  );

  const [autorizacaoStatus, setAutorizacaoStatus] = useState<VerificacaoAutorizacaoCarta>({
    status: 'isento',
    exigeAutorizacao: false,
    autorizado: true,
    mensagem: '',
  });
  const [verificandoAutorizacao, setVerificandoAutorizacao] = useState(false);
  const [registrandoPedido, setRegistrandoPedido] = useState(false);

  const checkAuth = useCallback(async () => {
    if (!selectedTemplate) {
      setAutorizacaoStatus({
        status: 'isento',
        exigeAutorizacao: false,
        autorizado: true,
        mensagem: '',
      });
      return;
    }

    const tipo = selectedTemplate.tipo || selectedTemplate.template_key;
    if (!CartasService.exigeAutorizacaoPresidencial(tipo)) {
      setAutorizacaoStatus({
        status: 'isento',
        exigeAutorizacao: false,
        autorizado: true,
        mensagem: 'Este documento não exige deliberação prévia da Presidência.',
      });
      return;
    }

    const currentMinId = ministryId || userCtx.ministryId;
    if (!currentMinId || !selectedMemberId) {
      setAutorizacaoStatus({
        status: 'nao_solicitado',
        exigeAutorizacao: true,
        autorizado: false,
        mensagem: 'Selecione um membro para verificar a deliberação da Presidência.',
      });
      return;
    }

    setVerificandoAutorizacao(true);
    try {
      const res = await CartasService.verificarAutorizacaoCarta(
        supabase,
        currentMinId,
        selectedMemberId,
        tipo,
        selectedMember?.name
      );
      setAutorizacaoStatus(res);
    } catch (err: any) {
      setAutorizacaoStatus({
        status: 'pendente',
        exigeAutorizacao: true,
        autorizado: false,
        mensagem: err?.message || 'Erro ao verificar deliberação da Presidência.',
      });
    } finally {
      setVerificandoAutorizacao(false);
    }
  }, [selectedTemplate, selectedMemberId, selectedMember?.name, ministryId, userCtx.ministryId, supabase]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const [congregacoes, setCongregacoes] = useState<Array<{ id: string; nome: string }>>([]);

  const buildPlaceholderMap = (member?: Member | null) => {
    const hoje = new Date();
    const cf = (member?.custom_fields && typeof member.custom_fields === 'object') ? member.custom_fields : {};
    const cargo =
      String(
        member?.cargo_ministerial ||
        (cf as any).cargoMinisterial ||
        (cf as any).cargo_ministerial ||
        ''
      );
    
    // Resolução robusta da Congregação do Membro
    let congregacaoNome = '';
    const congId = member?.congregacao_id || (cf as any).congregacao_id;
    if (congId) {
      const encontrada = congregacoes.find((c) => c.id === congId);
      if (encontrada) congregacaoNome = encontrada.nome;
    }
    if (!congregacaoNome) {
      congregacaoNome = String((cf as any).supervisao || (cf as any).congregacao || (cf as any).congregacao_nome || '');
    }

    return {
      'igreja.nome': configIgreja.nome || '',
      'igreja.endereco': configIgreja.endereco || '',
      'igreja.cnpj': configIgreja.cnpj || '',
      'igreja.telefone': configIgreja.telefone || '',
      'igreja.email': configIgreja.email || '',
      'igreja.responsavel': configIgreja.responsavel || '',
      'membro.nome': member?.name || '',
      'membro.cpf': member?.cpf || '',
      'membro.rg': member?.rg || '',
      'membro.email': member?.email || '',
      'membro.telefone': member?.phone || '',
      'membro.matricula': String(member?.matricula || ''),
      'membro.cargo': cargo || '',
      'membro.congregacao': congregacaoNome || '',
      'carta.destino': issueFields.destino || '',
      'carta.motivo': issueFields.motivo || '',
      'carta.observacoes': issueFields.observacoes || '',
      'data.hoje': hoje.toLocaleDateString('pt-BR'),
      'data.extenso': formatDateExtenso(hoje),
      'pastor.responsavel': configIgreja.responsavel || '',
    } as Record<string, string>;
  };

  const [previewQrMap, setPreviewQrMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let isMounted = true;
    const qrElements = (canvasContent.elements || []).filter(
      (el) => el.tipo === 'qrcode' && el.visivel !== false
    );

    if (qrElements.length === 0) {
      setPreviewQrMap({});
      return;
    }

    const baseUrl =
      typeof window !== 'undefined' && window.location.origin
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_APP_URL || 'https://www.gestaoeklesia.com.br');
    const previewQrUrl = `${baseUrl}/validar/documento/carta/PREVIEW`;

    Promise.all(
      qrElements.map(async (el) => {
        const qrSize = Math.min(el.largura, el.altura);
        try {
          const dataUrl = await QRCode.toDataURL(previewQrUrl, {
            width: Math.max(qrSize * 3, 200),
            margin: 1,
            color: {
              dark: el.cor || '#000000',
              light: '#ffffff',
            },
          });
          return { id: el.id, dataUrl };
        } catch {
          return { id: el.id, dataUrl: '' };
        }
      })
    ).then((results) => {
      if (!isMounted) return;
      const map: Record<string, string> = {};
      results.forEach((r) => {
        if (r.dataUrl) map[r.id] = r.dataUrl;
      });
      setPreviewQrMap(map);
    });

    return () => {
      isMounted = false;
    };
  }, [canvasContent]);

  const renderCanvasHtml = (
    canvas: CartaCanvasData,
    map: Record<string, string>,
    qrDataUrls?: Record<string, string>
  ) => {
    const safeCanvas = normalizeCanvasData(canvas);
    const bgStyle = safeCanvas.backgroundUrl
      ? `background-image:url('${safeCanvas.backgroundUrl}'); background-size: cover; background-position: center;`
      : 'background-color:#ffffff;';

    const elementsHtml = safeCanvas.elements
      .filter((el) => el.visivel !== false)
      .map((el) => {
        const baseStyle = `position:absolute; left:${el.x}px; top:${el.y}px; width:${el.largura}px; height:${el.altura}px;`;
        if (el.tipo === 'texto') {
          const texto = replacePlaceholders(el.texto || '', map).replace(/\n/g, '<br />');
          const style = [
            baseStyle,
            `font-size:${el.fontSize || 14}px;`,
            `font-family:${el.fonte || 'Arial'};`,
            `font-weight:${el.negrito ? 700 : 400};`,
            `font-style:${el.italico ? 'italic' : 'normal'};`,
            `text-decoration:${el.sublinhado ? 'underline' : 'none'};`,
            `color:${el.cor || '#111'};`,
            `text-align:${el.alinhamento || 'left'};`,
            `background-color:${el.backgroundColor || 'transparent'};`,
            `border-radius:${el.borderRadius || 0}px;`,
            'box-sizing:border-box;',
            'padding:6px 8px;',
          ].join('');
          return `<div style="${style}">${texto}</div>`;
        }

        if (el.tipo === 'logo' || el.tipo === 'imagem' || el.tipo === 'foto-membro') {
          const src = el.tipo === 'logo'
            ? (configIgreja.logo || el.imagemUrl || '')
            : (el.imagemUrl || '');
          if (!src) return '';
          const style = [
            baseStyle,
            'object-fit:contain;',
            `opacity:${el.transparencia ?? 1};`,
          ].join('');
          return `<img src="${src}" style="${style}" />`;
        }

        if (el.tipo === 'qrcode') {
          const qrSrc = qrDataUrls?.[el.id];
          if (!qrSrc) return '';
          const style = [
            baseStyle,
            'display:flex; align-items:center; justify-content:center;',
            `opacity:${el.transparencia ?? 1};`,
            'box-sizing:border-box;',
          ].join('');
          return `<div style="${style}"><img src="${qrSrc}" alt="QR Code Autenticidade Documental" style="width:100%; height:100%; object-fit:contain;" /></div>`;
        }

        if (el.tipo === 'chapa') {
          const style = [
            baseStyle,
            `background-color:${el.cor || '#111'};`,
            `color:#fff;`,
            `border-radius:${el.borderRadius || 0}px;`,
            'display:flex; align-items:center; justify-content:center;',
            `opacity:${el.transparencia ?? 1};`,
            `font-size:${el.fontSize || 12}px;`,
            'font-weight:700;',
            '-webkit-print-color-adjust:exact;',
            'print-color-adjust:exact;',
          ].join('');
          return `<div style="${style}">${el.texto || ''}</div>`;
        }

        if (el.tipo === 'linha') {
          const thickness = Math.max(1, el.altura || 2);
          const lineColor = el.cor || '#111';
          const style = [
            baseStyle,
            `height:${thickness}px;`,
            `background-color:${lineColor};`,
            `border-top:${thickness}px solid ${lineColor};`,
            'box-sizing:border-box;',
            `border-radius:${el.borderRadius || 0}px;`,
            `opacity:${el.transparencia ?? 1};`,
            '-webkit-print-color-adjust:exact;',
            'print-color-adjust:exact;',
          ].join('');
          return `<div style="${style}"></div>`;
        }

        if (el.tipo === 'forma') {
          const style = [
            baseStyle,
            `background-color:${el.backgroundColor || '#f3f4f6'};`,
            `border:${el.borderWidth || 1}px ${el.borderStyle || 'solid'} ${el.borderColor || '#374151'};`,
            `border-radius:${el.borderRadius || 0}px;`,
            `opacity:${el.transparencia ?? 1};`,
            'box-sizing:border-box;',
            '-webkit-print-color-adjust:exact;',
            'print-color-adjust:exact;',
          ].join('');
          return `<div style="${style}"></div>`;
        }

        return '';
      })
      .join('');

    return `
      <div style="position:relative; width:${safeCanvas.width}px; height:${safeCanvas.height}px; ${bgStyle} margin:0 auto; -webkit-print-color-adjust:exact; print-color-adjust:exact;">
        ${elementsHtml}
      </div>
    `;
  };

  const previewHtml = useMemo(() => {
    const map = buildPlaceholderMap(selectedMember);
    return renderCanvasHtml(canvasContent, map, previewQrMap);
  }, [canvasContent, selectedMember, issueFields, configIgreja, previewQrMap]);

  const lastIssuedLabel = useMemo(() => {
    const issuedAt = records[0]?.issued_at;
    if (!issuedAt) return 'Sem emissao';
    return new Date(issuedAt).toLocaleDateString('pt-BR');
  }, [records]);

  const fetchMinData = async (): Promise<string | null> => {
    if (userCtx.ministryId) return userCtx.ministryId;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: mData } = await supabase
        .from('members')
        .select('ministry_id')
        .eq('id', user.id)
        .single();
      return mData?.ministry_id || user.user_metadata?.ministry_id || null;
    } catch {
      return null;
    }
  };

const createSystemTemplate = (
  id: string,
  key: string,
  title: string,
  tipo: TemplateTipo,
  categoria: TemplateCategoria,
  tituloDocumento: string,
  textoDeclaracao: string,
  isDeclaracao = false
): CartaTemplate => ({
  id,
  ministry_id: null,
  template_key: key,
  title,
  tipo,
  categoria,
  scope: 'system',
  is_active: true,
  content_json: {
    mode: 'canvas',
    canvas: {
      width: 794,
      height: 1123,
      backgroundUrl: '',
      elements: [
        {
          x: 45,
          y: 26,
          id: '49a4a289-5962-4b99-8181-40c00858f084',
          cor: '#111827',
          tipo: 'logo',
          fonte: 'Calibri',
          altura: 101,
          locked: false,
          italico: false,
          largura: 92,
          negrito: false,
          visivel: true,
          fontSize: 12,
          imagemUrl: '',
          sublinhado: false,
          alinhamento: 'left',
        },
        {
          x: 142,
          y: 24,
          id: '4cc6787a-9fb7-4628-99a4-72231f43327a',
          cor: '#111827',
          tipo: 'texto',
          fonte: 'Calibri',
          texto: '{{igreja.nome}}',
          altura: 32,
          locked: false,
          italico: false,
          largura: 506,
          negrito: true,
          visivel: true,
          fontSize: 22,
          sublinhado: false,
          alinhamento: 'left',
        },
        {
          x: 144,
          y: 54,
          id: 'cabecalho-endereco',
          cor: '#374151',
          tipo: 'texto',
          fonte: 'Calibri',
          texto: '{{igreja.endereco}}',
          altura: 24,
          locked: false,
          italico: false,
          largura: 506,
          negrito: false,
          visivel: true,
          fontSize: 14,
          sublinhado: false,
          alinhamento: 'left',
        },
        {
          x: 144,
          y: 75,
          id: 'cabecalho-cnpj',
          cor: '#4B5563',
          tipo: 'texto',
          fonte: 'Calibri',
          texto: 'CNPJ: {{igreja.cnpj}}',
          altura: 22,
          locked: false,
          italico: false,
          largura: 506,
          negrito: false,
          visivel: true,
          fontSize: 13,
          sublinhado: false,
          alinhamento: 'left',
        },
        {
          x: 144,
          y: 94,
          id: 'cabecalho-contato',
          cor: '#4B5563',
          tipo: 'texto',
          fonte: 'Calibri',
          texto: 'Tel: {{igreja.telefone}} | E-mail: {{igreja.email}}',
          altura: 22,
          locked: false,
          italico: false,
          largura: 506,
          negrito: false,
          visivel: true,
          fontSize: 13,
          sublinhado: false,
          alinhamento: 'left',
        },
        {
          x: 32,
          y: 263,
          id: '9ef02817-5d45-4078-8819-fcb24c29c58f',
          cor: '#111827',
          tipo: 'texto',
          fonte: 'Calibri',
          texto: textoDeclaracao,
          altura: 520,
          locked: false,
          italico: false,
          largura: 618,
          negrito: false,
          visivel: true,
          fontSize: 22,
          sublinhado: false,
          alinhamento: 'center',
        },
        {
          x: 0,
          y: 144,
          id: '4014e7e1-a741-40b3-a2a1-119e80e5ff67',
          cor: '#150f95',
          tipo: 'linha',
          fonte: 'Calibri',
          texto: '',
          altura: 4,
          locked: false,
          italico: false,
          largura: 700,
          negrito: false,
          visivel: true,
          fontSize: 12,
          sublinhado: false,
          alinhamento: 'left',
          borderRadius: 0,
        },
        {
          x: 0,
          y: 148,
          id: '1787108727534jtjq91qbj',
          cor: '#ff0000',
          tipo: 'linha',
          fonte: 'Calibri',
          texto: '',
          altura: 4,
          locked: false,
          italico: false,
          largura: 700,
          negrito: false,
          visivel: true,
          fontSize: 12,
          sublinhado: false,
          alinhamento: 'left',
          borderRadius: 0,
        },
        {
          x: 100,
          y: 186,
          id: '494afeea-9420-486f-bb71-0889883c29c4',
          cor: '#111827',
          tipo: 'texto',
          fonte: 'Calibri',
          texto: tituloDocumento,
          altura: 48,
          locked: false,
          italico: false,
          largura: 480,
          negrito: true,
          visivel: true,
          fontSize: 24,
          sublinhado: false,
          alinhamento: 'center',
          borderRadius: 0,
        },
        ...(isDeclaracao
          ? []
          : [
              {
                x: 25,
                y: 994,
                id: '17871409999000b6o6qgzt',
                cor: '#111827',
                tipo: 'texto' as const,
                fonte: 'Calibri',
                texto: '<b>DESTINO:</b> {{carta.destino}}',
                altura: 29,
                locked: false,
                italico: false,
                largura: 643,
                negrito: false,
                visivel: true,
                fontSize: 16,
                sublinhado: false,
                alinhamento: 'left' as const,
                borderRadius: 0,
              },
              {
                x: 24,
                y: 1028,
                id: '17871410147888k2nbto2j',
                cor: '#111827',
                tipo: 'texto' as const,
                fonte: 'Calibri',
                texto: '<b>OBS.: </b>{{carta.observacoes}}',
                altura: 29,
                locked: false,
                italico: false,
                largura: 643,
                negrito: false,
                visivel: true,
                fontSize: 16,
                sublinhado: false,
                alinhamento: 'left' as const,
                borderRadius: 0,
              },
            ]),
      ],
    },
  },
});

const DEFAULT_SYSTEM_TEMPLATES: CartaTemplate[] = [
  // ─── CARTAS MINISTERIAIS ──────────────────────────────────────────────────
  createSystemTemplate(
    'system-mudanca',
    'mudanca',
    'Carta de Mudança',
    'mudanca',
    'carta',
    'CARTA DE MUDANÇA',
    'Declaramos para os devidos fins que\n<b>{{membro.nome}}, CPF {{membro.cpf}}</b>\n\nFaz parte desta igreja, como MEMBRO fiel e dedicado.\nPor se achar em comunhão com esta Igreja, nós o recomendamos que o recebais no Senhor como usam fazer os Santos..\n\n<b>Congregação:</b> {{membro.congregacao}} \n<b>Cargo:</b> {{membro.cargo}}\n\nEm fé de verdade, firmamos a presente.\n\n<b>{{data.extenso}}</b>\n\n________________________________________\n<b>{{pastor.responsavel}}</b> - Pastor Presidente\n'
  ),
  createSystemTemplate(
    'system-transito',
    'transito',
    'Carta de Trânsito',
    'transito',
    'carta',
    'CARTA DE TRÂNSITO',
    'Declaramos para os devidos fins que\n<b>{{membro.nome}}, CPF {{membro.cpf}}</b>\n\nMembro desta igreja, encontra-se em viagem ou trânsito temporário.\nRecomendamos que o recebais em comunhão cristã durante o período de sua permanência.\n\n<b>Congregação:</b> {{membro.congregacao}} \n<b>Cargo:</b> {{membro.cargo}}\n\nEm fé de verdade, firmamos a presente.\n\n<b>{{data.extenso}}</b>\n\n________________________________________\n<b>{{pastor.responsavel}}</b> - Pastor Presidente\n'
  ),
  createSystemTemplate(
    'system-desligamento',
    'desligamento',
    'Carta de Desligamento',
    'desligamento',
    'carta',
    'CARTA DE DESLIGAMENTO',
    'Declaramos para os devidos fins que\n<b>{{membro.nome}}, CPF {{membro.cpf}}</b>\n\nTeve seu desligamento formalizado a seu pedido do rol de membros desta igreja.\nRegistramos nossos agradecimentos pelo período em que esteve em nossa comunhão.\n\n<b>Congregação:</b> {{membro.congregacao}} \n<b>Cargo:</b> {{membro.cargo}}\n\nEm fé de verdade, firmamos a presente.\n\n<b>{{data.extenso}}</b>\n\n________________________________________\n<b>{{pastor.responsavel}}</b> - Pastor Presidente\n'
  ),
  createSystemTemplate(
    'system-recomendacao',
    'recomendacao',
    'Carta de Recomendação',
    'recomendacao',
    'carta',
    'CARTA DE RECOMENDAÇÃO',
    'Declaramos para os devidos fins que\n<b>{{membro.nome}}, CPF {{membro.cpf}}</b>\n\nÉ membro em plena comunhão desta igreja e o(a) recomendamos carinhosamente aos irmãos para acolhimento nas atividades cristãs.\n\n<b>Congregação:</b> {{membro.congregacao}} \n<b>Cargo:</b> {{membro.cargo}}\n\nEm fé de verdade, firmamos a presente.\n\n<b>{{data.extenso}}</b>\n\n________________________________________\n<b>{{pastor.responsavel}}</b> - Pastor Presidente\n'
  ),

  // ─── DECLARAÇÕES OFICIAIS ────────────────────────────────────────────────
  createSystemTemplate(
    'system-declaracao-membro-ativo',
    'membro_ativo',
    'Declaração de Membro Ativo',
    'membro_ativo',
    'declaracao',
    'DECLARAÇÃO DE MEMBRO ATIVO',
    'Declaramos para os devidos fins a quem possa interessar que\n<b>{{membro.nome}}</b>, portador(a) do CPF nº <b>{{membro.cpf}}</b>,\né membro ativo(a) e regular do rol de membros desta instituição religiosa,\nencontrando-se em plena comunhão com a comunidade e seus estatutos.\n\n<b>Congregação:</b> {{membro.congregacao}}\n<b>Cargo/Função:</b> {{membro.cargo}}\n\nPor ser expressão da verdade, firmamos a presente declaração.\n\n<b>{{data.extenso}}</b>\n\n________________________________________\n<b>{{pastor.responsavel}}</b> - Pastor Presidente\n',
    true
  ),
  createSystemTemplate(
    'system-declaracao-batismo',
    'batismo',
    'Declaração de Batismo nas Águas',
    'batismo',
    'declaracao',
    'DECLARAÇÃO DE BATISMO NAS ÁGUAS',
    'Certificamos para os devidos fins de direito eclesiástico que\n<b>{{membro.nome}}</b>, portador(a) do CPF nº <b>{{membro.cpf}}</b>,\nprofessou publicamente sua fé em Jesus Cristo e foi batizado(a) nas águas conforme a ordenança bíblica,\npassando a integrar a comunhão do corpo de Cristo nesta Igreja.\n\n<b>Congregação:</b> {{membro.congregacao}}\n\nPor ser verdade, emitimos o presente documento.\n\n<b>{{data.extenso}}</b>\n\n________________________________________\n<b>{{pastor.responsavel}}</b> - Pastor Presidente\n',
    true
  ),
  createSystemTemplate(
    'system-declaracao-cargo',
    'cargo',
    'Declaração de Exercício de Cargo',
    'cargo',
    'declaracao',
    'DECLARAÇÃO DE EXERCÍCIO DE CARGO',
    'Declaramos para os devidos fins ministeriais e civis que\n<b>{{membro.nome}}</b>, portador(a) do CPF nº <b>{{membro.cpf}}</b>,\nexercita oficialmente a função/cargo de <b>{{membro.cargo}}</b>\nno âmbito de <b>{{igreja.nome}}</b>, desenvolvendo suas atividades com zelo e dedicação cristã.\n\n<b>Congregação:</b> {{membro.congregacao}}\n\nFirmamos a presente declaração para que produza os efeitos necessários.\n\n<b>{{data.extenso}}</b>\n\n________________________________________\n<b>{{pastor.responsavel}}</b> - Pastor Presidente\n',
    true
  ),
  createSystemTemplate(
    'system-declaracao-apresentacao',
    'apresentacao_crianca',
    'Declaração de Apresentação de Criança',
    'apresentacao_crianca',
    'declaracao',
    'DECLARAÇÃO DE APRESENTAÇÃO DE CRIANÇA',
    'Certificamos para fins de registro eclesiástico que a criança foi solenemente apresentada ao Senhor Jesus Cristo\nem culto público nesta Igreja, recebendo a oração intercessória e bênção pastoral da congregação,\nconforme os preceitos das Sagradas Escrituras.\n\n<b>Responsável/Membro:</b> {{membro.nome}}\n<b>Congregação:</b> {{membro.congregacao}}\n\nEm fé de verdade, passamos a presente declaração.\n\n<b>{{data.extenso}}</b>\n\n________________________________________\n<b>{{pastor.responsavel}}</b> - Pastor Presidente\n',
    true
  ),
];

  const loadTemplates = async () => {
    const { data, error } = await supabase
      .from('cartas_templates')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      setNotification({
        isOpen: true,
        title: 'Erro',
        message: error.message || 'Erro ao carregar templates',
        type: 'error',
        autoClose: undefined,
      });
      return;
    }

    const dbRows = (data || []) as CartaTemplate[];
    
    // DEFAULT_SYSTEM_TEMPLATES define os padrões mais recentes do código
    const systemMap: Record<string, CartaTemplate> = {};
    DEFAULT_SYSTEM_TEMPLATES.forEach((t) => {
      systemMap[t.template_key] = t;
    });
    // Se o banco trouxer modelos de sistema atualizados, insere/atualiza
    dbRows.filter((t) => t.scope === 'system').forEach((dbSys) => {
      systemMap[dbSys.template_key] = dbSys;
    });

    const tenantRows = dbRows.filter((t) => t.scope === 'tenant');
    const merged = new Map<string, CartaTemplate>();

    // Insere modelos customizados do tenant
    tenantRows.forEach((t) => merged.set(t.template_key, t));
    
    // Garante os modelos de sistema no mapa
    Object.values(systemMap).forEach((t) => {
      if (!merged.has(t.template_key)) {
        merged.set(t.template_key, t);
      }
    });

    // Garante os modelos de sistema mais recentes no mapa (sobrepondo registros antigos no banco)
    const list = Array.from(merged.values()).map((tpl) => {
      const sysNative = DEFAULT_SYSTEM_TEMPLATES.find((s) => s.template_key === tpl.template_key);
      if (sysNative && (tpl.scope === 'system' || !tpl.content_json?.canvas?.elements || tpl.content_json?.canvas?.elements?.length < 11)) {
        return { ...sysNative };
      }
      return tpl;
    });

    setTemplates(list);
    setSystemTemplates(systemMap);

    const desiredKey =
      selectedTemplate?.template_key ||
      normalizeTemplateKey(draftKey || draftTitle || '');

    const preferred = desiredKey
      ? list.find((t) => t.template_key === desiredKey) || null
      : null;

    if (preferred) {
      // Forçar nova referência de objeto para disparar o useEffect de canvasContent
      setSelectedTemplate({ ...preferred });
    } else if (!selectedTemplate && list.length > 0) {
      const first = list[0];
      setSelectedTemplate({ ...first });
      setDraftTitle(first.title || '');
      setDraftKey(first.template_key || '');
      setDraftTipo(first.tipo || 'custom');
    }
  };

  const loadRecords = async () => {
    const mid = userCtx.ministryId;
    if (!mid) return;

    let query = supabase
      .from('cartas_registros')
      .select('*, members!inner(congregacao_id)')
      .eq('ministry_id', mid);

    const isLocal = !userCtx.loading && ['admin_local', 'financeiro_local', 'secretaria_local'].includes(userCtx.nivel || '');
    if (isLocal && userCtx.congregacaoId) {
      query = query.eq('members.congregacao_id', userCtx.congregacaoId);
    }

    const { data } = await query
      .order('issued_at', { ascending: false })
      .limit(50);

    setRecords((data || []) as any[]);
  };

  const loadCongregacoes = async () => {
    try {
      const { data } = await supabase.from('congregacoes').select('id, nome');
      setCongregacoes((data || []) as Array<{ id: string; nome: string }>);
    } catch {
      setCongregacoes([]);
    }
  };

  const loadMembers = async () => {
    try {
      const res = await fetchMembers(1, 500, { status: 'active' });
      const list = ((res as any)?.data || []) as Member[];
      setMembers(list);
    } catch (err) {
      setMembers([]);
    }
  };

  useEffect(() => {
    if (loading || bloqueado) return;
    const run = async () => {
      const mid = await fetchMinData();
      setMinistryId(mid);
      const config = await fetchConfiguracaoIgrejaFromSupabase(supabase);
      setConfigIgreja(config);
      await Promise.all([loadTemplates(), loadRecords(), loadMembers(), loadCongregacoes()]);
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, bloqueado, userCtx.ministryId]);

  useEffect(() => {
    if (!selectedTemplate) return;
    const canvas = parseTemplateToCanvas(selectedTemplate.content_json);
    setCanvasContent(canvas);
    setSelectedCanvasElement(null);
    setSelectedCanvasElements([]);
    const title = selectedTemplate.title || '';
    setDraftTitle(title);
    setDraftKey(selectedTemplate.template_key || '');
    setDraftTipo(selectedTemplate.tipo || 'custom');
    lastSavedSnapshotRef.current = JSON.stringify({
      title,
      canvas,
    });
  }, [selectedTemplate?.id, selectedTemplate?.template_key, selectedTemplate?.content_json]);

  const handleSelectTemplate = (template: CartaTemplate) => {
    setIsDraftReady(false);
    // Se for um modelo de sistema nativo, forçar sempre o layout nativo atualizado
    const sysNative = DEFAULT_SYSTEM_TEMPLATES.find((s) => s.template_key === template.template_key);
    if (sysNative && template.scope === 'system') {
      setSelectedTemplate({ ...sysNative });
      return;
    }
    setSelectedTemplate({ ...template });
  };

  const handleCategoryFilterChange = (newCat: 'todas' | 'carta' | 'declaracao') => {
    setCategoriaFilter(newCat);
    if (newCat === 'todas') return;

    // Se o modelo selecionado atualmente não pertence à categoria escolhida, selecionar o primeiro compatível
    const currentCat = selectedTemplate?.categoria || 'carta';
    if (currentCat !== newCat) {
      const firstMatch = templates.find((t) => (t.categoria || 'carta') === newCat);
      if (firstMatch) {
        handleSelectTemplate(firstMatch);
      }
    }
  };

  const handleNewTemplate = () => {
    lastSelectedTemplateRef.current = selectedTemplate;
    setDraftTitle('');
    setDraftKey('');
    setDraftTipo('custom');
    setDraftCategoria('carta');
    setShowNewModal(true);
  };

  const handleCancelNewTemplate = () => {
    setShowNewModal(false);
    setDraftTitle('');
    setDraftKey('');
    setDraftCategoria('carta');
  };

  const handleCreateDraft = () => {
    if (!draftTitle.trim()) {
      setNotification({
        isOpen: true,
        title: 'Aviso',
        message: 'Informe um titulo valido para o modelo.',
        type: 'warning',
        autoClose: 3000,
      });
      return;
    }
    const key = normalizeTemplateKey(draftTitle);
    const newCanvas = createDefaultCanvas();
    setDraftKey(key);
    setSelectedTemplate(null);
    setIsDraftReady(true);
    setCanvasContent(newCanvas);
    setSelectedCanvasElement(null);
    setSelectedCanvasElements([]);
    lastSavedSnapshotRef.current = JSON.stringify({
      title: draftTitle,
      canvas: newCanvas,
    });
    setShowNewModal(false);
  };

  const handleSaveTemplate = async () => {
    let targetMinistryId = ministryId;
    if (!targetMinistryId) {
      targetMinistryId = await fetchMinData();
      if (targetMinistryId) {
        setMinistryId(targetMinistryId);
      }
    }

    if (!targetMinistryId) {
      setNotification({
        isOpen: true,
        title: 'Aviso',
        message: 'Ministério não encontrado para salvar o modelo.',
        type: 'warning',
        autoClose: 3000,
      });
      return;
    }

    const baseKey = normalizeTemplateKey(draftKey || draftTitle);
    if (!draftTitle || !baseKey) {
      setNotification({
        isOpen: true,
        title: 'Aviso',
        message: 'Informe um titulo valido para o modelo.',
        type: 'warning',
        autoClose: 3000,
      });
      return;
    }

    const isCreatingNew = !selectedTemplate;

    const existingTenantKeys = new Set(
      templates.filter((tpl) => tpl.scope === 'tenant').map((tpl) => tpl.template_key)
    );
    const existingSystemKeys = new Set(Object.keys(systemTemplates));

    const buildUniqueKey = (key: string) => {
      let candidate = key;
      if (!existingTenantKeys.has(candidate) && !existingSystemKeys.has(candidate)) return candidate;
      candidate = `${key}-personalizado`;
      let counter = 2;
      while (existingTenantKeys.has(candidate) || existingSystemKeys.has(candidate)) {
        candidate = `${key}-personalizado-${counter}`;
        counter += 1;
      }
      return candidate;
    };

    const finalKey = isCreatingNew ? buildUniqueKey(baseKey) : baseKey;

    const inferredCategoria: TemplateCategoria =
      selectedTemplate?.categoria ||
      draftCategoria ||
      (['membro_ativo', 'batismo', 'cargo', 'apresentacao_crianca'].includes(draftTipo) ? 'declaracao' : 'carta');

    setIsSaving(true);
    try {
      const payload = {
        ministry_id: targetMinistryId,
        template_key: finalKey,
        title: draftTitle,
        tipo: draftTipo || 'custom',
        categoria: inferredCategoria,
        scope: 'tenant' as TemplateScope,
        content_json: serializeCanvasContent(canvasContent),
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      // Verificar se já existe um modelo no banco para este tenant com a mesma chave
      const { data: existingTenantDb } = await supabase
        .from('cartas_templates')
        .select('id')
        .eq('ministry_id', targetMinistryId)
        .eq('template_key', finalKey)
        .maybeSingle();

      const tenantTargetId =
        selectedTemplate?.scope === 'tenant'
          ? selectedTemplate.id
          : existingTenantDb?.id ||
            templates.find((tpl) => tpl.scope === 'tenant' && tpl.template_key === finalKey)?.id ||
            null;

      const { error } = tenantTargetId
        ? await supabase.from('cartas_templates').update(payload).eq('id', tenantTargetId)
        : await supabase.from('cartas_templates').insert(payload);

      if (error) throw error;

      lastSavedSnapshotRef.current = JSON.stringify({
        title: draftTitle,
        canvas: canvasContent,
      });

      setNotification({
        isOpen: true,
        title: 'Sucesso',
        message: 'Modelo salvo com sucesso!',
        type: 'success',
        autoClose: undefined,
      });

      if (typeof window !== 'undefined') {
        const container = document.getElementById('page-scroll-container');
        if (container) {
          container.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }

      setDraftKey(finalKey);
      await loadTemplates();
    } catch (err: any) {
      setNotification({
        isOpen: true,
        title: 'Erro',
        message: err?.message || 'Erro ao salvar modelo',
        type: 'error',
        autoClose: undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestoreNativeTemplate = (templateKey: string) => {
    if (!ministryId) return;
    const sysNative = DEFAULT_SYSTEM_TEMPLATES.find((s) => s.template_key === templateKey);
    if (!sysNative) return;

    setConfirmModal({
      isOpen: true,
      title: 'Restaurar Modelo Nativo',
      message: `Deseja restaurar a "${sysNative.title}" para o modelo nativo padrão do sistema? Suas alterações salvas para este modelo serão descartadas.`,
      confirmText: 'Restaurar Padrão',
      cancelText: 'Cancelar',
      variant: 'warning',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          setIsSaving(true);
          await supabase
            .from('cartas_templates')
            .delete()
            .eq('ministry_id', ministryId)
            .eq('template_key', templateKey);

          setNotification({
            isOpen: true,
            title: 'Modelo Restaurado',
            message: `O modelo "${sysNative.title}" foi restaurado para o padrão nativo original com sucesso.`,
            type: 'success',
            autoClose: 4000,
          });

          setSelectedTemplate({ ...sysNative });
          await loadTemplates();
        } catch (err: any) {
          setNotification({
            isOpen: true,
            title: 'Erro',
            message: err?.message || 'Erro ao restaurar modelo nativo',
            type: 'error',
            autoClose: undefined,
          });
        } finally {
          setIsSaving(false);
        }
      },
    });
  };

  const handleDeleteTenantTemplate = (templateId: string, title: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Modelo de Carta',
      message: `Tem certeza que deseja excluir permanentemente o modelo "${title}"? Esta ação não poderá ser desfeita.`,
      confirmText: 'Excluir Modelo',
      cancelText: 'Cancelar',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          setIsSaving(true);
          const { error } = await supabase.from('cartas_templates').delete().eq('id', templateId);
          if (error) throw error;

          setNotification({
            isOpen: true,
            title: 'Modelo Excluído',
            message: `O modelo "${title}" foi excluído com sucesso.`,
            type: 'success',
            autoClose: 3000,
          });

          setSelectedTemplate(null);
          await loadTemplates();
        } catch (err: any) {
          setNotification({
            isOpen: true,
            title: 'Erro',
            message: err?.message || 'Erro ao excluir modelo',
            type: 'error',
            autoClose: undefined,
          });
        } finally {
          setIsSaving(false);
        }
      },
    });
  };



  const updateCanvasElement = (id: string, props: Partial<CartaCanvasElement>) => {
    setCanvasContent((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => (el.id === id ? { ...el, ...props } : el)),
    }));
    setSelectedCanvasElement((prev) => (prev && prev.id === id ? { ...prev, ...props } : prev));
    setSelectedCanvasElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, ...props } : el))
    );
  };

  const updateMultipleCanvasElements = (
    updates: Array<{ id: string; propriedades: Partial<CartaCanvasElement> }>
  ) => {
    setCanvasContent((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => {
        const found = updates.find((u) => u.id === el.id);
        return found ? { ...el, ...found.propriedades } : el;
      }),
    }));
  };

  const addCanvasElements = (newElements: CartaCanvasElement[]) => {
    setCanvasContent((prev) => ({
      ...prev,
      elements: [...prev.elements, ...newElements],
    }));
  };

  const removeCanvasElement = (id: string) => {
    setCanvasContent((prev) => ({
      ...prev,
      elements: prev.elements.filter((el) => el.id !== id),
    }));
    setSelectedCanvasElements((prev) => prev.filter((el) => el.id !== id));
    if (selectedCanvasElement?.id === id) {
      setSelectedCanvasElement(null);
    }
  };

  const moveLayerUp = (id: string) => {
    setCanvasContent((prev) => {
      const idx = prev.elements.findIndex((el) => el.id === id);
      if (idx < 0 || idx >= prev.elements.length - 1) return prev;
      const copy = [...prev.elements];
      const temp = copy[idx];
      copy[idx] = copy[idx + 1];
      copy[idx + 1] = temp;
      return { ...prev, elements: copy };
    });
  };

  const moveLayerDown = (id: string) => {
    setCanvasContent((prev) => {
      const idx = prev.elements.findIndex((el) => el.id === id);
      if (idx <= 0) return prev;
      const copy = [...prev.elements];
      const temp = copy[idx];
      copy[idx] = copy[idx - 1];
      copy[idx - 1] = temp;
      return { ...prev, elements: copy };
    });
  };

  const bringToFront = (id: string) => {
    setCanvasContent((prev) => {
      const idx = prev.elements.findIndex((el) => el.id === id);
      if (idx < 0 || idx === prev.elements.length - 1) return prev;
      const target = prev.elements[idx];
      const filtered = prev.elements.filter((el) => el.id !== id);
      return { ...prev, elements: [...filtered, target] };
    });
  };

  const sendToBack = (id: string) => {
    setCanvasContent((prev) => {
      const idx = prev.elements.findIndex((el) => el.id === id);
      if (idx <= 0) return prev;
      const target = prev.elements[idx];
      const filtered = prev.elements.filter((el) => el.id !== id);
      return { ...prev, elements: [target, ...filtered] };
    });
  };

  const duplicateCanvasElement = (element: CartaCanvasElement) => {
    const offset = 16;
    const clone: CartaCanvasElement = {
      ...element,
      id: createElementId(),
      locked: false,
      x: Math.min(element.x + offset, canvasContent.width - element.largura),
      y: Math.min(element.y + offset, canvasContent.height - element.altura),
    };
    addCanvasElements([clone]);
    setSelectedCanvasElement(clone);
    setSelectedCanvasElements([clone]);
  };

  const toggleCanvasLock = (element: CartaCanvasElement) => {
    updateCanvasElement(element.id, { locked: !element.locked });
  };

  const addCanvasElement = (
    tipo: CartaCanvasElement['tipo'],
    overrides: Partial<CartaCanvasElement> = {}
  ) => {
    const isText = tipo === 'texto';
    const isLine = tipo === 'linha';
    const isForma = tipo === 'forma';
    const base: CartaCanvasElement = {
      id: createElementId(),
      tipo,
      x: 48,
      y: 48,
      largura: isLine ? 320 : isText ? 360 : isForma ? 240 : 200,
      altura: isLine ? 3 : isText ? 48 : isForma ? 160 : 140,
      fontSize: isText ? 16 : 12,
      fonte: 'Calibri',
      cor: isLine ? '#111827' : '#111827',
      backgroundColor: isForma ? '#f3f4f6' : undefined,
      borderColor: isForma ? '#374151' : undefined,
      borderWidth: isForma ? 1 : undefined,
      borderStyle: isForma ? 'solid' : undefined,
      borderRadius: isForma ? 4 : 0,
      alinhamento: 'left' as const,
      negrito: false,
      italico: false,
      sublinhado: false,
      texto: isText ? 'Digite o texto aqui' : isLine ? '' : undefined,
      imagemUrl: tipo === 'logo' ? (configIgreja.logo || '') : undefined,
      locked: false,
      visivel: true,
      ...overrides,
    };

    addCanvasElements([base]);
    setSelectedCanvasElement(base);
    setSelectedCanvasElements([base]);
  };



  const handleInsertPlaceholder = (key: string) => {
    if (!selectedCanvasElement || selectedCanvasElement.tipo !== 'texto') {
      setNotification({
        isOpen: true,
        title: 'Aviso',
        message: 'Selecione um elemento de texto no canvas para inserir o placeholder.',
        type: 'warning',
        autoClose: 3000,
      });
      return;
    }
    if (selectedCanvasElement.locked) {
      setNotification({
        isOpen: true,
        title: 'Aviso',
        message: 'Desbloqueie o elemento para editar o texto.',
        type: 'warning',
        autoClose: 3000,
      });
      return;
    }
    const currentText = selectedCanvasElement.texto || '';
    updateCanvasElement(selectedCanvasElement.id, { texto: `${currentText}{{${key}}}` });
  };

  const getAccessTokenOrThrow = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (error || !token) throw new Error('Nao autenticado');
    return token;
  };

  const uploadImageFile = async (file: File) => {
    const token = await getAccessTokenOrThrow();
    const form = new FormData();
    form.append('file', file);
    const response = await fetch('/api/v1/cartas/uploads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Falha no upload');
    return data.url as string;
  };

  const handleCanvasImageUpload = async (file: File, targetId?: string) => {
    // 1. Validação prévia de formato e tamanho (máx. 2 MB, JPG, PNG ou WebP)
    const validacao = CartasService.validarArquivoImagemCarta(file);
    if (!validacao.valido) {
      setNotification({
        isOpen: true,
        title: 'Arquivo Inválido',
        message: validacao.erro || 'Arquivo de imagem inválido.',
        type: 'warning',
        autoClose: 5000,
      });
      return;
    }

    // 2. Prevenção de envios concorrentes
    if (isUploadingImage) return;

    setIsUploadingImage(true);
    try {
      const url = await uploadImageFile(file);
      if (targetId) {
        updateCanvasElement(targetId, { imagemUrl: url });
        setNotification({
          isOpen: true,
          title: 'Imagem Atualizada',
          message: 'A imagem foi enviada com sucesso e aplicada ao elemento.',
          type: 'success',
          autoClose: 3500,
        });
      } else {
        addCanvasElement('imagem', { imagemUrl: url, largura: 260, altura: 180 });
        setNotification({
          isOpen: true,
          title: 'Imagem Inserida',
          message: 'Novo elemento de imagem adicionado ao documento.',
          type: 'success',
          autoClose: 3500,
        });
      }
    } catch (err: any) {
      setNotification({
        isOpen: true,
        title: 'Falha no Upload',
        message: err?.message || 'Não foi possível enviar a imagem. As alterações do documento foram preservadas.',
        type: 'error',
        autoClose: 5000,
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleCanvasBackgroundUpload = async (file: File) => {
    try {
      const url = await uploadImageFile(file);
      setCanvasContent((prev) => ({ ...prev, backgroundUrl: url }));
    } catch (err: any) {
      setNotification({
        isOpen: true,
        title: 'Erro',
        message: err?.message || 'Erro ao enviar background',
        type: 'error',
        autoClose: undefined,
      });
    }
  };

  const handleRegistrarPedidoDireto = async () => {
    if (!selectedMember || !selectedMemberId) {
      setNotification({
        isOpen: true,
        title: 'Membro Obrigatório',
        message: 'Selecione o membro destinatário antes de registrar o pedido para a Presidência.',
        type: 'warning',
        autoClose: 4000,
      });
      return;
    }

    if (!selectedTemplate) {
      setNotification({
        isOpen: true,
        title: 'Modelo Obrigatório',
        message: 'Selecione o modelo da carta antes de registrar o pedido.',
        type: 'warning',
        autoClose: 4000,
      });
      return;
    }

    const effMinistryId = ministryId || userCtx.ministryId;
    if (!effMinistryId) {
      setNotification({
        isOpen: true,
        title: 'Ministério Não Encontrado',
        message: 'Não foi possível identificar o ministério ativo.',
        type: 'error',
        autoClose: 4000,
      });
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = userCtx.userId || user?.id;
    if (!userId) {
      setNotification({
        isOpen: true,
        title: 'Acesso Não Autenticado',
        message: 'Usuário não autenticado. Faça login novamente.',
        type: 'error',
        autoClose: 4000,
      });
      return;
    }

    const tipoRaw = selectedTemplate.tipo || selectedTemplate.template_key;
    const tipoNormal = CartasService.normalizarTipoCarta(tipoRaw);
    const tipoLabel =
      tipoNormal === 'mudanca'
        ? 'Carta de Mudança'
        : tipoNormal === 'desligamento'
        ? 'Carta de Desligamento'
        : 'Carta Ministerial';

    setRegistrandoPedido(true);
    try {
      const res = await CartasService.solicitarAutorizacaoCarta(supabase, {
        ministryId: effMinistryId,
        memberId: selectedMember.id,
        membroNome: selectedMember.name,
        membroCargo: selectedMember.cargo_ministerial || null,
        congregacaoId: selectedMember.congregacao_id || (userCtx as any).congregacaoId || null,
        tipoCarta: tipoNormal,
        destino: issueFields.destino || null,
        motivo: issueFields.motivo || null,
        observacoes: issueFields.observacoes || null,
        solicitanteId: userId,
        solicitanteNome: userCtx.nivel === 'administrador' ? 'Administrador' : (user?.user_metadata?.nome || user?.email || 'Secretaria'),
      });

      // Se já houver um pedido pendente em análise, informa e evita duplicidade
      if (res.jaExistente) {
        setAutorizacaoStatus({
          exigeAutorizacao: true,
          autorizado: false,
          status: 'pendente',
          pedidoId: res.pedido.id,
          pedido: res.pedido,
          mensagem: res.mensagem,
        });

        setNotification({
          isOpen: true,
          title: 'Pedido já em Análise',
          message: res.mensagem,
          type: 'warning',
          autoClose: 6000,
        });
        return;
      }

      // Log de Auditoria
      try {
        await registrarAcao({
          acao: 'criar',
          modulo: 'secretaria',
          area: 'cartas',
          tabela_afetada: 'carta_pedidos',
          registro_id: res.pedido?.id,
          descricao: `Pedido de ${tipoLabel} registrado diretamente para ${selectedMember.name} (aguardando deliberação presidencial)`,
          dados_novos: {
            tipo_carta: tipoNormal,
            membro_nome: selectedMember.name,
            destino: issueFields.destino || null,
            status: 'pendente',
          },
          status: 'sucesso',
        });
      } catch (auditErr) {
        console.warn('Falha ao registrar log de auditoria:', auditErr);
      }

      // Atualiza imediatamente o estado da interface para "Aguardando deliberação da Presidência"
      setAutorizacaoStatus({
        exigeAutorizacao: true,
        autorizado: false,
        status: 'pendente',
        pedidoId: res.pedido.id,
        pedido: res.pedido,
        mensagem: `O pedido de ${tipoLabel} foi encaminhado e está aguardando deliberação da Presidência na Central de Decisões Institucionais.`,
      });

      setNotification({
        isOpen: true,
        title: 'Pedido Encaminhado à Presidência!',
        message: `A solicitação de ${tipoLabel} para "${selectedMember.name}" foi registrada diretamente com os dados preenchidos no formulário (destino, motivo e observações). O pedido já está disponível na Central de Decisões da Presidência para deliberação.`,
        type: 'success',
        autoClose: 7000,
      });
    } catch (err: any) {
      // Se o registro falhar, mantém os dados preenchidos na tela e apresenta o erro sem resetar o formulário
      setNotification({
        isOpen: true,
        title: 'Erro ao Registrar Pedido',
        message: err?.message || 'Falha ao registrar pedido de autorização presidencial. Seus dados foram mantidos no formulário.',
        type: 'error',
        autoClose: undefined,
      });
    } finally {
      setRegistrandoPedido(false);
    }
  };

  const handleIssueLetter = async () => {
    if (!selectedTemplate) return;
    const effMinistryId = ministryId || userCtx.ministryId;
    if (!effMinistryId) {
      setNotification({
        isOpen: true,
        title: 'Aviso',
        message: 'Ministério não encontrado.',
        type: 'warning',
        autoClose: 3000,
      });
      return;
    }

    if (!selectedMember) {
      setNotification({
        isOpen: true,
        title: 'Aviso',
        message: 'Selecione um membro para emitir a carta.',
        type: 'warning',
        autoClose: 3000,
      });
      return;
    }

    const docCategoria: TemplateCategoria = selectedTemplate.categoria || 'carta';
    const tipoCartaOuDoc = selectedTemplate.tipo || selectedTemplate.template_key;

    // Bloqueio obrigatório de governança: validação formal de deliberação presidencial
    let authResult: VerificacaoAutorizacaoCarta | null = null;
    try {
      authResult = await CartasService.validarEmissaoOuImpressaoCarta(
        supabase,
        effMinistryId,
        selectedMember.id,
        tipoCartaOuDoc,
        selectedMember.name,
        userCtx.nivel
      );
    } catch (authErr: any) {
      setNotification({
        isOpen: true,
        title: authErr?.message?.includes('Secretaria Local') ? 'Acesso Negado' : 'Emissão Bloqueada',
        message: authErr?.message || 'Não foi possível validar as permissões para emissão deste documento.',
        type: 'error',
        autoClose: undefined,
      });
      return;
    }

    setIsIssuing(true);
    try {
      // 1. Gerar identificador único da emissão documental antes de persistir
      const cartaRegistroId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const baseUrl =
        typeof window !== 'undefined' && window.location.origin
          ? window.location.origin
          : (process.env.NEXT_PUBLIC_APP_URL || 'https://www.gestaoeklesia.com.br');
      const qrDocUrl = `${baseUrl}/validar/documento/carta/${encodeURIComponent(cartaRegistroId)}`;

      // 2. Gerar QR Codes de autenticidade documental para os elementos do template
      const qrElements = (canvasContent.elements || []).filter(
        (el) => el.tipo === 'qrcode' && el.visivel !== false
      );
      const issueQrMap: Record<string, string> = {};

      for (const el of qrElements) {
        const qrSize = Math.min(el.largura, el.altura);
        const dataUrl = await QRCode.toDataURL(qrDocUrl, {
          width: Math.max(qrSize * 3, 200),
          margin: 1,
          color: {
            dark: el.cor || '#000000',
            light: '#ffffff',
          },
        });
        issueQrMap[el.id] = dataUrl;
      }

      const map = buildPlaceholderMap(selectedMember);
      const renderedHtml = renderCanvasHtml(canvasContent, map, issueQrMap);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const payload = {
        id: cartaRegistroId,
        ministry_id: effMinistryId,
        member_id: selectedMember.id,
        template_id: selectedTemplate.id,
        template_key: selectedTemplate.template_key,
        template_title: selectedTemplate.title,
        categoria: docCategoria,
        status: 'emitida',
        payload_snapshot: {
          ...map,
          pedido_id: authResult?.pedidoId || null,
          autorizador_id: authResult?.autorizadorId || null,
          autorizador_nome: authResult?.autorizadorNome || null,
          data_autorizacao: authResult?.dataAutorizacao || null,
        },
        template_snapshot: serializeCanvasContent(canvasContent),
        rendered_html: renderedHtml,
        issued_by: user?.id || null,
        issued_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('cartas_registros').insert(payload);
      if (error) throw error;

      // Requisito: Registrar no histórico do membro a emissão do documento (sem inativar)
      try {
        await CartasService.registrarEmissaoDocumentoNoHistoricoMembro(supabase, {
          memberId: selectedMember.id,
          ministryId: effMinistryId,
          documentoId: cartaRegistroId,
          tipoDocumento: selectedTemplate.title || selectedTemplate.template_key,
          categoria: docCategoria,
          tipoCarta: tipoCartaOuDoc,
          motivo: issueFields.motivo || issueFields.destino || null,
          destino: issueFields.destino || null,
          observacoes: issueFields.observacoes || null,
          usuarioNome: (user as any)?.user_metadata?.name || user?.email || 'Secretaria',
          usuarioId: user?.id || null,
        });
      } catch (histErr) {
        console.warn('Aviso: Falha ao registrar evento no histórico do membro:', histErr);
      }

      setNotification({
        isOpen: true,
        title: 'Sucesso',
        message: docCategoria === 'declaracao' ? 'Declaração emitida com sucesso!' : 'Carta emitida com sucesso!',
        type: 'success',
        autoClose: 3000,
      });

      await loadRecords();
      setActiveTab('historico');
    } catch (err: any) {
      setNotification({
        isOpen: true,
        title: 'Erro',
        message: err?.message || 'Erro ao emitir documento',
        type: 'error',
        autoClose: undefined,
      });
    } finally {
      setIsIssuing(false);
    }
  };

  const handlePrintHtml = (html: string, options?: { forceAllowed?: boolean }) => {
    if (!options?.forceAllowed && autorizacaoStatus.exigeAutorizacao && !autorizacaoStatus.autorizado) {
      setNotification({
        isOpen: true,
        title: 'Impressão Bloqueada',
        message: autorizacaoStatus.mensagem || 'Este documento exige deliberação prévia da Presidência e não pode ser impresso.',
        type: 'error',
        autoClose: undefined,
      });
      return;
    }

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Documento Oficial - Gestão Eklésia</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      font-family: Arial, sans-serif;
      color: #111;
      width: 100%;
      height: 100%;
    }
    .print-container {
      width: 100%;
      display: flex;
      justify-content: center;
      padding: 0;
      margin: 0;
    }
    .carta-documento {
      width: 794px;
      min-height: 1123px;
      position: relative;
      margin: 0 auto;
      background: #ffffff;
      overflow: hidden;
    }
    img {
      max-width: 100%;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    @media print {
      body {
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-container">
    <div class="carta-documento">${html}</div>
  </div>
</body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 350);
  };

  if (loading || userCtx.loading) return <div className="p-8">Carregando...</div>;
  if (bloqueado) return null;
  if (isSecretariaLocal(userCtx.nivel)) return null;

  return (
    <PageLayout
      title="Cartas e Declarações"
      description="Criar modelos, emitir e reimprimir cartas e declarações oficiais"
      activeMenu="cartas"
    >
      <NotificationModal
        isOpen={notification.isOpen}
        title={notification.title}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, isOpen: false }))}
        autoClose={notification.autoClose}
      />

      {pedidoParaAvaliar && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-1">Rejeitar Pedido de Carta</h3>
            <p className="text-sm text-gray-500 mb-4">
              {pedidoParaAvaliar.tipo_carta} —{' '}
              <strong className="text-gray-700">{pedidoParaAvaliar.membro_nome}</strong>
            </p>
            {pedidoParaAvaliar.observacoes && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 text-sm text-gray-600">
                <span className="text-xs text-gray-400 block mb-1">Observações do solicitante:</span>
                {pedidoParaAvaliar.observacoes}
              </div>
            )}
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo da rejeição <span className="text-red-500">*</span>
            </label>
            <textarea
              value={motivoRejeicaoPedido}
              onChange={(e) => setMotivoRejeicaoPedido(e.target.value)}
              rows={3}
              placeholder="Descreva o motivo da recusa para a congregação..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setPedidoParaAvaliar(null)}
                disabled={avaliandoPedido}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRejeitarPedido}
                disabled={avaliandoPedido}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
              >
                <XCircle size={15} /> Confirmar Rejeição
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative font-sans">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-[#fff7ed] via-white to-[#e0f2fe]" />
          <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-[#f97316]/15 blur-3xl" />
          <div className="absolute -left-10 bottom-0 h-72 w-72 rounded-full bg-[#0ea5e9]/15 blur-3xl" />
        </div>

        <div className="mb-6 rounded-2xl border border-white/70 bg-white/70 p-6 shadow-lg backdrop-blur motion-safe:animate-fade-in">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-amber-600">Secretaria geral</p>
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#123b63]">
                Cartas e Declarações com elegância e rapidez
              </h2>
              <p className="text-sm text-gray-600 max-w-xl">
                Crie modelos com identidade visual, emita em segundos e reimprima com consistência.
              </p>
            </div>
            <div className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
              <div
                className="rounded-xl border border-white/70 bg-white/80 p-3 text-center shadow-sm backdrop-blur motion-safe:animate-rise-in"
                style={{ animationDelay: '0.05s' }}
              >
                <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400">Modelos</p>
                <p className="text-lg font-semibold text-[#123b63]">{templates.length}</p>
              </div>
              <div
                className="rounded-xl border border-white/70 bg-white/80 p-3 text-center shadow-sm backdrop-blur motion-safe:animate-rise-in"
                style={{ animationDelay: '0.1s' }}
              >
                <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400">Emitidos</p>
                <p className="text-lg font-semibold text-[#123b63]">{records.length}</p>
              </div>
              <div
                className="rounded-xl border border-white/70 bg-white/80 p-3 text-center shadow-sm backdrop-blur motion-safe:animate-rise-in"
                style={{ animationDelay: '0.15s' }}
              >
                <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400">Última emissão</p>
                <p className="text-sm font-semibold text-[#123b63]">{lastIssuedLabel}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/70 bg-white/80 shadow-xl/10 backdrop-blur">
          <div className="p-4 md:p-6">
            <Tabs tabs={visibleTabs} activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'pedidos' && (
          <Section icon="📬" title="Pedidos de Cartas Recebidos">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-gray-100">
                <div>
                  <h3 className="text-base font-bold text-gray-800">Solicitações das Congregações</h3>
                  <p className="text-xs text-gray-500">
                    Analise e aprove os pedidos de cartas ministeriais encaminhados pelas secretarias locais.
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200 text-xs font-semibold">
                  {(['pendente', 'todos', 'autorizado', 'rejeitado'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setPedidosFiltroStatus(st)}
                      className={`px-3 py-1.5 rounded-lg transition capitalize ${
                        pedidosFiltroStatus === st
                          ? 'bg-white text-teal-800 shadow-sm border border-gray-200 font-bold'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {st === 'todos'
                        ? 'Todos'
                        : st === 'pendente'
                        ? `Pendentes (${pedidosPendentesCount})`
                        : st === 'autorizado'
                        ? 'Autorizados'
                        : 'Rejeitados'}
                    </button>
                  ))}
                </div>
              </div>

              {loadingPedidos ? (
                <div className="py-12 text-center text-gray-400 text-sm">Carregando solicitações...</div>
              ) : (
                (() => {
                  const filtered = pedidosRecebidos.filter((p) => {
                    if (pedidosFiltroStatus === 'todos') return true;
                    return p.status === pedidosFiltroStatus;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="py-16 text-center text-gray-400">
                        <FileCheck size={40} className="mx-auto mb-2 opacity-40" />
                        <p className="text-sm">Nenhum pedido encontrado com o filtro selecionado.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid gap-3">
                      {filtered.map((pedido) => {
                        const exigePresidencia = CartasService.exigeAutorizacaoPresidencial(pedido.tipo_carta);
                        return (
                          <div
                            key={pedido.id}
                            className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                          >
                            <div className="space-y-1.5 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-gray-800 text-base">{pedido.membro_nome}</span>
                                {pedido.membro_cargo && (
                                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                                    {pedido.membro_cargo}
                                  </span>
                                )}
                                <span
                                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                                    pedido.status === 'pendente'
                                      ? 'bg-amber-50 text-amber-700 border-amber-300'
                                      : pedido.status === 'autorizado'
                                      ? 'bg-green-50 text-green-700 border-green-300'
                                      : 'bg-red-50 text-red-700 border-red-300'
                                  }`}
                                >
                                  {pedido.status === 'pendente'
                                    ? 'Pendente'
                                    : pedido.status === 'autorizado'
                                    ? 'Autorizado'
                                    : 'Rejeitado'}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                                <span>
                                  Tipo:{' '}
                                  <strong>
                                    {pedido.tipo_carta === 'mudanca'
                                      ? 'Carta de Mudança'
                                      : pedido.tipo_carta === 'desligamento'
                                      ? 'Carta de Desligamento'
                                      : pedido.tipo_carta === 'transito'
                                      ? 'Carta de Trânsito'
                                      : 'Carta de Recomendação'}
                                  </strong>
                                </span>
                                {pedido.destino && <span>Destino: <strong>{pedido.destino}</strong></span>}
                                <span>Data: <strong>{new Date(pedido.created_at).toLocaleDateString('pt-BR')}</strong></span>
                                {pedido.solicitante_nome && <span>Solicitado por: <strong>{pedido.solicitante_nome}</strong></span>}
                              </div>
                              {pedido.observacoes && (
                                <p className="text-xs text-gray-500 italic bg-gray-50 rounded-lg p-2 border border-gray-100">
                                  "{pedido.observacoes}"
                                </p>
                              )}
                              {pedido.status === 'rejeitado' && pedido.motivo_rejeicao && (
                                <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2 border border-red-100">
                                  <strong>Motivo da rejeição:</strong> {pedido.motivo_rejeicao}
                                </p>
                              )}
                              {pedido.status === 'autorizado' && (
                                <p className="text-xs text-green-700">
                                  Autorizado por {pedido.autorizador_nome || 'Secretaria'} em{' '}
                                  {pedido.data_autorizacao
                                    ? new Date(pedido.data_autorizacao).toLocaleDateString('pt-BR')
                                    : '—'}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {pedido.status === 'pendente' && (
                                exigePresidencia ? (
                                  <div className="flex flex-col items-end gap-1">
                                    <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 font-medium">
                                      <Clock size={12} /> Exige deliberação da Presidência
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => router.push('/presidencia/decisoes')}
                                      className="text-xs text-blue-600 hover:text-blue-800 underline font-medium"
                                    >
                                      Abrir Central de Decisões →
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => { setPedidoParaAvaliar(pedido); setMotivoRejeicaoPedido(''); }}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold transition"
                                    >
                                      <XCircle size={13} /> Rejeitar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAutorizarPedido(pedido)}
                                      disabled={avaliandoPedido}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
                                    >
                                      <CheckCircle size={13} /> Autorizar
                                    </button>
                                  </div>
                                )
                              )}
                              {pedido.status === 'autorizado' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (pedido.member_id) setSelectedMemberId(pedido.member_id);
                                    setActiveTab('emitir');
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition"
                                >
                                  <FileCheck size={13} /> Emitir Carta Oficial
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          </Section>
        )}

        {activeTab === 'modelos' && (
          <Section icon="🧩" title="Modelos de Documentos">
            {/* Cabeçalho da Seção de Modelos com Botão de Novo Modelo */}
            <div className="mb-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-gray-100">
                <div>
                  <h3 className="text-base font-bold text-gray-800">Modelos de Documentos</h3>
                  <p className="text-xs text-gray-500">
                    Gerencie os modelos de cartas ministeriais e declarações oficiais do ministério.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleNewTemplate}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition shadow-sm self-start sm:self-auto"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Novo Modelo</span>
                </button>
              </div>

              {/* Segmented Control de Categoria */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50/80 p-1.5">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleCategoryFilterChange('todas')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                      categoriaFilter === 'todas'
                        ? 'bg-white text-teal-800 shadow-sm border border-gray-200'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Todos ({templates.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCategoryFilterChange('carta')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      categoriaFilter === 'carta'
                        ? 'bg-white text-blue-800 shadow-sm border border-blue-200'
                        : 'text-gray-600 hover:text-blue-800'
                    }`}
                  >
                    <span>📜</span>
                    <span>Cartas ({templates.filter((t) => (t.categoria || 'carta') === 'carta').length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCategoryFilterChange('declaracao')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      categoriaFilter === 'declaracao'
                        ? 'bg-white text-emerald-800 shadow-sm border border-emerald-200'
                        : 'text-gray-600 hover:text-emerald-800'
                    }`}
                  >
                    <span>📄</span>
                    <span>Declarações ({templates.filter((t) => t.categoria === 'declaracao').length})</span>
                  </button>
                </div>
                <div className="text-xs text-gray-500 font-medium px-2">
                  Exibindo {templates.filter((t) => categoriaFilter === 'todas' || (t.categoria || 'carta') === categoriaFilter).length} modelo(s)
                </div>
              </div>

              {/* Card Institucional: Modelo Selecionado */}
              <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Seletor Principal */}
                  <div className="flex-1 space-y-1.5 min-w-[280px]">
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        Modelo Ativo
                      </label>
                      {selectedTemplate && (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
                            selectedTemplate.categoria === 'declaracao'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-blue-50 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {selectedTemplate.categoria === 'declaracao' ? '📄 DECLARAÇÃO OFICIAL' : '📜 CARTA MINISTERIAL'}
                        </span>
                      )}
                    </div>
                    <select
                      value={selectedTemplate?.id || ''}
                      onChange={(e) => {
                        const tpl = templates.find((t) => t.id === e.target.value);
                        if (tpl) handleSelectTemplate(tpl);
                      }}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 shadow-sm"
                    >
                      <option value="" disabled>Selecione um modelo para editar</option>
                      {templates
                        .filter((t) => categoriaFilter === 'todas' || (t.categoria || 'carta') === categoriaFilter)
                        .map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.categoria === 'declaracao' ? '📄 [Declaração] ' : '📜 [Carta] '}{tpl.title}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Ações Secundárias Agrupadas */}
                  {selectedTemplate && (
                    <div className="flex flex-wrap items-center gap-2 self-end lg:self-center">
                      {DEFAULT_SYSTEM_TEMPLATES.some((s) => s.template_key === selectedTemplate.template_key) ? (
                        <button
                          type="button"
                          onClick={() => handleRestoreNativeTemplate(selectedTemplate.template_key)}
                          disabled={isSaving}
                          className="text-xs px-3 py-2 rounded-xl font-medium transition flex items-center gap-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
                          title="Restaurar este modelo para o padrão nativo do sistema"
                        >
                          <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
                          <span>Restaurar Nativo</span>
                        </button>
                      ) : (
                        selectedTemplate.scope === 'tenant' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteTenantTemplate(selectedTemplate.id, selectedTemplate.title)}
                            disabled={isSaving}
                            className="text-xs px-3 py-2 rounded-xl font-medium transition flex items-center gap-1.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                            title="Excluir este modelo"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-600" />
                            <span>Excluir</span>
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Visualização de Edição Direta do Modelo */}
            {selectedTemplate || isDraftReady ? (
              <div className="space-y-4">
                {/* ESTRUTURA DE 3 COLUNAS */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* COLUNA 1 (3 cols): PAINEL LATERAL ESQUERDO COM ABAS COMPACTAS */}
                  <div className="lg:col-span-3 space-y-3">
                    {/* Navegação de Abas do Painel Esquerdo */}
                    <div className="flex bg-gray-100/80 p-1 rounded-xl border border-gray-200 gap-1">
                      <button
                        type="button"
                        onClick={() => setActiveSidebarTab('elementos')}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                          activeSidebarTab === 'elementos'
                            ? 'bg-white text-teal-800 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <span>➕ Elementos</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSidebarTab('variaveis')}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                          activeSidebarTab === 'variaveis'
                            ? 'bg-white text-teal-800 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <span>{'{x}'} Variáveis</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSidebarTab('camadas')}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 relative ${
                          activeSidebarTab === 'camadas'
                            ? 'bg-white text-teal-800 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <span>🥞 Camadas</span>
                        {canvasContent.elements.length > 0 && (
                          <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-1.5 py-0.2 rounded-full">
                            {canvasContent.elements.length}
                          </span>
                        )}
                      </button>
                    </div>

                    {/* ABA 1: Adicionar Elementos */}
                    {activeSidebarTab === 'elementos' && (
                      <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-lg/10 backdrop-blur space-y-3">
                        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-100 pb-2">
                          Inserir no Canvas
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => addCanvasElement('texto')}
                            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-teal-50 hover:border-teal-300 transition shadow-sm"
                          >
                            <Type className="h-4 w-4 text-teal-600" />
                            <span>Texto</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => addCanvasElement('linha')}
                            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-teal-50 hover:border-teal-300 transition shadow-sm"
                          >
                            <Minus className="h-4 w-4 text-teal-600" />
                            <span>Linha</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => addCanvasElement('logo')}
                            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-teal-50 hover:border-teal-300 transition shadow-sm"
                          >
                            <Shield className="h-4 w-4 text-teal-600" />
                            <span>Logo</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => addCanvasElement('imagem')}
                            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-teal-50 hover:border-teal-300 transition shadow-sm"
                          >
                            <Image className="h-4 w-4 text-teal-600" />
                            <span>Imagem</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => addCanvasElement('forma')}
                            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-teal-50 hover:border-teal-300 transition shadow-sm"
                          >
                            <Square className="h-4 w-4 text-teal-600" />
                            <span>Forma</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => addCanvasElement('qrcode')}
                            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-teal-50 hover:border-teal-300 transition shadow-sm"
                          >
                            <span className="text-sm">📱</span>
                            <span>QR Code</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCanvasImageTargetId(null);
                              canvasImageInputRef.current?.click();
                            }}
                            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-teal-50 hover:border-teal-300 transition shadow-sm"
                          >
                            <Upload className="h-4 w-4 text-teal-600" />
                            <span>Upload</span>
                          </button>
                        </div>

                        <div className="pt-2 border-t border-gray-100 flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => canvasBackgroundInputRef.current?.click()}
                            className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition shadow-sm"
                          >
                            <Paintbrush className="h-3.5 w-3.5 text-teal-600" />
                            <span>Definir Imagem de Fundo</span>
                          </button>

                          {canvasContent.backgroundUrl && (
                            <button
                              type="button"
                              onClick={() => setCanvasContent((prev) => ({ ...prev, backgroundUrl: '' }))}
                              className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
                            >
                              <Eraser className="h-3.5 w-3.5" />
                              <span>Remover Fundo</span>
                            </button>
                          )}
                        </div>

                        <input
                          ref={canvasImageInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            const targetId = canvasImageTargetId ?? undefined;
                            e.currentTarget.value = '';
                            setCanvasImageTargetId(null);
                            if (file) {
                              handleCanvasImageUpload(file, targetId);
                            }
                          }}
                        />
                        <input
                          ref={canvasBackgroundInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleCanvasBackgroundUpload(file);
                            }
                            e.currentTarget.value = '';
                          }}
                        />
                      </div>
                    )}

                    {/* ABA 2: Placeholders (Variáveis) */}
                    {activeSidebarTab === 'variaveis' && (
                      <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-lg/10 backdrop-blur space-y-3">
                        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-100 pb-2">
                          Variáveis Dinâmicas
                        </h3>
                        <p className="text-[11px] text-gray-500">
                          Selecione um elemento de texto e clique no botão para inserir a variável.
                        </p>
                        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                          {PLACEHOLDER_GROUPS.map((group) => (
                            <div key={group.title}>
                              <p className="text-[11px] font-bold text-teal-800 mb-1">{group.title}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {group.items.map((item) => (
                                  <button
                                    key={item.key}
                                    onClick={() => handleInsertPlaceholder(item.key)}
                                    className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 hover:bg-teal-100 hover:text-teal-800 text-gray-700 transition font-medium border border-gray-200"
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ABA 3: CAMADAS (Organização de elementos do canvas) */}
                    {activeSidebarTab === 'camadas' && (
                      <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-lg/10 backdrop-blur space-y-3">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Lista de Camadas
                          </h3>
                          <span className="text-[10px] text-gray-400 font-semibold">
                            Frente no topo
                          </span>
                        </div>
                        
                        {canvasContent.elements.length === 0 ? (
                          <div className="py-8 text-center text-gray-400 space-y-1">
                            <p className="text-xs">Nenhuma camada criada.</p>
                            <p className="text-[10px]">Adicione um elemento na aba "Elementos".</p>
                          </div>
                        ) : (
                          /* Exibe as camadas invertidas (último elemento do array = camada da frente = topo da lista) */
                          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                            {canvasContent.elements.slice().reverse().map((el) => {
                              const isSelected = selectedCanvasElement?.id === el.id;
                              let labelResumido = CANVAS_ELEMENT_LABELS[el.tipo] || 'Elemento';
                              if (el.tipo === 'texto' && el.texto) {
                                labelResumido = el.texto.replace(/<[^>]*>?/gm, '').slice(0, 22) || 'Texto';
                              }

                              const renderIcon = () => {
                                switch (el.tipo) {
                                  case 'texto': return <Type className="h-3.5 w-3.5 text-teal-600" />;
                                  case 'linha': return <Minus className="h-3.5 w-3.5 text-teal-600" />;
                                  case 'logo': return <Shield className="h-3.5 w-3.5 text-teal-600" />;
                                  case 'imagem': return <Image className="h-3.5 w-3.5 text-teal-600" />;
                                  case 'qrcode': return <span className="text-xs">📱</span>;
                                  default: return <Type className="h-3.5 w-3.5 text-teal-600" />;
                                }
                              };

                              return (
                                <div
                                  key={el.id}
                                  onClick={() => {
                                    setSelectedCanvasElement(el);
                                    setSelectedCanvasElements([el]);
                                  }}
                                  className={`flex items-center justify-between p-2.5 rounded-xl text-xs cursor-pointer transition border ${
                                    isSelected
                                      ? 'bg-teal-600 text-white font-bold border-teal-700 shadow-sm'
                                      : 'bg-white text-gray-700 border-gray-200 hover:bg-teal-50/50'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <span className={`p-1 rounded-md ${isSelected ? 'bg-teal-700 text-white' : 'bg-gray-100'}`}>
                                      {renderIcon()}
                                    </span>
                                    <span className="truncate">{labelResumido}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        bringToFront(el.id);
                                      }}
                                      title="Trazer para a Frente Absoluta"
                                      className={`p-1 rounded hover:bg-black/10 transition ${isSelected ? 'text-white' : 'text-gray-500'}`}
                                    >
                                      <ArrowUpToLine className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        moveLayerUp(el.id);
                                      }}
                                      title="Subir uma Camada"
                                      className={`p-1 rounded hover:bg-black/10 transition ${isSelected ? 'text-white' : 'text-gray-500'}`}
                                    >
                                      <ChevronUp className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        moveLayerDown(el.id);
                                      }}
                                      title="Descer uma Camada"
                                      className={`p-1 rounded hover:bg-black/10 transition ${isSelected ? 'text-white' : 'text-gray-500'}`}
                                    >
                                      <ChevronDown className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        sendToBack(el.id);
                                      }}
                                      title="Enviar para o Fundo Absoluto"
                                      className={`p-1 rounded hover:bg-black/10 transition ${isSelected ? 'text-white' : 'text-gray-500'}`}
                                    >
                                      <ArrowDownToLine className="h-3 w-3" />
                                    </button>
                                    {el.locked && <Lock className="h-3 w-3 opacity-80 ml-1" />}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                  </div>

                  {/* COLUNA 2 (6 cols): CANVAS CENTRAL */}
                  <div className="lg:col-span-6 space-y-4">
                    {/* Área Principal de Renderização do Canvas (Sem barra superior duplicada) */}
                    <div className="rounded-2xl border border-gray-300 bg-gray-100 p-4 shadow-inner">
                      <div className="max-h-[780px] overflow-auto flex justify-center">
                        <InteractiveCanvas
                          elementos={canvasContent.elements}
                          elementoSelecionado={selectedCanvasElement}
                          elementosSelecionados={selectedCanvasElements}
                          getPreviewText={getCanvasPreviewText}
                          onElementoSelecionado={setSelectedCanvasElement}
                          onElementosSelecionados={setSelectedCanvasElements}
                          onElementoAtualizado={(id, props) => updateCanvasElement(id, props)}
                          onMultiplosElementosAtualizados={updateMultipleCanvasElements}
                          onElementosAdicionados={addCanvasElements}
                          onElementoRemovido={removeCanvasElement}
                          backgroundUrl={canvasContent.backgroundUrl}
                          showGrid
                          gridSize={24}
                          larguraCanvas={canvasContent.width}
                          alturaCanvas={canvasContent.height}
                        />
                      </div>
                    </div>
                  </div>

                  {/* COLUNA 3 (3 cols): PAINEL DE PROPRIEDADES COM AÇÕES CONSOLIDADAS */}
                  <div className="lg:col-span-3 space-y-4">
                    <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-lg/10 backdrop-blur space-y-4">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Propriedades
                        </h3>
                        {selectedCanvasElement && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => duplicateCanvasElement(selectedCanvasElement)}
                              title="Duplicar Elemento"
                              className="p-1 text-gray-500 hover:text-teal-700 hover:bg-teal-50 rounded transition"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleCanvasLock(selectedCanvasElement)}
                              title={selectedCanvasElement.locked ? 'Desbloquear Elemento' : 'Bloquear Elemento'}
                              className={`p-1 rounded transition ${
                                selectedCanvasElement.locked
                                  ? 'text-amber-700 bg-amber-50'
                                  : 'text-gray-500 hover:text-gray-700'
                              }`}
                            >
                              {selectedCanvasElement.locked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeCanvasElement(selectedCanvasElement.id)}
                              title="Excluir Elemento"
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {!selectedCanvasElement ? (
                        <div className="p-6 text-center text-gray-400 space-y-2">
                          <p className="text-xs font-semibold text-gray-500">Nenhum elemento selecionado.</p>
                          <p className="text-[11px]">Clique em um elemento no canvas ou na lista de Camadas para editar suas propriedades.</p>
                        </div>
                      ) : (
                        <div className="space-y-4 text-xs">
                          {/* Tipo e Ações */}
                          <div className="flex items-center justify-between bg-gray-50 p-2 rounded-lg border border-gray-100">
                            <div>
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">TIPO DE ELEMENTO</span>
                              <p className="font-bold text-teal-900">{CANVAS_ELEMENT_LABELS[selectedCanvasElement.tipo]}</p>
                            </div>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => duplicateCanvasElement(selectedCanvasElement)}
                                className="px-2 py-1 bg-white text-gray-700 border border-gray-200 rounded text-[10px] font-bold hover:bg-gray-50 transition"
                              >
                                Duplicar
                              </button>
                              <button
                                type="button"
                                onClick={() => removeCanvasElement(selectedCanvasElement.id)}
                                className="px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded text-[10px] font-bold hover:bg-red-100 transition"
                              >
                                Excluir
                              </button>
                            </div>
                          </div>

                          {/* Ordem da Camada / Nível z-index */}
                          <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">ORDEM DA CAMADA</span>
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onClick={() => bringToFront(selectedCanvasElement.id)}
                                className="flex items-center justify-center gap-1 py-1.5 px-2 bg-gray-50 hover:bg-teal-50 text-gray-700 hover:text-teal-800 border border-gray-200 rounded-lg text-[11px] font-semibold transition"
                                title="Mover para a frente de todos os elementos"
                              >
                                <ArrowUpToLine className="h-3.5 w-3.5 text-teal-600" />
                                <span>Para Frente</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => sendToBack(selectedCanvasElement.id)}
                                className="flex items-center justify-center gap-1 py-1.5 px-2 bg-gray-50 hover:bg-teal-50 text-gray-700 hover:text-teal-800 border border-gray-200 rounded-lg text-[11px] font-semibold transition"
                                title="Mover para trás de todos os elementos"
                              >
                                <ArrowDownToLine className="h-3.5 w-3.5 text-teal-600" />
                                <span>Para o Fundo</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => moveLayerUp(selectedCanvasElement.id)}
                                className="flex items-center justify-center gap-1 py-1.5 px-2 bg-gray-50 hover:bg-teal-50 text-gray-700 hover:text-teal-800 border border-gray-200 rounded-lg text-[11px] font-semibold transition"
                                title="Avançar 1 nível para cima"
                              >
                                <ChevronUp className="h-3.5 w-3.5 text-teal-600" />
                                <span>Avançar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => moveLayerDown(selectedCanvasElement.id)}
                                className="flex items-center justify-center gap-1 py-1.5 px-2 bg-gray-50 hover:bg-teal-50 text-gray-700 hover:text-teal-800 border border-gray-200 rounded-lg text-[11px] font-semibold transition"
                                title="Recuar 1 nível para baixo"
                              >
                                <ChevronDown className="h-3.5 w-3.5 text-teal-600" />
                                <span>Recuar</span>
                              </button>
                            </div>
                          </div>

                          {/* Posição e Dimensões */}
                          <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">POSIÇÃO E TAMANHO</span>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-semibold text-gray-500">Largura (W)</label>
                                <input
                                  type="number"
                                  value={selectedCanvasElement.largura}
                                  onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { largura: Number(e.target.value) || 0 })}
                                  className="w-full rounded border border-gray-200 px-2 py-1"
                                  disabled={selectedCanvasElement.locked}
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-gray-500">Altura (H)</label>
                                <input
                                  type="number"
                                  value={selectedCanvasElement.altura}
                                  onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { altura: Number(e.target.value) || 0 })}
                                  className="w-full rounded border border-gray-200 px-2 py-1"
                                  disabled={selectedCanvasElement.locked}
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-gray-500">Posição X</label>
                                <input
                                  type="number"
                                  value={selectedCanvasElement.x}
                                  onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { x: Number(e.target.value) || 0 })}
                                  className="w-full rounded border border-gray-200 px-2 py-1"
                                  disabled={selectedCanvasElement.locked}
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-gray-500">Posição Y</label>
                                <input
                                  type="number"
                                  value={selectedCanvasElement.y}
                                  onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { y: Number(e.target.value) || 0 })}
                                  className="w-full rounded border border-gray-200 px-2 py-1"
                                  disabled={selectedCanvasElement.locked}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Especificidades do Tipo Texto */}
                          {selectedCanvasElement.tipo === 'texto' && (
                            <>
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                    TAMANHO DA FONTE (PX)
                                  </label>
                                  <input
                                    type="number"
                                    min={8}
                                    max={120}
                                    value={selectedCanvasElement.fontSize || 14}
                                    onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { fontSize: Number(e.target.value) || 14 })}
                                    className="w-14 text-right rounded border border-gray-200 px-1.5 py-0.5 text-xs font-bold text-teal-900 focus:border-teal-500 focus:outline-none"
                                    disabled={selectedCanvasElement.locked}
                                  />
                                </div>
                                <input
                                  type="range"
                                  min={8}
                                  max={72}
                                  value={selectedCanvasElement.fontSize || 14}
                                  onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { fontSize: Number(e.target.value) || 14 })}
                                  className="w-full accent-teal-600 cursor-pointer"
                                  disabled={selectedCanvasElement.locked}
                                />
                              </div>

                              <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">FONTE</label>
                                <select
                                  value={selectedCanvasElement.fonte || 'Calibri'}
                                  onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { fonte: e.target.value })}
                                  className="w-full rounded border border-gray-200 px-2 py-1 bg-white"
                                  disabled={selectedCanvasElement.locked}
                                >
                                  {CANVAS_FONTES.map((font) => (
                                    <option key={font} value={font}>{font}</option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">FORMATAÇÃO E COR</label>
                                <div className="flex flex-wrap items-center gap-1.5 rounded border border-gray-200 bg-white p-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleTextInlineFormat('b')}
                                    className={`p-1 rounded ${selectedCanvasElement.negrito ? 'bg-teal-100 text-teal-800 font-bold' : 'text-gray-600'}`}
                                    disabled={selectedCanvasElement.locked}
                                    title="Negrito no trecho selecionado ou bloco"
                                  >
                                    <Bold className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleTextInlineFormat('i')}
                                    className={`p-1 rounded ${selectedCanvasElement.italico ? 'bg-teal-100 text-teal-800' : 'text-gray-600'}`}
                                    disabled={selectedCanvasElement.locked}
                                    title="Itálico no trecho selecionado ou bloco"
                                  >
                                    <Italic className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleTextInlineFormat('u')}
                                    className={`p-1 rounded ${selectedCanvasElement.sublinhado ? 'bg-teal-100 text-teal-800' : 'text-gray-600'}`}
                                    disabled={selectedCanvasElement.locked}
                                    title="Sublinhado no trecho selecionado ou bloco"
                                  >
                                    <Underline className="h-3.5 w-3.5" />
                                  </button>
                                  <div className="h-4 w-px bg-gray-200 mx-0.5" />
                                  {(['left', 'center', 'right'] as const).map((align) => (
                                    <button
                                      key={align}
                                      type="button"
                                      onClick={() => updateCanvasElement(selectedCanvasElement.id, { alinhamento: align })}
                                      className={`p-1 rounded ${selectedCanvasElement.alinhamento === align ? 'bg-teal-100 text-teal-800' : 'text-gray-600'}`}
                                      disabled={selectedCanvasElement.locked}
                                    >
                                      {align === 'left' ? <AlignLeft className="h-3.5 w-3.5" /> : align === 'center' ? <AlignCenter className="h-3.5 w-3.5" /> : <AlignRight className="h-3.5 w-3.5" />}
                                    </button>
                                  ))}
                                  <div className="h-4 w-px bg-gray-200 mx-0.5" />
                                  {/* Amostra de Cor Visível e Clicável */}
                                  <label
                                    className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 hover:bg-gray-100 cursor-pointer"
                                    title="Alterar Cor do Texto"
                                  >
                                    <span
                                      className="w-3.5 h-3.5 rounded-full border border-gray-300 shadow-inner inline-block"
                                      style={{ backgroundColor: selectedCanvasElement.cor || '#111827' }}
                                    />
                                    <input
                                      type="color"
                                      value={selectedCanvasElement.cor || '#111827'}
                                      onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { cor: e.target.value })}
                                      className="w-0 h-0 opacity-0 absolute"
                                      disabled={selectedCanvasElement.locked}
                                    />
                                  </label>
                                </div>
                              </div>

                              <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">CONTEÚDO</label>
                                <textarea
                                  ref={textareaRef}
                                  rows={4}
                                  value={selectedCanvasElement.texto || ''}
                                  onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { texto: e.target.value })}
                                  className="w-full rounded border border-gray-200 p-2 text-xs focus:border-teal-500 focus:outline-none font-mono"
                                  disabled={selectedCanvasElement.locked}
                                />
                              </div>
                            </>
                          )}

                          {/* Especificidades do Tipo Linha */}
                          {selectedCanvasElement.tipo === 'linha' && (
                            <div className="space-y-3">
                              <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">ESPESSURA DA LINHA</label>
                                <input
                                  type="range"
                                  min={1}
                                  max={12}
                                  value={selectedCanvasElement.altura}
                                  onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { altura: Number(e.target.value) || 2 })}
                                  className="w-full accent-teal-600"
                                  disabled={selectedCanvasElement.locked}
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">COR DA LINHA</label>
                                <input
                                  type="color"
                                  value={selectedCanvasElement.cor || '#111827'}
                                  onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { cor: e.target.value })}
                                  className="h-8 w-full rounded border border-gray-200 cursor-pointer"
                                  disabled={selectedCanvasElement.locked}
                                />
                              </div>
                            </div>
                          )}

                          {/* Especificidades do Tipo Forma / Retângulo */}
                          {selectedCanvasElement.tipo === 'forma' && (
                            <div className="space-y-3 border-t border-gray-100 pt-3">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">PROPRIEDADES DA FORMA</span>
                              
                              {/* Cor de Fundo / Preenchimento */}
                              <div>
                                <label className="text-[10px] font-semibold text-gray-500 block mb-1">Cor de Preenchimento</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={selectedCanvasElement.backgroundColor || '#f3f4f6'}
                                    onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { backgroundColor: e.target.value })}
                                    className="h-7 w-10 rounded border border-gray-200 cursor-pointer p-0.5"
                                    disabled={selectedCanvasElement.locked}
                                  />
                                  <input
                                    type="text"
                                    value={selectedCanvasElement.backgroundColor || '#f3f4f6'}
                                    onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { backgroundColor: e.target.value })}
                                    className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs uppercase"
                                    disabled={selectedCanvasElement.locked}
                                  />
                                </div>
                              </div>

                              {/* Cor do Contorno */}
                              <div>
                                <label className="text-[10px] font-semibold text-gray-500 block mb-1">Cor do Contorno (Borda)</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={selectedCanvasElement.borderColor || '#374151'}
                                    onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { borderColor: e.target.value })}
                                    className="h-7 w-10 rounded border border-gray-200 cursor-pointer p-0.5"
                                    disabled={selectedCanvasElement.locked}
                                  />
                                  <input
                                    type="text"
                                    value={selectedCanvasElement.borderColor || '#374151'}
                                    onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { borderColor: e.target.value })}
                                    className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs uppercase"
                                    disabled={selectedCanvasElement.locked}
                                  />
                                </div>
                              </div>

                              {/* Espessura e Estilo da Borda */}
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] font-semibold text-gray-500 block mb-1">Espessura (px)</label>
                                  <input
                                    type="number"
                                    min={0}
                                    max={30}
                                    value={selectedCanvasElement.borderWidth ?? 1}
                                    onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { borderWidth: Number(e.target.value) || 0 })}
                                    className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                                    disabled={selectedCanvasElement.locked}
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-semibold text-gray-500 block mb-1">Estilo do Contorno</label>
                                  <select
                                    value={selectedCanvasElement.borderStyle || 'solid'}
                                    onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { borderStyle: e.target.value as any })}
                                    className="w-full rounded border border-gray-200 px-2 py-1 text-xs bg-white"
                                    disabled={selectedCanvasElement.locked}
                                  >
                                    <option value="solid">Sólido</option>
                                    <option value="dashed">Tracejado</option>
                                    <option value="dotted">Pontilhado</option>
                                  </select>
                                </div>
                              </div>

                              {/* Arredondamento dos Cantos */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-[10px] font-semibold text-gray-500">Arredondamento dos Cantos (px)</label>
                                  <span className="text-xs font-bold text-teal-800">{selectedCanvasElement.borderRadius || 0}px</span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={100}
                                  value={selectedCanvasElement.borderRadius || 0}
                                  onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { borderRadius: Number(e.target.value) || 0 })}
                                  className="w-full accent-teal-600"
                                  disabled={selectedCanvasElement.locked}
                                />
                              </div>

                              {/* Transparência */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-[10px] font-semibold text-gray-500">Opacidade / Transparência</label>
                                  <span className="text-xs font-bold text-teal-800">{Math.round((selectedCanvasElement.transparencia ?? 1) * 100)}%</span>
                                </div>
                                <input
                                  type="range"
                                  min={0.1}
                                  max={1}
                                  step={0.05}
                                  value={selectedCanvasElement.transparencia ?? 1}
                                  onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { transparencia: Number(e.target.value) })}
                                  className="w-full accent-teal-600"
                                  disabled={selectedCanvasElement.locked}
                                />
                              </div>
                            </div>
                          )}

                          {/* Especificidades do Tipo Imagem */}
                          {selectedCanvasElement.tipo === 'imagem' && (
                            <div className="space-y-3 border-t border-gray-100 pt-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                  Origem da Imagem
                                </span>
                                {isUploadingImage && (
                                  <span className="text-[11px] font-medium text-teal-600 flex items-center gap-1">
                                    <RotateCcw className="h-3 w-3 animate-spin" />
                                    Enviando...
                                  </span>
                                )}
                              </div>

                              {/* Pré-visualização da imagem atual e botão de remoção rápida */}
                              {selectedCanvasElement.imagemUrl ? (
                                <div className="space-y-2">
                                  <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-2.5 flex items-center gap-3">
                                    <div className="h-14 w-14 rounded-lg border border-gray-200 bg-white overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                                      <img
                                        src={selectedCanvasElement.imagemUrl}
                                        alt="Pré-visualização da imagem"
                                        className="h-full w-full object-contain"
                                        onError={(e) => {
                                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                                        }}
                                      />
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-0.5">
                                      <p
                                        className="text-[11px] font-medium text-gray-700 truncate"
                                        title={selectedCanvasElement.imagemUrl}
                                      >
                                        {selectedCanvasElement.imagemUrl.split('/').pop() || 'Imagem do elemento'}
                                      </p>
                                      <p className="text-[10px] text-gray-400">
                                        Dimensões: {selectedCanvasElement.largura} × {selectedCanvasElement.altura} px
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => updateCanvasElement(selectedCanvasElement.id, { imagemUrl: '' })}
                                      disabled={selectedCanvasElement.locked || isUploadingImage}
                                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                                      title="Remover imagem do elemento (sem excluir o elemento)"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => updateCanvasElement(selectedCanvasElement.id, { imagemUrl: '' })}
                                    disabled={selectedCanvasElement.locked || isUploadingImage}
                                    className="text-[11px] font-semibold text-red-600 hover:text-red-700 underline inline-flex items-center gap-1 disabled:opacity-50"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    <span>Remover imagem</span>
                                  </button>
                                </div>
                              ) : null}

                              {/* Botão de Envio de Imagem do Computador */}
                              <div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isUploadingImage || selectedCanvasElement.locked) return;
                                    setCanvasImageTargetId(selectedCanvasElement.id);
                                    canvasImageInputRef.current?.click();
                                  }}
                                  disabled={selectedCanvasElement.locked || isUploadingImage}
                                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50/70 hover:bg-teal-100/80 px-3 py-2 text-xs font-semibold text-teal-800 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isUploadingImage ? (
                                    <>
                                      <RotateCcw className="h-3.5 w-3.5 animate-spin text-teal-700" />
                                      <span>Enviando imagem...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="h-3.5 w-3.5 text-teal-700" />
                                      <span>
                                        {selectedCanvasElement.imagemUrl
                                          ? 'Substituir imagem do computador'
                                          : 'Enviar imagem do computador'}
                                      </span>
                                    </>
                                  )}
                                </button>
                                <p className="text-[10px] text-gray-400 text-center mt-1">
                                  Formatos aceitos: JPG, PNG e WebP (máx. 2 MB)
                                </p>
                              </div>

                              {/* Campo de URL Externa (Preservado) */}
                              <div className="space-y-1 pt-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                  OU INFORME UMA URL EXTERNA
                                </label>
                                <input
                                  type="text"
                                  value={selectedCanvasElement.imagemUrl || ''}
                                  onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { imagemUrl: e.target.value })}
                                  className="w-full rounded-lg border border-gray-200 p-2 text-xs focus:border-teal-500 focus:outline-none"
                                  placeholder="https://..."
                                  disabled={selectedCanvasElement.locked || isUploadingImage}
                                />
                              </div>
                            </div>
                          )}

                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* Barra Institucional de Salvamento com Status */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl border border-gray-200 bg-white/95 shadow-sm backdrop-blur">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                        isDirty
                          ? 'bg-amber-50 text-amber-800 border border-amber-300'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${isDirty ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                      {isDirty ? 'Alterações não salvas' : 'Modelo atualizado'}
                    </span>
                    {selectedTemplate?.scope === 'system' && (
                      <span className="text-[11px] text-gray-500 font-medium">
                        (Modelo nativo — salvar criará sua versão personalizada)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveTemplate}
                      disabled={isSaving || (!isDirty && !isDraftReady)}
                      className={`px-6 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm ${
                        isSaving || (!isDirty && !isDraftReady)
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300'
                          : 'bg-teal-600 hover:bg-teal-700 text-white shadow-md'
                      }`}
                    >
                      <Save className="h-4 w-4" />
                      <span>
                        {isSaving
                          ? 'Salvando Modelo...'
                          : selectedTemplate?.scope === 'system'
                          ? 'Salvar como Modelo Personalizado'
                          : 'Salvar Modelo'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Estado Vazio quando não há nenhum modelo cadastrado/selecionado */
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white/80 p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mx-auto text-xl font-bold">
                  🧩
                </div>
                <h4 className="text-base font-bold text-gray-800">Nenhum modelo selecionado</h4>
                <p className="text-xs text-gray-500 max-w-md mx-auto">
                  Selecione um modelo no seletor acima ou clique em <span className="font-semibold text-teal-700">+ Novo Modelo</span> para criar um novo documento personalizado.
                </p>
                <button
                  type="button"
                  onClick={handleNewTemplate}
                  className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white text-xs font-bold rounded-xl hover:bg-teal-700 transition shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Novo Modelo</span>
                </button>
              </div>
            )}
          </Section>
        )}

        {activeTab === 'emitir' && (
          <Section icon="📄" title="Emitir Documento">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Formulário Guiado em Passos (Coluna Esquerda) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm space-y-5 backdrop-blur">
                  
                  {/* Passo 1: Tipo de Documento */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-[11px] font-bold text-teal-800">
                        1
                      </span>
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Tipo de Documento
                      </label>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-100 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setEmitirCategoria('todas')}
                        className={`py-2 text-xs font-bold rounded-lg transition ${
                          emitirCategoria === 'todas'
                            ? 'bg-white text-teal-800 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Todos
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmitirCategoria('carta')}
                        className={`py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 ${
                          emitirCategoria === 'carta'
                            ? 'bg-white text-blue-800 shadow-sm'
                            : 'text-gray-600 hover:text-blue-800'
                        }`}
                      >
                        <span>📜</span>
                        <span>Cartas</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmitirCategoria('declaracao')}
                        className={`py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 ${
                          emitirCategoria === 'declaracao'
                            ? 'bg-white text-emerald-800 shadow-sm'
                            : 'text-gray-600 hover:text-emerald-800'
                        }`}
                      >
                        <span>📄</span>
                        <span>Declarações</span>
                      </button>
                    </div>
                  </div>

                  {/* Passo 2: Seleção do Modelo */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-[11px] font-bold text-teal-800">
                          2
                        </span>
                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Modelo do Documento
                        </label>
                      </div>
                      {selectedTemplate && (
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                            selectedTemplate.categoria === 'declaracao'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-blue-50 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {selectedTemplate.categoria === 'declaracao' ? '📄 Declaração' : '📜 Carta'}
                        </span>
                      )}
                    </div>
                    <select
                      value={selectedTemplate?.id || ''}
                      onChange={(e) => {
                        const tpl = templatesFiltrados.find((t) => t.id === e.target.value);
                        if (tpl) handleSelectTemplate(tpl);
                      }}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-gray-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 shadow-sm"
                    >
                      <option value="" disabled>Selecione o modelo desejado</option>
                      {templatesFiltrados
                        .filter((t) => emitirCategoria === 'todas' || (t.categoria || 'carta') === emitirCategoria)
                        .map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.categoria === 'declaracao' ? '📄 [Declaração] ' : '📜 [Carta] '}{tpl.title}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Aviso de Cartas com deliberação presidencial obrigatória */}
                  {selectedTemplate && CartasService.exigeAutorizacaoPresidencial(selectedTemplate.tipo || selectedTemplate.template_key) && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 space-y-2">
                      <div className="flex items-center gap-2 text-amber-800">
                        <span className="text-sm">⚠️</span>
                        <p className="text-xs font-bold">Carta de Mudança ou Desligamento?</p>
                      </div>
                      <p className="text-xs text-amber-700 leading-relaxed">
                        Essas cartas exigem autorização da Presidência. Preencha os dados abaixo e clique diretamente em <strong>“Registrar Pedido de Carta”</strong> para encaminhar à deliberação presidencial sem sair desta tela.
                      </p>
                    </div>
                  )}

                  {/* Passo 3: Selecione o Membro */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-[11px] font-bold text-teal-800">
                        3
                      </span>
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Membro Destinatário
                      </label>
                    </div>
                    <select
                      value={selectedMemberId}
                      onChange={(e) => setSelectedMemberId(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs font-medium text-gray-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 shadow-sm"
                    >
                      <option value="">Selecione o membro...</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} {m.cargo_ministerial ? `(${m.cargo_ministerial})` : ''}
                        </option>
                      ))}
                    </select>

                    {/* Resumo do Membro Selecionado */}
                    {selectedMember && (
                      <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-2.5 text-xs text-teal-900 flex items-center justify-between">
                        <div>
                          <p className="font-bold">{selectedMember.name}</p>
                          <p className="text-[11px] text-teal-700">
                            {selectedMember.email || selectedMember.phone || 'Sem contato cadastrado'}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                          {selectedMember.status || 'Ativo'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Passo 4: Informações Adicionais */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-[11px] font-bold text-teal-800">
                        4
                      </span>
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Informações do Documento
                      </label>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-500 block mb-1">
                        Destino / Finalidade
                      </label>
                      <input
                        value={issueFields.destino}
                        onChange={(e) => setIssueFields((prev) => ({ ...prev, destino: e.target.value }))}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 shadow-sm"
                        placeholder="Ex: Igreja Evangélica Betel / Fins acadêmicos"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-500 block mb-1">
                        Motivo
                      </label>
                      <textarea
                        rows={2}
                        value={issueFields.motivo}
                        onChange={(e) => setIssueFields((prev) => ({ ...prev, motivo: e.target.value }))}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 shadow-sm"
                        placeholder="Descreva o motivo ou justificativa"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-500 block mb-1">
                        Observações Complementares
                      </label>
                      <textarea
                        rows={2}
                        value={issueFields.observacoes}
                        onChange={(e) => setIssueFields((prev) => ({ ...prev, observacoes: e.target.value }))}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 shadow-sm"
                        placeholder="Observações internas ou adicionais"
                      />
                    </div>
                  </div>

                  {/* Passo 5: Ação de Emissão */}
                  <div className="pt-2 border-t border-gray-100 space-y-3">
                    {/* Alertas e Status da Deliberação Presidencial */}
                    {autorizacaoStatus.exigeAutorizacao && selectedMemberId && (
                      <div>
                        {autorizacaoStatus.status === 'pendente' && (
                          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 space-y-2">
                            <div className="flex items-center gap-1.5 text-amber-800 text-xs font-bold">
                              <Clock className="h-4 w-4 shrink-0 text-amber-600" />
                              <span>Aguardando Deliberação da Presidência</span>
                            </div>
                            <p className="text-[11px] text-amber-700 leading-relaxed">
                              {autorizacaoStatus.mensagem}
                            </p>
                            <div className="flex items-center justify-between pt-1 text-[11px]">
                              <button
                                type="button"
                                onClick={() => checkAuth()}
                                disabled={verificandoAutorizacao}
                                className="inline-flex items-center gap-1 font-semibold text-amber-800 hover:text-amber-950 underline disabled:opacity-50"
                              >
                                <RotateCcw className={`h-3 w-3 ${verificandoAutorizacao ? 'animate-spin' : ''}`} />
                                <span>{verificandoAutorizacao ? 'Verificando...' : 'Verificar deliberação'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => router.push('/secretaria/cartas/pedidos')}
                                className="inline-flex items-center gap-1 font-semibold text-amber-900 underline hover:text-amber-950"
                              >
                                Ver lista de pedidos &rarr;
                              </button>
                            </div>
                          </div>
                        )}

                        {autorizacaoStatus.status === 'rejeitado' && (
                          <div className="rounded-xl border border-red-300 bg-red-50 p-3.5 space-y-2">
                            <div className="flex items-center gap-1.5 text-red-800 text-xs font-bold">
                              <XCircle className="h-4 w-4 shrink-0 text-red-600" />
                              <span>Pedido Indeferido pela Presidência</span>
                            </div>
                            <p className="text-[11px] text-red-700 leading-relaxed">
                              {autorizacaoStatus.mensagem}
                            </p>
                            {autorizacaoStatus.motivoRejeicao && (
                              <p className="text-[11px] text-red-800 font-medium bg-red-100/70 rounded px-2.5 py-1.5 border border-red-200">
                                <strong>Justificativa registrada:</strong> {autorizacaoStatus.motivoRejeicao}
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={handleRegistrarPedidoDireto}
                              disabled={registrandoPedido || !selectedMemberId || !selectedTemplate}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition shadow-sm mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {registrandoPedido ? (
                                <>
                                  <span className="inline-block animate-spin mr-1">⏳</span>
                                  <span>Encaminhando novo pedido...</span>
                                </>
                              ) : (
                                <>
                                  <Send className="h-3 w-3" />
                                  <span>Reenviar Pedido com Justificativa Ajustada</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        {autorizacaoStatus.status === 'nao_solicitado' && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 space-y-2">
                            <div className="flex items-center gap-1.5 text-amber-800 text-xs font-bold">
                              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                              <span>Autorização Presidencial Obrigatória</span>
                            </div>
                            <p className="text-[11px] text-amber-700 leading-relaxed">
                              {autorizacaoStatus.mensagem}
                            </p>
                            <button
                              type="button"
                              onClick={handleRegistrarPedidoDireto}
                              disabled={registrandoPedido || !selectedMemberId || !selectedTemplate}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-amber-700 transition shadow-sm mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {registrandoPedido ? (
                                <>
                                  <span className="inline-block animate-spin mr-1">⏳</span>
                                  <span>Encaminhando à Presidência...</span>
                                </>
                              ) : (
                                <>
                                  <Send className="h-3.5 w-3.5" />
                                  <span>Registrar Pedido de Carta</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        {autorizacaoStatus.status === 'autorizado' && (
                          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 space-y-1">
                            <div className="flex items-center gap-1.5 text-emerald-800 text-xs font-bold">
                              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                              <span>Autorizado pela Presidência</span>
                            </div>
                            <p className="text-[11px] text-emerald-700 leading-relaxed">
                              {autorizacaoStatus.mensagem}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleIssueLetter}
                      className="w-full rounded-xl bg-teal-600 px-4 py-3 text-xs font-bold text-white hover:bg-teal-700 shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={
                        isIssuing ||
                        verificandoAutorizacao ||
                        !selectedTemplate ||
                        !selectedMemberId ||
                        (autorizacaoStatus.exigeAutorizacao && !autorizacaoStatus.autorizado)
                      }
                    >
                      <FileCheck className="h-4 w-4" />
                      <span>
                        {isIssuing
                          ? 'Emitindo Documento...'
                          : verificandoAutorizacao
                          ? 'Verificando autorização presidencial...'
                          : autorizacaoStatus.exigeAutorizacao && !autorizacaoStatus.autorizado
                          ? 'Emissão Bloqueada (Aguardando Presidência)'
                          : selectedTemplate?.categoria === 'declaracao'
                          ? 'Emitir Declaração Oficial'
                          : 'Emitir Carta Ministerial'}
                      </span>
                    </button>
                    {!selectedMemberId && (
                      <p className="text-[11px] text-center text-gray-400 mt-1.5">
                        * Selecione um membro para habilitar a emissão.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Pré-visualização do Documento em A4 (Coluna Direita) */}
              <div className="lg:col-span-7">
                <div className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">👁️</span>
                      <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Pré-visualização em Tempo Real (A4)
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePrintHtml(previewHtml)}
                      disabled={autorizacaoStatus.exigeAutorizacao && !autorizacaoStatus.autorizado}
                      title={
                        autorizacaoStatus.exigeAutorizacao && !autorizacaoStatus.autorizado
                          ? 'Impressão bloqueada até deliberação da Presidência'
                          : 'Imprimir ou salvar em PDF'
                      }
                      className="rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-teal-50 hover:text-teal-800 transition flex items-center gap-1.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Printer className="h-3.5 w-3.5 text-gray-600" />
                      <span>Imprimir / PDF</span>
                    </button>
                  </div>

                  {autorizacaoStatus.exigeAutorizacao && !autorizacaoStatus.autorizado && (
                    <div className="bg-amber-100 border border-amber-300 text-amber-900 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-700 shrink-0" />
                      <span>
                        Documento Não Autorizado — Impressão oficial bloqueada até deliberação prévia da Presidência na Central de Decisões.
                      </span>
                    </div>
                  )}

                  <div
                    className="relative min-h-[500px] max-h-[820px] rounded-xl border border-gray-200 bg-gray-100 p-4 shadow-inner overflow-auto flex justify-center"
                  >
                    <div
                      className="bg-white shadow-md relative"
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Section>
        )}

        {activeTab === 'historico' && (
          <Section icon="🗂️" title="Histórico de Documentos Emitidos">
            <div className="space-y-4">
              {/* Barra de Filtros e Busca no Histórico */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm backdrop-blur">
                {/* Filtro por Categoria */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-gray-600 uppercase tracking-wider mr-1">Filtrar:</span>
                  <button
                    type="button"
                    onClick={() => setHistoricoCategoria('todas')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      historicoCategoria === 'todas'
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Todos ({records.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoricoCategoria('carta')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      historicoCategoria === 'carta'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    <span>📜</span>
                    <span>Cartas ({records.filter((r) => (r.categoria || 'carta') === 'carta').length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoricoCategoria('declaracao')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      historicoCategoria === 'declaracao'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    <span>📄</span>
                    <span>Declarações ({records.filter((r) => r.categoria === 'declaracao').length})</span>
                  </button>
                </div>

                {/* Campo de Busca */}
                <div className="flex-1 min-w-[220px] max-w-md">
                  <input
                    type="text"
                    value={historicoBusca}
                    onChange={(e) => setHistoricoBusca(e.target.value)}
                    placeholder="Buscar por título ou destinatário..."
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 shadow-sm"
                  />
                </div>
              </div>

              {/* Lista de Registros */}
              <div className="rounded-2xl border border-white/70 bg-white/85 p-5 shadow-xl/10 backdrop-blur">
                <div className="space-y-3">
                  {records
                    .filter((rec) => {
                      const matchesCat =
                        historicoCategoria === 'todas' ||
                        (rec.categoria || 'carta') === historicoCategoria;
                      if (!matchesCat) return false;
                      if (!historicoBusca.trim()) return true;
                      const term = historicoBusca.toLowerCase();
                      const title = (rec.template_title || rec.template_key || '').toLowerCase();
                      const membroNome = String((rec.payload_snapshot as any)?.['membro.nome'] || '').toLowerCase();
                      return title.includes(term) || membroNome.includes(term);
                    })
                    .map((rec) => {
                      const isDeclaracao = rec.categoria === 'declaracao';
                      const snapshot = (rec.payload_snapshot && typeof rec.payload_snapshot === 'object') ? rec.payload_snapshot as Record<string, any> : {};
                      const membroNome = snapshot['membro.nome'] || snapshot['membro_nome'] || '';
                      return (
                        <div
                          key={rec.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white/90 p-4 shadow-sm hover:border-teal-200 transition"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  isDeclaracao
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                                }`}
                              >
                                {isDeclaracao ? '📄 Declaração' : '📜 Carta'}
                              </span>
                              <p className="text-sm font-semibold text-gray-800">
                                {rec.template_title || rec.template_key || (isDeclaracao ? 'Declaração' : 'Carta')}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                              {membroNome && (
                                <span>
                                  <strong>Membro:</strong> {membroNome}
                                </span>
                              )}
                              <span>
                                <strong>Emitido em:</strong>{' '}
                                {rec.issued_at ? new Date(rec.issued_at).toLocaleDateString('pt-BR') : '-'}
                              </span>
                              {rec.status && (
                                <span className="capitalize">
                                  <strong>Status:</strong> {rec.status}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handlePrintHtml(rec.rendered_html || previewHtml, { forceAllowed: true })}
                            className="rounded-lg bg-gray-100 px-3.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-teal-50 hover:text-teal-700 border border-gray-200 transition flex items-center gap-1.5"
                          >
                            <span>🖨️</span>
                            <span>Reimprimir</span>
                          </button>
                        </div>
                      );
                    })}
                  {!records.filter((rec) => {
                    const matchesCat =
                      historicoCategoria === 'todas' ||
                      (rec.categoria || 'carta') === historicoCategoria;
                    if (!matchesCat) return false;
                    if (!historicoBusca.trim()) return true;
                    const term = historicoBusca.toLowerCase();
                    const title = (rec.template_title || rec.template_key || '').toLowerCase();
                    const membroNome = String((rec.payload_snapshot as any)?.['membro.nome'] || '').toLowerCase();
                    return title.includes(term) || membroNome.includes(term);
                  }).length && (
                    <div className="py-8 text-center text-sm text-gray-500 space-y-1">
                      <p>Nenhum documento emitido encontrado com os filtros atuais.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Section>
        )}
            </Tabs>
        </div>
      </div>

      {/* Modal Compacto de Criar Novo Modelo */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-gray-100 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <span>🧩</span> Criar Novo Modelo de Documento
              </h3>
              <button
                type="button"
                onClick={handleCancelNewTemplate}
                className="text-gray-400 hover:text-gray-600 font-bold text-sm px-2 py-1 rounded"
              >
                ✕
              </button>
            </div>

            {/* Seletor de Categoria do Novo Modelo */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Categoria do Documento
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDraftCategoria('carta')}
                  className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 ${
                    draftCategoria === 'carta'
                      ? 'border-blue-500 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20'
                      : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="text-lg">📜</span>
                  <div>
                    <p className="text-xs font-bold">Carta</p>
                    <p className="text-[11px] text-gray-500">Recomendação, mudança, etc.</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setDraftCategoria('declaracao')}
                  className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 ${
                    draftCategoria === 'declaracao'
                      ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 ring-2 ring-emerald-500/20'
                      : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="text-lg">📄</span>
                  <div>
                    <p className="text-xs font-bold">Declaração</p>
                    <p className="text-[11px] text-gray-500">Membro ativo, batismo, cargo</p>
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Nome do Modelo
              </label>
              <input
                type="text"
                autoFocus
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateDraft();
                  }
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                placeholder={draftCategoria === 'declaracao' ? 'Ex: Declaração de Membro Ativo' : 'Ex: Carta de Mudança de Membro'}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={handleCancelNewTemplate}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateDraft}
                className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 shadow-sm transition"
              >
                Criar e Abrir Editor
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Confirmação Personalizado */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-150">
            {/* Cabeçalho */}
            <div
              className={`flex items-center gap-3 px-6 py-4 border-b ${
                confirmModal.variant === 'danger'
                  ? 'border-red-500 bg-gradient-to-r from-red-600 to-red-700 text-white'
                  : confirmModal.variant === 'warning'
                  ? 'border-amber-500 bg-gradient-to-r from-amber-500 to-amber-600 text-white'
                  : 'border-teal-500 bg-gradient-to-r from-teal-600 to-teal-700 text-white'
              }`}
            >
              <span className="text-2xl">
                {confirmModal.variant === 'danger' ? '⚠️' : confirmModal.variant === 'warning' ? '🔄' : 'ℹ️'}
              </span>
              <h3 className="text-base font-bold tracking-wide">{confirmModal.title}</h3>
            </div>

            {/* Conteúdo */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-700 leading-relaxed font-medium">
                {confirmModal.message}
              </p>
              {confirmModal.variant === 'danger' && (
                <div className="rounded-xl border border-red-200 bg-red-50/70 p-3 flex items-start gap-2 text-xs text-red-800">
                  <span className="font-bold">⚠️ Atenção:</span> Esta ação removerá o modelo permanentemente.
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 transition shadow-sm"
              >
                {confirmModal.cancelText}
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className={`rounded-xl px-5 py-2 text-xs font-bold text-white shadow-md transition ${
                  confirmModal.variant === 'danger'
                    ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                    : confirmModal.variant === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                    : 'bg-teal-600 hover:bg-teal-700 shadow-teal-600/20'
                }`}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </PageLayout>
  );
}
