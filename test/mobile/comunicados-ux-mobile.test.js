import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Bateria de Testes UX da FASE E.7.4 — UX Mobile do Mural de Comunicados
 *
 * Cobertura de Testes:
 * A. Rota /app/comunicados existe e está implementada como client component
 * B. Rota /app/comunicados/[id] existe e está implementada
 * C. Componente de feed trata estados de loading/skeleton, empty state e erro com retry
 * D. Componente suporta paginação / carregamento progressivo
 * E. Filtros de categoria estão mapeados para as categorias reais da API ('geral', 'urgente', 'departamento', 'evento')
 * F. Card renderiza imagem opcional com fallback/onError sem quebrar layout
 * G. Detalhe renderiza com segurança sem dangerouslySetInnerHTML inseguro
 * H. Comunicado inexistente ou 404 exibe estado de erro seguro com botão de retorno
 * I. Atalho de Comunicados integrado à Home /app/inicio
 * J. BottomNav mantém rigorosamente as 5 abas originais (sem criação indevida de 6ª aba)
 * K. MobileShell com OfflineBanner integrado garante suporte offline
 */

describe('FASE E.7.4 — UX Mobile do Mural de Comunicados', () => {
  const rootDir = process.cwd();

  it('A. Rota /app/comunicados existe e está implementada como client component', () => {
    const filePath = path.join(rootDir, 'src', 'app', 'app', 'comunicados', 'page.tsx');
    assert.ok(fs.existsSync(filePath), 'Página /app/comunicados deve existir');

    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.includes("'use client'"), 'Deve ser client component');
    assert.ok(content.includes('MobileShell'), 'Deve usar MobileShell');
    assert.ok(content.includes('MobileHeader'), 'Deve usar MobileHeader');
    assert.ok(content.includes('MobileBottomNav'), 'Deve usar MobileBottomNav');
  });

  it('B. Rota /app/comunicados/[id] existe e está implementada', () => {
    const filePath = path.join(rootDir, 'src', 'app', 'app', 'comunicados', '[id]', 'page.tsx');
    assert.ok(fs.existsSync(filePath), 'Página /app/comunicados/[id] deve existir');

    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.includes("'use client'"), 'Deve ser client component');
    assert.ok(content.includes('MobileHeader'), 'Deve usar MobileHeader');
    assert.ok(content.includes('showBack={true}'), 'Deve exibir botão de voltar');
  });

  it('C. Feed trata estados de loading/skeleton, empty state e erro com retry', () => {
    const filePath = path.join(rootDir, 'src', 'app', 'app', 'comunicados', 'page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Loading / Skeleton
    assert.ok(content.includes('animate-pulse'), 'Deve ter skeleton loader');

    // Empty state
    assert.ok(content.includes('Nenhum comunicado disponível'), 'Deve ter empty state amigável');

    // Error + Retry
    assert.ok(content.includes('Tentar novamente'), 'Deve ter opção de retry');
  });

  it('D. Feed suporta paginação progressiva', () => {
    const filePath = path.join(rootDir, 'src', 'app', 'app', 'comunicados', 'page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    assert.ok(content.includes('handleLoadMore'), 'Deve ter função de carregar mais');
    assert.ok(content.includes('hasMore'), 'Deve controlar hasMore');
    assert.ok(content.includes('Carregar comunicados anteriores'), 'Deve exibir botão de carregar mais');
  });

  it('E. Filtros de categoria estão mapeados para as categorias reais do backend', () => {
    const filePath = path.join(rootDir, 'src', 'app', 'app', 'comunicados', 'page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    assert.ok(content.includes("'urgente'"), 'Deve mapear categoria urgente');
    assert.ok(content.includes("'evento'"), 'Deve mapear categoria evento');
    assert.ok(content.includes("'departamento'"), 'Deve mapear categoria departamento');
    assert.ok(content.includes("'geral'"), 'Deve mapear categoria geral');
  });

  it('F. Card trata imagem opcional com fallback onError para não quebrar o layout', () => {
    const filePath = path.join(rootDir, 'src', 'app', 'app', 'comunicados', 'page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    assert.ok(content.includes('handleImageError'), 'Deve ter handler de erro de imagem');
    assert.ok(content.includes('onError'), 'Deve ter prop onError na tag img');
  });

  it('G. Detalhe renderiza texto seguro sem dangerouslySetInnerHTML arbitrário', () => {
    const filePath = path.join(rootDir, 'src', 'app', 'app', 'comunicados', '[id]', 'page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    assert.strictEqual(
      content.includes('dangerouslySetInnerHTML'),
      false,
      'Não deve usar dangerouslySetInnerHTML no conteúdo do comunicado'
    );
    assert.ok(content.includes('whitespace-pre-line'), 'Deve usar whitespace-pre-line para renderizar texto');
  });

  it('H. Detalhe trata comunicado inexistente ou 404 com estado seguro e botão voltar', () => {
    const filePath = path.join(rootDir, 'src', 'app', 'app', 'comunicados', '[id]', 'page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    assert.ok(content.includes('Comunicado Indisponível'), 'Deve ter mensagem de indisponibilidade');
    assert.ok(content.includes('Voltar ao mural'), 'Deve ter botão de retorno');
  });

  it('I. Home /app/inicio possui atalho ativo para Comunicados', () => {
    const filePath = path.join(rootDir, 'src', 'app', 'app', 'inicio', 'page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    assert.ok(content.includes('/app/comunicados'), 'Home deve conter link para /app/comunicados');
    assert.ok(content.includes('Comunicados'), 'Home deve exibir rótulo Comunicados');
  });

  it('J. BottomNav preserva exatamente as 5 abas principais do MVP', () => {
    const filePath = path.join(rootDir, 'src', 'components', 'mobile', 'MobileBottomNav.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Verifica que não foi adicionada uma 6ª aba no BottomNav
    const matches = content.match(/href:\s*'\/app/g);
    assert.strictEqual(matches?.length, 5, 'MobileBottomNav deve manter exatamente 5 abas');
  });

  it('K. MobileShell integra OfflineBanner para resiliência de rede', () => {
    const filePath = path.join(rootDir, 'src', 'components', 'mobile', 'MobileShell.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    assert.ok(content.includes('OfflineBanner'), 'MobileShell deve conter OfflineBanner');
  });
});
