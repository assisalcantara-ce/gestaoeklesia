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
  | 'ebd_module'                // Escola Bíblica Dominical (EBD) completa
  | 'missions_module'           // Módulo de Missões
  | 'employees_module'          // Gestão de Funcionários & RH
  | 'ordination_module'         // Comissão & Consagração de Obreiros
  | 'kids_module'               // Área Kids & Apresentação de Crianças
  | 'presidency_module'         // Módulo Presidência & Visão Corporativa
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
  minTier: 'basic' | 'starter' | 'intermediate' | 'professional' | 'expert';
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
    minTier: 'intermediate',
  },
  agenda_module: {
    key: 'agenda_module',
    label: 'Agenda do Ministério',
    description: 'Planejamento ministerial anual e calendário de atividades.',
    minTier: 'starter',
  },
  ebd_module: {
    key: 'ebd_module',
    label: 'Escola Bíblica Dominical (EBD)',
    description: 'Gestão completa da EBD: turmas, chamada, alunos, professores, relatórios e certificados.',
    minTier: 'starter',
  },
  missions_module: {
    key: 'missions_module',
    label: 'Módulo de Missões',
    description: 'Gestão de projetos missionários, missionários sustentados, eventos e arrecadações.',
    minTier: 'starter',
  },
  employees_module: {
    key: 'employees_module',
    label: 'Gestão de Funcionários & RH',
    description: 'Cadastro de funcionários, funções, controle de acesso e folha de pagamentos.',
    minTier: 'intermediate',
  },
  ordination_module: {
    key: 'ordination_module',
    label: 'Comissão & Consagração de Obreiros',
    description: 'Gestão de comissões, processos de consagração, ordenação e filiação ministerial.',
    minTier: 'intermediate',
  },
  kids_module: {
    key: 'kids_module',
    label: 'Área Kids & Apresentação de Crianças',
    description: 'Gestão infantil, registros e certificados de apresentação de crianças.',
    minTier: 'intermediate',
  },
  presidency_module: {
    key: 'presidency_module',
    label: 'Módulo Presidência & Visão Corporativa',
    description: 'Gestão da presidência, consolidados regionais, conselho fiscal e atas da diretoria.',
    minTier: 'professional',
  },
  student_portal: {
    key: 'student_portal',
    label: 'Portal do Aluno',
    description: 'Acesso dos alunos aos conteúdos e presença da Escola Bíblica.',
    minTier: 'starter',
  },
  teacher_portal: {
    key: 'teacher_portal',
    label: 'Portal do Professor',
    description: 'Lançamento de chamadas e gestão de turmas da EBD.',
    minTier: 'starter',
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
  'agenda do ministério': 'agenda_module',
  'agenda': 'agenda_module',
  'planejamento ministerial': 'agenda_module',
  'ebd': 'ebd_module',
  'escola bíblica': 'ebd_module',
  'escola biblica': 'ebd_module',
  'escola bíblica dominical': 'ebd_module',
  'escola biblica dominical': 'ebd_module',
  'missões': 'missions_module',
  'missoes': 'missions_module',
  'módulo de missões': 'missions_module',
  'modulo de missoes': 'missions_module',
  'funcionários': 'employees_module',
  'funcionarios': 'employees_module',
  'gestão de funcionários': 'employees_module',
  'rh': 'employees_module',
  'comissão': 'ordination_module',
  'comissao': 'ordination_module',
  'consagração': 'ordination_module',
  'consagracao': 'ordination_module',
  'comissão de consagração': 'ordination_module',
  'ordenação': 'ordination_module',
  'ordenacao': 'ordination_module',
  'área kids': 'kids_module',
  'area kids': 'kids_module',
  'kids': 'kids_module',
  'apresentação de crianças': 'kids_module',
  'apresentacao de criancas': 'kids_module',
  'crianças': 'kids_module',
  'criancas': 'kids_module',
  'reuniões': 'meetings_module',
  'reunioes': 'meetings_module',
  'módulo de reuniões': 'meetings_module',
  'modulo de reunioes': 'meetings_module',
  'atas de reuniões': 'meetings_module',
  'atas de reunioes': 'meetings_module',
  'presidência': 'presidency_module',
  'presidencia': 'presidency_module',
  'módulo presidência': 'presidency_module',
  'modulo presidencia': 'presidency_module',
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
 * Determina o nível de capacidade do plano (Tier 0 a 4) sem acoplamento a nomes fixos de slugs.
 */
export function getPlanTierRank(plan?: any): number {
  if (!plan) return 0; // Básico por padrão se nulo

  const modulosList: string[] = Array.isArray(plan.modulos)
    ? plan.modulos.map((m: string) => String(m).toLowerCase().trim())
    : [];

  const price = Number(plan.price_monthly ?? 0);
  const maxUsers = Number(plan.max_users ?? 0);
  const slug = String(plan.slug ?? plan.plan ?? '').toLowerCase().trim();

  // Tier 4: Expert / Enterprise / Suporte a grandes igrejas
  if (price >= 900 || maxUsers >= 500 || slug.includes('expert') || slug.includes('enterprise')) {
    return 4;
  }

  // Tier 3: Profissional / Expansão
  if (
    price >= 400 ||
    maxUsers >= 20 ||
    slug.includes('profissional') ||
    slug.includes('professional') ||
    plan.has_modulo_eventos ||
    modulosList.includes('presidência') ||
    modulosList.includes('presidencia')
  ) {
    return 3;
  }

  // Tier 2: Intermediário
  if (
    price >= 200 ||
    maxUsers >= 8 ||
    slug.includes('intermediar') ||
    modulosList.includes('arrecadação digital') ||
    modulosList.includes('arrecadacao digital') ||
    modulosList.includes('funcionários') ||
    modulosList.includes('funcionarios') ||
    modulosList.includes('comissão') ||
    modulosList.includes('comissao') ||
    modulosList.includes('consagração') ||
    modulosList.includes('consagracao') ||
    modulosList.includes('área kids') ||
    modulosList.includes('area kids') ||
    modulosList.includes('kids') ||
    modulosList.includes('apresentação de crianças') ||
    modulosList.includes('apresentacao de criancas') ||
    modulosList.includes('reuniões') ||
    modulosList.includes('reunioes')
  ) {
    return 2;
  }

  // Tier 1: Starter
  if (price >= 100 || maxUsers >= 3 || slug.includes('starter') || modulosList.includes('agenda') || modulosList.includes('ebd') || modulosList.includes('escola bíblica') || modulosList.includes('missões') || modulosList.includes('missoes')) {
    return 1;
  }

  // Tier 0: Básico
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
    meetings_module:      tierRank >= 2, // Intermediário e superiores
    agenda_module:        tierRank >= 1, // Starter e superiores
    ebd_module:           tierRank >= 1, // Starter e superiores
    missions_module:      tierRank >= 1, // Starter e superiores
    student_portal:       tierRank >= 1,
    teacher_portal:       tierRank >= 1,
    digital_collection:   tierRank >= 2, // Intermediário e superiores
    employees_module:     tierRank >= 2, // Intermediário e superiores
    ordination_module:    tierRank >= 2, // Intermediário e superiores
    kids_module:          tierRank >= 2, // Intermediário e superiores
    presidency_module:    tierRank >= 3, // Profissional e superiores (Básico, Starter e Intermediário = false)
    advanced_finance:     tierRank >= 3,
    events_module:        tierRank >= 3,
    mobile_app:           tierRank >= 3,
    whatsapp_integration: tierRank >= 3,
    integrations:         tierRank >= 3,
    advanced_bi:          tierRank >= 4,
    ai_assistant:         tierRank >= 4,
    digital_signature:    tierRank >= 4,
    ead_courses:          tierRank >= 4,
    premium_events:       tierRank >= 4,
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
