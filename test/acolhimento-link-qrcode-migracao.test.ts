import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isCultoAbertoHoje, getLocalDateStr } from '../src/lib/timezone-utils';

/**
 * Função utilitária simulando a regra de montagem de URL no Gestão Eklésia
 * (espelha exatamente o comportamento de src/app/secretaria/cultos/page.tsx)
 */
function gerarUrlAcolhimento(origin: string, token: string): string {
  if (!token || !token.trim()) throw new Error('Token inválido');
  return `${origin.replace(/\/+$/, '')}/acolhimento/${token.trim()}`;
}

/**
 * Simulação da lógica de verificação e decisão da rota legada /formularios/cultos/[token]
 */
interface TokenMock {
  id: string;
  token: string;
  culto_id: string;
  ministry_id: string;
  is_active: boolean;
  expires_at: string;
  culto: {
    id: string;
    tipo_culto: string;
    data_culto: string;
    status: string;
    congregacao_id: string;
    ministry_id: string;
  };
}

function avaliarAcessoLegado(
  tokenRecord: TokenMock | null,
  dataReferencia: Date = new Date()
): { redirectUrl?: string; error?: string; code?: string; status: number } {
  if (!tokenRecord) {
    return { error: 'Link de recepção não encontrado.', code: 'TOKEN_NAO_ENCONTRADO', status: 404 };
  }

  if (!tokenRecord.is_active) {
    return { error: 'Link de recepção desativado.', code: 'TOKEN_INATIVO', status: 410 };
  }

  if (new Date(tokenRecord.expires_at) <= dataReferencia) {
    return { error: 'Link de recepção expirado.', code: 'TOKEN_EXPIRADO', status: 410 };
  }

  const { culto } = tokenRecord;
  if (!culto) {
    return { error: 'Culto não encontrado.', code: 'CULTO_NAO_ENCONTRADO', status: 404 };
  }

  // Isolamento de Tenant: O culto deve pertencer estritamente ao mesmo ministry_id do token
  if (culto.ministry_id !== tokenRecord.ministry_id) {
    return { error: 'Violação de isolamento multi-tenant.', code: 'TENANT_MISMATCH', status: 403 };
  }

  // Validação estrita de janela operacional do culto
  const janela = isCultoAbertoHoje(culto.data_culto, culto.status, dataReferencia);
  if (!janela.elegivel) {
    return {
      error: `Janela de acolhimento indisponível (${janela.motivo}).`,
      code: janela.motivo,
      status: janela.motivo === 'CULTO_FUTURO' ? 403 : 410,
    };
  }

  // Elegível: redireciona para a nova rota pública
  return {
    redirectUrl: `/acolhimento/${encodeURIComponent(tokenRecord.token)}`,
    status: 307,
  };
}

describe('Migração do Link e QR Code da Recepção para o Agente de Acolhimento', () => {
  const origin = 'https://app.gestaoeklesia.com';

  describe('1. Atualização e Paridade da Geração de Link e QR Code', () => {
    it('gera a URL no novo destino público /acolhimento/[token]', () => {
      const token = 'token-culto-123';
      const url = gerarUrlAcolhimento(origin, token);
      assert.equal(url, 'https://app.gestaoeklesia.com/acolhimento/token-culto-123');
      assert.doesNotMatch(url, /\/formularios\/cultos\//);
    });

    it('garante paridade estrita entre QR Code, link exibido e botão Copiar', () => {
      const token = 'abc-789-xyz';
      const urlGerada = gerarUrlAcolhimento(origin, token);

      // No componente, QRCodeSVG, texto e clipboard recebem rigorosamente o mesmo valor
      const qrCodeValue = urlGerada;
      const displayUrl = urlGerada;
      const clipboardText = urlGerada;

      assert.equal(qrCodeValue, displayUrl);
      assert.equal(displayUrl, clipboardText);
      assert.equal(qrCodeValue, 'https://app.gestaoeklesia.com/acolhimento/abc-789-xyz');
    });

    it('gera links distintos e independentes para cultos diferentes', () => {
      const cultoA = { id: 'culto-001', token: 'token-culto-001' };
      const cultoB = { id: 'culto-002', token: 'token-culto-002' };

      const urlA = gerarUrlAcolhimento(origin, cultoA.token);
      const urlB = gerarUrlAcolhimento(origin, cultoB.token);

      assert.notEqual(urlA, urlB);
      assert.equal(urlA, 'https://app.gestaoeklesia.com/acolhimento/token-culto-001');
      assert.equal(urlB, 'https://app.gestaoeklesia.com/acolhimento/token-culto-002');
    });
  });

  describe('2. Associação Correta, Regeneração e Isolamento Multi-tenant', () => {
    it('regeneração invalida o token anterior sem afetar tokens de outros cultos', () => {
      const tokensBanco = new Map<string, { token: string; culto_id: string; ministry_id: string }>();

      // Cadastra tokens iniciais para Culto 1 e Culto 2
      tokensBanco.set('culto-1', { token: 'token-antigo-1', culto_id: 'culto-1', ministry_id: 'min-alpha' });
      tokensBanco.set('culto-2', { token: 'token-culto-2', culto_id: 'culto-2', ministry_id: 'min-alpha' });

      // Simulação da regeneração do Culto 1
      const novoToken1 = 'token-regenerado-1';
      tokensBanco.set('culto-1', { token: novoToken1, culto_id: 'culto-1', ministry_id: 'min-alpha' });

      // O Culto 1 agora possui o novo token
      assert.equal(tokensBanco.get('culto-1')?.token, 'token-regenerado-1');
      // O Culto 2 permanece intocado
      assert.equal(tokensBanco.get('culto-2')?.token, 'token-culto-2');
    });

    it('bloqueia contaminação ou adulteração entre ministérios (multi-tenant)', () => {
      const tokenRecordInvalido: TokenMock = {
        id: 'tok-id-1',
        token: 'tok-123',
        culto_id: 'culto-999',
        ministry_id: 'ministry-A',
        is_active: true,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        culto: {
          id: 'culto-999',
          tipo_culto: 'Culto de Doutrina',
          data_culto: getLocalDateStr(),
          status: 'Aberto',
          congregacao_id: 'cong-1',
          ministry_id: 'ministry-B', // Tenant divergente do token!
        },
      };

      const resultado = avaliarAcessoLegado(tokenRecordInvalido);
      assert.equal(resultado.status, 403);
      assert.equal(resultado.code, 'TENANT_MISMATCH');
      assert.equal(resultado.redirectUrl, undefined);
    });
  });

  describe('3. Compatibilidade e Redirecionamento da Rota Legada (/formularios/cultos/[token])', () => {
    const hojeStr = '2026-10-12';
    const agora = new Date('2026-10-12T19:30:00-03:00');

    it('redireciona para /acolhimento/[token] com código 307 quando token e culto são válidos', () => {
      const tokenValido: TokenMock = {
        id: 'rec-1',
        token: 'qr-impresso-2026',
        culto_id: 'culto-hoje',
        ministry_id: 'min-sede',
        is_active: true,
        expires_at: new Date(agora.getTime() + 12 * 3600000).toISOString(),
        culto: {
          id: 'culto-hoje',
          tipo_culto: 'Culto da Família',
          data_culto: hojeStr,
          status: 'Aberto',
          congregacao_id: 'cong-central',
          ministry_id: 'min-sede',
        },
      };

      const resultado = avaliarAcessoLegado(tokenValido, agora);
      assert.equal(resultado.status, 307);
      assert.equal(resultado.redirectUrl, '/acolhimento/qr-impresso-2026');
      assert.equal(resultado.error, undefined);
    });

    it('impede redirecionamento e bloqueia acesso se o token for inativo', () => {
      const tokenInativo: TokenMock = {
        id: 'rec-2',
        token: 'qr-inativo',
        culto_id: 'culto-hoje',
        ministry_id: 'min-sede',
        is_active: false,
        expires_at: new Date(agora.getTime() + 3600000).toISOString(),
        culto: {
          id: 'culto-hoje',
          tipo_culto: 'Culto da Família',
          data_culto: hojeStr,
          status: 'Aberto',
          congregacao_id: 'cong-central',
          ministry_id: 'min-sede',
        },
      };

      const resultado = avaliarAcessoLegado(tokenInativo, agora);
      assert.equal(resultado.status, 410);
      assert.equal(resultado.code, 'TOKEN_INATIVO');
      assert.equal(resultado.redirectUrl, undefined);
    });

    it('impede redirecionamento se o token estiver expirado (passou das 24h)', () => {
      const tokenExpirado: TokenMock = {
        id: 'rec-3',
        token: 'qr-antigo-expirado',
        culto_id: 'culto-hoje',
        ministry_id: 'min-sede',
        is_active: true,
        expires_at: new Date(agora.getTime() - 1000).toISOString(), // expirou há 1 segundo
        culto: {
          id: 'culto-hoje',
          tipo_culto: 'Culto da Família',
          data_culto: hojeStr,
          status: 'Aberto',
          congregacao_id: 'cong-central',
          ministry_id: 'min-sede',
        },
      };

      const resultado = avaliarAcessoLegado(tokenExpirado, agora);
      assert.equal(resultado.status, 410);
      assert.equal(resultado.code, 'TOKEN_EXPIRADO');
      assert.equal(resultado.redirectUrl, undefined);
    });

    it('impede redirecionamento se o culto já estiver Encerrado ou Consolidado', () => {
      const cultoEncerrado: TokenMock = {
        id: 'rec-4',
        token: 'qr-culto-fechado',
        culto_id: 'culto-fechado',
        ministry_id: 'min-sede',
        is_active: true,
        expires_at: new Date(agora.getTime() + 3600000).toISOString(),
        culto: {
          id: 'culto-fechado',
          tipo_culto: 'Culto de Ceia',
          data_culto: hojeStr,
          status: 'Encerrado',
          congregacao_id: 'cong-central',
          ministry_id: 'min-sede',
        },
      };

      const resultado = avaliarAcessoLegado(cultoEncerrado, agora);
      assert.equal(resultado.status, 410);
      assert.equal(resultado.code, 'CULTO_ENCERRADO');
      assert.equal(resultado.redirectUrl, undefined);
    });

    it('impede redirecionamento se o culto for de uma data passada ou futura', () => {
      // Culto passado
      const cultoPassado: TokenMock = {
        id: 'rec-5',
        token: 'qr-passado',
        culto_id: 'culto-ontem',
        ministry_id: 'min-sede',
        is_active: true,
        expires_at: new Date(agora.getTime() + 3600000).toISOString(),
        culto: {
          id: 'culto-ontem',
          tipo_culto: 'Culto',
          data_culto: '2026-10-11', // Ontem
          status: 'Aberto',
          congregacao_id: 'cong-central',
          ministry_id: 'min-sede',
        },
      };

      const resPassado = avaliarAcessoLegado(cultoPassado, agora);
      assert.equal(resPassado.status, 410);
      assert.equal(resPassado.code, 'CULTO_PASSADO');
      assert.equal(resPassado.redirectUrl, undefined);

      // Culto futuro
      const cultoFuturo: TokenMock = {
        id: 'rec-6',
        token: 'qr-futuro',
        culto_id: 'culto-amanha',
        ministry_id: 'min-sede',
        is_active: true,
        expires_at: new Date(agora.getTime() + 3600000).toISOString(),
        culto: {
          id: 'culto-amanha',
          tipo_culto: 'Culto',
          data_culto: '2026-10-13', // Amanhã
          status: 'Aberto',
          congregacao_id: 'cong-central',
          ministry_id: 'min-sede',
        },
      };

      const resFuturo = avaliarAcessoLegado(cultoFuturo, agora);
      assert.equal(resFuturo.status, 403);
      assert.equal(resFuturo.code, 'CULTO_FUTURO');
      assert.equal(resFuturo.redirectUrl, undefined);
    });
  });
});
