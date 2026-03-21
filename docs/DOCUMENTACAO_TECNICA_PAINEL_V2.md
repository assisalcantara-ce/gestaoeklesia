# 🔧 Documentação Técnica Completa: Painel de Atendimento v2

## 📐 Arquitetura do Sistema

### Fluxo de Dados Completo

```
┌──────────────────────────────────────────────────────────────┐
│                   TrialSignupsWidget                         │
│              (Mostra Pré-Cadastros Pendentes)               │
│                                                               │
│  [Ministério] [Pastor] [Email]  [Aprovar] [Rejeitar]       │
└────────────────────────┬─────────────────────────────────────┘
                         │ Clica "Aprovar"
                         ↓
        POST /api/v1/admin/attendance/init
                         │
        ┌────────────────┴────────────────┐
        ↓                                 ↓
   Valida se já existe    Cria novo registro
   attendance_status      em attendance_status
        │                 │
        │                 status = 'in_progress'
        │                 created_at = agora
        │                 assigned_to = admin_id
        │
        └────────────────┬────────────────┘
                         ↓
        response = { success: true, id: "uuid" }
                         │
        Mostra notificação "✓ Registrado!"
        setTimeout(1000) → redirect
                         │
                         ↓
   /admin/atendimento?focus={pre_registration_id}
                         │
        ┌────────────────┴────────────────┐
        ↓                                 ↓
   Dashboard carrega     useEffect detecta
   attendances via GET   parâmetro "focus"
        │                │
        │                setTimeout(500ms) →
        │                handleOpenModal()
        ↓                │
   Modal abre com:       ↓
   - Dados do assinante  Pré-popula editingData
   - Status dropdown     com dados do registro
   - Observações
   - Campos editáveis
                         │
        ┌────────────────┴────────────────┐
        ↓                                 ↓
   Admin edita dados    Admin seleciona novo
   do assinante         status + observações
                         │
                         ↓
              Clica "💾 Salvar Mudanças"
                         │
        ┌────────────────┴────────────────┐
        ↓                                 ↓
  PUT /api/v1/admin/attendance    PUT /api/v1/admin/pre-registrations
  (atualiza status + notas)       (atualiza dados do assinante)
        │                         │
        ↓                         ↓
  Valida sucesso           Valida sucesso
        │                         │
        └────────────────┬────────┘
                         ↓
        INSERT em attendance_history
        (registra mudança com timestamp)
                         │
                         ↓
        Fecha modal + recarrega dashboard
                         │
                         ↓
   Dashboard mostra registro com status novo
   Na coluna correta do kanban de status
```

## 🗄️ Banco de Dados

### Tabelas Envolvidas

#### 1. `pre_registrations` (EXISTENTE)
```sql
CREATE TABLE pre_registrations (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  ministry_name VARCHAR(255),
  pastor_name VARCHAR(255),
  email VARCHAR(255),
  whatsapp VARCHAR(20),
  quantity_temples INTEGER,
  quantity_members INTEGER,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

**Atualizado por**: `PUT /api/v1/admin/pre-registrations`

#### 2. `attendance_status` (NOVA - Criada em v1)
```sql
CREATE TABLE attendance_status (
  id UUID PRIMARY KEY,
  pre_registration_id UUID REFERENCES pre_registrations(id),
  status VARCHAR(50), -- 'not_contacted', 'in_progress', 'budget_sent', etc
  notes TEXT,
  assigned_to UUID REFERENCES users(id),
  last_contact_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

**Atualizado por**: `PUT /api/v1/admin/attendance`
**Criado por**: `POST /api/v1/admin/attendance/init`

#### 3. `attendance_history` (NOVA - Criada em v1)
```sql
CREATE TABLE attendance_history (
  id UUID PRIMARY KEY,
  attendance_status_id UUID REFERENCES attendance_status(id),
  from_status VARCHAR(50),
  to_status VARCHAR(50),
  notes TEXT,
  changed_by UUID REFERENCES users(id),
  created_at TIMESTAMP
)
```

**Preenchido automaticamente por**: `PUT /api/v1/admin/attendance`

## 🔌 APIs Envolvidas

### 1. POST /api/v1/admin/attendance/init (NOVA em v1)
**Chamado por**: `TrialSignupsWidget.handleApprove()`

**Request**:
```json
{
  "pre_registration_id": "uuid-do-pre-cadastro",
  "assigned_to": "uuid-do-admin"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid-novo-attendance",
    "pre_registration_id": "uuid",
    "status": "in_progress",
    "created_at": "2026-01-08T10:30:00Z"
  }
}
```

**Validações**:
- ✓ Verifica se já existe attendance_status para este pre_registration
- ✓ Se existe, retorna erro (não cria duplicata)
- ✓ Cria novo com status padrão 'in_progress'

### 2. GET /api/v1/admin/attendance (EXISTENTE - v1)
**Chamado por**: `Dashboard.fetchAttendances()`

**Query Params**:
- `status`: filtrar por status (opcional)
- `limit`: número máximo de resultados (default: 50)
- `offset`: paginação (default: 0)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "pre_registration_id": "uuid",
      "ministry_name": "Ministério X",
      "pastor_name": "Pastor Y",
      "email": "email@example.com",
      "whatsapp": "+55 11 99999-9999",
      "quantity_temples": 3,
      "quantity_members": 100,
      "status": "in_progress",
      "notes": "Cliente aguardando orçamento",
      "last_contact_at": "2026-01-08T10:30:00Z",
      "created_at": "2026-01-08T10:00:00Z"
    }
  ],
  "meta": { "total": 45 }
}
```

### 3. PUT /api/v1/admin/attendance (EXISTENTE - v1)
**Chamado por**: `Dashboard.handleUpdateAttendance()` (passo 1)

**Request**:
```json
{
  "id": "uuid-do-attendance",
  "status": "budget_sent",
  "notes": "Orçamento enviado via email",
  "last_contact_at": "2026-01-08T10:35:00Z"
}
```

**Response**:
```json
{
  "success": true,
  "data": { /* attendance atualizado */ }
}
```

**Side Effects**:
- ✓ Atualiza `attendance_status`
- ✓ Insere novo registro em `attendance_history`

### 4. PUT /api/v1/admin/pre-registrations (NOVA em v2)
**Chamado por**: `Dashboard.handleUpdateAttendance()` (passo 2)

**Request**:
```json
{
  "id": "uuid-do-pre-registro",
  "ministry_name": "Novo Nome",
  "pastor_name": "Novo Pastor",
  "email": "novo@email.com",
  "whatsapp": "+55 11 98888-8888",
  "quantity_temples": 5,
  "quantity_members": 200
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "ministry_name": "Novo Nome",
    "pastor_name": "Novo Pastor",
    "email": "novo@email.com",
    "whatsapp": "+55 11 98888-8888",
    "quantity_temples": 5,
    "quantity_members": 200,
    "updated_at": "2026-01-08T10:35:00Z"
  }
}
```

**Validações**:
- ✓ `id` é obrigatório
- ✓ Atualiza apenas campos fornecidos
- ✓ Retorna error se id não existir

## 📦 Componentes Frontend

### 1. TrialSignupsWidget.tsx
**Localização**: `src/components/TrialSignupsWidget.tsx`

**Estado**:
```typescript
const [preRegistrations, setPreRegistrations] = useState<PreRegistration[]>([]);
const [showDetailModal, setShowDetailModal] = useState(false);
const [showCredsModal, setShowCredsModal] = useState(false);
const [selectedPreReg, setSelectedPreReg] = useState<PreRegistration | null>(null);
```

**Função: handleApprove()**
```typescript
const handleApprove = async (preRegId: string) => {
  try {
    // 1. POST para criar attendance_status
    const response = await fetch('/api/v1/admin/attendance/init', {
      method: 'POST',
      body: JSON.stringify({ pre_registration_id: preRegId })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // 2. Mostra notificação
      toast.success('✓ Registrado no painel de atendimento!');
      
      // 3. Aguarda 1 segundo
      setTimeout(() => {
        // 4. Redireciona com focus parameter
        router.push(`/admin/atendimento?focus=${preRegId}`);
      }, 1000);
    }
  } catch (error) {
    toast.error('Erro ao aprovar');
  }
};
```

### 2. Dashboard (/admin/atendimento/page.tsx)
**Localização**: `src/app/admin/atendimento/page.tsx`

**Estados Principais**:
```typescript
const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
const [selectedAttendance, setSelectedAttendance] = useState<AttendanceRecord | null>(null);
const [showModal, setShowModal] = useState(false);
const [modalStatus, setModalStatus] = useState('');
const [modalNotes, setModalNotes] = useState('');
const [editingData, setEditingData] = useState<any>({}); // NOVO em v2
```

**Função: useEffect() - Auto-focus**
```typescript
useEffect(() => {
  const searchParams = new URLSearchParams(window.location.search);
  const focusId = searchParams.get('focus');
  
  fetchAttendances().then(() => {
    if (focusId) {
      const focusedAttendance = attendances.find(a => a.pre_registration_id === focusId);
      if (focusedAttendance) {
        // Aguarda 500ms para garantir que DOM está pronto
        setTimeout(() => {
          handleOpenModal(focusedAttendance);
        }, 500);
      }
    }
  });
}, []);
```

**Função: handleOpenModal()**
```typescript
const handleOpenModal = (attendance: AttendanceRecord) => {
  setSelectedAttendance(attendance);
  setModalStatus(attendance.status);
  setModalNotes(attendance.notes || '');
  // NOVO em v2: carrega dados para edição
  setEditingData({
    ministry_name: attendance.ministry_name || '',
    pastor_name: attendance.pastor_name || '',
    email: attendance.email || '',
    whatsapp: attendance.whatsapp || '',
    quantity_temples: attendance.quantity_temples || 0,
    quantity_members: attendance.quantity_members || 0,
  });
  setShowModal(true);
};
```

**Função: handleUpdateAttendance() - Dupla Atualização**
```typescript
const handleUpdateAttendance = async () => {
  if (!selectedAttendance) return;

  try {
    // PASSO 1: Atualizar attendance_status
    const attendanceResponse = await fetch('/api/v1/admin/attendance', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selectedAttendance.id,
        status: modalStatus,
        notes: modalNotes,
        last_contact_at: new Date().toISOString(),
      }),
    });

    const attendanceResult = await attendanceResponse.json();
    if (!attendanceResult.success) {
      alert('Erro ao atualizar: ' + attendanceResult.error);
      return; // PARA AQUI se falhar
    }

    // PASSO 2: Atualizar pre_registrations (NOVO em v2)
    if (selectedAttendance.pre_registration_id) {
      const preRegResponse = await fetch('/api/v1/admin/pre-registrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedAttendance.pre_registration_id,
          ministry_name: editingData.ministry_name,
          pastor_name: editingData.pastor_name,
          email: editingData.email,
          whatsapp: editingData.whatsapp,
          quantity_temples: parseInt(editingData.quantity_temples) || 0,
          quantity_members: parseInt(editingData.quantity_members) || 0,
        }),
      });

      const preRegResult = await preRegResponse.json();
      if (!preRegResult.success) {
        console.warn('Aviso: dados do assinante não foram atualizados');
      }
    }

    // PASSO 3: Feedback
    setShowModal(false);
    fetchAttendances(selectedStatus || undefined);
  } catch (error) {
    console.error('Error updating attendance:', error);
    alert('Erro ao conectar com servidor');
  }
};
```

## 🔄 Sequência de Eventos Temporal

### Timeline Completa (Exemplo):

```
08:00:00 - Admin entra em /admin e vê pré-cadastro
08:00:05 - Clica botão "Aprovar" em TrialSignupsWidget
           └─ handleApprove() inicia

08:00:06 - POST /api/v1/admin/attendance/init enviado
           └─ Servidor valida, cria attendance_status
           └─ Retorna { success: true, id: "uuid123" }

08:00:07 - JavaScript mostra toast "✓ Registrado!"
           └─ setTimeout(1000) inicia

08:00:08 - (aguardando...)

08:00:09 - redirect para /admin/atendimento?focus=pre_reg_uuid
           └─ Dashboard page carrega

08:00:10 - GET /api/v1/admin/attendance executado
           └─ Servidor retorna todos os attendance_status
           └─ setAttendances(data) atualiza state

08:00:11 - useEffect detecta parâmetro "focus" na URL
           └─ Busca attendance com pré_id correspondente
           └─ setTimeout(500) inicia

08:00:12 - (aguardando DOM estar pronto...)

08:00:13 - handleOpenModal() é chamado
           └─ Modal abre e pré-popula editingData
           └─ Cursor no primeiro campo editável

08:00:15 - Admin edita "Quantidade de Templos": 3 → 5
08:00:20 - Admin seleciona status: "Em Atendimento"
08:00:30 - Admin adiciona nota: "Cliente confirmou interesse"
08:00:31 - Clica "💾 Salvar Mudanças"
           └─ handleUpdateAttendance() inicia

08:00:32 - PUT /api/v1/admin/attendance enviado
           └─ Atualiza status e notes
           └─ Insere em attendance_history automaticamente

08:00:33 - Resposta: { success: true, ... }

08:00:34 - PUT /api/v1/admin/pre-registrations enviado
           └─ Atualiza quantity_temples: 5
           └─ Status: salvo

08:00:35 - Resposta: { success: true, ... }

08:00:36 - Modal fecha
08:00:37 - Dashboard recarrega dados
08:00:38 - Novo status visível no kanban

TOTAL: ~38 segundos do clique ao feedback visual
```

## ✅ Checklist de Validação

### Antes de Usar em Produção:

- [ ] Testar com 10+ registros
- [ ] Verificar performance (load time do dashboard)
- [ ] Testar edição de todos os campos
- [ ] Testar mudança de status
- [ ] Verificar que history é registrada corretamente
- [ ] Testar com usuários diferentes (permissions)
- [ ] Testar auto-focus com diferentes parâmetros
- [ ] Teste de erro: enviar dados inválidos
- [ ] Teste de erro: falta de permissões
- [ ] Backup do banco antes de usar
- [ ] Plano de rollback preparado

### Performance:

- [ ] Dashboard carrega < 2 segundos
- [ ] Modal abre < 500ms
- [ ] Salvamento completa < 2 segundos
- [ ] Nenhum memory leak em browser
- [ ] Nenhuma query N+1 no servidor

## 🐛 Debugging

### Logs Úteis:

```javascript
// No navegador (F12)
console.log(attendances);           // Ver todos os registros
console.log(selectedAttendance);    // Ver registro aberto
console.log(editingData);           // Ver dados sendo editados
console.log(modalStatus);           // Ver status selecionado
```

### Network Tab:

Procure por estas requisições:

```
POST /api/v1/admin/attendance/init
GET  /api/v1/admin/attendance?limit=50
PUT  /api/v1/admin/attendance
PUT  /api/v1/admin/pre-registrations
```

Cada uma deve ter status `200` ou erro deve indicar o quê.

### Supabase Logs:

```sql
-- Ver últimos inserts em attendance_history
SELECT * FROM attendance_history 
ORDER BY created_at DESC 
LIMIT 10;

-- Ver mudanças em attendance_status
SELECT id, status, updated_at 
FROM attendance_status 
ORDER BY updated_at DESC 
LIMIT 10;

-- Ver atualizações em pre_registrations
SELECT id, ministry_name, quantity_temples, updated_at 
FROM pre_registrations 
ORDER BY updated_at DESC 
LIMIT 10;
```

## 📚 Referências

- Fluxo anterior: `ATUALIZACAO_PAINEL_V1_WORKFLOW.md`
- API docs: `cursor/rules/ATTENDANCE_API_REFERENCE.md`
- Database schema: `cursor/rules/DATABASE_SCHEMA.md`
