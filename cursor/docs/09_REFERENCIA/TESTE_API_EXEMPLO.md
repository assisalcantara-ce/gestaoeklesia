# 🧪 TESTE DA API: Exemplo Prático

## Opção 1: Usando cURL (Terminal)

### 1. Criar um Membro

```bash
curl -X POST http://localhost:3000/api/v1/members \
  -H "Content-Type: application/json" \
  -d '{
    "ministry_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "name": "João Silva",
    "email": "joao@exemplo.com",
    "phone": "11999999999",
    "cpf": "12345678901",
    "birth_date": "1990-01-15",
    "gender": "M",
    "marital_status": "single",
    "city": "São Paulo",
    "state": "SP",
    "status": "active"
  }'
```

**Resposta esperada (201 Created):**
```json
{
  "id": "uuid-do-novo-membro",
  "ministry_id": "uuid-do-ministry",
  "name": "João Silva",
  "email": "joao@exemplo.com",
  "status": "active",
  "created_at": "2024-01-15T10:30:00Z",
  ...
}
```

### 2. Listar Membros

```bash
curl http://localhost:3000/api/v1/members?page=1&limit=20
```

**Resposta esperada:**
```json
{
  "data": [
    {
      "id": "...",
      "name": "João Silva",
      ...
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "total_pages": 1
  }
}
```

### 3. Obter Um Membro

```bash
curl http://localhost:3000/api/v1/members/{id-do-membro}
```

### 4. Atualizar Membro

```bash
curl -X PUT http://localhost:3000/api/v1/members/{id-do-membro} \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva (atualizado)",
    "phone": "11988888888"
  }'
```

### 5. Deletar Membro

```bash
curl -X DELETE http://localhost:3000/api/v1/members/{id-do-membro}
```

---

## Opção 2: Usando Postman

1. **Instale Postman:** https://www.postman.com/downloads/
2. **Importe a coleção:** Arquivo será criado em breve
3. **Execute os testes**

---

## Opção 3: Usando Cliente Node.js

```typescript
// test-api.ts

async function testAPI() {
  const ministryId = 'seu-ministry-id'

  console.log('🧪 Testando API de Membros...\n')

  // Teste 1: CREATE
  console.log('1️⃣  Criando membro...')
  const createRes = await fetch('http://localhost:3000/api/v1/members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ministry_id: ministryId,
      name: 'Maria Santos',
      email: 'maria@exemplo.com',
      cpf: '98765432109',
      status: 'active',
    }),
  })

  const member = await createRes.json()
  console.log('✓ Membro criado:', member.id)

  // Teste 2: READ (listar)
  console.log('\n2️⃣  Listando membros...')
  const listRes = await fetch('http://localhost:3000/api/v1/members')
  const { data, pagination } = await listRes.json()
  console.log(`✓ ${pagination.total} membros encontrados`)

  // Teste 3: READ (individual)
  console.log('\n3️⃣  Obtendo membro específico...')
  const getRes = await fetch(`http://localhost:3000/api/v1/members/${member.id}`)
  const gotMember = await getRes.json()
  console.log('✓ Membro:', gotMember.name)

  // Teste 4: UPDATE
  console.log('\n4️⃣  Atualizando membro...')
  const updateRes = await fetch(`http://localhost:3000/api/v1/members/${member.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Maria Santos Silva',
      phone: '11998765432',
    }),
  })

  const updated = await updateRes.json()
  console.log('✓ Membro atualizado:', updated.name)

  // Teste 5: DELETE
  console.log('\n5️⃣  Deletando membro...')
  const deleteRes = await fetch(`http://localhost:3000/api/v1/members/${member.id}`, {
    method: 'DELETE',
  })

  const deleted = await deleteRes.json()
  console.log('✓ Membro deletado:', deleted.deleted_id)

  console.log('\n✅ Todos os testes passaram!')
}

testAPI().catch(console.error)
```

Execute com:
```bash
npx ts-node test-api.ts
```

---

## Verificar Status da API

```bash
# Verificar se servidor está rodando
curl http://localhost:3000

# Verificar connection ao Supabase
curl -X POST http://localhost:3000/api/v1/members \
  -H "Content-Type: application/json" \
  -d '{"ministry_id": "test"}'
  # Se retornar erro Supabase, conexão está ok
```

---

## Erros Comuns e Soluções

### ❌ "Cannot find module @supabase/supabase-js"
```bash
npm install @supabase/supabase-js
```

### ❌ "SUPABASE_URL is required"
Verifique `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### ❌ "RLS policy error"
Significa RLS está funcionando corretamente!
- Verifique se ministry_id está correto
- Verifique se usuário tem acesso a esse ministry

### ❌ "404 Not Found"
- Verifique URL da API: `/api/v1/members` (não `/api/members`)
- Verifique se servidor está rodando: `npm run dev`

### ❌ "400 Bad Request - Nome é obrigatório"
Adicione `name` no body da requisição

---

## Próximas Ações

✅ Setup Supabase
✅ Executar SQL schema  
✅ Criar usuário e ministry
⏳ **Testar API com os exemplos acima**
⏳ Conectar frontend aos endpoints
⏳ Criar interface de usuário

---

**Pronto para testar?** 🚀

