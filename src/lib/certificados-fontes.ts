// Utilitário para injeção de fontes e espera pelo carregamento de fontes em janelas de impressão / renderização de certificados

export const FONTES_CERTIFICADOS = [
  'Arial',
  'Arial Black',
  'Georgia',
  'Times New Roman',
  'Verdana',
  'Trebuchet MS',
  'Comic Sans MS',
  'Courier New',
  'Impact',
  'Tahoma',
  'Palatino',
  'Garamond',
  'Book Antiqua',
  'Lucida Console',
  'Great Vibes',
  'Allura',
];

/**
 * CSS contendo @font-face para incluir no head de janelas de impressão (window.open)
 * Garante que Great Vibes e Allura renderizem localmente e com fallback para Google Fonts.
 */
export function getFontesCertificadosHeadHtml(): string {
  return `
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Allura&family=Great+Vibes&display=swap" rel="stylesheet">
    <style>
      @font-face {
        font-family: 'Great Vibes';
        font-style: normal;
        font-weight: 400;
        font-display: swap;
        src: url('/fonts/GreatVibes-Regular.woff2') format('woff2');
      }
      @font-face {
        font-family: 'Allura';
        font-style: normal;
        font-weight: 400;
        font-display: swap;
        src: url('/fonts/Allura-Regular.woff2') format('woff2');
      }
    </style>
  `;
}

/**
  * Script a ser injetado nas janelas de impressão para aguardar o carregamento
  * completo das fontes antes de disparar o print dialog (document.fonts.ready).
  */
export function getFontesReadyPrintScript(): string {
  return `
    <script>
      (function() {
        function dispararImpressao() {
          if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function() {
              setTimeout(function() { window.print(); }, 250);
            }).catch(function() {
              setTimeout(function() { window.print(); }, 400);
            });
          } else {
            setTimeout(function() { window.print(); }, 400);
          }
        }
        if (document.readyState === 'complete') {
          dispararImpressao();
        } else {
          window.addEventListener('load', dispararImpressao);
        }
      })();
    </script>
  `;
}

/**
 * Interface com os parâmetros para cálculo de auto-ajuste de fonte.
 */
export interface CalculoFonteAjustadaParams {
  texto: string;
  larguraElemento: number;
  alturaElemento: number;
  fontSizeBase: number;
  fonte?: string;
  isSingleLine?: boolean;
  minFontSize?: number;
}

/**
 * Calcula o tamanho de fonte proporcional para garantir que o texto
 * caiba perfeitamente na largura e altura do elemento sem quebrar linha
 * nem ultrapassar a caixa delimitadora.
 * Não altera permanentemente o fontSize salvo no modelo.
 */
export function calcularFontSizeAutoAjustado({
  texto,
  larguraElemento,
  alturaElemento,
  fontSizeBase,
  fonte = 'Arial',
  isSingleLine = false,
  minFontSize = 10,
}: CalculoFonteAjustadaParams): number {
  if (!texto || !texto.trim()) return fontSizeBase || 14;

  const baseSize = fontSizeBase && fontSizeBase > 0 ? fontSizeBase : 14;
  const textoLimpo = texto.replace(/<[^>]+>/g, '').trim();
  if (!textoLimpo) return baseSize;

  const fontLower = fonte.toLowerCase();
  const isHandwritten = fontLower.includes('great vibes') || fontLower.includes('allura');

  // Coeficiente médio de largura de caractere por px de font-size
  // Em fontes caligráficas (Great Vibes, Allura), glifos minúsculos são muito mais estreitos
  // e fluidos que em maiúsculas (ALL-CAPS).
  const isAllUpper = textoLimpo.length > 3 && textoLimpo === textoLimpo.toUpperCase();
  let charFactor = 0.52;
  if (fontLower.includes('great vibes')) {
    charFactor = isAllUpper ? 0.58 : 0.44;
  } else if (fontLower.includes('allura')) {
    charFactor = isAllUpper ? 0.52 : 0.40;
  } else if (fontLower.includes('times') || fontLower.includes('georgia')) {
    charFactor = isAllUpper ? 0.54 : 0.46;
  } else if (fontLower.includes('courier')) {
    charFactor = 0.60;
  } else {
    charFactor = isAllUpper ? 0.56 : 0.48;
  }

  // Se o elemento tiver padding horizontal interno reservamos uma margem de segurança (mínimo 10px)
  const safeWidth = Math.max(10, larguraElemento - 10);
  const safeHeight = Math.max(10, alturaElemento - 4);

  // Se for linha única (ou participante/nome de destaque), deve caber integralmente em 1 linha
  if (isSingleLine || !textoLimpo.includes('\n')) {
    const estimatedWidthAtBase = textoLimpo.length * baseSize * charFactor;
    let sizeForWidth = baseSize;
    if (estimatedWidthAtBase > safeWidth) {
      sizeForWidth = Math.floor(safeWidth / (textoLimpo.length * charFactor));
    }

    // Também deve caber na altura (line-height ~ 1.25 a 1.35 para manuscrita)
    const lineHeightFactor = isHandwritten ? 1.3 : 1.2;
    const sizeForHeight = Math.floor(safeHeight / lineHeightFactor);

    const calculated = Math.min(baseSize, sizeForWidth, sizeForHeight);
    return Math.max(minFontSize, calculated);
  }

  // Se tiver múltiplas linhas explícitas
  const linhas = textoLimpo.split('\n');
  const maxLineLength = Math.max(...linhas.map((l) => l.length), 1);
  const estimatedWidth = maxLineLength * baseSize * charFactor;
  let sizeForWidth = baseSize;
  if (estimatedWidth > safeWidth) {
    sizeForWidth = Math.floor(safeWidth / (maxLineLength * charFactor));
  }

  const numLines = linhas.length;
  const sizeForHeight = Math.floor(safeHeight / (numLines * 1.25));

  const calculated = Math.min(baseSize, sizeForWidth, sizeForHeight);
  return Math.max(minFontSize, calculated);
}

/**
 * Retorna as propriedades de estilo CSS inline para renderizar um elemento de texto
 * com auto-fit, alinhamento flexível e sem sobreposição de elementos adjacentes.
 */
export function buildTextoEstiloRenderizacao(
  el: {
    x: number;
    y: number;
    largura: number;
    altura: number;
    fontSize?: number;
    fonte?: string;
    cor?: string;
    negrito?: boolean;
    italico?: boolean;
    sublinhado?: boolean;
    sombreado?: boolean;
    alinhamento?: string;
    backgroundColor?: string;
    borderRadius?: number;
  },
  textoRenderizado: string,
  isSingleLine = false
): {
  containerStyle: string;
  innerStyle: string;
  fontSizeEfetivo: number;
} {
  const fonte = el.fonte || 'Arial';
  const fontSizeBase = el.fontSize || 14;

  const fontSizeEfetivo = calcularFontSizeAutoAjustado({
    texto: textoRenderizado,
    larguraElemento: el.largura,
    alturaElemento: el.altura,
    fontSizeBase,
    fonte,
    isSingleLine,
  });

  const align = el.alinhamento || 'left';

  const containerStyle = [
    `position:absolute;`,
    `left:${el.x}px;`,
    `top:${el.y}px;`,
    `width:${el.largura}px;`,
    `height:${el.altura}px;`,
    `box-sizing:border-box;`,
    `overflow:hidden;`,
    `display:flex;`,
    `flex-direction:column;`,
    `justify-content:center;`,
    `align-items:${align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'};`,
    el.backgroundColor ? `background-color:${el.backgroundColor};` : '',
    el.borderRadius ? `border-radius:${el.borderRadius}px;` : '',
    el.backgroundColor ? `padding:0 8px;` : '',
  ].filter(Boolean).join('');

  const fontLower = fonte.toLowerCase();
  const isHandwritten = fontLower.includes('great vibes') || fontLower.includes('allura');
  const lineHeight = isHandwritten ? '1.25' : '1.2';

  const innerStyle = [
    `width:100%;`,
    `font-size:${fontSizeEfetivo}px;`,
    `font-family:${fonte}, sans-serif;`,
    `font-weight:${el.negrito ? 700 : 400};`,
    `font-style:${el.italico ? 'italic' : 'normal'};`,
    `text-decoration:${el.sublinhado ? 'underline' : 'none'};`,
    el.sombreado ? `text-shadow:2px 2px 2px rgba(0,0,0,0.5);` : '',
    `color:${el.cor || '#111'};`,
    `text-align:${align};`,
    `line-height:${lineHeight};`,
    isSingleLine ? `white-space:nowrap;` : `word-break:break-word;`,
    `overflow:hidden;`,
    `box-sizing:border-box;`,
    `pointer-events:none;`,
  ].filter(Boolean).join('');

  return { containerStyle, innerStyle, fontSizeEfetivo };
}

