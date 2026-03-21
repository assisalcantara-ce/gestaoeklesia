# 🎯 SISTEMA DE TRIAL (7 DIAS) - Guia de Implementação

## ✅ O QUE FOI CRIADO

### 1️⃣ **Endpoint de Cadastro** (`/api/v1/signup`)
- ✅ Validação completa de campos
- ✅ Cria usuário no Supabase Auth
- ✅ Salva pré-cadastro no banco
- ✅ Define expiração de 7 dias
- ✅ Cria notificação para admin

### 2️⃣ **Tabelas no Supabase**
- `pre_registrations` - Armazena pré-cadastros com período de trial
- `admin_notifications` - Notificações para o painel admin

### 3️⃣ **Componente de Notificações** (AdminNotificationBell)
- ✅ Campainha com contador
- ✅ Painel de notificações
- ✅ Atualização automática a cada 10s
- ✅ Marca como lido

### 4️⃣ **Widget de Pré-Cadastros** (TrialSignupsWidget)
- ✅ Mostra último 10 pré-cadastros
- ✅ Status com cores (Ativo, Expirando, Expirado, Convertido)
- ✅ Dias restantes

---

## 🚀 INSTALAÇÃO

### Passo 1: Criar Tabelas no Supabase

1. Abra **SQL Editor** no Supabase
2. Cole o SQL de: `supabase/sql/create_trial_system.sql`
3. Clique em **RUN**
4. Aguarde ✅

```sql
-- Copie e cole em: SQL Editor do Supabase
CREATE TABLE IF NOT EXISTS public.pre_registrations (...)
CREATE TABLE IF NOT EXISTS public.admin_notifications (...)
...
```

**Arquivo:** `supabase/sql/create_trial_system.sql`

---

### Passo 2: Adicionar Notificações ao Dashboard Admin

Arquivo: `src/app/admin/dashboard/page.tsx`

**Adicione o componente:**

```tsx
import AdminNotificationBell from '@/components/AdminNotificationBell'
import TrialSignupsWidget from '@/components/TrialSignupsWidget'

// No seu dashboard, adicione:
<AdminNotificationBell />

// E em algum lugar do dashboard:
<TrialSignupsWidget />
```

---

## 📋 ESTRUTURA DOS DADOS

### Tabela: `pre_registrations`
```sql
- id (UUID)
- user_id (references auth.users)
- ministry_name (string)
- pastor_name (string)
- cpf_cnpj (string)
- whatsapp (string)
- email (string, unique)
- trial_expires_at (timestamp)
- trial_days (integer, default 7)
- status (enum: pending, active, expired, converted)
- created_at (timestamp)
- updated_at (timestamp)
```

### Tabela: `admin_notifications`
```sql
- id (UUID)
- admin_id (UUID, nullable)
- type (string: new_trial_signup, trial_expiring, etc)
- title (string)
- message (text)
- data (jsonb)
- is_read (boolean)
- read_at (timestamp)
- created_at (timestamp)
```

---

## 🧪 TESTES

### Teste 1: Pré-Cadastro Básico
```bash
1. Abra: http://localhost:3000/
2. Clique em "Cadastre uma senha aqui"
3. Preencha:
   - Ministério: Igreja Teste
   - Pastor: Pastor João
   - CPF: 123.456.789-00
   - WhatsApp: (11) 99999-9999
   - Email: teste@ministerio.com
   - Senha: Teste123 (mín. 6 caracteres)
4. Clique em "CADASTRAR"
5. Esperado: ✅ Mensagem de sucesso com data de vencimento
```

### Teste 2: Verificar Banco de Dados
```sql
-- No SQL Editor do Supabase:
SELECT * FROM public.pre_registrations;

-- Deve retornar:
-- id, user_id, ministry_name, email, trial_expires_at (7 dias depois)
```

### Teste 3: Verificar Notificação
```sql
SELECT * FROM public.admin_notifications
WHERE type = 'new_trial_signup'
ORDER BY created_at DESC LIMIT 1;

-- Deve retornar notificação com:
-- title: "📝 Novo Pré-Cadastro: Igreja Teste"
-- message: "Pastor: Pastor João | Email: teste@ministerio.com | ..."
```

### Teste 4: Ver Notificação no Dashboard Admin
```bash
1. Faça login como admin
2. Vá para dashboard
3. Clique na campainha 🔔
4. Deve mostrar: "📝 Novo Pré-Cadastro: Igreja Teste"
5. Clique no X para marcar como lido
```

### Teste 5: Widget de Pré-Cadastros
```bash
1. No dashboard admin
2. Deve existir card: "📝 Pré-Cadastros (Trial)"
3. Mostra tabela com últimos 10 cadastros
4. Status colorido: Ativo, Vence em X dias, Expirado, Convertido
```

---

## 🔄 FLUXO COMPLETO

```
User acessa http://localhost:3000/
         ↓
Clica em "Cadastre uma senha aqui"
         ↓
Preenche formulário
         ↓
POST /api/v1/signup
         ↓
✅ Validação de campos
         ↓
✅ Cria usuário em auth.users (Supabase Auth)
         ↓
✅ Salva em pre_registrations com trial_expires_at = hoje + 7 dias
         ↓
✅ Cria notificação em admin_notifications
         ↓
✅ Retorna: trial_expires_at
         ↓
Admin vê notificação 🔔
         ↓
Admin clica em campainha
         ↓
Admin vê widget com pré-cadastros
```

---

## 📊 CAMPOS DO FORMULÁRIO

✅ Nome do Ministério
✅ Nome do Pastor
✅ CPF/CNPJ
✅ WhatsApp
✅ Email
✅ Senha (mín. 6 caracteres)
✅ Confirmação de Senha

---

## 🔐 VALIDAÇÕES

✅ Todos os campos obrigatórios
✅ Email válido (formato)
✅ Senha com mínimo 6 caracteres
✅ Senhas coincidem
✅ Email único (Supabase Auth)
✅ CPF/CNPJ único (opcional, pode adicionar)

---

## 📁 ARQUIVOS CRIADOS/MODIFICADOS

| Arquivo | Tipo | O que faz |
|---------|------|-----------|
| `src/app/api/v1/signup/route.ts` | 🆕 NOVO | Endpoint de cadastro |
| `src/components/AdminNotificationBell.tsx` | 🆕 NOVO | Campainha de notificações |
| `src/components/TrialSignupsWidget.tsx` | 🆕 NOVO | Widget dashboard |
| `src/app/page.tsx` | ✏️ ATUALIZADO | Integra novo endpoint |
| `supabase/sql/create_trial_system.sql` | 🆕 NOVO | Cria tabelas |

---

## 🚨 PRÓXIMAS MELHORIAS

1. **Email de Confirmação** - Enviar email após cadastro
2. **Aviso de Vencimento** - Email 2 dias antes de expirar
3. **Conversão de Trial** - Converter para plano pago
4. **Auditoria** - Log de ações de admin
5. **Auto-Limpeza** - Deletar trials expirados após 30 dias
6. **Dashboard de Trials** - Página completa gerenciar pré-cadastros

---

## ✅ CHECKLIST PÓS-IMPLEMENTAÇÃO

- [ ] Criei tabelas no Supabase (SQL Editor)
- [ ] Testei pré-cadastro (http://localhost:3000/)
- [ ] Verifiquei dados em `pre_registrations`
- [ ] Verifiquei notificação em `admin_notifications`
- [ ] Vi notificação no dashboard admin (campainha 🔔)
- [ ] Vi widget com pré-cadastros no dashboard
- [ ] Testei marcar notificação como lida
- [ ] Testei com múltiplos cadastros

---

**Sistema de Trial Implementado:** 3 de janeiro de 2026  
**Status:** ✅ Pronto para uso  
**Próxima revisão:** Recomendado adicionar email automático
