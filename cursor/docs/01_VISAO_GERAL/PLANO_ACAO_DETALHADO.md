# 📋 PLANO DE AÇÃO: Transformar Sistema para Multi-Tenant Seguro
## Gestão Eklesia - Roadmap Detalhado

---

## 🎯 VISÃO GERAL

**Objetivo:** Transformar `gestaoeklesia` de um protótipo local para uma **SaaS multi-tenant pronta para produção**.

**Timeline Total:** 15-20 semanas  
**Equipe Recomendada:** 6-7 pessoas  
**Budget Estimado:** $68,000-95,000 USD

---

## ⏱️ CRONOGRAMA EXECUTIVO

```
MÊS 1 (Semanas 1-4):    Segurança & Database
MÊS 2 (Semanas 5-8):    APIs Core & Integração
MÊS 3 (Semanas 9-12):   Infrastructure & DevOps
MESES 4 (Semanas 13-15): Testing, Compliance & Launch
```

---

## 🔴 FASE 1: SEGURANÇA E DATABASE (3-4 semanas)

### SPRINT 1: Setup Inicial & Autenticação (Semana 1)

#### 1.1 - Infraestrutura de Banco de Dados

**Tarefa:** Criar ambiente PostgreSQL com configuração multi-tenant

```sql
-- Passo 1: Criar schema
CREATE SCHEMA IF NOT EXISTS public;

-- Passo 2: Criar tabelas base
CREATE TABLE ministries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email_admin VARCHAR(255) UNIQUE NOT NULL,
  cnpj_cpf VARCHAR(20),
  slug VARCHAR(100) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  logo_url VARCHAR(500),
  subscription_plan VARCHAR(50) NOT NULL DEFAULT 'starter',
  subscription_status VARCHAR(50) NOT NULL DEFAULT 'active',
  subscription_start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  subscription_end_date TIMESTAMP,
  auto_renew BOOLEAN DEFAULT true,
  storage_used_bytes BIGINT DEFAULT 0,
  max_users INTEGER,
  max_storage_bytes BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  status VARCHAR(50) NOT NULL DEFAULT 'active'
);

CREATE TABLE ministry_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES ministries(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'operator',
  permissions JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ministry_id, email)
);

-- Row-Level Security
ALTER TABLE ministry_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY ministry_isolation_users ON ministry_users
  USING (ministry_id = current_setting('app.current_ministry_id')::uuid)
  WITH CHECK (ministry_id = current_setting('app.current_ministry_id')::uuid);

-- Índices de performance
CREATE INDEX idx_ministries_email ON ministries(email_admin);
CREATE INDEX idx_ministries_slug ON ministries(slug);
CREATE INDEX idx_ministry_users_ministry_id ON ministry_users(ministry_id);
CREATE INDEX idx_ministry_users_email ON ministry_users(email);
```

**Checklist:**
- [ ] PostgreSQL 14+ instalado
- [ ] Banco criado (`gestaoeklesia`)
- [ ] Schema migrado
- [ ] RLS ativado
- [ ] Índices criados
- [ ] Backup testado

**Tempo estimado:** 2 horas  
**Responsável:** DevOps/Backend Lead

---

#### 1.2 - Variáveis de Ambiente

**Arquivo:** `.env.local` (gitignored)

```env
# DATABASE
DATABASE_URL=postgresql://user:password@localhost:5432/gestaoeklesia_prod
DATABASE_REPLICA_URL=postgresql://user:password@replica.db:5432/gestaoeklesia_prod

# AUTHENTICATION
JWT_SECRET=seu_secret_muito_aleatorio_e_seguro_gerado_com_openssl_rand_base64_32
JWT_EXPIRATION=7d
REFRESH_TOKEN_SECRET=outro_secret_aleatorio_diferente
REFRESH_TOKEN_EXPIRATION=30d

# SECURITY
BCRYPT_ROUNDS=12
SESSION_TIMEOUT_MINUTES=60
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=15

# API
API_RATE_LIMIT_REQUESTS=1000
API_RATE_LIMIT_WINDOW_MINUTES=60
API_PORT=3000
NODE_ENV=production

# UPLOADS
AWS_S3_BUCKET=gestaoeklesia-prod
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=seu_access_key
AWS_SECRET_ACCESS_KEY=seu_secret_key
MAX_FILE_SIZE_MB=50

# MONITORING
SENTRY_DSN=seu_sentry_dsn
NEW_RELIC_LICENSE_KEY=seu_license_key
LOG_LEVEL=info

# PAYMENT (Stripe, PagSeguro, etc)
STRIPE_SECRET_KEY=<STRIPE_SECRET_KEY>
STRIPE_PUBLISHABLE_KEY=<STRIPE_PUBLISHABLE_KEY>
WEBHOOK_SECRET=<STRIPE_WEBHOOK_SECRET>

# EMAIL
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@gestaoeklesia.com
SMTP_PASSWORD=seu_app_password
SENDGRID_API_KEY=seu_key

# CORS
NEXT_PUBLIC_API_URL=https://api.gestaoeklesia.com
NEXT_PUBLIC_APP_URL=https://app.gestaoeklesia.com
```

**Checklist:**
- [ ] .env.local criado (não commitado)
- [ ] Todos os secrets gerados com `openssl`
- [ ] Backup de secrets em vault seguro
- [ ] Variáveis validadas em startup

**Tempo estimado:** 30 minutos  
**Responsável:** DevOps/Backend Lead

---

#### 1.3 - Implementar Autenticação JWT

**Arquivo:** `src/lib/auth.ts`

```typescript
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { db } from './db';

export interface AuthPayload {
  userId: string;
  ministryId: string;
  email: string;
  role: string;
}

export interface JWTToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Hash de senha com bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
  return bcrypt.hash(password, rounds);
}

/**
 * Validar senha contra hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Gerar tokens JWT
 */
export function generateTokens(payload: AuthPayload): JWTToken {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRATION || '7d',
    algorithm: 'HS256',
  });

  const refreshToken = jwt.sign(
    { userId: payload.userId, type: 'refresh' },
    process.env.REFRESH_TOKEN_SECRET!,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRATION || '30d',
      algorithm: 'HS256',
    }
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: 24 * 60 * 60, // 24 hours
  };
}

/**
 * Validar e decodificar JWT
 */
export function verifyToken(token: string): AuthPayload | null {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!, {
      algorithms: ['HS256'],
    });
    return decoded as AuthPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Login de usuário
 */
export async function loginUser(
  email: string,
  password: string
): Promise<JWTToken | { error: string }> {
  const user = await db.query(
    `SELECT mu.*, m.id as ministry_id 
     FROM ministry_users mu
     JOIN ministries m ON mu.ministry_id = m.id
     WHERE mu.email = ? AND m.deleted_at IS NULL`,
    [email]
  );

  if (!user) {
    // Log attempt para auditoria
    await logSecurityEvent('LOGIN_FAILED', 'USER_NOT_FOUND', { email });
    return { error: 'Credenciais inválidas' };
  }

  // Verificar lockout
  if (user.locked_until && user.locked_until > new Date()) {
    await logSecurityEvent('LOGIN_FAILED', 'ACCOUNT_LOCKED', { email });
    return { error: 'Conta temporariamente bloqueada. Tente mais tarde.' };
  }

  // Validar senha
  const passwordValid = await verifyPassword(password, user.password_hash);
  if (!passwordValid) {
    await incrementLoginAttempts(user.id);
    await logSecurityEvent('LOGIN_FAILED', 'INVALID_PASSWORD', { email });
    return { error: 'Credenciais inválidas' };
  }

  // Reset login attempts
  await db.query(
    'UPDATE ministry_users SET login_attempts = 0, locked_until = NULL WHERE id = ?',
    [user.id]
  );

  // Update last login
  await db.query(
    'UPDATE ministry_users SET last_login = NOW() WHERE id = ?',
    [user.id]
  );

  const tokens = generateTokens({
    userId: user.id,
    ministryId: user.ministry_id,
    email: user.email,
    role: user.role,
  });

  await logSecurityEvent('LOGIN_SUCCESS', 'USER_AUTHENTICATED', {
    email,
    ministry_id: user.ministry_id,
  });

  return tokens;
}

/**
 * Incrementar tentativas de login
 */
async function incrementLoginAttempts(userId: string) {
  const maxAttempts = 5;
  const lockoutDuration = 15; // minutos

  const attempts = await db.query(
    'SELECT login_attempts FROM ministry_users WHERE id = ?',
    [userId]
  );

  const newAttempts = (attempts?.login_attempts || 0) + 1;

  if (newAttempts >= maxAttempts) {
    await db.query(
      `UPDATE ministry_users 
       SET login_attempts = ?, locked_until = NOW() + INTERVAL ? 
       WHERE id = ?`,
      [newAttempts, `${lockoutDuration} minutes`, userId]
    );
  } else {
    await db.query(
      'UPDATE ministry_users SET login_attempts = ? WHERE id = ?',
      [newAttempts, userId]
    );
  }
}

/**
 * Log de eventos de segurança
 */
export async function logSecurityEvent(
  eventType: string,
  details: string,
  metadata: Record<string, any>
) {
  // Será implementado na Fase 2
  console.log(`[SECURITY] ${eventType}: ${details}`, metadata);
}
```

**Checklist:**
- [ ] `npm install jsonwebtoken bcrypt @types/jsonwebtoken`
- [ ] Arquivo criado com todas funções
- [ ] Testes unitários escritos
- [ ] Validação de entrada implementada

**Tempo estimado:** 4 horas  
**Responsável:** Backend Developer

---

#### 1.4 - Middleware de Autenticação

**Arquivo:** `src/middleware/auth.middleware.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    userId: string;
    ministryId: string;
    email: string;
    role: string;
  };
}

export function withAuth(handler: Function) {
  return async (req: NextRequest, context: any) => {
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Attach user to request
    const authReq = req as AuthenticatedRequest;
    authReq.user = decoded;

    return handler(authReq, context);
  };
}

export function withRole(...allowedRoles: string[]) {
  return (handler: Function) => {
    return async (req: AuthenticatedRequest, context: any) => {
      const authReq = req as AuthenticatedRequest;
      
      if (!authReq.user || !allowedRoles.includes(authReq.user.role)) {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        );
      }

      return handler(authReq, context);
    };
  };
}
```

**Checklist:**
- [ ] Middleware criado
- [ ] Testes de rejeição de token inválido
- [ ] Testes de expiração de token

**Tempo estimado:** 2 horas  
**Responsável:** Backend Developer

---

### SPRINT 2: Endpoints de Autenticação (Semana 1-2)

#### 2.1 - API de Login e Registro

**Arquivo:** `src/app/api/v1/auth/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { loginUser, hashPassword, generateTokens } from '@/lib/auth';
import { db } from '@/lib/db';
import z from 'zod';

// Validação
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const RegisterSchema = z.object({
  ministry_name: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(3),
  plan: z.enum(['starter', 'professional', 'enterprise']).default('starter'),
});

/**
 * POST /api/v1/auth/login
 */
export async function POST(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = await req.json();
    const { email, password } = LoginSchema.parse(body);

    const result = await loginUser(email, password);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    // Set secure cookie
    const response = NextResponse.json({
      success: true,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    });

    response.cookies.set('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof z.ZodError ? error.errors : 'Invalid request' },
      { status: 400 }
    );
  }
}

/**
 * POST /api/v1/auth/register
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const data = RegisterSchema.parse(body);

    // Verificar se ministry já existe
    const existing = await db.query(
      'SELECT id FROM ministries WHERE email_admin = ?',
      [data.email]
    );

    if (existing) {
      return NextResponse.json(
        { error: 'Ministry already registered' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(data.password);

    // Criar ministry
    const ministryId = await db.query(
      `INSERT INTO ministries (name, email_admin, subscription_plan, password_hash) 
       VALUES (?, ?, ?, ?) RETURNING id`,
      [data.ministry_name, data.email, data.plan, passwordHash]
    );

    // Criar usuário admin
    const userId = await db.query(
      `INSERT INTO ministry_users (ministry_id, email, password_hash, full_name, role) 
       VALUES (?, ?, ?, ?, 'admin') RETURNING id`,
      [ministryId, data.email, passwordHash, data.full_name]
    );

    const tokens = generateTokens({
      userId,
      ministryId,
      email: data.email,
      role: 'admin',
    });

    return NextResponse.json({ success: true, ...tokens });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 400 }
    );
  }
}
```

**Checklist:**
- [ ] Endpoints criados
- [ ] Validação Zod implementada
- [ ] Rate limiting aplicado
- [ ] Testes de segurança: SQL injection, XSS

**Tempo estimado:** 6 horas  
**Responsável:** Backend Developer

---

#### 2.2 - Refresh Token e Logout

**Arquivo:** `src/app/api/v1/auth/refresh/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { generateTokens } from '@/lib/auth';

/**
 * POST /api/v1/auth/refresh
 */
export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get('refreshToken')?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
  }

  try {
    const decoded = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET!
    ) as any;

    if (decoded.type !== 'refresh') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Buscar user para validar role/ministry
    const user = await db.query(
      'SELECT * FROM ministry_users WHERE id = ?',
      [decoded.userId]
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const tokens = generateTokens({
      userId: user.id,
      ministryId: user.ministry_id,
      email: user.email,
      role: user.role,
    });

    const response = NextResponse.json({ success: true, ...tokens });

    response.cookies.set('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
  }
}

/**
 * POST /api/v1/auth/logout
 */
export async function DELETE(req: NextRequest) {
  const response = NextResponse.json({ success: true });

  response.cookies.delete('refreshToken');

  return response;
}
```

**Checklist:**
- [ ] Endpoints criados
- [ ] Cookies seguros (httpOnly, Secure, SameSite)
- [ ] Logout limpa cookies e tokens

**Tempo estimado:** 3 horas  
**Responsável:** Backend Developer

---

## 🟡 FASE 2: APIs CORE (3-4 semanas)

### SPRINT 3: API de Membros (Semana 3-4)

#### 3.1 - Schema de Membros

```sql
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES ministries(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  birth_date DATE,
  gender VARCHAR(20),
  marital_status VARCHAR(50),
  occupation VARCHAR(255),
  address VARCHAR(500),
  city VARCHAR(100),
  state VARCHAR(100),
  zipcode VARCHAR(20),
  member_since DATE,
  status VARCHAR(50) DEFAULT 'active',
  notes JSONB,
  custom_fields JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL REFERENCES ministry_users(id),
  UNIQUE(ministry_id, email)
);

ALTER TABLE members ENABLE ROW LEVEL SECURITY;

CREATE POLICY members_isolation ON members
  USING (ministry_id = current_setting('app.current_ministry_id')::uuid);

CREATE INDEX idx_members_ministry ON members(ministry_id);
CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_members_name ON members USING GIN (name gin_trgm_ops);
```

**Checklist:**
- [ ] Tabela criada
- [ ] RLS ativado
- [ ] Índices de performance criados

**Tempo estimado:** 1 hora  
**Responsável:** Database Admin

---

#### 3.2 - CRUD de Membros

**Arquivo:** `src/app/api/v1/members/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { db } from '@/lib/db';
import z from 'zod';

const MemberSchema = z.object({
  name: z.string().min(3).max(255),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  birth_date: z.string().date().optional(),
  gender: z.enum(['M', 'F', 'Other']).optional(),
  marital_status: z.string().optional(),
  occupation: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipcode: z.string().optional(),
  member_since: z.string().date().optional(),
  status: z.enum(['active', 'inactive', 'deceased']).default('active'),
  notes: z.string().optional(),
  custom_fields: z.record(z.any()).optional(),
});

/**
 * GET /api/v1/members
 * Lista membros com paginação e filtros
 */
async function getMembers(req: AuthenticatedRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const status = searchParams.get('status');
  const search = searchParams.get('search');

  const offset = (page - 1) * limit;
  const ministryId = req.user!.ministryId;

  let query = 'SELECT * FROM members WHERE ministry_id = ?';
  const params: any[] = [ministryId];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  if (search) {
    query += ' AND (name ILIKE ? OR email ILIKE ? OR phone ILIKE ?)';
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  const members = await db.query(
    `${query} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const total = await db.query(
    `SELECT COUNT(*) as count FROM members WHERE ministry_id = ?`,
    [ministryId]
  );

  return NextResponse.json({
    data: members,
    pagination: {
      page,
      limit,
      total: total[0].count,
      pages: Math.ceil(total[0].count / limit),
    },
  });
}

/**
 * POST /api/v1/members
 * Criar novo membro
 */
async function createMember(req: AuthenticatedRequest) {
  const body = await req.json();
  const data = MemberSchema.parse(body);

  const ministryId = req.user!.ministryId;
  const userId = req.user!.userId;

  try {
    const memberId = await db.query(
      `INSERT INTO members (
        ministry_id, name, email, phone, birth_date, gender, 
        marital_status, occupation, address, city, state, zipcode,
        member_since, status, notes, custom_fields, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id`,
      [
        ministryId,
        data.name,
        data.email,
        data.phone,
        data.birth_date,
        data.gender,
        data.marital_status,
        data.occupation,
        data.address,
        data.city,
        data.state,
        data.zipcode,
        data.member_since,
        data.status,
        data.notes,
        JSON.stringify(data.custom_fields),
        userId,
      ]
    );

    // Log auditoria
    await logAudit('MEMBER_CREATED', ministryId, userId, 'members', memberId);

    return NextResponse.json(
      { success: true, memberId },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create member error:', error);
    return NextResponse.json(
      { error: 'Failed to create member' },
      { status: 400 }
    );
  }
}

/**
 * GET /api/v1/members/[id]
 */
async function getMember(req: AuthenticatedRequest, id: string) {
  const ministryId = req.user!.ministryId;

  const member = await db.query(
    'SELECT * FROM members WHERE id = ? AND ministry_id = ?',
    [id, ministryId]
  );

  if (!member) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ data: member[0] });
}

/**
 * PUT /api/v1/members/[id]
 */
async function updateMember(req: AuthenticatedRequest, id: string) {
  const body = await req.json();
  const data = MemberSchema.parse(body);
  const ministryId = req.user!.ministryId;
  const userId = req.user!.userId;

  const existing = await db.query(
    'SELECT * FROM members WHERE id = ? AND ministry_id = ?',
    [id, ministryId]
  );

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    await db.query(
      `UPDATE members SET name = ?, email = ?, phone = ?, birth_date = ?,
       gender = ?, marital_status = ?, occupation = ?, address = ?,
       city = ?, state = ?, zipcode = ?, member_since = ?, status = ?,
       notes = ?, custom_fields = ?, updated_at = NOW()
       WHERE id = ? AND ministry_id = ?`,
      [
        data.name,
        data.email,
        data.phone,
        data.birth_date,
        data.gender,
        data.marital_status,
        data.occupation,
        data.address,
        data.city,
        data.state,
        data.zipcode,
        data.member_since,
        data.status,
        data.notes,
        JSON.stringify(data.custom_fields),
        id,
        ministryId,
      ]
    );

    await logAudit('MEMBER_UPDATED', ministryId, userId, 'members', id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update member error:', error);
    return NextResponse.json(
      { error: 'Failed to update member' },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/v1/members/[id]
 */
async function deleteMember(req: AuthenticatedRequest, id: string) {
  const ministryId = req.user!.ministryId;
  const userId = req.user!.userId;

  const existing = await db.query(
    'SELECT * FROM members WHERE id = ? AND ministry_id = ?',
    [id, ministryId]
  );

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    await db.query(
      'DELETE FROM members WHERE id = ? AND ministry_id = ?',
      [id, ministryId]
    );

    await logAudit('MEMBER_DELETED', ministryId, userId, 'members', id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete member error:', error);
    return NextResponse.json(
      { error: 'Failed to delete member' },
      { status: 400 }
    );
  }
}

/**
 * Router principal
 */
export const GET = withAuth(getMembers);
export const POST = withAuth(createMember);
```

**Checklist:**
- [ ] Todos 5 endpoints implementados (GET list, GET one, POST, PUT, DELETE)
- [ ] Validação com Zod
- [ ] Row-level security testado
- [ ] Auditoria implementada

**Tempo estimado:** 8 horas  
**Responsável:** Backend Developer

---

## 🟠 FASE 3: INFRAESTRUTURA (2-3 semanas)

*(Resumido por brevidade)*

### Itens Críticos:

- Docker + Docker Compose
- GitHub Actions CI/CD
- Environment por stage (dev, staging, prod)
- Health check endpoints
- Logging centralizado (Winston/Pino)
- APM (Application Performance Monitoring)
- Monitoramento (Prometheus + Grafana)
- Alertas (PagerDuty/OpsGenie)

---

## 🔵 FASE 4: COMPLIANCE & LAUNCH (1-2 semanas)

### Checklist Final:

```
ANTES DO LAUNCH:
  [ ] Security audit completo
  [ ] Penetration testing
  [ ] Load testing (1000+ req/s)
  [ ] Disaster recovery drill
  [ ] LGPD compliance audit
  [ ] Documentação API (Swagger)
  [ ] Runbook de operações
  [ ] Plano de rollback
  [ ] SLA definido (99.9% uptime)
  [ ] Backup automático ativo
  [ ] Monitoring em produção
  [ ] On-call rotation configurado
```

---

## 📊 RESUMO FINAL

| Fase | Semanas | Tarefas | Status |
|------|---------|---------|--------|
| 1: Segurança & DB | 3-4 | 4 tasks | ⏳ TODO |
| 2: APIs Core | 3-4 | 6 tasks | ⏳ TODO |
| 3: Infraestrutura | 2-3 | 8 tasks | ⏳ TODO |
| 4: Compliance | 1-2 | 10 tasks | ⏳ TODO |
| **TOTAL** | **15-20** | **28 tasks** | ⏳ TODO |

---

**Próximo passo:** Clonar este documento para Notion/Jira e começar pela Fase 1, Sprint 1.

