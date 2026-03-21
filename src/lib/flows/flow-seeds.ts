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
  baseApprovalFlow('Batismo'),
  {
    name: 'Apresentacao de Criancas',
    description: 'Fluxo padrao para apresentacao de criancas.',
    definition: {
      initial_status: 'pendente',
      statuses: ['pendente', 'em_analise', 'aprovado', 'rejeitado', 'concluido'],
      final_statuses: ['concluido', 'rejeitado'],
      initial_assignee_role: 'OPERADOR',
      form: {
        fields: [
          { name: 'crianca_nome', label: 'Nome da crianca', type: 'text', required: true },
          { name: 'child_id', label: 'ID da crianca (se ja cadastrada)', type: 'text', required: false },
          { name: 'responsavel_1', label: 'Responsavel 1', type: 'text', required: true },
          { name: 'responsavel_2', label: 'Responsavel 2', type: 'text', required: false },
          { name: 'data_apresentacao', label: 'Data da apresentacao', type: 'date', required: true },
          { name: 'culto_turno', label: 'Culto/Turno', type: 'select', required: false, options: ['Manha', 'Tarde', 'Noite'] },
          { name: 'observacoes', label: 'Observacoes', type: 'textarea', required: false },
        ],
      },
      transitions: [
        {
          action: 'iniciar_analise',
          label: 'Enviar para analise',
          from: 'pendente',
          to: 'em_analise',
          roles: ['OPERADOR', 'SUPERVISOR', 'SUPERINTENDENTE'],
          next_role: 'SUPERVISOR',
        },
        {
          action: 'aprovar',
          label: 'Aprovar',
          from: 'em_analise',
          to: 'aprovado',
          roles: ['SUPERVISOR', 'SUPERINTENDENTE', 'ADMINISTRADOR'],
          next_role: 'OPERADOR',
          require_note: false,
        },
        {
          action: 'rejeitar',
          label: 'Rejeitar',
          from: 'em_analise',
          to: 'rejeitado',
          roles: ['SUPERVISOR', 'SUPERINTENDENTE', 'ADMINISTRADOR'],
          require_note: true,
        },
        {
          action: 'concluir',
          label: 'Concluir',
          from: 'aprovado',
          to: 'concluido',
          roles: ['OPERADOR', 'ADMINISTRADOR'],
        },
      ],
    },
  },
  baseApprovalFlow('Consagracao de Obreiros'),
  baseApprovalFlow('Carta Ministerial'),
  baseApprovalFlow('Solicitacao de Desligamento'),
  baseApprovalFlow('Agenda/Gabinete Pastoral'),
];
