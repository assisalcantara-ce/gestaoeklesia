# Migração do Módulo Funcionários

## 📋 Visão Geral

O módulo de **Funcionários** gerencia a equipe de trabalho vinculada à instituição, com informações completas de cadastro, contato e dados bancários.

**Status:** ✅ Totalmente Implementado  
**Migração:** `supabase/migrations/modulo_funcionarios.sql`  
**Frontend:** `src/app/secretaria/funcionarios/page.tsx`

---

## 🗄️ Estrutura do Banco de Dados

### Tabela: `employees`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único (PK) |
| `ministry_id` | UUID | Referência ao ministério (FK) |
| `member_id` | UUID | Referência ao membro (FK) |
| `grupo` | VARCHAR(100) | Grupo funcional (Administrativo, Financeiro, etc.) |
| `funcao` | VARCHAR(100) | Função/cargo (Gerente, Assistente, etc.) |
| `data_admissao` | DATE | Data de admissão |
| `email` | VARCHAR(255) | Email corporativo |
| `telefone` | VARCHAR(20) | Telefone de contato |
| `whatsapp` | VARCHAR(20) | WhatsApp |
| `rg` | VARCHAR(20) | RG |
| `endereco` | VARCHAR(500) | Endereço residencial |
| `cep` | VARCHAR(20) | CEP |
| `bairro` | VARCHAR(100) | Bairro |
| `cidade` | VARCHAR(100) | Cidade |
| `uf` | VARCHAR(2) | Estado (UF) |
| `banco` | VARCHAR(50) | Banco (BB, CEF, ITAU, etc.) |
| `agencia` | VARCHAR(20) | Agência bancária |
| `conta_corrente` | VARCHAR(20) | Número da conta |
| `pix` | VARCHAR(255) | Chave PIX |
| `obs` | TEXT | Observações |
| `status` | VARCHAR(50) | ATIVO ou INATIVO |
| `created_at` | TIMESTAMP | Criado em |
| `updated_at` | TIMESTAMP | Atualizado em |

#### Constraint:
```sql
CHECK (status IN ('ATIVO', 'INATIVO'))
```

#### Índices:
- `idx_employees_ministry_id` - para queries por ministério
- `idx_employees_member_id` - para queries por membro
- `idx_employees_status` - para filtros de status
- `idx_employees_grupo` - para filtros por grupo

---

## 🔐 Segurança (Row Level Security)

### Políticas RLS

**SELECT:** Usuário é membro do ministério (via `ministry_users`) OU proprietário do ministério

```sql
EXISTS (SELECT 1 FROM ministry_users WHERE user_id = auth.uid() 
  AND ministry_id = employees.ministry_id)
OR EXISTS (SELECT 1 FROM ministries WHERE id = employees.ministry_id 
  AND user_id = auth.uid())
```

**INSERT/UPDATE/DELETE:** Mesmas condições de SELECT

---

## 📊 View: `employees_with_member_info`

Junta dados de funcionários com informações do membro vinculado:

```sql
SELECT
  e.*, 
  m.name AS member_name,
  m.cpf AS member_cpf,
  m.phone AS member_phone,
  m.data_nascimento AS member_birth_date
```

**Uso:** Queries que precisam de dados do membro associado

---

## 🔄 Sincronização com Members

O módulo mantém referência com a tabela `members`:
- Cada funcionário DEVE ser um membro cadastrado
- Dados do membro (nome, CPF, telefone) são preenchidos automaticamente
- Permite cadastro de dados adicionais específicos para o funcionário (banco, PIX, etc.)

---

## 🌐 Endpoints da API

### GET `/api/v1/employees`

Retorna lista de funcionários do ministério autenticado.

**Query Params:**
- `limit` - Número de registros (default: 100)
- `offset` - Paginação (default: 0)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "ministry_id": "uuid",
      "member_id": "uuid",
      "grupo": "administrativo",
      "funcao": "gerente",
      "data_admissao": "2024-01-15",
      "email": "funcionario@email.com",
      "status": "ATIVO",
      "member_name": "João Silva",
      "member_cpf": "123.456.789-00"
    }
  ]
}
```

### POST `/api/v1/employees`

Cria novo funcionário.

**Body:**
```json
{
  "member_id": "uuid",
  "grupo": "administrativo",
  "funcao": "gerente",
  "data_admissao": "2024-01-15",
  "email": "func@email.com",
  "telefone": "(11) 99999-9999",
  "whatsapp": "(11) 99999-9999",
  "rg": "1234567",
  "endereco": "Rua X, 123",
  "cep": "01234-567",
  "bairro": "Centro",
  "cidade": "São Paulo",
  "uf": "SP",
  "banco": "BB",
  "agencia": "1234",
  "conta_corrente": "123456-7",
  "pix": "chave@pix",
  "obs": "Observações",
  "status": "ATIVO"
}
```

### PUT `/api/v1/employees/:id`

Atualiza funcionário existente.

### DELETE `/api/v1/employees/:id`

Deleta funcionário.

---

## 🖥️ Interface Frontend

### Localização: `src/app/secretaria/funcionarios/page.tsx`

#### Fluxo de Uso:

1. **Abas:** Cadastro | Lista
2. **Cadastro:**
   - Buscar e selecionar membro
   - Preencher dados adicionais (banco, PIX, etc.)
   - Salvar funcionário
3. **Lista:**
   - Filtrar por grupo e status
   - Visualizar/editar/deletar funcionários

#### Grupos Padrão:
- Administrativo
- Financeiro
- Pastoral
- Manutenção
- Segurança
- Limpeza
- Eventos
- *Personalizados via localStorage*

#### Funções Padrão:
- Gerente
- Assistente
- Especialista
- Operacional
- Supervisor
- *Personalizadas via localStorage*

#### Bancos Suportados:
- Banco do Brasil (BB)
- Caixa Econômica Federal (CEF)
- Itaú
- Bradesco
- Santander
- Nubank
- Inter

---

## 📦 Integração com Outros Módulos

### Depende De:
- ✅ `ministries` - Ministério pai
- ✅ `members` - Membro vinculado
- ✅ `ministry_users` - Permissões

### Usado Por:
- Folha de pagamento (futuro)
- Relatórios de recursos humanos
- Organograma da instituição

---

## 🚀 Como Usar

### Para o Admin/User:

1. Acesse: `http://localhost:3000/secretaria/funcionarios`
2. **Aba Cadastro:**
   - Digite o nome do membro na busca
   - Selecione o membro da lista
   - Preencha os dados adicionais
   - Selecione grupo e função
   - Clique em "Salvar"

3. **Aba Lista:**
   - Veja todos os funcionários
   - Filtre por grupo ou status
   - Edite ou delete funcionários

### Campos Opcionais:
- Email corporativo
- Telefone/WhatsApp
- RG
- Dados de endereço
- Dados bancários
- Observações

### Campos Obrigatórios:
- Membro
- Grupo
- Função
- Data de admissão
- Status

---

## 🔧 Manutenção

### Backup de Dados:
```sql
SELECT * FROM employees;
SELECT * FROM employees_with_member_info;
```

### Restauração:
Re-executar a migration `modulo_funcionarios.sql` (é idempotente)

### Verificar Integridade:
```sql
-- Encontrar funcionários com membro inválido
SELECT * FROM employees e
WHERE NOT EXISTS (SELECT 1 FROM members m WHERE m.id = e.member_id);
```

---

## 📝 Histórico

| Data | Alteração |
|------|-----------|
| 2024-01-XX | Migração criada com suporte completo a funcionários |
| 2024-01-XX | Frontend implementado com grupos/funções customizáveis |
| 2024-01-XX | RLS configurada para multi-tenant seguro |

---

## 🤝 Suporte

Para dúvidas sobre o módulo, consulte:
1. [API Documentation](./INDICE_DOCUMENTACAO.md)
2. [RLS Security Model](./docs/AI_MULTI_TENANT_SECURITY.md)
3. [Database Schema](./schema.sql)
