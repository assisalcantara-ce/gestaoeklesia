-- ============================================
-- TICKETS DA LANDING PAGE (SUPORTE COMERCIAL)
-- ============================================

CREATE TABLE IF NOT EXISTS public.support_tickets_landing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(20) UNIQUE NOT NULL,
  institution_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  whatsapp VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'open',
  priority VARCHAR(50) DEFAULT 'medium',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_landing_status ON public.support_tickets_landing(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_landing_priority ON public.support_tickets_landing(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_landing_created_at ON public.support_tickets_landing(created_at);

ALTER TABLE public.support_tickets_landing ENABLE ROW LEVEL SECURITY;

-- Apenas service role/admin podem acessar via API server-side
