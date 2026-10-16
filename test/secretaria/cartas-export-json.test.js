import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Testes unitários para exportação de JSON no Editor de Cartas e Declarações
 * Valida os requisitos da tarefa de exportação para geração de modelos globais
 */

// Lógica de exportação espelhando src/lib/cartas-export-json.ts
function normalizeTemplateExportKey(value) {
  if (!value) return 'modelo';
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'modelo';
}

function buildCartaTemplateExportJson({
  title,
  templateKey,
  tipo = 'custom',
  categoria = 'carta',
  canvasContent,
}) {
  const resolvedTitle = (title || '').trim() || 'Modelo de Carta';
  const resolvedKey = normalizeTemplateExportKey(templateKey || resolvedTitle);

  const cleanElements = Array.isArray(canvasContent?.elements)
    ? canvasContent.elements.map((el) => {
        const item = {
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
    mode: 'canvas',
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

describe('Editor de Cartas — Botão Copiar JSON', () => {
  const mockCanvasData = {
    width: 794,
    height: 1123,
    backgroundUrl: 'https://storage.supabase.co/v1/papel-timbrado-oficial.png',
    elements: [
      {
        id: 'elem-logo-1',
        tipo: 'logo',
        x: 45,
        y: 26,
        largura: 92,
        altura: 101,
        imagemUrl: 'https://storage.supabase.co/v1/logo-igreja.png',
        visivel: true,
        locked: false,
      },
      {
        id: 'elem-header-text',
        tipo: 'texto',
        x: 142,
        y: 24,
        largura: 506,
        altura: 32,
        texto: '{{igreja.nome}}',
        fonte: 'Calibri',
        fontSize: 22,
        cor: '#111827',
        negrito: true,
        italico: false,
        sublinhado: false,
        alinhamento: 'left',
        transparencia: 1,
        visivel: true,
        locked: false,
      },
      {
        id: 'elem-corpo-carta',
        tipo: 'texto',
        x: 64,
        y: 180,
        largura: 666,
        altura: 400,
        texto: 'Certificamos que o membro {{membro.nome}}, portador do CPF {{membro.cpf}}, é membro ativo.',
        fonte: 'Calibri',
        fontSize: 16,
        cor: '#1f2937',
        negrito: false,
        italico: false,
        sublinhado: false,
        alinhamento: 'justify',
        transparencia: 0.95,
        visivel: true,
        locked: false,
      },
      {
        id: 'elem-chapa-rodape',
        tipo: 'forma',
        x: 0,
        y: 1080,
        largura: 794,
        altura: 43,
        backgroundColor: '#0d9488',
        borderRadius: 0,
        transparencia: 1,
        visivel: true,
        locked: true,
      },
    ],
  };

  it('deve gerar a estrutura content_json com mode: "canvas" e configurações da folha A4', () => {
    const exported = buildCartaTemplateExportJson({
      title: 'Declaração de Membro Ativo',
      templateKey: 'declaracao_membro_ativo',
      tipo: 'membro_ativo',
      categoria: 'declaracao',
      canvasContent: mockCanvasData,
    });

    assert.strictEqual(exported.title, 'Declaração de Membro Ativo');
    assert.strictEqual(exported.template_key, 'declaracao_membro_ativo');
    assert.strictEqual(exported.tipo, 'membro_ativo');
    assert.strictEqual(exported.categoria, 'declaracao');

    // Validação de content_json
    assert.ok(exported.content_json, 'content_json deve estar presente');
    assert.strictEqual(exported.content_json.mode, 'canvas');
    assert.strictEqual(exported.content_json.canvas.width, 794);
    assert.strictEqual(exported.content_json.canvas.height, 1123);
    assert.strictEqual(
      exported.content_json.canvas.backgroundUrl,
      'https://storage.supabase.co/v1/papel-timbrado-oficial.png'
    );
  });

  it('deve preservar todos os elementos, coordenadas, dimensões, estilos e ordem de camadas', () => {
    const exported = buildCartaTemplateExportJson({
      title: 'Carta de Mudança',
      canvasContent: mockCanvasData,
    });

    const elements = exported.content_json.canvas.elements;
    assert.strictEqual(elements.length, 4);

    // Elemento 0: Logo
    assert.strictEqual(elements[0].id, 'elem-logo-1');
    assert.strictEqual(elements[0].tipo, 'logo');
    assert.strictEqual(elements[0].x, 45);
    assert.strictEqual(elements[0].y, 26);
    assert.strictEqual(elements[0].largura, 92);
    assert.strictEqual(elements[0].altura, 101);
    assert.strictEqual(elements[0].imagemUrl, 'https://storage.supabase.co/v1/logo-igreja.png');

    // Elemento 1: Cabeçalho com placeholder
    assert.strictEqual(elements[1].texto, '{{igreja.nome}}');
    assert.strictEqual(elements[1].negrito, true);
    assert.strictEqual(elements[1].fontSize, 22);

    // Elemento 2: Corpo com placeholders e transparência
    assert.match(elements[2].texto, /{{membro\.nome}}/);
    assert.match(elements[2].texto, /{{membro\.cpf}}/);
    assert.strictEqual(elements[2].transparencia, 0.95);

    // Elemento 3: Forma com locked
    assert.strictEqual(elements[3].tipo, 'forma');
    assert.strictEqual(elements[3].backgroundColor, '#0d9488');
    assert.strictEqual(elements[3].locked, true);
  });

  it('não deve incluir IDs internos de tenant, dados pessoais preenchidos ou tokens', () => {
    // Simula objeto que poderia ter dados residuais de banco
    const tenantDirtyCanvas = {
      ...mockCanvasData,
      ministry_id: 'tenant-secret-uuid-1234',
      tenant_token: 'secret_jwt_token',
      db_id: 'internal-row-9876',
    };

    const exported = buildCartaTemplateExportJson({
      title: 'Carta Recomendação',
      canvasContent: tenantDirtyCanvas,
    });

    const exportedString = JSON.stringify(exported);

    assert.strictEqual('ministry_id' in exported, false);
    assert.strictEqual('tenant_token' in exported, false);
    assert.strictEqual('db_id' in exported, false);
    assert.strictEqual(exportedString.includes('tenant-secret-uuid-1234'), false);
    assert.strictEqual(exportedString.includes('secret_jwt_token'), false);
  });

  it('deve copiar alterações ainda não salvas no editor', () => {
    // Usuário alterou x, y e texto no editor sem clicar em salvar
    const liveUnsavedCanvas = {
      width: 794,
      height: 1123,
      backgroundUrl: '',
      elements: [
        {
          id: 'temp-unsaved-el',
          tipo: 'texto',
          x: 100, // alterado
          y: 250, // alterado
          largura: 500,
          altura: 80,
          texto: 'Texto recém digitado no canvas pelo usuário {{igreja.nome}}',
          visivel: true,
          locked: false,
        },
      ],
    };

    const exported = buildCartaTemplateExportJson({
      title: 'Rascunho Não Salvo',
      canvasContent: liveUnsavedCanvas,
    });

    assert.strictEqual(exported.content_json.canvas.elements[0].x, 100);
    assert.strictEqual(exported.content_json.canvas.elements[0].y, 250);
    assert.strictEqual(
      exported.content_json.canvas.elements[0].texto,
      'Texto recém digitado no canvas pelo usuário {{igreja.nome}}'
    );
  });

  it('deve formatar como JSON legível com indentação de 2 espaços', () => {
    const exported = buildCartaTemplateExportJson({
      title: 'Modelo Teste',
      canvasContent: mockCanvasData,
    });

    const formatted = JSON.stringify(exported, null, 2);

    assert.ok(formatted.includes('{\n  "title": "Modelo Teste",'));
    assert.ok(formatted.includes('  "content_json": {'));
    assert.ok(formatted.includes('    "mode": "canvas",'));
    assert.ok(formatted.includes('    "canvas": {'));

    // Verifica que é um JSON válido
    const parsed = JSON.parse(formatted);
    assert.strictEqual(parsed.title, 'Modelo Teste');
  });

  it('deve normalizar chaves com acentos, espaços e caracteres especiais', () => {
    assert.strictEqual(normalizeTemplateExportKey('Carta de Apresentação & Batismo!'), 'carta_de_apresentacao_batismo');
    assert.strictEqual(normalizeTemplateExportKey('  DECLARAÇÃO OFICIAL 2026  '), 'declaracao_oficial_2026');
    assert.strictEqual(normalizeTemplateExportKey(''), 'modelo');
  });
});
