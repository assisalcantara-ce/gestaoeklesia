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
  ArrowDownToLine,
  ArrowUpToLine,
  Bold,
  ChevronDown,
  ChevronUp,
  Copy,
  Eraser,
  Image,
  Italic,
  Lock,
  Minus,
  Paintbrush,
  RotateCcw,
  Shield,
  Square,
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
  tipo: 'texto' | 'qrcode' | 'logo' | 'foto-membro' | 'chapa' | 'imagem' | 'linha' | 'forma';
  x: number;
  y: number;
  largura: number;
  altura: number;
  fontSize?: number;
  cor?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
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
  const isOperador = !userCtx.loading && ['secretaria_local', 'admin_local', 'operador'].includes(userCtx.nivel || '');
  const { fetchMembers } = useMembers();
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
  const [copiedJson, setCopiedJson] = useState(false);
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

  const [congregacoes, setCongregacoes] = useState<Array<{ id: string; nome: string }>>([]);

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
          ].join('');
          return `<div style="${style}"></div>`;
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
  tituloCarta: string,
  textoDeclaracao: string
): CartaTemplate => ({
  id,
  ministry_id: null,
  template_key: key,
  title,
  tipo,
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
          altura: 476,
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
          x: 153,
          y: 186,
          id: '494afeea-9420-486f-bb71-0889883c29c4',
          cor: '#111827',
          tipo: 'texto',
          fonte: 'Calibri',
          texto: tituloCarta,
          altura: 48,
          locked: false,
          italico: false,
          largura: 360,
          negrito: true,
          visivel: true,
          fontSize: 26,
          sublinhado: false,
          alinhamento: 'center',
          borderRadius: 0,
        },
        {
          x: 25,
          y: 994,
          id: '17871409999000b6o6qgzt',
          cor: '#111827',
          tipo: 'texto',
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
          alinhamento: 'left',
          borderRadius: 0,
        },
        {
          x: 24,
          y: 1028,
          id: '17871410147888k2nbto2j',
          cor: '#111827',
          tipo: 'texto',
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
          alinhamento: 'left',
          borderRadius: 0,
        },
      ],
    },
  },
});

const DEFAULT_SYSTEM_TEMPLATES: CartaTemplate[] = [
  createSystemTemplate(
    'system-mudanca',
    'mudanca',
    'Carta de Mudança',
    'mudanca',
    'CARTA DE MUDANCA',
    'Declaramos para os devidos fins que\n<b>{{membro.nome}}, CPF {{membro.cpf}}</b>\n\nFaz parte desta igreja, como MEMBRO fiel e dedicado.\nPor se achar em comunhão com esta Igreja, nós o recomendamos que o recebais no Senhor como usam fazer os Santos..\n\n<b>Congregacao:</b> {{membro.congregacao}} \n<b>Cargo:</b> {{membro.cargo}}\n\nEm fe de verdade, firmamos a presente.\n\n<b>{{data.extenso}}<b>\n</b></b>\n\n________________________________________\n<b>{{pastor.responsavel}}</b> - Pastor Presidente\n'
  ),
  createSystemTemplate(
    'system-transito',
    'transito',
    'Carta de Trânsito',
    'transito',
    'CARTA DE TRÂNSITO',
    'Declaramos para os devidos fins que\n<b>{{membro.nome}}, CPF {{membro.cpf}}</b>\n\nMembro desta igreja, encontra-se em viagem ou trânsito temporário.\nRecomendamos que o recebais em comunhão cristã durante o período de sua permanência.\n\n<b>Congregacao:</b> {{membro.congregacao}} \n<b>Cargo:</b> {{membro.cargo}}\n\nEm fe de verdade, firmamos a presente.\n\n<b>{{data.extenso}}<b>\n</b></b>\n\n________________________________________\n<b>{{pastor.responsavel}}</b> - Pastor Presidente\n'
  ),
  createSystemTemplate(
    'system-desligamento',
    'desligamento',
    'Carta de Desligamento',
    'desligamento',
    'CARTA DE DESLIGAMENTO',
    'Declaramos para os devidos fins que\n<b>{{membro.nome}}, CPF {{membro.cpf}}</b>\n\nTeve seu desligamento formalizado a seu pedido do rol de membros desta igreja.\nRegistramos nossos agradecimentos pelo período em que esteve em nossa comunhão.\n\n<b>Congregacao:</b> {{membro.congregacao}} \n<b>Cargo:</b> {{membro.cargo}}\n\nEm fe de verdade, firmamos a presente.\n\n<b>{{data.extenso}}<b>\n</b></b>\n\n________________________________________\n<b>{{pastor.responsavel}}</b> - Pastor Presidente\n'
  ),
  createSystemTemplate(
    'system-recomendacao',
    'recomendacao',
    'Carta de Recomendação',
    'recomendacao',
    'CARTA DE RECOMENDAÇÃO',
    'Declaramos para os devidos fins que\n<b>{{membro.nome}}, CPF {{membro.cpf}}</b>\n\nÉ membro em plena comunhão desta igreja e o(a) recomendamos carinhosamente aos irmãos para acolhimento nas atividades cristãs.\n\n<b>Congregacao:</b> {{membro.congregacao}} \n<b>Cargo:</b> {{membro.cargo}}\n\nEm fe de verdade, firmamos a presente.\n\n<b>{{data.extenso}}<b>\n</b></b>\n\n________________________________________\n<b>{{pastor.responsavel}}</b> - Pastor Presidente\n'
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
    setDraftTitle(selectedTemplate.title || '');
    setDraftKey(selectedTemplate.template_key || '');
    setDraftTipo(selectedTemplate.tipo || 'custom');
  }, [selectedTemplate?.id, selectedTemplate?.template_key, selectedTemplate?.content_json]);

  const handleSelectTemplate = (template: CartaTemplate) => {
    setIsDraftReady(false);
    // Se for um modelo de sistema nativo, forçar sempre o layout nativo atualizado
    const sysNative = DEFAULT_SYSTEM_TEMPLATES.find((s) => s.template_key === template.template_key);
    if (sysNative && template.scope === 'system') {
      setSelectedTemplate({ ...sysNative });
      setIsEditingVisual(true);
      return;
    }
    setSelectedTemplate({ ...template });
    setIsEditingVisual(true);
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

    setIsSaving(true);
    try {
      const payload = {
        ministry_id: targetMinistryId,
        template_key: finalKey,
        title: draftTitle,
        tipo: draftTipo || 'custom',
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
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Botão de Exclusão para modelos criados pelo Tenant (ou botão de Restaurar para nativos) */}
                    {DEFAULT_SYSTEM_TEMPLATES.some((s) => s.template_key === selectedTemplate.template_key) ? (
                      <button
                        type="button"
                        onClick={() => handleRestoreNativeTemplate(selectedTemplate.template_key)}
                        disabled={isSaving}
                        className="text-xs px-3.5 py-2 rounded-lg font-bold transition flex items-center gap-1.5 shadow-sm bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-300"
                        title="Restaurar este modelo para o padrão nativo original do sistema"
                      >
                        <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
                        <span>Restaurar modelo nativo</span>
                      </button>
                    ) : (
                      selectedTemplate.scope === 'tenant' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteTenantTemplate(selectedTemplate.id, selectedTemplate.title)}
                          disabled={isSaving}
                          className="text-xs px-3.5 py-2 rounded-lg font-bold transition flex items-center gap-1.5 shadow-sm bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                          title="Excluir este modelo permanentemente"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-600" />
                          <span>Excluir modelo</span>
                        </button>
                      )
                    )}

                    <button
                      onClick={() => {
                        const jsonStructure = {
                          template_key: selectedTemplate.template_key || draftKey,
                          title: selectedTemplate.title || draftTitle,
                          tipo: selectedTemplate.tipo || draftTipo || 'custom',
                          scope: selectedTemplate.scope || 'tenant',
                          content_json: serializeCanvasContent(canvasContent),
                        };
                        const formattedJson = JSON.stringify(jsonStructure, null, 2);
                        navigator.clipboard.writeText(formattedJson);
                        setCopiedJson(true);
                        setTimeout(() => setCopiedJson(false), 2500);
                      }}
                      className="text-xs px-3.5 py-2 rounded-lg font-bold transition flex items-center gap-1.5 shadow-sm bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300"
                      title="Copiar JSON estruturado do modelo para clipboard"
                    >
                      <span>{copiedJson ? '✅ JSON Copiado!' : '📋 Copiar JSON'}</span>
                    </button>

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
                  {selectedTemplate && DEFAULT_SYSTEM_TEMPLATES.some((s) => s.template_key === selectedTemplate.template_key) && (
                    <button
                      onClick={() => handleRestoreNativeTemplate(selectedTemplate.template_key)}
                      className="px-4 py-2 rounded-lg border border-amber-300 bg-amber-50 text-xs font-bold text-amber-800 hover:bg-amber-100 transition flex items-center gap-1.5"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
                      <span>Restaurar Padrão Nativo</span>
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
