# Integração Completa: Funcionários com Supabase

## 📋 Resumo da Solução

Agora o formulário de funcionários está **totalmente conectado ao Supabase**. Todos os dados são salvos no banco de dados, não mais no localStorage.

## ✅ O que foi implementado

### 1. **Tabela no Supabase** (`public.employees`)
**Arquivo:** `supabase/migrations/20260102200944_initial_schema.sql`

```sql
CREATE TABLE public.employees (
  id UUID PRIMARY KEY,
  ministry_id UUID NOT NULL,
  member_id UUID NOT NULL,
  
  -- Profissional
  grupo VARCHAR(100) NOT NULL,
  funcao VARCHAR(100) NOT NULL,
  data_admissao DATE NOT NULL,
  
  -- Contato
  email VARCHAR(255),
  telefone VARCHAR(20),
  whatsapp VARCHAR(20),
  
  -- Documentação
  rg VARCHAR(20),
  
  -- Endereço
  endereco VARCHAR(500),
  cep VARCHAR(20),
  bairro VARCHAR(100),
  cidade VARCHAR(100),
  uf VARCHAR(2),
  
  -- Financeiros
  banco VARCHAR(50),
  agencia VARCHAR(20),
  conta_corrente VARCHAR(20),
  pix VARCHAR(255),
  
  -- Adicional
  obs TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'ATIVO',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**RLS Policies:** Dados isolados por ministry (cada ministério vê apenas seus funcionários)

### 2. **View Útil** (`employees_with_member_info`)
Combina dados de funcionários com informações do membro:
- Nome, CPF, Data de Nascimento do membro
- Todos os dados do funcionário

### 3. **APIs REST** (`/api/v1/employees`)

#### GET - Listar Funcionários
```bash
GET /api/v1/employees?ministry_id={id}&status=ATIVO&grupo=administrativo
```
Query params:
- `ministry_id` - Obrigatório
- `page` - Número da página (padrão: 1)
- `limit` - Itens por página (padrão: 20)
- `status` - Filtrar (ATIVO/INATIVO)
- `grupo` - Filtrar por grupo

#### POST - Criar Funcionário
```javascript
POST /api/v1/employees

{
  "ministry_id": "uuid",
  "member_id": "uuid",
  "grupo": "administrativo",
  "funcao": "gerente",
  "data_admissao": "2025-01-02",
  "email": "email@example.com",
  "telefone": "(11) 99999-9999",
  "whatsapp": "(11) 99999-9999",
  "rg": "12.345.678-9",
  "endereco": "Rua X, 123",
  "cep": "01000-000",
  "bairro": "Centro",
  "cidade": "São Paulo",
  "uf": "SP",
  "banco": "BB",
  "agencia": "1234",
  "conta_corrente": "567890",
  "pix": "chave@pix",
  "obs": "Notas adicionais",
  "status": "ATIVO"
}
```

#### DELETE - Deletar Funcionário
```bash
DELETE /api/v1/employees/{id}
```

#### PATCH - Atualizar Funcionário
```bash
PATCH /api/v1/employees/{id}
{
  "status": "INATIVO",
  "funcao": "assistente",
  ...
}
```

### 4. **Frontend Atualizado**
**Arquivo:** `src/app/secretaria/funcionarios/page.tsx`

**Mudanças:**
- ✅ Busca de membros agora vem do Supabase (API `/api/v1/members`)
- ✅ Funcionários carregados via API (`/api/v1/employees`)
- ✅ Cadastro envia para API (não localStorage)
- ✅ Deleção faz requisição DELETE à API
- ✅ Campos automaticamente preenchidos com dados do membro

## 🔄 Fluxo de Dados

```
1. Usuário abre /secretaria/funcionarios
   ↓
2. Carrega membros da API (/api/v1/members)
   ↓
3. Usuário digita nome/CPF para buscar
   ↓
4. Seleciona membro → Dados preenchidos automaticamente
   ↓
5. Preenche campos extras (grupo, função, endereço, etc)
   ↓
6. Clica em CADASTRAR
   ↓
7. Dados enviados para API (/api/v1/employees - POST)
   ↓
8. API salva no Supabase com isolamento por ministry
   ↓
9. Lista recarregada automaticamente
```

## 🔐 Segurança

✅ **Row Level Security (RLS)**
- Cada funcionário pertence a um `ministry_id`
- Usuários só veem dados do seu ministério
- Impossível acessar dados de outro ministério

✅ **Validações**
- `ministry_id`, `member_id`, `grupo`, `funcao`, `data_admissao` são obrigatórios
- Status validado (ATIVO/INATIVO)
- Isolamento por ministério em toda a stack

## 📱 Próximos Passos

1. **Executar Migration**
   ```bash
   # No Supabase Dashboard, executar a migration ou aplicar via CLI
   supabase migration up
   ```

2. **Testar**
   - Cadastrar novo funcionário
   - Verificar se aparece no Supabase
   - Listar funcionários
   - Deletar funcionário

3. **Melhorias Futuras**
   - Edição de funcionário existente (já tem PATCH)
   - Exportar relatório de funcionários
   - Importar de planilha
   - Histórico de mudanças (auditoria)

## 📊 Estrutura de Dados

```typescript
interface Funcionario {
  id: string;                    // UUID (gerado automaticamente)
  ministry_id: string;           // UUID do ministério
  member_id: string;             // UUID do membro vinculado
  
  // Profissional
  grupo: string;                 // administrativo, financeiro, etc
  funcao: string;                // gerente, assistente, etc
  data_admissao: string;         // YYYY-MM-DD
  
  // Contato
  email?: string;
  telefone?: string;
  whatsapp?: string;
  
  // Documentação
  rg?: string;
  
  // Endereço
  endereco?: string;
  cep?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  
  // Financeiro
  banco?: string;
  agencia?: string;
  conta_corrente?: string;
  pix?: string;
  
  // Adicional
  obs?: string;
  status: 'ATIVO' | 'INATIVO';
  
  // Metadata
  created_at: string;
  updated_at: string;
  
  // Info do membro (preenchida automaticamente pela view)
  member_name?: string;
  member_cpf?: string;
  member_phone?: string;
  member_birth_date?: string;
}
```

## 🎯 Arquivos Modificados

1. **`supabase/migrations/20260102200944_initial_schema.sql`**
   - ✅ Adicionada tabela `employees`
   - ✅ Adicionada view `employees_with_member_info`
   - ✅ Atualizada view `ministries_with_stats`

2. **`src/app/api/v1/employees/route.ts`**
   - ✅ Nova API GET/POST para funcionários

3. **`src/app/api/v1/employees/[id]/route.ts`**
   - ✅ Nova API GET/DELETE/PATCH por ID

4. **`src/app/secretaria/funcionarios/page.tsx`**
   - ✅ Atualizado para usar APIs Supabase
   - ✅ Removida dependência de localStorage

---

**Status:** ✅ Implementado e Pronto para Deploy
