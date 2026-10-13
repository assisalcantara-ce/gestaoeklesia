import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Menu de Ações dos Eventos (Portal & Posicionamento Anti-Recorte)', () => {
  // Simulação de cálculo de coordenadas espelhando exatamente a implementação em src/app/eventos/page.tsx
  function calculateDropdownCoords({
    btnRect,
    viewportWidth,
    viewportHeight,
    hasPublicLink,
    canDelete,
  }: {
    btnRect: { top: number; bottom: number; left: number; right: number };
    viewportWidth: number;
    viewportHeight: number;
    hasPublicLink: boolean;
    canDelete: boolean;
  }) {
    const menuWidth = 208; // w-52 = 208px

    let estimatedHeight = 136;
    if (hasPublicLink) estimatedHeight += 40;
    if (canDelete) estimatedHeight += 46;

    const spaceBelow = viewportHeight - btnRect.bottom;
    const spaceAbove = btnRect.top;

    const openUpwards = spaceBelow < (estimatedHeight + 12) && spaceAbove > spaceBelow;

    let top: number;
    let availableHeight: number;
    if (openUpwards) {
      availableHeight = Math.max(140, spaceAbove - 16);
      top = Math.max(8, btnRect.top - Math.min(estimatedHeight, availableHeight) - 6);
    } else {
      availableHeight = Math.max(140, spaceBelow - 16);
      top = Math.min(viewportHeight - 8, btnRect.bottom + 6);
    }

    const idealLeft = btnRect.right - menuWidth;
    const left = Math.max(8, Math.min(viewportWidth - menuWidth - 8, idealLeft));

    return {
      top,
      left,
      openUpwards,
      maxHeight: Math.min(estimatedHeight + 10, availableHeight),
      menuWidth,
      estimatedHeight,
    };
  }

  test('1. Deve abrir para baixo quando houver espaço suficiente abaixo', () => {
    const result = calculateDropdownCoords({
      btnRect: { top: 100, bottom: 130, left: 800, right: 830 },
      viewportWidth: 1200,
      viewportHeight: 800,
      hasPublicLink: true,
      canDelete: true,
    });

    assert.equal(result.openUpwards, false, 'Deve abrir para baixo');
    assert.equal(result.top, 136, 'Deve posicionar 6px abaixo do botão');
    assert.ok(result.top + result.maxHeight <= 800, 'Menu não deve ultrapassar o viewport inferior');
  });

  test('2. Deve abrir para cima quando o evento estiver no final da tabela (espaço inferior insuficiente)', () => {
    // Botão na última linha da tabela, próximo ao rodapé da janela (bottom: 740 de 768)
    const result = calculateDropdownCoords({
      btnRect: { top: 710, bottom: 740, left: 800, right: 830 },
      viewportWidth: 1200,
      viewportHeight: 768,
      hasPublicLink: true,
      canDelete: true,
    });

    assert.equal(result.openUpwards, true, 'Deve inverter e abrir para cima');
    assert.ok(result.top < 710, 'O menu deve ficar posicionado acima do botão');
    assert.ok(result.top >= 8, 'O topo do menu deve respeitar margem mínima de 8px');
  });

  test('3. Não deve ser cortado pela borda direita da tela (Desktop ou Mobile)', () => {
    // Botão no extremo direito da janela (right = 370 num viewport de 375px)
    const result = calculateDropdownCoords({
      btnRect: { top: 300, bottom: 330, left: 340, right: 370 },
      viewportWidth: 375,
      viewportHeight: 667,
      hasPublicLink: false,
      canDelete: false,
    });

    assert.ok(result.left >= 8, 'Margem esquerda deve ser >= 8px');
    assert.ok(result.left + result.menuWidth <= 375, 'Menu deve caber completamente dentro da largura da tela');
  });

  test('4. Deve ajustar a altura máxima com scroll quando a viewport for muito compacta', () => {
    const result = calculateDropdownCoords({
      btnRect: { top: 200, bottom: 230, left: 200, right: 230 },
      viewportWidth: 800,
      viewportHeight: 350,
      hasPublicLink: true,
      canDelete: true,
    });

    assert.ok(result.maxHeight >= 100, 'Deve garantir altura acessível');
    assert.ok(result.top + result.maxHeight <= 350, 'Deve caber dentro do viewport com rolagem interna');
  });

  test('5. Estrutura do arquivo eventos/page.tsx deve conter createPortal e overlay de fechamento', async () => {
    const fs = await import('fs');
    const code = fs.readFileSync('src/app/eventos/page.tsx', 'utf8');

    assert.ok(code.includes("import { createPortal } from 'react-dom';"), 'Deve importar createPortal');
    assert.ok(code.includes('data-menu-portal="true"'), 'Deve conter contêiner identificado do portal');
    assert.ok(code.includes('fixed inset-0 z-[99998]'), 'Deve conter overlay para captura de clique fora');
    assert.ok(code.includes("e.key === 'Escape'"), 'Deve tratar evento Escape para acessibilidade');
    assert.ok(code.includes("window.addEventListener('scroll'"), 'Deve fechar ao rolar a página para não desalinhar');
    assert.ok(code.includes("window.addEventListener('resize'"), 'Deve fechar no redimensionamento da janela');
  });
});
