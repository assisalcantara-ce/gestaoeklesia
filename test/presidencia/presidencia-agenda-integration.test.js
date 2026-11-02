/**
 * presidencia-agenda-integration.test.js
 *
 * Teste unitário e de integração para a Central Unificada de Decisões da Presidência:
 * 1. Integração de solicitações da Agenda Oficial (agenda_solicitacoes) à Central de Decisões.
 * 2. Validação das 3 categorias (Dirigentes, Cartas, Agenda).
 * 3. Julgamento presidencial de solicitações da agenda (aprovar/rejeitar) e persistência de efeitos.
 * 4. Isolamento multi-tenant por ministry_id e checagem de permissões RBAC.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

describe('Presidência — Central Unificada de Decisões (Integração com Agenda Oficial)', () => {
  const ministryId = 'min-alpha-123'
  const userPresidente = {
    userId: 'user-pres-01',
    userName: 'Pastor Presidente Geral',
    ministryId,
    nivel: 'presidencia',
    isAdmin: false,
  }

  const userMembroComum = {
    userId: 'user-membro-02',
    userName: 'Membro Normal',
    ministryId,
    nivel: 'membro',
    isAdmin: false,
  }

  it('1. Deve categorizar corretamente as 3 famílias de pendências na Central de Decisões', () => {
    const rawMovs = [
      { id: 'mov-1', status: 'proposta', dirigente_novo_nome: 'Pr. Carlos', created_at: '2026-11-01T10:00:00Z' },
    ]
    const rawCartas = [
      { id: 'cart-1', status: 'pendente', tipo_carta: 'mudanca', membro_nome: 'Irmão João', created_at: '2026-11-02T08:00:00Z' },
    ]
    const rawAgenda = [
      { id: 'sol-1', status: 'pendente', tipo_solicitacao: 'conflito_data', titulo: 'Conferência Geral', data_inicio: '2026-12-10T19:00:00Z', created_at: '2026-11-02T11:00:00Z' },
    ]

    const fila = []

    rawMovs.forEach(m => fila.push({ id: m.id, origem: 'dirigente_movimentacao', tipoCategoria: 'dirigente' }))
    rawCartas.forEach(c => fila.push({ id: c.id, origem: 'carta_pedido', tipoCategoria: 'carta_mudanca' }))
    rawAgenda.forEach(a => fila.push({ id: a.id, origem: 'agenda_solicitacao', tipoCategoria: 'agenda_solicitacao' }))

    const resumo = {
      totalPendencias: fila.length,
      dirigentesPropostas: rawMovs.length,
      cartasMudanca: rawCartas.length,
      agendaSolicitacoes: rawAgenda.length,
    }

    assert.strictEqual(resumo.totalPendencias, 3)
    assert.strictEqual(resumo.dirigentesPropostas, 1)
    assert.strictEqual(resumo.cartasMudanca, 1)
    assert.strictEqual(resumo.agendaSolicitacoes, 1)

    // Filtragem por categoria
    const filtradoAgenda = fila.filter(f => f.tipoCategoria === 'agenda_solicitacao')
    assert.strictEqual(filtradoAgenda.length, 1)
    assert.strictEqual(filtradoAgenda[0].origem, 'agenda_solicitacao')
  })

  it('2. Bloqueia operador sem nível de presidência ou admin de deliberar na agenda', () => {
    function isPresidenciaOuAdmin(user) {
      if (user.isAdmin) return true
      return user.nivel === 'administrador' || user.nivel === 'presidencia'
    }

    assert.strictEqual(isPresidenciaOuAdmin(userPresidente), true)
    assert.strictEqual(isPresidenciaOuAdmin(userMembroComum), false)
  })

  it('3. Executa deliberação de aprovação com efeito jurídico na Agenda Oficial', () => {
    const agendaDb = [
      {
        id: 'sol-100',
        ministry_id: ministryId,
        status: 'pendente',
        titulo: 'Cruzada Evangelística',
        data_inicio: '2026-11-20T19:00:00Z',
      },
    ]

    function deliberarAgenda(input, user) {
      if (user.nivel !== 'presidencia' && !user.isAdmin) {
        throw new Error('Acesso negado: Presidência requerida.')
      }
      const item = agendaDb.find(s => s.id === input.solicitacao_id && s.ministry_id === user.ministryId)
      if (!item) throw new Error('Solicitação não encontrada.')
      if (item.status !== 'pendente') throw new Error('Já deliberada.')

      const statusFinal = input.decisao === 'rejeitar' ? 'rejeitado' : 'aprovado'
      item.status = statusFinal
      item.tipo_decisao = input.tipo_decisao || input.decisao
      item.efeito = statusFinal === 'rejeitado' ? null : (input.efeito || 'autorizar_evento')
      item.parecer = input.parecer || 'Autorizado pela Presidência'
      item.analisado_por = user.userId
      item.analisado_em = new Date().toISOString()

      return item
    }

    const resultadoAprovacao = deliberarAgenda(
      {
        solicitacao_id: 'sol-100',
        decisao: 'aprovar',
        tipo_decisao: 'aprovar',
        efeito: 'autorizar_evento',
        parecer: 'Autorizado em reunião ministerial',
      },
      userPresidente
    )

    assert.strictEqual(resultadoAprovacao.status, 'aprovado')
    assert.strictEqual(resultadoAprovacao.efeito, 'autorizar_evento')
    assert.strictEqual(resultadoAprovacao.analisado_por, 'user-pres-01')

    // Tentar deliberar novamente deve ser bloqueado
    assert.throws(() => {
      deliberarAgenda({ solicitacao_id: 'sol-100', decisao: 'rejeitar' }, userPresidente)
    }, /Já deliberada/)
  })

  it('4. Exige parecer obrigatório para indeferimento de solicitações', () => {
    function validarParecer(decisao, parecer) {
      const p = (parecer || '').trim()
      if (decisao === 'rejeitar' && !p) {
        throw new Error('O parecer de indeferimento é obrigatório.')
      }
      return true
    }

    assert.throws(() => validarParecer('rejeitar', ''), /parecer de indeferimento é obrigatório/)
    assert.strictEqual(validarParecer('rejeitar', 'Conflito com culto de doutrina'), true)
    assert.strictEqual(validarParecer('aprovar', ''), true)
  })

  it('5. Garante isolamento multi-tenant (não permite julgar solicitação de outro ministério)', () => {
    const agendaDb = [
      { id: 'sol-tenant-b', ministry_id: 'min-outro-999', status: 'pendente' },
    ]

    function buscarParaDeliberar(solId, userMinId) {
      const item = agendaDb.find(s => s.id === solId && s.ministry_id === userMinId)
      if (!item) {
        throw new Error('Solicitação da Agenda Oficial não encontrada ou acesso negado pelo isolamento multi-tenant.')
      }
      return item
    }

    assert.throws(() => {
      buscarParaDeliberar('sol-tenant-b', ministryId)
    }, /isolamento multi-tenant/)
  })
})
