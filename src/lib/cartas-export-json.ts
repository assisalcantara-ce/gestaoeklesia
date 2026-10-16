import type {
  CartaCanvasData,
  CartaCanvasElement,
  TemplateCategoria,
  TemplateTipo,
} from '@/types/supabase';

export interface CartaTemplateExportInput {
  title?: string;
  templateKey?: string;
  tipo?: TemplateTipo;
  categoria?: TemplateCategoria;
  canvasContent: CartaCanvasData;
}

export interface CartaTemplateExportOutput {
  title: string;
  template_key: string;
  tipo: TemplateTipo;
  categoria: TemplateCategoria;
  mode: 'canvas';
  canvas: {
    width: number;
    height: number;
    backgroundUrl: string;
    elements: CartaCanvasElement[];
  };
  content_json: {
    mode: 'canvas';
    canvas: {
      width: number;
      height: number;
      backgroundUrl: string;
      elements: CartaCanvasElement[];
    };
  };
}

/**
 * Normaliza uma chave de template para formato amigável (snake_case)
 */
export function normalizeTemplateExportKey(value: string): string {
  if (!value) return 'modelo';
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'modelo';
}

/**
 * Constrói o objeto de exportação do modelo de carta/declaração.
 * - Utiliza a estrutura real de content_json ({ mode: 'canvas', canvas: { ... } })
 * - Preserva backgroundUrl, imagens, elementos, coordenadas, camadas e configurações A4
 * - Omite IDs internos de tenant (ministry_id), IDs do banco de dados e credenciais
 * - Preserva placeholders dinâmicos (ex: {{igreja.nome}}, {{membro.nome}})
 */
export function buildCartaTemplateExportJson(
  input: CartaTemplateExportInput
): CartaTemplateExportOutput {
  const { title, templateKey, tipo = 'custom', categoria = 'carta', canvasContent } = input;

  const resolvedTitle = (title || '').trim() || 'Modelo de Carta';
  const resolvedKey = normalizeTemplateExportKey(templateKey || resolvedTitle);

  // Sanitizar e clonar elementos garantindo que são dados puros de layout/template
  const cleanElements: CartaCanvasElement[] = Array.isArray(canvasContent?.elements)
    ? canvasContent.elements.map((el) => {
        const item: CartaCanvasElement = {
          id: el.id,
          tipo: el.tipo,
          x: Number(el.x) || 0,
          y: Number(el.y) || 0,
          largura: Number(el.largura) || 100,
          altura: Number(el.altura) || 40,
          visivel: el.visivel !== false,
          locked: !!el.locked,
        };

        if (el.texto !== undefined) item.texto = el.texto;
        if (el.fontSize !== undefined) item.fontSize = el.fontSize;
        if (el.fonte !== undefined) item.fonte = el.fonte;
        if (el.cor !== undefined) item.cor = el.cor;
        if (el.alinhamento !== undefined) item.alinhamento = el.alinhamento;
        if (el.negrito !== undefined) item.negrito = el.negrito;
        if (el.italico !== undefined) item.italico = el.italico;
        if (el.sublinhado !== undefined) item.sublinhado = el.sublinhado;
        if (el.sombreado !== undefined) item.sombreado = el.sombreado;
        if (el.transparencia !== undefined) item.transparencia = el.transparencia;
        if (el.borderRadius !== undefined) item.borderRadius = el.borderRadius;
        if (el.backgroundColor !== undefined) item.backgroundColor = el.backgroundColor;
        if (el.borderColor !== undefined) item.borderColor = el.borderColor;
        if (el.borderWidth !== undefined) item.borderWidth = el.borderWidth;
        if (el.borderStyle !== undefined) item.borderStyle = el.borderStyle;
        if (el.imagemUrl !== undefined) item.imagemUrl = el.imagemUrl;

        return item;
      })
    : [];

  const canvasData = {
    width: Number(canvasContent?.width) || 794,
    height: Number(canvasContent?.height) || 1123,
    backgroundUrl: canvasContent?.backgroundUrl || '',
    elements: cleanElements,
  };

  const contentJson = {
    mode: 'canvas' as const,
    canvas: canvasData,
  };

  return {
    title: resolvedTitle,
    template_key: resolvedKey,
    tipo,
    categoria,
    mode: 'canvas',
    canvas: canvasData,
    content_json: contentJson,
  };
}

/**
 * Formata o payload de exportação como JSON indentado (2 espaços)
 */
export function formatCartaTemplateJson(data: CartaTemplateExportOutput): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Copia o texto para a área de transferência com fallback
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback para document.execCommand caso a API assíncrona falhe
    }
  }

  if (typeof document !== 'undefined') {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '-9999px';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      return success;
    } catch {
      return false;
    }
  }

  return false;
}
