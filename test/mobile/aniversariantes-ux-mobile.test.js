import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Bateria de Testes UX da FASE E.8.3 — UX Mobile de Aniversariantes
 *
 * Cobertura de Testes:
 * A. /app/aniversariantes existe
 * B. Utiliza MobileShell
 * C. Utiliza MobileHeader
 * D. Utiliza o padrão de navegação existente (MobileBottomNav)
 * E. Consulta a API oficial (/api/v1/mobile/aniversariantes)
 * F. Destaca aniversariantes de hoje
 * G. Lista aniversariantes do mês
 * H. Suporta filtro 'Minha Congregação' (minha_congregacao)
 * I. Suporta filtro 'Todo o Ministério' (todas)
 * J. Suporta filtros de período canônicos ('mes', 'hoje', 'proximos_30')
 * K. Possui loading/skeleton
 * L. Possui empty state
 * M. Possui tratamento de erro e botão de retry
 * N. Trata fallback de foto/avatar com onError e iniciais
 * O. Home (/app/inicio) possui atalho de acesso aos aniversariantes
 * P. Home (/app/inicio) apresenta resumo/widget de aniversariantes de hoje
 * Q. MobileBottomNav continua com exatamente 5 abas
 * R. Rigorosa privacidade: Nenhum uso de data_nascimento/idade/CPF/telefone na apresentação
 * S. Tratamento offline via MobileShell e OfflineBanner
 * T. Ausência de dados não quebra a interface
 */

describe('FASE E.8.3 — UX Mobile de Aniversariantes', () => {
  const rootDir = process.cwd();
  const anivPagePath = path.join(rootDir, 'src', 'app', 'app', 'aniversariantes', 'page.tsx');
  const inicioPagePath = path.join(rootDir, 'src', 'app', 'app', 'inicio', 'page.tsx');
  const bottomNavPath = path.join(rootDir, 'src', 'components', 'mobile', 'MobileBottomNav.tsx');
  const shellPath = path.join(rootDir, 'src', 'components', 'mobile', 'MobileShell.tsx');

  it('A. Rota /app/aniversariantes existe e está implementada como client component', () => {
    assert.ok(fs.existsSync(anivPagePath), 'Página /app/aniversariantes deve existir');
    const content = fs.readFileSync(anivPagePath, 'utf-8');
    assert.ok(content.includes("'use client'"), 'Deve ser client component');
  });

  it('B. Utiliza MobileShell', () => {
    const content = fs.readFileSync(anivPagePath, 'utf-8');
    assert.ok(content.includes('MobileShell'), 'Deve importar e envolver com MobileShell');
  });

  it('C. Utiliza MobileHeader com título e navegação', () => {
    const content = fs.readFileSync(anivPagePath, 'utf-8');
    assert.ok(content.includes('MobileHeader'), 'Deve usar MobileHeader');
    assert.ok(content.includes('title="Aniversariantes"'), 'Deve conter título Aniversariantes');
    assert.ok(content.includes('showBack={true}'), 'Deve habilitar botão de voltar');
  });

  it('D. Utiliza o padrão de navegação existente com MobileBottomNav', () => {
    const content = fs.readFileSync(anivPagePath, 'utf-8');
    assert.ok(content.includes('MobileBottomNav'), 'Deve renderizar MobileBottomNav');
  });

  it('E. Consulta a API oficial /api/v1/mobile/aniversariantes', () => {
    const content = fs.readFileSync(anivPagePath, 'utf-8');
    assert.ok(
      content.includes('/api/v1/mobile/aniversariantes'),
      'Deve chamar endpoint oficial /api/v1/mobile/aniversariantes'
    );
  });

  it('F. Destaca aniversariantes de hoje', () => {
    const content = fs.readFileSync(anivPagePath, 'utf-8');
    assert.ok(content.includes('Aniversariantes de Hoje'), 'Deve ter seção de destaque de hoje');
    assert.ok(content.includes('isHoje'), 'Deve usar a propriedade canônica isHoje');
  });

  it('G. Lista aniversariantes do mês', () => {
    const content = fs.readFileSync(anivPagePath, 'utf-8');
    assert.ok(
      content.includes('Aniversariantes deste Mês') || content.includes('tituloSecaoLista'),
      'Deve listar aniversariantes do mês'
    );
  });

  it('H. Suporta filtro Minha Congregação (minha_congregacao)', () => {
    const content = fs.readFileSync(anivPagePath, 'utf-8');
    assert.ok(content.includes('minha_congregacao'), 'Deve suportar escopo minha_congregacao');
    assert.ok(content.includes('Minha Congregação'), 'Deve exibir botão Minha Congregação');
  });

  it('I. Suporta filtro Todo o Ministério (todas)', () => {
    const content = fs.readFileSync(anivPagePath, 'utf-8');
    assert.ok(content.includes("'todas'"), 'Deve suportar escopo todas');
    assert.ok(content.includes('Todo o Ministério'), 'Deve exibir botão Todo o Ministério');
  });

  it('J. Suporta filtros de período canônicos (mes, hoje, proximos_30)', () => {
    const content = fs.readFileSync(anivPagePath, 'utf-8');
    assert.ok(content.includes("'mes'"), 'Deve suportar período mes');
    assert.ok(content.includes("'hoje'"), 'Deve suportar período hoje');
    assert.ok(content.includes("'proximos_30'"), 'Deve suportar período proximos_30');
  });

  it('K. Possui loading / skeleton estruturado', () => {
    const content = fs.readFileSync(anivPagePath, 'utf-8');
    assert.ok(content.includes('animate-pulse'), 'Deve ter classes de skeleton animate-pulse');
  });

  it('L. Possui empty state amigável e acolhedor', () => {
    const content = fs.readFileSync(anivPagePath, 'utf-8');
    assert.ok(
      content.includes('Nenhum aniversariante encontrado'),
      'Deve ter mensagem amigável de empty state'
    );
  });

  it('M. Possui tratamento de erro e botão de retry', () => {
    const content = fs.readFileSync(anivPagePath, 'utf-8');
    assert.ok(content.includes('errorMsg'), 'Deve capturar mensagem de erro');
    assert.ok(content.includes('Tentar novamente'), 'Deve fornecer botão de retry');
  });

  it('N. Trata fallback de foto/avatar com onError e iniciais do nome', () => {
    const content = fs.readFileSync(anivPagePath, 'utf-8');
    assert.ok(content.includes('handleImageError'), 'Deve ter handler de erro de imagem');
    assert.ok(content.includes('getInitials'), 'Deve ter função de iniciais para avatar fallback');
    assert.ok(content.includes('onError'), 'Tag img deve ter onError');
  });

  it('O. Home (/app/inicio) possui atalho de acesso aos Aniversariantes', () => {
    const content = fs.readFileSync(inicioPagePath, 'utf-8');
    assert.ok(content.includes('/app/aniversariantes'), 'Home deve conter link para /app/aniversariantes');
    assert.ok(content.includes('Aniversariantes'), 'Home deve exibir atalho Aniversariantes');
  });

  it('P. Home (/app/inicio) apresenta resumo e widget de aniversariantes', () => {
    const content = fs.readFileSync(inicioPagePath, 'utf-8');
    assert.ok(content.includes('aniversariantesHoje'), 'Home deve consultar aniversariantes de hoje');
    assert.ok(content.includes('/api/v1/mobile/aniversariantes?periodo=hoje'), 'Home deve chamar endpoint para resumo');
  });

  it('Q. MobileBottomNav continua com exatamente 5 abas originais', () => {
    const content = fs.readFileSync(bottomNavPath, 'utf-8');
    const matches = content.match(/href:\s*'\/app/g);
    assert.strictEqual(matches?.length, 5, 'MobileBottomNav deve ter exatamente 5 abas');
  });

  it('R. Rigorosa privacidade: Nenhum uso de data_nascimento/idade/CPF/telefone na apresentação', () => {
    const content = fs.readFileSync(anivPagePath, 'utf-8');
    assert.strictEqual(content.includes('data_nascimento'), false, 'Não deve exibir data_nascimento');
    assert.strictEqual(content.includes('idadeAtual'), false, 'Não deve exibir idadeAtual');
    assert.strictEqual(content.includes('idadeCompletara'), false, 'Não deve exibir idadeCompletara');
    assert.strictEqual(content.includes('cpf'), false, 'Não deve exibir cpf');
    assert.strictEqual(content.includes('whatsapp'), false, 'Não deve exibir whatsapp');
    assert.strictEqual(content.includes('telefone'), false, 'Não deve exibir telefone');
  });

  it('S. Tratamento offline via MobileShell e OfflineBanner', () => {
    const content = fs.readFileSync(shellPath, 'utf-8');
    assert.ok(content.includes('OfflineBanner'), 'MobileShell deve conter OfflineBanner');
  });

  it('T. Ausência de dados não quebra a interface', () => {
    const content = fs.readFileSync(anivPagePath, 'utf-8');
    assert.ok(content.includes("getInitials(item.nome)"), 'Deve usar fallback para nome nulo/vazio');
    assert.ok(content.includes('aniversariantes.length === 0'), 'Trata lista vazia com elegância');
  });
});
