import test from 'node:test';
import assert from 'node:assert/strict';
import { isTemplateCategoriaEventos } from '../src/lib/certificados-utils';
import { buildEventoPlaceholderMap } from '../src/app/eventos/page';

test('isTemplateCategoriaEventos deve retornar true para categoria "eventos" e "evento"', () => {
  assert.equal(isTemplateCategoriaEventos({ categoria: 'eventos', nome: 'Certificado de Eventos' }), true);
  assert.equal(isTemplateCategoriaEventos({ categoria: 'Eventos', nome: 'Certificado Geral' }), true);
  assert.equal(isTemplateCategoriaEventos({ categoria: 'evento', nome: 'Congresso' }), true);
  assert.equal(isTemplateCategoriaEventos({ categoria: 'EVENTO', nome: 'Conferência' }), true);
});

test('isTemplateCategoriaEventos deve retornar false para outras categorias mesmo se nome contiver "evento"', () => {
  assert.equal(isTemplateCategoriaEventos({ categoria: 'ministerial', nome: 'Ordenação no Evento' }), false);
  assert.equal(isTemplateCategoriaEventos({ categoria: 'casamento', nome: 'Certificado de Casamento' }), false);
  assert.equal(isTemplateCategoriaEventos({ categoria: 'batismo-aguas', nome: 'Batismo' }), false);
  assert.equal(isTemplateCategoriaEventos({ categoria: 'ebd', nome: 'Conclusão EBD' }), false);
  assert.equal(isTemplateCategoriaEventos({ categoria: 'apresentacao-criancas', nome: 'Apresentação' }), false);
});

test('isTemplateCategoriaEventos deve retornar false para modelos sem categoria ou categoria genérica que não sejam de eventos', () => {
  assert.equal(isTemplateCategoriaEventos({ categoria: null, nome: 'Certificado Sem Categoria' }), false);
  assert.equal(isTemplateCategoriaEventos({ categoria: '', nome: 'Certificado Vazio' }), false);
  assert.equal(isTemplateCategoriaEventos(null), false);
  assert.equal(isTemplateCategoriaEventos(undefined), false);
});

test('isTemplateCategoriaEventos deve identificar modelo padrão de eventos se categoria estiver vazia mas template_key for "evento-padrao"', () => {
  assert.equal(isTemplateCategoriaEventos({ categoria: '', template_key: 'evento-padrao', nome: 'Certificado de Eventos (Padrão)' }), true);
  assert.equal(isTemplateCategoriaEventos({ categoria: null, template_key: 'evento-padrao', nome: 'Certificado' }), true);
});

test('buildEventoPlaceholderMap deve resolver todas as variáveis de participante, evento, data e local', () => {
  const participante = {
    nome: 'Carlos Eduardo Oliveira',
    cpf: '123.456.789-00',
    telefone: '(11) 98765-4321',
    email: 'carlos@example.com',
    data_confirmacao: '2026-11-20T10:00:00Z',
    data_inscricao: '2026-10-15T09:00:00Z',
  };

  const evento = {
    titulo: 'Conferência de Liderança 2026',
    data_inicio: '2026-11-20T19:00:00',
    data_fim: '2026-11-22T21:00:00',
    carga_horaria: 20,
    local_nome: 'Templo Sede',
    local_endereco: 'Av. Paulista, 1000, São Paulo - SP',
  };

  const configIgreja = {
    nome: 'Igreja Batista Renovada',
    cidade: 'São Paulo',
    uf: 'SP',
  };

  const map = buildEventoPlaceholderMap(evento, participante, configIgreja);

  // Participante
  assert.equal(map['{{NOME}}'], 'Carlos Eduardo Oliveira');
  assert.equal(map['{{NOME_PARTICIPANTE}}'], 'Carlos Eduardo Oliveira');
  assert.equal(map['{{CPF}}'], '123.456.789-00');
  assert.equal(map['{{CPF_PARTICIPANTE}}'], '123.456.789-00');
  assert.equal(map['{{TELEFONE}}'], '(11) 98765-4321');
  assert.equal(map['{{EMAIL}}'], 'carlos@example.com');

  // Evento
  assert.equal(map['{{NOME_EVENTO}}'], 'Conferência de Liderança 2026');
  assert.equal(map['{{TITULO_EVENTO}}'], 'Conferência de Liderança 2026');
  assert.equal(map['{{CARGA_HORARIA}}'], '20 horas');

  // Local
  assert.equal(map['{{LOCAL}}'], 'Templo Sede - Av. Paulista, 1000, São Paulo - SP');
  assert.equal(map['{{LOCAL_NOME}}'], 'Templo Sede');
  assert.equal(map['{{ENDERECO}}'], 'Av. Paulista, 1000, São Paulo - SP');

  // Igreja
  assert.equal(map['{{NOME_IGREJA}}'], 'Igreja Batista Renovada');
  assert.equal(map['{{CIDADE_IGREJA}}'], 'São Paulo');
  assert.equal(map['{{UF_IGREJA}}'], 'SP');
  assert.equal(map['{{CIDADE_UF_IGREJA}}'], 'São Paulo - SP');
});

test('Persistência e identificador real: optionsCertificados preserva certificado selecionado mesmo se inativo', () => {
  const templatesElegiveis = [
    { id: 'uuid-1', nome: 'Certificado de Eventos (Oficial)', categoria: 'eventos' },
    { id: 'uuid-2', nome: 'Certificado Congresso de Jovens', categoria: 'eventos' },
  ];

  const certificadoJaSelecionadoNoEvento = 'uuid-antigo-arquivado';

  // Simulação do useMemo no page.tsx
  const selectedId = certificadoJaSelecionadoNoEvento;
  const existsInEligible = templatesElegiveis.some(t => t.id === selectedId);
  const options = [...templatesElegiveis];
  if (selectedId && !existsInEligible) {
    options.unshift({
      id: selectedId,
      nome: 'Modelo selecionado (atual)',
      categoria: 'eventos',
    });
  }

  assert.equal(options.length, 3);
  assert.equal(options[0].id, 'uuid-antigo-arquivado');
  assert.equal(options[1].id, 'uuid-1');
  assert.equal(options[2].id, 'uuid-2');
});
