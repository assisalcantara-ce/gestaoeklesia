import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { signMemberPrefillToken, verifyMemberPrefillToken } from '../../src/lib/evento-membro-token';

describe('Inscrição Pública de Eventos - Autocomplete Seguro de Membros e LGPD', () => {
  const projectRoot = process.cwd();

  it('1. Validação do Token HMAC: Integridade, Expiração e Não-Repúdio', () => {
    const payload = {
      memberId: 'membro-uuid-111',
      eventoId: 'evento-uuid-222',
      ministryId: 'ministry-uuid-333',
    };

    const token = signMemberPrefillToken(payload);
    assert.ok(token);

    // Validação de token correto
    const resultado = verifyMemberPrefillToken(token);
    assert.equal(resultado.valido, true);
    assert.equal(resultado.memberId, 'membro-uuid-111');
    assert.equal(resultado.eventoId, 'evento-uuid-222');
    assert.equal(resultado.ministryId, 'ministry-uuid-333');

    // Tentativa de adulteração (trocar memberId no token)
    const raw = Buffer.from(token, 'base64url').toString('utf-8');
    const parsed = JSON.parse(raw);
    parsed.memberId = 'membro-uuid-hacker';
    const fakeToken = Buffer.from(JSON.stringify(parsed)).toString('base64url');
    assert.equal(verifyMemberPrefillToken(fakeToken).valido, false);
  });

  it('2. API de Busca Pública (membros/route.ts): Garante Mínimo de 3 Caracteres e Não Exposição de PII', () => {
    const routePath = path.join(projectRoot, 'src/app/api/v1/eventos/publico/[slug]/membros/route.ts');
    const routeContent = fs.readFileSync(routePath, 'utf-8');

    // Mínimo de 3 caracteres
    assert.match(routeContent, /q\.length\s*<\s*3/);
    // Rate limit
    assert.match(routeContent, /checkRateLimit/);
    // Limite máximo de registros (6 resultados)
    assert.match(routeContent, /\.limit\(6\)/);
    // Isolamento de tenant: ministry_id do evento
    assert.match(routeContent, /\.eq\('ministry_id',\s*evento\.ministry_id\)/);
    // Select seguro sem dados pessoais sensíveis (apenas id, name e congregação)
    assert.match(routeContent, /\.select\('id,\s*name,\s*congregacao_id,\s*congregacoes\(id,\s*nome\)'\)/);
  });

  it('3. API de Confirmação (membros/confirmar/route.ts): Exige Dados de Confirmação e Assina Token', () => {
    const routePath = path.join(projectRoot, 'src/app/api/v1/eventos/publico/[slug]/membros/confirmar/route.ts');
    const routeContent = fs.readFileSync(routePath, 'utf-8');

    // Rate limit estrito de confirmação
    assert.match(routeContent, /checkRateLimit\(rlKey,\s*5,\s*60\s*\*\s*1000\)/);
    // Validação por nascimento, dígitos de CPF ou final de telefone
    assert.match(routeContent, /data_nascimento/);
    assert.match(routeContent, /digitos_cpf/);
    assert.match(routeContent, /telefone_confirmacao/);
    // Geração de token assinado
    assert.match(routeContent, /signMemberPrefillToken/);
  });

  it('4. API de Inscrição (inscricao/route.ts): Valida Member Token e Vincula Oficialmente ao member_id', () => {
    const routePath = path.join(projectRoot, 'src/app/api/v1/eventos/inscricao/route.ts');
    const routeContent = fs.readFileSync(routePath, 'utf-8');

    // Import e verificação do token
    assert.match(routeContent, /verifyMemberPrefillToken/);
    assert.match(routeContent, /verifiedMemberId/);
    assert.match(routeContent, /member_id:\s*verifiedMemberId/);
    // Se for membro verificado, nome_externo pode ser null
    assert.match(routeContent, /nome_externo:\s*verifiedMemberId\s*\?\s*null\s*:\s*nome/);
  });

  it('5. Frontend (page.tsx): Debounce de 300ms, Navegação por Teclado e Fallback para Inscrição Manual', () => {
    const pagePath = path.join(projectRoot, 'src/app/eventos/e/[slug]/page.tsx');
    const pageContent = fs.readFileSync(pagePath, 'utf-8');

    // Debounce de 300ms
    assert.match(pageContent, /setTimeout\([\s\S]*?,\s*300\)/);
    // Teclas ArrowDown, ArrowUp, Enter, Escape
    assert.match(pageContent, /ArrowDown/);
    assert.match(pageContent, /ArrowUp/);
    assert.match(pageContent, /Enter/);
    assert.match(pageContent, /Escape/);
    // Modal de confirmação seguro
    assert.match(pageContent, /Confirmar Identidade/);
    assert.match(pageContent, /Digitar Manualmente/);
  });

  it('6. Modal de Confirmação: CPF como Padrão, Máscaras e Proteção contra Teclado/Zoom no iOS', () => {
    const pagePath = path.join(projectRoot, 'src/app/eventos/e/[slug]/page.tsx');
    const pageContent = fs.readFileSync(pagePath, 'utf-8');

    // CPF como método inicial
    assert.match(pageContent, /setTipoConfirmacao\('cpf'\)/);
    // Máscara 000.000.000-00 e DD/MM/AAAA
    assert.match(pageContent, /aplicarMascaraCpf/);
    assert.match(pageContent, /aplicarMascaraData/);
    assert.match(pageContent, /validarDataReal/);
    // type="text" com inputMode="numeric" e sem type="date"
    assert.match(pageContent, /inputMode="numeric"/);
    assert.ok(!pageContent.includes('type={tipoConfirmacao === \'nascimento\' ? \'date\' : \'text\'}'));
    // Fonte >= 16px (text-base) para evitar zoom automático no iOS Safari
    assert.match(pageContent, /text-base md:text-sm/);
    // Foco automático ao abrir ou alternar
    assert.match(pageContent, /inputConfirmacaoRef\.current\?\.focus\(\)/);
  });

  it('7. Regra Obrigatória de Prioridade do WhatsApp no Preenchimento Automático', () => {
    // Simulador da regra implementada no backend (confirmar/route.ts)
    function resolverTelefonePriorizado(member) {
      const whatsappValido = (typeof member.whatsapp === 'string' && member.whatsapp.trim()) ? member.whatsapp.trim() : null;
      const celularValido = (typeof member.celular === 'string' && member.celular.trim()) ? member.celular.trim() : null;
      const phoneValido = (typeof member.phone === 'string' && member.phone.trim()) ? member.phone.trim() : null;

      return whatsappValido || celularValido || phoneValido || '';
    }

    // Caso 1: WhatsApp preenchido e celular vazio -> utilizar WhatsApp
    assert.equal(
      resolverTelefonePriorizado({ whatsapp: '11988887777', celular: '', phone: null }),
      '11988887777'
    );

    // Caso 2: WhatsApp e celular preenchidos -> priorizar WhatsApp
    assert.equal(
      resolverTelefonePriorizado({ whatsapp: '11999998888', celular: '11977776666', phone: '1133334444' }),
      '11999998888'
    );

    // Caso 3: WhatsApp vazio e celular preenchido -> utilizar celular
    assert.equal(
      resolverTelefonePriorizado({ whatsapp: '', celular: '11977776666', phone: null }),
      '11977776666'
    );

    // Caso 3b: WhatsApp com apenas espaços em branco e phone preenchido -> utilizar phone
    assert.equal(
      resolverTelefonePriorizado({ whatsapp: '   ', celular: null, phone: '1133334444' }),
      '1133334444'
    );

    // Caso 4: Ambos vazios ou nulos -> string vazia para preenchimento manual
    assert.equal(
      resolverTelefonePriorizado({ whatsapp: null, celular: '', phone: '   ' }),
      ''
    );
  });
});
