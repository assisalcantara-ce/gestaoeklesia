# 🔌 API Endpoints - Referência Técnica

Documentação de todos os endpoints da API REST disponíveis.

---

## 📍 Base URL

```
http://localhost:3000/api/v1
```

ou em produção:
```
https://gestaoeklesia.com/api/v1
```

---

## 🔐 Autenticação

Todos os endpoints requerem:

```bash
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

Token obtido via:
```typescript
const { data } = await supabase.auth.signInWithPassword({
  email: "user@email.com",
  password: "senha123"
});
const token = data.session?.access_token;
```

---

## 👥 Members (Membros)

### GET /members
Listar todos os membros do ministry

**Query Params:**
- `status?` - Filtrar por status (active, inactive, deceased, transferred)
- `page?` - Número da página (default: 1)
- `limit?` - Itens por página (default: 20, max: 100)
- `search?` - Buscar por nome/email/CPF

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "João Silva",
      "email": "joao@email.com",
      "cpf": "123.456.789-00",
      "status": "active",
      "phone": "21999999999",
      "birth_date": "1990-01-15",
      "gender": "M",
      "address": "Rua A, 123",
      "city": "Rio de Janeiro",
      "state": "RJ",
      "created_at": "2024-01-02T10:00:00Z",
      "updated_at": "2024-01-02T10:00:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 20
}
```

**Exemplo:**
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/v1/members?status=active&page=1&limit=20"
```

---

### POST /members
Criar novo membro

**Body:**
```json
{
  "name": "João Silva",
  "email": "joao@email.com",
  "phone": "21999999999",
  "cpf": "123.456.789-00",
  "birth_date": "1990-01-15",
  "gender": "M",
  "marital_status": "single",
  "occupation": "Engenheiro",
  "address": "Rua A, 123",
  "city": "Rio de Janeiro",
  "state": "RJ",
  "status": "active"
}
```

**Response:** (201 Created)
```json
{
  "success": true,
  "data": {
    "id": "new-uuid",
    "ministry_id": "ministry-uuid",
    "name": "João Silva",
    "created_at": "2024-01-02T10:00:00Z",
    "updated_at": "2024-01-02T10:00:00Z"
  }
}
```

**Exemplo:**
```bash
curl -X POST -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"João","email":"joao@email.com"}' \
  http://localhost:3000/api/v1/members
```

---

### GET /members/:id
Obter um membro específico

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "member-uuid",
    "name": "João Silva",
    "email": "joao@email.com",
    ...
  }
}
```

---

### PUT /members/:id
Atualizar um membro

**Body:** (campos que você quer atualizar)
```json
{
  "name": "João da Silva",
  "status": "inactive"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "member-uuid",
    "name": "João da Silva",
    "status": "inactive",
    "updated_at": "2024-01-02T11:00:00Z"
  }
}
```

---

### DELETE /members/:id
Deletar um membro

**Response:**
```json
{
  "success": true,
  "data": { "id": "member-uuid" }
}
```

---

## 🎨 Cartões (Cards)

### GET /cartoes/templates
Listar templates de cartões

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "template-uuid",
      "name": "Cartão Membro 01",
      "type": "membro",
      "is_default": true,
      "template_json": {...},
      "colors": {...}
    }
  ]
}
```

---

### GET /cartoes/gerados
Listar cartões já gerados

**Query Params:**
- `member_id?` - Filtrar por membro
- `status?` - 'generated', 'printed', 'archived'
- `from_date?` - Data inicio (ISO 8601)
- `to_date?` - Data fim (ISO 8601)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "card-uuid",
      "member_id": "member-uuid",
      "template_id": "template-uuid",
      "pdf_url": "/storage/cards/card123.pdf",
      "status": "printed",
      "generated_at": "2024-01-02T10:00:00Z",
      "printed_at": "2024-01-02T10:30:00Z"
    }
  ]
}
```

---

### POST /cartoes/gerar
Gerar novo cartão em PDF

**Body:**
```json
{
  "member_id": "member-uuid",
  "template_id": "template-uuid"
}
```

**Response:** (201 Created)
```json
{
  "success": true,
  "data": {
    "id": "new-card-uuid",
    "pdf_url": "/storage/cards/card-new.pdf",
    "pdf_file": "base64_encoded_pdf_data"
  }
}
```

---

### POST /cartoes/gerar-lote
Gerar múltiplos cartões (batch)

**Body:**
```json
{
  "member_ids": ["uuid1", "uuid2", "uuid3"],
  "template_id": "template-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 3,
    "generated": 3,
    "failed": 0,
    "pdf_urls": [
      "/storage/cards/card1.pdf",
      "/storage/cards/card2.pdf",
      "/storage/cards/card3.pdf"
    ],
    "zip_url": "/storage/cards/batch-20240102.zip"
  }
}
```

---

## ⚙️ Configurações

### GET /configurations
Listar todas as configurações do ministry

**Response:**
```json
{
  "success": true,
  "data": {
    "member_status_values": ["Ativo", "Inativo", "Falecido"],
    "marital_statuses": ["Solteiro", "Casado", "Viúvo"],
    "primary_color": "#123b63",
    "secondary_color": "#0284c7"
  }
}
```

---

### GET /configurations/:key
Obter uma configuração específica

**Response:**
```json
{
  "success": true,
  "data": {
    "key": "member_status_values",
    "value": ["Ativo", "Inativo", "Falecido", "Transferido"],
    "category": "nomenclature"
  }
}
```

---

### PUT /configurations/:key
Atualizar uma configuração

**Body:**
```json
{
  "value": ["Ativo", "Inativo", "Falecido", "Transferido", "Suspenso"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "key": "member_status_values",
    "value": ["Ativo", "Inativo", "Falecido", "Transferido", "Suspenso"],
    "updated_at": "2024-01-02T11:00:00Z"
  }
}
```

---

## 📊 Dashboard

### GET /dashboard/stats
Obter estatísticas do ministry

**Response:**
```json
{
  "success": true,
  "data": {
    "total_members": 150,
    "active_members": 140,
    "inactive_members": 10,
    "cards_generated": 289,
    "cards_printed": 280,
    "last_30_days": {
      "members_added": 5,
      "cards_printed": 45
    },
    "storage_used": "2.5GB",
    "storage_limit": "5GB"
  }
}
```

---

## 📄 Relatórios

### POST /relatorios/membros
Gerar relatório PDF de membros

**Body:**
```json
{
  "format": "pdf",
  "filters": {
    "status": "active",
    "min_date": "2024-01-01",
    "max_date": "2024-01-31"
  },
  "fields": ["name", "email", "phone", "status"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "pdf_url": "/storage/reports/relatorio-20240102.pdf",
    "generated_at": "2024-01-02T12:00:00Z"
  }
}
```

---

## 🔍 Busca

### GET /search
Busca global em membros e configurações

**Query Params:**
- `q` - Termo de busca (obrigatório)
- `type?` - Filtrar por tipo ('members', 'all')
- `limit?` - Número de resultados (default: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "members": [
      {
        "id": "uuid",
        "name": "João Silva",
        "email": "joao@email.com",
        "type": "member"
      }
    ],
    "total": 1
  }
}
```

---

## ❌ Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Token inválido ou expirado"
  }
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Você não tem permissão para acessar este recurso"
  }
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Recurso não encontrado"
  }
}
```

### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos",
    "details": {
      "email": "Email inválido",
      "phone": "Telefone deve ter 10-11 dígitos"
    }
  }
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Erro interno do servidor. ID do erro: xyz123"
  }
}
```

---

## 🔗 Implementação

Todos os endpoints estão em:
```
src/app/api/v1/
├── members/
│   ├── route.ts        (GET list, POST create)
│   └── [id]/route.ts   (GET, PUT, DELETE)
├── cartoes/
│   ├── templates/
│   ├── gerados/
│   └── gerar/
├── configurations/
│   └── [key]/route.ts
├── dashboard/
│   └── stats/route.ts
└── ...
```

---

## 📝 Exemplo Completo (Frontend)

```typescript
// Listar membros
const response = await fetch('/api/v1/members', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const { success, data } = await response.json();

if (success) {
  console.log('Membros:', data);
} else {
  console.error('Erro:', error);
}
```

---

## 🔐 Rates Limits (Futuro)

```
- Tier Free: 100 requisições/minuto
- Tier Professional: 1000 requisições/minuto
- Tier Enterprise: 10000 requisições/minuto
```

Cabeçalho de resposta:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1672656000
```

---

## 📞 Suporte

Referência completa de endpoints para integração e desenvolvimento.

- **Arquivo:** `src/app/api/v1/`
- **Padrão:** RESTful com responses uniformes
- **Autenticação:** Supabase JWT
- **Segurança:** RLS + Validação manual

