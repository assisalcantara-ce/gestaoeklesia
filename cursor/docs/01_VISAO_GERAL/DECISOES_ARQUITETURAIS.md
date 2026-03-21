# 🏗️ DECISÕES ARQUITETURAIS (ADRs)
## Architecture Decision Records - Justificativas Técnicas

---

## ADR-001: PostgreSQL vs MongoDB para Multi-Tenant

### Status: ✅ **RECOMENDADO: PostgreSQL**

### Contexto
Escolher banco de dados para arquitetura multi-tenant com isolamento de dados crítico.

### Opções Consideradas
1. **PostgreSQL** (SQL relacional)
2. **MongoDB** (NoSQL documento)
3. **DynamoDB** (Serverless AWS)

### Decisão
**PostgreSQL com Row-Level Security (RLS)**

### Justificativa
```
FATOR                 PostgreSQL    MongoDB     DynamoDB
─────────────────────────────────────────────────────────
RLS Nativo            ✅ Sim        ❌ Não       ❌ Não
Transações ACID       ✅ Forte      ⚠️ Parcial   ⚠️ Fraco
Isolamento Dados      ✅ RLS        ❌ APP-Level ⚠️ Complexo
Performance           ✅ 100ms      ✅ 50ms      ⚠️ Variável
Custo (escala)        ✅ Baixo      ⚠️ Médio     ⚠️ Alto
Documentação          ✅ Excelente  ✅ Bom       ⚠️ Específico AWS
Team familiarity      ✅ Alta       ⚠️ Média     ❌ Baixa
```

### Risco Mitigado
- ❌ **SQL Injection**: Prepared statements + ORM
- ❌ **Dados de outro tenant**: RLS automático
- ❌ **Performance**: Índices + caching Redis

### Alternativa Futura
Se escalar para > 100k tenants ou multi-região, considerar:
- Sharding por `ministry_id`
- Replicação read-only por região
- Migration para Citus (PostgreSQL distribuído)

---

## ADR-002: Next.js API Routes vs Express.js

### Status: ✅ **RECOMENDADO: Next.js API Routes**

### Contexto
Escolher framework backend. Sistema já usa Next.js para frontend.

### Opções Consideradas
1. **Next.js API Routes** (integrado)
2. **Express.js** (separado)
3. **Fastify** (performance)

### Decisão
**Next.js API Routes com Middleware Customizado**

### Justificativa
```
FATOR                  Next.js       Express.js  Fastify
─────────────────────────────────────────────────────────
Aprendizado            ✅ Já sabe     ❌ Novo      ❌ Novo
Monorepo integração    ✅ Nativo      ⚠️ Possível  ⚠️ Possível
Deploy simplificado    ✅ Vercel      ⚠️ Heroku    ⚠️ Manual
Suporte type-safety    ✅ TypeScript  ⚠️ Parcial   ⚠️ Parcial
Performance raw        ⚠️ 100ms       ✅ 50ms      ✅ 30ms
Comunidade             ✅ Grande      ✅ Enorme    ⚠️ Crescente
```

### Risco Mitigado
- Performance adequada com middleware otimizado
- Type-safety garantido com TypeScript strict
- Deploy + manutenção simplificados

### Alternativa
Se performance crítica (< 50ms), migrar para Express/Fastify depois.

---

## ADR-003: Prisma vs TypeORM vs Raw SQL

### Status: ✅ **RECOMENDADO: Prisma**

### Contexto
Escolher ORM para interagir com PostgreSQL.

### Opções Consideradas
1. **Prisma** (modern, type-safe)
2. **TypeORM** (tradicional, decorators)
3. **Raw SQL** (máxima controle)

### Decisão
**Prisma 5.0+ com migrations automáticas**

### Justificativa
```
FATOR                  Prisma        TypeORM     Raw SQL
─────────────────────────────────────────────────────────
Developer experience   ✅ Excelente   ⚠️ Bom       ❌ Ruim
Type safety            ✅ 100%        ⚠️ 80%       ❌ 0%
Migrations             ✅ Automático  ⚠️ Manual    ❌ Manual
Performance            ✅ Bom         ✅ Bom       ✅ Ótimo
Aprendizado            ✅ Rápido      ⚠️ Médio     ❌ Lento
RLS Support            ✅ Sim         ⚠️ Sim       ✅ Sim
```

### Implementação
```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Ministry {
  id          String @id @default(cuid())
  name        String
  email       String @unique
  users       User[]
  members     Member[]
  
  @@map("ministries")
}

model Member {
  id          String   @id @default(cuid())
  ministry    Ministry @relation(fields: [ministryId], references: [id])
  ministryId  String
  name        String
  email       String?
  
  @@unique([ministryId, email])
  @@map("members")
}
```

### Risco Mitigado
- Type safety previne bugs em tempo de compilação
- Migrations versionadas e testáveis
- Rollback seguro com `prisma migrate resolve`

---

## ADR-004: JWT com Cookies vs Bearer Token

### Status: ✅ **RECOMENDADO: Híbrido (Ambos)**

### Contexto
Escolher método de armazenamento/transmissão de JWT.

### Opções Consideradas
1. **Only Bearer Token** (localStorage)
2. **Only HttpOnly Cookie** (seguro)
3. **Híbrido** (Bearer + Refresh cookie)

### Decisão
**AccessToken em Bearer Header + RefreshToken em HttpOnly Cookie**

### Justificativa
```
MÉTODO                 Bearer        Cookie      Híbrido
─────────────────────────────────────────────────────────
XSS resistance         ⚠️ 50%        ✅ 100%      ✅ 100%
CSRF protection        ✅ 100%       ❌ 0%        ✅ 100%
Mobile compatible      ✅ Sim        ⚠️ Complexo  ✅ Sim
Token rotation easy    ⚠️ Sim        ✅ Sim       ✅ Sim
User experience        ✅ Bom        ✅ Bom       ✅ Melhor
```

### Implementação
```typescript
// Response após login
{
  accessToken: "eyJhbGc...", // Bearer token, curta duração (7 dias)
  expiresIn: 604800,
}

// HttpOnly cookie (seguro contra XSS)
Set-Cookie: refreshToken=eyJhbGc...; 
  HttpOnly; Secure; SameSite=Strict; Max-Age=2592000
```

### Fluxo
```
1. User login → recebe accessToken + refresh cookie
2. Requisição normal → accessToken em Authorization header
3. Token expira (7 dias) → requisição ao /refresh
4. Servidor valida cookie + gera novo accessToken
5. User continua sem fazer login novamente
```

### Risco Mitigado
- XSS: Cookie HttpOnly não acessível via JavaScript
- CSRF: Bearer token em header não é enviado automaticamente
- Token rotation: Refresh token permite gerar novo sem re-login

---

## ADR-005: Single Database vs Multi-Database (um por tenant)

### Status: ✅ **RECOMENDADO: Single Database com RLS**

### Contexto
Arquitetura de dados para multi-tenant.

### Opções Consideradas
1. **Single Database** com RLS (todos em um BD)
2. **Multi-Database** (um BD por tenant)
3. **Híbrido** (tier 1: single, tier 2+: multi)

### Decisão
**Single PostgreSQL Database com Row-Level Security + Eventual Sharding**

### Justificativa
```
ASPECTO                Single DB     Multi-DB    Híbrido
─────────────────────────────────────────────────────────
Complexidade operacional ✅ Baixa      ❌ Alta      ⚠️ Média
Backup/Recovery         ✅ Simples     ❌ Complexo   ⚠️ Complexo
Custos infraestrutura    ✅ Baixo      ❌ Alto       ⚠️ Médio
Isolamento garantido     ✅ RLS        ✅ 100%       ✅ 100%
Performance             ⚠️ Bom        ✅ Ótimo      ✅ Ótimo
Escalabilidade         ⚠️ Até 100k   ✅ Infinita   ✅ Infinita
Compliance              ✅ Sim         ✅ Sim        ✅ Sim
```

### Topologia
```
Fase 1 (0-1000 tenants):
┌─ Single PostgreSQL (RLS)
│  └─ 1 ministries table
│  └─ 1 users table (com ministry_id)
│  └─ 1 members table (com ministry_id)
│  └─ RLS policies automáticas

Fase 2 (1000-10000 tenants):
┌─ Sharding por ranges de ministry_id
│  ├─ Shard 1: A-G (1000 tenants)
│  ├─ Shard 2: H-P (1000 tenants)
│  └─ Shard 3: Q-Z (1000 tenants)
│  └─ Replicação read-only em cada region

Fase 3 (10000+ tenants):
└─ Full distributed (Citus PostgreSQL)
   └─ Auto-sharding por ministry_id
   └─ Replicação automática
```

### Risco Mitigado
- Performance: Índices em `ministry_id` + caching Redis
- Isolamento: RLS garante no BD mesmo
- Escala: Sharding após 100k tenants

---

## ADR-006: Redis Cache vs Memcached vs No Cache

### Status: ✅ **RECOMENDADO: Redis**

### Contexto
Escolher solução de cache para sessões e consultas frequentes.

### Opções Consideradas
1. **Redis** (rich data types)
2. **Memcached** (simples key-value)
3. **No cache** (direto BD)

### Decisão
**Redis com Estratégia de Invalidação**

### Justificativa
```
FATOR                  Redis         Memcached   Nenhum
─────────────────────────────────────────────────────────
Tipos de dados         ✅ Muitos      ⚠️ Strings  N/A
Persistência           ✅ Sim         ❌ Não      N/A
Pub/Sub                ✅ Sim         ❌ Não      N/A
Rate limiting          ✅ Ideal       ⚠️ Possível N/A
Session store          ✅ Ideal       ✅ Possível ❌ Lento
Replicação HA          ✅ Sim         ⚠️ Complexo N/A
Curva aprendizado      ⚠️ Média       ✅ Baixa    ✅ Nenhuma
```

### Uso Recomendado
```typescript
// 1. Session Store (AccessToken cache)
await redis.setex(
  `session:${userId}:${ministryId}`,
  3600, // 1 hora
  JSON.stringify(userSession)
);

// 2. Rate limiting
await redis.incr(`ratelimit:${ministryId}:${endpoint}`);
await redis.expire(`ratelimit:${ministryId}:${endpoint}`, 60);

// 3. Query cache
const cacheKey = `members:${ministryId}:list:${page}`;
const cached = await redis.get(cacheKey);
if (!cached) {
  const data = await db.query(...);
  await redis.setex(cacheKey, 3600, JSON.stringify(data));
}

// 4. Background jobs
await redis.lpush(`jobs:${ministryId}`, JSON.stringify(job));
```

### Risco Mitigado
- Cache miss: Sempre retorna do BD se não em cache
- Invalidação: TTL automático ou manual em UPDATE/DELETE
- HA: Redis Sentinel para failover automático

---

## ADR-007: Docker + Kubernetes vs Docker Compose vs Serverless

### Status: ✅ **RECOMENDADO: Docker + ECS (não K8s ainda)**

### Contexto
Escolher orquestração de containers para produção.

### Opções Consideradas
1. **Docker + ECS** (AWS managed)
2. **Kubernetes (EKS)** (mais complexo)
3. **Docker Compose** (dev only)
4. **Serverless (Vercel/Lambda)** (sem controle)

### Decisão
**Docker + Amazon ECS com ALB e Auto Scaling**

### Justificativa
```
FATOR                  ECS            EKS         Lambda
─────────────────────────────────────────────────────────
Complexidade           ✅ Média        ❌ Alta      ✅ Baixa
Curva aprendizado      ✅ Rápida       ❌ Lenta     ✅ Rápida
Custo startup          ✅ Baixo        ❌ Alto      ✅ Zero
Escalabilidade        ✅ Boa          ✅ Excelente ⚠️ Limitada
Controle              ⚠️ Médio        ✅ Total     ❌ Baixo
Vendor lock-in        ⚠️ AWS          ⚠️ Genérico  ❌ AWS
Monitoramento         ✅ CloudWatch   ✅ Bom       ✅ CloudWatch
```

### Migração Futura
- Começar com ECS (simples, funciona)
- Se crescer para 100+ servers → migrar para EKS
- Se precisar serverless → manter Lambda para jobs

---

## ADR-008: Versionamento de API (v1, v2, etc)

### Status: ✅ **RECOMENDADO: URL Path Versioning**

### Contexto
Escolher estratégia de versionamento de API.

### Opções Consideradas
1. **URL Path** (`/api/v1/`, `/api/v2/`)
2. **Header** (`Accept: application/vnd.gestaoeklesia.v2+json`)
3. **Subdomain** (`v1.api.gestaoeklesia.com`)

### Decisão
**URL Path Versioning com suporte a múltiplas versões**

### Justificativa
```
MÉTODO                 URL Path      Header      Subdomain
─────────────────────────────────────────────────────────
Facilidade uso         ✅ Fácil       ⚠️ Complexo  ⚠️ Complexo
Browser testável       ✅ Sim         ❌ Não       ⚠️ Sim
Cache-friendly         ✅ Sim         ⚠️ Complexo  ✅ Sim
Documentação           ✅ Óbvia       ⚠️ Obscura   ⚠️ Obscura
Backward compat        ✅ Sim         ✅ Sim       ✅ Sim
```

### Implementação
```
/api/v1/members           ← Versão estável
/api/v1/members/{id}      ← GET, POST, PUT, DELETE
/api/v2/members           ← Breaking changes futuros
  (mas v1 continua vivo)
```

### Deprecation Policy
```
v1: Suporte até 2027-01-02 (2 anos)
v2: Suporte até 2029-01-02 (2 anos)

Quando lançar v3:
1. Anunciar 6 meses antes
2. Marcar v1 como deprecated
3. Parar de aceitar novos clientes em v1
4. Migration guide fornecido
5. Após 2 anos, desligar v1
```

---

## ADR-009: Logs Centralizados vs File-based

### Status: ✅ **RECOMENDADO: CloudWatch + Structured Logging**

### Contexto
Escolher estratégia de logging para observabilidade.

### Opções Consideradas
1. **CloudWatch** (AWS managed)
2. **ELK Stack** (open source)
3. **File-based** (logs em arquivo)

### Decisão
**CloudWatch com Structured JSON Logging**

### Justificativa
```
FATOR                  CloudWatch    ELK         File-based
─────────────────────────────────────────────────────────
Setup                  ✅ 5 min      ⚠️ 1 hora    ✅ 5 min
Integração AWS         ✅ Nativa     ❌ Manual    ❌ Manual
Custos                 ✅ Incluído   ⚠️ Médio     ⚠️ Alto (disk)
Searchability          ✅ Sim        ✅ Sim       ⚠️ Grep only
Alertas                ✅ Sim        ✅ Sim       ❌ Não
Retenção               ✅ Configurável ✅ Sim     ⚠️ Limitada
Team experience        ✅ AWS team   ❌ DevOps    ✅ Toda equipe
```

### Formato
```json
{
  "timestamp": "2026-01-02T10:30:00Z",
  "level": "info",
  "service": "api",
  "environment": "production",
  "message": "User login successful",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "ministryId": "550e8400-e29b-41d4-a716-446655440001",
  "duration_ms": 125,
  "status_code": 200,
  "trace_id": "xyz123",
  "request_id": "abc789"
}
```

### Risco Mitigado
- Buscas rápidas com query syntax CloudWatch
- Alertas automáticos em padrões
- Auditoria de eventos sensíveis

---

## ADR-010: Mensaging: SQS vs RabbitMQ vs Bull

### Status: ✅ **RECOMENDADO: Bull (Redis-based) + SQS**

### Contexto
Escolher solução de message queue para jobs assíncronos.

### Opções Consideradas
1. **Bull** (Redis-backed, simples)
2. **RabbitMQ** (tradicional, robusto)
3. **AWS SQS** (managed, escalável)

### Decisão
**Bull para jobs locais + SQS para integração externa**

### Justificativa
```
FATOR                  Bull          RabbitMQ    SQS
─────────────────────────────────────────────────────────
Setup                  ✅ Fácil       ⚠️ Médio     ✅ Fácil
Reutiliza Redis        ✅ Sim         ❌ Não       ❌ Não
Escalabilidade         ✅ Boa         ✅ Excelente ✅ Excelente
Persistência           ✅ Redis       ✅ Sim       ✅ Managed
Delay job              ✅ Sim         ✅ Sim       ✅ Sim
Retry logic            ✅ Bom         ✅ Excelente ✅ Excelente
Monitoring             ⚠️ Manual      ✅ RabbitMQ ✅ CloudWatch
```

### Casos de Uso
```typescript
// 1. Enviar email (Bull)
import Queue from 'bull';
const emailQueue = new Queue('email', redisConfig);

emailQueue.process(async (job) => {
  await sendEmail(job.data.to, job.data.subject);
});

// 2. Gerar PDF (Bull)
const pdfQueue = new Queue('pdf-generation', redisConfig);
pdfQueue.process(async (job) => {
  const pdf = await generateMemberCard(job.data.memberId);
  await uploadToS3(pdf);
});

// 3. Webhook para sistema externo (SQS)
await sqs.sendMessage({
  QueueUrl: 'https://sqs.us-east-1.amazonaws.com/...',
  MessageBody: JSON.stringify({
    event: 'member.created',
    data: newMember
  })
});
```

### Risco Mitigado
- Bull: Falhas recuperáveis com retry automático
- SQS: Integração com sistemas externos gerenciada por AWS

---

## RESUMO DE DECISÕES

| ADR | Decisão | Alternativa |
|-----|---------|-------------|
| 001 | PostgreSQL + RLS | MongoDB later |
| 002 | Next.js API Routes | Express later |
| 003 | Prisma ORM | TypeORM later |
| 004 | Bearer + HttpOnly Cookies | Pure cookies later |
| 005 | Single DB + RLS | Sharding em phase 2 |
| 006 | Redis Cache | Memcached later |
| 007 | Docker + ECS | EKS em 2027 |
| 008 | URL Path Versioning (/v1/, /v2/) | Header versioning later |
| 009 | CloudWatch + JSON | ELK later |
| 010 | Bull + SQS | RabbitMQ if needed |

---

**Status:** ✅ Todas as decisões aprovadas em 2 de janeiro de 2026  
**Próxima revisão:** Q3 2026 (após 100k tenants ou problemas conhecidos)

