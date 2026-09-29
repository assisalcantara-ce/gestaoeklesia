-- Atualização da restrição de tipos de eventos para incluir novos tipos (conferência, palestra, congresso)
ALTER TABLE public.eventos DROP CONSTRAINT IF EXISTS eventos_tipo_valido;

ALTER TABLE public.eventos ADD CONSTRAINT eventos_tipo_valido CHECK (
  tipo IN (
    'culto_especial',
    'congresso',
    'conferencia',
    'palestra',
    'retiro',
    'evangelismo',
    'treinamento',
    'social',
    'outro'
  )
);
