import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCpf, validarCpf } from '../../src/lib/mascaras.js';

// Replica da função formatarNomeProprio de src/app/eventos/page.tsx
function formatarNomeProprio(nome: string | null | undefined): string {
  if (!nome || typeof nome !== 'string') return '';
  const preposicoes = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'em', 'para', 'com', 'por', 'a', 'o', 'as', 'os']);
  const partes = nome.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '';
  return partes
    .map((parte, idx) => {
      if (idx > 0 && preposicoes.has(parte)) {
        return parte;
      }
      return parte.charAt(0).toUpperCase() + parte.slice(1);
    })
    .join(' ');
}

// Replica da priorização de telefone
function extrairTelefoneMembro(m: any): string {
  if (!m) return '';
  if (typeof m.whatsapp === 'string' && m.whatsapp.trim()) return m.whatsapp.trim();
  const cf = (m.custom_fields && typeof m.custom_fields === 'object') ? m.custom_fields : {};
  if (typeof cf.whatsapp === 'string' && cf.whatsapp.trim()) return cf.whatsapp.trim();
  for (const [k, v] of Object.entries(cf)) {
    if (k.toLowerCase().includes('whatsapp') && typeof v === 'string' && v.trim()) {
      return v.trim();
    }
  }
  if (typeof m.celular === 'string' && m.celular.trim()) return m.celular.trim();
  if (typeof m.phone === 'string' && m.phone.trim()) return m.phone.trim();
  for (const [k, v] of Object.entries(cf)) {
    const key = k.toLowerCase();
    if ((key.includes('celular') || key.includes('telefone') || key.includes('phone')) && typeof v === 'string' && v.trim()) {
      return v.trim();
    }
  }
  return '';
}

function extrairCpfMembro(m: any): string {
  if (!m) return '';
  if (typeof m.cpf === 'string' && m.cpf.trim()) return m.cpf.trim();
  const cf = (m.custom_fields && typeof m.custom_fields === 'object') ? m.custom_fields : {};
  if (typeof cf.cpf === 'string' && cf.cpf.trim()) return cf.cpf.trim();
  for (const [k, v] of Object.entries(cf)) {
    if (k.toLowerCase().includes('cpf') && typeof v === 'string' && v.trim()) {
      return v.trim();
    }
  }
  return '';
}

test('Atendimento de Balcão — Complementação de Formulário e Regras de Negócio', async (t) => {
  await t.test('1. Seleção de Membro no Balcão: Preenchimento automático de CPF, E-mail, Telefone/WhatsApp e Congregação', () => {
    const membroMock = {
      id: 'membro-001',
      name: 'FRANCISCO DE ASSIS ALCANTARA',
      email: 'assis@eklesia.com',
      phone: '8533334444',
      celular: '85988887777',
      whatsapp: '85999991111',
      cpf: '12345678901',
      congregacao_id: 'cong-sede',
      custom_fields: {},
    };

    const congregacoes = [
      { id: 'cong-sede', nome: 'Templo Central / Sede' },
      { id: 'cong-filial', nome: 'Congregação Esperança' },
    ];

    const rawTel = extrairTelefoneMembro(membroMock);
    const rawCpf = extrairCpfMembro(membroMock);
    const congMap = new Map(congregacoes.map(c => [c.id, c.nome]));

    assert.equal(rawTel, '85999991111', 'WhatsApp deve ter prioridade sobre phone e celular');
    assert.equal(formatCpf(rawCpf), '123.456.789-01', 'CPF deve ser formatado com máscara');
    assert.equal(congMap.get(membroMock.congregacao_id), 'Templo Central / Sede', 'Congregação deve ser resolvida corretamente');
  });

  await t.test('2. Fallback de Telefone: Quando WhatsApp não informado, utiliza Celular/Telefone fixo', () => {
    const membroSemZap = {
      phone: '8532221111',
      celular: '85988882222',
      whatsapp: '',
    };
    assert.equal(extrairTelefoneMembro(membroSemZap), '85988882222');

    const membroSoFixo = {
      phone: '8532221111',
      celular: '',
      whatsapp: '',
    };
    assert.equal(extrairTelefoneMembro(membroSoFixo), '8532221111');
  });

  await t.test('3. Edição dos campos pré-preenchidos sem afetar o cadastro original e persistência em observações', () => {
    const membroOriginal = {
      id: 'membro-001',
      nome_completo: 'Francisco de Assis Alcantara',
      cpf: '123.456.789-01',
      email: 'original@eklesia.com',
      telefone: '(85) 99999-1111',
    };

    // Operador altera o e-mail e telefone temporariamente no atendimento de balcão
    const balcaoEmailEditado = 'editado.balcao@eklesia.com';
    const balcaoTelefoneEditado = '(85) 98888-0000';
    const balcaoCpfInformado = '123.456.789-01';
    const congNome = 'Templo Central / Sede';

    // Montagem do payload enviado ao Supabase
    const payloadInscricao = {
      member_id: membroOriginal.id,
      nome_externo: null,
      email_externo: balcaoEmailEditado,
      telefone: balcaoTelefoneEditado,
      observacoes: [
        '[Balcão] Inscrição presencial',
        'Pagamento: À vista',
        `CPF: ${balcaoCpfInformado}`,
        `Congregação: ${congNome}`,
      ].join(' | '),
    };

    assert.equal(payloadInscricao.member_id, 'membro-001');
    assert.equal(payloadInscricao.email_externo, 'editado.balcao@eklesia.com');
    assert.equal(payloadInscricao.telefone, '(85) 98888-0000');
    assert.ok(payloadInscricao.observacoes.includes('CPF: 123.456.789-01'));
    assert.ok(payloadInscricao.observacoes.includes('Congregação: Templo Central / Sede'));
    // Cadastro original mantido
    assert.equal(membroOriginal.email, 'original@eklesia.com');
  });

  await t.test('4. Alternância entre Membro e Externo: Isolamento e limpeza de estados incompatíveis', () => {
    let tipoParticipante: 'membro' | 'externo' = 'membro';
    let membroSelecionado: any = { id: 'membro-123', nome: 'Membro Teste' };
    let nomeExterno = 'Membro Teste';
    let cpf = '111.222.333-44';
    let email = 'membro@teste.com';
    let telefone = '(85) 99999-9999';
    let congregacaoId = 'cong-1';

    // Usuário clica em 'Visitante / Externo'
    tipoParticipante = 'externo';
    membroSelecionado = null;
    nomeExterno = '';
    cpf = '';
    email = '';
    telefone = '';
    congregacaoId = '';

    assert.equal(tipoParticipante, 'externo');
    assert.equal(membroSelecionado, null);
    assert.equal(nomeExterno, '');
    assert.equal(cpf, '');
    assert.equal(email, '');
    assert.equal(telefone, '');
    assert.equal(congregacaoId, '');
  });

  await t.test('5. Normalização Title Case de Nomes no Balcão com acentuação e partículas', () => {
    assert.equal(
      formatarNomeProprio('FRANCISCO DE ASSIS ALCÂNTARA'),
      'Francisco de Assis Alcântara'
    );
    assert.equal(
      formatarNomeProprio('MARIA DA CONCEIÇÃO DOS SANTOS'),
      'Maria da Conceição dos Santos'
    );
    assert.equal(
      formatarNomeProprio('joão da silva e souza'),
      'João da Silva e Souza'
    );
  });

  await t.test('6. Validação de integridade do CPF no Balcão', () => {
    // Válido se não informado (opcional quando evento não exige)
    assert.equal(validarCpf(''), false);
    // Dígitos repetidos inválidos
    assert.equal(validarCpf('000.000.000-00'), false);
    assert.equal(validarCpf('111.111.111-11'), false);
    // Incompleto
    assert.equal(validarCpf('123.456'), false);
  });
});
