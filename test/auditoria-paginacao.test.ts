import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularIntervaloPaginacao,
  sanitizarDadosSensiveis,
  getAcaoBadge,
  getStatusBadge,
} from '../src/lib/auditoria-utils';

test('1. Paginação no banco: cálculo de índices from/to para range do Supabase', () => {
  // Página 1 (itens 0 a 19)
  const p1 = calcularIntervaloPaginacao(1, 20);
  assert.equal(p1.from, 0);
  assert.equal(p1.to, 19);

  // Página 2 (itens 20 a 39)
  const p2 = calcularIntervaloPaginacao(2, 20);
  assert.equal(p2.from, 20);
  assert.equal(p2.to, 39);

  // Página 5 (itens 80 a 99)
  const p5 = calcularIntervaloPaginacao(5, 20);
  assert.equal(p5.from, 80);
  assert.equal(p5.to, 99);

  // Tratamento de página inválida / menor que 1
  const pZero = calcularIntervaloPaginacao(0, 20);
  assert.equal(pZero.from, 0);
  assert.equal(pZero.to, 19);

  const pNegativa = calcularIntervaloPaginacao(-3, 20);
  assert.equal(pNegativa.from, 0);
  assert.equal(pNegativa.to, 19);
});

test('2. Segurança e Sanitização: dados sensíveis mascarados recursivamente', () => {
  const payloadSujo = {
    usuario: 'admin@eklesia.com',
    senha: 'SuperSecretPassword123!',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMC6Y5bP3Fs8HRBm-PtFFmqqAye8',
    meta: {
      api_key: 'ek_live_998877665544332211',
      access_token: 'acctok_12345',
      nome_membro: 'Irmão João',
      cartao: '4111111111111111',
      cvv: '123',
    },
    headers: {
      authorization: 'Bearer secret_token_xyz_123',
    },
    itens: [
      { id: '1', hash: 'hash_secreto_abc' },
      { id: '2', descricao: 'Operação padrão de secretaria' },
    ],
  };

  const limpo = sanitizarDadosSensiveis(payloadSujo) as any;

  // Campos sensíveis devem estar mascarados
  assert.equal(limpo.usuario, 'admin@eklesia.com');
  assert.equal(limpo.senha, '•••••••• (ocultado por segurança)');
  assert.equal(limpo.token, '•••••••• (ocultado por segurança)');
  assert.equal(limpo.meta.api_key, '•••••••• (ocultado por segurança)');
  assert.equal(limpo.meta.access_token, '•••••••• (ocultado por segurança)');
  assert.equal(limpo.meta.cartao, '•••••••• (ocultado por segurança)');
  assert.equal(limpo.meta.cvv, '•••••••• (ocultado por segurança)');
  assert.equal(limpo.headers.authorization, '•••••••• (ocultado por segurança)');
  assert.equal(limpo.itens[0].hash, '•••••••• (ocultado por segurança)');

  // Campos seguros preservados
  assert.equal(limpo.meta.nome_membro, 'Irmão João');
  assert.equal(limpo.itens[0].id, '1');
  assert.equal(limpo.itens[1].descricao, 'Operação padrão de secretaria');
});

test('3. Sanitização de tokens isolados em strings (Bearer / JWT)', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature';
  assert.equal(sanitizarDadosSensiveis(jwt), '•••••••• (token ocultado por segurança)');

  const bearer = 'Bearer secret-session-key-998877';
  assert.equal(sanitizarDadosSensiveis(bearer), '•••••••• (token ocultado por segurança)');

  const textoComum = 'Atualização cadastral do membro';
  assert.equal(sanitizarDadosSensiveis(textoComum), textoComum);
});

test('4. Metadados visuais de Ação: getAcaoBadge', () => {
  const badgeCriar = getAcaoBadge('criar');
  assert.equal(badgeCriar.label, 'Criar');
  assert.ok(badgeCriar.badgeClass.includes('emerald'));
  assert.ok(badgeCriar.icon);

  const badgeEditar = getAcaoBadge('EDITAR ');
  assert.equal(badgeEditar.label, 'Editar');
  assert.ok(badgeEditar.badgeClass.includes('blue'));

  const badgeDeletar = getAcaoBadge('excluir');
  assert.equal(badgeDeletar.label, 'Deletar');
  assert.ok(badgeDeletar.badgeClass.includes('rose'));

  const badgeInativar = getAcaoBadge('inativar');
  assert.equal(badgeInativar.label, 'Inativar');
  assert.ok(badgeInativar.badgeClass.includes('amber'));

  const badgeLogin = getAcaoBadge('login');
  assert.equal(badgeLogin.label, 'Login');

  const badgeCustom = getAcaoBadge('promocao_cargo');
  assert.equal(badgeCustom.label, 'Promocao_cargo');
});

test('5. Metadados visuais de Status: getStatusBadge', () => {
  const statusSucesso = getStatusBadge('sucesso');
  assert.equal(statusSucesso.label, 'Sucesso');
  assert.ok(statusSucesso.badgeClass.includes('emerald'));
  assert.equal(statusSucesso.dotClass, 'bg-emerald-500');

  const statusErro = getStatusBadge('ERRO');
  assert.equal(statusErro.label, 'Erro');
  assert.ok(statusErro.badgeClass.includes('rose'));
  assert.equal(statusErro.dotClass, 'bg-rose-500');

  const statusAviso = getStatusBadge('aviso');
  assert.equal(statusAviso.label, 'Aviso');
  assert.ok(statusAviso.badgeClass.includes('amber'));
  assert.equal(statusAviso.dotClass, 'bg-amber-500');

  const statusOutro = getStatusBadge('pendente');
  assert.equal(statusOutro.label, 'pendente');
  assert.ok(statusOutro.badgeClass.includes('slate'));
});
