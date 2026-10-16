import type { CartaCanvasElement, CartaCanvasData } from '@/types/supabase';

export const CANVAS_A4 = {
  width: 794,
  height: 1123,
  mmWidth: 210,
  mmHeight: 297,
  aspectRatio: 210 / 297,
};

export const createElementId = (): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
      return (crypto as any).randomUUID() as string;
    }
  } catch {
    // ignore
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const createCanvasTextElement = (text: string): CartaCanvasElement => ({
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

export const createDefaultCanvas = (text = 'Escreva o conteudo da carta aqui.'): CartaCanvasData => ({
  width: CANVAS_A4.width,
  height: CANVAS_A4.height,
  backgroundUrl: '',
  elements: [createCanvasTextElement(text)],
});

export const CANVAS_FONTES = [
  'Arial',
  'Calibri',
  'Georgia',
  'Times New Roman',
  'Verdana',
  'Trebuchet MS',
];

export const CANVAS_ELEMENT_LABELS: Record<CartaCanvasElement['tipo'], string> = {
  texto: 'Texto',
  linha: 'Linha',
  logo: 'Logo',
  imagem: 'Imagem',
  qrcode: 'QR Code',
  'foto-membro': 'Foto do Membro',
  chapa: 'Chapa',
  forma: 'Forma / Retângulo',
};

export const PLACEHOLDER_GROUPS = [
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

export const PLACEHOLDER_LABELS = PLACEHOLDER_GROUPS.reduce<Record<string, string>>((acc, group) => {
  group.items.forEach((item) => {
    acc[item.key] = `${group.title}: ${item.label}`;
  });
  return acc;
}, {});

export const normalizeTemplateKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export const formatDateExtenso = (date: Date): string =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);

export const normalizeCanvasData = (canvas?: Partial<CartaCanvasData> | null): CartaCanvasData => ({
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

export const extractTextFromDoc = (node: any): string => {
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

export const convertDocToCanvas = (doc: any): CartaCanvasData => {
  const text = extractTextFromDoc(doc).trim();
  return createDefaultCanvas(text || 'Escreva o conteudo da carta aqui.');
};

export const parseTemplateToCanvas = (content: any): CartaCanvasData => {
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

export const serializeCanvasContent = (canvas: CartaCanvasData) => ({
  mode: 'canvas',
  canvas,
});

export const getCanvasPreviewText = (texto: string): string => {
  if (!texto) return 'Texto';
  return texto
    .replace(/{{\s*([a-zA-Z0-9_.]+)\s*}}/g, (_match, key) => {
      const label = PLACEHOLDER_LABELS[key];
      return label ? `[${label}]` : `{{${key}}}`;
    })
    .replace(/\n/g, '<br />');
};

export const sanitizeHtmlText = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export const replacePlaceholders = (html: string, map: Record<string, string>): string => {
  const regex = /{{\s*([a-zA-Z0-9_.]+)\s*}}/g;
  return html.replace(regex, (_match, key) => {
    const value = map[key] ?? '';
    return sanitizeHtmlText(String(value));
  });
};
