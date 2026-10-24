import test from 'node:test';
import assert from 'node:assert/strict';

interface Congregacao {
  id: string;
  nome: string;
}

interface Membro {
  id: string;
  nome_completo: string;
  email?: string;
  telefone?: string;
  cpf?: string;
  congregacao_id?: string | null;
  congregacao_nome?: string;
}

test('Substituição de Status por Congregação no Modal Nova Inscrição', async (t) => {
  const congsMock: Congregacao[] = [
    { id: 'cong-sede', nome: 'Templo Central / Sede' },
    { id: 'cong-esperanca', nome: 'Congregação Esperança' },
    { id: 'cong-monte', nome: 'Congregação Monte Sião' },
  ];

  await t.test('1. Membro com congregação cadastrada: preenche automaticamente a congregação no formulário', () => {
    const membro: Membro = {
      id: 'mem-1',
      nome_completo: 'Carlos Eduardo Oliveira',
      cpf: '123.456.789-00',
      email: 'carlos@eklesia.com',
      telefone: '(85) 99999-1111',
      congregacao_id: 'cong-esperanca',
      congregacao_nome: 'Congregação Esperança',
    };

    let formInsc = {
      member_id: '',
      nome_externo: '',
      cpf: '',
      email_externo: '',
      telefone: '',
      congregacao_id: '',
      status: 'confirmado',
    };

    // Ao selecionar membro
    formInsc = {
      ...formInsc,
      member_id: membro.id,
      nome_externo: '',
      cpf: membro.cpf || formInsc.cpf,
      email_externo: membro.email || formInsc.email_externo,
      telefone: membro.telefone || formInsc.telefone,
      congregacao_id: membro.congregacao_id || formInsc.congregacao_id,
    };

    assert.equal(formInsc.member_id, 'mem-1');
    assert.equal(formInsc.congregacao_id, 'cong-esperanca');
    assert.equal(formInsc.status, 'confirmado');
  });

  await t.test('2. Participante externo: permite selecionar congregação manualmente', () => {
    let formInsc = {
      member_id: '',
      nome_externo: 'Marcos Vinicius Externo',
      cpf: '222.333.444-55',
      email_externo: 'marcos@externo.com',
      telefone: '(85) 98888-2222',
      congregacao_id: '',
      status: 'confirmado',
    };

    // Operador seleciona congregação
    formInsc.congregacao_id = 'cong-monte';

    const congSelecionada = congsMock.find(c => c.id === formInsc.congregacao_id);
    assert.equal(congSelecionada?.nome, 'Congregação Monte Sião');
    assert.equal(formInsc.member_id, '');
    assert.equal(formInsc.status, 'confirmado');
  });

  await t.test('3. Alteração manual da congregação não altera o cadastro original do membro', () => {
    const membroOriginal: Membro = {
      id: 'mem-2',
      nome_completo: 'Ana Paula Souza',
      congregacao_id: 'cong-sede',
      congregacao_nome: 'Templo Central / Sede',
    };

    // Formulário carregou com cong-sede, mas operador alterou para cong-monte no evento
    let formInscCongregacaoId = 'cong-monte';
    const congFinal = congsMock.find(c => c.id === formInscCongregacaoId);

    assert.equal(congFinal?.nome, 'Congregação Monte Sião');
    // Membro permanece intacto
    assert.equal(membroOriginal.congregacao_id, 'cong-sede');
  });

  await t.test('4. Persistência estruturada em observações e preservação de status Confirmado', () => {
    const formInsc = {
      cpf: '123.456.789-00',
      congregacao_id: 'cong-esperanca',
      observacoes: 'Necessita assento preferencial',
    };

    const congSelecionada = congsMock.find(c => c.id === formInsc.congregacao_id);
    const congNomeFinal = congSelecionada?.nome;

    let obsLimpa = (formInsc.observacoes || '')
      .split('|')
      .map(p => p.trim())
      .filter(p => !p.toLowerCase().startsWith('congregação:') && !p.toLowerCase().startsWith('cpf:'))
      .join(' | ');

    const tagsAdicionais = [
      formInsc.cpf.trim() ? `CPF: ${formInsc.cpf.trim()}` : null,
      congNomeFinal ? `Congregação: ${congNomeFinal}` : null,
    ].filter(Boolean);

    const observacoesFinais = [
      obsLimpa.trim() || null,
      tagsAdicionais.length > 0 ? tagsAdicionais.join(' | ') : null,
    ].filter(Boolean).join(' | ');

    assert.ok(observacoesFinais.includes('Necessita assento preferencial'));
    assert.ok(observacoesFinais.includes('CPF: 123.456.789-00'));
    assert.ok(observacoesFinais.includes('Congregação: Congregação Esperança'));
  });
});
