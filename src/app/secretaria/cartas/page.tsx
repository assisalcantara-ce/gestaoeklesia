'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import NotificationModal from '@/components/NotificationModal';
import InteractiveCanvas from '@/components/InteractiveCanvas';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { useUserContext } from '@/hooks/useUserContext';
import { createClient } from '@/lib/supabase-client';
import { fetchConfiguracaoIgrejaFromSupabase, type ConfiguracaoIgreja } from '@/lib/igreja-config-utils';
import { useMembers } from '@/hooks/useMembers';
import type { Member } from '@/types/supabase';
import { Manrope, Playfair_Display } from 'next/font/google';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Copy,
  Eraser,
  Image,
  Italic,
  Lock,
  Minus,
  Paintbrush,
  Shield,
  Trash2,
  Type,
  Underline,
  Unlock,
  Upload,
  Send,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

type TemplateScope = 'system' | 'tenant';
type TemplateTipo = 'mudanca' | 'transito' | 'desligamento' | 'recomendacao' | 'custom';

interface CartaCanvasElement {
  id: string;
  tipo: 'texto' | 'qrcode' | 'logo' | 'foto-membro' | 'chapa' | 'imagem' | 'linha';
  x: number;
  y: number;
  largura: number;
  altura: number;
  fontSize?: number;
  cor?: string;
  backgroundColor?: string;
  fonte?: string;
  transparencia?: number;
  borderRadius?: number;
  texto?: string;
  alinhamento?: 'left' | 'center' | 'right';
  negrito?: boolean;
  italico?: boolean;
  sublinhado?: boolean;
  sombreado?: boolean;
  imagemUrl?: string;
  locked?: boolean;
  visivel: boolean;
}

interface CartaCanvasData {
  width: number;
  height: number;
  backgroundUrl?: string;
  elements: CartaCanvasElement[];
}

const headingFont = Playfair_Display({ subsets: ['latin'], weight: ['600', '700'] });
const bodyFont = Manrope({ subsets: ['latin'], weight: ['400', '500', '600'] });

interface CartaTemplate {
  id: string;
  ministry_id: string | null;
  template_key: string;
  title: string;
  tipo: TemplateTipo;
  scope: TemplateScope;
  content_json: any;
  is_active: boolean;
  updated_at?: string | null;
}

interface CartaRegistro {
  id: string;
  member_id: string | null;
  template_id: string | null;
  template_key: string | null;
  template_title: string | null;
  status: string;
  rendered_html: string | null;
  issued_at: string | null;
  payload_snapshot: any;
  template_snapshot: any;
}

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

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

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

const replacePlaceholders = (html: string, map: Record<string, string>) => {
  const regex = /{{\s*([a-zA-Z0-9_.]+)\s*}}/g;
  return html.replace(regex, (_match, key) => {
    const value = map[key] ?? '';
    return escapeHtml(String(value)).replace(/\n/g, '<br />');
  });
};

export default function CartasPage() {
  const { loading } = useRequireSupabaseAuth();
  const { bloqueado } = useRequireModulo('gestao');
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const userCtx = useUserContext();
  const isOperador = !userCtx.loading && ['secretaria_local', 'admin_local', 'operador'].includes(userCtx.nivel || '');
  const { fetchMembers } = useMembers();
  const canvasImageInputRef = useRef<HTMLInputElement>(null);
  const canvasBackgroundInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState('modelos');
  const [templates, setTemplates] = useState<CartaTemplate[]>([]);
  const [systemTemplates, setSystemTemplates] = useState<Record<string, CartaTemplate>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<CartaTemplate | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftKey, setDraftKey] = useState('');
  const [draftTipo, setDraftTipo] = useState<TemplateTipo>('custom');
  const [isDraftReady, setIsDraftReady] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [isEditingVisual, setIsEditingVisual] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'elementos' | 'variaveis' | 'camadas'>('elementos');
  const lastSelectedTemplateRef = useRef<CartaTemplate | null>(null);
  const [canvasContent, setCanvasContent] = useState<CartaCanvasData>(() => createDefaultCanvas());
  const [selectedCanvasElement, setSelectedCanvasElement] = useState<CartaCanvasElement | null>(null);
  const [selectedCanvasElements, setSelectedCanvasElements] = useState<CartaCanvasElement[]>([]);
  const [canvasImageTargetId, setCanvasImageTargetId] = useState<string | null>(null);
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

  const tabs = [
    { id: 'modelos', label: 'Modelos', icon: '🧩' },
    { id: 'emitir', label: 'Emitir', icon: '📄' },
    { id: 'historico', label: 'Historico', icon: '🗂️' },
  ];

  const isAuxiliar = userCtx.nivel === 'auxiliar_secretaria';

  // Operador não acessa o editor de modelos; Auxiliar acessa apenas Histórico
  const visibleTabs = isAuxiliar
    ? tabs.filter(t => t.id === 'historico')
    : isOperador
    ? tabs.filter(t => t.id !== 'modelos')
    : tabs;

  // Se operador/auxiliar cair em abas restritas, redireciona para aba permitida
  useEffect(() => {
    if (isAuxiliar && activeTab !== 'historico') {
      setActiveTab('historico');
    } else if (isOperador && activeTab === 'modelos') {
      setActiveTab('emitir');
    }
  }, [isAuxiliar, isOperador, activeTab]);

  // Templates disponíveis para operador: apenas transito e recomendacao
  const TIPOS_LIVRES: TemplateTipo[] = ['transito', 'recomendacao'];
  const templatesFiltrados = isOperador
    ? templates.filter(t => TIPOS_LIVRES.includes(t.tipo))
    : templates;

  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedMemberId) || null,
    [members, selectedMemberId]
  );

  const buildPlaceholderMap = (member?: Member | null) => {
    const hoje = new Date();
    const cf = (member?.custom_fields && typeof member.custom_fields === 'object') ? member.custom_fields : {};
    const cargo =
      String(
        (cf as any).cargoMinisterial ||
        (cf as any).cargo_ministerial ||
        member?.cargo_ministerial ||
        ''
      );
    const congregacao = String((cf as any).congregacao || (cf as any).congregacao_nome || '');
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
      'membro.congregacao': congregacao || '',
      'carta.destino': issueFields.destino || '',
      'carta.motivo': issueFields.motivo || '',
      'carta.observacoes': issueFields.observacoes || '',
      'data.hoje': hoje.toLocaleDateString('pt-BR'),
      'data.extenso': formatDateExtenso(hoje),
      'pastor.responsavel': configIgreja.responsavel || '',
    } as Record<string, string>;
  };

  const renderCanvasHtml = (
    canvas: CartaCanvasData,
    map: Record<string, string>
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
          ].join('');
          return `<div style="${style}">${el.texto || ''}</div>`;
        }

        if (el.tipo === 'linha') {
          const style = [
            baseStyle,
            `background-color:${el.cor || '#111'};`,
            `border-radius:${el.borderRadius || 0}px;`,
            `opacity:${el.transparencia ?? 1};`,
          ].join('');
          return `<div style=\"${style}\"></div>`;
        }

        return '';
      })
      .join('');

    return `
      <div style="position:relative; width:${safeCanvas.width}px; height:${safeCanvas.height}px; ${bgStyle} margin:0 auto;">
        ${elementsHtml}
      </div>
    `;
  };

  const previewHtml = useMemo(() => {
    const map = buildPlaceholderMap(selectedMember);
    return renderCanvasHtml(canvasContent, map);
  }, [canvasContent, selectedMember, issueFields, configIgreja]);

  const lastIssuedLabel = useMemo(() => {
    const issuedAt = records[0]?.issued_at;
    if (!issuedAt) return 'Sem emissao';
    return new Date(issuedAt).toLocaleDateString('pt-BR');
  }, [records]);

  const fetchMinData = async () => {
    return userCtx.ministryId;
  };

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

    const rows = (data || []) as CartaTemplate[];
    const systemRows = rows.filter((t) => t.scope === 'system');
    const tenantRows = rows.filter((t) => t.scope === 'tenant');

    const systemMap: Record<string, CartaTemplate> = {};
    systemRows.forEach((t) => {
      systemMap[t.template_key] = t;
    });

    const merged = new Map<string, CartaTemplate>();
    tenantRows.forEach((t) => merged.set(t.template_key, t));
    systemRows.forEach((t) => {
      if (!merged.has(t.template_key)) merged.set(t.template_key, t);
    });

    const list = Array.from(merged.values());
    setTemplates(list);
    setSystemTemplates(systemMap);

    const desiredKey =
      selectedTemplate?.template_key ||
      normalizeTemplateKey(draftKey || draftTitle || '');

    const preferred = desiredKey
      ? list.find((t) => t.template_key === desiredKey) || null
      : null;

    if (preferred) {
      setSelectedTemplate(preferred);
    } else if (!selectedTemplate && list.length > 0) {
      const first = list[0];
      setSelectedTemplate(first);
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
      await Promise.all([loadTemplates(), loadRecords(), loadMembers()]);
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, bloqueado]);

  useEffect(() => {
    if (!selectedTemplate) return;
    const canvas = parseTemplateToCanvas(selectedTemplate.content_json);
    setCanvasContent(canvas);
    setSelectedCanvasElement(null);
    setSelectedCanvasElements([]);
    setDraftTitle(selectedTemplate.title || '');
    setDraftKey(selectedTemplate.template_key || '');
    setDraftTipo(selectedTemplate.tipo || 'custom');
  }, [selectedTemplate?.id]);

  const handleSelectTemplate = (template: CartaTemplate) => {
    setIsDraftReady(false);
    setSelectedTemplate(template);
    setIsEditingVisual(false);
  };

  const handleNewTemplate = () => {
    lastSelectedTemplateRef.current = selectedTemplate;
    setDraftTitle('');
    setDraftKey('');
    setDraftTipo('custom');
    setShowNewModal(true);
  };

  const handleCancelNewTemplate = () => {
    setShowNewModal(false);
    setDraftTitle('');
    setDraftKey('');
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
    setDraftKey(key);
    setSelectedTemplate(null);
    setIsDraftReady(true);
    setCanvasContent(createDefaultCanvas());
    setSelectedCanvasElement(null);
    setSelectedCanvasElements([]);
    setShowNewModal(false);
    setIsEditingVisual(true);
  };

  const handleSaveTemplate = async () => {
    if (!ministryId) {
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
    const isEditingSystem = selectedTemplate?.scope === 'system';

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

    setIsSaving(true);
    try {
      const payload = {
        ministry_id: ministryId,
        template_key: finalKey,
        title: draftTitle,
        tipo: draftTipo || 'custom',
        scope: 'tenant' as TemplateScope,
        content_json: serializeCanvasContent(canvasContent),
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      const tenantTarget =
        selectedTemplate?.scope === 'tenant'
          ? selectedTemplate
          : isEditingSystem
            ? templates.find((tpl) => tpl.scope === 'tenant' && tpl.template_key === finalKey)
            : null;

      const { error } = tenantTarget
        ? await supabase.from('cartas_templates').update(payload).eq('id', tenantTarget.id)
        : await supabase.from('cartas_templates').insert(payload);

      if (error) throw error;

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

  const handleRestoreSystemTemplate = async () => {
    if (!selectedTemplate || selectedTemplate.scope !== 'tenant') return;
    try {
      await supabase.from('cartas_templates').delete().eq('id', selectedTemplate.id);
      setNotification({
        isOpen: true,
        title: 'Sucesso',
        message: 'Modelo restaurado para o padrao do sistema.',
        type: 'success',
        autoClose: 3000,
      });
      await loadTemplates();
    } catch (err: any) {
      setNotification({
        isOpen: true,
        title: 'Erro',
        message: err?.message || 'Erro ao restaurar modelo',
        type: 'error',
        autoClose: undefined,
      });
    }
  };

  const updateCanvasElement = (id: string, props: Partial<CartaCanvasElement>) => {
    setCanvasContent((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => (el.id === id ? { ...el, ...props } : el)),
    }));
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
    const base: CartaCanvasElement = {
      id: createElementId(),
      tipo,
      x: 48,
      y: 48,
      largura: isLine ? 320 : isText ? 360 : 200,
      altura: isLine ? 3 : isText ? 48 : 140,
      fontSize: isText ? 16 : 12,
      fonte: 'Calibri',
      cor: isLine ? '#111827' : '#111827',
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

  useEffect(() => {
    if (!selectedCanvasElement) return;
    const updated = canvasContent.elements.find((el) => el.id === selectedCanvasElement.id) || null;
    setSelectedCanvasElement(updated);
    if (updated) {
      setSelectedCanvasElements((prev) =>
        prev.map((el) => (el.id === updated.id ? updated : el))
      );
    }
  }, [canvasContent]);

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
    try {
      const url = await uploadImageFile(file);
      if (targetId) {
        updateCanvasElement(targetId, { imagemUrl: url });
      } else {
        addCanvasElement('imagem', { imagemUrl: url, largura: 260, altura: 180 });
      }
    } catch (err: any) {
      setNotification({
        isOpen: true,
        title: 'Erro',
        message: err?.message || 'Erro ao enviar imagem',
        type: 'error',
        autoClose: undefined,
      });
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

  const handleIssueLetter = async () => {
    if (!selectedTemplate) return;
    if (!ministryId) {
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

    setIsIssuing(true);
    try {
      const map = buildPlaceholderMap(selectedMember);
      const renderedHtml = renderCanvasHtml(canvasContent, map);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const payload = {
        ministry_id: ministryId,
        member_id: selectedMember.id,
        template_id: selectedTemplate.id,
        template_key: selectedTemplate.template_key,
        template_title: selectedTemplate.title,
        status: 'emitida',
        payload_snapshot: map,
        template_snapshot: serializeCanvasContent(canvasContent),
        rendered_html: renderedHtml,
        issued_by: user?.id || null,
        issued_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('cartas_registros').insert(payload);
      if (error) throw error;

      setNotification({
        isOpen: true,
        title: 'Sucesso',
        message: 'Carta emitida com sucesso!',
        type: 'success',
        autoClose: 3000,
      });

      await loadRecords();
      setActiveTab('historico');
    } catch (err: any) {
      setNotification({
        isOpen: true,
        title: 'Erro',
        message: err?.message || 'Erro ao emitir carta',
        type: 'error',
        autoClose: undefined,
      });
    } finally {
      setIsIssuing(false);
    }
  };

  const handlePrintHtml = (html: string) => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Carta</title>`);
    win.document.write('<style>body{font-family:Arial, sans-serif; padding:32px; color:#111;} img{max-width:100%;} .carta{max-width:800px; margin:0 auto;}</style>');
    win.document.write('</head><body>');
    win.document.write(`<div class="carta">${html}</div>`);
    win.document.write('</body></html>');
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  if (loading) return <div className="p-8">Carregando...</div>;
  if (bloqueado) return null;

  return (
    <PageLayout
      title="Cartas Ministeriais"
      description="Criar modelos, emitir e reimprimir cartas ministeriais"
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

      <div className={`${bodyFont.className} relative`}>
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-[#fff7ed] via-white to-[#e0f2fe]" />
          <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-[#f97316]/15 blur-3xl" />
          <div className="absolute -left-10 bottom-0 h-72 w-72 rounded-full bg-[#0ea5e9]/15 blur-3xl" />
        </div>

        <div className="mb-6 rounded-2xl border border-white/70 bg-white/70 p-6 shadow-lg backdrop-blur motion-safe:animate-fade-in">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-amber-600">Secretaria geral</p>
              <h2 className={`${headingFont.className} text-2xl md:text-3xl text-[#123b63]`}>
                Cartas com elegancia e rapidez
              </h2>
              <p className="text-sm text-gray-600 max-w-xl">
                Crie modelos com identidade visual, emita em segundos e reimprima com consistencia.
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
                <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400">Emitidas</p>
                <p className="text-lg font-semibold text-[#123b63]">{records.length}</p>
              </div>
              <div
                className="rounded-xl border border-white/70 bg-white/80 p-3 text-center shadow-sm backdrop-blur motion-safe:animate-rise-in"
                style={{ animationDelay: '0.15s' }}
              >
                <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400">Ultima emissao</p>
                <p className="text-sm font-semibold text-[#123b63]">{lastIssuedLabel}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/70 bg-white/80 shadow-xl/10 backdrop-blur">
          <div className="p-4 md:p-6">
            <Tabs tabs={visibleTabs} activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'modelos' && (
          <Section icon="🧩" title="Modelos de Cartas">
            {/* Seletor de Modelo Superior */}
            <div className="mb-6 rounded-2xl border border-white/70 bg-white/85 p-4 shadow-lg/10 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Modelo Ativo:</span>
                  <select
                    value={selectedTemplate?.id || ''}
                    onChange={(e) => {
                      const tpl = templates.find((t) => t.id === e.target.value);
                      if (tpl) handleSelectTemplate(tpl);
                    }}
                    className="min-w-[220px] flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 shadow-sm"
                  >
                    <option value="" disabled>Selecione um modelo</option>
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.title}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleNewTemplate}
                    className="text-xs px-4 py-2 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 transition shadow-sm"
                  >
                    + Novo Modelo
                  </button>
                </div>

                {selectedTemplate && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEditingVisual(!isEditingVisual)}
                      className={`text-xs px-4 py-2 rounded-lg font-bold transition flex items-center gap-1.5 shadow-sm ${
                        isEditingVisual
                          ? 'bg-teal-100 text-teal-800 border border-teal-300'
                          : 'bg-teal-600 text-white hover:bg-teal-700'
                      }`}
                    >
                      <span>{isEditingVisual ? '✏️ Modo Edição Visual (Ativo)' : '✏️ Abrir Editor Visual'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Visualização de Edição do Modelo */}
            {(selectedTemplate || isDraftReady) && (isEditingVisual || isDraftReady) ? (
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
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleCanvasImageUpload(file, canvasImageTargetId ?? undefined);
                            }
                            e.currentTarget.value = '';
                            setCanvasImageTargetId(null);
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
                            {canvasContent.elements.slice().reverse().map((el, indexInverted) => {
                              const originalIndex = canvasContent.elements.length - 1 - indexInverted;
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
                                    <span className={`text-[10px] ${isSelected ? 'text-teal-200' : 'text-gray-400'}`}>
                                      #{originalIndex + 1}
                                    </span>
                                    {el.locked && <Lock className="h-3 w-3 opacity-80" />}
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
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                                  TAMANHO DA FONTE: {selectedCanvasElement.fontSize || 14}PX
                                </label>
                                <input
                                  type="range"
                                  min={8}
                                  max={72}
                                  value={selectedCanvasElement.fontSize || 14}
                                  onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { fontSize: Number(e.target.value) || 14 })}
                                  className="w-full accent-teal-600"
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
                                    onClick={() => updateCanvasElement(selectedCanvasElement.id, { negrito: !selectedCanvasElement.negrito })}
                                    className={`p-1 rounded ${selectedCanvasElement.negrito ? 'bg-teal-100 text-teal-800 font-bold' : 'text-gray-600'}`}
                                    disabled={selectedCanvasElement.locked}
                                  >
                                    <Bold className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateCanvasElement(selectedCanvasElement.id, { italico: !selectedCanvasElement.italico })}
                                    className={`p-1 rounded ${selectedCanvasElement.italico ? 'bg-teal-100 text-teal-800' : 'text-gray-600'}`}
                                    disabled={selectedCanvasElement.locked}
                                  >
                                    <Italic className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateCanvasElement(selectedCanvasElement.id, { sublinhado: !selectedCanvasElement.sublinhado })}
                                    className={`p-1 rounded ${selectedCanvasElement.sublinhado ? 'bg-teal-100 text-teal-800' : 'text-gray-600'}`}
                                    disabled={selectedCanvasElement.locked}
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
                                  rows={4}
                                  value={selectedCanvasElement.texto || ''}
                                  onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { texto: e.target.value })}
                                  className="w-full rounded border border-gray-200 p-2 text-xs focus:border-teal-500 focus:outline-none"
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

                          {/* Especificidades do Tipo Imagem */}
                          {selectedCanvasElement.tipo === 'imagem' && (
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">URL DA IMAGEM</label>
                              <input
                                type="text"
                                value={selectedCanvasElement.imagemUrl || ''}
                                onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { imagemUrl: e.target.value })}
                                className="w-full rounded border border-gray-200 p-1.5 text-xs"
                                placeholder="https://..."
                                disabled={selectedCanvasElement.locked}
                              />
                            </div>
                          )}

                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* Botões de Ação Inferiores */}
                <div className="flex flex-wrap gap-3 justify-end pt-4 border-t border-gray-200">
                  {selectedTemplate?.scope === 'tenant' && systemTemplates[selectedTemplate.template_key] && (
                    <button
                      onClick={handleRestoreSystemTemplate}
                      className="px-4 py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition"
                    >
                      Restaurar Padrão do Sistema
                    </button>
                  )}
                  <button
                    onClick={handleSaveTemplate}
                    className="px-6 py-2.5 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 shadow-md transition"
                    disabled={isSaving || (!selectedTemplate && !isDraftReady)}
                  >
                    {isSaving
                      ? 'Salvando...'
                      : selectedTemplate?.scope === 'system'
                      ? 'Salvar como Modelo Personalizado'
                      : 'Salvar Alterações do Modelo'}
                  </button>
                </div>
              </div>
            ) : (
              /* Estado Vazio quando não está em edição visual */
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white/80 p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mx-auto text-xl font-bold">
                  🧩
                </div>
                {selectedTemplate ? (
                  <>
                    <h4 className="text-base font-bold text-gray-800">Modelo "{selectedTemplate.title}" Selecionado</h4>
                    <p className="text-xs text-gray-500 max-w-md mx-auto">
                      Clique no botão <span className="font-semibold text-teal-700">✏️ Abrir Editor Visual</span> acima para editar a carta em 3 colunas.
                    </p>
                    <button
                      onClick={() => setIsEditingVisual(true)}
                      className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700 transition shadow-sm"
                    >
                      ✏️ Abrir Editor Visual
                    </button>
                  </>
                ) : (
                  <>
                    <h4 className="text-base font-bold text-gray-800">Nenhum modelo selecionado</h4>
                    <p className="text-xs text-gray-500 max-w-md mx-auto">
                      Selecione um modelo existente no seletor acima ou clique em <span className="font-semibold text-teal-700">+ Novo Modelo</span> para criar um do zero.
                    </p>
                  </>
                )}
              </div>
            )}
          </Section>
        )}

        {activeTab === 'emitir' && (
          <Section icon="📄" title="Emitir Carta">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 space-y-4">
                <div className="rounded-2xl border border-white/70 bg-white/85 p-5 shadow-xl/10 space-y-4 backdrop-blur">
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Modelo</label>
                    <select
                      value={selectedTemplate?.id || ''}
                      onChange={(e) => {
                        const tpl = templatesFiltrados.find((t) => t.id === e.target.value);
                        if (tpl) handleSelectTemplate(tpl);
                      }}
                      className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:border-[#0284c7] focus:outline-none focus:ring-2 focus:ring-[#0284c7]/20"
                    >
                      <option value="" disabled>Selecione o modelo</option>
                      {templatesFiltrados.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>{tpl.title}</option>
                      ))}
                    </select>
                  </div>

                  {/* Aviso para operador sobre cartas que exigem autorização */}
                  {isOperador && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-semibold text-amber-700 mb-1">Carta de Mudança ou Desligamento?</p>
                      <p className="text-xs text-amber-600 mb-2">
                        Essas cartas precisam de autorização da Sede. Envie um pedido e acompanhe o status.
                      </p>
                      <button
                        type="button"
                        onClick={() => router.push('/secretaria/cartas/pedidos')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition"
                      >
                        <Send size={12} />
                        Solicitar à Secretaria
                      </button>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Membro</label>
                    <select
                      value={selectedMemberId}
                      onChange={(e) => setSelectedMemberId(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:border-[#0284c7] focus:outline-none focus:ring-2 focus:ring-[#0284c7]/20"
                    >
                      <option value="">Selecione o membro</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Destino</label>
                    <input
                      value={issueFields.destino}
                      onChange={(e) => setIssueFields((prev) => ({ ...prev, destino: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:border-[#0284c7] focus:outline-none focus:ring-2 focus:ring-[#0284c7]/20"
                      placeholder="Para qual igreja/ministro"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Motivo</label>
                    <textarea
                      value={issueFields.motivo}
                      onChange={(e) => setIssueFields((prev) => ({ ...prev, motivo: e.target.value }))}
                      className="w-full min-h-[80px] rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:border-[#0284c7] focus:outline-none focus:ring-2 focus:ring-[#0284c7]/20"
                      placeholder="Descreva o motivo"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Observacoes</label>
                    <textarea
                      value={issueFields.observacoes}
                      onChange={(e) => setIssueFields((prev) => ({ ...prev, observacoes: e.target.value }))}
                      className="w-full min-h-[80px] rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm focus:border-[#0284c7] focus:outline-none focus:ring-2 focus:ring-[#0284c7]/20"
                      placeholder="Observacoes adicionais"
                    />
                  </div>
                  <button
                    onClick={handleIssueLetter}
                    className="w-full rounded-lg bg-teal-600 px-4 py-2 text-sm text-white hover:bg-teal-700"
                    disabled={isIssuing}
                  >
                    Emitir Carta
                  </button>
                </div>
              </div>
              <div className="lg:col-span-8">
                <div className="rounded-2xl border border-white/70 bg-white/85 p-5 shadow-xl/10 backdrop-blur">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700">Preview</h3>
                    <button
                      onClick={() => handlePrintHtml(previewHtml)}
                      className="rounded-lg bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200"
                    >
                      Imprimir
                    </button>
                  </div>
                  <div
                    className="min-h-[420px] rounded-xl border border-gray-200 bg-white/95 p-6 shadow-inner"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                </div>
              </div>
            </div>
          </Section>
        )}

        {activeTab === 'historico' && (
          <Section icon="🗂️" title="Historico de Cartas">
            <div className="rounded-2xl border border-white/70 bg-white/85 p-5 shadow-xl/10 backdrop-blur">
              <div className="space-y-3">
                {records.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white/90 p-4 shadow-sm"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-700">{rec.template_title || rec.template_key || 'Carta'}</p>
                      <p className="text-xs text-gray-500">Emitida em: {rec.issued_at ? new Date(rec.issued_at).toLocaleDateString('pt-BR') : '-'}</p>
                    </div>
                    <button
                      onClick={() => handlePrintHtml(rec.rendered_html || previewHtml)}
                      className="rounded-lg bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200"
                    >
                      Reimprimir
                    </button>
                  </div>
                ))}
                {!records.length && (
                  <p className="text-sm text-gray-500">Nenhuma carta emitida ainda.</p>
                )}
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
                <span>🧩</span> Criar Novo Modelo de Carta
              </h3>
              <button
                type="button"
                onClick={handleCancelNewTemplate}
                className="text-gray-400 hover:text-gray-600 font-bold text-sm px-2 py-1 rounded"
              >
                ✕
              </button>
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
                placeholder="Ex: Carta de Mudança de Membro"
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
      </div>
    </PageLayout>
  );
}
