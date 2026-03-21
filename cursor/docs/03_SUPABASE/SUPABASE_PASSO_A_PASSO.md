# 🚀 GUIA PRÁTICO: COMEÇANDO COM SUPABASE

## Passo 1️⃣: Criar Conta Supabase

1. Acesse [https://supabase.com](https://supabase.com)
2. Clique em **"Start your project"**
3. Selecione **GitHub** (mais fácil) ou email
4. Complete autenticação
5. Você vai para o dashboard

---

## Passo 2️⃣: Criar Novo Projeto

1. No dashboard, clique **"+ New Project"**
2. Preencha:
   - **Project name:** `gestaoeklesia` (ou nome único)
   - **Database password:** Use algo forte! Guarde bem.
   - **Region:** Escolha mais próximo (ex: `South America - São Paulo`)
3. Clique **"Create new project"**
4. ⏳ Aguarde criação (~2-3 min)

---

## Passo 3️⃣: Copiar Credenciais

Uma vez criado o projeto, vá para **Settings → API**

Você verá:

```
Project URL: https://seu-projeto.supabase.co
Anon Key: eyJhbGcjVCJ9... (começarão com "ey")
Service Role Key: eyJhbGcjVCJ9... (começarão com "ey")
```

**CUIDADO:** 
- ✅ `Anon Key` = pode compartilhar (está no `.env.local` público)
- ⚠️ `Service Role Key` = NUNCA compartilhe! Guardado em `.env.local` (privado)

---

## Passo 4️⃣: Criar Arquivo `.env.local`

Na **raiz do seu projeto** (mesma pasta de `package.json`), crie:

```bash
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGcjVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGcjVCJ9...
```

⚠️ **Git será ignora esse arquivo automaticamente** (já está em `.gitignore`)

---

## Passo 5️⃣: Instalar Pacotes

```bash
npm install @supabase/supabase-js @supabase/ssr
```

---

## Passo 6️⃣: Executar SQL Schema

1. No dashboard Supabase, vá para **SQL Editor**
2. Clique **"+ New Query"**
3. Copie TODO o conteúdo de `SUPABASE_SCHEMA_COMPLETO.sql`
4. Cole na query
5. Clique **"Run"**

✅ Se aparecer "Success", todas as 9 tabelas foram criadas!

---

## Passo 7️⃣: Testar Conexão

Crie arquivo `test-supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function test() {
  // Teste 1: Conectar
  console.log('✓ Cliente criado')

  // Teste 2: Listar tabelas
  const { data, error } = await supabase
    .from('ministries')
    .select('count', { count: 'exact' })

  if (error) {
    console.error('❌ Erro:', error)
    return
  }

  console.log('✓ Conexão funcionando!')
  console.log('✓ Ministries encontrados:', data)
}

test()
```

Execute:
```bash
npx ts-node test-supabase.ts
```

---

## Passo 8️⃣: Criar Primeiro Usuário

No dashboard Supabase, vá para **Auth → Users**

Clique **"+ Add user"** e preencha:
- Email: `seu-email@exemplo.com`
- Password: Uma senha forte
- Confirme a senha

Clique **"Create user"**

---

## Passo 9️⃣: Criar Primeiro Ministry

Precisa fazer via API ou SQL. Vou mostrar como criar via SQL:

```sql
-- SQL no Supabase SQL Editor
INSERT INTO public.ministries (
  user_id,
  name,
  slug,
  email_admin,
  plan,
  subscription_status
) VALUES (
  'UUID-DO-USUARIO-QUE-CRIOU-ACIMA', -- Copie o ID do usuário
  'Meu Ministério',
  'meu-ministerio',
  'seu-email@exemplo.com',
  'starter',
  'active'
);
```

---

## 🔟 Adicionar Usuário ao Ministry

```sql
INSERT INTO public.ministry_users (
  ministry_id,
  user_id,
  role,
  is_active
) VALUES (
  'UUID-DO-MINISTRY', -- Da query anterior
  'UUID-DO-USUARIO',  -- Do usuario criado
  'admin',
  true
);
```

---

## ✅ Checklist de Conclusão

- [ ] Conta Supabase criada
- [ ] Projeto criado com sucesso
- [ ] Credenciais copiadas (URL + 2 keys)
- [ ] `.env.local` criado com as chaves
- [ ] `@supabase/supabase-js` instalado
- [ ] SQL schema executado (9 tabelas)
- [ ] Conexão testada com sucesso
- [ ] Primeiro usuário criado
- [ ] Primeiro ministry criado
- [ ] Ministry_users linkando usuário + ministry

---

## 🆘 Problemas Comuns

### "Cannot find module @supabase/supabase-js"
```bash
npm install @supabase/supabase-js --save
npm install @supabase/ssr --save
```

### "SUPABASE_URL is required"
Cheque se `.env.local` tem as variáveis corretas (sem prefixo `NEXT_PUBLIC_` para service role)

### "RLS policy error"
Você provavelmente está tentando acessar dados de outro ministry. Isso é intencional! O RLS está funcionando.

### SQL schema com erro
Copie novamente e certifique que não tem erros de sintaxe. Se persistir, execute uma tabela por vez.

---

## 📚 Próximas Ações

1. **Instalar Prisma** (opcional, mas recomendado para type safety)
2. **Criar API routes** para CRUD de members
3. **Migrar autenticação** para Supabase Auth
4. **Criar componentes** que usam real database

**Tudo pronto? Quer que eu mostre como criar a primeira API route?** 🚀

