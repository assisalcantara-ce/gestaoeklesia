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
