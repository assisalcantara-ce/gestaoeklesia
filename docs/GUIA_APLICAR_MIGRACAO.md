# 🎯 Guia Rápido: Aplicar Migração do Banco de Dados

## 📋 O que fazer agora

Para que o formulário expandido funcione completamente, você precisa adicionar 13 novos campos à tabela `pre_registrations` no Supabase.

---

## ✅ OPÇÃO 1: Via Dashboard Supabase (Recomendado)

### Passo 1: Abrir SQL Editor

```
1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto: gestaoeklesia
3. Clique em: SQL Editor (na barra lateral)
4. Clique em: + New Query
```

### Passo 2: Copiar e colar o SQL

Copie TODO o conteúdo abaixo:

```sql
-- ============================================
-- EXPANSÃO DA TABELA PRE_REGISTRATIONS
-- Adicionar campos para capturar todas as informações do assinante
-- ============================================

ALTER TABLE public.pre_registrations 
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS website VARCHAR(255),
ADD COLUMN IF NOT EXISTS responsible_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS quantity_temples INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS quantity_members INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS address_street VARCHAR(255),
ADD COLUMN IF NOT EXISTS address_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS address_complement VARCHAR(255),
ADD COLUMN IF NOT EXISTS address_city VARCHAR(100),
ADD COLUMN IF NOT EXISTS address_state VARCHAR(2),
ADD COLUMN IF NOT EXISTS address_zip VARCHAR(10),
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'starter';

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_pre_registrations_plan ON public.pre_registrations(plan);
CREATE INDEX IF NOT EXISTS idx_pre_registrations_city ON public.pre_registrations(address_city);

-- Comentários para documentar os novos campos
COMMENT ON COLUMN public.pre_registrations.phone IS 'Telefone de contato do ministério';
COMMENT ON COLUMN public.pre_registrations.website IS 'Website/URL do ministério';
COMMENT ON COLUMN public.pre_registrations.responsible_name IS 'Nome do responsável/pastor';
COMMENT ON COLUMN public.pre_registrations.quantity_temples IS 'Quantidade de igrejas/templos';
COMMENT ON COLUMN public.pre_registrations.quantity_members IS 'Quantidade de membros';
COMMENT ON COLUMN public.pre_registrations.address_street IS 'Rua do endereço';
COMMENT ON COLUMN public.pre_registrations.address_number IS 'Número do endereço';
COMMENT ON COLUMN public.pre_registrations.address_complement IS 'Complemento do endereço';
COMMENT ON COLUMN public.pre_registrations.address_city IS 'Cidade';
COMMENT ON COLUMN public.pre_registrations.address_state IS 'Estado (UF)';
COMMENT ON COLUMN public.pre_registrations.address_zip IS 'CEP';
COMMENT ON COLUMN public.pre_registrations.description IS 'Descrição do ministério';
COMMENT ON COLUMN public.pre_registrations.plan IS 'Plano contratado (starter, professional, enterprise)';
```

### Passo 3: Executar

```
1. Cola o SQL na janela de Query
2. Clique em: RUN (botão azul)
3. Aguarde a confirmação de sucesso
```

**Resposta esperada:**
```
Query succeeded. No results returned.
```

---

## ✅ OPÇÃO 2: Via arquivo migração (Supabase CLI)

Se você tem Supabase CLI instalado:

```bash
# Na pasta do projeto
supabase db pull

# Agora execute a migração
supabase migration up
```

---

## ✅ OPÇÃO 3: Via arquivo SQL direto

```bash
# Copie o arquivo SQL da migração
cat supabase/migrations/20260108_expand_pre_registrations.sql | psql -h db.supabase.co -U postgres -d postgres
```

---

## ✅ Verificar se funcionou

Após executar a migração:

### No Supabase Dashboard:
```
1. Clique em: Tables (barra lateral)
2. Selecione: pre_registrations
3. Deslize a tabela para a DIREITA
4. Você deve ver os novos campos:
   - phone
   - website
   - responsible_name
   - address_zip, address_street, address_number, etc
   - quantity_temples, quantity_members
   - description
   - plan
```

### Via SQL:
```sql
-- Execute esta query para confirmar
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'pre_registrations' 
ORDER BY ordinal_position;
```

---

## 🧪 Teste o Formulário

Após aplicar a migração:

```
1. Acesse: http://localhost:3000/admin/ministerios
2. Na aba "Pré-Cadastros (Trial)", clique em um pré-registro
3. Clique em "Detalhes"
4. Na página que abre, clique em "✏️ Atualizar Status"
5. Um MODAL com 8 SEÇÕES deve abrir
6. Preencha os campos e clique em "💾 Salvar Mudanças"
7. Recarregue a página
8. Os dados devem estar salvos!
```

---

## 🆘 Troubleshooting

### Erro: "Relation 'public.pre_registrations' does not exist"
- ❌ A tabela não foi criada
- ✅ Procure criar `pre_registrations` primeiro

### Erro: "Column already exists"
- ℹ️ Significa que a migração já foi aplicada
- ✅ Tudo funciona normalmente

### Modal ainda mostra campos vazios
- ❌ Migração não foi aplicada
- ✅ Abra as Developer Tools (F12) > Console
- ✅ Procure por erros de API

### Erro ao salvar no modal
- ❌ Verifique F12 > Network tab
- ✅ O erro exato deve aparecer ali
- ✅ Envie a mensagem de erro

---

## 📊 Campos Adicionados

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `phone` | VARCHAR(20) | NULL | Telefone |
| `website` | VARCHAR(255) | NULL | Website |
| `responsible_name` | VARCHAR(255) | NULL | Responsável |
| `quantity_temples` | INTEGER | 1 | Nº Templos |
| `quantity_members` | INTEGER | 0 | Nº Membros |
| `address_street` | VARCHAR(255) | NULL | Rua |
| `address_number` | VARCHAR(20) | NULL | Número |
| `address_complement` | VARCHAR(255) | NULL | Complemento |
| `address_city` | VARCHAR(100) | NULL | Cidade |
| `address_state` | VARCHAR(2) | NULL | Estado |
| `address_zip` | VARCHAR(10) | NULL | CEP |
| `description` | TEXT | NULL | Descrição |
| `plan` | VARCHAR(50) | 'starter' | Plano |

---

## ⏱️ Tempo estimado

- **Opção 1 (Dashboard)**: 2 minutos
- **Opção 2 (CLI)**: 5 minutos  
- **Opção 3 (SQL direto)**: 1 minuto

---

## ✨ Próximos passos

Após aplicar a migração:

```
1. ✅ Testar o formulário expandido
2. ✅ Preencher alguns registros de teste
3. ✅ Verificar dados salvos no Supabase
4. ✅ Testar fluxo completo (aprovar → editar → salvar)
5. ✅ Testar mudança de status do atendimento
```

---

## 📞 Suporte

Se algo der errado:
1. Verifique a mensagem de erro exata
2. Certifique-se de estar usando o banco de dados correto
3. Verifique permissões do usuário Postgres
4. Tente novamente a migração

---

**Data**: 08 de Janeiro de 2026
**Versão**: 1.0
