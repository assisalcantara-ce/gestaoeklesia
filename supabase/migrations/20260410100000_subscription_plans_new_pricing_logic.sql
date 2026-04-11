-- ============================================================
-- NOVA LOGICA DE PLANOS (ABR/2026)
-- Planos: Basic, Starter, Intermediario, Profissional
-- Regras:
-- - max_members = 0 => ilimitado
-- - max_ministerios = igrejas inclusas
-- - additional_church_monthly_fee = taxa por igreja adicional
-- - additional_admin_users_per_church = +admins por igreja adicional
-- ============================================================

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS additional_church_monthly_fee DECIMAL(10,2) DEFAULT 50;

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS additional_admin_users_per_church INTEGER DEFAULT 2;

UPDATE public.subscription_plans
SET
  additional_church_monthly_fee = COALESCE(additional_church_monthly_fee, 50),
  additional_admin_users_per_church = COALESCE(additional_admin_users_per_church, 2)
WHERE true;

INSERT INTO public.subscription_plans (
  name,
  slug,
  description,
  price_monthly,
  price_annually,
  setup_fee,
  max_users,
  max_members,
  max_ministerios,
  additional_church_monthly_fee,
  additional_admin_users_per_church,
  max_divisao1,
  max_divisao2,
  max_divisao3,
  has_api_access,
  has_custom_domain,
  has_advanced_reports,
  has_priority_support,
  has_white_label,
  has_automation,
  has_modulo_financeiro,
  has_modulo_eventos,
  has_modulo_reunioes,
  is_active,
  display_order
)
VALUES
(
  'Basic',
  'basic',
  'Plano Basic: 1 igreja inclusa e taxa de R$ 50,00/mês por igreja adicional (+2 admins por igreja extra).',
  150,
  0,
  0,
  2,
  300,
  1,
  50,
  2,
  5,
  0,
  -1,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  true,
  1
),
(
  'Starter',
  'starter',
  'Plano Starter: 5 igrejas inclusas e taxa de R$ 50,00/mês por igreja adicional (+2 admins por igreja extra).',
  300,
  0,
  0,
  10,
  0,
  5,
  50,
  2,
  25,
  3,
  -1,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  true,
  2
),
(
  'Intermediário',
  'intermediario',
  'Plano Intermediário: 10 igrejas inclusas e taxa de R$ 50,00/mês por igreja adicional (+2 admins por igreja extra).',
  600,
  0,
  0,
  20,
  0,
  10,
  50,
  2,
  50,
  10,
  -1,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  true,
  3
),
(
  'Profissional',
  'profissional',
  'Plano Profissional: 10 igrejas inclusas e taxa de R$ 50,00/mês por igreja adicional (+2 admins por igreja extra). Recursos e módulos serão diferenciados na próxima etapa.',
  1000,
  0,
  0,
  20,
  0,
  10,
  50,
  2,
  100,
  20,
  -1,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  true,
  4
)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_annually = EXCLUDED.price_annually,
  setup_fee = EXCLUDED.setup_fee,
  max_users = EXCLUDED.max_users,
  max_members = EXCLUDED.max_members,
  max_ministerios = EXCLUDED.max_ministerios,
  additional_church_monthly_fee = EXCLUDED.additional_church_monthly_fee,
  additional_admin_users_per_church = EXCLUDED.additional_admin_users_per_church,
  max_divisao1 = EXCLUDED.max_divisao1,
  max_divisao2 = EXCLUDED.max_divisao2,
  max_divisao3 = EXCLUDED.max_divisao3,
  has_api_access = EXCLUDED.has_api_access,
  has_custom_domain = EXCLUDED.has_custom_domain,
  has_advanced_reports = EXCLUDED.has_advanced_reports,
  has_priority_support = EXCLUDED.has_priority_support,
  has_white_label = EXCLUDED.has_white_label,
  has_automation = EXCLUDED.has_automation,
  has_modulo_financeiro = EXCLUDED.has_modulo_financeiro,
  has_modulo_eventos = EXCLUDED.has_modulo_eventos,
  has_modulo_reunioes = EXCLUDED.has_modulo_reunioes,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP;

UPDATE public.subscription_plans
SET is_active = false, updated_at = CURRENT_TIMESTAMP
WHERE slug NOT IN ('basic', 'starter', 'intermediario', 'profissional');
