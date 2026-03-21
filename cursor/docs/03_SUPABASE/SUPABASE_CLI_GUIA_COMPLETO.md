# 🔧 SUPABASE CLI: GUIA COMPLETO

## O QUE É O CLI?

O Supabase CLI é uma ferramenta de terminal que te dá **autonomia total** sobre seu banco de dados.

Com ele você pode:
- ✅ Criar projetos via terminal
- ✅ Executar SQL migrations
- ✅ Gerar tipos TypeScript automaticamente
- ✅ Sincronizar schema
- ✅ Backup/restore
- ✅ Tudo sem abrir dashboard!

---

## PASSO 1: Instalar o CLI

### Opção A: npm (Recomendado)

```bash
npm install -g supabase
```

Verifique a instalação:
```bash
supabase --version
```

Saída esperada:
```
supabase-cli 1.x.x
```

### Opção B: Windows (Chocolatey)

```bash
choco install supabase
```

### Opção C: Windows (WinGet)

```bash
winget install supabase.cli
```

---

## PASSO 2: Login no Supabase

```bash
supabase login
```

Vai aparecer:
```
Enter your access token (or press Enter to open browser):
```

### Opção 1: Usar Browser (Mais Fácil)

Pressione **Enter** - browser abrirá automaticamente
- Acesse https://supabase.com/dashboard
- Vá para: Settings → Access Tokens
- Clique "Generate new token"
- Copie o token (começa com `sbp_...`)
- Cole no terminal

### Opção 2: Token Manual

```bash
supabase login --token seu-token-aqui
```

Sucesso:
```
✓ Logged in successfully
```

---

## PASSO 3: Criar Projeto via CLI

### Sem instância local (Recomendado)

```bash
supabase projects list
```

Você verá seus projetos Supabase existentes.

### Com instância local (Para desenvolvimento)

```bash
supabase start
```

Isso sobe Supabase **localmente** com:
- PostgreSQL rodando
- PostgREST API
- Supabase Studio (dashboard local)
- Real-time
- Auth local

Saída:
```
supabase local development started

API URL: http://localhost:54321
GraphQL URL: http://localhost:54321/graphql/v1
DB URL: postgresql://postgres:postgres@127.0.0.1:5432/postgres
Studio URL: http://localhost:54321

...
```

---

## PASSO 4: Inicializar Projeto

Na raiz do seu projeto:

```bash
supabase init
```

Cria a pasta `supabase/` com:

```
supabase/
├── config.toml          # Configurações do projeto
├── migrations/          # SQL migrations
│   └── .gitkeep
└── seed.sql             # Dados iniciais
```

---

## PASSO 5: Configurar Projeto

Edite `supabase/config.toml`:

```toml
# Supabase configuration

[api]
enabled = true
max_body_size = "20mb"
default_query_only = false

[auth]
enabled = true
site_url = "http://localhost:3000"
additional_redirect_urls = ["https://localhost:3000"]
jwt_expiry = 3600
enable_signup = true

[realtime]
enabled = true
max_bytes_per_second = 1000000

[studio]
enabled = true
port = 3000
```

---

## PASSO 6: Executar SQL Schema

### Opção A: Executar SQL Direto

```bash
supabase db push --file supabase/migrations/001_initial_schema.sql
```

### Opção B: Criar Migration

```bash
# Criar novo arquivo de migration
supabase migration new create_tables

# Isso cria: supabase/migrations/20240102120000_create_tables.sql
```

Edite o arquivo e adicione seu SQL:

```sql
-- supabase/migrations/20240102120000_create_tables.sql

CREATE TABLE public.ministries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- RLS
ALTER TABLE public.ministries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ministry"
  ON public.ministries FOR SELECT
  USING (user_id = auth.uid());
```

Execute:
```bash
supabase db push
```

---

## PASSO 7: Gerar Tipos TypeScript

### Automático (Do seu banco)

```bash
supabase gen types typescript --linked > src/types/supabase-generated.ts
```

Cria tipos baseados no schema real:

```typescript
// src/types/supabase-generated.ts
export interface Tables {
  ministries: {
    Row: {
      id: string
      user_id: string
      name: string
      created_at: string
    }
    Insert: {
      id?: string
      user_id: string
      name: string
      created_at?: string
    }
    Update: {
      id?: string
      user_id?: string
      name?: string
      created_at?: string
    }
  }
}
```

Use nos seus tipos:

```typescript
// src/types/supabase.ts
import { Tables } from './supabase-generated'

export type Ministry = Tables['ministries']['Row']
export type CreateMinistry = Tables['ministries']['Insert']
```

---

## PASSO 8: Sincronizar com Projeto Remoto

### Pull (Trazer schema do remoto)

```bash
supabase db pull
```

Isso cria migration baseada nas mudanças no Supabase remoto.

### Push (Enviar schema para remoto)

```bash
supabase db push
```

Executa todas as migrations não aplicadas.

---

## PASSO 9: Trabalhar com Migrations

### Ver status

```bash
supabase migration list
```

Mostra:
```
Local migrations:
  20240102120000_create_tables.sql
  20240102130000_add_members_table.sql

Remote migrations:
  20240102120000_create_tables.sql
```

### Reverter migration (Local)

```bash
supabase db reset
```

Zera e recria tudo (só local).

---

## PASSO 10: Parar Instância Local

```bash
supabase stop
```

Ou:

```bash
supabase stop --no-backup
```

---

## 📋 WORKFLOW RECOMENDADO

### Para Desenvolvimento Local

```bash
# 1. Inicializar
supabase init

# 2. Subir banco local
supabase start

# 3. Criar migration
supabase migration new add_custom_fields

# 4. Editar SQL em supabase/migrations/
# 5. Push local
supabase db push

# 6. Gerar tipos
supabase gen types typescript --linked > src/types/supabase-generated.ts

# 7. Usar tipos no código
# 8. Testar tudo

# 9. Parar
supabase stop
```

### Para Produção

```bash
# 1. Login (já fez)
supabase login

# 2. Link ao projeto
supabase link --project-ref seu-project-id

# 3. Ver mudanças
supabase db pull

# 4. Fazer migration
supabase migration new production_changes

# 5. Push para produção
supabase db push

# 6. Backup antes
supabase db backup
```

---

## 🔗 LINK PROJETO AO CLI

Se já tem projeto Supabase criado:

```bash
supabase link --project-ref seu-project-id
```

Onde `seu-project-id` é o ID do projeto (ex: `abcdefghijklmnop`).

Encontre em: Supabase Dashboard → Settings → General → Project ID

---

## 📊 ESTRUTURA DE PASTA

Após `supabase init`:

```
seu-projeto/
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 20240102120000_create_tables.sql
│   │   └── 20240102130000_add_members.sql
│   └── seed.sql
├── src/
│   └── types/
│       └── supabase-generated.ts
├── .env.local
└── package.json
```

---

## 🚀 COMANDOS ÚTEIS

### Listar tudo

```bash
supabase projects list          # Seus projetos
supabase migration list          # Migrations
supabase status                  # Status local
```

### Banco de dados

```bash
supabase db push                 # Aplicar migrations
supabase db pull                 # Trazer schema remoto
supabase db reset                # Resetar local
supabase db backup               # Fazer backup
```

### Gerar

```bash
supabase gen types typescript    # Tipos TS
supabase gen types typescript --linked  # Do schema real
```

### Desenvolvimento

```bash
supabase start                   # Subir local
supabase stop                    # Parar local
supabase restart                 # Reiniciar
```

---

## 🔐 .gitignore

Adicione ao `.gitignore`:

```
# Supabase
.supabase/
supabase/.env.local
.env.local

# Local development
node_modules/
.next/
```

---

## ⚡ FLUXO COMPLETO: DO ZERO À PRODUÇÃO

### Dia 1: Setup Local

```bash
# 1. Instalar CLI
npm install -g supabase

# 2. Login
supabase login

# 3. Inicializar projeto
supabase init

# 4. Subir banco local
supabase start

# 5. Copiar URL e credenciais para .env.local
# (aparecem no output)
```

### Dia 2: Desenvolver

```bash
# 1. Criar migration
supabase migration new initial_schema

# 2. Editar SQL em supabase/migrations/
# Seu SQL aqui!

# 3. Push local
supabase db push

# 4. Gerar tipos
supabase gen types typescript --linked > src/types/supabase-generated.ts

# 5. Usar tipos no código
```

### Dia 3: Produção

```bash
# 1. Link ao projeto remoto
supabase link --project-ref seu-project-id

# 2. Ver mudanças
supabase db pull

# 3. Criar migration
supabase migration new production_setup

# 4. Editar e push
supabase db push

# 5. Gerar tipos do remoto
supabase gen types typescript --linked > src/types/supabase-generated.ts
```

---

## 🆘 PROBLEMAS COMUNS

### ❌ "supabase command not found"

```bash
npm install -g supabase
```

### ❌ "Not logged in"

```bash
supabase login
```

### ❌ "Project not linked"

```bash
supabase link --project-ref seu-project-id
```

### ❌ "Migration failed"

Verifique SQL:
```bash
supabase migration list -v
```

### ❌ "Port already in use"

```bash
supabase start --exclude-services postgresql
```

Ou mude porta em `config.toml`.

---

## 📚 DOCUMENTAÇÃO

- CLI docs: https://supabase.com/docs/guides/cli
- Migrations: https://supabase.com/docs/guides/migration-guide
- Local dev: https://supabase.com/docs/guides/local-development

---

## ✅ CHECKLIST: CLI PRONTO

- [ ] CLI instalado (`supabase --version`)
- [ ] Login feito (`supabase login`)
- [ ] Projeto inicializado (`supabase init`)
- [ ] Banco local rodando (`supabase start`)
- [ ] .env.local preenchido
- [ ] Primeira migration criada
- [ ] Tipos gerados

---

## 🎯 PRÓXIMOS PASSOS

1. **Instale:** `npm install -g supabase`
2. **Login:** `supabase login`
3. **Inicie:** `supabase init`
4. **Suba:** `supabase start`
5. **Teste:** Copie dados de `.env.local`
6. **Desenvolva:** Crie migrations em `supabase/migrations/`
7. **Gere tipos:** `supabase gen types typescript --linked > src/types/supabase-generated.ts`

---

**Com o CLI, você tem total autonomia!** 🚀

