-- Verificação rápida de multi-tenant + RLS
-- Execute no Supabase Dashboard → SQL Editor

begin;

-- 1) Contexto: quantos tenants existem?
select
  (select count(*) from public.ministries) as ministries_count,
  (select count(*) from public.ministry_users) as ministry_users_count;

-- 2) `ministry_id` existe onde esperamos?
with expected(table_name) as (
  values
    ('supervisoes'),
    ('congregacoes'),
    ('campos')
)
select
  e.table_name,
  exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = e.table_name
      and c.column_name = 'ministry_id'
  ) as has_ministry_id
from expected e
order by e.table_name;

-- 3) RLS está habilitado?
with expected(table_name) as (
  values
    ('ministries'),
    ('ministry_users'),
    ('members'),
    ('membros'),
    ('supervisoes'),
    ('congregacoes'),
    ('campos')
)
select
  e.table_name,
  c.oid is not null as table_exists,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from expected e
left join pg_class c on c.relname = e.table_name
left join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
order by e.table_name;

-- 4) Policies existentes (public)
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'ministries',
    'ministry_users',
    'members',
    'membros',
    'supervisoes',
    'congregacoes',
    'campos'
  )
order by tablename, policyname;

-- 5) Checagem específica: policy SELECT em ministry_users não pode ser recursiva
-- Esperado: USING (user_id = auth.uid()) (ou equivalente direto)
select
  policyname,
  cmd,
  qual
from pg_policies
where schemaname = 'public'
  and tablename = 'ministry_users'
  and cmd in ('SELECT', 'ALL')
order by policyname;

-- 6) Destaque: policies SELECT permissivas em tabelas sensíveis
-- Observação: policies permissivas combinam por OR. Se existir alguma policy permissiva
-- “larga” sem `ministry_id`, isso pode abrir vazamento cross-tenant.
select
  tablename,
  policyname,
  permissive,
  cmd,
  qual
from pg_policies
where schemaname = 'public'
  and cmd = 'SELECT'
  and tablename in ('congregacoes', 'members', 'membros')
order by tablename, policyname;

rollback;
