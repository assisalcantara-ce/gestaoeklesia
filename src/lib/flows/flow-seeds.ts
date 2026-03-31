import type { FlowDefinition } from './flow-engine';

export type FlowSeed = {
  name: string;
  description: string;
  definition: FlowDefinition;
};

const baseApprovalFlow = (title: string): FlowSeed => ({
  name: title,
  description: `Fluxo padrao para ${title.toLowerCase()}.`,
  definition: {
    initial_status: 'pendente',
    statuses: ['pendente', 'em_analise', 'aprovado', 'rejeitado', 'concluido'],
    final_statuses: ['concluido', 'rejeitado'],
    initial_assignee_role: 'OPERADOR',
    transitions: [
      {
        action: 'iniciar_analise',
        from: 'pendente',
        to: 'em_analise',
        roles: ['OPERADOR', 'SUPERVISOR', 'SUPERINTENDENTE'],
        next_role: 'SUPERVISOR',
      },
      {
        action: 'aprovar',
        from: 'em_analise',
        to: 'aprovado',
        roles: ['SUPERVISOR', 'SUPERINTENDENTE', 'ADMINISTRADOR'],
        next_role: 'OPERADOR',
        require_note: false,
      },
      {
        action: 'rejeitar',
        from: 'em_analise',
        to: 'rejeitado',
        roles: ['SUPERVISOR', 'SUPERINTENDENTE', 'ADMINISTRADOR'],
        require_note: true,
      },
      {
        action: 'concluir',
        from: 'aprovado',
        to: 'concluido',
        roles: ['OPERADOR', 'ADMINISTRADOR'],
      },
    ],
  },
});

export const FLOW_SEEDS: FlowSeed[] = [
  baseApprovalFlow('Consagracao de Obreiros'),
  baseApprovalFlow('Carta Ministerial'),
  baseApprovalFlow('Solicitacao de Desligamento'),
  baseApprovalFlow('Agenda/Gabinete Pastoral'),
];
