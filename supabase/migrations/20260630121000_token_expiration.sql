-- Migração: Adicionar campo expires_at na tabela relatorio_espiritual_tokens
ALTER TABLE public.relatorio_espiritual_tokens
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours');
