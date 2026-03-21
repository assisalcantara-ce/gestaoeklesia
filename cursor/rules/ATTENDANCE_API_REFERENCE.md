# 📡 API Reference - Painel de Atendimento

## Base URL
```
http://localhost:3000/api/v1/admin
```

---

## 🎯 Attendance (Gerenciar Atendimentos)

### GET /attendance
**Listar atendimentos com filtros**

**Query Parameters:**
```
status?        (string) - Filtrar por status (opcional)
page?          (number) - Página (padrão: 1)
limit?         (number) - Itens por página (padrão: 10)
```

**Exemplo:**
```bash
curl "http://localhost:3000/api/v1/admin/attendance?status=in_progress&page=1&limit=50"
```

**Resposta (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "pre_registration_id": "550e8400-e29b-41d4-a716-446655440001",
      "status": "in_progress",
      "notes": "Cliente muito interessado",
      "assigned_to": null,
      "last_contact_at": "2026-01-05T10:30:00Z",
      "next_followup_at": "2026-01-07T10:30:00Z",
      "created_at": "2026-01-01T08:00:00Z",
      "updated_at": "2026-01-05T10:30:00Z",
      "pre_registration": {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "ministry_name": "Igreja Pentecostal",
        "pastor_name": "João Silva",
        "email": "joao@example.com",
        "whatsapp": "85988887777",
        "cpf_cnpj": "111.222.333-44",
        "quantity_temples": 3,
        "quantity_members": 450,
        "status": "active",
        "trial_expires_at": "2026-01-12T08:00:00Z",
        "created_at": "2026-01-01T08:00:00Z"
      },
      "attendance_history": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440002",
          "to_status": "in_progress",
          "changed_by": "admin@example.com",
          "created_at": "2026-01-05T10:30:00Z"
        }
      ]
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 10,
    "pages": 5
  }
}
```

**Erros:**
```json
// 401 Unauthorized
{ "success": false, "error": "Unauthorized" }

// 500 Internal Server Error
{ "success": false, "error": "Internal server error" }
```

---

### POST /attendance
**Criar novo atendimento**

**Body:**
```json
{
  "pre_registration_id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "not_contacted",
  "notes": "Novo lead",
  "assigned_to": null
}
```

**Resposta (201):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440003",
    "pre_registration_id": "550e8400-e29b-41d4-a716-446655440001",
    "status": "not_contacted",
    "notes": "Novo lead",
    "assigned_to": null,
    "created_at": "2026-01-05T10:30:00Z",
    "updated_at": "2026-01-05T10:30:00Z"
  },
  "meta": { "action": "created" }
}
```

**Erros:**
```json
// 400 Bad Request
{ "success": false, "error": "pre_registration_id é obrigatório" }

// 404 Not Found
{ "success": false, "error": "Pré-registro não encontrado" }
```

---

### PUT /attendance
**Atualizar atendimento**

**Body:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "status": "in_progress",
  "notes": "Contactado via WhatsApp",
  "assigned_to": null,
  "last_contact_at": "2026-01-05T14:00:00Z",
  "next_followup_at": "2026-01-07T14:00:00Z"
}
```

**Resposta (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440003",
    "pre_registration_id": "550e8400-e29b-41d4-a716-446655440001",
    "status": "in_progress",
    "notes": "Contactado via WhatsApp",
    "assigned_to": null,
    "last_contact_at": "2026-01-05T14:00:00Z",
    "next_followup_at": "2026-01-07T14:00:00Z",
    "updated_at": "2026-01-05T14:00:00Z"
  }
}
```

---

## 🔑 Test Credentials (Credenciais de Teste)

### POST /test-credentials
**Gerar credenciais de teste**

**Body:**
```json
{
  "pre_registration_id": "550e8400-e29b-41d4-a716-446655440001",
  "email": "joao@example.com"
}
```

**Resposta (201):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440004",
    "username": "test_1704462600",
    "password": "a7x3k9p2q8v1",
    "email": "test_1704462600@test.local",
    "temp_ministry_id": "550e8400-e29b-41d4-a716-446655440005",
    "expires_at": "2026-01-12T10:30:00Z",
    "access_url": "http://localhost:3000/auth/login"
  },
  "message": "Credenciais de teste geradas com sucesso! Válidas por 7 dias."
}
```

**O que é criado:**
```
✓ Usuário em auth.users (email: test_TIMESTAMP@test.local)
✓ Ministério temporário (TESTE - [Nome da Igreja])
✓ Entrada em test_credentials (ativa por 7 dias)
✓ Adiciona user como admin da ministry
```

**Erros:**
```json
// 400 Bad Request
{ "success": false, "error": "pre_registration_id e email são obrigatórios" }

// 404 Not Found
{ "success": false, "error": "Pré-registro não encontrado" }

// 500 Internal Server Error
{ "success": false, "error": "Erro ao criar usuário de teste" }
```

---

### GET /test-credentials/:id
**Obter credenciais de teste**

**Path Parameters:**
```
id (string) - pre_registration_id
```

**Resposta (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440004",
    "username": "test_1704462600",
    "is_active": true,
    "accessed_at": null,
    "access_count": 0,
    "expires_at": "2026-01-12T10:30:00Z",
    "temp_ministry_id": "550e8400-e29b-41d4-a716-446655440005"
  }
}
```

**Erros:**
```json
// 404 Not Found
{ "success": false, "error": "Credenciais não encontradas" }
```

---

## 📄 Contracts (Contratos)

### POST /contracts
**Gerar contrato**

**Body:**
```json
{
  "pre_registration_id": "550e8400-e29b-41d4-a716-446655440001",
  "plan_name": "Plano Professional",
  "monthly_price": "R$ 199,90",
  "trial_days": 7
}
```

**Resposta (201):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440006",
    "contract_number": "CT-202601-123456ABC",
    "status": "draft",
    "html_content": "<!DOCTYPE html>...",
    "download_url": "/api/v1/admin/contracts/550e8400-e29b-41d4-a716-446655440006/download"
  },
  "message": "Contrato gerado com sucesso!"
}
```

**Estrutura do Contrato:**
```html
<!DOCTYPE html>
<html>
  <body>
    <div class="header">GestãoEklesia - Contrato de Serviço</div>
    <div class="section">
      <!-- Dados do cliente -->
      <!-- Plano e preços -->
      <!-- Período de teste -->
      <!-- Termos de serviço -->
      <!-- Assinaturas -->
    </div>
  </body>
</html>
```

**Erros:**
```json
// 400 Bad Request
{ "success": false, "error": "pre_registration_id é obrigatório" }

// 404 Not Found
{ "success": false, "error": "Pré-registro não encontrado" }

// 500 Internal Server Error
{ "success": false, "error": "Erro ao salvar contrato" }
```

---

### GET /contracts/:id
**Obter contrato**

**Path Parameters:**
```
id (string) - contract id
```

**Resposta (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440006",
    "pre_registration_id": "550e8400-e29b-41d4-a716-446655440001",
    "contract_number": "CT-202601-123456ABC",
    "contract_type": "standard",
    "file_url": null,
    "file_name": null,
    "status": "draft",
    "sent_at": null,
    "signed_at": null,
    "contract_data": {
      "contractNumber": "CT-202601-123456ABC",
      "ministryName": "Igreja Pentecostal",
      "pastorName": "João Silva",
      "cpfCnpj": "111.222.333-44",
      "quantityTemples": 3,
      "quantityMembers": 450,
      "planName": "Plano Professional",
      "monthlyPrice": "R$ 199,90",
      "trialDays": 7
    },
    "html_content": "<!DOCTYPE html>...",
    "created_at": "2026-01-05T10:30:00Z",
    "updated_at": "2026-01-05T10:30:00Z"
  }
}
```

---

## 📋 Status Valores

### Válidos para `status`:

| Valor | Descrição |
|-------|-----------|
| `not_contacted` | Não atendido |
| `in_progress` | Em atendimento |
| `budget_sent` | Orçamento enviado |
| `contract_generating` | Gerando contrato |
| `finalized_positive` | Finalizado com sucesso |
| `finalized_negative` | Finalizado sem conversão |

---

## 🔐 Autenticação

Todas as requisições requerem estar logado como admin.

**Headers necessários:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

---

## 💻 Exemplos com cURL

### Listar atendimentos
```bash
curl -X GET "http://localhost:3000/api/v1/admin/attendance?limit=10"
```

### Criar atendimento
```bash
curl -X POST "http://localhost:3000/api/v1/admin/attendance" \
  -H "Content-Type: application/json" \
  -d '{
    "pre_registration_id": "550e8400-e29b-41d4-a716-446655440001",
    "status": "not_contacted"
  }'
```

### Atualizar status
```bash
curl -X PUT "http://localhost:3000/api/v1/admin/attendance" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "550e8400-e29b-41d4-a716-446655440003",
    "status": "in_progress",
    "notes": "Contactado"
  }'
```

### Gerar credenciais
```bash
curl -X POST "http://localhost:3000/api/v1/admin/test-credentials" \
  -H "Content-Type: application/json" \
  -d '{
    "pre_registration_id": "550e8400-e29b-41d4-a716-446655440001",
    "email": "joao@example.com"
  }'
```

### Gerar contrato
```bash
curl -X POST "http://localhost:3000/api/v1/admin/contracts" \
  -H "Content-Type: application/json" \
  -d '{
    "pre_registration_id": "550e8400-e29b-41d4-a716-446655440001",
    "plan_name": "Plano Professional",
    "monthly_price": "R$ 199,90"
  }'
```

---

## 🧪 Teste com Postman

1. Importe collection:
```json
{
  "info": {
    "name": "GestãoEklesia - Painel Atendimento",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "GET Attendance List",
      "request": {
        "method": "GET",
        "url": "http://localhost:3000/api/v1/admin/attendance?limit=10"
      }
    },
    {
      "name": "POST Test Credentials",
      "request": {
        "method": "POST",
        "url": "http://localhost:3000/api/v1/admin/test-credentials",
        "body": {
          "pre_registration_id": "uuid",
          "email": "email@example.com"
        }
      }
    }
  ]
}
```

---

## 📊 Respostas de Erro

### 400 Bad Request
```json
{
  "success": false,
  "error": "Descrição do erro"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Recurso não encontrado"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

## ⏱️ Rate Limiting

Sem limites atuais (será implementado em produção)

---

## 📦 Paginação

```
Query: ?page=1&limit=10

Resposta meta:
{
  "total": 100,      // Total de itens
  "page": 1,         // Página atual
  "limit": 10,       // Itens por página
  "pages": 10        // Total de páginas
}
```

---

## 🎯 Webhooks (Futuro)

```
POST /webhooks/attendance-status-changed
POST /webhooks/credentials-generated
POST /webhooks/contract-created
```

---

**Última atualização:** 5 de janeiro de 2026
