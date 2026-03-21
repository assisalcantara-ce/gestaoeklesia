-- Verificar estrutura da tabela members
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'members'
ORDER BY ordinal_position;