import test from 'node:test';
import assert from 'node:assert/strict';
import { formatarEnderecoCongregacao } from '../src/app/eventos/page';

test('formatarEnderecoCongregacao deve formatar endereço com todos os campos', () => {
  const cong = {
    endereco: 'Rua das Oliveiras, 120',
    cidade: 'São Paulo',
    uf: 'SP',
    cep: '01001-000',
  };
  const resultado = formatarEnderecoCongregacao(cong);
  assert.equal(resultado, 'Rua das Oliveiras, 120, São Paulo - SP, CEP: 01001-000');
});

test('formatarEnderecoCongregacao deve lidar com município em vez de cidade e CEP já prefixado', () => {
  const cong = {
    endereco: 'Av. Brasil, 500 - Bairro Centro',
    municipio: 'Curitiba',
    uf: 'pr',
    cep: 'CEP: 80000-000',
  };
  const resultado = formatarEnderecoCongregacao(cong);
  assert.equal(resultado, 'Av. Brasil, 500 - Bairro Centro, Curitiba - PR, CEP: 80000-000');
});

test('formatarEnderecoCongregacao deve retornar vazio quando não há dados', () => {
  assert.equal(formatarEnderecoCongregacao(null), '');
  assert.equal(formatarEnderecoCongregacao(undefined), '');
  assert.equal(formatarEnderecoCongregacao({ endereco: null, cidade: null }), '');
});

test('Resolução de endereço: Templo Sede deve usar fallback do tenant quando congregação não tem endereço', () => {
  const configIgreja = {
    nome: 'Igreja Central',
    endereco: 'Av. Principal, 1000 - Centro, Capital - SP, CEP: 01000-000',
  };
  const congregacoes = [
    { id: 'cong-1', nome: 'Templo Sede', is_sede: true, endereco: null, cidade: null, uf: null, cep: null },
    { id: 'cong-2', nome: 'Bairro Novo', is_sede: false, endereco: 'Rua B, 20', cidade: 'Capital', uf: 'SP', cep: '01002-000' },
  ];

  function resolverEndereco(congId: string) {
    if (!congId) {
      const sedeCong = congregacoes.find(c => c.is_sede);
      if (sedeCong) {
        const endSede = formatarEnderecoCongregacao(sedeCong);
        if (endSede) return endSede;
      }
      return (configIgreja.endereco || '').trim();
    }
    const cong = congregacoes.find(c => c.id === congId);
    if (!cong) return '';
    const endCong = formatarEnderecoCongregacao(cong);
    if (endCong) return endCong;
    if (cong.is_sede) return (configIgreja.endereco || '').trim();
    return '';
  }

  // Templo sede via id vazio
  assert.equal(resolverEndereco(''), 'Av. Principal, 1000 - Centro, Capital - SP, CEP: 01000-000');
  // Templo sede via id de congregação marcada como sede
  assert.equal(resolverEndereco('cong-1'), 'Av. Principal, 1000 - Centro, Capital - SP, CEP: 01000-000');
  // Congregação comum com endereço próprio
  assert.equal(resolverEndereco('cong-2'), 'Rua B, 20, Capital - SP, CEP: 01002-000');
});

test('Resolução de endereço: congregação comum sem endereço não deve assumir endereço da sede', () => {
  const configIgreja = {
    nome: 'Igreja Central',
    endereco: 'Av. Principal, 1000 - Centro, Capital - SP, CEP: 01000-000',
  };
  const congregacoes = [
    { id: 'cong-1', nome: 'Templo Sede', is_sede: true, endereco: null },
    { id: 'cong-3', nome: 'Ponto de Pregação Vale', is_sede: false, endereco: null },
  ];

  function resolverEndereco(congId: string) {
    if (!congId) {
      const sedeCong = congregacoes.find(c => c.is_sede);
      if (sedeCong) {
        const endSede = formatarEnderecoCongregacao(sedeCong);
        if (endSede) return endSede;
      }
      return (configIgreja.endereco || '').trim();
    }
    const cong = congregacoes.find(c => c.id === congId);
    if (!cong) return '';
    const endCong = formatarEnderecoCongregacao(cong);
    if (endCong) return endCong;
    if (cong.is_sede) return (configIgreja.endereco || '').trim();
    return '';
  }

  assert.equal(resolverEndereco('cong-3'), '');
});

test('Resolução de local_nome para compatibilidade com APIs e relatórios', () => {
  const configIgreja = {
    nome: 'Igreja Central',
    endereco: 'Av. Principal, 1000',
  };
  const congregacoes = [
    { id: 'cong-1', nome: 'Templo Sede Central', is_sede: true },
    { id: 'cong-2', nome: 'Congregação Jardim Primavera', is_sede: false },
  ];

  function resolverLocalNome(formEvento: { congregacao_id: string; local_nome?: string }) {
    if (formEvento.congregacao_id) {
      const congSel = congregacoes.find(c => c.id === formEvento.congregacao_id);
      return congSel?.nome || formEvento.local_nome || 'Congregação';
    } else {
      const sedeCong = congregacoes.find(c => c.is_sede);
      return sedeCong?.nome || configIgreja?.nome || 'Templo Sede';
    }
  }

  assert.equal(resolverLocalNome({ congregacao_id: 'cong-2' }), 'Congregação Jardim Primavera');
  assert.equal(resolverLocalNome({ congregacao_id: '' }), 'Templo Sede Central');
});
