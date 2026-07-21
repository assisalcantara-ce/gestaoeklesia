/**
 * Tipos de interação suportados para registro no CRM Comercial
 */
export const InteractionTypes = [
  'Ligação',
  'WhatsApp',
  'E-mail',
  'Reunião',
  'Visita',
  'Outro'
] as const;

export type InteractionType = typeof InteractionTypes[number];
