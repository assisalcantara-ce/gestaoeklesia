import test from 'node:test';
import assert from 'node:assert/strict';
import { isTemplateCategoriaEventos, substituirPlaceholdersCertificado } from '../src/lib/certificados-utils';
import { buildEventoPlaceholderMap } from '../src/lib/evento-status-utils';

test('1. Resolução do modelo de certificado: aceita tanto template_key quanto id de banco', () => {
  const templatesDoBanco = [
    {
      id: '0cb5ac2a-26c1-4889-9e9c-a7323c91d6fe', // UUID no Postgres
      template_key: 'evento-padrao',
      name: 'Certificado de Eventos',
      template_data: {
        id: 'evento-padrao',
        nome: 'Certificado de Eventos',
        categoria: 'eventos',
        elementos: [{ id: '1', tipo: 'texto', texto: '{{participante_nome}}' }],
      },
    },
    {
      id: 'ce9c9974-54e3-4083-a091-7977cda19a34',
      template_key: 'casamento-padrao',
      name: 'Casamento',
      template_data: { id: 'casamento-padrao', nome: 'Casamento', categoria: 'casamento', elementos: [] },
    },
  ];

  // Função de resolução que simula a lógica do frontend/backend
  const resolverModelo = (modeloId: string) => {
    return templatesDoBanco.find(
      t => t.id === modeloId || t.template_key === modeloId || t.template_data?.id === modeloId
    );
  };

  // Busca por template_key ("evento-padrao")
  const porKey = resolverModelo('evento-padrao');
  assert.ok(porKey);
  assert.equal(porKey.name, 'Certificado de Eventos');
  assert.equal(isTemplateCategoriaEventos(porKey.template_data), true);

  // Busca por UUID do banco ("0cb5ac2a-26c1-4889-9e9c-a7323c91d6fe")
  const porUuid = resolverModelo('0cb5ac2a-26c1-4889-9e9c-a7323c91d6fe');
  assert.ok(porUuid);
  assert.equal(porUuid.name, 'Certificado de Eventos');
  assert.equal(porUuid.template_key, 'evento-padrao');

  // Busca por modelo inexistente: deve retornar undefined (sem fallback cego para outros tipos)
  const inexistente = resolverModelo('modelo-inexistente-123');
  assert.equal(inexistente, undefined);
});

test('2. Filtragem de categoria: apenas modelos elegíveis para Eventos', () => {
  assert.equal(isTemplateCategoriaEventos({ categoria: 'eventos', nome: 'Certificado de Eventos' }), true);
  assert.equal(isTemplateCategoriaEventos({ categoria: 'Eventos', nome: 'Congresso de Homens' }), true);
  assert.equal(isTemplateCategoriaEventos({ categoria: 'evento', nome: 'Escola de Obreiros' }), true);
  assert.equal(isTemplateCategoriaEventos({ template_key: 'evento-padrao', nome: 'Modelo Padrão' }), true);

  // Categorias que NÃO devem aparecer
  assert.equal(isTemplateCategoriaEventos({ categoria: 'ministerial', nome: 'Consagração Pastor' }), false);
  assert.equal(isTemplateCategoriaEventos({ categoria: 'batismo-aguas', nome: 'Batismo' }), false);
  assert.equal(isTemplateCategoriaEventos({ categoria: 'casamento', nome: 'Casamento' }), false);
  assert.equal(isTemplateCategoriaEventos({ categoria: 'ebd', nome: 'EBD' }), false);
});

test('3. Pré-visualização com dados reais do evento: substituição completa de variáveis', () => {
  const eventoReal = {
    id: '593659c8-f586-4cae-af6a-a37dd190576f',
    titulo: 'ESCOLA DE OBREIROS 2026',
    data_inicio: '2026-10-23T19:00:00+00:00',
    data_fim: '2026-10-23T21:30:00+00:00',
    local_nome: 'ASSEMBLEIA DE DEUS ANANINDEUA',
    local_endereco: 'BR 316, KM02, 230, ANANINDEUA - PA',
    tipo: 'conferencia',
  };

  const participanteExemplo = {
    id: 'insc-demo',
    nome_display: 'Carlos Eduardo Oliveira',
    cpf: '123.456.789-00',
    telefone: '(91) 98765-4321',
    email: 'carlos@eklesia.com',
    data_confirmacao: '2026-10-23T20:00:00Z',
    data_inscricao: '2026-10-15T10:00:00Z',
  };

  const configIgreja = {
    nome: 'ASSEMBLEIA DE DEUS ANANINDEUA',
    endereco: 'BR 316, KM02, 230, ANANINDEUA - PA',
    cnpj: '00.000.000/0001-00',
  };

  const map = buildEventoPlaceholderMap(eventoReal as any, participanteExemplo as any, configIgreja);

  // Textos com placeholders típicos do template de eventos
  const textoNome = substituirPlaceholdersCertificado('Certificamos que {{participante_nome}} participou com aproveitamento', map, 'eventos');
  assert.equal(textoNome, 'Certificamos que Carlos Eduardo Oliveira participou com aproveitamento');

  const textoEvento = substituirPlaceholdersCertificado('do evento {{evento_nome}}', map, 'eventos');
  assert.equal(textoEvento, 'do evento ESCOLA DE OBREIROS 2026');

  const textoLocal = substituirPlaceholdersCertificado('realizado em {{evento_local}}', map, 'eventos');
  assert.equal(textoLocal, 'realizado em ASSEMBLEIA DE DEUS ANANINDEUA - BR 316, KM02, 230, ANANINDEUA - PA');

  const textoData = substituirPlaceholdersCertificado('na data de {{evento_data}}', map, 'eventos');
  assert.ok(textoData.includes('23'));
  assert.ok(textoData.includes('2026'));

  const textoIgreja = substituirPlaceholdersCertificado('{{ministerio_nome}}', map, 'eventos');
  assert.equal(textoIgreja, 'ASSEMBLEIA DE DEUS ANANINDEUA');
});
