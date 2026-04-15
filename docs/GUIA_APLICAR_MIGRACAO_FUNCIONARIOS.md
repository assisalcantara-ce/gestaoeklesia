# ✅ Como Aplicar a Migração Funcionários no Supabase

## 📍 Localização do SQL Pronto

O arquivo SQL completo está em:  
→ `docs/SQL_MIGRACAO_FUNCIONARIOS.sql`

---

## 🚀 Passo-a-Passo

### 1️⃣ Acesse o Supabase Dashboard
- Vá para [https://app.supabase.com](https://app.supabase.com)
- Selecione seu projeto **gestaoeklesia**

### 2️⃣ Abra o SQL Editor
- Clique em **"SQL Editor"** (menu lateral esquerdo)
- Ou acesse: `https://app.supabase.com/project/[PROJECT_ID]/sql/new`

### 3️⃣ Copie o SQL
- Abra o arquivo: `docs/SQL_MIGRACAO_FUNCIONARIOS.sql`
- Selecione todo o conteúdo (Ctrl+A)
- Copie (Ctrl+C)

### 4️⃣ Cole no Editor
- Cole no Supabase SQL Editor (Ctrl+V)
- Você verá o SQL completo com comentários

### 5️⃣ Execute a Migração
- Clique em **"Run"** (botão azul no canto superior direito)
- Ou pressione **Ctrl+Enter**

### 6️⃣ Aguarde a Conclusão
- Você verá mensagens de sucesso:
  ```
  ✓ CREATE TABLE
  ✓ CREATE TRIGGER
  ✓ CREATE INDEX (x4)
  ✓ ALTER TABLE
  ✓ CREATE POLICY (x4)
  ✓ GRANT
  ✓ CREATE VIEW
  ```

---

## ✨ O Que Será Criado

### Tabela: `employees`
**24 campos** para gerenciar funcionários:
- Dados básicos (grupo, função, data admissão)
- Contato (email, telefone, WhatsApp)
- Documentação (RG, endereço, CEP)
- Bancário (banco, agência, conta, PIX)
- Status (ATIVO/INATIVO)

### View: `employees_with_member_info`
Junta dados de funcionários com membros vinculados:
- Nome do membro
- CPF
- Telefone
- Data de nascimento

### Índices (4x)
Para otimizar queries por:
- Ministry ID
- Member ID
- Status
- Grupo

### RLS Policies (4x)
Segurança multi-tenant com SELECT, INSERT, UPDATE, DELETE

### Trigger
Atualização automática de `updated_at`

---

## 🔍 Verificação Pós-Migração

### Para confirmar que tudo funcionou:

#### 1. Verifique a tabela
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'employees';
```
Deve retornar: `employees`

#### 2. Verifique os índices
```sql
SELECT indexname FROM pg_indexes 
WHERE tablename = 'employees';
```
Deve retornar 4 índices

#### 3. Verifique as políticas RLS
```sql
SELECT policyname FROM pg_policies 
WHERE tablename = 'employees';
```
Deve retornar 4 policies

#### 4. Verifique a view
```sql
SELECT EXISTS (
  SELECT 1 FROM information_schema.views 
  WHERE table_schema = 'public' AND table_name = 'employees_with_member_info'
) as view_exists;
```
Deve retornar: `true`

---

## 🛠️ Solução de Problemas

### ❌ Erro: "Erro na dependência - ministries não existe"
**Causa:** Tabelas pré-requisitadas não existem  
**Solução:** Executar migrações anteriores primeiro:
1. `modulo_ministries.sql`
2. `modulo_members.sql`
3. Depois `SQL_MIGRACAO_FUNCIONARIOS.sql`

### ❌ Erro: "RLS policy violado"
**Causa:** Tentar acessar dados sem ter permissão  
**Solução:** Verificar se o usuário é membro do ministério em `ministry_users`

### ❌ Erro: "duplicate table"
**Causa:** Tabela já existe  
**Solução:** Seguro usar `IF NOT EXISTS` - executar novamente é idempotente

### ✅ Tudo OK?
Você deverá ver apenas mensagens de sucesso no console do Supabase!

---

## 📊 Próximos Passos

1. ✅ Migração aplicada (você aqui)
2. ⏭️ Verificar se a aplicação consegue acessar `/api/v1/employees`
3. ⏭️ Acessar `http://localhost:3000/secretaria/funcionarios`
4. ⏭️ Testar CRUD (criar, ler, atualizar, deletar funcionários)

---

## 📝 Notas Importantes

- **Idempotente:** Pode executar múltiplas vezes sem problemas
- **Drop + Create:** Usa `DROP IF EXISTS` antes de criar
- **Segurança:** RLS policies inclusos (multi-tenant safe)
- **Permissions:** Usuários autenticados têm acesso via RLS

---

## 🎯 Pronto!

A migração está pronta para ser aplicada. Se tiver dúvidas, execute passo-a-passo e verifique cada etapa! 🚀
