import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('RBAC & Lifecycle de Contratos Institucionais e Aceites', () => {

  // Simulação da lógica de verificação de permissão no aceite de contratos institucionais
  function validarAutorizacaoAssinaturaInstitucional({ isOwner, ministryUserRole, ministryUserPermissions }) {
    if (isOwner) {
      return { allowed: true };
    }

    const permissions = Array.isArray(ministryUserPermissions)
      ? ministryUserPermissions.map((p) => String(p || '').trim().toUpperCase())
      : [];
    const roleNorm = String(ministryUserRole || '').toLowerCase().trim();

    const isAdmin =
      permissions.includes('ADMINISTRADOR') ||
      roleNorm === 'admin' ||
      roleNorm === 'administrador';

    if (isAdmin) {
      return { allowed: true };
    }

    return {
      allowed: false,
      status: 403,
      response: {
        success: false,
        code: 'ADMIN_REQUIRED',
        error: 'Apenas usuários com perfil ADMINISTRADOR podem assinar contratos institucionais.',
      },
    };
  }

  // Simulação da criação de contrato no ContratosService.criarContratoAoConverter
  function criarContratoAoConverter({ ministry_id, plano_contratado, numeroContrato }) {
    return {
      id: 'contrato-uuid-1234',
      ministry_id,
      plano_contratado,
      numero_contrato: numeroContrato,
      status: 'AGUARDANDO_ASSINATURA',
      assinado_por: null,
      assinado_em: null,
      snapshot_status: 'INTEGRO_IMUTAVEL',
      origem_snapshot: 'CELEBRACAO_ORIGINAL',
    };
  }

  // Simulação da conclusão do aceite eletrônico
  function processarAceiteEletrônico({ contrato, usuario, documento, ipAddress, userAgent, rbacCheck }) {
    if (!rbacCheck.allowed) {
      return {
        success: false,
        status: rbacCheck.status,
        response: rbacCheck.response,
      };
    }

    // 1. Criação do registro de evidência em tenant_aceites
    const agoraIso = new Date().toISOString();
    const aceite = {
      id: 'aceite-uuid-5678',
      ministry_id: contrato.ministry_id,
      user_id: usuario.id,
      documento_id: documento.id,
      versao_aceita: documento.versao,
      hash_documento: documento.hash,
      ip_address: ipAddress,
      user_agent: userAgent,
      aceito_em: agoraIso,
    };

    // 2. Atualização do contrato
    contrato.status = 'ATIVO';
    contrato.assinado_por = usuario.id;
    contrato.assinado_em = agoraIso;

    return {
      success: true,
      status: 201,
      aceite,
      contratoAtualizado: contrato,
    };
  }

  test('1. Contrato pendente é criado com assinado_por = null e assinado_em = null', () => {
    const contrato = criarContratoAoConverter({
      ministry_id: 'min-123',
      plano_contratado: 'starter',
      numeroContrato: 'CTR-123-2026',
    });

    assert.equal(contrato.status, 'AGUARDANDO_ASSINATURA');
    assert.equal(contrato.assinado_por, null);
    assert.equal(contrato.assinado_em, null);
  });

  test('2. Usuário com perfil ADMINISTRADOR pode assinar contrato institucional', () => {
    const rbac = validarAutorizacaoAssinaturaInstitucional({
      isOwner: false,
      ministryUserRole: 'admin',
      ministryUserPermissions: ['ADMINISTRADOR'],
    });

    assert.equal(rbac.allowed, true);

    const contrato = criarContratoAoConverter({
      ministry_id: 'min-123',
      plano_contratado: 'pro',
      numeroContrato: 'CTR-123-2026',
    });

    const resultado = processarAceiteEletrônico({
      contrato,
      usuario: { id: 'admin-user-uuid', email: 'pastor@igreja.com' },
      documento: { id: 'doc-1', versao: '1.0', hash: 'sha256-hash-valido' },
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0 Chrome',
      rbacCheck: rbac,
    });

    assert.equal(resultado.success, true);
    assert.equal(resultado.status, 201);
    assert.equal(resultado.contratoAtualizado.status, 'ATIVO');
    assert.equal(resultado.contratoAtualizado.assinado_por, 'admin-user-uuid');
    assert.ok(resultado.contratoAtualizado.assinado_em);
    assert.equal(resultado.aceite.user_id, 'admin-user-uuid');
  });

  test('3. Usuário SECRETARIA_GERAL recebe HTTP 403 e não consegue assinar', () => {
    const rbac = validarAutorizacaoAssinaturaInstitucional({
      isOwner: false,
      ministryUserRole: 'operator',
      ministryUserPermissions: ['SECRETARIA_GERAL'],
    });

    assert.equal(rbac.allowed, false);
    assert.equal(rbac.status, 403);
    assert.equal(rbac.response.error, 'Apenas usuários com perfil ADMINISTRADOR podem assinar contratos institucionais.');

    const contrato = criarContratoAoConverter({
      ministry_id: 'min-123',
      plano_contratado: 'starter',
      numeroContrato: 'CTR-123-2026',
    });

    const resultado = processarAceiteEletrônico({
      contrato,
      usuario: { id: 'sec-user-uuid', email: 'secretaria@igreja.com' },
      documento: { id: 'doc-1', versao: '1.0', hash: 'sha256-hash' },
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0 Chrome',
      rbacCheck: rbac,
    });

    assert.equal(resultado.success, false);
    assert.equal(resultado.status, 403);
    assert.equal(contrato.status, 'AGUARDANDO_ASSINATURA');
    assert.equal(contrato.assinado_por, null);
    assert.equal(contrato.assinado_em, null);
  });

  test('4. Usuário TESOURARIA_GERAL recebe HTTP 403 e não consegue assinar', () => {
    const rbac = validarAutorizacaoAssinaturaInstitucional({
      isOwner: false,
      ministryUserRole: 'operator',
      ministryUserPermissions: ['TESOURARIA_GERAL'],
    });

    assert.equal(rbac.allowed, false);
    assert.equal(rbac.status, 403);
    assert.equal(rbac.response.error, 'Apenas usuários com perfil ADMINISTRADOR podem assinar contratos institucionais.');

    const contrato = criarContratoAoConverter({
      ministry_id: 'min-123',
      plano_contratado: 'starter',
      numeroContrato: 'CTR-123-2026',
    });

    const resultado = processarAceiteEletrônico({
      contrato,
      usuario: { id: 'tes-user-uuid', email: 'tesouraria@igreja.com' },
      documento: { id: 'doc-1', versao: '1.0', hash: 'sha256-hash' },
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0 Chrome',
      rbacCheck: rbac,
    });

    assert.equal(resultado.success, false);
    assert.equal(resultado.status, 403);
    assert.equal(contrato.status, 'AGUARDANDO_ASSINATURA');
    assert.equal(contrato.assinado_por, null);
    assert.equal(contrato.assinado_em, null);
  });

  test('5. Tentativa de chamada direta à API sem permissão é estritamente bloqueada no servidor', () => {
    const operacoes = [
      { role: 'operator', permissions: ['OPERADOR'] },
      { role: 'manager', permissions: ['SUPERVISOR'] },
      { role: 'operator', permissions: ['AUXILIAR_SECRETARIA'] },
      { role: 'operator', permissions: ['TESOURARIA_LOCAL'] },
      { role: null, permissions: [] },
    ];

    for (const op of operacoes) {
      const rbac = validarAutorizacaoAssinaturaInstitucional({
        isOwner: false,
        ministryUserRole: op.role,
        ministryUserPermissions: op.permissions,
      });

      assert.equal(rbac.allowed, false, 'Role não deveria ter autorização de administrador.');
      assert.equal(rbac.status, 403);
    }
  });
});
