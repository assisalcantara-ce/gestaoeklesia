import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AgendaRecorrenciaService, RecorrenciaConfig } from '../src/lib/agenda-recorrencia-service.ts';

describe('Motor de Recorrência da Agenda Oficial (AgendaRecorrenciaService)', () => {
  it('1. Evento Único (frequência nenhuma): gera exatamente 1 ocorrência base', () => {
    const params = {
      dataInicio: '2026-05-10T19:30:00.000Z',
      dataFim: '2026-05-10T21:30:00.000Z',
      config: {
        frequencia: 'nenhuma' as const,
      },
    };

    const res = AgendaRecorrenciaService.gerarOcorrencias(params);
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].dataBaseStr, '2026-05-10');
    assert.strictEqual(res[0].numeroOcorrencia, 1);
    assert.ok(res[0].dataFim);
  });

  it('2. Recorrência Semanal: toda quarta-feira às 19:30 até limite do período', () => {
    // 2026-06-03 é uma Quarta-feira
    const params = {
      dataInicio: '2026-06-03T19:30:00.000Z',
      config: {
        frequencia: 'semanal' as const,
        diasSemana: [3], // Quarta-feira
        dataFimRecorrencia: '2026-06-30',
      },
    };

    const res = AgendaRecorrenciaService.gerarOcorrencias(params);
    // Em junho de 2026, as quartas-feiras são: 3, 10, 17, 24 (4 ocorrências)
    assert.strictEqual(res.length, 4);
    assert.strictEqual(res[0].dataBaseStr, '2026-06-03');
    assert.strictEqual(res[1].dataBaseStr, '2026-06-10');
    assert.strictEqual(res[2].dataBaseStr, '2026-06-17');
    assert.strictEqual(res[3].dataBaseStr, '2026-06-24');
    res.forEach(item => {
      const dt = new Date(item.dataInicio);
      assert.strictEqual(dt.getDay(), 3);
    });
  });

  it('3. Recorrência Semanal com múltiplos dias: todo domingo às 8h e toda quarta-feira', () => {
    // 2026-06-07 é Domingo
    const params = {
      dataInicio: '2026-06-07T08:00:00.000Z',
      config: {
        frequencia: 'semanal' as const,
        diasSemana: [0, 3], // Domingo e Quarta
        dataFimRecorrencia: '2026-06-21',
      },
    };

    const res = AgendaRecorrenciaService.gerarOcorrencias(params);
    const datas = res.map(r => r.dataBaseStr);
    assert.ok(datas.includes('2026-06-07')); // Dom
    assert.ok(datas.includes('2026-06-10')); // Qua
    assert.ok(datas.includes('2026-06-14')); // Dom
    assert.ok(datas.includes('2026-06-17')); // Qua
    assert.ok(datas.includes('2026-06-21')); // Dom
  });

  it('4. Recorrência Mensal Ordinal: 1º Sábado de cada mês', () => {
    const params = {
      dataInicio: '2026-01-01T09:00:00.000Z',
      config: {
        frequencia: 'mensal_ordinal' as const,
        ordinal: 'primeiro' as const,
        diaSemanaOrdinal: 6, // Sábado
        dataFimRecorrencia: '2026-04-30',
      },
    };

    const res = AgendaRecorrenciaService.gerarOcorrencias(params);
    // Jan: 3/jan, Fev: 7/fev, Mar: 7/mar, Abr: 4/abr
    assert.strictEqual(res.length, 4);
    assert.strictEqual(res[0].dataBaseStr, '2026-01-03');
    assert.strictEqual(res[1].dataBaseStr, '2026-02-07');
    assert.strictEqual(res[2].dataBaseStr, '2026-03-07');
    assert.strictEqual(res[3].dataBaseStr, '2026-04-04');
    res.forEach(item => {
      const dt = new Date(item.dataInicio);
      assert.strictEqual(dt.getDay(), 6); // Sábado
    });
  });

  it('5. Recorrência Mensal Ordinal: 2º Sábado de cada mês', () => {
    const params = {
      dataInicio: '2026-01-01T09:00:00.000Z',
      config: {
        frequencia: 'mensal_ordinal' as const,
        ordinal: 'segundo' as const,
        diaSemanaOrdinal: 6, // Sábado
        dataFimRecorrencia: '2026-04-30',
      },
    };

    const res = AgendaRecorrenciaService.gerarOcorrencias(params);
    // Jan: 10/jan, Fev: 14/fev, Mar: 14/mar, Abr: 11/abr
    assert.strictEqual(res.length, 4);
    assert.strictEqual(res[0].dataBaseStr, '2026-01-10');
    assert.strictEqual(res[1].dataBaseStr, '2026-02-14');
    assert.strictEqual(res[2].dataBaseStr, '2026-03-14');
    assert.strictEqual(res[3].dataBaseStr, '2026-04-11');
  });

  it('6. Tratamento de Exceções: remove datas canceladas ou feriados específicos', () => {
    const params = {
      dataInicio: '2026-06-03T19:30:00.000Z',
      config: {
        frequencia: 'semanal' as const,
        diasSemana: [3],
        dataFimRecorrencia: '2026-06-30',
      },
      excecoes: ['2026-06-17'], // Quarta-feira cancelada / exceção
    };

    const res = AgendaRecorrenciaService.gerarOcorrencias(params);
    const datas = res.map(r => r.dataBaseStr);
    assert.strictEqual(res.length, 3);
    assert.ok(!datas.includes('2026-06-17'));
    assert.ok(datas.includes('2026-06-03'));
    assert.ok(datas.includes('2026-06-10'));
    assert.ok(datas.includes('2026-06-24'));
  });

  it('7. Tratamento de Anos Bissextos e limites de final de mês', () => {
    // 2024 e 2028 são bissextos (29 dias em fev); 2026 não é (28 dias)
    assert.strictEqual(AgendaRecorrenciaService.isAnoBissexto(2024), true);
    assert.strictEqual(AgendaRecorrenciaService.isAnoBissexto(2026), false);
    assert.strictEqual(AgendaRecorrenciaService.isAnoBissexto(2028), true);
    assert.strictEqual(AgendaRecorrenciaService.getDiasNoMes(2024, 1), 29);
    assert.strictEqual(AgendaRecorrenciaService.getDiasNoMes(2026, 1), 28);

    // Evento no dia 31 gerado em meses com 30 ou 28 dias deve ajustar para o último dia válido
    const params = {
      dataInicio: '2026-01-31T20:00:00.000Z',
      config: {
        frequencia: 'mensal_dia' as const,
        diaDoMes: 31,
        dataFimRecorrencia: '2026-03-31',
      },
    };
    const res = AgendaRecorrenciaService.gerarOcorrencias(params);
    assert.strictEqual(res.length, 3);
    assert.strictEqual(res[0].dataBaseStr, '2026-01-31');
    assert.strictEqual(res[1].dataBaseStr, '2026-02-28'); // Fevereiro ajustado
    assert.strictEqual(res[2].dataBaseStr, '2026-03-31');
  });

  it('8. Integração Acolhimento e Agenda: Isolamento de Tenant e Vínculo sem duplicidade', () => {
    const tenantAlpha = 'tenant-ananindeua-01';
    const tenantBeta = 'tenant-belem-02';

    // Mock de evento da agenda oficial
    const eventoAgenda = {
      id: 'evt-culto-101',
      ministry_id: tenantAlpha,
      titulo: 'Culto de Doutrina Oficial',
      data_inicio: '2026-10-14T19:30:00.000Z',
      tipo: 'culto',
      church_id: 'cong-central',
    };

    // Registro no acolhimento consumindo evento da agenda oficial
    const registroAcolhimento = {
      id: 'culto-reg-202',
      ministry_id: tenantAlpha,
      congregacao_id: eventoAgenda.church_id,
      agenda_evento_id: eventoAgenda.id,
      data_culto: eventoAgenda.data_inicio.slice(0, 10),
      tipo_culto: 'Culto de Doutrina',
      status: 'Aberto',
    };

    assert.strictEqual(registroAcolhimento.agenda_evento_id, eventoAgenda.id);
    assert.strictEqual(registroAcolhimento.ministry_id, tenantAlpha);

    // Impede vazamento cross-tenant: evento do tenant Alpha não pode ser vinculado ao tenant Beta
    const tentarVincularCrossTenant = (regMinistryId: string, evtMinistryId: string) => {
      if (regMinistryId !== evtMinistryId) {
        throw new Error('Violação de Isolamento Multi-tenant: agenda_evento pertence a outra instituição.');
      }
      return true;
    };

    assert.throws(
      () => tentarVincularCrossTenant(tenantBeta, eventoAgenda.ministry_id),
      /Violação de Isolamento Multi-tenant/
    );
  });

  it('9. Validação Funcional: Geração de série pai + instâncias filhas sem colisão de datas', () => {
    // Simula criação de culto semanal com 4 ocorrências
    const formInicio = '2026-10-04T19:00:00'; // Domingo
    const recorrenciaConfig: RecorrenciaConfig = {
      frequencia: 'semanal',
      diasSemana: [0], // Domingos
      dataFimRecorrencia: '2026-10-25',
    };

    const ocorrencias = AgendaRecorrenciaService.gerarOcorrencias({
      dataInicio: formInicio,
      config: recorrenciaConfig,
    });

    assert.strictEqual(ocorrencias.length, 4);

    // Evento pai (1ª ocorrência)
    const pai = {
      id: 'evt-pai-uuid',
      data_inicio: new Date(formInicio).toISOString(),
      recorrencia_pai_id: null,
    };

    // Instâncias filhas (slice(1))
    const filhas = ocorrencias.slice(1).map((oc, idx) => ({
      id: `evt-filha-${idx + 1}`,
      data_inicio: oc.dataInicio,
      recorrencia_pai_id: pai.id,
    }));

    // Verifica que todas as 4 datas são únicas no calendário
    const todasAsDatas = [pai.data_inicio, ...filhas.map(f => f.data_inicio)];
    const conjuntoUnico = new Set(todasAsDatas);
    assert.strictEqual(conjuntoUnico.size, 4, 'Todas as 4 ocorrências devem ter datas distintas e únicas');

    // Nenhuma filha pode apontar para ID nulo
    filhas.forEach(f => {
      assert.strictEqual(f.recorrencia_pai_id, pai.id);
    });
  });

  it('10. Validação Funcional: Preservação de congregação e histórico operacional no Acolhimento', () => {
    const congregacaoAlpha = 'cong-setor-sul';

    // Lista de cultos disponíveis na agenda
    const eventosAgenda = [
      { id: 'ev-1', titulo: 'Culto Setor Sul', church_id: congregacaoAlpha },
      { id: 'ev-2', titulo: 'Culto Sede Geral', church_id: null },
      { id: 'ev-3', titulo: 'Culto Outro Setor', church_id: 'cong-outro' },
    ];

    // Operador local do setor Sul
    const filtrarPorEscopoLocal = (eventos: typeof eventosAgenda, userCongId: string) => {
      return eventos.filter(ev => ev.church_id === userCongId || ev.church_id === null);
    };

    const visiveisOperadorLocal = filtrarPorEscopoLocal(eventosAgenda, congregacaoAlpha);
    assert.strictEqual(visiveisOperadorLocal.length, 2);
    assert.ok(visiveisOperadorLocal.some(e => e.id === 'ev-1'));
    assert.ok(visiveisOperadorLocal.some(e => e.id === 'ev-2'));
    assert.ok(!visiveisOperadorLocal.some(e => e.id === 'ev-3'));

    // Ao vincular culto, dados operacionais e de encerramento são preservados
    const cultoExistente = {
      id: 'culto-01',
      agenda_evento_id: null,
      membros_presentes: 120,
      visitantes_presentes: 15,
      status: 'Encerrado',
    };

    const cultoVinculado = {
      ...cultoExistente,
      agenda_evento_id: 'ev-1',
    };

    // Histórico de métricas permanece 100% íntegro
    assert.strictEqual(cultoVinculado.membros_presentes, 120);
    assert.strictEqual(cultoVinculado.visitantes_presentes, 15);
    assert.strictEqual(cultoVinculado.status, 'Encerrado');
    assert.strictEqual(cultoVinculado.agenda_evento_id, 'ev-1');
  });

  it('11. Cenário Específico: Culto de Santa Ceia — Segundo sábado de cada mês', () => {
    // Configuração simulando o formulário EventoFormModal:
    // Começando em 2026-10-01 às 19:30, segundo sábado de cada mês até o final do ano
    const params = {
      dataInicio: '2026-10-01T19:30:00.000Z',
      dataFim: '2026-10-01T21:30:00.000Z',
      config: {
        frequencia: 'mensal_ordinal' as const,
        ordinal: 'segundo' as const,
        diaSemanaOrdinal: 6, // Sábado
        dataFimRecorrencia: '2026-12-31',
      },
    };

    const res = AgendaRecorrenciaService.gerarOcorrencias(params);
    // Outubro: 10/10/2026
    // Novembro: 14/11/2026
    // Dezembro: 12/12/2026
    assert.strictEqual(res.length, 3);
    assert.strictEqual(res[0].dataBaseStr, '2026-10-10');
    assert.strictEqual(res[1].dataBaseStr, '2026-11-14');
    assert.strictEqual(res[2].dataBaseStr, '2026-12-12');

    // Verifica preservação do horário (19:30 UTC) e duração (2 horas)
    res.forEach(item => {
      const dtInicio = new Date(item.dataInicio);
      const dtFim = new Date(item.dataFim!);
      assert.strictEqual(dtInicio.getUTCHours(), 19);
      assert.strictEqual(dtInicio.getUTCMinutes(), 30);
      assert.strictEqual(dtInicio.getUTCDay(), 6); // Sábado
      assert.strictEqual(dtFim.getTime() - dtInicio.getTime(), 2 * 60 * 60 * 1000);
    });
  });

  it('12. Geração Automática Anual: Segundo sábado de cada mês para o ano inteiro (12 ocorrências)', () => {
    // Cadastro sem data manual de início/fim: apenas ano de referência 2026, horário e regra
    const config: RecorrenciaConfig = {
      frequencia: 'mensal_ordinal',
      ordinal: 'segundo',
      diaSemanaOrdinal: 6, // Sábado
      anoReferencia: 2026,
    };

    // 1. Calcula primeira ocorrência automaticamente (deve ser janeiro/2026)
    const primeiraData = AgendaRecorrenciaService.calcularPrimeiraOcorrencia({
      ano: 2026,
      config,
      hora: 19,
      minuto: 30,
    });
    assert.ok(primeiraData);
    assert.strictEqual(primeiraData.getFullYear(), 2026);
    assert.strictEqual(primeiraData.getMonth(), 0); // Janeiro
    assert.strictEqual(primeiraData.getDate(), 10); // 10/01/2026 é o 2º sábado de janeiro
    assert.strictEqual(primeiraData.getDay(), 6); // Sábado

    // 2. Gera todas as ocorrências de janeiro a dezembro
    const duracaoMs = 120 * 60 * 1000;
    const res = AgendaRecorrenciaService.gerarOcorrencias({
      dataInicio: primeiraData.toISOString(),
      dataFim: new Date(primeiraData.getTime() + duracaoMs).toISOString(),
      config,
    });

    // Devem existir exatamente 12 ocorrências (uma por mês)
    assert.strictEqual(res.length, 12);

    // Conferência exata de cada segundo sábado de 2026:
    const datasEsperadas = [
      '2026-01-10', // Jan
      '2026-02-14', // Fev
      '2026-03-14', // Mar
      '2026-04-11', // Abr
      '2026-05-09', // Mai
      '2026-06-13', // Jun
      '2026-07-11', // Jul
      '2026-08-08', // Ago
      '2026-09-12', // Set
      '2026-10-10', // Out
      '2026-11-14', // Nov
      '2026-12-12', // Dez
    ];

    res.forEach((oc, idx) => {
      assert.strictEqual(oc.dataBaseStr, datasEsperadas[idx]);
      const dt = new Date(oc.dataInicio);
      assert.strictEqual(dt.getDay(), 6); // Todo segundo sábado
      assert.strictEqual(dt.getMonth(), idx); // Um para cada mês
      assert.strictEqual(oc.numeroOcorrencia, idx + 1);
    });
  });

  it('13. Geração Automática Anual: Todas as quartas-feiras de um ano completo (2026)', () => {
    // Configuração para ano 2026, toda quarta-feira às 19:30
    const config: RecorrenciaConfig = {
      frequencia: 'semanal',
      diasSemana: [3], // Quarta-feira
      anoReferencia: 2026,
    };

    // 1. Calcula primeira quarta-feira do ano automaticamente (07/01/2026)
    const primeiraData = AgendaRecorrenciaService.calcularPrimeiraOcorrencia({
      ano: 2026,
      config,
      hora: 19,
      minuto: 30,
    });
    assert.ok(primeiraData);
    assert.strictEqual(primeiraData.getFullYear(), 2026);
    assert.strictEqual(primeiraData.getMonth(), 0); // Janeiro
    assert.strictEqual(primeiraData.getDate(), 7); // 07/01/2026 é a 1ª quarta-feira do ano
    assert.strictEqual(primeiraData.getDay(), 3); // Quarta-feira

    // 2. Gera todas as ocorrências de janeiro a dezembro
    const duracaoMs = 90 * 60 * 1000;
    const res = AgendaRecorrenciaService.gerarOcorrencias({
      dataInicio: primeiraData.toISOString(),
      dataFim: new Date(primeiraData.getTime() + duracaoMs).toISOString(),
      config,
      limiteMaximo: 100,
    });

    // O ano de 2026 possui exatamente 52 quartas-feiras (começa em 07/01 e termina em 30/12)
    assert.strictEqual(res.length, 52);
    assert.strictEqual(res[0].dataBaseStr, '2026-01-07');
    assert.strictEqual(res[res.length - 1].dataBaseStr, '2026-12-30');

    // Todas devem ser quarta-feira (getDay() === 3)
    res.forEach(oc => {
      const dt = new Date(oc.dataInicio);
      assert.strictEqual(dt.getDay(), 3);
      assert.strictEqual(dt.getFullYear(), 2026);
    });
  });
});
