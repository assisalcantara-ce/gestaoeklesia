# ⚙️ Setup das Métricas Reais do Supabase

## Opção 1: Criar Função RPC (Recomendado)

### ⚠️ IMPORTANTE: Copie APENAS o SQL, SEM as backticks!

1. Acesse o SQL Editor do seu Supabase:
   - URL: `https://app.supabase.com/project/drzafeksbddnoknvznnd/sql/new`

2. Abra o arquivo `setup-get-tables-info.sql` da raiz do projeto

3. Copie TODO o conteúdo do arquivo (é SQL puro, sem markdown)

4. Cole no editor do Supabase

5. Clique em "RUN"

### SQL a ser executado:

```sql
CREATE OR REPLACE FUNCTION public.get_tables_info()
RETURNS TABLE (
  table_name text,
  row_count bigint,
  table_size bigint
) AS $$
SELECT
  t.tablename::text,
  (SELECT n_live_tup FROM pg_stat_user_tables WHERE relname = t.tablename)::bigint as row_count,
  pg_total_relation_size(quote_ident(t.tablename))::bigint as table_size
FROM pg_tables t
WHERE t.schemaname = 'public'
ORDER BY pg_total_relation_size(quote_ident(t.tablename)) DESC;
$$ LANGUAGE sql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_tables_info() TO authenticated, anon;
```

---

## Opção 2: Sem RPC (Fallback Automático)

Se não quiser criar a RPC, o sistema já tem um fallback que:
- Consulta apenas a tabela `admin_users`
- Estima o tamanho (~2KB por registro)
- Funciona bem para começar

---

## Status Atual

✅ Endpoint criado: `/api/admin/supabase-metrics`
✅ Página de métricas criada: `/admin/configuracoes/supabase`
⏳ RPC aguardando setup (opcional)

---

## Como Testar

1. Faça login com:
   - Email: `admin@gestaoeklesia.local`
  - Senha: (não registrar em .md)

2. Vá para: **Configurações → Supabase**

3. Veja as métricas em tempo real!

---

## Dados Mostrados

- 📊 **Tamanho Total**: Espaço total utilizado
- 📈 **Contagem de Registros**: Total de linhas
- 📋 **Por Tabela**: Detalhe de cada tabela
- ⚠️ **Alertas**: Quando uso > 80%
- 🎯 **Recomendações**: Sugestões de upgrade

