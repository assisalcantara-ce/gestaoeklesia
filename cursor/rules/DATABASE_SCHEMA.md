# 🗄️ Database Schema - Referência Técnica

Documento de referência para a estrutura completa do banco de dados Supabase.

## 📊 Visão Geral

**9 Tabelas principais** + **1 View**

```
ministries (tenant root)
    ├── ministry_users (RBAC)
    ├── members (data)
    ├── cartoes_templates
    ├── cartoes_gerados
    ├── configurations
    ├── arquivos
    └── audit_logs (tracking)

ministries_with_stats (VIEW)
```

---

## 1️⃣ MINISTRIES (Tenants/Clientes)

**Propósito:** Definir organizações (igrejas, ministérios) no sistema

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK, auto-gerado |
| `user_id` | UUID | FK para auth.users (owner) |
| `name` | VARCHAR(255) | Nome da organização |
| `slug` | VARCHAR(100) | URL-safe slug (único) |
| `email_admin` | VARCHAR(255) | Email administrativo (único) |
| `plan` | VARCHAR(50) | 'starter', 'professional', 'enterprise' |
| `subscription_status` | VARCHAR(50) | 'active', 'cancelled', 'expired' |
| `subscription_start_date` | TIMESTAMP | Data de inicio |
| `subscription_end_date` | TIMESTAMP | Data de vencimento |
| `max_users` | INTEGER | Limite de usuários |
| `max_storage_bytes` | BIGINT | Limite de armazenamento (5GB padrão) |
| `storage_used_bytes` | BIGINT | Quanto já foi usado |
| `is_active` | BOOLEAN | Ativo/Inativo |
| `created_at` | TIMESTAMP | Data de criação |
| `updated_at` | TIMESTAMP | Última atualização |

**Índices:**
- `idx_ministries_user_id` (owner lookup)
- `idx_ministries_slug` (URL lookup)
- `idx_ministries_status` (filtering)

**RLS Policies:**
- ✅ SELECT: user_id = auth.uid()
- ✅ UPDATE: user_id = auth.uid()

---

## 2️⃣ MINISTRY_USERS (Role-Based Access Control)

**Propósito:** Mapear usuários para ministérios + atribuir roles

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK, auto-gerado |
| `ministry_id` | UUID | FK para ministries |
| `user_id` | UUID | FK para auth.users |
| `role` | VARCHAR(50) | 'admin', 'manager', 'operator', 'viewer' |
| `permissions` | JSONB | Array de permissões customizadas |
| `is_active` | BOOLEAN | Ativo/Inativo |
| `last_activity` | TIMESTAMP | Último acesso |
| `created_at` | TIMESTAMP | Data de criação |

**Constraints:**
- `UNIQUE(ministry_id, user_id)` - Um usuário por ministry
- `role IN ('admin', 'manager', 'operator', 'viewer')`

**Índices:**
- `idx_ministry_users_ministry_id` (ministry lookup)
- `idx_ministry_users_user_id` (user lookup)
- `idx_ministry_users_role` (role filtering)

**RLS Policies:**
- ✅ SELECT: ministry_id IN (SELECT ministry_id WHERE user_id = auth.uid())

---

## 3️⃣ MEMBERS (Membros da Comunidade)

**Propósito:** Cadastro de membros/fieis

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK, auto-gerado |
| `ministry_id` | UUID | FK para ministries (isolamento) |
| `name` | VARCHAR(255) | Nome completo |
| `email` | VARCHAR(255) | Email (pode ser NULL) |
| `phone` | VARCHAR(20) | Telefone |
| `cpf` | VARCHAR(20) | CPF (pode ser NULL) |
| `birth_date` | DATE | Data de nascimento |
| `gender` | VARCHAR(20) | 'M', 'F', 'Outro' |
| `marital_status` | VARCHAR(50) | 'single', 'married', etc |
| `occupation` | VARCHAR(255) | Profissão |
| `address` | VARCHAR(500) | Endereço |
| `city` | VARCHAR(100) | Cidade |
| `state` | VARCHAR(2) | Estado (UF) |
| `status` | VARCHAR(50) | 'active', 'inactive', 'deceased', 'transferred' |
| `photo_url` | VARCHAR(500) | URL da foto |
| `notes` | TEXT | Observações |
| `created_at` | TIMESTAMP | Data de cadastro |
| `updated_at` | TIMESTAMP | Última atualização |

**Índices:**
- `idx_members_ministry_id` (required for RLS)
- `idx_members_email` (lookup por email)
- `idx_members_cpf` (lookup por CPF)
- `idx_members_status` (filtering)

**RLS Policies:**
- ✅ SELECT/INSERT/UPDATE/DELETE: ministry_id = (SELECT ministry_id FROM ministry_users WHERE user_id = auth.uid())

---

## 4️⃣ CARTOES_TEMPLATES (Templates de Cartões)

**Propósito:** Armazenar designs de cartões para impressão

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `ministry_id` | UUID | FK para ministries (isolamento) |
| `name` | VARCHAR(255) | Nome do template |
| `type` | VARCHAR(50) | 'membro', 'ministro', 'evento' |
| `description` | TEXT | Descrição |
| `template_json` | JSONB | Configuração completa do cartão |
| `colors` | JSONB | Paleta de cores |
| `dimensions` | JSONB | Tamanho (width, height) |
| `is_default` | BOOLEAN | Template padrão para tipo |
| `is_active` | BOOLEAN | Ativo/Inativo |
| `created_at` | TIMESTAMP | Data de criação |
| `updated_at` | TIMESTAMP | Última atualização |

**Exemplo de template_json:**
```json
{
  "fields": [
    {"name": "name", "x": 10, "y": 20, "fontSize": 16, "color": "#000"},
    {"name": "ministry", "x": 10, "y": 40, "fontSize": 12, "color": "#666"}
  ],
  "logo": {"url": "/img/logo.png", "x": 200, "y": 10, "width": 30},
  "background": "/img/card_bg.jpg"
}
```

---

## 5️⃣ CARTOES_GERADOS (Cartões Impressos)

**Propósito:** Histórico de cartões gerados/impressos

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `ministry_id` | UUID | FK para ministries |
| `template_id` | UUID | FK para cartoes_templates |
| `member_id` | UUID | FK para members |
| `pdf_url` | VARCHAR(500) | URL do PDF armazenado |
| `generated_at` | TIMESTAMP | Quando foi gerado |
| `printed_at` | TIMESTAMP | Quando foi impresso |
| `printed_by` | UUID | User que imprimiu |
| `status` | VARCHAR(50) | 'generated', 'printed', 'archived' |
| `metadata` | JSONB | Dados usados na renderização |

**Indexação:**
- `idx_cartoes_gerados_ministry_id` (RLS)
- `idx_cartoes_gerados_member_id` (lookup)
- `idx_cartoes_gerados_status` (filtering)

---

## 6️⃣ CONFIGURATIONS (Configurações Customizáveis)

**Propósito:** Armazenar nomes de campos dinâmicos, valores customizados

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `ministry_id` | UUID | FK para ministries |
| `key` | VARCHAR(100) | Nome da config (ex: 'member_status_values') |
| `value` | JSONB | Valor (array, objeto ou string) |
| `category` | VARCHAR(50) | 'nomenclature', 'design', 'business' |
| `created_at` | TIMESTAMP | Data de criação |
| `updated_at` | TIMESTAMP | Última atualização |

**Exemplos:**
```json
{
  "key": "member_status_values",
  "value": ["Ativo", "Inativo", "Falecido", "Transferido"],
  "category": "nomenclature"
}

{
  "key": "marital_statuses",
  "value": ["Solteiro", "Casado", "Viúvo", "Divorciado"],
  "category": "nomenclature"
}

{
  "key": "primary_color",
  "value": "#123b63",
  "category": "design"
}
```

---

## 7️⃣ ARQUIVOS (Armazenamento de Arquivos)

**Propósito:** Metadados de arquivos enviados (fotos, PDFs, etc)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `ministry_id` | UUID | FK para ministries |
| `file_name` | VARCHAR(255) | Nome original do arquivo |
| `file_type` | VARCHAR(50) | 'image', 'pdf', 'document' |
| `file_size` | BIGINT | Tamanho em bytes |
| `storage_path` | VARCHAR(500) | Caminho no Supabase Storage |
| `uploaded_by` | UUID | FK para auth.users |
| `related_to` | VARCHAR(50) | 'member_photo', 'logo', 'document' |
| `related_id` | UUID | ID do relacionado (ex: member_id) |
| `created_at` | TIMESTAMP | Data de upload |
| `expires_at` | TIMESTAMP | Data de expiração (opcional) |

---

## 8️⃣ AUDIT_LOGS (Rastreamento de Ações)

**Propósito:** Log de todas as alterações (compliance + debugging)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `ministry_id` | UUID | FK para ministries |
| `user_id` | UUID | FK para auth.users (quem fez) |
| `action` | VARCHAR(50) | 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'PRINT' |
| `table_name` | VARCHAR(100) | Qual tabela foi afetada |
| `record_id` | UUID | ID do record afetado |
| `changes` | JSONB | O que mudou (before/after) |
| `ip_address` | INET | IP do requisitor |
| `user_agent` | VARCHAR(500) | Browser/app que fez |
| `timestamp` | TIMESTAMP | Quando aconteceu |
| `status` | VARCHAR(50) | 'success', 'failed' |
| `error_message` | TEXT | Mensagem de erro (se houver) |

**Exemplo de changes:**
```json
{
  "before": {"status": "active", "name": "João Silva"},
  "after": {"status": "inactive", "name": "João da Silva"},
  "fields_changed": ["status", "name"]
}
```

---

## 9️⃣ MINISTRIES_WITH_STATS (VIEW)

**Propósito:** Dashboard view com estatísticas agregadas

```sql
SELECT
  m.id,
  m.name,
  m.plan,
  m.subscription_status,
  COUNT(DISTINCT mu.user_id) as user_count,
  COUNT(DISTINCT mb.id) as member_count,
  COUNT(DISTINCT cg.id) as cards_generated,
  m.storage_used_bytes,
  m.max_users,
  m.subscription_end_date
FROM public.ministries m
LEFT JOIN public.ministry_users mu ON m.id = mu.ministry_id
LEFT JOIN public.members mb ON m.id = mb.ministry_id
LEFT JOIN public.cartoes_gerados cg ON m.id = cg.ministry_id
GROUP BY m.id, m.name, m.plan, m.subscription_status, 
         m.storage_used_bytes, m.max_users, m.subscription_end_date
```

---

## 🔐 RLS Summary

| Tabela | Policy |
|--------|--------|
| ministries | `user_id = auth.uid()` |
| ministry_users | `ministry_id IN (SELECT ministry_id WHERE user_id = auth.uid())` |
| members | `ministry_id IN (SELECT ministry_id FROM ministry_users WHERE user_id = auth.uid())` |
| cartoes_templates | `ministry_id IN (SELECT ministry_id FROM ministry_users WHERE user_id = auth.uid())` |
| cartoes_gerados | `ministry_id IN (SELECT ministry_id FROM ministry_users WHERE user_id = auth.uid())` |
| configurations | `ministry_id IN (SELECT ministry_id FROM ministry_users WHERE user_id = auth.uid())` |
| arquivos | `ministry_id IN (SELECT ministry_id FROM ministry_users WHERE user_id = auth.uid())` |
| audit_logs | `ministry_id IN (SELECT ministry_id FROM ministry_users WHERE user_id = auth.uid())` |

---

## 💡 Padrões Importantes

### 1. Isolamento Multi-Tenant

**SEMPRE** inclua `ministry_id` ao:
- SELECT: `WHERE ministry_id = ???`
- INSERT: `values = {..., ministry_id: current_ministry_id}`
- UPDATE: `WHERE id = ??? AND ministry_id = ???`
- DELETE: `WHERE id = ??? AND ministry_id = ???`

### 2. Queries Comuns

**Listar membros de um ministry:**
```typescript
const { data } = await supabase
  .from('members')
  .select('*')
  .eq('ministry_id', ministryId)  // ← obrigatório!
  .eq('status', 'active');
```

**Agregar dados com view:**
```typescript
const { data } = await supabase
  .from('ministries_with_stats')
  .select('*')
  .eq('id', ministryId);
```

### 3. Validação em API Routes

```typescript
// SEMPRE validar ministry_id do usuário autenticado
const ministryId = await getUserMinistry(session.user.id);
if (!ministryId) return 401;

// SÓ ENTÃO executar query
const { data } = await supabase
  .from('members')
  .select()
  .eq('ministry_id', ministryId);  // ← validado!
```

---

## 📌 Checklist de Segurança

- [ ] Toda tabela tem `ministry_id`?
- [ ] Toda tabela tem RLS ativado?
- [ ] Policy valida `ministry_id` antes de retornar?
- [ ] API routes validam `ministry_id` do usuário?
- [ ] Nunca expor `service_role_key` ao frontend?
- [ ] Logs de auditoria para ações críticas?

---

## 🔗 Referências

- Schema completo: `cursor/docs/03_SUPABASE/SUPABASE_SCHEMA_COMPLETO.sql`
- Arquitetura: `cursor/rules/ARCHITECTURE.md`
- API: `cursor/rules/API_ENDPOINTS.md`

