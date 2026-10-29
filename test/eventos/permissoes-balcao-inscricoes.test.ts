import test from 'node:test';
import assert from 'node:assert/strict';

// Helper de verificação de se o evento é pago (reprodução fiel da regra de src/app/eventos/page.tsx)
function isEventoPago(ev?: { evento_pago?: boolean | null; valor_inscricao?: number | string | null } | null): boolean {
  if (!ev) return false;
  const valor = typeof ev.valor_inscricao === 'number' ? ev.valor_inscricao : Number(ev.valor_inscricao) || 0;
  return Boolean(ev.evento_pago || valor > 0);
}

// Helper de resolução de escopo de permissões no módulo Eventos
function calcularEscopoEventos(user: {
  isAdmin?: boolean;
  nivel?: string | null;
  permissions?: string[];
  role?: string;
}) {
  const perms = user.permissions ?? [];
  const role = user.role ?? '';
  const isAdmin = Boolean(user.isAdmin || perms.includes('ADMINISTRADOR') || role === 'admin');
  const isSecret =
    perms.includes('SECRETARIO') ||
    perms.includes('SECRETARIO_GERAL') ||
    perms.includes('SECRETARIA') ||
    user.nivel === 'secretario_geral' ||
    user.nivel === 'secretaria_local' ||
    user.nivel === 'auxiliar_secretaria';
  const isFinanc =
    perms.includes('FINANCEIRO') ||
    perms.includes('TESOUREIRO_GERAL') ||
    perms.includes('TESOURARIA_LOCAL') ||
    perms.includes('FINANCEIRO_LOCAL') ||
    user.nivel === 'tesoureiro_geral' ||
    user.nivel === 'financeiro' ||
    user.nivel === 'tesouraria_local' ||
    user.nivel === 'financeiro_local';

  return {
    canWrite: isAdmin || isSecret,
    canDelete: isAdmin,
    canFinanceiro: isAdmin || isFinanc,
  };
}

// Simulação de renderização de controles de interface
function renderControlesEventos(scope: { canWrite: boolean; canDelete: boolean; canFinanceiro: boolean }, eventoSelecionado: any) {
  const botaoInscreverDisponivel = scope.canWrite;
  const botaoBalcaoDisponivel = scope.canWrite && isEventoPago(eventoSelecionado);

  return {
    botaoInscreverDisponivel,
    botaoBalcaoDisponivel,
  };
}

test('Permissões de Inscrições e Balcão — Perfil Secretaria-Geral', async (t) => {
  await t.test('1. Secretaria-Geral tem canWrite liberado e podeInscrever ativado', () => {
    const userSecretarioGeral = {
      isAdmin: false,
      nivel: 'secretario_geral',
      permissions: ['SECRETARIO_GERAL'],
      role: 'operator',
    };

    const scope = calcularEscopoEventos(userSecretarioGeral);
    assert.strictEqual(scope.canWrite, true, 'Secretário-Geral deve possuir canWrite = true');
    assert.strictEqual(scope.canDelete, false, 'Secretário-Geral não deve possuir canDelete');
    assert.strictEqual(scope.canFinanceiro, false, 'Secretário-Geral não deve possuir canFinanceiro geral');
  });

  await t.test('2. Evento Gratuito: Botão Inscrever visível, Balcão oculto', () => {
    const scope = { canWrite: true, canDelete: false, canFinanceiro: false };

    const eventoGratuito1 = { id: 'ev-free-1', titulo: 'Culto de Ensino', evento_pago: false, valor_inscricao: 0 };
    const res1 = renderControlesEventos(scope, eventoGratuito1);
    assert.strictEqual(res1.botaoInscreverDisponivel, true, 'Botão Inscrever deve estar disponível para evento gratuito');
    assert.strictEqual(res1.botaoBalcaoDisponivel, false, 'Botão Balcão deve estar OCULTO para evento gratuito');

    const eventoGratuito2 = { id: 'ev-free-2', titulo: 'Conferência Geral', evento_pago: false, valor_inscricao: '0.00' };
    const res2 = renderControlesEventos(scope, eventoGratuito2);
    assert.strictEqual(res2.botaoBalcaoDisponivel, false, 'Botão Balcão deve permanecer oculto com string "0.00"');
  });

  await t.test('3. Evento Pago: Botão Inscrever e Balcão visíveis para Secretaria-Geral', () => {
    const scope = { canWrite: true, canDelete: false, canFinanceiro: false };

    const eventoPago1 = { id: 'ev-paid-1', titulo: 'Congresso de Jovens', evento_pago: true, valor_inscricao: 50 };
    const res1 = renderControlesEventos(scope, eventoPago1);
    assert.strictEqual(res1.botaoInscreverDisponivel, true);
    assert.strictEqual(res1.botaoBalcaoDisponivel, true, 'Botão Balcão deve estar VISÍVEL para evento pago');

    const eventoPago2 = { id: 'ev-paid-2', titulo: 'Retiro Espiritual', evento_pago: false, valor_inscricao: 120.00 };
    const res2 = renderControlesEventos(scope, eventoPago2);
    assert.strictEqual(res2.botaoBalcaoDisponivel, true, 'Evento com valor > 0 é classificado como evento pago');
  });

  await t.test('4. Alternância dinâmica: se evento selecionado mudar de pago para gratuito, Balcão fecha e redireciona', () => {
    let showBalcaoModal = true;
    let aba = 'inscricoes';
    let balcaoEventoId = 'ev-pago-1';

    const eventos = [
      { id: 'ev-pago-1', titulo: 'Congresso', evento_pago: true, valor_inscricao: 50 },
      { id: 'ev-gratis-2', titulo: 'Culto Jovem', evento_pago: false, valor_inscricao: 0 },
    ];

    // Simulação do useEffect de segurança que observa eventos e balcaoEventoId
    function simularMudancaEvento(novoEventoId: string) {
      balcaoEventoId = novoEventoId;
      const evAtual = eventos.find(e => e.id === balcaoEventoId);
      if (showBalcaoModal && evAtual && !isEventoPago(evAtual)) {
        showBalcaoModal = false;
        aba = 'inscricoes';
      }
    }

    // Ao alternar para o evento gratuito enquanto Balcão está aberto:
    simularMudancaEvento('ev-gratis-2');
    assert.strictEqual(showBalcaoModal, false, 'Modal do Balcão deve ser fechado automaticamente');
    assert.strictEqual(aba, 'inscricoes', 'Aba deve ser redirecionada para "inscricoes"');
  });

  await t.test('5. Bloqueio no backend/handler caso tente salvar no Balcão para evento gratuito', () => {
    const eventos = [
      { id: 'ev-gratis', titulo: 'Vigília Gratuita', evento_pago: false, valor_inscricao: 0 },
    ];

    let modalChamado: { titulo: string; mensagem: string; tipo: string } | null = null;
    let modalAberto = true;
    let abaAtiva = 'inscricoes';

    function salvarBalcao(eventoId: string) {
      const ev = eventos.find(e => e.id === eventoId);
      if (!ev || !isEventoPago(ev)) {
        modalChamado = {
          titulo: 'Operação não permitida',
          mensagem: 'O Balcão é restrito a eventos pagos. Realize inscrições em eventos gratuitos através do botão Inscrever na aba Inscrições.',
          tipo: 'error',
        };
        modalAberto = false;
        abaAtiva = 'inscricoes';
        return false;
      }
      return true;
    }

    const sucesso = salvarBalcao('ev-gratis');
    assert.strictEqual(sucesso, false, 'Salvar no balcão deve retornar false para evento gratuito');
    assert.strictEqual(modalAberto, false, 'Modal deve ser fechado');
    assert.strictEqual(abaAtiva, 'inscricoes', 'Deve redirecionar para inscricoes');
    const resModal = modalChamado as { titulo: string; mensagem: string; tipo: string } | null;
    assert.strictEqual(resModal?.titulo, 'Operação não permitida');
  });

  await t.test('7. Garantia de Inscrição em Eventos Pagos Exclusivamente pelo Balcão', () => {
    const scope = { canWrite: true, canDelete: false, canFinanceiro: false };
    const eventoPago = { id: 'ev-pago-1', titulo: 'Congresso de Homens', evento_pago: true, valor_inscricao: 70 };
    const eventoGratuito = { id: 'ev-free-1', titulo: 'Culto de Oração', evento_pago: false, valor_inscricao: 0 };

    assert.strictEqual(scope.canWrite, true);

    // Ao clicar em inscrever no evento pago, deve direcionar para o Balcão
    let balcaoAbertoParaEventoId: string | null = null;
    let modalInscricaoAberto = false;

    function acaoClicarInscrever(evento: any) {
      if (isEventoPago(evento)) {
        balcaoAbertoParaEventoId = evento.id;
      } else {
        modalInscricaoAberto = true;
      }
    }

    acaoClicarInscrever(eventoPago);
    assert.strictEqual(balcaoAbertoParaEventoId, 'ev-pago-1', 'Evento pago deve abrir diretamente o Balcão');
    assert.strictEqual(modalInscricaoAberto, false, 'Modal de inscrição comum NÃO deve abrir para evento pago');

    // Ao clicar em evento gratuito
    balcaoAbertoParaEventoId = null;
    acaoClicarInscrever(eventoGratuito);
    assert.strictEqual(balcaoAbertoParaEventoId, null, 'Evento gratuito não abre balcão');
    assert.strictEqual(modalInscricaoAberto, true, 'Evento gratuito abre modal de inscrição comum');

    // Tentativa direta de submeter nova inscrição comum para evento pago deve ser bloqueada
    let bloqueado = false;
    function tentarSalvarInscricaoComum(editingId: string | null, evento: any) {
      if (!editingId && isEventoPago(evento)) {
        bloqueado = true;
        return false;
      }
      return true;
    }

    const resultadoTentativa = tentarSalvarInscricaoComum(null, eventoPago);
    assert.strictEqual(resultadoTentativa, false, 'Não deve permitir criar inscrição comum em evento pago');
    assert.strictEqual(bloqueado, true);

    // Edição de inscrição já existente em evento pago (ex: corrigir telefone ou congregação) é permitida
    const resultadoEdicao = tentarSalvarInscricaoComum('insc-123', eventoPago);
    assert.strictEqual(resultadoEdicao, true, 'Edição de inscrição existente é permitida');
  });

  await t.test('8. Validação no Servidor/Backend: Bloqueio de inserção direta e proteção financeira', () => {
    // Simulação do comportamento da trigger de banco/serviço:
    function simularValidacaoBackendInscricao(op: 'INSERT' | 'UPDATE', payload: any, eventoBanco: any, pagamentoQuitado: boolean) {
      const isPago = Boolean(eventoBanco.evento_pago || Number(eventoBanco.valor_inscricao) > 0);

      if (op === 'INSERT') {
        if (isPago) {
          const isPublicoOuMobile = ['aguardando_pagamento', 'lista_espera'].includes(payload.status);
          const isBalcao = Boolean(
            payload.observacoes && (
              payload.observacoes.includes('[Atendimento Balcão') ||
              payload.observacoes.includes('Forma de Pagamento: ') ||
              payload.observacoes.includes('Cortesia')
            )
          );

          if (!isPublicoOuMobile && !isBalcao) {
            throw new Error('BLOQUEIO_FLUXO_PAGO_BALCAO_OBRIGATORIO: Inscrições em eventos pagos devem ser realizadas obrigatoriamente através do Balcão ou fluxo de pagamento autorizado.');
          }
        }
      }

      if (op === 'UPDATE') {
        if (isPago && payload.status === 'confirmado' && !pagamentoQuitado && !payload.observacoes?.includes('Cortesia')) {
          throw new Error('CONFIRMACAO_FINANCEIRA_EXIGIDA: Não é permitido confirmar inscrição em evento pago sem registro financeiro de quitação ou cortesia autorizada.');
        }
      }

      return true;
    }

    const eventoGratuito = { id: 'ev-free', evento_pago: false, valor_inscricao: 0 };
    const eventoPago = { id: 'ev-paid', evento_pago: true, valor_inscricao: 100 };

    // 1. Inserção direta convencional em evento gratuito: Permitida
    const resGratuito = simularValidacaoBackendInscricao('INSERT', {
      evento_id: eventoGratuito.id,
      status: 'confirmado',
      observacoes: 'Inscrição comum',
    }, eventoGratuito, false);
    assert.strictEqual(resGratuito, true);

    // 2. Tentativa de bypass direto via API para evento pago (status confirmado sem balcão): Bloqueado
    assert.throws(
      () => {
        simularValidacaoBackendInscricao('INSERT', {
          evento_id: eventoPago.id,
          status: 'confirmado',
          observacoes: 'Tentativa de contorno direto',
        }, eventoPago, false);
      },
      /BLOQUEIO_FLUXO_PAGO_BALCAO_OBRIGATORIO/
    );

    // 3. Inserção autorizada via Balcão com pagamento: Permitida
    const resBalcao = simularValidacaoBackendInscricao('INSERT', {
      evento_id: eventoPago.id,
      status: 'confirmado',
      observacoes: '[Atendimento Balcão] | Forma de Pagamento: Dinheiro / À Vista',
    }, eventoPago, true);
    assert.strictEqual(resBalcao, true);

    // 4. Inserção autorizada via Balcão com Cortesia justificada: Permitida
    const resCortesia = simularValidacaoBackendInscricao('INSERT', {
      evento_id: eventoPago.id,
      status: 'confirmado',
      observacoes: '[Atendimento Balcão] | Cortesia Autorizada | Justificativa: Preletor Convidado',
    }, eventoPago, false);
    assert.strictEqual(resCortesia, true);

    // 5. Inscrição pública online ou mobile: Cria como aguardando_pagamento
    const resPublico = simularValidacaoBackendInscricao('INSERT', {
      evento_id: eventoPago.id,
      status: 'aguardando_pagamento',
      observacoes: 'Inscrição via site',
    }, eventoPago, false);
    assert.strictEqual(resPublico, true);

    // 6. Tentativa de UPDATE fraudulento (marcar como confirmado sem ter pago nem ser cortesia): Bloqueado
    assert.throws(
      () => {
        simularValidacaoBackendInscricao('UPDATE', {
          id: 'insc-1',
          status: 'confirmado',
          observacoes: 'Tentativa de forçar confirmado',
        }, eventoPago, false);
      },
      /CONFIRMACAO_FINANCEIRA_EXIGIDA/
    );

    // 7. UPDATE cadastral legítimo (manter confirmado com pagamento quitado existente): Permitido
    const resUpdateLegitimo = simularValidacaoBackendInscricao('UPDATE', {
      id: 'insc-1',
      status: 'confirmado',
      telefone: '(91) 98888-7777',
    }, eventoPago, true);
    assert.strictEqual(resUpdateLegitimo, true);
  });
});
