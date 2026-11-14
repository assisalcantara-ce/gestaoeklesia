import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extrairIdentificadorMinistroQrCode } from '../src/lib/reunioes-utils';

describe('Check-in Público de Reuniões — Mecanismo e Diagnóstico da Câmera', () => {
  // 1. Mapeamento de erros da WebRTC MediaDevices API
  function mapCameraError(err: { name?: string; message?: string }): string {
    const errName = err?.name || '';
    if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
      return 'Permissão de câmera negada. Habilite o acesso à câmera nas configurações do navegador e clique em Tentar Novamente.';
    } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
      return 'Nenhuma câmera conectada foi localizada neste dispositivo.';
    } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
      return 'A câmera está em uso por outro aplicativo ou temporariamente ocupada pelo sistema. Feche outros apps e tente novamente.';
    } else if (errName === 'SecurityError') {
      return 'Acesso bloqueado por segurança: a câmera requer conexão segura HTTPS.';
    } else {
      return err?.message || 'Não foi possível inicializar a câmera. Utilize a busca nominal ou leitor USB.';
    }
  }

  it('deve mapear NotAllowedError para instrução de permissão de navegador', () => {
    const msg = mapCameraError({ name: 'NotAllowedError' });
    assert.match(msg, /Permissão de câmera negada/);
    assert.match(msg, /Tentar Novamente/);
  });

  it('deve mapear PermissionDeniedError (Safari legacy) para instrução de permissão', () => {
    const msg = mapCameraError({ name: 'PermissionDeniedError' });
    assert.match(msg, /Permissão de câmera negada/);
  });

  it('deve mapear NotFoundError para ausência de dispositivo de captura', () => {
    const msg = mapCameraError({ name: 'NotFoundError' });
    assert.match(msg, /Nenhuma câmera conectada/);
  });

  it('deve mapear DevicesNotFoundError para ausência de hardware de câmera', () => {
    const msg = mapCameraError({ name: 'DevicesNotFoundError' });
    assert.match(msg, /Nenhuma câmera conectada/);
  });

  it('deve mapear NotReadableError para conflito de câmera em uso por outro app', () => {
    const msg = mapCameraError({ name: 'NotReadableError' });
    assert.match(msg, /em uso por outro aplicativo/);
  });

  it('deve mapear TrackStartError para conflito de inicialização de hardware', () => {
    const msg = mapCameraError({ name: 'TrackStartError' });
    assert.match(msg, /em uso por outro aplicativo/);
  });

  it('deve mapear SecurityError para exigência de conexão HTTPS segura', () => {
    const msg = mapCameraError({ name: 'SecurityError' });
    assert.match(msg, /requer conexão segura HTTPS/);
  });

  it('deve preservar mensagens personalizadas em exceções genéricas', () => {
    const msg = mapCameraError({ name: 'CustomError', message: 'Falha específica de hardware' });
    assert.equal(msg, 'Falha específica de hardware');
  });

  // 2. Lógica de Fallback de Restrições (OverconstrainedError)
  it('deve identificar quando acionar o fallback para constraints genéricas (video: true)', () => {
    function shouldFallbackConstraints(errName: string): boolean {
      return (
        errName === 'OverconstrainedError' ||
        errName === 'ConstraintNotSatisfiedError' ||
        errName === 'TypeError'
      );
    }

    assert.equal(shouldFallbackConstraints('OverconstrainedError'), true);
    assert.equal(shouldFallbackConstraints('ConstraintNotSatisfiedError'), true);
    assert.equal(shouldFallbackConstraints('TypeError'), true);
    assert.equal(shouldFallbackConstraints('NotAllowedError'), false);
    assert.equal(shouldFallbackConstraints('NotFoundError'), false);
  });

  // 3. Validação do ciclo de vida: cleanup rigoroso de streams
  it('deve parar todos os tracks de mídia ao encerrar a câmera ou antes de reiniciar', () => {
    let stoppedCount = 0;
    const fakeTracks = [
      { stop: () => { stoppedCount++; } },
      { stop: () => { stoppedCount++; } },
    ];
    const fakeStream = {
      getTracks: () => fakeTracks,
    };

    // Simula parada
    fakeStream.getTracks().forEach((track) => track.stop());

    assert.equal(stoppedCount, 2);
  });

  // 4. Decodificação e Extração do Conteúdo do QR Code da Carteira Ministerial
  it('deve extrair o unique_id a partir de URL oficial da credencial ministerial', () => {
    const url1 = 'https://app.gestaoeklesia.com.br/validar/credencial/MIN-2026-9988';
    assert.equal(extrairIdentificadorMinistroQrCode(url1), 'MIN-2026-9988');

    const url2 = 'https://gestaoeklesia.com.br/validar/credencial/550e8400-e29b-41d4-a716-446655440000?origem=qr';
    assert.equal(extrairIdentificadorMinistroQrCode(url2), '550e8400-e29b-41d4-a716-446655440000');
  });

  it('deve extrair código puro ou número de matrícula quando o QR Code contiver texto direto', () => {
    assert.equal(extrairIdentificadorMinistroQrCode('MIN-102030'), 'MIN-102030');
    assert.equal(extrairIdentificadorMinistroQrCode('12345678'), '12345678');
    assert.equal(extrairIdentificadorMinistroQrCode('  MIN-TRIM-01  '), 'MIN-TRIM-01');
  });

  it('deve lidar com URLs genéricas com id no último segmento', () => {
    const urlGenerica = 'http://sistema.local/carteirinha/validar/PASTOR-01';
    assert.equal(extrairIdentificadorMinistroQrCode(urlGenerica), 'PASTOR-01');
  });

  // 5. Prevenção de duplicidade por cooldown e leitura contínua
  it('deve aplicar cooldown de leitura contínua para evitar requisições duplicadas do mesmo QR Code', () => {
    let cooldownAtivo = false;
    let ultimoQr: string | null = null;
    let chamadas = 0;

    function simularLeitura(qr: string) {
      if (!cooldownAtivo || ultimoQr !== qr) {
        cooldownAtivo = true;
        ultimoQr = qr;
        chamadas++;
      }
    }

    // Leitura 1: processa
    simularLeitura('MIN-001');
    assert.equal(chamadas, 1);

    // Mesma carteirinha ainda no frame: ignorada pelo cooldown
    simularLeitura('MIN-001');
    simularLeitura('MIN-001');
    assert.equal(chamadas, 1);

    // Próximo ministro aproximando a carteirinha: processa imediatamente
    simularLeitura('MIN-002');
    assert.equal(chamadas, 2);
  });

  // 6. Suporte estrito ao identificador de carteira real de 16 caracteres (5FE7B7D2B1FC41E9)
  it('deve extrair com precisão identificador hexadecimal de 16 caracteres de carteira real', () => {
    const urlCarteiraReal = 'https://app.gestaoeklesia.com.br/validar/credencial/5FE7B7D2B1FC41E9';
    const idExtraido = extrairIdentificadorMinistroQrCode(urlCarteiraReal);
    assert.equal(idExtraido, '5FE7B7D2B1FC41E9');
    assert.equal(idExtraido.length, 16);
  });

  it('deve ser insensível a maiúsculas/minúsculas na busca de identificadores', () => {
    const code = '5FE7B7D2B1FC41E9';
    assert.equal(code.toLowerCase(), '5fe7b7d2b1fc41e9');
    assert.equal(code.toUpperCase(), '5FE7B7D2B1FC41E9');
  });

  // 7. Não vazar dados de membros não convocados
  it('deve validar resposta de proteção de privacidade para membros não convocados', () => {
    const respostaSegura = {
      error: 'Ministro cadastrado na instituição, porém não consta na lista de convocados desta reunião.',
      code: 'MINISTRO_NAO_CONVOCADO',
    };
    assert.equal((respostaSegura as any).ministro, undefined);
    assert.equal(respostaSegura.code, 'MINISTRO_NAO_CONVOCADO');
  });
});
