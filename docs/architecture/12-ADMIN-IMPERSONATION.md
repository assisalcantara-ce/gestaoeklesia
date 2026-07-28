# 12 — Arquitetura Oficial do Admin Impersonation (Assumir Sessão)

> **Status:** Documento Oficial de Arquitetura — Fonte da Verdade  
> **Versão:** 1.0 (Consolidado)  
> **Data:** 27 de Julho de 2026  
> **Escopo:** Plataforma Administrativa do Gestão Eklésia  

---

## 1. Visão Geral e Propósito

O recurso de **Admin Impersonation** (Assumir Sessão) permite que um **Super Admin** da plataforma Gestão Eklésia acesse temporariamente o ambiente e o contexto operacional de um cliente (Ministério / Tenant) específico para fins de suporte técnico avançado, diagnóstico de chamados em produção e auxílio na implantação, sem a necessidade de conhecer ou alterar a senha do usuário final.

### Objetivos Arquiteturais:
1. **Transparência Criptográfica:** Garantir que o acesso seja feito através de tokens de curta duração (HMAC-SHA256), sem manipular hashes de senha.
2. **Auditoria Inquestionável:** Registrar com precisão cirúrgica a autoria real (Super Admin), o cliente acessado (Tenant), o tempo de permanência, o tipo e motivo do atendimento.
3. **Isolamento Total de Sessão:** Impedir vazamentos ou contaminações entre a sessão original do administrador da plataforma e o tenant impersonado.

---

## 2. Premissas e Decisões de Design (Rationale)

### 2.1 Por que um JWT Exclusivo e Desacoplado?
* **Decisão:** Não reutilizar o JWT da sessão Supabase principal do Super Admin.
* **Motivo:** O JWT de impersonação possui finalidade e escopo restritos. Reutilizar o token nativo do Supabase Auth causaria ambiguidades nas permissões e complicaria a invalidação imediata sem desconectar o Super Admin da plataforma.
* **Solução:** Criar o módulo `impersonation-jwt.ts` com payload padronizado, segredo de servidor e tempo de expiração fixo (`expiresAt`).

### 2.2 Por que a tabela `admin_impersonation_sessions` é separada de `admin_audit_logs`?
* **Decisão:** Criar uma tabela mestre de controle de sessões em vez de gravar apenas eventos em `admin_audit_logs`.
* **Motivo:** Sessões possuem estado (`active`, `completed`, `expired`, `revoked`), timestamps de início/fim (`started_at`, `ended_at`), agente encetador (`ended_by`), IP e User Agent. Gravar apenas logs dispersos inviabilizaria a consulta de auditoria do Cockpit do cliente em tempo real.

### 2.3 Por que o `authenticatedFetch` e o `requireAdmin` realizam verificação prioritária?
* **Decisão:** No cliente (`api-client.ts`), a presença de `eklesia_impersonation_token` se sobrepõe ao token de sessão Supabase. No backend (`admin-guard.ts`), se a requisição contiver um JWT de impersonação válido, o contexto (`ctx`) reflete o tenant impersonado com a marcação `isImpersonating: true`.
* **Motivo:** Esta abordagem permitiu implementar toda a infraestrutura de impersonação sem alterar os contratos existentes nem reescrever mais de 50 endpoints de API.

---

## 3. Matriz de Segurança e Permissões

A permissão para iniciar ou listar sessões de impersonação é **estritamente restrita ao perfil `SUPER_ADMIN`**.

| Perfil (`AdminRole`) | Iniciar Sessão (`start`) | Encerrar Sessão (`end`) | Ver Histórico (`history`) | Justificativa de Segurança |
| :--- | :---: | :---: | :---: | :--- |
| **`SUPER_ADMIN`** | **✓ Sim** | **✓ Sim** | **✓ Sim** | Responsável técnico máximo da infraestrutura. |
| **`ADMIN`** | **✗ Não** | **✓ Sim (Próprio)** | **✗ Não** | Impede acessos cruzados não auditados por administradores gerais. |
| **`FINANCEIRO`** | **✗ Não** | **✗ Não** | **✗ Não** | Perfil restrito à gestão de cobranças e faturas. |
| **`SUPORTE`** | **✗ Não** | **✗ Não** | **✗ Não** | Atendimento Nível 1/2 sem elevação de privilégios. |
| **`COMERCIAL`** | **✗ Não** | **✗ Não** | **✗ Não** | Gestão de pipeline e funil de vendas. |

---

## 4. Modelo de Dados e Schema DDL (`admin_impersonation_sessions`)

```sql
CREATE TABLE IF NOT EXISTS admin_impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admin_users(id),
  tenant_id UUID NOT NULL REFERENCES ministries(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  ended_by VARCHAR(50) CHECK (ended_by IN ('user_action', 'timeout', 'security_revocation')),
  reason TEXT NOT NULL,
  read_only BOOLEAN NOT NULL DEFAULT FALSE,
  ip VARCHAR(45) NOT NULL,
  user_agent TEXT NOT NULL,
  jwt_id VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'completed', 'expired', 'revoked')) DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_impersonation_admin_status ON admin_impersonation_sessions(admin_id, status);
CREATE INDEX IF NOT EXISTS idx_impersonation_tenant ON admin_impersonation_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_jwt ON admin_impersonation_sessions(jwt_id);
```

---

## 5. Estrutura do JWT de Impersonação (`impersonation-jwt.ts`)

### Payload:
```json
{
  "type": "impersonation",
  "sessionId": "b6a8398e-49b2-4d40-97f2-c9415bb6b490",
  "originalAdminId": "2d661999-3fc9-442a-9d6c-7d2bbefa1c93",
  "targetTenantId": "08c3fa94-b737-4a5f-98aa-836ae735eeee",
  "readOnly": false,
  "issuedAt": 1784828548,
  "expiresAt": 1784830348
}
```

### Regras do JWT:
* **Algoritmo:** HMAC-SHA256.
* **Segredo:** `IMPERSONATION_JWT_SECRET` (fallback para `SUPABASE_SERVICE_ROLE_KEY`).
* **Validação Timing-Safe:** Utilização de `crypto.timingSafeEqual` contra ataques de temporização.
* **TTL:** Sugerido de acordo com o tipo de atendimento (30 min, 2h ou 4h). Renovação passiva e silenciosa **PROIBIDA**.

---

## 6. Pipeline de Autenticação

### 6.1 Integração em `requireAdmin` (`src/lib/admin-guard.ts`)
```typescript
export type AdminContext = {
  supabaseAdmin: ReturnType<typeof createServerClient>
  user: any
  adminUser: any
  // Propriedades Estendidas de Impersonação
  isImpersonating?: boolean
  originalAdmin?: { id: string; email: string; role: string; nome?: string } | null
  impersonationSessionId?: string | null
  readOnly?: boolean
  targetTenantId?: string | null
  targetTenantName?: string | null
}
```

### 6.2 Injeção em `authenticatedFetch` (`src/lib/api-client.ts`)
```typescript
let impersonationToken: string | null = null;
if (typeof window !== 'undefined') {
  impersonationToken = sessionStorage.getItem('eklesia_impersonation_token') || localStorage.getItem('eklesia_impersonation_token');
}

if (impersonationToken) {
  headers.set('Authorization', `Bearer ${impersonationToken}`);
} else if (session?.access_token) {
  headers.set('Authorization', `Bearer ${session.access_token}`);
}
```

---

## 7. Componentes Frontend & UX

1. **`ImpersonationBanner.tsx`:** Componente sticky no topo global de todas as telas administrativas. Atualiza contador regressivo `HH:MM:SS` a cada 1 segundo. Altera paleta de cores (`Red` ➔ `Amber` ➔ `Critical Pulsing Red`). Executa encerramento e limpeza no vencimento.
2. **`ImpersonationModal.tsx`:** Modal no Design System. Exibe detalhes do cliente, seletor de tipo de atendimento com sugestão automática de tempo, seletor de modo (`read_only`), campo de motivo com validação de 5 a 500 caracteres.
3. **`ImpersonationHistoryTab.tsx`:** Tabela no Cockpit do Cliente (`/admin/ministerios/[id]`) exibindo todas as sessões registradas com busca e paginação.

---

## 8. Estrutura de Operações Bloqueadas (`FORBIDDEN_WHILE_IMPERSONATING`)

Arquitetura preparada para impedimento de ações destrutivas durante sessões impersonadas:

```typescript
export const FORBIDDEN_WHILE_IMPERSONATING = [
  'DELETE_MINISTRY',
  'DELETE_ADMIN',
  'CHANGE_OWNER',
  'CHANGE_PRIMARY_EMAIL',
  'CHANGE_CNPJ',
  'DELETE_SUBSCRIPTION',
  'DELETE_TENANT',
] as const;

export function isOperationForbiddenWhileImpersonating(operation: string): boolean {
  return FORBIDDEN_WHILE_IMPERSONATING.includes(operation as ForbiddenImpersonationOperation);
}
```

---

## 9. Rastreabilidade e Auditoria 360°

Para cada ação executada durante uma sessão impersonada:
1. A sessão gera o registro mestre em `admin_impersonation_sessions`.
2. Mutações pontuais (edição de membros, lançamentos, relatórios) registram `impersonation_session_id` na tabela `admin_audit_logs`.
3. Garante-se não-repúdio jurídico: o sistema comprova exatamente se uma alteração foi feita pelo proprietário da igreja ou por um técnico da plataforma em impersonação.

---

## 10. Evoluções Futuras e Roadmap

* [ ] **Fase 4.1:** Interceptador ativo nos endpoints de exclusão para retornar `403 Forbidden` quando `isOperationForbiddenWhileImpersonating(op)` for verdadeiro.
* [ ] **Fase 4.2:** Botão de renovação manual de sessão ("Estender +30 min") mediante confirmação de credencial de Super Admin antes da expiração.
