-- Migration: criar tabela certificados_templates
-- Execute este SQL no SQL Editor do Supabase

create table if not exists public.certificados_templates (
  id              uuid primary key default gen_random_uuid(),
  ministry_id     uuid not null references public.ministries(id) on delete cascade,
  template_key    text not null,
  name            text not null,
  description     text,
  template_data   jsonb not null default '{}'::jsonb,
  preview_url     text,
  is_default      boolean not null default false,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint certificados_templates_ministry_key unique (ministry_id, template_key)
);

-- Índice para busca por ministry
create index if not exists idx_certificados_templates_ministry
  on public.certificados_templates (ministry_id);

-- Trigger para atualizar updated_at automaticamente
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_certificados_templates_updated_at on public.certificados_templates;
create trigger trg_certificados_templates_updated_at
  before update on public.certificados_templates
  for each row execute function public.set_updated_at();

-- RLS: habilitar e criar politicas
alter table public.certificados_templates enable row level security;

-- SELECT: membros do ministerio
create policy "certificados_templates_select"
  on public.certificados_templates for select
  using (
    ministry_id in (
      select ministry_id from public.ministry_users where user_id = auth.uid()
      union
      select id from public.ministries where user_id = auth.uid()
    )
  );

-- INSERT: membros do ministerio
create policy "certificados_templates_insert"
  on public.certificados_templates for insert
  with check (
    ministry_id in (
      select ministry_id from public.ministry_users where user_id = auth.uid()
      union
      select id from public.ministries where user_id = auth.uid()
    )
  );

-- UPDATE: membros do ministerio
create policy "certificados_templates_update"
  on public.certificados_templates for update
  using (
    ministry_id in (
      select ministry_id from public.ministry_users where user_id = auth.uid()
      union
      select id from public.ministries where user_id = auth.uid()
    )
  );

-- DELETE: membros do ministerio
create policy "certificados_templates_delete"
  on public.certificados_templates for delete
  using (
    ministry_id in (
      select ministry_id from public.ministry_users where user_id = auth.uid()
      union
      select id from public.ministries where user_id = auth.uid()
    )
  );
