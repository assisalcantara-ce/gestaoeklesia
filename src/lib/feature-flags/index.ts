/**
 * Arquitetura Oficial de Feature Flags — Gestão Eklésia SaaS
 * 
 * Desacopla o controle de licenciamento do nome (slug) dos planos.
 * Toda funcionalidade premium é controlada por uma chave de Feature Flag.
 */

export type FeatureFlag =
  | 'digital_collection'        // Arrecadação Digital (PIX/QR Code/Links)
  | 'financial_module'          // Tesouraria / Financeiro Base
  | 'advanced_finance'          // Financeiro Avançado (Presidência / Consolidado)
  | 'events_module'             // Módulo de Eventos
  | 'meetings_module'           // Módulo de Reuniões
  | 'agenda_module'             // Agenda do Ministério
  | 'student_portal'            // Portal do Aluno (EBD)
  | 'teacher_portal'            // Portal do Professor (EBD)
  | 'mobile_app'                // Aplicativo Mobile
  | 'whatsapp_integration'      // WhatsApp Oficial
  | 'advanced_bi'               // BI Avançado & Relatórios Executivos
  | 'integrations'              // Integrações & APIs
  | 'ai_assistant'              // Assistente de IA
  | 'digital_signature'         // Assinatura Digital
  | 'ead_courses'               // Cursos EAD
  | 'premium_events';           // Eventos Premium

export interface FeatureMetadata {
  key: FeatureFlag;
  label: string;
  description: string;
  minTier: 'basic' | 'intermediate' | 'professional' | 'expert';
}

/**
 * Catálogo central de metadados das Features da Plataforma.
 */
export const FEATURE_CATALOG: Record<FeatureFlag, FeatureMetadata> = {
  digital_collection: {
    key: 'digital_collection',
    label: 'Arrecadação Digital',
    description: 'Links de pagamento PIX, QR Codes e conciliação bancária automática.',
    minTier: 'intermediate',
  },
  financial_module: {
    key: 'financial_module',
    label: 'Módulo Financeiro & Tesouraria',
    description: 'Gestão de caixas, lançamentos e relatórios financeiros básicos.',
    minTier: 'basic',
  },
  advanced_finance: {
    key: 'advanced_finance',
    label: 'Financeiro Avançado & Consolidado',
    description: 'Prestação de contas corporativa, auditoria e consolidado de divisões.',
    minTier: 'professional',
  },
  events_module: {
    key: 'events_module',
    label: 'Módulo de Eventos',
    description: 'Gestão de inscrições, lotes de ingressos e check-in.',
    minTier: 'professional',
  },
  meetings_module: {
    key: 'meetings_module',
    label: 'Módulo de Reuniões',
    description: 'Atas de reuniões, agendamentos e quórum.',
    minTier: 'basic',
  },
  agenda_module: {
    key: 'agenda_module',
    label: 'Agenda do Ministério',
    description: 'Planejamento ministerial anual e calendário de atividades.',
    minTier: 'intermediate',
  },
  student_portal: {
    key: 'student_portal',
    label: 'Portal do Aluno',
    description: 'Acesso dos alunos aos conteúdos e presença da Escola Bíblica.',
    minTier: 'intermediate',
  },
  teacher_portal: {
    key: 'teacher_portal',
    label: 'Portal do Professor',
    description: 'Lançamento de chamadas e gestão de turmas da EBD.',
    minTier: 'intermediate',
  },
  mobile_app: {
    key: 'mobile_app',
    label: 'Aplicativo Mobile',
    description: 'Acesso nativo via aplicativo para membros e liderança.',
    minTier: 'professional',
  },
  whatsapp_integration: {
    key: 'whatsapp_integration',
    label: 'Integração WhatsApp Oficial',
    description: 'Notificações automáticas e comunicação via WhatsApp.',
    minTier: 'professional',
  },
  advanced_bi: {
    key: 'advanced_bi',
    label: 'BI Avançado & Analytics',
    description: 'Painéis executivos e análises preditivas de dados.',
    minTier: 'expert',
  },
  integrations: {
    key: 'integrations',
    label: 'APIs & Webhooks de Integração',
    description: 'Acesso a APIs públicas e webhooks para sistemas externos.',
    minTier: 'professional',
  },
  ai_assistant: {
    key: 'ai_assistant',
    label: 'Assistente de IA',
    description: 'Inteligência Artificial para suporte ao gerenciamento da igreja.',
    minTier: 'expert',
  },
  digital_signature: {
    key: 'digital_signature',
    label: 'Assinatura Digital',
    description: 'Assinatura eletrônica de documentos e cartas ministeriais.',
    minTier: 'expert',
  },
  ead_courses: {
    key: 'ead_courses',
    label: 'Cursos EAD & Treinamento',
    description: 'Plataforma de ensino a distância e capacitação de obreiros.',
    minTier: 'expert',
  },
  premium_events: {
    key: 'premium_events',
    label: 'Eventos Premium & Grandes Eixos',
    description: 'Suporte a convenções regionais e eventos de grande porte.',
    minTier: 'expert',
  },
};

/** Mapeamento de apelidos em português para compatibilidade com a tabela subscription_plans.modulos */
const ALIAS_MAP: Record<string, FeatureFlag> = {
  'arrecadação digital': 'digital_collection',
  'arrecadacao digital': 'digital_collection',
  'módulo financeiro': 'financial_module',
  'tesouraria': 'financial_module',
  'financeiro avançado': 'advanced_finance',
  'módulo de eventos': 'events_module',
  'eventos': 'events_module',
  'reuniões': 'meetings_module',
  'agenda do ministério': 'agenda_module',
  'agenda': 'agenda_module',
  'planejamento ministerial': 'agenda_module',
  'portal do aluno': 'student_portal',
  'portal do professor': 'teacher_portal',
  'aplicativo mobile': 'mobile_app',
  'whatsapp oficial': 'whatsapp_integration',
  'bi avançado': 'advanced_bi',
  'integrações': 'integrations',
  'assistente de ia': 'ai_assistant',
  'assinatura digital': 'digital_signature',
  'cursos ead': 'ead_courses',
  'eventos premium': 'premium_events',
};

/**
 * Determina o nível de capacidade do plano (Tier 0 a 3) sem acoplamento a nomes fixos de slugs.
 */
export function getPlanTierRank(plan?: any): number {
  if (!plan) return 0; // Básico por padrão se nulo

  // Se o objeto possui flags booleanas diretas ou modulos explícitos
  const modulosList: string[] = Array.isArray(plan.modulos)
    ? plan.modulos.map((m: string) => String(m).toLowerCase().trim())
    : [];

  const price = Number(plan.price_monthly ?? 0);
  const maxUsers = Number(plan.max_users ?? 0);
  const slug = String(plan.slug ?? plan.plan ?? '').toLowerCase().trim();

  // Tier 3: Expert / Enterprise / Suporte a grandes igrejas
  if (price >= 900 || maxUsers >= 500 || slug.includes('expert') || slug.includes('enterprise')) {
    return 3;
  }

  // Tier 2: Profissional / Expansão
  if (price >= 400 || maxUsers >= 20 || slug.includes('profissional') || slug.includes('professional') || plan.has_modulo_eventos) {
    return 2;
  }

  // Tier 1: Intermediário
  if (price >= 200 || maxUsers >= 8 || slug.includes('intermediar') || modulosList.includes('arrecadação digital') || modulosList.includes('arrecadacao digital')) {
    return 1;
  }

  // Tier 0: Básico / Starter
  return 0;
}

/**
 * Resolve todas as Feature Flags ativas para um plano.
 * Retorna um mapa completo Record<FeatureFlag, boolean> resolvido em O(1).
 */
export function resolvePlanFeatures(plan?: any): Record<FeatureFlag, boolean> {
  const tierRank = getPlanTierRank(plan);

  // Inicializa mapa base com base no Tier do Plano
  const resolved: Record<FeatureFlag, boolean> = {
    financial_module:     tierRank >= 0,
    meetings_module:      tierRank >= 0,
    digital_collection:   tierRank >= 1,
    agenda_module:        tierRank >= 1,
    student_portal:       tierRank >= 1,
    teacher_portal:       tierRank >= 1,
    advanced_finance:     tierRank >= 2,
    events_module:        tierRank >= 2,
    mobile_app:           tierRank >= 2,
    whatsapp_integration: tierRank >= 2,
    integrations:         tierRank >= 2,
    advanced_bi:          tierRank >= 3,
    ai_assistant:         tierRank >= 3,
    digital_signature:    tierRank >= 3,
    ead_courses:          tierRank >= 3,
    premium_events:       tierRank >= 3,
  };

  if (!plan) return resolved;

  // 1. Sobrescritas por colunas explícitas no banco (se presentes)
  if (typeof plan.has_modulo_financeiro === 'boolean') resolved.financial_module = plan.has_modulo_financeiro;
  if (typeof plan.has_modulo_financeiro_avancado === 'boolean') resolved.advanced_finance = plan.has_modulo_financeiro_avancado;
  if (typeof plan.has_modulo_eventos === 'boolean') resolved.events_module = plan.has_modulo_eventos;
  if (typeof plan.has_modulo_reunioes === 'boolean') resolved.meetings_module = plan.has_modulo_reunioes;

  // 2. Sobrescritas por array de módulos customizados (modulos: string[])
  const modulosList = Array.isArray(plan.modulos) ? plan.modulos : [];
  for (const item of modulosList) {
    const raw = String(item).trim();
    const lower = raw.toLowerCase();

    // Se for diretamente o nome da Feature Flag
    if (lower in resolved) {
      resolved[lower as FeatureFlag] = true;
    }
    // Se for um apelido em português cadastrado
    if (lower in ALIAS_MAP) {
      resolved[ALIAS_MAP[lower]] = true;
    }
  }

  return resolved;
}

/**
 * Verifica se uma Feature Flag específica está habilitada para o plano informado.
 */
export function isFeatureEnabled(plan: any, feature: FeatureFlag): boolean {
  const flags = resolvePlanFeatures(plan);
  return flags[feature] ?? false;
}
