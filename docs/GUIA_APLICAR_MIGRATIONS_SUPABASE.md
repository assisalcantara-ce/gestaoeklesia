# 🚀 Guia de Aplicação de Migrações - Supabase

**Data**: 19 de abril de 2026  
**Status**: Servidor de desenvolvimento rodando ✅  
**Docker**: Não é necessário

---

## 📋 Migrações Pendentes

Há 6 migrações críticas que precisam ser aplicadas:

1. **`20260416110000_ebd_module.sql`** — Módulo EBD completo (13 tabelas)
2. **`20260416120000_ebd_ofertas_aula_unique.sql`** — Fix constraint
3. **`20260417000000_carta_pedidos.sql`** — Pedidos de Cartas Ministeriais
4. **`20260416200000_tesouraria_add_member_id.sql`** — Link Tesouraria ↔ Members
5. **`20260416220000_ebd_superintendentes.sql`** — Superintendentes EBD
6. **`20260416230000_ebd_trimestres.sql`** — Trimestres EBD

---

## ✅ MÉTODO: SQL Editor do Supabase (via Web)

### Passo 1: Acessar o SQL Editor

1. Abra: [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecione o projeto: **`qspueosxkolmwvibhzkt`** (ou procure por "gestaoeklesia")
3. No menu esquerdo, clique em **SQL Editor**
4. Você verá a página em branco pronta para SQL

---

### Passo 2: Executar cada migração em sequência

**Para cada migration abaixo:**

1. Copie o **bloco SQL completo** (linha por linha)
2. Cole no editor SQL
3. Clique em **"Run"** (botão azul no canto superior direito)
4. Aguarde mensagem: `✅ Success` (fundo verde)
5. Repita para a próxima

---

## 📝 SQL para Executar

### 1️⃣ Migração: EBD Module (13 tabelas)

**Arquivo**: `supabase/migrations/20260416110000_ebd_module.sql`

```sql
-- Copie todo o conteúdo de: supabase/migrations/20260416110000_ebd_module.sql
-- Cole aqui no SQL Editor e execute
```

**Local do arquivo no repositório:**
```
c:\BACKUP\DESENVOLVIMENTO\gestaoeklesia\supabase\migrations\20260416110000_ebd_module.sql
```

---

### 2️⃣ Migração: EBD Ofertas Aula Unique

**Arquivo**: `supabase/migrations/20260416120000_ebd_ofertas_aula_unique.sql`

```sql
-- Copie todo o conteúdo de: supabase/migrations/20260416120000_ebd_ofertas_aula_unique.sql
-- Cole aqui no SQL Editor e execute
```

---

### 3️⃣ Migração: Cartas Pedidos

**Arquivo**: `supabase/migrations/20260417000000_carta_pedidos.sql`

```sql
-- Copie todo o conteúdo de: supabase/migrations/20260417000000_carta_pedidos.sql
-- Cole aqui no SQL Editor e execute
```

---

### 4️⃣ Migração: Tesouraria Add Member ID

**Arquivo**: `supabase/migrations/20260416200000_tesouraria_add_member_id.sql`

```sql
-- Copie todo o conteúdo de: supabase/migrations/20260416200000_tesouraria_add_member_id.sql
-- Cole aqui no SQL Editor e execute
```

---

### 5️⃣ Migração: EBD Superintendentes

**Arquivo**: `supabase/migrations/20260416220000_ebd_superintendentes.sql`

```sql
-- Copie todo o conteúdo de: supabase/migrations/20260416220000_ebd_superintendentes.sql
-- Cole aqui no SQL Editor e execute
```

---

### 6️⃣ Migração: EBD Trimestres

**Arquivo**: `supabase/migrations/20260416230000_ebd_trimestres.sql`

```sql
-- Copie todo o conteúdo de: supabase/migrations/20260416230000_ebd_trimestres.sql
-- Cole aqui no SQL Editor e execute
```

---

## 🔗 Links Rápidos

- **Supabase Dashboard**: https://supabase.com/dashboard
- **SQL Editor do projeto**: https://supabase.com/dashboard/project/qspueosxkolmwvibhzkt/sql
- **Servidor local**: http://localhost:3000

---

## 📋 Checklist pós-aplicação

Após aplicar todas as 6 migrações:

- [ ] 1. Verificar no SQL Editor se as tabelas EBD foram criadas
  - Execute: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'ebd_%';`
  - Deve listar 13+ tabelas

- [ ] 2. Verificar tabela `carta_pedidos`
  - Execute: `SELECT * FROM carta_pedidos LIMIT 1;`
  - Deve retornar 0 linhas (nova tabela vazia) sem erro

- [ ] 3. Verificar RLS está habilitado
  - Execute: `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('ebd_classes', 'carta_pedidos');`

- [ ] 4. Testar a aplicação no navegador
  - Acesse: http://localhost:3000/admin/login
  - Faça login
  - Navegue para **EBD** no menu
  - Tente criar uma turma (para validar permissões)

---

## ⚠️ Se houver erro

**Mensagem típica**: `"duplicate key value violates unique constraint"`

**Solução**: A migração já foi aplicada. Prossiga para a próxima.

**Mensagem**: `"permission denied for schema public"`

**Solução**: Você não tem permissão de admin. Acesse como owner do projeto.

---

## 🛠️ Suporte

Se precisar debugar:

1. Acesse o **SQL Editor** → **Logs** (canto inferior)
2. Procure pela migração que falhou
3. Copie o erro completo e analise

---

**Próximos passos** (após migrações aplicadas):
- [ ] Testar fluxo EBD: Chamada → Oferta → Integração
- [ ] Testar fluxo Cartas: Solicitar → Aprovar → Imprimir
- [ ] Validar permissões por nível de acesso
