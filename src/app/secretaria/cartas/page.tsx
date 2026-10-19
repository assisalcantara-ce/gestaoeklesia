'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import NotificationModal from '@/components/NotificationModal';
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
  CartaCanvasElement,
  CartaCanvasData,
  CartaTemplate,
  CartaRegistro,
} from '@/types/supabase';
import {
  FileCheck,
  Printer,
  RotateCcw,
  Trash2,
  Send,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CartasService, type VerificacaoAutorizacaoCarta } from '@/services/cartas-service';
import { isSecretariaLocal } from '@/lib/access-control';

const CANVAS_A4 = {
  width: 794,
  height: 1123,
  mmWidth: 210,
  mmHeight: 297,
  aspectRatio: 210 / 297,
};

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

  const [activeTab, setActiveTab] = useState('emitir');
  const [templates, setTemplates] = useState<CartaTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<CartaTemplate | null>(null);
  const [canvasContent, setCanvasContent] = useState<CartaCanvasData>(() => createDefaultCanvas());
  const [emitirCategoria, setEmitirCategoria] = useState<'todas' | 'carta' | 'declaracao'>('todas');
  const [historicoCategoria, setHistoricoCategoria] = useState<'todas' | 'carta' | 'declaracao'>('todas');
  const [historicoBusca, setHistoricoBusca] = useState('');
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
  const [isIssuing, setIsIssuing] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);

  const [previewScale, setPreviewScale] = useState(1);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updatePreviewScale = () => {
      if (!previewContainerRef.current) return;
      const containerWidth = previewContainerRef.current.clientWidth;
      if (!containerWidth) return;
      const padding = 24;
      const availableWidth = containerWidth - padding;
      if (availableWidth < CANVAS_A4.width) {
        const fit = Math.max(0.35, Math.min(1, availableWidth / CANVAS_A4.width));
        setPreviewScale(Math.round(fit * 100) / 100);
      } else {
        setPreviewScale(1);
      }
    };

    updatePreviewScale();
    window.addEventListener('resize', updatePreviewScale);
    return () => window.removeEventListener('resize', updatePreviewScale);
  }, [canvasContent.width]);

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
    { id: 'emitir', label: 'Emitir', icon: '📄' },
    {
      id: 'pedidos',
      label: pedidosPendentesCount > 0 ? `Pedidos (${pedidosPendentesCount})` : 'Pedidos',
      icon: '📬',
    },
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
    qrDataUrls?: Record<string, string>,
    authInfo?: { autorizado: boolean; status?: string } | null,
    isPrintOrIssue = false
  ) => {
    const safeCanvas = normalizeCanvasData(canvas);
    const bgStyle = safeCanvas.backgroundUrl
      ? `background-image:url('${safeCanvas.backgroundUrl}'); background-size:100% 100%; background-position:center top; background-repeat:no-repeat;`
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

        if (el.tipo === 'assinatura_presidente' || el.tipo === 'assinatura_secretario_geral') {
          // Nas cartas de mudança e desligamento, a assinatura do presidente requer deliberação positiva oficial (status = 'autorizado')
          const tipoAtual = selectedTemplate?.tipo || selectedTemplate?.template_key || '';
          const isRestrito = tipoAtual.includes('mudanca') || tipoAtual.includes('desligamento');
          const isPresidente = el.tipo === 'assinatura_presidente';

          // Regra obrigatória: A assinatura do presidente NUNCA aparece em preview desautorizado ou emissão sem deliberação positiva
          if (isRestrito && isPresidente) {
            if (!isPrintOrIssue || !authInfo?.autorizado || authInfo?.status !== 'autorizado') {
              return '';
            }
          }

          const src = isPresidente
            ? (configIgreja.assinatura_presidente || '')
            : (configIgreja.assinatura_secretario_geral || '');

          if (!src) return '';
          const style = [
            baseStyle,
            'object-fit:contain;',
            `opacity:${el.transparencia ?? 1};`,
          ].join('');
          return `<img src="${src}" alt="${isPresidente ? 'Assinatura do Pastor Presidente' : 'Assinatura do Secretário-Geral'}" style="${style}" />`;
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
      <div class="carta-folha-a4" style="position:relative; width:${safeCanvas.width}px; height:${safeCanvas.height}px; ${bgStyle} margin:0 auto; box-sizing:border-box; overflow:hidden; -webkit-print-color-adjust:exact; print-color-adjust:exact;">
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
      width: CANVAS_A4.width,
      height: CANVAS_A4.height,
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

    const desiredKey = selectedTemplate?.template_key || null;

    const preferred = desiredKey
      ? list.find((t) => t.template_key === desiredKey) || null
      : null;

    if (preferred) {
      setSelectedTemplate({ ...preferred });
    } else if (!selectedTemplate && list.length > 0) {
      const first = list[0];
      setSelectedTemplate({ ...first });
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
  }, [selectedTemplate?.id, selectedTemplate?.template_key, selectedTemplate?.content_json]);

  const handleSelectTemplate = (template: CartaTemplate) => {
    // Se for um modelo de sistema nativo, forçar sempre o layout nativo atualizado
    const sysNative = DEFAULT_SYSTEM_TEMPLATES.find((s) => s.template_key === template.template_key);
    if (sysNative && template.scope === 'system') {
      setSelectedTemplate({ ...sysNative });
      return;
    }
    setSelectedTemplate({ ...template });
  };





  const handleDeleteRecord = (rec: CartaRegistro) => {
    const mid = userCtx.ministryId || ministryId;
    if (!mid) {
      setNotification({
        isOpen: true,
        title: 'Erro',
        message: 'Ministério não identificado para realizar a exclusão.',
        type: 'error',
        autoClose: undefined,
      });
      return;
    }

    const snapshot = (rec.payload_snapshot && typeof rec.payload_snapshot === 'object') ? rec.payload_snapshot as Record<string, any> : {};
    const membroNome = snapshot['membro.nome'] || snapshot['membro_nome'] || '';
    const docTitulo = rec.template_title || rec.template_key || (rec.categoria === 'declaracao' ? 'Declaração' : 'Carta');

    setConfirmModal({
      isOpen: true,
      title: 'Excluir Carta Emitida',
      message: `Tem certeza que deseja excluir permanentemente o registro de "${docTitulo}"${membroNome ? ` emitido para "${membroNome}"` : ''}? Esta ação removerá o documento do histórico oficial.`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          setDeletingRecordId(rec.id);
          await CartasService.excluirCartaEmitida(supabase, {
            registroId: rec.id,
            ministryId: mid,
          });

          // Log de Auditoria
          try {
            await registrarAcao({
              acao: 'deletar',
              modulo: 'secretaria',
              area: 'cartas',
              tabela_afetada: 'cartas_registros',
              registro_id: rec.id,
              descricao: `Exclusão do documento emitido "${docTitulo}"${membroNome ? ` para ${membroNome}` : ''}`,
              dados_anteriores: {
                titulo: docTitulo,
                membro_id: rec.member_id,
                membro_nome: membroNome,
                categoria: rec.categoria,
                issued_at: rec.issued_at,
              },
              status: 'sucesso',
            });
          } catch (auditErr) {
            console.warn('Falha ao registrar auditoria de exclusão de carta:', auditErr);
          }

          // Atualiza o estado local imediatamente
          setRecords((prev) => prev.filter((r) => r.id !== rec.id));

          setNotification({
            isOpen: true,
            title: 'Documento Excluído',
            message: `O registro de "${docTitulo}" foi removido do histórico com sucesso.`,
            type: 'success',
            autoClose: 4000,
          });
        } catch (err: any) {
          console.error('Erro ao excluir carta emitida:', err);
          setNotification({
            isOpen: true,
            title: 'Erro ao Excluir',
            message: err?.message || 'Não foi possível excluir o documento emitido.',
            type: 'error',
            autoClose: undefined,
          });
        } finally {
          setDeletingRecordId(null);
        }
      },
    });
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
      const renderedHtml = renderCanvasHtml(canvasContent, map, issueQrMap, authResult, true);

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
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Documento Oficial - Gestão Eklésia</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    *, *::before, *::after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
      box-sizing: border-box;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 210mm;
      height: 297mm;
      background: #ffffff;
      font-family: Arial, sans-serif;
      color: #111;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .print-container {
      width: 210mm;
      height: 297mm;
      max-width: 210mm;
      max-height: 297mm;
      margin: 0 auto;
      padding: 0;
      position: relative;
      overflow: hidden;
      page-break-inside: avoid;
      page-break-after: avoid;
      background: #ffffff;
    }
    .carta-documento, .carta-folha-a4 {
      width: 210mm !important;
      height: 297mm !important;
      max-width: 210mm !important;
      max-height: 297mm !important;
      margin: 0 auto !important;
      padding: 0 !important;
      position: relative !important;
      overflow: hidden !important;
      box-sizing: border-box !important;
      page-break-inside: avoid !important;
      page-break-after: avoid !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    img {
      max-width: 100%;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    @media print {
      @page {
        size: A4 portrait;
        margin: 0;
      }
      html, body {
        width: 210mm !important;
        height: 297mm !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        background: #ffffff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .print-container {
        width: 210mm !important;
        height: 297mm !important;
        max-width: 210mm !important;
        max-height: 297mm !important;
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
        position: relative !important;
        overflow: hidden !important;
        page-break-inside: avoid !important;
        page-break-after: avoid !important;
      }
      .carta-documento, .carta-folha-a4 {
        width: 210mm !important;
        height: 297mm !important;
        max-width: 210mm !important;
        max-height: 297mm !important;
        margin: 0 !important;
        padding: 0 !important;
        position: relative !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
        page-break-inside: avoid !important;
        page-break-after: avoid !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .no-print {
        display: none !important;
      }
    }
    @media screen {
      body {
        background: #4b5563;
        padding: 24px 0;
        display: flex;
        justify-content: center;
      }
      .print-container {
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
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
                className="rounded-xl border border-white/70 bg-white/80 p-3 text-center shadow-sm backdrop-blur motion-safe:animate-rise-in flex flex-col justify-between"
                style={{ animationDelay: '0.05s' }}
              >
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400">Modelos</p>
                  <p className="text-lg font-semibold text-[#123b63]">{templates.length}</p>
                </div>
                {userCtx.isMaster && (
                  <button
                    type="button"
                    onClick={() => router.push('/configuracoes/cartas')}
                    className="mt-1 text-[10px] text-teal-700 hover:text-teal-900 font-bold underline"
                    title="Gerenciar modelos de cartas e declarações em Configurações (exclusivo MASTER)"
                  >
                    Gerenciar (Configurações) →
                  </button>
                )}
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
                    ref={previewContainerRef}
                    className="relative min-h-[500px] max-h-[820px] rounded-xl border border-gray-200 bg-gray-100 p-4 shadow-inner overflow-auto flex justify-center py-2"
                  >
                    <div
                      style={{
                        width: `${CANVAS_A4.width * previewScale}px`,
                        height: `${CANVAS_A4.height * previewScale}px`,
                        position: 'relative',
                        flexShrink: 0,
                        transition: 'width 0.15s ease, height 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          transform: `scale(${previewScale})`,
                          transformOrigin: 'top left',
                          width: `${CANVAS_A4.width}px`,
                          height: `${CANVAS_A4.height}px`,
                        }}
                        className="bg-white shadow-md relative"
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Section>
        )}

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
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDeleteRecord(rec)}
                              disabled={deletingRecordId === rec.id}
                              className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 border border-red-200 transition flex items-center gap-1.5 disabled:opacity-50"
                              title="Excluir documento emitido"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-600" />
                              <span>{deletingRecordId === rec.id ? 'Excluindo...' : 'Excluir'}</span>
                            </button>
                            <button
                              onClick={() => handlePrintHtml(rec.rendered_html || previewHtml, { forceAllowed: true })}
                              className="rounded-lg bg-gray-100 px-3.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-teal-50 hover:text-teal-700 border border-gray-200 transition flex items-center gap-1.5"
                            >
                              <span>🖨️</span>
                              <span>Reimprimir</span>
                            </button>
                          </div>
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
