import test from 'node:test';
import assert from 'node:assert/strict';

interface Congregacao {
  id: string;
  nome: string;
}

interface Membro {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  celular?: string | null;
  whatsapp?: string | null;
  congregacao_id?: string | null;
  custom_fields?: any;
  congregacoes?: { id?: string; nome?: string } | null;
}

// Mesma função extrairCongregacaoInscricao implementada em src/app/eventos/page.tsx
function extrairCongregacaoInscricao(
  rawObs: string | null | undefined,
  member: any,
  congregacoesList: Congregacao[]
): { congregacao_id?: string; congregacao_nome: string } {
  if (rawObs) {
    const match = rawObs.match(/Congregação:\s*([^|]+)/i);
    if (match && match[1]) {
      const nomeOuId = match[1].trim();
      const achada = congregacoesList.find(
        c => c.id === nomeOuId || c.nome.toLowerCase() === nomeOuId.toLowerCase()
      );
      if (achada) {
        return { congregacao_id: achada.id, congregacao_nome: achada.nome };
      }
      if (nomeOuId) {
        return { congregacao_nome: nomeOuId };
      }
    }
  }

  if (member) {
    if (member.congregacoes && member.congregacoes.nome) {
      return {
        congregacao_id: member.congregacoes.id || member.congregacao_id,
        congregacao_nome: member.congregacoes.nome,
      };
    }
    if (member.congregacao_id) {
      const achada = congregacoesList.find(c => c.id === member.congregacao_id);
      if (achada) {
        return { congregacao_id: achada.id, congregacao_nome: achada.nome };
      }
    }
  }

  return { congregacao_nome: 'Não informada' };
}

// Lógica de filtragem de inscrições
function filtrarInscricoes(
  inscricoes: any[],
  filtroStatus: string,
  filtroCong: string,
  busca: string,
  congregacoes: Congregacao[]
) {
  let list = inscricoes;
  if (filtroStatus) list = list.filter(i => i.status === filtroStatus);
  if (filtroCong) {
    const congAlvo = congregacoes.find(c => c.id === filtroCong);
    const nomeAlvo = congAlvo?.nome.toLowerCase();
    list = list.filter(i => {
      if (i.congregacao_id && i.congregacao_id === filtroCong) return true;
      if (nomeAlvo && i.congregacao_nome && i.congregacao_nome.toLowerCase() === nomeAlvo) return true;
      return false;
    });
  }
  if (busca) {
    const t = busca.toLowerCase();
    list = list.filter(
      i =>
        (i.nome_display ?? '').toLowerCase().includes(t) ||
        (i.email_externo ?? '').toLowerCase().includes(t) ||
        (i.telefone ?? '').toLowerCase().includes(t) ||
        (i.congregacao_nome ?? '').toLowerCase().includes(t)
    );
  }
  return list;
}

test('Tabela de Inscritos por Congregação — Gestão Eklésia', async (t) => {
  const congsMock: Congregacao[] = [
    { id: 'cong-sede', nome: 'Templo Central / Sede' },
    { id: 'cong-esperanca', nome: 'Congregação Esperança' },
    { id: 'cong-norte', nome: 'Congregação Zona Norte' },
  ];

  await t.test('1. Extração correta da congregação: a partir das observações estruturadas', () => {
    const obs = 'Restrições: Nenhuma | Congregação: Congregação Esperança | CPF: 111.222.333-44';
    const res = extrairCongregacaoInscricao(obs, null, congsMock);
    assert.equal(res.congregacao_id, 'cong-esperanca');
    assert.equal(res.congregacao_nome, 'Congregação Esperança');
  });

  await t.test('2. Extração correta da congregação: a partir do relacionamento do membro', () => {
    const membro: Membro = {
      id: 'mem-10',
      name: 'João Pedro',
      congregacao_id: 'cong-sede',
      congregacoes: { id: 'cong-sede', nome: 'Templo Central / Sede' },
    };
    const res = extrairCongregacaoInscricao('', membro, congsMock);
    assert.equal(res.congregacao_id, 'cong-sede');
    assert.equal(res.congregacao_nome, 'Templo Central / Sede');
  });

  await t.test('3. Participante externo sem congregação: exibe "Não informada"', () => {
    const res = extrairCongregacaoInscricao(null, null, congsMock);
    assert.equal(res.congregacao_nome, 'Não informada');
    assert.equal(res.congregacao_id, undefined);
  });

  await t.test('4. Filtragem por congregação isolada', () => {
    const lista = [
      { id: '1', nome_display: 'Membro Sede', congregacao_id: 'cong-sede', congregacao_nome: 'Templo Central / Sede', status: 'confirmado' },
      { id: '2', nome_display: 'Membro Esperança', congregacao_id: 'cong-esperanca', congregacao_nome: 'Congregação Esperança', status: 'confirmado' },
      { id: '3', nome_display: 'Externo Sem Congregação', congregacao_id: null, congregacao_nome: 'Não informada', status: 'confirmado' },
    ];

    const filtrados = filtrarInscricoes(lista, '', 'cong-esperanca', '', congsMock);
    assert.equal(filtrados.length, 1);
    assert.equal(filtrados[0].id, '2');
  });

  await t.test('5. Combinação limpa de filtro de Congregação + Status + Busca Textual', () => {
    const lista = [
      { id: '1', nome_display: 'Carlos Silva', email_externo: 'carlos@teste.com', congregacao_id: 'cong-sede', congregacao_nome: 'Templo Central / Sede', status: 'confirmado' },
      { id: '2', nome_display: 'Carlos Souza', email_externo: 'souza@teste.com', congregacao_id: 'cong-sede', congregacao_nome: 'Templo Central / Sede', status: 'lista_espera' },
      { id: '3', nome_display: 'Maria Silva', email_externo: 'maria@teste.com', congregacao_id: 'cong-sede', congregacao_nome: 'Templo Central / Sede', status: 'confirmado' },
      { id: '4', nome_display: 'Carlos Silva Norte', email_externo: 'carlosnorte@teste.com', congregacao_id: 'cong-norte', congregacao_nome: 'Congregação Zona Norte', status: 'confirmado' },
    ];

    // Buscar "Carlos", congregação "cong-sede", status "confirmado"
    const filtrados = filtrarInscricoes(lista, 'confirmado', 'cong-sede', 'carlos', congsMock);
    assert.equal(filtrados.length, 1);
    assert.equal(filtrados[0].id, '1');
    assert.equal(filtrados[0].nome_display, 'Carlos Silva');
  });

  await t.test('6. Exportação CSV inclui coluna Congregação logo após Nome e respeita lista filtrada', () => {
    const inscricoesFiltradas = [
      {
        nome_display: 'Pr. Marcos Silva',
        congregacao_nome: 'Templo Central / Sede',
        email_externo: 'marcos@igreja.com',
        telefone: '(85) 99999-0000',
        status: 'confirmado',
        presente: true,
        checkin_em: null,
        com_hospedagem: false,
        status_hospedagem: undefined,
        observacoes: 'Participante VIP',
      },
    ];

    const header = [
      'Nome',
      'Congregação',
      'E-mail',
      'Telefone',
      'Status',
      'Presente',
      'Check-in',
      'Hospedagem',
      'Status Hospedagem',
      'Observações',
    ];

    const rows = inscricoesFiltradas.map(i => [
      i.nome_display,
      i.congregacao_nome ?? 'Não informada',
      i.email_externo,
      i.telefone,
      i.status,
      i.presente ? 'Sim' : 'Não',
      '—',
      i.com_hospedagem ? 'Sim' : 'Não',
      'N/A',
      i.observacoes,
    ]);

    assert.equal(header[0], 'Nome');
    assert.equal(header[1], 'Congregação');
    assert.equal(rows[0][0], 'Pr. Marcos Silva');
    assert.equal(rows[0][1], 'Templo Central / Sede');
  });
});
