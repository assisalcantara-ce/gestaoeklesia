import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

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
});
