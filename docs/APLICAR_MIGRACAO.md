# 🚀 Como Aplicar a Migração SQL

## Opção 1: Automática com Node.js (Recomendado) ⭐

### Pré-requisitos:
- Ter `.env` com `SUPABASE_SERVICE_ROLE_KEY`
- Node.js instalado

### Executar:
```bash
node apply-migration.js
```

**Pronto!** O script vai:
1. ✓ Conectar ao Supabase
2. ✓ Ler o arquivo SQL
3. ✓ Executar a migração
4. ✓ Verificar se funcionou

---

## Opção 2: Manual no Dashboard (5 minutos)

### Passo 1: Abrir SQL Editor
```
https://supabase.com/dashboard
→ Seu Projeto
→ SQL Editor
→ New Query
```

### Passo 2: Copiar SQL
- Abra: `supabase/migrations/20260105_attendance_management_schema.sql`
- Ctrl+A (Selecionar tudo)
- Ctrl+C (Copiar)

### Passo 3: Colar no Supabase
- Cole no SQL Editor do Supabase
- Veja a sintaxe ficar colorida

### Passo 4: Executar
- Clique botão **RUN** (ou Ctrl+Enter)
- Aguarde a execução (2-5 segundos)

### Passo 5: Verificar
```sql
-- Executar no editor para confirmar:
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'attendance_status', 
  'attendance_history', 
  'test_credentials', 
  'generated_contracts'
);
```

Se mostrar 4 linhas = ✅ Sucesso!

---

## Opção 3: Via CLI Supabase

### Pré-requisito:
```bash
npm install -g supabase
```

### Executar:
```bash
supabase db push
```

---

## ❌ Erro? Tente Isso:

### "SUPABASE_SERVICE_ROLE_KEY não encontrada"
```bash
# Criar arquivo .env na raiz do projeto
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<SUPABASE_SERVICE_ROLE_KEY>
```

### "Permissão Negada"
- Chave deve ser `SERVICE_ROLE_KEY`, não `ANON_KEY`
- Verificar em: Supabase → Configurações → API Keys

### "Arquivo não encontrado"
- Verificar caminho: `supabase/migrations/20260105_attendance_management_schema.sql`
- Usar caminho absoluto se necessário

---

## ✅ Como Confirmar que Funcionou

### Verificar no Supabase Dashboard:
1. Vá para **Table Editor**
2. Procure por: `attendance_status`, `attendance_history`, etc
3. Deve mostrar 4 tabelas novas

### Ou execute este SQL:
```sql
-- Listar todas as tabelas públicas
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
```

---

## 🎉 Próximo Passo

Depois que a migração rodar (via qualquer opção):

```bash
npm run dev
```

Depois acesse:
```
http://localhost:3000/admin/atendimento
```

Pronto! ✨
