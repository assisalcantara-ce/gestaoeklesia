# 🧪 Exemplos de Teste - Painel de Atendimento v2

Este documento contém exemplos de payloads JSON para testar cada endpoint.

## 1. POST /api/v1/admin/attendance/init

### Cenário: Admin aprova novo pré-cadastro

**Payload**:
```json
{
  "pre_registration_id": "550e8400-e29b-41d4-a716-446655440001",
  "assigned_to": "550e8400-e29b-41d4-a716-446655440099"
}
```

**Resposta Esperada (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440101",
    "pre_registration_id": "550e8400-e29b-41d4-a716-446655440001",
    "status": "in_progress",
    "assigned_to": "550e8400-e29b-41d4-a716-446655440099",
    "created_at": "2026-01-08T14:30:00.000Z",
    "updated_at": "2026-01-08T14:30:00.000Z"
  },
  "meta": {
    "created_at": "2026-01-08T14:30:00.000Z"
  }
}
```

**Resposta Esperada (400 - Já existe)**:
```json
{
  "success": false,
  "error": "Attendance record already exists for this pre-registration"
}
```

---

## 2. GET /api/v1/admin/attendance

### Cenário A: Buscar todos os registros de atendimento

**URL**:
```
GET /api/v1/admin/attendance?limit=50&offset=0
```

**Resposta Esperada (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440101",
      "pre_registration_id": "550e8400-e29b-41d4-a716-446655440001",
      "ministry_name": "Ministério da Graça",
      "pastor_name": "Pastor João Silva",
      "email": "joao@ministeriodagraca.com.br",
      "whatsapp": "+55 11 99999-9999",
      "quantity_temples": 3,
      "quantity_members": 150,
      "status": "in_progress",
      "notes": "Cliente aguardando orçamento",
      "assigned_to": "550e8400-e29b-41d4-a716-446655440099",
      "last_contact_at": "2026-01-08T14:35:00.000Z",
      "created_at": "2026-01-08T14:30:00.000Z",
      "updated_at": "2026-01-08T14:35:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440102",
      "pre_registration_id": "550e8400-e29b-41d4-a716-446655440002",
      "ministry_name": "Assembléia de Deus Missão",
      "pastor_name": "Pastor Carlos",
      "email": "carlos@assembleia.com.br",
      "whatsapp": "+55 21 98888-8888",
      "quantity_temples": 5,
      "quantity_members": 200,
      "status": "budget_sent",
      "notes": "Orçamento enviado em 07/01",
      "assigned_to": "550e8400-e29b-41d4-a716-446655440099",
      "last_contact_at": "2026-01-07T10:00:00.000Z",
      "created_at": "2026-01-07T09:00:00.000Z",
      "updated_at": "2026-01-07T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 2,
    "limit": 50,
    "offset": 0
  }
}
```

### Cenário B: Filtrar por status

**URL**:
```
GET /api/v1/admin/attendance?status=in_progress&limit=50
```

**Resposta Esperada (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440101",
      "status": "in_progress",
      "ministry_name": "Ministério da Graça",
      "pastor_name": "Pastor João Silva",
      "email": "joao@ministeriodagraca.com.br",
      "whatsapp": "+55 11 99999-9999",
      "quantity_temples": 3,
      "quantity_members": 150,
      "notes": "Cliente aguardando orçamento",
      "last_contact_at": "2026-01-08T14:35:00.000Z",
      "created_at": "2026-01-08T14:30:00.000Z",
      "updated_at": "2026-01-08T14:35:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "limit": 50,
    "offset": 0,
    "filtered_by": "status=in_progress"
  }
}
```

---

## 3. PUT /api/v1/admin/attendance

### Cenário: Admin muda status para "budget_sent"

**Payload**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440101",
  "status": "budget_sent",
  "notes": "Orçamento de R$ 15.000,00 enviado via email",
  "last_contact_at": "2026-01-08T14:40:00.000Z"
}
```

**Resposta Esperada (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440101",
    "pre_registration_id": "550e8400-e29b-41d4-a716-446655440001",
    "status": "budget_sent",
    "notes": "Orçamento de R$ 15.000,00 enviado via email",
    "last_contact_at": "2026-01-08T14:40:00.000Z",
    "created_at": "2026-01-08T14:30:00.000Z",
    "updated_at": "2026-01-08T14:40:00.000Z"
  },
  "meta": {
    "history_recorded": true,
    "history_id": "550e8400-e29b-41d4-a716-446655440201"
  }
}
```

**Resposta do Banco de Dados (attendance_history)**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440201",
  "attendance_status_id": "550e8400-e29b-41d4-a716-446655440101",
  "from_status": "in_progress",
  "to_status": "budget_sent",
  "notes": "Orçamento de R$ 15.000,00 enviado via email",
  "changed_by": "550e8400-e29b-41d4-a716-446655440099",
  "created_at": "2026-01-08T14:40:00.000Z"
}
```

---

## 4. PUT /api/v1/admin/pre-registrations

### Cenário A: Admin completa dados do assinante

**Payload**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "ministry_name": "Ministério da Graça - Filial São Paulo",
  "pastor_name": "Pastor João Silva Santos",
  "email": "joao.silva@ministeriodagraca.com.br",
  "whatsapp": "+55 11 99999-9999",
  "quantity_temples": 5,
  "quantity_members": 250
}
```

**Resposta Esperada (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "organization_id": "550e8400-e29b-41d4-a716-446655440000",
    "ministry_name": "Ministério da Graça - Filial São Paulo",
    "pastor_name": "Pastor João Silva Santos",
    "email": "joao.silva@ministeriodagraca.com.br",
    "whatsapp": "+55 11 99999-9999",
    "quantity_temples": 5,
    "quantity_members": 250,
    "created_at": "2026-01-05T10:00:00.000Z",
    "updated_at": "2026-01-08T14:40:00.000Z"
  },
  "meta": {
    "updated_at": "2026-01-08T14:40:00.000Z"
  }
}
```

### Cenário B: Atualizar apenas um campo

**Payload**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "whatsapp": "+55 11 98765-4321"
}
```

**Resposta Esperada (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "ministry_name": "Ministério da Graça - Filial São Paulo",
    "pastor_name": "Pastor João Silva Santos",
    "email": "joao.silva@ministeriodagraca.com.br",
    "whatsapp": "+55 11 98765-4321",
    "quantity_temples": 5,
    "quantity_members": 250,
    "updated_at": "2026-01-08T14:45:00.000Z"
  },
  "meta": {
    "updated_at": "2026-01-08T14:45:00.000Z"
  }
}
```

### Cenário C: ID não existe

**Payload**:
```json
{
  "id": "550e8400-e29b-41d4-a716-999999999999",
  "ministry_name": "Não Existe"
}
```

**Resposta Esperada (400)**:
```json
{
  "success": false,
  "error": "No rows updated"
}
```

---

## 5. Fluxo Completo de Teste

### Passo 1: Listar registros
```bash
curl -X GET http://localhost:3000/api/v1/admin/attendance
```

### Passo 2: Criar novo attendance
```bash
curl -X POST http://localhost:3000/api/v1/admin/attendance/init \
  -H "Content-Type: application/json" \
  -d '{
    "pre_registration_id": "550e8400-e29b-41d4-a716-446655440001",
    "assigned_to": "550e8400-e29b-41d4-a716-446655440099"
  }'
```

### Passo 3: Editar dados do pré-cadastro
```bash
curl -X PUT http://localhost:3000/api/v1/admin/pre-registrations \
  -H "Content-Type: application/json" \
  -d '{
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "ministry_name": "Novo Nome",
    "quantity_temples": 10
  }'
```

### Passo 4: Mudar status
```bash
curl -X PUT http://localhost:3000/api/v1/admin/attendance \
  -H "Content-Type: application/json" \
  -d '{
    "id": "550e8400-e29b-41d4-a716-446655440101",
    "status": "finalized_positive",
    "notes": "Cliente confirmado! Agendado para implementação.",
    "last_contact_at": "2026-01-08T14:50:00.000Z"
  }'
```

### Passo 5: Listar novamente (verificar mudanças)
```bash
curl -X GET http://localhost:3000/api/v1/admin/attendance
```

---

## 6. Dados de Teste (Seed)

### SQL para criar registros de teste

```sql
-- Inserir pré-registros de teste
INSERT INTO pre_registrations (
  id, 
  organization_id, 
  ministry_name, 
  pastor_name, 
  email, 
  whatsapp, 
  quantity_temples,
  quantity_members,
  created_at
) VALUES
(
  '550e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440000',
  'Ministério da Graça',
  'Pastor João Silva',
  'joao@ministeriodagraca.com.br',
  '+55 11 99999-9999',
  3,
  150,
  NOW()
),
(
  '550e8400-e29b-41d4-a716-446655440002',
  '550e8400-e29b-41d4-a716-446655440000',
  'Assembléia de Deus Missão',
  'Pastor Carlos',
  'carlos@assembleia.com.br',
  '+55 21 98888-8888',
  5,
  200,
  NOW()
),
(
  '550e8400-e29b-41d4-a716-446655440003',
  '550e8400-e29b-41d4-a716-446655440000',
  'Templo de Cristo',
  'Pastor Maria',
  'maria@templocristo.com.br',
  '+55 31 97777-7777',
  2,
  80,
  NOW()
);

-- Inserir attendance_status de teste
INSERT INTO attendance_status (
  id,
  pre_registration_id,
  status,
  notes,
  assigned_to,
  created_at
) VALUES
(
  '550e8400-e29b-41d4-a716-446655440101',
  '550e8400-e29b-41d4-a716-446655440001',
  'in_progress',
  'Cliente aguardando orçamento',
  '550e8400-e29b-41d4-a716-446655440099',
  NOW()
),
(
  '550e8400-e29b-41d4-a716-446655440102',
  '550e8400-e29b-41d4-a716-446655440002',
  'budget_sent',
  'Orçamento enviado em 07/01',
  '550e8400-e29b-41d4-a716-446655440099',
  NOW() - INTERVAL '1 day'
),
(
  '550e8400-e29b-41d4-a716-446655440103',
  '550e8400-e29b-41d4-a716-446655440003',
  'not_contacted',
  NULL,
  '550e8400-e29b-41d4-a716-446655440099',
  NOW()
);

-- Inserir histórico de teste
INSERT INTO attendance_history (
  id,
  attendance_status_id,
  from_status,
  to_status,
  notes,
  changed_by,
  created_at
) VALUES
(
  '550e8400-e29b-41d4-a716-446655440201',
  '550e8400-e29b-41d4-a716-446655440101',
  'not_contacted',
  'in_progress',
  'Primeira ligação realizada',
  '550e8400-e29b-41d4-a716-446655440099',
  NOW() - INTERVAL '5 minutes'
),
(
  '550e8400-e29b-41d4-a716-446655440202',
  '550e8400-e29b-41d4-a716-446655440102',
  'not_contacted',
  'in_progress',
  'Conversação inicial positiva',
  '550e8400-e29b-41d4-a716-446655440099',
  NOW() - INTERVAL '1 day 2 hours'
),
(
  '550e8400-e29b-41d4-a716-446655440203',
  '550e8400-e29b-41d4-a716-446655440102',
  'in_progress',
  'budget_sent',
  'Orçamento de R$ 15.000,00 enviado via email',
  '550e8400-e29b-41d4-a716-446655440099',
  NOW() - INTERVAL '1 day 1 hours'
);
```

---

## 7. Cenários de Erro

### Erro 1: ID Inválido (UUID malformado)

**Payload**:
```json
{
  "id": "not-a-uuid"
}
```

**Resposta Esperada (400)**:
```json
{
  "success": false,
  "error": "Invalid UUID format"
}
```

### Erro 2: Campo Obrigatório Faltando

**Payload**:
```json
{
  "status": "finalized_positive"
}
```

**Resposta Esperada (400)**:
```json
{
  "success": false,
  "error": "ID do atendimento é obrigatório"
}
```

### Erro 3: Banco de Dados Indisponível

**Resposta Esperada (500)**:
```json
{
  "success": false,
  "error": "Erro ao conectar com o banco de dados"
}
```

---

## 8. Performance Esperada

| Operação | Tempo Esperado | Aceitável até |
|----------|---|---|
| GET (1-100 registros) | 100-200ms | 500ms |
| POST /init | 150-300ms | 500ms |
| PUT attendance | 150-300ms | 500ms |
| PUT pre-registrations | 100-200ms | 500ms |
| Dupla atualização (PUT + PUT) | 250-500ms | 1000ms |

---

## 9. Checklist de Validação de Testes

```
[ ] POST /init retorna 200 com novo ID
[ ] GET retorna todos os registros
[ ] GET ?status=X filtra corretamente
[ ] PUT attendance atualiza status
[ ] PUT attendance cria history
[ ] PUT pre-registrations atualiza dados
[ ] PUT com ID inválido retorna erro
[ ] Modal pré-popula com dados corretos
[ ] Modal dupla atualização funciona
[ ] História é registrada corretamente
[ ] Sem memory leaks após 20+ operações
[ ] Performance < 1 segundo por operação
[ ] Usuário não-admin não consegue atualizar
```

---

**Versão**: 2.0  
**Data**: 8 de Janeiro de 2026  
**Pronto para Teste**: ✅ SIM
