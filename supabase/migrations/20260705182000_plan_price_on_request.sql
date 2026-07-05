-- Migration para adicionar a opção de Preço sob consulta (Consulte-nos) nos Planos de Assinatura
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS is_price_on_request BOOLEAN DEFAULT false;
