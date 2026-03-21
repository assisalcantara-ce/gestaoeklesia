# 🏗️ Regras de Arquitetura

Documento que define a arquitetura geral do projeto e como os módulos se interconectam.

## 1. Arquitetura Multi-Tenant

Este é um **sistema SaaS multi-tenant** onde cada "ministry" é um tenant isolado.

### Princípio Fundamental: Row Level Security (RLS)

Todos os dados são isolados por `ministry_id` usando RLS do PostgreSQL:

```sql
-- Exemplo de RLS policy
CREATE POLICY "Usuários veem membros do seu ministry"
  ON public.members FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users 
      WHERE user_id = auth.uid()
    )
  );
```

### Fluxo de Dados

```
Usuário Login (Supabase Auth)
    ↓
JWT Token (contém user_id)
    ↓
Request com JWT
    ↓
RLS Policy verifica: user_id ∈ ministry_users?
    ↓
SIM: Retorna dados do ministry
NÃO: Acesso negado (401)
```

---

## 2. Camadas da Aplicação

### Frontend (Next.js Client)
- Componentes React em `src/components/`
- Custom hooks em `src/hooks/`
- Usa `supabase-client.ts` (anon key, com RLS)
- Comunicação via `/api/v1/*` endpoints

### Backend (Next.js API Routes)
- Endpoints em `src/app/api/v1/`
- Usa `supabase-server.ts` (service role, sem RLS)
- **IMPORTANTE:** Validação manual do `ministry_id` necessária
- Registra ações em `audit_logs`

### Database (Supabase PostgreSQL)
- 9 tabelas com RLS ativado
- Triggers para `updated_at`
- Índices para performance

---

## 3. Tabelas e Relacionamentos

```
auth.users (Supabase)
    ↓ (cria)
public.ministries (tenant)
    ↓ (add users)
public.ministry_users (permissions)
    ↓ (add)
public.members
public.cartoes_templates
public.cartoes_gerados
public.configurations
public.audit_logs
public.arquivos
```

---

## 4. Segurança Multi-Tenant

### Checklist de Segurança

- ✅ Sempre validar `ministry_id` do usuário antes de retornar dados
- ✅ Usar `supabase-rls.ts` para queries que respeitam RLS
- ✅ Usar `supabase-server.ts` apenas com validação manual
- ✅ Registrar todas as ações em `audit_logs`
- ✅ Nunca expor `service_role_key` ao frontend
- ✅ Nunca confiar em `ministry_id` do cliente - sempre verificar

### Exemplo Correto (Backend)

```typescript
// ❌ ERRADO - confia no ministry_id do cliente
const members = await supabase
  .from('members')
  .select()
  .eq('ministry_id', req.body.ministry_id) // Cliente envia isso!

// ✅ CORRETO - valida permissão do usuário
const { data: ministries } = await supabase
  .from('ministry_users')
  .select('ministry_id')
  .eq('user_id', user.id)

const allowedMinistries = ministries.map(m => m.ministry_id)
const members = await supabase
  .from('members')
  .select()
  .in('ministry_id', allowedMinistries)
```

---

## 5. Padrões de API

### Estrutura de Endpoint

```
GET    /api/v1/{resource}
POST   /api/v1/{resource}
GET    /api/v1/{resource}/{id}
PUT    /api/v1/{resource}/{id}
DELETE /api/v1/{resource}/{id}
```

### Response Padrão

```json
{
  "success": true,
  "data": { /* payload */ },
  "meta": { 
    "count": 10,
    "page": 1,
    "limit": 20,
    "total": 150
  },
  "error": null
}
```

### Error Response

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Descrição do erro",
    "details": {}
  }
}
```

---

## 6. Auditoria

Toda ação CRUD em tabelas principais é registrada em `audit_logs`:

```typescript
// Estrutura do log
{
  id: uuid,
  ministry_id: uuid,
  user_id: uuid,
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE',
  resource_type: 'members' | 'cartoes_templates' | ...,
  resource_id: uuid,
  old_data: json,      // dado anterior (UPDATE/DELETE)
  new_data: json,      // novo dado (CREATE/UPDATE)
  changes: json,       // apenas campos alterados
  ip_address: inet,
  user_agent: string,
  status_code: integer,
  error_message: string | null,
  created_at: timestamp
}
```

---

## 7. Fluxo de Desenvolvimento

### Adicionando Nova Funcionalidade

1. **Defina os dados (SQL)**
   - Adicione tabela ou coluna ao schema
   - Configure RLS
   - Execute migration

2. **Gere tipos (TypeScript)**
   - Rode: `npx supabase gen types typescript --linked`
   - Tipos aparecem em `src/types/supabase-generated.ts`

3. **Crie a API (Backend)**
   - Endpoint em `src/app/api/v1/{resource}/route.ts`
   - Validação de permissões
   - Registro em audit_logs

4. **Crie o Hook (Frontend)**
   - Custom hook em `src/hooks/use{Resource}.ts`
   - Usa `supabase-client.ts`
   - CRUD operations

5. **Crie o Componente (UI)**
   - Componente em `src/components/`
   - Usa o hook
   - Integra com notificações

6. **Documente**
   - Atualize `MODULES_INDEX.md`
   - Adicione comentários no código
   - Crie exemplo de uso

---

## 8. Environment Variables

```env
# Supabase (público - seguro expor)
NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...

# Supabase (privado - NUNCA expor)
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...

# App
NEXT_PUBLIC_APP_NAME=Gestão Eklesia
NODE_ENV=development
```

---

## 9. Relacionamentos de Dados

### Ministry Owner Flow
```
Usuário cria conta (Supabase Auth)
    ↓
Cria ministry (insere em public.ministries com seu user_id)
    ↓
Sistema cria ministry_users entry com role='admin'
    ↓
Agora consegue CRUD members, templates, etc
```

### Member Access Flow
```
Usuário (com ministry_users.role='admin/operator')
    ↓
Acessa member via API
    ↓
Backend valida: ministry_id do user ∈ member.ministry_id?
    ↓
SIM: Retorna member
NÃO: 403 Forbidden
```

---

## 10. Performance

### Índices Críticos

```sql
-- Members
CREATE INDEX idx_members_ministry_id ON public.members(ministry_id);
CREATE INDEX idx_members_status ON public.members(status);
CREATE INDEX idx_members_name ON public.members USING GIN (name gin_trgm_ops);

-- Ministries
CREATE INDEX idx_ministries_user_id ON public.ministries(user_id);
CREATE INDEX idx_ministries_status ON public.ministries(subscription_status);

-- Audit
CREATE INDEX idx_audit_logs_ministry_id ON public.audit_logs(ministry_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
```

### Paginação Padrão

```typescript
// Sempre paginar resultados grandes
GET /api/v1/members?page=1&limit=20&sort=name&order=asc&status=active
```

---

## 11. Tratamento de Erros

### Padrão de Erro

```typescript
if (!user) {
  return res.status(401).json({
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message: 'Usuário não autenticado'
    }
  })
}

if (!allowedMinistries.includes(ministryId)) {
  return res.status(403).json({
    success: false,
    error: {
      code: 'FORBIDDEN',
      message: 'Acesso negado a este ministry'
    }
  })
}

if (!member) {
  return res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Membro não encontrado'
    }
  })
}
```

---

## 12. Convenções Importantes

- ✅ IDs são sempre UUID
- ✅ Timestamps são TIMESTAMP (UTC)
- ✅ Datas são DATE (sem hora)
- ✅ Isolamento é SEMPRE por ministry_id
- ✅ Senhas nunca são armazenadas (Supabase Auth)
- ✅ Soft delete usada status='inactive' (não DELETE físico)

---

**Versão:** 1.0  
**Data:** 2 jan 2026  
**Mantém:** Padrões arquiteturais do projeto
